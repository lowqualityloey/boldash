# Getting Started

> **Status:** Specification for v0.1.0. Boldash is not yet installable.
> **Audience:** New users.
> **Prerequisites:** Node.js 20 LTS or later, Git, an AI coding agent (Claude Code, Cursor, Antigravity, Codex, or Gemini CLI).

---

## Table of Contents

- [What You Will Do](#what-you-will-do)
- [Install](#install)
- [Initialize](#initialize)
- [Your First Task](#your-first-task)
- [Your First Verification](#your-first-verification)
- [Reading the State](#reading-the-state)
- [Understanding the Output](#understanding-the-output)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## What You Will Do

In the next ten minutes you will:

1. Initialize Boldash in an existing repository.
2. Create your first task.
3. Propose and validate a route.
4. Transition the task through its lifecycle.
5. Run verification and read the result.

You do not need to know the full architecture. You only need three commands: `init`, `state`, `verify`.

---

## Install

Boldash is distributed via npm.

```bash
npm install --save-dev boldash
# or
npx boldash --version
```

**Requirements:**

- Node.js 20 LTS or later
- Git 2.30 or later
- A host agent with filesystem and shell access

**Optional:**

- `gh` CLI if you want GitHub evidence capture
- MCP server support for richer host integration

If you are unsure whether your environment is ready:

```bash
npx boldash init --format json
```

Its envelope lists the adapter, the probed capabilities, and any warnings —
that is the readiness report in v0.1.0. `boldash doctor` (interactive
diagnosis, `--fix`) is specified in
[`docs/cli-reference.md`](./cli-reference.md) but deferred past v0.1.0.

---

## Initialize

Run this at the root of your repository:

```bash
npx boldash init
```

You will see output like:

```
✓ ok
initialized: true
path: /your/repo/.boldash
profile: balanced
adapter: generic
capabilities:
  filesystem.read
  filesystem.write
  shell.execute
  git.read
  human_approval
warnings:
  HOST_UNKNOWN
  ADVISORY_MODE
created:
  state/tasks.json
  events.jsonl
  state/project.json
  state/decisions.json
  state/evidence.json
  config.yaml
briefing: {"path":"/your/repo/AGENTS.md","skipped":false}
```

### What was created

```
.boldash/
├── config.yaml              # Your configuration (template; core never parses YAML)
├── state/
│   ├── project.json         # Project metadata
│   ├── tasks.json           # Task list (empty)
│   ├── decisions.json       # Decision log (empty)
│   └── evidence.json        # Evidence index (empty)
├── evidence/                # Evidence store (empty)
└── events.jsonl             # Event log (empty)
```

`AGENTS.md` is written next to `.boldash/` — see
[What was installed into your repo](#what-was-installed-into-your-repo).

No workflow packs are written in v0.1.0: the pack format lands in MS-8, and
`.boldash/workflows/` appears on first `workflow import`. These files travel
with your repository. Commit them.

### What was installed into your repo

v0.1.0 ships the `generic` adapter, and it writes one briefing file:

- Generic → `AGENTS.md`

The block is delimited by `<!-- BOLDASH_START -->` / `<!-- BOLDASH_END -->`.
Writing is append-only and idempotent: an existing `AGENTS.md` is preserved
byte-for-byte and the block is appended after it, so other tools' marker
blocks — PromptKit's, for example — survive untouched. If the block is already
present, `init` reports `briefing.skipped: true` and writes nothing.

Host-specific briefings are deferred past v0.1.0, with their adapters:

- Claude Code → `CLAUDE.md` (deferred)
- Cursor → `.cursor/rules/boldash.mdc` (deferred)
- Antigravity → `.antigravity/rules/boldash.md` (deferred)

### Choosing a profile

The default is `balanced`. Other options:

```bash
npx boldash init --profile lite
npx boldash init --profile strict
npx boldash init --profile accelerated
```

| Profile       | Behavior                                                       |
| ------------- | -------------------------------------------------------------- |
| `lite`        | Minimal ceremony. Verification is basic. Evidence is off.      |
| `balanced`    | Risk-based ceremony. Full verification. Evidence on.           |
| `strict`      | Strict policy. Human approval for high-risk tasks. Full audit. |
| `accelerated` | Relaxed for low-risk. Full verification for high-risk.         |

You can change the profile later in `.boldash/config.yaml`.

---

## Your First Task

Ask your agent to propose a route. For example, in Claude Code:

> "Add OAuth callback handling. Route it with Boldash."

The agent will produce a structured route proposal:

```json
{
  "task": {
    "type": "feature",
    "risk": "medium",
    "scope": { "files": ["src/auth/*"], "systems": ["authentication"] },
    "summary": "Handle Google OAuth callback"
  },
  "route": {
    "workflow": "feature",
    "level": 2
  }
}
```

Boldash validates it:

```bash
npx boldash route --input route.json
```

Success:

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

If the proposal is invalid, Boldash returns a structured error:

```json
{
  "ok": false,
  "error": {
    "code": "LEVEL_RISK_MISMATCH",
    "message": "Risk 'high' requires level 3, but level 2 was proposed.",
    "field": "route.level",
    "suggestion": "Raise level to 3, or lower risk to 'medium'."
  }
}
```

The agent corrects the proposal. No guessing.

### The task is created

Boldash creates a task ID:

```
TASK-001
```

You can view it:

```bash
npx boldash state get TASK-001
```

---

## Your First Verification

Suppose the agent has implemented the feature, written tests, and recorded evidence. The task is now in `verifying`.

Run:

```bash
npx boldash verify TASK-001
```

`verify` answers with the envelope. Success:

```
✓ ok
task: TASK-001
status: VERIFIED
checks:
  {"name":"present file","type":"file_exists","pass":true,"detail":"found present.txt"}
```

Exit code: 0.

When a check fails the command exits 1, and the failing check names travel in
the envelope (`error.context.failed_checks`) — passing checks and their detail
are in `data.checks`:

```
✗ VERIFY_BLOCKED: Verification failed: 1 checks did not pass.
  field: verify
  → Run `boldash state get TASK-001` to see missing evidence.
```

Exit code: 1. Add `--format json` for the machine-readable envelope:

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_BLOCKED",
    "message": "Verification failed: 1 checks did not pass.",
    "field": "verify",
    "context": { "task": "TASK-001", "failed_checks": ["missing file"] },
    "suggestion": "Run `boldash state get TASK-001` to see missing evidence."
  }
}
```

The task cannot move to `complete` until verification returns `VERIFIED`.

### What blocks what

v0.1.0 enforces nothing automatically. The only shipped adapter is `generic`,
which provides no `pre_tool_hooks`, so `init` reports `ADVISORY_MODE` and
verification is advisory: Boldash warns, logs, and reports, but nothing stops
the agent from committing. Pre-tool hook enforcement arrives with the host
adapters.

`verify` does not move the task either — it logs a `verify.run` event. The
transition is explicit:

```bash
npx boldash state transition TASK-001 complete
```

---

## Reading the State

```bash
npx boldash state list
```

```
ID        STATUS        RISK      TYPE      TITLE
TASK-001  verifying     medium    feature   Handle Google OAuth callback
TASK-002  planned       low       chore     Add CI cache step
```

```bash
npx boldash state get TASK-001
```

```json
{
  "id": "TASK-001",
  "title": "Handle Google OAuth callback",
  "status": "verifying",
  "type": "feature",
  "risk": "medium",
  "version": 4,
  "requirements": [
    { "id": "R1", "status": "implemented", "evidence": ["evt_9281"] },
    { "id": "R2", "status": "implemented", "evidence": ["evt_9282"] },
    { "id": "R3", "status": "implemented", "evidence": ["evt_9381"] }
  ]
}
```

Markdown projections are regenerated under `docs/`:

```
docs/STATE.md
docs/tasks/TASK-001.md
```

Do not edit these by hand. They are generated.

---

## Understanding the Output

| Output             | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `✓`                | Check passed.                                     |
| `✗`                | Check failed. Verification will return `BLOCKED`. |
| `STATUS: VERIFIED` | All checks passed. Exit code 0.                   |
| `STATUS: BLOCKED`  | At least one check failed. Exit code 1.           |
| `Exit code: 0`     | Success.                                          |
| `Exit code: 1`     | Verification failed.                              |
| `Exit code: 2`     | Invalid input.                                    |
| `Exit code: 3`     | Missing capability.                               |
| `Exit code: 4`     | Concurrency conflict.                             |
| `Exit code: 12`    | Verification command timed out.                   |

Full exit code reference: [`docs/errors.md`](./errors.md).

---

## Next Steps

- **Read the state model.** [`docs/state-model.md`](./state-model.md) explains what lives in `.boldash/state/` and why.
- **Learn the CLI.** [`docs/cli-reference.md`](./cli-reference.md) lists every command.
- **Write a verification contract.** [`docs/verification-guide.md`](./verification-guide.md) shows how.
- **Understand routing.** [`docs/routing-contract.md`](./routing-contract.md) explains the schema.
- **Migrate from v1.** [`docs/migration-from-v1.md`](./migration-from-v1.md) if you used PromptKit OS.

---

## Troubleshooting

### `boldash init` says the host is unknown

`HOST_UNKNOWN` is a warning, not an error: `init` always wires the `generic`
adapter in v0.1.0 and exits 0. The warning names the host it recognized, if
any. Passing `--host generic` suppresses it.

Per-host adapters do not exist yet, so `--host` accepts `generic` only —
anything else is `CLI_USAGE` (exit 2). To name the host yourself, set
`BOLDASH_HOST`.

### Verification passes but the code is wrong

Boldash verifies _evidence exists_. It does not judge code quality. If your `done.schema.json` is too weak, it will pass weak work. See [`docs/verification-guide.md`](./verification-guide.md) for how to write meaningful checks.

### A commit is blocked but I do not know why

Run:

```bash
npx boldash policy check git.commit --task TASK-001
npx boldash explain TASK-001
```

The first tells you which rule blocked. The second shows the evidence graph.

### My state file changed after a `git pull`

`.boldash/state/*.json` is committed. Concurrent edits can conflict. Resolve them the same way you resolve any merge conflict. Boldash validates the result on next `state get`.

### Everything feels too ceremonial

Switch to `lite`:

```bash
npx boldash init --profile lite
```

Or disable a specific workflow in `.boldash/config.yaml`.

### Everything is too loose

Switch to `strict`:

```bash
npx boldash init --profile strict
```

### The agent ignores Boldash

Expected on a generic host: there are no `pre_tool_hooks`, so enforcement is
advisory and the agent may skip Boldash. This is a host limitation, not a
Boldash bug. `boldash doctor` will report this per host once host adapters
land; today `boldash init --format json` lists the probed capabilities and
warnings.
