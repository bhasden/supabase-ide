import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbConnection } from './types';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
}));

vi.mock('./clients', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        limit: mocks.limit,
      }),
    }),
  }),
}));

import {
  discoverTableSchema,
  inferColumnsFromRow,
  inferColumnsFromRows,
  mapGraphqlType,
  mapOpenApiType,
  mergeColumnMetadata,
} from './schema-discovery';

const baseConnection: DbConnection = {
  id: 'conn-1',
  name: 'Project',
  url: 'https://example.supabase.co',
  apiKey: 'public-key',
  tables: [],
  schemaDiscovery: {
    restOpenApi: 'unknown',
    graphql: 'unknown',
  },
  createdAt: 1,
};

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.limit.mockResolvedValue({
    data: [{ id: '84218236-b0f5-4e8c-b2d0-890e8a47fe2a' }],
    error: null,
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
    }))
  );
});

describe('schema discovery type mapping', () => {
  it('detects uuid strings and integer values from sampled rows', () => {
    expect(
      inferColumnsFromRow({
        id: 'f8047004-e985-4bf1-87f9-7b5ae7edbcd9',
        count: 42,
        price: 12.5,
      })
    ).toEqual([
      { name: 'id', type: 'uuid' },
      { name: 'count', type: 'integer' },
      { name: 'price', type: 'numeric' },
    ]);
  });

  it('detects UUIDs from real sampled column values', () => {
    expect(
      inferColumnsFromRows([
        { id: '84218236-b0f5-4e8c-b2d0-890e8a47fe2a' },
        { id: 'afec6569-8c0d-4b0b-92b2-681198a71339' },
        { id: 'ece0d10f-4a0c-47de-95fc-5c0d7e7d7a6f' },
        { id: '6f339693-df21-462a-aec4-7bf529d16cfc' },
        { id: '9bbf5257-a8cf-48b8-97f4-51ab0d36b2f4' },
      ])
    ).toEqual([{ name: 'id', type: 'uuid' }]);
  });

  it('detects UUID-shaped values with non-RFC variant bits from sampled rows', () => {
    expect(
      inferColumnsFromRows([
        { id: 'a1000077-0000-0000-0000-000000000001' },
        { id: '03a9bad3-f345-4868-80dc-2e55a84278df' },
        { id: '9ea00590-a4c2-47e0-817f-4fa16d6a1daa' },
      ])
    ).toEqual([{ name: 'id', type: 'uuid' }]);
  });

  it('trims UUID strings before detecting sampled types', () => {
    expect(inferColumnsFromRow({ id: ' 84218236-b0f5-4e8c-b2d0-890e8a47fe2a\r\n' })).toEqual([
      { name: 'id', type: 'uuid' },
    ]);
  });

  it('uses later sampled rows when the first row has nullable values', () => {
    expect(
      inferColumnsFromRows([
        { id: null, user_id: null, count: null },
        {
          id: 'f8047004-e985-4bf1-87f9-7b5ae7edbcd9',
          user_id: '5e8bcfd0-ece1-4f1e-b3e8-6085dd2953c6',
          count: 7,
        },
      ])
    ).toEqual([
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'count', type: 'integer' },
    ]);
  });

  it('detects sampled ISO date and timestamp columns', () => {
    expect(
      inferColumnsFromRows([
        {
          created_at: '2026-03-30T01:26:34.421319-04:00',
          birth_date: '2012-07-29',
        },
        {
          created_at: '2026-05-19T01:03:16.595454-04:00',
          birth_date: null,
        },
      ])
    ).toEqual([
      { name: 'created_at', type: 'timestamptz' },
      { name: 'birth_date', type: 'date' },
    ]);
  });

  it('does not classify invalid date-shaped strings as dates', () => {
    expect(
      inferColumnsFromRows([
        { label: '2026-02-31' },
        { label: '2026-13-01' },
      ])
    ).toEqual([{ name: 'label', type: 'text' }]);
  });

  it('lets sampled specific types improve generic schema metadata', () => {
    expect(
      mergeColumnMetadata(
        [
          { name: 'id', type: 'text' },
          { name: 'count', type: 'text' },
          { name: 'name', type: 'text' },
          { name: 'created_at', type: 'timestamptz' },
        ],
        [
          { name: 'id', type: 'uuid' },
          { name: 'count', type: 'integer' },
          { name: 'name', type: 'text' },
          { name: 'created_at', type: 'text' },
        ]
      )
    ).toEqual([
      { name: 'id', type: 'uuid' },
      { name: 'count', type: 'integer' },
      { name: 'name', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
    ]);
  });

  it('maps OpenAPI uuid and integer formats to database-ish column types', () => {
    expect(mapOpenApiType({ type: 'string', format: 'uuid' })).toBe('uuid');
    expect(mapOpenApiType({ type: 'integer', format: 'int32' })).toBe('integer');
    expect(mapOpenApiType({ type: 'integer', format: 'int64' })).toBe('bigint');
  });

  it('maps pg_graphql scalar names to database-ish column types', () => {
    expect(mapGraphqlType({ name: 'UUID' })).toBe('uuid');
    expect(mapGraphqlType({ name: 'Int' })).toBe('integer');
    expect(mapGraphqlType({ name: 'BigInt' })).toBe('bigint');
  });
});

describe('schema discovery capability cache', () => {
  it('marks unavailable schema endpoints after failed feature probes', async () => {
    const result = await discoverTableSchema(baseConnection, 'people');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.schemaDiscovery).toEqual({
      restOpenApi: 'unavailable',
      graphql: 'unavailable',
    });
    expect(result.columns).toEqual([{ name: 'id', type: 'uuid' }]);
  });

  it('skips schema endpoints already cached as unavailable', async () => {
    const result = await discoverTableSchema(
      {
        ...baseConnection,
        schemaDiscovery: {
          restOpenApi: 'unavailable',
          graphql: 'unavailable',
        },
      },
      'people'
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(result.schemaDiscovery).toEqual({
      restOpenApi: 'unavailable',
      graphql: 'unavailable',
    });
    expect(result.columns).toEqual([{ name: 'id', type: 'uuid' }]);
  });

  it('can skip row sampling during metadata-only discovery', async () => {
    const result = await discoverTableSchema(baseConnection, 'people', {
      sampleRows: false,
    });

    expect(mocks.limit).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.columns).toEqual([]);
  });
});
