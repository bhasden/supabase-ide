# 2026-06-04 Table Validation And Column Controls

## Decision

Table names are validated against Supabase before being saved. Invalid table names remain editable in the add-table input and are highlighted as an error instead of being committed to the saved table list.

Saved tables store lightweight metadata in localStorage:

- table name
- schema label, currently `public`
- discovered column names and inferred value types
- added timestamp

Column metadata is discovered from a successful table probe or from later query results. If a table exists but no rows are available, the table can still be saved with an empty column list.

## Query UI

Saved tables expose a collapsible metadata section in the sidebar. The query grid also supports column-header sorting and filtering.

Column-header filters update the same `react-querybuilder` rule state used by the Filters panel. This keeps header filters visible and editable in the existing visual filter UI instead of creating a separate filtering system.

Visual query execution remains debounced so typing in header filters or rule values does not submit a request for every keypress.
