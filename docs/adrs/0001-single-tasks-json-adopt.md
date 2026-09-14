# ADR 0001-single-tasks-json: Adopt single tasks.json with schema_version for canonical task state

- **Date**: 2026-09-15
- **Status**: `accepted`
- **Decision owner**: Lead Engineer @lowqualityloey (approved 2026-09-15 via pk:plan decision batch)
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§6)

## Context

ARCHITECTURE.md §18 Q1 open: one file per task vs single tasks.json. v0.1.0 surface docs (getting-started, faq, cli-reference) all assume single file.

## Decision

Single `.boldash/state/tasks.json` ({ schema_version: 1, tasks: [] }); Expand-Contract evolution rules per RFC §3.3; SCHEMA_VERSION_MISMATCH guard for future-major files.

## Consequences

- Recorded in `docs/STATE.md` §4/§6; implementation constraints flow to Task Records via the RFC.

## Alternatives considered

Per-file state (better merge scaling; rejected for v0.1.0: atomicity and simplicity dominate; revisit at multi-agent phase)
