# 2026-06-05 Stable Header During Searches

## Decision

When column metadata is known, the query grid should keep the table header mounted while data is loading, empty, or populated.

Loading and empty states should render inside the table body instead of replacing the table.

## Context

Column headers contain active filter inputs. Replacing the table during a search unmounts those inputs and causes focus loss while users are typing.

## Consequences

The initial no-schema loading state can still use a centered loader. Once schema columns exist, the table shell stays stable and header filter inputs remain available through query transitions.
