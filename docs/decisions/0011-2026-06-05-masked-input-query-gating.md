# 2026-06-05 Masked Input Query Gating

## Decision

Masked structured filter inputs should show the expected format and keep partial values in UI state without submitting them to Supabase.

UUID fields show the `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` placeholder and insert dashes while users type or paste values. Timestamp fields show the `YYYY-MM-DDTHH:mm:ss` placeholder and insert date/time separators while users type or paste digits.

## Query Behavior

The query translator is the source of truth for whether a structured value is complete enough to execute. Incomplete UUID, date, and timestamp values are omitted from preview parameters and Supabase filters.

The visual query debounce also checks for incomplete structured values before updating submitted rules. This prevents unnecessary network requests while users are still filling a mask.

## Consequences

The Filters panel and column-header filters behave consistently because they share the same input normalizers and readiness checks.
