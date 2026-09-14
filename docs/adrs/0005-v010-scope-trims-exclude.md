# ADR 0005-v010-scope-trims: Exclude state claim/leases and verify --no-cache from v0.1.0

- **Date**: 2026-09-15
- **Status**: `accepted`
- **Decision owner**: Lead Engineer @lowqualityloey (approved 2026-09-15 via pk:plan decision batch)
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§6)

## Context

ARCHITECTURE §16 Phase 1 has no lease work; multi-agent concurrency is Phase 3; caching absent means --no-cache meaningless.

## Decision

Ship optimistic locking only (version guard, exit 4). cli-reference.md gets explicit '(v0.3.0)' markers on claim and --no-cache.

## Consequences

- Recorded in `docs/STATE.md` §4/§6; implementation constraints flow to Task Records via the RFC.

## Alternatives considered

Shipping claim in v0.1.0 (rejected: premature multi-agent surface without the event-log substrate)
