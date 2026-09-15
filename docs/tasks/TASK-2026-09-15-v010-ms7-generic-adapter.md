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
- **Approval Boundary**: Human-only: any merge into `main` from a branch or PR, force-pushes, releases, tag creation. Agent may commit to `main` after per-milestone maintainer sign-off, and may push to `main` only under explicit **per-instance** authorization for that specific push. Prior pushes are not standing rights; silence is not authorization. Canonical rule: `docs/NOTES.md` §4 (ref #11).
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

- **Execution State**: `in_progress`
- **Mapped `pk:tasks` Status**: `In Progress`
- **Active Task Pointer**: `MS-7 Generic adapter + init UX (this record) — claimed 2026-09-15 10:48 UTC`
- **Start Time**: `2026-09-15 10:48 UTC`
- **Current Actor**: `DSH agent (executor) · Lead Engineer @lowqualityloey (approver)`
- **Next Action**: `Plan-001 slice approval (R1–R9 + S1–S4) → S1 on GO`

### Transition History

| Previous State | New State     | Timestamp            | Actor                                              | Reason                                                                     | Supporting Evidence                                                         |
| -------------- | ------------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| —              | `planned`     | 2026-09-15 00:40 UTC | DSH agent (pk:tasks)                               | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv)        | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`                           |
| `planned`      | `in_progress` | 2026-09-15 10:48 UTC | DSH agent (GO-MS7 receiver checklist 5/5; #7 open) | Maintainer "go"; MS-6 completed; plan-001 written, slices pending approval | receiver checklist (plan-001 §0); `gh issue view 7`; tree clean @ `5264d1a` |

## 6. Evidence and Completion Gate

- **Changed Files**:
  - `[pending]`
  - `S1 (2026-09-15): src/adapters/{adapter-types,generic,index}.ts (new; ARCH §5.2 verbatim interface, §5.3 Generic column single-sourced from GENERIC_BASELINE, briefing markers, best-effort detect, advisory hook no-ops), tests/unit/adapters/{generic,contract}.test.ts + tests/unit/adapters/contract-suite.ts (new; shared suite per AGENTS.md, matrix oracle via doc-oracle)`
  - `S2 (2026-09-15): src/cli/commands/init.ts (detect-first, AC-2 git refusal, R2 --host rule, probe→project.json, warnings + adapter/capabilities envelope), src/core/state/scaffold.ts (capabilities input, plain strings — rule 8), tests/unit/cli/init-command.test.ts (new matrix), tests/golden/cli-init.test.ts (+5 host-wiring; fixture gains .git), other 3 golden fixtures gain .git (AC-2 compat)`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `plan-001: docs/tasks/TASK-2026-09-15-v010-ms7-generic-adapter.plan-001.md (S1–S4 + R1–R9, pending approval 2026-09-15)`
- **Handoff Records**: `None`
- **Verification Evidence**: Pending
- **S1 Evidence (2026-09-15)**: four-stage gate green — lint 0, format:check 0, typecheck 0, 342/342 (23 new: 15 generic unit + 8 contract). Probe oracle parses the §5.3 matrix (no drift); briefing idempotency + PromptKit coexistence pinned; no CLI changes (319 pre-existing untouched).
- **S2 Evidence (2026-09-15)**: four-stage gate green — 353/353 (11 new: 6 init unit + 5 init golden). AC-2 refusal + R2 host rule proven through the built bin; AC-4 persist locked (config.yaml line + project.json set); no new error codes (CLI_USAGE/CLI_PRECONDITION_FAILED reuse).
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: `S1: run 34962033665 @ c047e52 — CI success ×3 matrices, headSha-asserted (watch exit 0). S2: run 34962735831 @ 61f6afa — CI success ×3 matrices, headSha-asserted.`
- **Review Evidence**: `N/A`
- **Commit Evidence**: N/A before commit
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: MS-6 `completed` 2026-09-15; GO-MS7 given ("go" 2026-09-15 10:48 UTC); plan-001 pending slice approval — no code before it

### Completion Gate

- **Completion State**: `planned`
- **Acceptance Results**: Pending
- **Changed-File Summary**: Pending
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending
