# 2026-06-04 Date Detection And Decision Ordering

## Decision

Sampled row inference should classify ISO date-only strings as `date` and ISO timestamp strings as `timestamptz`. This supports common Supabase/PostgREST values such as `games.created_at`.

Decision documents should use ordered filenames in the form `NNNN-YYYY-MM-DD-short-title.md`. The numeric prefix records creation order, while the date remains visible in both the filename and document heading.

## Date Detection

The app detects date-only values with the `YYYY-MM-DD` shape and validates that the date actually exists. Timestamp values use an ISO-like date and time shape with optional fractional seconds and optional timezone information.

UUID detection runs before date detection, so UUID-shaped identifiers are not accidentally treated as dates.

## Timeline Naming

Multiple decisions can happen on the same date. A date-only filename does not reliably sort those documents by creation order, especially when titles are alphabetically unrelated to the sequence of decisions.

The ordered prefix keeps the decision timeline readable in plain filesystem views, GitHub file listings, and editor sidebars.
