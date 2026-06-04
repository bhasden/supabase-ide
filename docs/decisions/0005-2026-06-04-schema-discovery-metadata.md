# 2026-06-04 Schema Discovery Metadata

## Decision

Schema discovery should prefer metadata over sampled values. Row sampling cannot reliably distinguish database types such as `uuid`, `integer`, `bigint`, and `numeric` because JavaScript receives UUIDs as strings and all ordinary numeric values as numbers.

The app now discovers table columns with this priority:

- Supabase/PostgREST OpenAPI metadata from the REST root endpoint
- pg_graphql introspection from `/graphql/v1` when enabled and accessible
- row sampling as a fallback

The discovered types are normalized into database-oriented labels such as `uuid`, `integer`, `bigint`, `numeric`, `boolean`, `jsonb`, `date`, and `timestamptz`.

## pg_graphql

pg_graphql is optional and introspection can be disabled, so the app treats it as a best-effort source. If the GraphQL endpoint is unavailable or introspection fails, schema discovery falls back to OpenAPI metadata or sampled rows.

## Query UI Impact

Column metadata feeds both the sidebar schema display and the query grid filter controls. Numeric database types use numeric filter inputs, UUID columns use equality by default, and text-like columns use contains-style filtering.
