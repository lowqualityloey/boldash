# Boldash — Project Notes & Working State

> Plain-Markdown working record (salvaged from the pre-reset tracker on 2026-09-14).
> Once `boldash` itself ships, canonical state moves to `.boldash/state/*.json` and generated
> `docs/STATE.md` projections (`ARCHITECTURE.md` §6.2, §7) — this file becomes that projection's
> hand-edited ancestor and can then retire.

## 1. Position

- **Phase:** Pre-alpha, design complete → implementation next.
- **Milestones** (mirrors `ARCHITECTURE.md` §16):
  - [x] **M1** — Design & Architecture corpus (`README`, `ARCHITECTURE`, `PROJECT OVERVIEW`, `SECURITY`, `LICENSE`, `CHANGELOG`)
  - [ ] **M2** — v0.1.0 Foundation: `init`, `route`, `state`, `verify`, generic adapter, v1 workflow import
  - [ ] **M3** — v0.2.0: policy engine, capability manager, Claude adapter, `doctor`, `explain`
  - [ ] **M4** — v0.3.0: event log, evidence storage, subagent protocol, Cursor adapter
  - [ ] **M5** — v0.4.0+: Antigravity adapter, workflow registry, benchmark suite, plugin API
- **Branch:** `main` (single maintainer: @lowqualityloey)

## 2. Document Authority Map

| Question about… | Authority |
|---|---|
| Product intent, audience, success metric, failure modes | `PROJECT OVERVIEW.md` |
| System design, engines, schemas, roadmap, testing | `ARCHITECTURE.md` |
| Public pitch & comparison | `README.md` |
| Threat model & reporting | `SECURITY.md` |
| Working state & invariants | this file (until Boldash's own state engine replaces it) |

## 3. Locked Invariants (Do Not Undo)

Source: `ARCHITECTURE.md` §2 (P1–P10) + Appendix B.

1. **P1** Separation of intelligence and enforcement — the LLM reasons; Boldash enforces. Never cross.
2. **P2** Canonical state is machine-readable JSON; Markdown is a projection, never the truth.
3. **P3** Deterministic work belongs outside the LLM — if a check can be code, it must not be a prompt.
4. **P4** Every gate returns an exit code; a gate that cannot block is a suggestion.
5. **P5** Zero ceremony for trivial work; risk determines ceremony.
6. **P6** Local-first, Git-native, no daemon, no database, no cloud core.
7. **P7** Model-agnostic; all model output schema-validated before trusted.
8. **P8** Graceful degradation — without Boldash the agent still works with reduced guarantees.
9. **P9** Tiny LLM interface — schemas/commands/errors fit in a few hundred tokens.
10. **P10** Every decision explainable via `boldash explain` with a traceable evidence chain.
11. **Tie-breaker** — *"The LLM proposes. Boldash validates, enforces, records, and verifies."* Any decision not serving that sentence is wrong.

## 4. Open Items

- [ ] `SECURITY.md`: replace `security@example.com` placeholder with a real contact (or delete the fallback line; GitHub Security Advisories is the preferred channel).
- [ ] `PROJECT OVERVIEW.md`: filename contains a space — consider `PROJECT-OVERVIEW.md` for link/CLI ergonomics.
- [ ] Resolve `ARCHITECTURE.md` §18 Open Questions that touch Phase 1 (during the v0.1.0 spec).
- [ ] First ADRs in `docs/adrs/`: runtime/tooling choice, state format, adapter contract.

## 5. Known Risks

- `README.md` layout + `SECURITY.md` scope describe planned artifacts (`src/`, `schemas/`, …) that don't exist yet — acceptable only while clearly labeled "Planned".
- The project can stall at design phase (named failure mode). Mitigation: M2 exit criteria are small; next concrete step is the v0.1.0 spec, not more vision docs.

## 6. History

| Date | Event |
|---|---|
| 2026-09-14 | Lineage intake: Boldash confirmed as v2 successor to PromptKit OS v1 (different layer, not rewrite). |
| 2026-09-14 | Anomaly sweep: SECURITY filename typo, MIT license declaration, template placeholders populated. |
| 2026-09-14 | v1 engine (`.promptkit` submodule + directives) used briefly to dogfood the repo, then **fully removed in a history reset** — repo reborn as a pure Boldash design corpus (single initial commit, force-pushed). |
