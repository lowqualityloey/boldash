# ARCHITECTURE.md

> **Boldash** is the deterministic control plane for AI coding agents.
> It sits between the agent and the project, validating routes, enforcing policy, tracking state, and verifying completion.
>
> **Predecessor:** [`lowqualityloey/promptkit-os`](https://github.com/lowqualityloey/promptkit-os) (v1)
> **Status:** Design draft
> **Last updated:** 2026-09-14

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Core Principles](#2-core-principles)
3. [Non-Goals](#3-non-goals)
4. [System Overview](#4-system-overview)
5. [Layer 1: Host Adapters](#5-layer-1-host-adapters)
6. [Layer 2: Boldash Core](#6-layer-2-boldash-core)
7. [Layer 3: Project State](#7-layer-3-project-state)
8. [Data Model](#8-data-model)
9. [CLI Surface](#9-cli-surface)
10. [Workflow Model](#10-workflow-model)
11. [Profiles](#11-profiles)
12. [Security Model](#12-security-model)
13. [Token Efficiency Design](#13-token-efficiency-design)
14. [Multi-Agent Design](#14-multi-agent-design)
15. [Repository Layout](#15-repository-layout)
16. [Development Roadmap](#16-development-roadmap)
17. [Testing Strategy](#17-testing-strategy)
18. [Open Questions](#18-open-questions)
19. [Glossary](#19-glossary)
20. [Appendix A — Relationship to PromptKit OS v1](#appendix-a--relationship-to-promptkit-os-v1)
21. [Appendix B — The One-Sentence Summary](#appendix-b--the-one-sentence-summary)

---

## 1. Purpose

Boldash exists because prompt-based agent frameworks cannot enforce their own rules.

v1 (PromptKit OS) defines *how an agent should behave* using Markdown protocols. This works until you need a guarantee. An LLM reading a Markdown file that says "run tests before committing" is not the same as a system that blocks the commit when tests fail.

Boldash is the deterministic layer that turns protocol into enforcement.

**The one-sentence version:**

> **The LLM proposes. Boldash validates, enforces, records, and verifies.**

---

## 2. Core Principles

These principles are non-negotiable. Every design decision must be traceable to one of them.

### P1 — Separation of intelligence and enforcement

The LLM reasons, plans, and writes code. Boldash coordinates, validates, enforces, and records. These responsibilities never cross.

### P2 — Canonical state is machine-readable

Markdown is a human-facing *projection*, never the source of truth. Canonical state lives in JSON. Any workflow that requires the LLM to infer relationships between Markdown files is architecturally wrong.

### P3 — Deterministic work belongs outside the LLM

If a check can be expressed as code, it must not be expressed as a prompt. Token spend is reserved for tasks that require reasoning.

### P4 — Every gate must return an exit code

A gate that cannot block execution is not a gate. It is a suggestion. Boldash gates return non-zero exit codes that host adapters can enforce.

### P5 — Zero ceremony for trivial work

If a task is a one-line rename, Boldash should be invisible. Risk determines ceremony. Ceremony must not exceed the risk of the work.

### P6 — Local-first, Git-native, no daemon

State is files. Evidence is files. Logs are files. Everything lives in the repository and travels with it. No background services, no databases, no cloud dependency.

### P7 — Model-agnostic

Boldash must not assume a specific model's behavior, output format, or capability. All model output is validated against schemas before it is trusted.

### P8 — Graceful degradation

If Boldash is unavailable, the agent continues to work with reduced guarantees. Boldash enhances agents; it does not imprison them.

### P9 — The runtime may be complex; the LLM interface must be tiny

Internal machinery can be elaborate. The surface the LLM sees — schemas, commands, errors — must fit in a few hundred tokens.

### P10 — Every decision must be explainable

`boldash explain` must be able to answer "why is this task blocked?" or "why does Boldash think this is complete?" with a traceable chain of evidence. If a decision cannot be explained, the design is wrong.

---

## 3. Non-Goals

Boldash explicitly does **not** attempt to:

- **Replace the LLM.** Boldash does not generate code, write specs, or reason about design.
- **Replace the host IDE or agent.** Boldash does not provide an editor, a chat interface, or a reasoning engine.
- **Provide a GUI.** The CLI is the interface. Markdown projections are the human-facing output.
- **Provide a SaaS.** Boldash is local-first. Cloud is out of scope for the core.
- **Be a general-purpose workflow engine.** Boldash is specifically for AI coding agents. It is not Airflow, Temporal, or n8n.
- **Be a full policy language.** Policy rules are simple, declarative, and scoped. Boldash is not OPA or Cedar.
- **Provide a runtime sandbox.** Boldash validates commands; it does not sandbox the shell. Sandboxing is the host's responsibility.
- **Guarantee correctness of code.** Boldash verifies that *evidence exists*. Whether the code is *good* is a human judgment.

---

## 4. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST LAYER                                     │
│                                                                             │
│   Claude Code    Cursor    Antigravity    Codex    Gemini CLI    Generic    │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Host-specific hooks, briefing files,
                                   │  capability probes
                                   │
                    ┌──────────────▼──────────────┐
                    │      HOST ADAPTER LAYER      │
                    │                              │
                    │  Translates Boldash          │
                    │  capabilities into host-     │
                    │  native features and back    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        BOLDASH CORE          │
                    │                              │
                    │  ┌────────────────────────┐  │
                    │  │   Router               │  │  Validates LLM route
                    │  ├────────────────────────┤  │  proposals against schema
                    │  │   State Engine         │  │  and policy.
                    │  ├────────────────────────┤  │
                    │  │   Policy Engine        │  │  Canonical JSON state +
                    │  ├────────────────────────┤  │  Markdown projection.
                    │  │   Capability Manager   │  │
                    │  ├────────────────────────┤  │  Evaluates YAML rules
                    │  │   Verification Engine  │  │  against state.
                    │  ├────────────────────────┤  │
                    │  │   Workflow Registry    │  │  Matches workflow
                    │  ├────────────────────────┤  │  requirements to host
                    │  │   Evidence / Event Log │  │  capabilities.
                    │  └────────────────────────┘  │
                    │                              │  Runs gates, returns
                    └──────────────┬───────────────┘  PASS/BLOCK.
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
     │  LLM Layer   │    │ Deterministic│    │  Project     │
     │              │    │  Layer       │    │  State       │
     │  reasoning   │    │              │    │              │
     │  planning    │    │  validators  │    │  .boldash/   │
     │  coding      │    │  gates       │    │    state/    │
     │  synthesis   │    │  schema      │    │    evidence/ │
     │              │    │  checks      │    │    events    │
     └──────────────┘    └──────────────┘    └──────────────┘
```

### 4.1 Request Lifecycle

A single unit of work flows through Boldash as follows:

```
1. User request
       │
       ▼
2. LLM proposes a route (JSON)
       │
       ▼
3. Boldash Router validates the route
       │
       ├─ Invalid → structured error → LLM corrects → back to 2
       │
       ▼
4. Boldash Capability Manager checks workflow requirements
       │
       ├─ Missing capability → error → LLM or user adjusts
       │
       ▼
5. Boldash loads the workflow protocol
       │
       ▼
6. LLM executes the work (writes code, specs, tests)
       │
       ▼
7. LLM proposes state transitions and evidence
       │
       ▼
8. Boldash State Engine applies transitions (with locking)
       │
       ▼
9. User or agent runs `boldash verify <task>`
       │
       ▼
10. Verification Engine runs gates → PASS or BLOCK
       │
       ├─ BLOCK → structured error → back to 6
       │
       ▼
11. Host adapter enforces commit/release gate
       │
       ▼
12. Event log records the full chain
```

Every step in this lifecycle is deterministic except steps 2 and 6, which are the LLM's domain.

---

## 5. Layer 1: Host Adapters

### 5.1 Purpose

Host adapters translate Boldash's abstract capabilities into host-native features. They are the *only* place where Boldash knows about a specific agent host.

### 5.2 Adapter Interface

Every adapter implements this interface:

```typescript
interface HostAdapter {
  /** Adapter identifier, e.g. "claude", "cursor", "generic" */
  readonly name: string;

  /** Capabilities this host provides. Populated by probing or declared statically. */
  readonly capabilities: CapabilitySet;

  /** Called once during `boldash init`. Writes host-specific briefing files. */
  install(projectRoot: string): Promise<InstallResult>;

  /** Called during `boldash doctor`. Verifies the host is still healthy. */
  diagnose(projectRoot: string): Promise<DiagnosticResult>;

  /**
   * Register a hook that runs before a host tool executes.
   * Returns false to block the tool.
   * Hosts without hook support return a no-op.
   */
  onBeforeTool(tool: string, handler: PreToolHandler): void;

  /**
   * Register a hook that runs after a host tool executes.
   * Used for evidence capture.
   */
  onAfterTool(tool: string, handler: PostToolHandler): void;

  /** Returns true if the host supports the named capability. */
  hasCapability(name: string): boolean;
}
```

### 5.3 Adapter Capability Matrix

| Capability | Claude | Cursor | Antigravity | Codex | Gemini | Generic |
|---|---|---|---|---|---|---|
| `filesystem.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `filesystem.write` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `shell.execute` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `git.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `git.commit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `git.branch` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `git.worktree` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `github` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `mcp` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| `subagents` | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `human_approval` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pre_tool_hooks` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `post_tool_hooks` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

A host that lacks `pre_tool_hooks` cannot *block* a commit. For these hosts, Boldash's enforcement is advisory — it can warn, log, and report, but it cannot prevent. This limitation must be visible to the user during `boldash init`.

### 5.4 Adapter Failure Modes

| Failure | Behavior |
|---|---|
| Host binary not found | Fall back to `generic` adapter; warn user. |
| Capability probe inconclusive | Assume the capability is unavailable; require user confirmation to enable. |
| Hook registration fails | Log warning; continue without enforcement; mark project as "advisory mode." |
| Host version change breaks adapter | Adapter returns `DIAGNOSTIC_FAILED`; user is prompted to upgrade Boldash. |

---

## 6. Layer 2: Boldash Core

The core is composed of six engines. Each engine has a single responsibility.

### 6.1 Router

**Responsibility:** Validate the LLM's proposed route against schema and policy.

**Inputs:**
- A JSON route proposal from the LLM
- The project's canonical state
- The workflow registry

**Outputs:**
- A validated `ResolvedRoute` object, or a structured error

**Route proposal schema (`schemas/route.schema.json`):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Boldash Route Proposal",
  "type": "object",
  "additionalProperties": false,
  "required": ["task", "route"],
  "properties": {
    "task": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "risk", "scope"],
      "properties": {
        "type": {
          "enum": ["bugfix", "feature", "refactor", "migration",
                   "security", "architecture", "docs", "chore"]
        },
        "risk": {
          "enum": ["trivial", "low", "medium", "high", "critical"]
        },
        "scope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "files":   { "type": "array", "items": { "type": "string" } },
            "systems": { "type": "array", "items": { "type": "string" } }
          }
        },
        "summary": { "type": "string", "maxLength": 200 }
      }
    },
    "route": {
      "type": "object",
      "additionalProperties": false,
      "required": ["workflow", "level"],
      "properties": {
        "workflow": { "type": "string" },
        "level":    { "type": "integer", "minimum": 0, "maximum": 3 },
        "requirements": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "task_record":     { "type": "boolean" },
            "specification":   { "type": "boolean" },
            "tests":           { "type": "boolean" },
            "review":          { "type": "boolean" },
            "human_approval":  { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

**Validation pipeline:**

```
1. Parse JSON               → malformed? → error SCHEMA_PARSE
2. Validate against schema  → invalid?   → error SCHEMA_VALIDATION (with field path)
3. Check workflow exists    → missing?   → error WORKFLOW_NOT_FOUND
4. Check level vs. risk     → mismatch?  → error LEVEL_RISK_MISMATCH
5. Check required capabilities → missing? → error CAPABILITY_MISSING
6. Check scope files exist  → missing?   → error SCOPE_FILE_NOT_FOUND (warning for greenfield)
7. Emit ResolvedRoute
```

**Error format (returned to the LLM):**

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_MISSING",
    "message": "Workflow 'migration' requires 'subagents', which this host does not provide.",
    "field": "route.workflow",
    "suggestion": "Use the 'refactor' workflow, or switch to a host with subagent support."
  }
}
```

Every error is structured. The LLM does not need to parse prose.

### 6.2 State Engine

**Responsibility:** Maintain canonical project state, apply transitions with locking, and generate Markdown projections.

**Canonical state files (in `.boldash/state/`):**

| File | Contents |
|---|---|
| `project.json` | Project metadata, config reference, active profile |
| `tasks.json` | All tasks and their current state |
| `decisions.json` | Architectural decisions (ADR-like) |
| `evidence.json` | Evidence index (references to files in `evidence/`) |

**State transition rules:**

```
proposed  → planned      (requires: requirements defined)
planned   → implementing (requires: task_record complete)
implementing → verifying (requires: at least one evidence entry)
verifying → complete     (requires: `boldash verify` returns PASS)
verifying → blocked      (requires: verification BLOCK with reason)
blocked   → implementing (requires: blocking reason resolved)
any       → failed       (allowed; recorded as terminal)
```

Invalid transitions return `STATE_INVALID_TRANSITION` with the list of allowed next states.

**Optimistic locking:**

Every task carries a `version` integer. On transition:

```
1. Read task, note version V.
2. Validate transition.
3. Increment version to V+1.
4. Write atomically (temp file + rename).
5. If write fails because V changed concurrently → retry or fail with CONCURRENT_MODIFICATION.
```

**Markdown projection:**

When canonical state changes, Boldash regenerates:

- `docs/STATE.md` — project-wide summary
- `docs/tasks/<task-id>.md` — per-task view

Projection files start with a warning header:

```
<!-- GENERATED BY BOLDASH. DO NOT EDIT. -->
<!-- Source of truth: .boldash/state/tasks.json -->
```

If a projection file is edited by hand, `boldash doctor` detects the divergence and warns.

### 6.3 Policy Engine

**Responsibility:** Evaluate machine-readable rules before permitting actions.

**Policy file (`policies/default.yaml`):**

```yaml
version: 1

rules:
  - id: commit-requires-verification
    action: git.commit
    requires:
      - "state.task.status == 'verifying'"
      - "verification.all_requirements_verified == true"
      - "git.working_tree_clean == true"
    block_message: "Cannot commit: requirements not verified or working tree dirty."

  - id: migration-requires-rollback
    action: workflow.migration.execute
    requires:
      - "evidence.exists('rollback-test') == true"
    applies_when:
      - "state.task.risk in ['high', 'critical']"
    block_message: "Migration requires rollback evidence for high/critical risk."

  - id: release-requires-human-approval
    action: git.release
    requires:
      - "human_approval.recorded == true"
    applies_when:
      - "state.task.risk in ['high', 'critical']"
    block_message: "Release requires human approval for high/critical risk tasks."
```

**Evaluation contract:**

- Rules are pure functions of state.
- Rules never mutate state.
- Rules are evaluated in declaration order.
- The first failing rule blocks the action; subsequent rules are not evaluated.

**Policy engine scope:**

The policy engine supports a deliberately small expression language:

- Boolean operators: `and`, `or`, `not`
- Comparisons: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Membership: `in`, `not in`
- Path access: `state.task.status`, `evidence.exists('name')`
- No user-defined functions, no loops, no side effects

This is not a general-purpose language. It is intentionally constrained.

### 6.4 Capability Manager

**Responsibility:** Match workflow requirements to the active host's capabilities.

**Workflow requirement declaration (in `workflows/<name>/manifest.yaml`):**

```yaml
workflow: migration
version: 1
lifecycle: BUILD
requires:
  - filesystem.read
  - filesystem.write
  - git.read
  - git.commit
  - shell.execute
  - subagents
optional:
  - github
  - mcp
```

**Matching algorithm:**

```
1. Load active host capabilities.
2. Load workflow requirements.
3. For each required capability:
     if not provided → record as missing
4. If any required capability is missing:
     return CAPABILITY_MISSING with the list
5. Return OK.
```

**Capability detection during `boldash init`:**

```
1. Identify host from environment variables and directory markers.
2. Load the matching adapter.
3. Probe each capability using adapter-specific checks.
4. Write capabilities to `.boldash/state/project.json`.
5. Warn about capabilities that are not available.
```

### 6.5 Verification Engine

**Responsibility:** Run deterministic gates against the canonical state and evidence. Return PASS or BLOCK with a non-zero exit code on failure.

**Verification contract (`workflows/<name>/done.schema.json`):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Boldash Verification Contract",
  "type": "object",
  "required": ["task_id", "must_pass"],
  "properties": {
    "task_id": { "type": "string" },
    "must_pass": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "name"],
        "properties": {
          "type": {
            "enum": ["file_exists", "command", "regex_in_file",
                     "state_check", "evidence_exists"]
          },
          "name":        { "type": "string" },
          "path":        { "type": "string" },
          "run":         { "type": "string" },
          "pattern":     { "type": "string" },
          "check":       { "type": "string" }
        }
      }
    },
    "must_not": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "name"],
        "properties": {
          "type": { "enum": ["file_not_modified", "command_fails"] },
          "name": { "type": "string" },
          "path": { "type": "string" },
          "run":  { "type": "string" }
        }
      }
    }
  }
}
```

**Execution:**

```
for each check in must_pass:
    run check
    if fails: record BLOCK with reason; continue collecting
for each check in must_not:
    run check
    if fails: record BLOCK with reason
if any BLOCK recorded: return BLOCK with exit code 1
else: return PASS with exit code 0
```

**Output format (human):**

```
Boldash Verification: TASK-42
────────────────────────────────────────
✓ R1 implemented  (file src/auth/callback.ts exists)
✓ R2 implemented  (regex matched in callback.ts)
✓ R3 implemented  (test oauth_callback passed)
✓ No secrets      (secret scan passed)
✓ Tree clean      (git status --porcelain empty)
✓ Review complete (evidence review-77 exists)

STATUS: VERIFIED
Exit code: 0
```

**Output format (JSON, for agents):**

```json
{
  "ok": true,
  "task_id": "TASK-42",
  "status": "VERIFIED",
  "checks": [
    { "name": "R1", "type": "file_exists", "ok": true },
    { "name": "R2", "type": "regex_in_file", "ok": true },
    { "name": "R3", "type": "command", "ok": true },
    { "name": "secrets", "type": "command", "ok": true },
    { "name": "tree", "type": "state_check", "ok": true },
    { "name": "review", "type": "evidence_exists", "ok": true }
  ]
}
```

### 6.6 Evidence / Event Log

**Responsibility:** Record every meaningful operation in an append-only log, and expose queries over that log.

**Event log location:** `.boldash/events.jsonl` (one JSON object per line).

**Event schema:**

```json
{
  "id": "evt_9281",
  "timestamp": "2026-09-14T10:32:11Z",
  "actor": "agent",
  "task": "TASK-42",
  "type": "TEST_EXECUTED",
  "payload": { "command": "npm test", "exit_code": 0, "duration_ms": 812 }
}
```

**Event types:**

| Type | Emitted by | Payload |
|---|---|---|
| `TASK_CREATED` | Boldash | `{ task_id, type, risk }` |
| `ROUTE_PROPOSED` | Agent | `{ proposal }` |
| `ROUTE_VALIDATED` | Boldash | `{ ok, errors? }` |
| `WORKFLOW_LOADED` | Boldash | `{ workflow, version }` |
| `STATE_TRANSITIONED` | Boldash | `{ task_id, from, to }` |
| `FILE_MODIFIED` | Host adapter | `{ path, hash_before, hash_after }` |
| `TEST_EXECUTED` | Agent or Boldash | `{ command, exit_code, duration_ms }` |
| `CHECKPOINT_CREATED` | Boldash | `{ task_id, snapshot_ref }` |
| `REVIEW_COMPLETED` | Agent | `{ reviewer, verdict }` |
| `VERIFICATION_STARTED` | Boldash | `{ task_id }` |
| `VERIFICATION_PASSED` | Boldash | `{ task_id }` |
| `VERIFICATION_BLOCKED` | Boldash | `{ task_id, reasons[] }` |
| `COMMIT_CREATED` | Host adapter | `{ sha, message }` |
| `PR_CREATED` | Host adapter | `{ number, url }` |
| `RELEASE_CREATED` | Host adapter | `{ tag, url }` |

**Append-only guarantees:**

- Events are never modified.
- Events are never deleted (except by an explicit `boldash evidence prune` with a retention policy).
- Every event has a monotonic `id` and a timestamp.
- The log is a plain text file, safe under Git.

**Query surface:**

```bash
boldash evidence list TASK-42
boldash evidence show evt_9281
boldash evidence export TASK-42 --format md
```

**The `boldash explain` command** builds a traceability graph from the event log:

```
TASK-42
├── Requirement R1 → Implementation I1 → Test T1 → PASS
├── Requirement R2 → Implementation I2 → Test T2 → PASS
└── Risk R3 → Mitigation M1 → Review R4 → APPROVED

Verification: VERIFIED (3/3 requirements, 1/1 risk mitigated)
```

This answers the question *"why does Boldash think this task is complete?"* with actual recorded evidence, not agent prose.

---

## 7. Layer 3: Project State

### 7.1 Layout

Every project that uses Boldash has a `.boldash/` directory at its root:

```
.boldash/
├── config.yaml              # Profile, host, enabled packs
├── state/
│   ├── project.json
│   ├── tasks.json
│   ├── decisions.json
│   └── evidence.json
├── evidence/
│   └── TASK-42/
│       ├── test-run-9381.json
│       └── review-77.json
├── events.jsonl             # Append-only event log
├── locks/                   # Optimistic locking files
└── cache/                   # Regenerable; safe to delete
```

### 7.2 Committed vs. Ignored

| Path | Git status |
|---|---|
| `.boldash/config.yaml` | Committed |
| `.boldash/state/*.json` | Committed |
| `.boldash/evidence/**` | Committed |
| `.boldash/events.jsonl` | Committed |
| `.boldash/locks/**` | Ignored |
| `.boldash/cache/**` | Ignored |

State travels with the repository. A teammate who clones the repo sees the same task state, evidence, and event log.

### 7.3 Atomic Writes

All state mutations use the write-temp-then-rename pattern:

```
1. Write new content to `.boldash/state/tasks.json.tmp`
2. fsync the temp file
3. rename temp file over the original
```

On Windows, rename is not atomic; Boldash uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`.

If the process crashes mid-write, the original file remains intact. The temp file is cleaned up on next startup.

---

## 8. Data Model

### 8.1 Task

```json
{
  "id": "TASK-42",
  "title": "Implement OAuth callback",
  "status": "verifying",
  "type": "feature",
  "risk": "medium",
  "owner": "agent-01",
  "version": 7,
  "parent": "TASK-40",
  "workflow": "feature",
  "lifecycle": "BUILD",
  "requirements": [
    {
      "id": "R1",
      "description": "Handle Google OAuth callback",
      "status": "implemented",
      "evidence": ["evt_9281"]
    },
    {
      "id": "R2",
      "description": "Handle error responses",
      "status": "implemented",
      "evidence": ["evt_9282"]
    }
  ],
  "dependencies": ["TASK-41"],
  "conflicts": [],
  "evidence": ["evt_9281", "evt_9282", "evt_9381"],
  "created_at": "2026-09-14T09:00:00Z",
  "updated_at": "2026-09-14T10:32:11Z"
}
```

### 8.2 Evidence Reference

```json
{
  "id": "evt_9381",
  "task": "TASK-42",
  "kind": "test-run",
  "created_at": "2026-09-14T10:30:00Z",
  "payload_ref": "evidence/TASK-42/test-run-9381.json",
  "summary": "npm test -- --grep oauth_callback: 12 passed, 0 failed"
}
```

### 8.3 Project

```json
{
  "name": "boldash-demo",
  "profile": "balanced",
  "host": "claude",
  "capabilities": {
    "filesystem": { "read": true, "write": true },
    "shell":      { "execute": true },
    "git":        { "read": true, "commit": true, "worktree": true },
    "github":     { "available": true },
    "mcp":        { "available": true },
    "subagents":  { "available": true }
  },
  "workflows_enabled": ["feature", "bugfix", "refactor", "test", "review"],
  "created_at": "2026-09-14T09:00:00Z"
}
```

### 8.4 Decision (ADR)

```json
{
  "id": "ADR-001",
  "title": "Use Node.js for the Boldash CLI",
  "status": "accepted",
  "date": "2026-09-14",
  "context": "Need a runtime that works on Windows, macOS, and Linux.",
  "decision": "Node.js 20 LTS, distributed via npm.",
  "consequences": ["Requires Node on user machines.", "Smaller install than Go."],
  "supersedes": null,
  "superseded_by": null
}
```

---

## 9. CLI Surface

Boldash is driven by a single CLI: `boldash`.

| Command | Purpose | Output |
|---|---|---|
| `boldash init` | Scaffold `.boldash/`, detect host, write config | Human + JSON |
| `boldash doctor` | Diagnose config, host, state, capabilities | Human + JSON |
| `boldash route` | Validate an LLM route proposal | JSON (for agents) |
| `boldash state get <task>` | Read canonical task state | Human + JSON |
| `boldash state list` | List tasks with filters | Human + JSON |
| `boldash state transition <task> <status>` | Apply a state transition | Human + JSON |
| `boldash state evidence add <task> --type <t> --ref <evt>` | Attach evidence | Human + JSON |
| `boldash verify <task>` | Run verification gates | Human + JSON; exit 0/1 |
| `boldash explain <task>` | Traceability graph | Human + JSON |
| `boldash checkpoint <task>` | Snapshot task state | Human + JSON |
| `boldash diff <task>` | State diff since last checkpoint | Human + JSON |
| `boldash evidence list <task>` | List events for a task | Human + JSON |
| `boldash evidence show <evt>` | Show a single event | Human + JSON |
| `boldash policy check <action> --task <task>` | Evaluate policy | Human + JSON |
| `boldash workflow list` | List enabled workflows | Human + JSON |
| `boldash workflow import <path>` | Import a v1 workflow pack | Human + JSON |

### 9.1 Output Contract

Every command supports `--format json`. In JSON mode:

- Success: `{ "ok": true, "data": ... }`
- Failure: `{ "ok": false, "error": { "code": ..., "message": ..., "field": ..., "suggestion": ... } }`

Exit codes:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Verification failed / policy blocked |
| 2 | Invalid input / schema error |
| 3 | Missing capability / host incompatibility |
| 4 | Concurrency conflict |
| 10+ | Internal error |

### 9.2 The Three-Command Minimum

For a minimal adoption, users only need:

- `boldash init`
- `boldash state`
- `boldash verify`

Everything else is optional. This is deliberate.

---

## 10. Workflow Model

### 10.1 Workflow Packs

A workflow is a directory containing:

```
workflows/<name>/
├── manifest.yaml        # Metadata and requirements
├── protocol.md          # LLM-facing instructions (Markdown)
├── done.schema.json     # Verification contract
├── contract.json        # Exit requirements and evidence expectations
└── templates/           # Optional document templates
```

### 10.2 Lifecycle Stages

Workflows are grouped into six lifecycle stages:

```
DISCOVER   → onboard, spike, investigate
PLAN       → architecture, task, specification
BUILD      → implement, debug, refactor
VERIFY     → test, review, security
SHIP       → commit, PR, release
LEARN      → retro, checkpoint
```

The router resolves `intent → lifecycle → workflow → policy → execution`. The LLM does not need to know about every workflow. It only needs to know which lifecycle stage it is in.

### 10.3 Reference Workflow Packs

Boldash ships with a minimal set of reference packs:

| Pack | Lifecycle | Purpose |
|---|---|---|
| `feature` | BUILD | Implement a new feature |
| `bugfix` | VERIFY | Diagnose and fix a bug |
| `refactor` | BUILD | Improve structure without changing behavior |
| `migration` | BUILD | Apply schema or data changes with rollback |
| `test` | VERIFY | Add or improve tests |
| `review` | VERIFY | Review a change against requirements |
| `commit` | SHIP | Commit with evidence |
| `release` | SHIP | Cut a release |

Additional packs can be installed from a registry or imported from v1.

### 10.4 v1 Compatibility

v1 Markdown workflows can be imported:

```bash
boldash workflow import ../promptkit-os/workflows/
```

The importer:

1. Parses each v1 workflow directory.
2. Extracts LLM-facing instructions into `protocol.md`.
3. Generates a default `manifest.yaml` with conservative requirements.
4. Generates a minimal `done.schema.json` (empty `must_pass`).
5. Warns that verification contracts must be authored by the user.

v1 workflows become *content* for Boldash. The protocols survive; the enforcement is added.

---

## 11. Profiles

Profiles are **policy presets**. They do not change the architecture. They change what is required, enforced, and logged.

| Profile | Routing | State | Policy | Verification | Evidence |
|---|---|---|---|---|---|
| **Lite** | Structured | Minimal | Risk-based | Basic | Off |
| **Balanced** | Structured | Full | Risk-based | Full | On |
| **Strict** | Structured | Full | Strict | Full + gates | Full + audit |
| **Accelerated** | Structured | Full | Relaxed for low-risk | Full for high-risk | On |

**`config.yaml` example:**

```yaml
profile: balanced

routing:
  require_structured_proposal: true
  auto_approve_trivial: true

state:
  canonical: json
  markdown_projection: true

verification:
  run_on: [verify, commit, release]
  block_on_failure: true

evidence:
  log_events: true
  retain_days: 90
```

Profiles are declared in the project config, not hardcoded in the runtime. A user can define a custom profile by copying and editing a preset.

---

## 12. Security Model

### 12.1 Threat Model

Boldash runs on a developer's machine, in a repository the developer controls. The threat model assumes:

- The user is trusted.
- The host agent is *semi-trusted* — it may produce incorrect or malicious output.
- The repository may contain untrusted content (e.g., a cloned dependency).
- Boldash must not escalate privileges beyond what the user already has.

### 12.2 Principles

| Principle | Implementation |
|---|---|
| No shell execution without a declared command | Verification contracts must list every command they run. |
| No network by default | Boldash makes no network calls in the core. Adapters may, but only with explicit user consent. |
| No secrets in state | Evidence payloads are scanned for common secret patterns; matches are redacted. |
| No silent state mutation | Every state change is logged as an event. |
| No capability escalation | Boldash never enables a capability the host does not declare. |

### 12.3 Command Execution Rules

When Boldash runs a shell command (e.g., during verification):

1. The command must be declared in the workflow's `done.schema.json`.
2. The command is executed with a timeout (default 300s, configurable).
3. The command's working directory is the project root.
4. The command's stdout/stderr are captured and stored as evidence.
5. The command's exit code determines the check result.
6. Environment variables are inherited, but `BOLDASH_*` variables are set for the child process.

Boldash does **not** provide a sandbox. It relies on the host's execution model and the user's OS. Documented as a non-goal.

### 12.4 Evidence Redaction

Before writing evidence, Boldash scans for:

- AWS keys (`AKIA[0-9A-Z]{16}`)
- GitHub tokens (`gh[pous]_[A-Za-z0-9]{36,}`)
- Private keys (`-----BEGIN [A-Z ]+ PRIVATE KEY-----`)
- Generic high-entropy strings with `secret`, `token`, `password`, `apikey` keys

Matches are replaced with `<redacted:pattern-name>` and the event is flagged `REDACTION_APPLIED`.

### 12.5 Supply Chain

- The CLI is distributed via npm with a signed release.
- Dependencies are pinned.
- `npm audit` runs on every release.
- No post-install scripts.

---

## 13. Token Efficiency Design

### 13.1 Principles

- The LLM sees schemas, not prose.
- The LLM sees summaries, not raw state.
- The LLM sees failures, not the full verification log.
- Deterministic work happens outside the LLM.

### 13.2 Comparative Token Cost

| Operation | v1 (Markdown) | Boldash | Savings |
|---|---|---|---|
| Static briefing | ~881–2,099 | ~400 | ~50% |
| Routing decision | ~1,500 | ~200 (JSON) | ~85% |
| State query | ~2,000 | ~100 (JSON) | ~95% |
| Verification | ~1,000 | ~50 (status) | ~95% |
| Workflow loading | full workflow | protocol + contract | ~30% |

These are targets, not guarantees. They will be validated by the benchmark suite (Section 17).

### 13.3 The One Rule

> **Boldash spends tokens only when intelligence is required. Everything deterministic happens outside the LLM.**

This rule overrides every other consideration in this document.

### 13.4 Model Allocation (Future)

Once routing is structured, Boldash can allocate models by task complexity:

```yaml
model_allocation:
  trivial:    { model: "fast-cheap" }
  low:        { model: "balanced" }
  medium:     { model: "balanced" }
  high:       { model: "strong" }
  critical:   { model: "strong", require_human: true }
```

This is out of scope for v0.1.0. It is listed here because the architecture must not preclude it.

---

## 14. Multi-Agent Design

### 14.1 Scope

v0.1.0 supports single-agent workflows only. Multi-agent support is planned for v0.3.0. This section defines the contract that future versions must implement.

### 14.2 Task Ownership

Every task has an `owner` field. Only the owner may transition the task. Ownership is claimed via:

```bash
boldash state claim TASK-42 --owner agent-01
```

Claims are leases with a TTL (default 30 minutes). If the owner does not renew, the lease expires and the task becomes claimable again.

### 14.3 Concurrency

- State writes use optimistic locking (`version` field).
- Conflicts return `CONCURRENT_MODIFICATION` with the current version.
- The caller may retry, merge manually, or abort.

### 14.4 Subagent Protocol

A parent task may spawn subagent tasks. Each subagent receives:

```yaml
task:
  id: TASK-42-A
  parent: TASK-42
  objective: "Implement OAuth callback"
  scope:
    paths: ["src/auth/*"]
  constraints:
    - "Do not modify database schema"
  output_schema: "schemas/subagent-result.schema.json"
```

A subagent returns:

```json
{
  "status": "completed",
  "summary": "...",
  "files_changed": ["src/auth/callback.ts"],
  "tests": { "passed": ["oauth_callback"] },
  "risks": [],
  "unresolved": []
}
```

The parent consumes the *structured result*, not arbitrary prose. This is the central improvement over v1's subagent concept.

### 14.5 Conflict Detection

Before a subagent task transitions to `verifying`, Boldash checks:

- Are any files modified by this task also modified by an unresolved sibling?
- Does the subagent's result reference a task that has since been updated?

If yes, the transition is blocked with `SIBLING_CONFLICT`.

### 14.6 Worktrees

For parallel work, Boldash can create isolated worktrees:

```bash
boldash worktree create TASK-42-A --branch boldash/task-42-a
```

Worktree lifecycle is managed by Boldash. On task completion, the worktree is either merged (if verification passes) or discarded.

---

## 15. Repository Layout

```
boldash/
├── ARCHITECTURE.md              # This document
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── init.ts
│   │   │   ├── doctor.ts
│   │   │   ├── route.ts
│   │   │   ├── state.ts
│   │   │   ├── verify.ts
│   │   │   ├── explain.ts
│   │   │   ├── checkpoint.ts
│   │   │   ├── diff.ts
│   │   │   ├── evidence.ts
│   │   │   ├── policy.ts
│   │   │   └── workflow.ts
│   │   └── output.ts
│   ├── core/
│   │   ├── router/
│   │   ├── state/
│   │   ├── policy/
│   │   ├── capabilities/
│   │   ├── verification/
│   │   ├── workflow/
│   │   └── evidence/
│   ├── adapters/
│   │   ├── adapter-claude/
│   │   ├── adapter-cursor/
│   │   ├── adapter-antigravity/
│   │   ├── adapter-generic/
│   │   └── adapter-types.ts
│   └── shared/
│       ├── json-schema.ts
│       ├── errors.ts
│       └── constants.ts
├── schemas/
│   ├── route.schema.json
│   ├── state.schema.json
│   ├── task.schema.json
│   ├── evidence.schema.json
│   └── capability.schema.json
├── workflows/
│   ├── feature/
│   ├── bugfix/
│   ├── refactor/
│   ├── migration/
│   ├── test/
│   ├── review/
│   ├── commit/
│   └── release/
├── policies/
│   ├── default.yaml
│   ├── strict.yaml
│   ├── lite.yaml
│   └── accelerated.yaml
├── bench/
│   ├── tasks/
│   ├── runner.ts
│   └── reports/
└── docs/
    ├── architecture.md          # Symlink to ARCHITECTURE.md
    ├── routing-contract.md
    ├── state-model.md
    ├── verification-guide.md
    └── migration-from-v1.md
```

---

## 16. Development Roadmap

### Phase 1 — Foundation (v0.1.0)

**Goal:** Minimal viable runtime. Three commands work end-to-end.

- [ ] Project scaffold (package.json, tsconfig, CI)
- [ ] JSON schemas for route, state, task, evidence
- [ ] `boldash init` — scaffold `.boldash/`, detect host, write config
- [ ] `boldash route` — validate a route proposal
- [ ] `boldash state` — get, list, transition
- [ ] `boldash verify` — run a verification contract
- [ ] Generic adapter (filesystem + shell)
- [ ] v1 workflow import (basic parser)
- [ ] Test suite for schemas and state transitions

**Exit criteria:** A user can initialize a project, propose a route, transition a task, and verify it — all from the CLI.

### Phase 2 — Policy & Capabilities (v0.2.0)

- [ ] Policy engine with YAML rules
- [ ] Capability manager and host detection
- [ ] Claude adapter with pre-tool hooks
- [ ] `boldash doctor`
- [ ] `boldash explain`
- [ ] `boldash policy check`

**Exit criteria:** A Claude Code user has commit gates enforced by Boldash.

### Phase 3 — Evidence & Multi-Agent (v0.3.0)

- [ ] Event log (`events.jsonl`)
- [ ] Evidence storage and references
- [ ] Subagent protocol with result schemas
- [ ] Task ownership and leases
- [ ] Conflict detection
- [ ] `boldash checkpoint` and `boldash diff`
- [ ] Cursor adapter

**Exit criteria:** Two agents can work on sibling tasks without clobbering each other's state.

### Phase 4 — Ecosystem (v0.4.0+)

- [ ] Antigravity adapter
- [ ] Workflow pack registry
- [ ] Benchmark suite with published results
- [ ] Plugin API for custom adapters
- [ ] Documentation site

**Exit criteria:** A third party can publish a workflow pack and a host adapter.

---

## 17. Testing Strategy

### 17.1 Layers

| Layer | What it tests | Tooling |
|---|---|---|
| **Unit** | Schema validation, state transitions, policy evaluation | Vitest or Node test runner |
| **Contract** | Adapter interface conformance | A shared test suite every adapter must pass |
| **Integration** | End-to-end flows: init → route → state → verify | Fixture repositories |
| **Benchmark** | Token usage, wall-clock time, retries | `bench/runner.ts` against fixed tasks |

### 17.2 The Benchmark Suite

Boldash must be able to demonstrate its own value. The benchmark suite is a first-class deliverable, not an afterthought.

**Design:**

- 50–100 tasks across categories: bugfix, feature, refactor, migration, security, docs.
- Each task is run twice: baseline (agent only) vs. Boldash (agent + Boldash).
- Metrics captured:
  - LLM tokens (input + output)
  - Wall-clock time
  - Tool calls
  - Retries
  - Human interventions
  - Test pass rate
  - Final correctness (binary, judged by a fixed evaluator)
  - **Engineering cost per verified task** (the primary metric)

**Published output:** A markdown report committed to `bench/reports/` on every release. If Boldash cannot demonstrate improvement, the release is paused and the design is revisited.

### 17.3 Continuous Integration

Every PR runs:

1. Lint
2. Type check
3. Unit tests
4. Contract tests for adapters
5. Integration tests against fixture repos
6. `npm audit`

Every release additionally runs:

1. The full benchmark suite
2. Cross-platform tests (Linux, macOS, Windows)
3. A dry-run publish to a staging registry

---

## 18. Open Questions

These are unresolved. They must be answered before the corresponding phase ships.

| # | Question | Phase |
|---|---|---|
| 1 | Should state be one file per task or a single `tasks.json`? Single file is simpler; per-file scales better. | Phase 1 |
| 2 | Should policy rules be pure YAML or allow a restricted expression language? Current draft uses a constrained string grammar. | Phase 2 |
| 3 | How should `boldash` behave when the host lacks pre-tool hooks? Advisory mode is the current answer, but the user experience needs definition. | Phase 2 |
| 4 | Should evidence be stored inline in `events.jsonl` or as separate files referenced by the event? Current draft uses separate files. | Phase 3 |
| 5 | What is the retention policy for evidence in long-lived projects? | Phase 3 |
| 6 | Should Boldash ship a hosted registry for workflow packs, or is GitHub the registry? | Phase 4 |
| 7 | How does Boldash handle monorepos with multiple projects? | Phase 4 |

---

## 19. Glossary

| Term | Definition |
|---|---|
| **Adapter** | A host-specific implementation of the `HostAdapter` interface. |
| **Capability** | A feature a host provides, e.g. `subagents`, `git.worktree`. |
| **Canonical state** | The JSON representation of project state. The source of truth. |
| **Evidence** | A recorded artifact (test run, review, secret scan) attached to a task. |
| **Event** | A single entry in the append-only event log. |
| **Gate** | A deterministic check that returns PASS or BLOCK. |
| **Host** | The agent runtime Boldash runs under: Claude Code, Cursor, etc. |
| **Lifecycle stage** | A grouping of workflows: DISCOVER, PLAN, BUILD, VERIFY, SHIP, LEARN. |
| **Profile** | A named policy preset: Lite, Balanced, Strict, Accelerated. |
| **Projection** | A Markdown file generated from canonical state for human reading. |
| **Route** | A structured proposal from the LLM describing task type, risk, and workflow. |
| **Task** | A unit of work tracked by Boldash. |
| **Verification contract** | A machine-readable definition of what "done" means for a workflow. |
| **Workflow** | A named, versioned unit of work with a protocol and a contract. |
| **Workflow pack** | The directory containing a workflow's manifest, protocol, and contract. |

---

## Appendix A — Relationship to PromptKit OS v1

| Aspect | v1 | Boldash |
|---|---|---|
| **Form** | Markdown protocols, no runtime | Runtime + Markdown protocols |
| **Enforcement** | Self-attestation | Deterministic gates |
| **State** | Distributed Markdown | Canonical JSON + Markdown projection |
| **Routing** | LLM reads Markdown, chooses | LLM proposes JSON, Boldash validates |
| **Capabilities** | Implicit | Explicit and enforced |
| **Evidence** | Prose in Markdown | Structured event log |
| **Host support** | Generated directive files | Adapter interface |
| **Distribution** | Git submodule | npm package + git submodule option |

v1 remains valid as a protocol specification. Boldash is the runtime that makes the specification enforceable. Workflows written for v1 can be imported into Boldash via `boldash workflow import`.

---

## Appendix B — The One-Sentence Summary

> **The LLM proposes. Boldash validates, enforces, records, and verifies.**

If a design decision in this document does not serve that sentence, it is wrong.