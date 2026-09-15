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

- [x] **AC-1**: `init creates exact RFC §3 layout; re-run idempotent — no duplicate blocks, state untouched.`
  - **Result**: Satisfied (maintainer sign-off pending)
  - **Evidence**: `tests/golden/cli-init.test.ts` (scaffold tree + envelope); `tests/golden/cli-init-briefing.test.ts` (fresh repo → exactly one block · double `--force` coalesces, second skips · PromptKit prefix byte-stable · re-run without `--force` refuses exit 2 and changes nothing); `tests/unit/cli/init-command.test.ts`; four-stage gate 364/364 exit 0 @ `31d7c61` tree
- [x] **AC-2**: `init outside git repo → structured refusal (exit 2).`
  - **Result**: Satisfied (maintainer sign-off pending)
  - **Evidence**: `tests/golden/cli-init.test.ts` — bare temp dir (no `.git`) → `CLI_PRECONDITION_FAILED` exit 2, nothing written; detection runs before any mutation (`src/cli/commands/init.ts`); code reuse per R3, no new error code
- [x] **AC-3**: `probe feeds route: 'subagents' → CAPABILITY_MISSING on generic host.`
  - **Result**: Satisfied via the adapter-sourced context (maintainer sign-off pending)
  - **Evidence**: `tests/golden/cli-state-workflow.test.ts` — `subagents`-requiring pack through `workflow import` → `CAPABILITY_MISSING` exit 3, `context: { missing, host: 'generic' }`, suggestion names the adapter probe, nothing written; R6 provenance + value-equality in `tests/unit/cli/probe-context.test.ts`. **Disclosed deviation**: route-level exit-3 is unreachable through the CLI in v0.1.0 (route registry is built-ins-only, R6); R6 equality is pinned by the existing route PASS goldens instead of a faked route-level block
- [x] **AC-4**: `--profile persists to .boldash/config.yaml; invalid → exit 2.`
  - **Result**: Satisfied (maintainer sign-off pending)
  - **Evidence**: `tests/golden/cli-init.test.ts` — `profile: lite` line in `config.yaml` + `profile` in `project.json`; invalid `--profile` → `CLI_USAGE` exit 2 (existing behavior, pinned per R5)

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
- **Next Action**: `Maintainer sign-off of MS-7 (S1–S4 executed, no code open) → record completed → close #7 → MS-8 (#8) opens with its own plan`

### Transition History

