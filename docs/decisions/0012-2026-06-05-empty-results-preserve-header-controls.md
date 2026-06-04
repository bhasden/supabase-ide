# 2026-06-05 Empty Results Preserve Header Controls

## Decision

When a query returns no rows but the app knows the selected table schema, the grid should keep rendering the table header and column filter controls.

The empty result message should appear in the table body as a full-width row instead of replacing the table.

## Context

Column-header filters are one of the primary ways users adjust a query. Removing the header after a no-result query makes it harder to recover because the user loses the controls needed to change or clear the filter that produced the empty result.

## Consequences

If no schema is known yet, the app can still show a centered empty state. Once columns are known, empty query results preserve the table structure.
