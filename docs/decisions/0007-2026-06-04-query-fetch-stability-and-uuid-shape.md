# 2026-06-04 Query Fetch Stability And UUID Shape

## Decision

The query grid should fetch table data only when user-visible query state changes. Table selection, submitted filters, submitted advanced queries, sorting, pagination, and explicit refresh are fetch triggers. Column metadata refinement is not a fetch trigger.

Opening a table performs metadata-only schema discovery. If row sampling is needed to refine column types, the app uses rows already returned by the grid query instead of issuing a separate schema sampling query.

## UUID Detection

Sampled UUID detection uses the standard hyphenated UUID shape: `8-4-4-4-12` hexadecimal characters. It does not require RFC version or variant bits because some databases contain deterministic UUID-shaped identifiers with zeroed groups.

This keeps UUID-like database identifiers such as `a1000077-0000-0000-0000-000000000001` classified as `uuid` in the UI.

## Consequences

Saved column metadata can still be refined from returned rows, but those refinements update UI state and localStorage without causing another data request.

For anon keys that cannot access OpenAPI or pg_graphql schema metadata, the app relies on cached endpoint capability state and sampled grid rows.
