# Task Record: MS-9 E2E journey, docs sync & close-out

<a id="TASK-2026-09-15-v010-ms9-integration-docs"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms9-integration-docs`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/9
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: merges to main, pushes, force-pushes, releases, tag creation. Agent may commit only after per-milestone human sign-off.
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: tests/integration E2E on fixtures (init→route→create→transition→verify VERIFIED + BLOCKED variant proving exit 1); RFC §3.4 doc amendments (exit-12 table, timeout_ms row, requirement add, claim/--no-cache marked v0.3.0); CHANGELOG; STATE close-out; beta packs.
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: MS-6, MS-7, MS-8
- **Risk**: Medium — release-adjacent; tagging human-gated
- **Verification Condition**: `npm run verify green; E2E in CI; docs audit`

## 3. Acceptance Criteria
- [ ] **AC-1**: `E2E PASS journey exits 0 in CI.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-2**: `E2E BLOCKED journey exits 1; task cannot reach complete.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-3**: `Doc amendments merged; link/anchor audit clean.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-4**: `--version reports 0.1.0; v0.1.0 tag ONLY after human pk:ship sign-off.`
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
- **Execution State**: `planned`
- **Mapped `pk:tasks` Status**: `To Do`
- **Active Task Pointer**: None
- **Start Time**: `N/A`
- **Current Actor**: `Lead Engineer @lowqualityloey`
- **Next Action**: `Wait for predecessor completion; begin only after maintainer go signal`

### Transition History
| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| — | `planned` | 2026-09-15 00:40 UTC | DSH agent (pk:tasks) | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv) | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |

## 6. Evidence and Completion Gate
- **Changed Files**:
  - `[pending]`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: Pending
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: N/A
- **Review Evidence**: `N/A`
- **Commit Evidence**: N/A before commit
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: Depends on MS-6, MS-7, MS-8; maintainer go signal

### Completion Gate
- **Completion State**: `planned`
- **Acceptance Results**: Pending
- **Changed-File Summary**: Pending
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending
