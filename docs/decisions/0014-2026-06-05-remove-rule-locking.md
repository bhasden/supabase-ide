# 2026-06-05 Remove Rule Locking

## Decision

The visual query builder should not expose rule locking.

Any persisted rule lock state is stripped when rules load or change so saved filters cannot leave rules disabled after the lock UI has been removed.

## Context

Rule locking only applied inside the Filters panel. Column-header filters share the same rule state but do not have an equivalent locking interaction, which made the behavior inconsistent and hard to reason about.

## Consequences

All visual filters remain editable from both the Filters panel and column headers. Future filter controls should avoid feature states that cannot be represented across both editing surfaces.
