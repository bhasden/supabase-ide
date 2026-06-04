# 2026-06-04 Per-Table Query View State

## Decision

Each saved table stores its own query view state in localStorage. The persisted state includes:

- visual filter rules
- column sort order

When users navigate between tables, the query view remounts with the selected table's saved state. This prevents one table's order or filters from leaking into another table, while still preserving the user's view when they return to a table.

## Rationale

Clearing order and filters on every table navigation would avoid accidental leakage, but it would also discard useful context. Per-table persistence gives each table an isolated view while keeping navigation predictable.

Advanced query drafts are not part of this decision. They remain local to the current query view and still require explicit submission.
