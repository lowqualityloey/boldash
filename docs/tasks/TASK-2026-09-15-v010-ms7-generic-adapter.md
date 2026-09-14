# Task Record: MS-7 Generic adapter + init UX

<a id="TASK-2026-09-15-v010-ms7-generic-adapter"></a>

## 1. Identity and Authority
- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-09-15-v010-ms7-generic-adapter`
- **Work Type**: `Code Work`
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` (§5 milestone table; §3 contracts; §4 FMEA)
- **External Reference (Optional)**: https://github.com/lowqualityloey/boldash/issues/7
- **Owner / Actor**: Lead Engineer @lowqualityloey (approver) · executing agent: DSH session (proposal/implementation)
- **Execution Scope**: boldash repository (`main`); paths per In Scope
- **Approval Boundary**: Human-only: merges to main, pushes, force-pushes, releases, tag creation. Agent may commit only after per-milestone human sign-off.
- **Created**: `2026-09-15 00:40 UTC`

## 2. Objective and Boundaries
- **Objective**: adapters/generic: capability probe (fs/shell/git/human_approval true; subagents/mcp/pre_tool_hooks false), host detect fallback, briefing append (BOLDASH_START/END markers, append-only, idempotent; coexists with PromptKit markers in same file).
- **In Scope**: see Objective; files named therein.
- **Explicit Non-Goals**:
  - RFC §1.3 deferrals (policy engine, doctor/explain, hook adapters, leases, cache, plugin API, benchmarks).
  - Any release, tag, push, or merge action.
- **Dependencies**: MS-6
- **Risk**: Medium — writes user repo files; append-only marker-guarded
- **Verification Condition**: `npm run verify green; idempotency fixtures`

## 3. Acceptance Criteria
- [ ] **AC-1**: `init creates exact RFC §3 layout; re-run idempotent — no duplicate blocks, state untouched.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-2**: `init outside git repo → structured refusal (exit 2).`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-3**: `probe feeds route: 'subagents' → CAPABILITY_MISSING on generic host.`
  - **Result**: Pending
  - **Evidence**: Pending
- [ ] **AC-4**: `--profile persists to .boldash/config.yaml; invalid → exit 2.`
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
- **Blocker and Resume Condition**: Depends on MS-6; maintainer go signal

### Completion Gate
- **Completion State**: `planned`
- **Acceptance Results**: Pending
- **Changed-File Summary**: Pending
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending
