# Task Record: MS-1 Project scaffold & CI

<a id="TASK-2026-09-15-v010-ms1-scaffold"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms1-scaffold`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/1
- **Follow-up Issue (Optional)**: #10 — missing `CODE_OF_CONDUCT.md` referenced by `CONTRIBUTING.md` (found in MS-1 link sweep)
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: merges to main, pushes, force-pushes, releases, tag creation. Agent may commit only after per-milestone human sign-off.
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: Deliver buildable skeleton: package.json (ESM, exact-pinned deps, no post-install), strict tsconfig, vitest, eslint flat config, npm scripts incl. `npm run verify` (lint+typecheck+test), GitHub Actions CI (Linux, Node 20/22/24).
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: None (first)
- **Risk**: Low
- **Verification Condition**: `npm run verify exits 0 locally and in CI`

## 3. Acceptance Criteria
- [x] **AC-1**: `Given a clean checkout, When `npm ci && npm run verify` runs, Then exit 0 with a passing suite.`
  - **Result**: PASS
  - **Evidence**: `rm -rf node_modules && npm ci && npm run verify` → exit 0, 2026-09-15 01:11 UTC (1 test, 193 ms)
- [x] **AC-2**: ``npm run verify` is a single documented gate matching CONTRIBUTING.md §The release gate.`
  - **Result**: PASS
  - **Evidence**: `verify` = `lint && typecheck && test` in package.json; mirrors CONTRIBUTING §release gate
- [x] **AC-3**: `CI workflow runs verify on every push + PR; badge visible in README.`
  - **Result**: PASS
  - **Evidence**: `.github/workflows/ci.yml` push+PR, node 20/22/24; run 34848611604 **success (20s)**; README badge added
- [x] **AC-4**: `No dependency uses ^ or ~ ranges; no preinstall/postinstall/prepare scripts.`
  - **Result**: PASS
  - **Evidence**: devDeps exact-pinned (typescript 6.0.3, vitest 5.0.0, eslint 10.10.0, typescript-eslint 8.70.0, prettier 3.9.6, @types/node 26.5.1); no ^/~; no lifecycle scripts

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
- **Execution State**: `completed`
- **Mapped `pk:tasks` Status**: `Done`
- **Active Task Pointer**: `None`
- **Start Time**: `2026-09-15 00:58 UTC`
- **Current Actor**: `DSH agent (executing under maintainer GO, 2026-09-15)`
- **Next Action**: `None — completed; issue #1 closed`

### Transition History
| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| — | `planned` | 2026-09-15 00:40 UTC | DSH agent (pk:tasks) | RFC approved: TDD disabled + vitest/ajv/hand-rolled-argv | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
| `planned` | `ready` | 2026-09-15 00:58 UTC | Lead Engineer | Readiness complete; maintainer GO (ask_user_question batch) | decision record in session |
| `ready` | `in_progress` | 2026-09-15 00:58 UTC | DSH agent | Pointer claimed; scaffold started | this record |
| `in_progress` | `awaiting_review` | 2026-09-15 01:22 UTC | DSH agent | AC-1…4 PASS; CI 34848611604 success | `npm run verify` + `gh run watch`

## 6. Evidence and Completion Gate
- **Changed Files**:
  - `package.json` + `package-lock.json` — exact-pinned toolchain, verify scripts
  - `tsconfig.json` + `tsconfig.build.json` — strict NodeNext noEmit gate / dist build
  - `eslint.config.js`, `.prettierrc.json`, `.prettierignore` — flat lint, no-explicit-any
  - `src/version.ts`, `tests/smoke.test.ts` — build input + runner proof
  - `.github/workflows/ci.yml` — CI matrix; `README.md` — CI badge line
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: local `npm ci && npm run verify` exit 0 (01:11 UTC); GitHub Actions run 34848611604 success (node 20/22/24, 20s) observed via gh run watch; pins via npm install --save-exact
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: GitHub Actions run `34848611604`, workflow CI, main, 2026-09-15T13:20Z — **success (20s)**
- **Review Evidence**: Maintainer approval 2026-09-15 01:35 UTC (ask_user_question batch: 'Approve MS-1, GO MS-2'); #1 closed
- **Commit Evidence**: `6e47c59` (scaffold) + `ddf2ffb` (records sync); follow-up fix commit restores this record
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: None — awaiting maintainer review

### Completion Gate
- **Completion State**: `completed`
- **Acceptance Results**: AC-1 PASS; AC-2 PASS; AC-3 PASS; AC-4 PASS
- **Changed-File Summary**: scaffold only — engines correctly deferred to MS-2+
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `completed` — Lead Engineer, 2026-09-15 01:35 UTC
