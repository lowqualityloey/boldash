# Task Record: MS-2 Schemas + shared kernel

<a id="TASK-2026-09-15-v010-ms2-schemas"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms2-schemas`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/2
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: merges to main, pushes, force-pushes, releases, tag creation. Agent may commit only after per-milestone human sign-off.
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: schemas/route.schema.json (verbatim routing-contract.md), task-state (schema_version:1), done meta-schema INCLUDING timeout_ms, event schema; src/shared/: Result<T,E>, errors.ts (full docs/errors.md code→exit catalog), atomic fs helpers (temp+rename), injected clock.
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: MS-1
- **Risk**: Low
- **Verification Condition**: `npm run verify green; fixture suite exits 0`

## 3. Acceptance Criteria
- [x] **AC-1**: `Every schema has ≥1 valid and ≥2 invalid fixture tests via ajv@8.`
  - **Result**: PASS
  - **Evidence**: tests/unit/schemas.test.ts — 14 tests; each of route/task/task-state-file/done/event has ≥1 valid + ≥2 invalid fixtures under ajv strict mode
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-2**: `errors.ts covers 100% of docs/errors.md codes; table-driven code→exit test.`
  - **Result**: PASS
  - **Evidence**: tests/unit/errors.test.ts — 4 tests parse docs/errors.md as the oracle: 28 codes, exact name-set equality, exact per-code exit mapping; zero-exit (warning) set proven to be exactly SCOPE_FILE_NOT_FOUND + HOST_UNKNOWN
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-3**: `writeAtomic crash-safety ordering tested.`
  - **Result**: PASS
  - **Evidence**: tests/unit/fs.test.ts — 7 tests on real temp dirs (no fs mocks): unserializable input leaves original bytes identical with zero temp created; success leaves no stray .tmp; 10 sequential writes always yield one complete object
  - **Result**: Pending
  - **Evidence**: Pending
- [x] **AC-4**: `done meta-schema accepts timeout_ms; rejects unknown check types with SCHEMA_VALIDATION.`
  - **Result**: PASS
  - **Evidence**: schemas/done.schema.json + schemas.test.ts — timeout_ms accepted on any check; unknown type 'static_analysis' rejected; command-without-run, file_exists-without-path and an extra 'exploit' key each rejected; empty must_pass rejected
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
- **Active Task Pointer**: `None` (MS-2 review-parked; held throughout in_progress — see transition note)
- **Start Time**: `2026-09-15 01:35 UTC`
- **Current Actor**: `DSH agent (executing under maintainer GO-MS2, 2026-09-15)`
- **Next Action**: `Maintainer review on issue #2; MS-3 unlocks on approval`

### Transition History
| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| — | `planned` | 2026-09-15 00:40 UTC | DSH agent (pk:tasks) | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv) | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
| `planned` | `ready` | 2026-09-15 01:35 UTC | Lead Engineer | MS-1 completed → dependency satisfied; GO-MS2 issued | #1 closed |
| `ready` | `in_progress` | 2026-09-15 01:35 UTC | DSH agent | Pointer claimed (transition recorded; pointer field corrected to match in this commit — earlier replace silently missed due to missing backticks in template) | this record |
| `in_progress` | `awaiting_review` | 2026-09-15 01:46 UTC | DSH agent | AC-1…AC-4 PASS; CI 34851150797 success on c2316de | `npm run verify` + `gh run list --json headSha` |

## 6. Evidence and Completion Gate
- **Changed Files**:
  - `schemas/{route,task,task-state-file,done,event}.schema.json` — draft-07 contracts
  - `src/shared/{result,errors,fs,clock,schema}.ts` — kernel; ajv confined to schema.ts (ADR-003 seam)
  - `tests/unit/{schemas,errors,fs}.test.ts` — 25 new tests (+MS-1 smoke = 26)
  - `tsconfig.json` esModuleInterop; `package.json`+lock ajv 8.20.0 sole runtime dep
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: `npm run verify` exit 0 locally 2026-09-15 01:44 UTC (lint 0 · tsc 0 · 26/26 in 604 ms); CI run 34851150797 success on headSha c2316de
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: GitHub Actions run `34851150797`, headSha `c2316de`, push, **completed/success** (node 20/22/24)
- **Review Evidence**: pending maintainer review
- **Commit Evidence**: `b7fe900` feat(schemas) · `c2316de` feat(shared)
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: `None — awaiting maintainer review (#2)`

### Completion Gate
- **Completion State**: `awaiting_review`
- **Acceptance Results**: `AC-1 PASS · AC-2 PASS · AC-3 PASS · AC-4 PASS`
- **Changed-File Summary**: 5 schemas, 5 kernel modules, 3 test files; no engine logic — exactly milestone scope
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `awaiting_review` recorded by DSH agent 2026-09-15 01:46 UTC; maintainer decision pending
