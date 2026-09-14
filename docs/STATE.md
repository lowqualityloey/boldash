# Project State & Living Execution Tracker

## 1. Executive Summary & Current Position
- **Project Name**: Boldash — deterministic control plane for AI coding agents
- **Current Milestone / Epic**: M2 — v0.1.0 Foundation · **RFC APPROVED · MS-1 ✅ MS-2 ✅ MS-3 ✅ · MS-4 awaiting GO**
- **Overall Status**: ACTIVE
- **Target Release / Deadline**: v0.1.0 (no date committed)
- **Current Working Branch**: `main`
- **Last Updated**: 2026-09-14 14:31 UTC (MS-3 closure) — all timestamps from here on are `date -u`. Earlier session records labelled host-local (UTC+12) times as UTC; ordering sound, basis corrected (checkpoint-001 §Anomalies 1)

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
- [x] `MAINT-02` — planning artifacts committed & pushed (`5b5e4f5…8c25fa7`)
- [x] `GO-MS1` — **GIVEN**; MS-1 executed & **maintainer-approved** → `completed`; #1 closed
- [x] `GO-MS2` — **GIVEN**; MS-2 executed & **maintainer-approved** → `completed`; #2 closed
- [x] `GO-MS3` — **GIVEN**; MS-3 executed: TaskStore + transition matrix + optimistic locking + events; 42/42 tests; **schema minItems design correction** (structure permits, lifecycle enforces); CI 34854360256 green; **maintainer-approved 2026-09-14 14:31 UTC → `completed`; #3 closed**
- [ ] `GO-MS4`: **dependency satisfied, GO NOT YET GIVEN.** Router proposal prepared; MS-4 starts only on explicit maintainer GO (#4)

## 3. Active Working Set
- **Active RFC / Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`
- **Active Task Pointer**: `None` (MS-3 completed; MS-4 not yet claimed — awaiting GO)
- **Key Source Files in Flight**: the v0.1.0 surface corpus (`docs/cli-reference.md`, `docs/routing-contract.md`, `docs/verification-guide.md`, `docs/errors.md`, `docs/getting-started.md`, `docs/faq.md`, `AGENTS.md`, `CONTRIBUTING.md`) — authority map in `docs/NOTES.md` §2
- **Verification Commands (Scoped)**: `npm run verify` = THE gate (live since MS-1, 2026-09-15). CI: `verify` workflow, node 20/22/24 on push+PR.

## 3A. Execution-Control Projection
- Not active — Task Records will be created by `pk:tasks` after RFC approval under `docs/tasks/TASK-2026-09-15-v010-*.md`. This tracker stays the projection until Boldash's own state engine replaces it.

## 4. Locked Technical Invariants (Do Not Undo)
P1–P10 + tie-breaker, verbatim in `docs/NOTES.md` §3. Pending additions on RFC approval: DECISION-v010-001 (single `tasks.json`, `schema_version: 1`, Expand-Contract evolution per RFC §3.3), 002–005 (toolchain & scope trims).

## 5. Known Blockers, Risks & Open Questions
- **Blockers**: None mechanical. **Gate: `GO-MS4`** (maintainer) before any MS-4 code. MAINT-01 (RFC approval) is **resolved** — ADRs 0001–0005 accepted. Minor: `SECURITY.md` placeholder email (NOTES §4).
- **Environment hazard (recorded 2026-09-14)**: default-cache `npm ci` fails `EACCES` here though no root-owned files exist; use `npm ci --cache /tmp/boldash-npm-cache`. An empty `node_modules` makes `npm run lint` silently run system ESLint 6.4.0 (cannot read flat config). Never read the gate from piped output — pipes mask the exit code.
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

## 7. Next Immediate Actions (single lane, per handoff)
1. **Maintainer**: issue `GO-MS4`. MS-3 is closed; checkpoint-001's "exactly one prioritized next action" is **consumed** (record completed, #3 closed at 2026-09-14 14:31 UTC).
2. **Next session**: on GO, patch `TASK-2026-09-15-v010-ms4-router` → `ready` → `in_progress`, claim the pointer, then implement the 7-step router pipeline per `docs/routing-contract.md` §The Validation Pipeline with its 4 catalog errors. Do not start without GO (Gated Mode).
3. **MS-4 plan prepared, awaiting ruling**: `docs/tasks/TASK-2026-09-15-v010-ms4-router.plan-001.md` — module design, 13-test PASS/BLOCK plan, AC traceability. It surfaces **three gaps that need a maintainer decision before code**: D-1 (example 4 routes to `migration`, which is not one of the 4 built-in packs, so step 3 shadows step 5), D-2 (`ARCHITECTURE.md` §5.3 mandates `manifest.yaml`, but a YAML parser would breach the ajv-only dependency invariant), D-3 (warning channel for step 6 is additive to a documented payload shape). No `src/` changes were made while planning.

## 8. Session Continuity Log
| Date | Engineer / Agent | Focus | Artifacts |
|---|---|---|---|
| 2026-09-14 | Lead + DSH agent | lineage intake, anomaly fixes, repo reset #1 | 10-file corpus, `docs/NOTES.md` salvage |
| 2026-09-15 | Lead Engineer | intentional v1 reinstall (`.promptkit` @ v1.5.1-26); authored 7-doc v0.1.0 surface-spec corpus + native `AGENTS.md` | `AGENTS.md`, `CONTRIBUTING.md`, `docs/{cli-reference,routing-contract,verification-guide,errors,getting-started,faq}.md` |
| 2026-09-15 | DSH agent (pk:plan, L2/Full) | v0.1.0 Foundation RFC; STATE.md re-populated from template | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
| 2026-09-14 | DSH agent (pk:checkpoint) | Session boundary | MS-1 ✅ · MS-2 ✅ · MS-3 awaiting_review; 42/42 green; checkpoint-001 + handoff-001 records written; timestamp-basis anomaly documented |
| 2026-09-14 | DSH agent (receiver session) | Handoff checklist validation → MS-3 closure | 5/5 checklist items evidenced (verify re-run 42/42 exit 0 @ `99c1dd3`, CI success @ same sha); 5 stale `Pending` rows stripped from MS-3 record; STATE.md RFC-approval drift corrected; environment hazard recorded; #3 closed |
