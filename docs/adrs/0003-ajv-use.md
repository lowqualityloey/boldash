# ADR 0003-ajv: Use ajv@8 (draft-07) as the sole runtime dependency for schema validation

- **Date**: 2026-09-15
- **Status**: `accepted`
- **Decision owner**: Lead Engineer @lowqualityloey (approved 2026-09-15 via pk:plan decision batch)
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§6)

## Context

Schemas are the contracts (P7); hand-rolling a JSON-Schema validator is a known trap.

## Decision

ajv 8.x exact-pinned, used behind shared/schema.ts seam so future swap is one module.

## Consequences

- Recorded in `docs/STATE.md` §4/§6; implementation constraints flow to Task Records via the RFC.

## Alternatives considered

hand-rolled subset validator (rejected: correctness liability)
