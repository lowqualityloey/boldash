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
- [ ] **AC-1**: `Every schema has ≥1 valid and ≥2 invalid fixture tests via ajv@8.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-2**: `errors.ts covers 100% of docs/errors.md codes; table-driven code→exit test.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-3**: `writeAtomic crash-safety ordering tested.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-4**: `done meta-schema accepts timeout_ms; rejects unknown check types with SCHEMA_VALIDATION.`
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
- **Blocker and Resume Condition**: Depends on MS-1; maintainer go signal

### Completion Gate
- **Completion State**: `planned`
- **Acceptance Results**: Pending
- **Changed-File Summary**: Pending
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending
