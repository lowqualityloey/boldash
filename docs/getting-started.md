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
npx boldash doctor
```

This detects your host, probes capabilities, and reports what will and will not be enforceable.

---

## Initialize

Run this at the root of your repository:

```bash
npx boldash init
```

You will see output like:

```
Boldash init
────────────────────────────────────────
✓ Detected host: Claude Code
✓ Probed capabilities:
    filesystem.read    ✓
    filesystem.write   ✓
    shell.execute      ✓
    git.read           ✓
    git.commit         ✓
    git.worktree       ✓
    mcp                ✓
    subagents          ✓
    human_approval     ✓
    pre_tool_hooks     ✓
✗ Missing:
    (none)

✓ Created .boldash/config.yaml
✓ Created .boldash/state/project.json
✓ Created .boldash/state/tasks.json
✓ Created .boldash/evidence/
✓ Created .boldash/events.jsonl
✓ Installed Claude adapter

Profile: balanced (default)

Boldash is ready. Next: `boldash state list`
```

### What was created

```
.boldash/
├── config.yaml              # Your configuration
├── state/
│   ├── project.json         # Project metadata
│   └── tasks.json           # Task list (empty)
├── evidence/                # Evidence store (empty)
└── events.jsonl             # Event log (empty)
```

These files travel with your repository. Commit them.

### What was installed into your repo

Depending on your host, Boldash writes a briefing file:

- Claude Code → `CLAUDE.md` (a single line pointing to Boldash)
- Cursor → `.cursor/rules/boldash.mdc`
- Antigravity → `.antigravity/rules/boldash.md`
- Generic → `AGENTS.md`

If you already have a briefing file, Boldash appends rather than overwrites.

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

Output:

```
Boldash Verification: TASK-001
────────────────────────────────────────
✓ R1 implemented   (file src/auth/callback.ts exists)
✓ R2 implemented   (regex matched in callback.ts)
✓ R3 implemented   (test oauth_callback passed)
✓ No secrets       (secret scan passed)
✓ Tree clean       (git status --porcelain empty)

STATUS: VERIFIED
Exit code: 0
```

If something is missing:

```
✗ R3 not implemented  (test oauth_callback not found)
✗ Review missing      (evidence review-77 required)

STATUS: BLOCKED
Exit code: 1
```

The task cannot move to `complete` until verification returns `VERIFIED`.

### What blocks what

With the `balanced` profile and a Claude Code host, verification is enforced _before commit_:

```
Agent: "git commit -m '...'"
         ↓
Claude pre-tool hook runs `boldash verify TASK-001`
         ↓
Exit code 1 → commit is blocked
```

On hosts without pre-tool hooks, verification is advisory. `boldash doctor` warns about this.

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

Boldash falls back to the `generic` adapter. Add `--host <name>` to override detection, or configure in `.boldash/config.yaml`.

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

Check `boldash doctor`. If your host lacks `pre_tool_hooks`, enforcement is advisory. The agent may skip Boldash. This is a host limitation, not a Boldash bug.
