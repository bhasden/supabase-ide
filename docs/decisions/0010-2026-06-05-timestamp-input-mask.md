# 2026-06-05 Timestamp Input Mask

## Decision

Timestamp filter inputs should use a shared masked text input instead of the browser native `datetime-local` control.

The accepted UI format for `timestamptz` is `YYYY-MM-DDTHH:mm:ss+00:00`. The input normalizer strips extra characters, inserts separators while users type or paste digits, and caps values at a four-digit year plus second precision and a timezone offset.

## Context

Some browsers, including Chromium-based browsers, allow expanded years in native `datetime-local` controls. That can present six-digit year editing in compact column-header filters, which is noisy and inconsistent with the four-digit years returned by Supabase/PostgREST in this app.

## Consequences

The Filters rule builder and column-header filters continue to share the same structured input path. Date-only fields still use native date inputs. Timestamp-with-time-zone fields use text inputs with the shared offset-aware mask so both surfaces behave consistently.
