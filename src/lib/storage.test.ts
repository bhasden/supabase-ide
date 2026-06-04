import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from './types';
import {
  clearAllSettings,
  clearFilters,
  clearLocalData,
  clearTables,
  defaultTableViewState,
  loadSettings,
} from './storage';

const populatedSettings: AppSettings = {
  activeConnectionId: 'conn-1',
  activeTable: 'people',
  connections: [
    {
      id: 'conn-1',
      name: 'Project',
      url: 'https://example.supabase.co',
      apiKey: 'public-key',
      schemaDiscovery: {
        restOpenApi: 'unknown',
        graphql: 'unknown',
      },
      createdAt: 1,
      tables: [
        {
          name: 'people',
          schema: 'public',
          addedAt: 2,
          columns: [{ name: 'name', type: 'text' }],
          viewState: {
            rules: {
              combinator: 'and',
              rules: [{ field: 'name', operator: 'contains', value: 'ada' }],
            },
            sortOrder: { field: 'name', direction: 'asc' },
          },
        },
      ],
    },
  ],
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  });
});

describe('storage clear helpers', () => {
  it('clears filters and ordering while keeping connections and tables', () => {
    const next = clearFilters(populatedSettings);

    expect(next.connections).toHaveLength(1);
    expect(next.connections[0].tables).toHaveLength(1);
    expect(next.connections[0].tables[0].viewState).toEqual(defaultTableViewState);
    expect(next.activeTable).toBe('people');
  });

  it('clears saved tables while keeping connections', () => {
    const next = clearTables(populatedSettings);

    expect(next.connections).toHaveLength(1);
    expect(next.connections[0].tables).toEqual([]);
    expect(next.activeConnectionId).toBe('conn-1');
    expect(next.activeTable).toBeNull();
  });

  it('clears all settings', () => {
    const next = clearAllSettings();

    expect(next.connections).toEqual([]);
    expect(next.activeConnectionId).toBeNull();
    expect(next.activeTable).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('supabase-explorer-settings');
  });

  it('treats connections as a full local settings clear', () => {
    const next = clearLocalData(populatedSettings, ['connections']);

    expect(next.connections).toEqual([]);
    expect(next.activeConnectionId).toBeNull();
    expect(next.activeTable).toBeNull();
  });

  it('strips old persisted rule lock state when loading settings', () => {
    localStorage.setItem(
      'supabase-explorer-settings',
      JSON.stringify({
        ...populatedSettings,
        connections: [
          {
            ...populatedSettings.connections[0],
            tables: [
              {
                ...populatedSettings.connections[0].tables[0],
                viewState: {
                  rules: {
                    combinator: 'and',
                    disabled: true,
                    rules: [
                      {
                        field: 'name',
                        operator: 'contains',
                        value: 'ada',
                        disabled: true,
                      },
                    ],
                  },
                  sortOrder: null,
                },
              },
            ],
          },
        ],
      })
    );

    const next = loadSettings();
    const rules = next.connections[0].tables[0].viewState.rules;

    expect(rules).not.toHaveProperty('disabled');
    expect(rules.rules[0]).not.toHaveProperty('disabled');
  });
});
