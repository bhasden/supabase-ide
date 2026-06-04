# 2026-06-04 Structured Inputs And Bundle Splitting

## Decision

Structured column types should use structured input controls in both the Filters rule builder and column header filters. Shared input helpers normalize values before they are saved into query rule state so both UI surfaces behave consistently.

The production bundle should be split into vendor chunks for major dependency groups instead of allowing all dependencies to collect in the main app chunk.

## Structured Inputs

UUID fields use a text input that strips non-hex characters, lowercases values, limits input to 32 hexadecimal characters, and inserts UUID dashes as the user types or pastes.

Date fields use the native date input. Timestamp fields use the native datetime-local input. Boolean fields use the same select structure in both filter surfaces.

## Bundle Splitting

Vite/Rollup manual chunks separate React, Supabase, CodeMirror, react-querybuilder, lucide icons, and other vendor code. This keeps the app chunk smaller and removes the large single-chunk production build warning without changing runtime behavior.
