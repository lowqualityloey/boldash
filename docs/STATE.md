# Project State & Living Execution Tracker

## 1. Executive Summary & Current Position
- **Project Name**: Boldash — deterministic control plane for AI coding agents
- **Current Milestone / Epic**: M2 — v0.1.0 Foundation · **pk:plan COMPLETE → RFC awaiting maintainer approval**
- **Overall Status**: ACTIVE
- **Target Release / Deadline**: v0.1.0 (no date committed)
- **Current Working Branch**: `main`
- **Last Updated**: 2026-09-15

## 2. Milestone & Task Progress

### Milestone Roadmap (ARCHITECTURE.md §16)
- [x] **M1**: Design & Architecture + v0.1.0 surface-spec corpus (Complete)
- [/] **M2**: v0.1.0 Foundation — RFC at `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (9 milestones MS-1…MS-9; status PROPOSED)
- [ ] **M3**: v0.2.0 Policy & Capabilities
- [ ] **M4**: v0.3.0 Evidence & Multi-Agent
- [ ] **M5**: v0.4.0+ Ecosystem

### Active Task Breakdown (M2 planning)
- [x] `pk:plan` — Full Planning (Level 2): RFC, 6 decision records, FMEA, milestone split — **APPROVED 2026-09-15** (TDD `disabled` · vitest + ajv@8 + hand-rolled argv · DECISION-001…005 accepted → ADRs 0001–0005)
- [x] `pk:tasks` — 9 canonical Task Records at `docs/tasks/TASK-2026-09-15-v010-ms*.md`, each linked to its GitHub issue
- **GitHub issue map (Local Task Records remain authoritative):** MS-1→#1 · MS-2→#2 · MS-3→#3 · MS-4→#4 · MS-5→#5 · MS-6→#6 · MS-7→#7 · MS-8→#8 · MS-9→#9
- [ ] `MAINT-02`: commit + push planning artifacts — awaiting human sign-off
- [ ] `GO-MS1`: maintainer go signal to move MS-1 `planned → ready` — **no code before this**

## 3. Active Working Set
- **Active RFC / Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`
- **Key Source Files in Flight**: the v0.1.0 surface corpus (`docs/cli-reference.md`, `docs/routing-contract.md`, `docs/verification-guide.md`, `docs/errors.md`, `docs/getting-started.md`, `docs/faq.md`, `AGENTS.md`, `CONTRIBUTING.md`) — authority map in `docs/NOTES.md` §2
- **Verification Commands (Scoped)**: none executable yet — no toolchain exists; **MS-1 delivers `npm run verify`**. Current gate = spec-consistency review + hygiene greps.

## 3A. Execution-Control Projection
- Not active — Task Records will be created by `pk:tasks` after RFC approval under `docs/tasks/TASK-2026-09-15-v010-*.md`. This tracker stays the projection until Boldash's own state engine replaces it.

## 4. Locked Technical Invariants (Do Not Undo)
P1–P10 + tie-breaker, verbatim in `docs/NOTES.md` §3. Pending additions on RFC approval: DECISION-v010-001 (single `tasks.json`, `schema_version: 1`, Expand-Contract evolution per RFC §3.3), 002–005 (toolchain & scope trims).

## 5. Known Blockers, Risks & Open Questions
- **Blockers**: MAINT-01 (RFC approval). Minor: `SECURITY.md` placeholder email (NOTES §4).
- **ARCHITECTURE §18**: Q1 **resolved** by RFC §3.2 (corpus-grounded). Q2–Q7 are Phase 2–4 scoped — not blocking v0.1.0.
- **Risks carried**: briefing-file append collision (PromptKit markers vs future Boldash briefing in `AGENTS.md`) — see RFC §8; importer over-promising — mitigated by conservative stubs (FMEA row 8).

## 6. Recent Architectural Decisions (ADR Log)
| Date | Title | Decision Summary | ADR File |
|---|---|---|---|
| 2026-09-15 | Single `tasks.json` state granularity | Resolves ARCHITECTURE §18 Q1; `schema_version:1` + Expand-Contract | `docs/adrs/0001-single-tasks-json.md` |
| 2026-09-15 | vitest as dev-only test runner | DX for 9-milestone ramp; no runtime coupling | `docs/adrs/0002-vitest.md` |
| 2026-09-15 | ajv@8 sole runtime dependency | draft-07 standard behind `shared/schema.ts` seam | `docs/adrs/0003-ajv.md` |
| 2026-09-15 | Hand-rolled argv kernel | CLI surface is a tested contract; deps are liabilities | `docs/adrs/0004-handrolled-argv.md` |
| 2026-09-15 | Scope trims: no `claim`, no `--no-cache` in v0.1.0 | Leases/caching deferred to Phase 3 substrate | `docs/adrs/0005-v010-scope-trims.md` |

## 7. Next Immediate Actions
1. `MAINT-02` — human sign-off to commit + push planning artifacts (this turn's card).
2. `GO-MS1` — maintainer go signal; MS-3/MS-4/MS-5 are dependency-parallelizable after MS-2.
3. Pre-code `pk:grill` on MS-3/MS-5 risk areas is recommended (RFC §8) but optional.

## 8. Session Continuity Log
| Date | Engineer / Agent | Focus | Artifacts |
|---|---|---|---|
| 2026-09-14 | Lead + DSH agent | lineage intake, anomaly fixes, repo reset #1 | 10-file corpus, `docs/NOTES.md` salvage |
| 2026-09-15 | Lead Engineer | intentional v1 reinstall (`.promptkit` @ v1.5.1-26); authored 7-doc v0.1.0 surface-spec corpus + native `AGENTS.md` | `AGENTS.md`, `CONTRIBUTING.md`, `docs/{cli-reference,routing-contract,verification-guide,errors,getting-started,faq}.md` |
| 2026-09-15 | DSH agent (pk:plan, L2/Full) | v0.1.0 Foundation RFC; STATE.md re-populated from template | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
