# Agent Guide

This repo is a small local-first Supabase explorer. Future agents should keep changes focused, preserve user data expectations, and read the documentation timeline before changing behavior.

## Before Editing

- Read `README.md`, `ARCHITECTURE.md`, and relevant files in `docs/decisions/`.
- Treat files under `docs/decisions/` as immutable decision records. Only grammar and clarity edits are acceptable; changed decisions need a new dated document.
- Check the worktree before editing and do not revert user changes unless the user explicitly asks.
- Prefer existing libraries and local patterns over custom implementations.

## Code Guidelines

- Keep browser storage local-first. Do not add backend services or remote persistence without a new decision document.
- Be careful with language around table removal. The UI removes saved table names from the app, not database tables from Supabase.
- Keep Supabase query behavior explicit. Advanced query editing should not submit requests while the user is typing.
- Centralize query translation so visible previews and executed requests stay aligned.

## Verification

Run these checks after implementation when dependencies are installed:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

If dependencies are missing, run `npm ci` first.
