# Documentation Timeline

This directory is the project decision timeline. It records architecture and design decisions as dated documents so future changes can explain what changed, when, and why.

## Convention

- Add new decision documents under `docs/decisions/` with a `NNNN-YYYY-MM-DD-short-title.md` filename.
- Increment `NNNN` by one for each new decision so files sort naturally by creation order.
- Keep the decision date in the filename and in the document heading.
- Treat each decision document as write-once once it has been committed.
- Grammar, formatting, and clarity edits are allowed when they preserve the original content and ideas.
- Do not rewrite an old decision to match a new direction. Add a new dated document that explains the changed decision instead.
- Link important decision documents from `ARCHITECTURE.md` or `README.md` when they affect current behavior.
- Keep UI screenshots in `docs/screenshots/` and link them from the root README when they show current user-facing behavior.

## Current Documents

- [0001 - 2026-06-04 Current State](decisions/0001-2026-06-04-current-state.md)
- [0002 - 2026-06-04 Table Validation And Column Controls](decisions/0002-2026-06-04-table-validation-and-column-controls.md)
- [0003 - 2026-06-04 Per-Table Query View State](decisions/0003-2026-06-04-per-table-query-view-state.md)
- [0004 - 2026-06-04 Local Data Clearing](decisions/0004-2026-06-04-local-data-clearing.md)
- [0005 - 2026-06-04 Schema Discovery Metadata](decisions/0005-2026-06-04-schema-discovery-metadata.md)
- [0006 - 2026-06-04 Schema Capability Cache](decisions/0006-2026-06-04-schema-capability-cache.md)
- [0007 - 2026-06-04 Query Fetch Stability And UUID Shape](decisions/0007-2026-06-04-query-fetch-stability-and-uuid-shape.md)
- [0008 - 2026-06-04 Date Detection And Decision Ordering](decisions/0008-2026-06-04-date-detection-and-decision-ordering.md)
- [0009 - 2026-06-04 Structured Inputs And Bundle Splitting](decisions/0009-2026-06-04-structured-inputs-and-bundle-splitting.md)
- [0010 - 2026-06-05 Timestamp Input Mask](decisions/0010-2026-06-05-timestamp-input-mask.md)
- [0011 - 2026-06-05 Masked Input Query Gating](decisions/0011-2026-06-05-masked-input-query-gating.md)
- [0012 - 2026-06-05 Empty Results Preserve Header Controls](decisions/0012-2026-06-05-empty-results-preserve-header-controls.md)
- [0013 - 2026-06-05 Stable Header During Searches](decisions/0013-2026-06-05-stable-header-during-searches.md)
- [0014 - 2026-06-05 Remove Rule Locking](decisions/0014-2026-06-05-remove-rule-locking.md)
