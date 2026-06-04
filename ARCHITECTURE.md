# Architecture

Supabase IDE is a Vite, React, and TypeScript single-page app for exploring Supabase tables from a public project URL and anon/public API key.

## App Structure

- `src/App.tsx` owns the active settings state and decides whether to show the initial connection setup or the main explorer.
- `src/components/Sidebar.tsx` renders configured connections, validated saved tables, table metadata, table add/remove controls, and connection switching.
- `src/components/QueryView.tsx` renders table data, visual filters, advanced query input, generated request preview, errors, and pagination.
- `src/lib/storage.ts` is the localStorage boundary for settings.
- `src/lib/clients.ts` creates and caches Supabase clients by URL and API key.
- `src/lib/query-translator.ts` translates visual rule-builder state into Supabase/PostgREST filters and preview parameters.
- `src/lib/schema-discovery.ts` discovers table column metadata from Supabase/PostgREST OpenAPI, pg_graphql introspection, and row sampling fallback.

## State And Storage

All user configuration is stored in browser localStorage under `supabase-explorer-settings`. The saved settings include:

- configured Supabase connections
- connection display names, URLs, and API keys
- cached schema discovery endpoint capability state per connection
- validated saved tables and discovered column metadata per connection
- per-table visual filter rules and column sort order
- active connection and active table

The app does not own the target databases and does not mutate database schema. Adding a table validates that Supabase accepts the table query before saving it locally. Removing a saved table only removes it from the local UI configuration.

Users can clear local data by category. Connections and All clear the full settings store, Tables clears saved table metadata while keeping configured connections, and Filters resets per-table view state.

Column types are stored as normalized database-oriented labels, including `uuid`, `integer`, `numeric`, `boolean`, `jsonb`, `date`, and `timestamptz`. Metadata sources are preferred over sampled row values unless a metadata source only reports a generic type and sampled rows provide a more specific type.

Schema discovery caches whether the Supabase REST OpenAPI root endpoint and pg_graphql endpoint are available for each connection. Once an endpoint is known to be unavailable for the configured key, later schema discovery skips that endpoint and falls back to available metadata sources or sampled rows.

Opening a table performs metadata-only schema discovery. Table row sampling for type refinement happens from the data rows already fetched for the grid, so metadata updates do not schedule extra table queries.

## Query Model

The query screen has two modes:

- Visual filters use `react-querybuilder` and are translated through `query-translator`.
- Advanced queries use CodeMirror for editing and submit only through explicit user actions.

Visual filter changes may refresh results automatically. Advanced query typing must not submit network requests while the user is still composing a query.

Data fetching is tied to user-visible query state: table selection, submitted filters, submitted advanced queries, sorting, pagination, and explicit refresh. Column metadata refinement is intentionally kept out of the fetch trigger path.

The query translator is the source of truth for supported operators and PostgREST filter formatting so executed requests and request URL previews stay consistent.

Column headers can sort and filter data. Header filters update the same visual rule state used by the Filters panel, and visual query execution is debounced to avoid unnecessary Supabase requests while users type. Visual filters and ordering are persisted per saved table so navigation between tables restores each table's own view state.

The query header also provides a quick clear-filters action for the current table. It clears filters only and preserves ordering.

Structured column types share input helpers between the Filters panel and header filters. UUID values autoformat with dashes, date values use native date inputs, and `timestamptz` values use a masked `YYYY-MM-DDTHH:mm:ss+00:00` text input. Incomplete structured values are held in UI state and are not submitted to Supabase until they match the expected format.

When table columns are known, the grid keeps the table header mounted across loading, empty, and populated states so header filters retain focus while searches run.

## Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`. The workflow installs dependencies, builds the Vite app, uploads `dist`, and deploys through GitHub Pages.

Vite uses `base: './'` so generated assets resolve correctly from a GitHub Pages path.

Production builds use Rollup manual chunks to split React, Supabase, CodeMirror, query builder, icon, and other vendor code into separate assets.
