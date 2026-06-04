# 2026-06-04 Local Data Clearing

## Decision

Users can clear local app data from the sidebar through a confirmation modal. The modal exposes these categories:

- Connections
- Tables
- Filters
- All

Connections and All both clear the full local settings store because connections contain the Supabase URL and API key, and all saved tables and view state depend on them.

Tables clears saved table names and column metadata while keeping configured connections. Filters clears persisted per-table filters and ordering while keeping connections and saved tables.

## Query UI

The query header includes a quick clear-filters action for the selected table. It clears only visual/header filters for that table, resets pagination, and preserves column ordering.

Cleared filter state is persisted through the same per-table view-state path as other filter changes.
