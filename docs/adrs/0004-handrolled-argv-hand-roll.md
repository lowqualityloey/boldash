# ADR 0004-handrolled-argv: Hand-roll the CLI argv kernel (~100 LOC) instead of commander

- **Date**: 2026-09-15
- **Status**: `accepted`
- **Decision owner**: Lead Engineer @lowqualityloey (approved 2026-09-15 via pk:plan decision batch)
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§6)

## Context

The CLI surface is a versioned, tested contract under P9; global-flag semantics are fixed; deps are liabilities per AGENTS.md.

## Decision

Own parser in src/cli/ with schema-tested flag table; no new runtime dep for parsing.

## Consequences

- Recorded in `docs/STATE.md` §4/§6; implementation constraints flow to Task Records via the RFC.

## Alternatives considered

commander (rejected for v0.1.0: extra runtime dep; may revisit if surface explodes in Phase 2+)
