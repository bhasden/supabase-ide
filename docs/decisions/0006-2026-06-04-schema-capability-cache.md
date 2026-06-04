# 2026-06-04 Schema Capability Cache

## Decision

Each saved Supabase connection stores schema discovery capability state in localStorage. The cached state tracks whether the REST OpenAPI root endpoint and pg_graphql endpoint are `unknown`, `available`, or `unavailable` for the configured URL and API key.

If an endpoint is cached as unavailable, schema discovery skips that endpoint on later table additions or table openings. This avoids repeated calls to schema endpoints that the anon/public key cannot use or that the connected Supabase project has not enabled.

## Semantics

Unknown endpoints are probed during schema discovery. A successful OpenAPI document marks the REST OpenAPI capability as available. A successful GraphQL introspection schema marks the pg_graphql capability as available.

Failed requests, inaccessible endpoints, disabled GraphQL, or forbidden introspection mark the related capability as unavailable. Table row sampling remains available because it uses the same table query path needed for ordinary data browsing.

## User Impact

Connections with inaccessible schema metadata stop repeating best-effort schema endpoint checks after the first failure. Column metadata still updates from available metadata sources and sampled rows.
