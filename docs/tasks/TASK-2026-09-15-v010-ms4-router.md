# Task Record: MS-4 Router pipeline + registry

<a id="TASK-2026-09-15-v010-ms4-router"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms4-router`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/4
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: any merge into `main` from a branch or PR, force-pushes, releases, tag creation. Agent may commit to `main` after per-milestone maintainer sign-off, and may push to `main` only under explicit **per-instance** authorization for that specific push. Prior pushes are not standing rights; silence is not authorization. Canonical rule: `docs/NOTES.md` §4 (ref #11).
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: 7-step pipeline per routing-contract.md; built-in registry packs feature/bugfix/docs/chore; enforced risk→level map (higher allowed, lower rejected); capability context (generic baseline).
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: MS-2
- **Risk**: Low
- **Verification Condition**: `npm run verify green; pipeline unit tests`

## 3. Acceptance Criteria
- [x] **AC-1**: `All 4 routing-contract examples pass as tests (valid, trivial, LEVEL_RISK_MISMATCH, CAPABILITY_MISSING).`
  - **Result**: PASS
  - **Evidence**: pipeline.test.ts T-1…T-4 (+T-5): four §Examples payloads verbatim; T-1 deep-equals the success payload PARSED from routing-contract.md; T-3 message byte-matches; T-4 doc-shaped CAPABILITY_MISSING via injected migration pack (D-1); T-5 proves step-3-before-5
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-2**: `Success payload ≤ 80 tokens via bytes/4 heuristic test (P9/RFC §1.2).`
  - **Result**: PASS
  - **Evidence**: T-12: JSON.stringify compact AND pretty ≤ 80 tokens (bytes/4), with headroom; also asserted on default-registry payloads
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-3**: `SCOPE_FILE_NOT_FOUND warning-only: exit 0, logged, non-blocking.`
  - **Result**: PASS
  - **Evidence**: scope.test.ts (8) + full-pipeline T-10 case: missing literal file ⇒ ok:true + warnings[1]; globs/greenfield/absent-cwd never warn; exit 0 from shared/errors.js; D-3 contract paragraph shipped in same commit (routing-contract.md §Scope)
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-4**: `Unknown workflow → WORKFLOW_NOT_FOUND with enabled list.`
  - **Result**: PASS
  - **Evidence**: T-5 + T-8: WORKFLOW_NOT_FOUND carries context.enabled == exactly ['feature','bugfix','docs','chore']; all 4 built-ins resolve, a fifth name blocks
  - **Result**: Pending
  - **Evidence**: Pending

## 4. Execution Policy
- **Mode**: `Gated Mode`
- **TDD Enforcement Mode**: `disabled`
- **Batch Authorization**: `N/A`
- **Soft Checkpoint**: `N/A - host (DSH session) has no mechanical timer; event-driven only`
- **Hard Checkpoint**: `N/A - same limitation; never claim unenforceable timers`
- **Event-Driven Checkpoints**: `Milestone, task switch, scope expansion, handoff, compaction, or context drift`
- **Stop Conditions**: `Missing approval/context, failed verification/CI/invariant, blocker, or developer stop`
- **Host Timer Capability**: `None observed in DSH harness — checkpoints enforced by convention only`

## 5. State and Active Ownership
- **Execution State**: `awaiting_review`
- **Mapped `pk:tasks` Status**: `In Review`
- **Active Task Pointer**: `None` (review-parked; held throughout slices 1–3)
- **Start Time**: `2026-09-14 15:05 UTC`
- **Current Actor**: `DSH agent (executing under maintainer GO-MS4 — first slice only)`
- **Next Action**: `Maintainer review (#4); MS-5 unlocks on approval`

### Transition History
| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| — | `planned` | 2026-09-15 00:40 UTC | DSH agent (pk:tasks) | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv) | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
| `planned` | `ready` | 2026-09-14 15:05 UTC | Lead Engineer | MS-3 approved + #3 closed (dependency satisfied); design gaps D-1…D-3 ruled | issue #3 CLOSED; `…ms4-router.plan-001.md` §12 |
| `ready` | `in_progress` | 2026-09-14 15:05 UTC | DSH agent | GO-MS4 given **scoped to the first slice**; pointer claimed backticked per the MS-3 retry lesson | maintainer selection "GO — first slice only" |
| `in_progress` | `awaiting_review` | 2026-09-14 | DSH agent | Slices 2–3 GO'd by maintainer batch ("Commit slice 2, continue steps 4–5" + final "Commit + push"); AC-1…4 PASS; 117/117 | this record + verify log |

> **Authorization boundary (partial GO)**: only `src/core/router/types.ts`, `levels.ts` and
> their unit tests are authorized. `registry.ts`, `capabilities.ts`, `scope.ts`,
> `pipeline.ts`, `workflows/` packs, and the `docs/routing-contract.md` warnings line each
> need a further explicit GO. So does pushing the resulting commit
> (`docs/NOTES.md` §4, ref #11 — per-instance, silence is not authorization).

## 6. Evidence and Completion Gate
- **Changed Files** (first slice only — see §5 authorization boundary):
  - `src/core/router/types.ts` — wire types; narrowing deliberately absent (schema is the seam)
  - `src/core/router/levels.ts` — risk→level map, one-way rule, requirement derivation, override guard
  - `tests/unit/router/levels.test.ts` — 18 tests, docs-as-oracle
  - `docs/NOTES.md` §4, all 9 Task Records — push-boundary resolution (ref #11, shipped as `c6b328d`)
  - Not yet written: `registry.ts`, `capabilities.ts`, `scope.ts`, `pipeline.ts`, `workflows/`
- **Scope Change Records**: `None` (design rulings D-1…D-3 live in `…plan-001.md` §12)
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: slices 1–2 as previously recorded; slice 3: `npm run verify` VERIFY_EXIT=0 — lint 0 · tsc 0 · **117/117 (10 files)** 2026-09-14 06:29→06:33 run chain (date -u basis); exit read via $?, never piped (STATE.md hazard honored)
- **Gate BLOCK proof (mutation run)**: each of four injected defects was caught, then reverted — `medium→1` (3 failures) · level-2 `tests` dropped (6) · `>=` inverted to `<=` (4) · override removal silently honoured (3). Restored file passes 18/18.
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: headSha-matched runs recorded at push (slice-3 commit); prior slices green: 34854360256 pattern established
- **Review Evidence**: slices signed off sequentially in-session (plan-001 §10 respected); final review pending on #4
- **Commit Evidence**: `a20c9ed` (slice 1 levels) · `c158620` (slice 2 registry/capabilities/oracle) · slice-3 scope+pipeline+docs (this commit)
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: `None — slices 2–3 GO'd and push authorized per #11 ruling (2026-09-14 maintainer batch)`

### Completion Gate
- **Completion State**: `awaiting_review`
- **Acceptance Results**: `AC-1 PASS · AC-2 PASS · AC-3 PASS · AC-4 PASS`
- **Changed-File Summary**: 6 router modules + index + doc-oracle harness + 66 router tests (117 total) + 1 contract paragraph; no CLI (MS-6), no state writes
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `in_progress` by DSH agent 2026-09-14 15:13 UTC

