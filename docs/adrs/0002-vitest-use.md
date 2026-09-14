# ADR 0002-vitest: Use vitest (dev-only) as test runner

- **Date**: 2026-09-15
- **Status**: `accepted`
- **Decision owner**: Lead Engineer @lowqualityloey (approved 2026-09-15 via pk:plan decision batch)
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§6)

## Context
Need watch mode, fixtures ergonomics, TS-native transforms for a 9-milestone ramp.

## Decision
vitest pinned exact, devDependency only; no runtime coupling.

## Consequences
- Recorded in `docs/STATE.md` §4/§6; implementation constraints flow to Task Records via the RFC.

## Alternatives considered
node:test (zero deps but weaker watch/fixtures; revisit if DX pain materializes)
