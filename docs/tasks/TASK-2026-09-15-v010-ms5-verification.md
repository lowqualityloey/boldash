# Task Record: MS-5 Verification engine

<a id="TASK-2026-09-15-v010-ms5-verification"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms5-verification`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/5
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: any merge into `main` from a branch or PR, force-pushes, releases, tag creation. Agent may commit to `main` after per-milestone maintainer sign-off, and may push to `main` only under explicit **per-instance** authorization for that specific push. Prior pushes are not standing rights; silence is not authorization. Canonical rule: `docs/NOTES.md` §4 (ref #11).
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: must_pass (file_exists, command, regex_in_file, state_check, evidence_exists) + must_not (file_not_modified, command_fails); per-check timeout_ms default 300s; output capture → evidence with secret redaction; GateResult; exits 0/1/2/12.
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: MS-3
- **Risk**: High — executes shell by design; declared-only + timeouts + SECURITY.md §1
- **Verification Condition**: `npm run verify green; pass/block matrix`

## 3. Acceptance Criteria
- [ ] **AC-1**: `EVERY check type has one PASS and one BLOCK test (a gate that only passes is not a gate).`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-2**: `Hang → killed at timeout, VERIFY_COMMAND_TIMEOUT exit 12.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-3**: `Secret-bearing fixture redacted or EVIDENCE_REDACTION_FAILED (exit 10); never raw.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-4**: `Undeclared execution structurally impossible: commands only from validated contract objects.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-5**: `must_not.command_fails inversion tested both directions.`
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
- **Execution State**: `in_progress`
- **Mapped `pk:tasks` Status**: `In Progress`
- **Active Task Pointer**: `TASK-2026-09-15-v010-ms5-verification`
- **Start Time**: `N/A`
- **Current Actor**: `DSH agent (executing under maintainer GO-MS5, 2026-09-14)`
- **Next Action**: `Design note (plan-001): evidence layout, state_check grammar, timeout/redaction mechanics; then implement with PASS+BLOCK tests per check type`

### Transition History
| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| — | `planned` | 2026-09-15 00:40 UTC | DSH agent (pk:tasks) | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv) | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` |
| `planned` | `ready` | 2026-09-14 | Lead Engineer | MS-4 completed → dependency satisfied; GO-MS5 in "okay" batch | #4 closed |
| `ready` | `in_progress` | 2026-09-14 | DSH agent | Pointer claimed (backticked, MS-3 lesson applied) | this record |

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
- **Blocker and Resume Condition**: Depends on MS-3; maintainer go signal

### Completion Gate
- **Completion State**: `planned`
- **Acceptance Results**: Pending
- **Changed-File Summary**: Pending
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending
