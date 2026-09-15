# CLI Reference

> **Status:** v0.1.0 reference. Implemented in v0.1.0: `init`, `route`,
> `state get|list|transition|requirement add|evidence add`, `verify`,
> `workflow list|validate|import` (see [RFC §3.4](../docs/specs/2026-09-15-spec-v0.1.0-foundation.md)).
> `doctor`, `explain`, `policy check`, `checkpoint`, `diff`, `evidence`,
> `worktree`, and `state claim` are specified below but deferred past v0.1.0.
> **Audience:** Users, workflow authors, agents consuming CLI output.

---

## Global Flags

| Flag                   | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `--format human\|json` | Output format. Default: `human`.                                       |
| `--quiet`              | Suppress non-error output.                                             |
| `--verbose`            | Include debug output.                                                  |
| `--cwd <path>`         | Working directory. Default: current directory.                         |
| `--config <path>`      | Path to `.boldash/config.yaml`. Default: `<cwd>/.boldash/config.yaml`. |
| `--no-color`           | Disable ANSI colors.                                                   |
| `--version`            | Print version.                                                         |
| `--help`               | Print help.                                                            |

---

## Output Contract

Every command supports `--format json`.

**Success:**

```json
{ "ok": true, "data": { ... } }
```

**Failure:**

```json
{
  "ok": false,
  "error": {
    "code": "STRING",
    "message": "human-readable description",
    "field": "optional.json.path",
    "suggestion": "optional remediation hint"
  }
}
```

Exit codes:

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 0    | Success                                   |
| 1    | Verification failed / policy blocked      |
| 2    | Invalid input / schema error              |
| 3    | Missing capability / host incompatibility |
| 4    | Concurrency conflict                      |
| 10+  | Internal error                            |

---

## `boldash init`

Initialize Boldash in the current repository. Requires a git working tree:
outside one, `init` refuses with `CLI_PRECONDITION_FAILED` (exit 2) and
writes nothing. It scaffolds the `.boldash/` tree, records the probed host
capabilities in `project.json`, and appends the Boldash briefing block to
`AGENTS.md`.

```bash
boldash init [--profile lite|balanced|strict|accelerated] [--host <name>] [--force]
```

**Creates:**

- `.boldash/config.yaml` (literal template; the core never parses YAML)
- `.boldash/state/project.json`
- `.boldash/state/tasks.json`
- `.boldash/state/decisions.json`
- `.boldash/state/evidence.json`
- `.boldash/evidence/`
- `.boldash/events.jsonl`
- `AGENTS.md` — the Boldash briefing block, created or appended (see §Briefing)

No workflow packs are written in v0.1.0: the pack file format lands in MS-8,
and `.boldash/workflows/` appears on first `workflow import`. `config.yaml`
stays a literal template that the core never parses (ADR-0003).

**Flags:**

| Flag               | Description                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--profile <name>` | `lite`, `balanced`, `strict`, `accelerated`. Default: `balanced`.                                                                                                               |
| `--host <name>`    | Force an adapter. v0.1.0 ships one adapter, so `generic` is the only accepted value; any other value is `CLI_USAGE` (exit 2). Default: auto-detect (always resolves `generic`). |
| `--force`          | Overwrite an existing `.boldash/` (destructive).                                                                                                                                |

**Envelope (`--format json`):**

```json
{
  "ok": true,
  "data": {
    "initialized": true,
    "path": "/repo/.boldash",
    "profile": "balanced",
    "adapter": "generic",
    "capabilities": [
      "filesystem.read",
      "filesystem.write",
      "shell.execute",
      "git.read",
      "human_approval"
    ],
    "warnings": ["ADVISORY_MODE"],
    "created": ["state/tasks.json", "events.jsonl", "…"],
    "briefing": { "path": "/repo/AGENTS.md", "skipped": false }
  }
}
```

`warnings` always includes `ADVISORY_MODE`, plus `HOST_UNKNOWN` when
auto-detection recognized no host. A generic host provides no
`pre_tool_hooks`, so Boldash can warn, log, and report but cannot block
(`ARCHITECTURE.md` §5.3).

### Briefing

`init` appends the Boldash briefing block to `AGENTS.md`, delimited by
`<!-- BOLDASH_START -->` / `<!-- BOLDASH_END -->`:

- no `AGENTS.md` → the file is created with the block
- existing `AGENTS.md` → preserved byte-for-byte, the block is appended after
  it (other tools' marker blocks, such as PromptKit's, are left untouched)
- block already present → nothing is written and `briefing.skipped` is `true`

Only `AGENTS.md` receives a block in v0.1.0. `CLAUDE.md`,
`.cursor/rules/boldash.mdc`, and `.antigravity/rules/boldash.md` are deferred
along with the host adapters.

If the briefing write fails — the path is not writable, or `AGENTS.md` exists
as a directory — `init` answers `ADAPTER_INIT_FAILED` (exit 3), never a
swallowed warning. The `.boldash/` tree is scaffolded by then, so that state
is half-complete by design: fix the permission problem and re-run
`boldash init --force`.

**Exit codes:** 0, 2, 3.

---

## `boldash doctor`

Diagnose config, host, state, and capabilities.

```bash
boldash doctor [--fix]
```

**Output:**

```
Boldash Doctor
────────────────────────────────────────
Host
✓ Claude Code detected (v1.2.3)
✓ Adapter: adapter-claude

Capabilities
✓ filesystem.read
✓ filesystem.write
✓ shell.execute
✓ git.read
✓ git.commit
✓ git.worktree
✗ mcp (not configured)

Project
✓ .boldash/config.yaml
✓ .boldash/state/project.json
✓ .boldash/state/tasks.json
✓ .boldash/events.jsonl

Configuration
✓ profile: balanced
✓ workflows: feature, bugfix, docs, chore

Warnings
⚠ GitHub integration unavailable (gh CLI not found)

Overall
READY WITH WARNINGS
```

**Flags:**

| Flag    | Description                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| `--fix` | Attempt to repair common issues (regenerate projections, re-detect capabilities). |

**Exit codes:** 0, 2, 3.

---

## `boldash route`

Validate an LLM route proposal.

```bash
boldash route --input <path>
boldash route --json '<inline-json>'
echo '<json>' | boldash route
```

**Success:**

```json
{
  "ok": true,
  "data": {
    "workflow": "feature",
    "level": 2,
    "requirements": {
      "task_record": true,
      "specification": true,
      "tests": true,
      "review": false,
      "human_approval": false
    }
  }
}
```

**Failure:**

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_MISSING",
    "message": "Workflow 'migration' requires 'subagents', which this host does not provide.",
    "field": "route.workflow",
    "suggestion": "Use the 'refactor' workflow."
  }
}
```

**Flags:**

| Flag              | Description                             |
| ----------------- | --------------------------------------- |
| `--input <path>`  | Read proposal from a file.              |
| `--json <string>` | Inline JSON proposal.                   |
| `--create`        | Create a task from the validated route. |

**Exit codes:** 0, 2, 3.

---

## `boldash state`

Read and modify canonical state.

### `boldash state get <task-id>`

```bash
boldash state get TASK-001
boldash state get TASK-001 --format json
```

**Exit codes:** 0, 2.

### `boldash state list`

```bash
boldash state list
boldash state list --status verifying
boldash state list --risk high
boldash state list --type feature
boldash state list --owner agent-01
```

**Flags:**

| Flag           | Description               |
| -------------- | ------------------------- |
| `--status <s>` | Filter by status.         |
| `--risk <r>`   | Filter by risk.           |
| `--type <t>`   | Filter by type.           |
| `--owner <o>`  | Filter by owner.          |
| `--limit <n>`  | Max results. Default: 50. |

**Exit codes:** 0, 2.

### `boldash state transition <task-id> <status>`

```bash
boldash state transition TASK-001 implementing
```

**Exit codes:** 0, 2, 4.

### `boldash state claim <task-id>`

> Deferred past v0.1.0 (leases arrive with later milestone scope).
> Documented here so the shape is stable when it lands.

Claim a task with a lease.

```bash
boldash state claim TASK-001 --owner agent-01 --ttl 30m
```

**Exit codes:** 0, 2, 4.

### `boldash state requirement add <task-id> <text>`

Add a requirement to a task (requirement ids are auto-assigned `R1`, `R2`, …).

```bash
boldash state requirement add TASK-001 "Handle error responses"
```

**Exit codes:** 0, 2.

### `boldash state evidence add <task-id>`

Attach evidence to a task.

```bash
boldash state evidence add TASK-001 --type test-run --ref evt_9381
```

**Exit codes:** 0, 2.

---

## `boldash verify`

Run verification gates against a task. The contract is discovered by the
S3 binding: `.boldash/workflows/<task.workflow>/done.schema.json`. A task
with no workflow, or a missing/malformed contract, fails with
`VERIFY_CONTRACT_INVALID` (exit 2) — never a silent skip. Verification
logs a `verify.run` event but does not transition the task; move
`verifying → complete` explicitly with `state transition`.

```bash
boldash verify TASK-001
boldash verify TASK-001 --format json
boldash verify --all
```

**Success (exit 0):**

```
Boldash Verification: TASK-001
────────────────────────────────────────
✓ R1 implemented
✓ R2 implemented
✓ R3 implemented
✓ No secrets
✓ Tree clean

STATUS: VERIFIED
```

**Failure (exit 1):**

```
✗ R3 not implemented  (test oauth_callback not found)
✗ Review missing      (evidence review-77 required)

STATUS: BLOCKED
```

**Flags:**

| Flag    | Description                            |
| ------- | -------------------------------------- |
| `--all` | Verify all tasks in `verifying` state. |

With `--all` and zero `verifying` tasks, verification succeeds with an
empty report (exit 0).

**Exit codes:** 0, 1, 2, 12. Exit 12 is a command timeout
(`VERIFY_COMMAND_TIMEOUT` wins over `BLOCKED`).

---

## `boldash explain`

Produce a traceability graph for a task.

```bash
boldash explain TASK-001
```

**Output:**

```
TASK-001: Handle Google OAuth callback
────────────────────────────────────────
Status: verifying
Risk: medium
Workflow: feature

Requirements
├── R1 Handle Google OAuth callback
│      → Implementation: src/auth/callback.ts
│      → Test: oauth_callback (PASS)
├── R2 Handle error responses
│      → Implementation: src/auth/callback.ts
│      → Test: oauth_error (PASS)
└── R3 Record audit log
       → Implementation: MISSING
       → Test: MISSING

Verification: BLOCKED (2/3 requirements)
Reason: R3 has no implementation or test evidence.
```

**Exit codes:** 0, 2.

---

## `boldash policy check`

Evaluate a policy action against a task.

```bash
boldash policy check git.commit --task TASK-001
```

**Allowed:**

```
Policy: git.commit
Task: TASK-001
Result: ALLOWED
```

**Blocked:**

```
Policy: git.commit
Task: TASK-001
Result: BLOCKED
Rule: commit-requires-verification
Reason: verification.all_requirements_verified is false (R3 pending)
```

**Exit codes:** 0 (allowed), 1 (blocked), 2.

---

## `boldash checkpoint`

Snapshot a task's state.

```bash
boldash checkpoint TASK-001
boldash checkpoint TASK-001 --message "before refactor"
```

Creates a checkpoint file under `.boldash/state/checkpoints/`. Useful before risky operations.

**Exit codes:** 0, 2.

---

## `boldash diff`

Show state changes since a checkpoint.

```bash
boldash diff TASK-001
boldash diff TASK-001 --since checkpoint-001
```

**Exit codes:** 0, 2.

---

## `boldash evidence`

Query the event log.

### `boldash evidence list <task-id>`

```bash
boldash evidence list TASK-001
```

### `boldash evidence show <event-id>`

```bash
boldash evidence show evt_9381
```

### `boldash evidence export <task-id>`

```bash
boldash evidence export TASK-001 --format md --output evidence.md
```

**Exit codes:** 0, 2.

---

## `boldash workflow`

Manage workflow packs.

### `boldash workflow list`

```bash
boldash workflow list
```

Lists enabled workflows and their requirements.

### `boldash workflow import <path>`

```bash
boldash workflow import ./my-pack.json
boldash workflow import ./my-pack/
```

Imports a JSON workflow pack (a file, or a directory containing
`done.schema.json` plus an optional `pack.json`/`manifest.json`) and
writes a **conservative stub contract** to
`.boldash/workflows/<name>/done.schema.json` (plus `manifest.json`).
Runnable `command` / `command_fails` checks are never copied; only
side-effect-free checks travel, and the skipped count is reported.
Importing v1-style Markdown workflows lands in MS-8 — this command only
reads JSON.

**Exit codes:** 0, 2, 3.

### `boldash workflow validate <name>`

```bash
boldash workflow validate feature
```

Validates a workflow's registry entry: structural integrity, then
mandatory-capability satisfiability on the generic host. On-disk pack
files are validated at import; the registry stays the typed built-ins
until MS-8.

**Exit codes:** 0, 2, 3.

---

## `boldash worktree` (planned, v0.3.0)

Manage isolated worktrees for parallel agents.

```bash
boldash worktree create TASK-001 --branch boldash/task-001
boldash worktree list
boldash worktree remove TASK-001
```

**Exit codes:** 0, 2, 4.

---

## Environment Variables

| Variable            | Purpose                                |
| ------------------- | -------------------------------------- |
| `BOLDASH_HOME`      | Override default `.boldash/` location. |
| `BOLDASH_PROFILE`   | Override profile.                      |
| `BOLDASH_HOST`      | Override host detection.               |
| `BOLDASH_FORMAT`    | Default output format.                 |
| `BOLDASH_LOG_LEVEL` | `debug`, `info`, `warn`, `error`.      |
| `BOLDASH_NO_COLOR`  | Disable ANSI colors.                   |

---

## See Also

- [`docs/errors.md`](./errors.md) — full error code catalog.
- [`docs/state-model.md`](./state-model.md) — canonical state.
- [`docs/routing-contract.md`](./routing-contract.md) — route schema.
- [`docs/verification-guide.md`](./verification-guide.md) — writing `done.schema.json`.
