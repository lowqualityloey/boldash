# Project State & Living Execution Tracker

## 1. Executive Summary & Current Position

- **Project Name**: Boldash — deterministic control plane for AI coding agents
- **Current Milestone / Epic**: M2 — v0.1.0 Foundation · **RFC APPROVED · MS-1 ✅ MS-2 ✅ MS-3 ✅ MS-4 ✅ MS-5 ✅ · MS-6 ✅ · MS-7 `in_progress` (#7, plan-001 pending approval)** _(319/319 + CI green headSha-asserted @ `5264d1a`)_
- **Overall Status**: ACTIVE
- **Target Release / Deadline**: v0.1.0 (no date committed)
- **Current Working Branch**: `main`
- **Last Updated**: 2026-09-15 10:48 UTC (`origin/main` = `5264d1a`, CI 34959477445 green headSha-asserted; tree clean; GO-MS7 given, receiver checklist 5/5, plan-001 written) — all timestamps from here on are `date -u`. Earlier session records labelled host-local (UTC+12) times as UTC; ordering sound, basis corrected (checkpoint-001 §Anomalies 1)

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
- [x] `GO-MS4` — GIVEN in slices; MS-4 executed and **maintainer-approved ("okay" batch 2026-09-14)** → `completed`; #4 closed on GitHub
- [x] `GO-MS5` — GIVEN; MS-5 executed in 3 slices and **maintainer-approved** → `completed`; #5 closed. MS-5 checkpoint-001 + handoff-001 written
- [x] `GO-MS6` — **GIVEN 2026-09-15 01:24 UTC** with rulings (#12 four-pack canonical · #14 four-stage gate · `init` scaffold-only · slices S1–S5); #6 assigned; file-baseline obligation inherited and scheduled into S3 (NOTES §4, plan-001) → **executed S1–S5 + signed off 2026-09-15 10:25 UTC → `completed`** (AC-1…AC-8 per handoff-004; 319/319 @ `c549a7b`; CI 34957674680 green); #6 closed COMPLETED
- [ ] `GO-MS7` — **GIVEN 2026-09-15 10:48 UTC** (terse "go" after sign-off close); #7 OPEN; receiver checklist 5/5, plan-001 (S1–S4 + R1–R9) written, slice approval pending — no code before it

## 3. Active Working Set

- **Active RFC / Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`
- **Active Task Pointer**: `MS-7 Generic adapter + init UX (TASK-2026-09-15-v010-ms7-generic-adapter)` — `in_progress`, claimed 2026-09-15 10:48 UTC; execution sequence = `…ms7-generic-adapter.plan-001.md` S1–S4 · **plan-001 written, slice approval (R1–R9) pending → no code before it****
- **Key Source Files in Flight**: the v0.1.0 surface corpus (`docs/cli-reference.md`, `docs/routing-contract.md`, `docs/verification-guide.md`, `docs/errors.md`, `docs/getting-started.md`, `docs/faq.md`, `AGENTS.md`, `CONTRIBUTING.md`) — authority map in `docs/NOTES.md` §2
- **Verification Commands (Scoped)**: `npm run verify` = THE gate (live since MS-1, 2026-09-15). CI: `verify` workflow, node 20/22/24 on push+PR.

## 3A. Execution-Control Projection

- Not active — Task Records will be created by `pk:tasks` after RFC approval under `docs/tasks/TASK-2026-09-15-v010-*.md`. This tracker stays the projection until Boldash's own state engine replaces it.

## 4. Locked Technical Invariants (Do Not Undo)

P1–P10 + tie-breaker, verbatim in `docs/NOTES.md` §3. Pending additions on RFC approval: DECISION-v010-001 (single `tasks.json`, `schema_version: 1`, Expand-Contract evolution per RFC §3.3), 002–005 (toolchain & scope trims).

## 5. Known Blockers, Risks & Open Questions

- **Blockers**: None mechanical. Gates closed so far: MAINT-01 ✓ · GO-MS1–4 ✓. Current gate: **maintainer review of MS-4 (#4)** before MS-5 code. Minor: `SECURITY.md` placeholder email (NOTES §4); `adr/` vs `adrs/` naming (MS-9).
- **Environment hazard (recorded 2026-09-14)**: default-cache `npm ci` fails `EACCES` here though no root-owned files exist; use `npm ci --cache /tmp/boldash-npm-cache`. An empty `node_modules` makes `npm run lint` silently run system ESLint 6.4.0 (cannot read flat config). Never read the gate from piped output — pipes mask the exit code.
- **ARCHITECTURE §18**: Q1 **resolved** by RFC §3.2 (corpus-grounded). Q2–Q7 are Phase 2–4 scoped — not blocking v0.1.0.
- **Risks carried**: briefing-file append collision (PromptKit markers vs future Boldash briefing in `AGENTS.md`) — see RFC §8; importer over-promising — mitigated by conservative stubs (FMEA row 8).

## 6. Recent Architectural Decisions (ADR Log)

| Date       | Title                                              | Decision Summary                                                   | ADR File                              |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| 2026-09-15 | Single `tasks.json` state granularity              | Resolves ARCHITECTURE §18 Q1; `schema_version:1` + Expand-Contract | `docs/adrs/0001-single-tasks-json.md` |
| 2026-09-15 | vitest as dev-only test runner                     | DX for 9-milestone ramp; no runtime coupling                       | `docs/adrs/0002-vitest.md`            |
| 2026-09-15 | ajv@8 sole runtime dependency                      | draft-07 standard behind `shared/schema.ts` seam                   | `docs/adrs/0003-ajv.md`               |
| 2026-09-15 | Hand-rolled argv kernel                            | CLI surface is a tested contract; deps are liabilities             | `docs/adrs/0004-handrolled-argv.md`   |
| 2026-09-15 | Scope trims: no `claim`, no `--no-cache` in v0.1.0 | Leases/caching deferred to Phase 3 substrate                       | `docs/adrs/0005-v010-scope-trims.md`  |

## 7. Next Immediate Actions (single lane)

1. **MS-6 ✅ completed; MS-7 receiver done.** Sign-off tip `5264d1a` pushed, CI 34959477445 green headSha-asserted. GO-MS7 given 10:48 UTC; receiver checklist 5/5; plan-001 (S1–S4 + R1–R9) pending maintainer approval. **Next: approve plan → S1 on GO.**
2. Inherited open items: exit-code ambiguity for `VERIFY_COMMAND_TIMEOUT` (NOTES §4 doc-review), SECURITY email → #15 (maintainer), adr/adrs naming, `docs/state-model.md` + migration-from-v1 (#13).

## 8. Session Continuity Log

| Date       | Engineer / Agent                    | Focus                                                                                                                                                                                                                                                                                                                                                    | Artifacts                                                                                                                                                                                                                      |
| ---------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-14 | Lead + DSH agent                    | lineage intake, anomaly fixes, repo reset #1                                                                                                                                                                                                                                                                                                             | 10-file corpus, `docs/NOTES.md` salvage                                                                                                                                                                                        |
| 2026-09-15 | Lead Engineer                       | intentional v1 reinstall (`.promptkit` @ v1.5.1-26); authored 7-doc v0.1.0 surface-spec corpus + native `AGENTS.md`                                                                                                                                                                                                                                      | `AGENTS.md`, `CONTRIBUTING.md`, `docs/{cli-reference,routing-contract,verification-guide,errors,getting-started,faq}.md`                                                                                                       |
| 2026-09-15 | DSH agent (pk:plan, L2/Full)        | v0.1.0 Foundation RFC; STATE.md re-populated from template                                                                                                                                                                                                                                                                                               | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`                                                                                                                                                                              |
| 2026-09-14 | DSH agent (pk:checkpoint)           | Session boundary                                                                                                                                                                                                                                                                                                                                         | MS-1 ✅ · MS-2 ✅ · MS-3 awaiting_review; 42/42 green; checkpoint-001 + handoff-001 records written; timestamp-basis anomaly documented                                                                                        |
| 2026-09-14 | DSH agent (receiver session)        | Handoff checklist validation → MS-3 closure                                                                                                                                                                                                                                                                                                              | 5/5 checklist items evidenced (verify re-run 42/42 exit 0 @ `99c1dd3`, CI success @ same sha); 5 stale `Pending` rows stripped from MS-3 record; STATE.md RFC-approval drift corrected; environment hazard recorded; #3 closed |
| 2026-09-15 | DSH agent (pk:checkpoint)           | Session boundary after MS-5                                                                                                                                                                                                                                                                                                                              | MS-1..5 all completed; 187/187 CI-green; checkpoint-001 + handoff-001 for MS-6; five tooling incidents disclosed in checkpoint §Anomalies                                                                                      |
| 2026-09-15 | DSH agent (GO-MS6 receiver session) | Receiver checklist 5/5; #12/#14 rulings adopted; 4-stage gate folded; MS-6 claimed; plan-001 written                                                                                                                                                                                                                                                     | `…ms6-cli.plan-001.md`; NOTES §4; STATE §1/§2/§3/§7 refresh                                                                                                                                                                    |
| 2026-09-15 | DSH agent (MS-6 S1 session)         | GO executed: rulings landed, four-stage gate folded, plan-001, S1 built + pushed CI-green                                                                                                                                                                                                                                                                | `07191ca` feat(cli) S1; checkpoint-001 + handoff-001; 229/229; #12/#14 closed, #15 open                                                                                                                                        |
| 2026-09-15 | DSH agent (MS-6 S2 session)         | GO-S2 executed: stale-briefing disclosure; state get/list + workflow list/validate; validate semantics resolved; barrel + family runners; PASS+BLOCK per check                                                                                                                                                                                           | `01c1154` feat(cli) S2; checkpoint-002 + handoff-002; 271/271 four-stage; no new error codes                                                                                                                                   |
| 2026-09-15 | DSH agent (MS-6 S3 session)         | GO-S3 executed: route (+stdin seam, P9 budgets real-serializer-measured) + state writes + AC-8 capture (binding ruled, capture-before-transition, cross-verified vs consumer); every guard PASS-and-BLOCK                                                                                                                                                | `c539c56` feat(cli) S3; checkpoint-003 + handoff-003; 301/301 four-stage; no new error codes                                                                                                                                   |
| 2026-09-15 | DSH agent (MS-6 S4 session)         | GO-S4 executed: verify (0/1/2/12, real timeout, log-only, --all-empty 0) + workflow import (JSON stub, commands counted-not-copied); async dispatch; PASS-and-BLOCK per gate via built bin                                                                                                                                                               | `f357584` feat(cli) S4; 319/319 four-stage; CI 34952209416 green; no new error codes                                                                                                                                           |
| 2026-09-15 | DSH agent (MS-6 S5 session)         | S5 doc-sync: AC-6 pile-up cleared (claim/md/:125/exit-12) + import/validate rewritten; checkpoint-004 + handoff-004; record/STATE refresh; sign-off pending                                                                                                                                                                                              | boundary commit (this tip); 319/319; errors.md unchanged                                                                                                                                                                       |
| 2026-09-15 | DSH agent (MS-6 sign-off session)   | Push `c549a7b` (per-instance auth) + CI 34957674680 green headSha-asserted; sign-off gate 319/319 exit 0; AC-1…AC-8 checklist; #6 found pre-closed COMPLETED 09:22:28Z (surfaced, adopted as sign-off word); record → `completed`, STATE refreshed; prettier fail (34958965459) fixed by `8900cfd` → CI green; pointers recorded in `5264d1a` → CI green | `5264d1a` on origin/main; CI 34959477445; record completed; #6 closed                                                                                                                                                          |
| 2026-09-15 | DSH agent (GO-MS7 receiver session) | Receiver checklist 5/5 (clean tree @ `5264d1a`, #7 OPEN, full read order, no contradictions); plan-001 written (S1–S4 + R1–R9); record claimed; STATE refreshed; slice approval pending — no code before it                                                                                                                                              | `…ms7-generic-adapter.plan-001.md`; record in_progress; STATE §§1/2/3/7/8                                                                                                                                                      |
