import type {
  AppSettings,
  DbConnection,
  SavedTable,
  SchemaDiscoveryCapabilities,
  TableViewState,
} from './types';
import {
  createDefaultTableViewState,
  normalizeTableViewState,
} from './view-state';

const STORAGE_KEY = 'supabase-explorer-settings';

function createDefaultSettings(): AppSettings {
  return {
    connections: [],
    activeConnectionId: null,
    activeTable: null,
  };
}

export type ClearLocalDataCategory = 'connections' | 'tables' | 'filters' | 'all';

export const defaultTableViewState: TableViewState = createDefaultTableViewState();

export const defaultSchemaDiscoveryCapabilities: SchemaDiscoveryCapabilities = {
  restOpenApi: 'unknown',
  graphql: 'unknown',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return normalizeSettings({ ...createDefaultSettings(), ...JSON.parse(raw) });
  } catch {
    return createDefaultSettings();
  }
}

function normalizeTable(table: string | Partial<SavedTable>): SavedTable {
  if (typeof table === 'string') {
    return {
      name: table,
      schema: 'public',
      columns: [],
      viewState: createDefaultTableViewState(),
      addedAt: Date.now(),
    };
  }

  return {
    name: table.name ?? '',
    schema: table.schema ?? 'public',
    columns: Array.isArray(table.columns) ? table.columns : [],
    viewState: normalizeTableViewState(table.viewState),
    addedAt: table.addedAt ?? Date.now(),
  };
}

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    connections: settings.connections.map((conn) => ({
      ...conn,
      schemaDiscovery: {
        ...defaultSchemaDiscoveryCapabilities,
        ...conn.schemaDiscovery,
      },
      tables: conn.tables.map(normalizeTable).filter((table) => table.name),
    })),
  };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAllSettings(): AppSettings {
  localStorage.removeItem(STORAGE_KEY);
  return createDefaultSettings();
}

export function clearConnections(): AppSettings {
  const next = createDefaultSettings();
  saveSettings(next);
  return next;
}

export function clearTables(settings: AppSettings): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.map((conn) => ({
      ...conn,
      tables: [],
    })),
    activeTable: null,
  };
  saveSettings(next);
  return next;
}

export function clearFilters(settings: AppSettings): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.map((conn) => ({
      ...conn,
      tables: conn.tables.map((table) => ({
        ...table,
        viewState: createDefaultTableViewState(),
      })),
    })),
  };
  saveSettings(next);
  return next;
}

export function clearLocalData(
  settings: AppSettings,
  categories: ClearLocalDataCategory[]
): AppSettings {
  const selected = new Set(categories);

  if (selected.has('all') || selected.has('connections')) {
    return clearAllSettings();
  }

  let next = settings;

  if (selected.has('tables')) {
    next = clearTables(next);
  }

  if (selected.has('filters')) {
    next = clearFilters(next);
  }

  return next;
}

export function addConnection(settings: AppSettings, conn: DbConnection): AppSettings {
  const next = {
    ...settings,
    connections: [...settings.connections, conn],
    activeConnectionId: conn.id,
    activeTable: null,
  };
  saveSettings(next);
  return next;
}

export function removeConnection(settings: AppSettings, connId: string): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.filter((c) => c.id !== connId),
    activeConnectionId:
      settings.activeConnectionId === connId
        ? (settings.connections.find((c) => c.id !== connId)?.id ?? null)
        : settings.activeConnectionId,
    activeTable:
      settings.activeConnectionId === connId ? null : settings.activeTable,
  };
  saveSettings(next);
  return next;
}

export function updateConnection(settings: AppSettings, conn: DbConnection): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.map((c) => (c.id === conn.id ? conn : c)),
  };
  saveSettings(next);
  return next;
}

export function setActiveConnection(settings: AppSettings, connId: string | null): AppSettings {
  const next = {
    ...settings,
    activeConnectionId: connId,
    activeTable: null,
  };
  saveSettings(next);
  return next;
}

export function setActiveTable(settings: AppSettings, tableName: string | null): AppSettings {
  const next = {
    ...settings,
    activeTable: tableName,
  };
  saveSettings(next);
  return next;
}

export function addTableToConnection(
  settings: AppSettings,
  connId: string,
  table: SavedTable
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  if (conn.tables.some((saved) => saved.name === table.name)) return settings;
  const updated: DbConnection = { ...conn, tables: [...conn.tables, table] };
  return updateConnection(settings, updated);
}

export function updateConnectionSchemaDiscovery(
  settings: AppSettings,
  connId: string,
  schemaDiscovery: SchemaDiscoveryCapabilities
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  return updateConnection(settings, { ...conn, schemaDiscovery });
}

export function updateTableInConnection(
  settings: AppSettings,
  connId: string,
  table: SavedTable
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  const updated: DbConnection = {
    ...conn,
    tables: conn.tables.map((saved) => (saved.name === table.name ? table : saved)),
  };
  return updateConnection(settings, updated);
}

export function removeTableFromConnection(
  settings: AppSettings,
  connId: string,
  tableName: string
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  const updated: DbConnection = {
    ...conn,
    tables: conn.tables.filter((t) => t.name !== tableName),
  };
  const next = updateConnection(settings, updated);
  if (settings.activeTable === tableName && settings.activeConnectionId === connId) {
    return setActiveTable(next, null);
  }
  return next;
}