| Previous State | New State     | Timestamp            | Actor                                              | Reason                                                                     | Supporting Evidence                                                         |
| -------------- | ------------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| —              | `planned`     | 2026-09-15 00:40 UTC | DSH agent (pk:tasks)                               | RFC approved 2026-09-15 (TDD disabled; vitest/ajv/hand-rolled argv)        | `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`                           |
| `planned`      | `in_progress` | 2026-09-15 10:48 UTC | DSH agent (GO-MS7 receiver checklist 5/5; #7 open) | Maintainer "go"; MS-6 completed; plan-001 written, slices pending approval | receiver checklist (plan-001 §0); `gh issue view 7`; tree clean @ `5264d1a` |

## 6. Evidence and Completion Gate

- **Changed Files**:
  - `[pending]`
  - `S3 (2026-09-15): src/cli/commands/init.ts (briefing append post-scaffold, ADAPTER_INIT_FAILED exit 3), src/cli/probe-context.ts (new; R6 seam), src/cli/commands/{route,workflow}.ts (probe-sourced context; validateWorkflowPack two-arg), tests/golden/cli-init-briefing.test.ts + tests/unit/cli/probe-context.test.ts (new), extensions in cli-state-workflow + init-command tests`
  - `S4 (2026-09-15, docs only — no code): docs/cli-reference.md (§init: git-tree precondition, AGENTS.md briefing + marker idempotency, --host R2 rule, probe/warning envelope, exit 0/2/3 + ADAPTER_INIT_FAILED path), docs/getting-started.md (real envelope renders for init + verify replacing the fictional output — handoff-004 gap; generic-only briefing truth per R9; doctor / pre-tool hooks / per-host briefings marked deferred), docs/errors.md unchanged (ADAPTER_INIT_FAILED already catalogued — finding, not omission)`
  - `S1 (2026-09-15): src/adapters/{adapter-types,generic,index}.ts (new; ARCH §5.2 verbatim interface, §5.3 Generic column single-sourced from GENERIC_BASELINE, briefing markers, best-effort detect, advisory hook no-ops), tests/unit/adapters/{generic,contract}.test.ts + tests/unit/adapters/contract-suite.ts (new; shared suite per AGENTS.md, matrix oracle via doc-oracle)`
  - `S2 (2026-09-15): src/cli/commands/init.ts (detect-first, AC-2 git refusal, R2 --host rule, probe→project.json, warnings + adapter/capabilities envelope), src/core/state/scaffold.ts (capabilities input, plain strings — rule 8), tests/unit/cli/init-command.test.ts (new matrix), tests/golden/cli-init.test.ts (+5 host-wiring; fixture gains .git), other 3 golden fixtures gain .git (AC-2 compat)`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `plan-001: docs/tasks/TASK-2026-09-15-v010-ms7-generic-adapter.plan-001.md (S1–S4 + R1–R9, approved 2026-09-15); checkpoint-001 (S3 boundary, 2026-09-15 12:14 UTC); checkpoint-002 (S4 boundary, 2026-09-15 12:40 UTC)`
- **Handoff Records**: `handoff-001 (S3 → GO-S4, received + validated 5/5 this session); handoff-002 (S4 → maintainer sign-off)`
- **Verification Evidence**: `S1: gate 342/342. S2: gate 353/353. S3: gate 364/364 + CI 34966807770 @ 29b2930 headSha-asserted. S4: four-stage gate re-run on the docs commit — lint 0, format:check 0, typecheck 0, test 34 files / 364/364, exit 0 (docs-only change; run anyway per handoff-001). Every doc claim in S4 was traced to a shipped behavior re-verified this session: init renders captured from the built bin (fresh git repo), verify success/blocked renders captured from a replicated golden fixture (exit 0 / exit 1), ADAPTER_INIT_FAILED → exit 3 confirmed in src/shared/errors.ts:43 and docs/errors.md:580`
- **S1 Evidence (2026-09-15)**: four-stage gate green — lint 0, format:check 0, typecheck 0, 342/342 (23 new: 15 generic unit + 8 contract). Probe oracle parses the §5.3 matrix (no drift); briefing idempotency + PromptKit coexistence pinned; no CLI changes (319 pre-existing untouched).
- **S2 Evidence (2026-09-15)**: four-stage gate green — 353/353 (11 new: 6 init unit + 5 init golden). AC-2 refusal + R2 host rule proven through the built bin; AC-4 persist locked (config.yaml line + project.json set); no new error codes (CLI_USAGE/CLI_PRECONDITION_FAILED reuse).
- **Behavior IDs**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification**: `N/A - Code Work`
- **CI Evidence**: `S1: run 34962033665 @ c047e52 — CI success ×3 matrices, headSha-asserted (watch exit 0). S2: run 34962735831 @ 61f6afa — CI success ×3 matrices, headSha-asserted. S3: run 34966807770 @ 29b2930 — CI success ×3 matrices, headSha-asserted (watch exit 0). S4: run 34971224918 @ f51ee60 — CI success ×3 matrices (node 20/22/24), headSha-asserted via `gh run watch --exit-status` (exit 0); f51ee60 is the tip of the push 765d6d0..f51ee60, so the docs commit 31d7c61 travels inside this run's tree.`
- **Review Evidence**: `N/A`
- **Commit Evidence**: `S1 c047e52 · S2 61f6afa · S3 bf99c7e + 29b2930 + 2507e69 · boundary 838c44f + 765d6d0 (all pushed, CI green). S4: 31d7c61 docs(surface) doc truth pass + f51ee60 boundary records — pushed 2026-09-15 12:50 UTC (per-instance GO naming exactly those two shas), CI 34971224918 green headSha-asserted @ f51ee60`
- **Pull Request Evidence**: `N/A before PR`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: `None mechanical. GO-MS7 given 2026-09-15 10:48 UTC; per-slice GOs S1–S3; GO-S4 given 2026-09-15 12:29 UTC (docs truth pass incl. the two flagged honesty items — doctor + pre-tool hook enforcement). Resume gate: maintainer sign-off of MS-7 → record completed → #7 closed → MS-8 (#8) plan. S4 commits are pushed and CI-green; any further commit needs its own per-instance GO naming it.`

### Completion Gate

- **Completion State**: `in_progress` (sign-off pending)
- **Acceptance Results**: AC-1…AC-4 Satisfied — self-verified with evidence in §3; the maintainer's explicit sign-off is still outstanding
- **Changed-File Summary**: S1–S3 code + S4 docs per §6 Changed Files; no new error codes (R7 catalog reuse verified); suite 364/364
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: Pending — tests are evidence, not proof; requires the maintainer's word (silence is not authorization)
