# Routing Contract

> **Status:** Specification for v0.1.0.
> **Audience:** Workflow authors, contributors, agent integrators.
> **Related:** [`ARCHITECTURE.md § 6.1`](../ARCHITECTURE.md#61-router)

---

## Table of Contents

- [Why Routing Is a Contract](#why-routing-is-a-contract)
- [The Proposal Schema](#the-proposal-schema)
- [The Validation Pipeline](#the-validation-pipeline)
- [Error Codes](#error-codes)
- [Examples](#examples)
- [Level and Risk](#level-and-risk)
- [Scope](#scope)
- [What the Agent Sees](#what-the-agent-sees)

---

## Why Routing Is a Contract

In v1, the LLM read Markdown and chose a workflow. Another model version could choose differently. There was no way to verify the decision or replay it.

In Boldash, the LLM proposes a structured route. Boldash validates it. The decision is:

- **Explicit.** A JSON object, not an inference.
- **Verifiable.** A schema and a policy check.
- **Replayable.** The proposal is recorded in the event log.
- **Correctable.** Invalid proposals return structured errors.

The agent still decides *what it wants to do*. Boldash decides whether that decision is valid.

---

## The Proposal Schema

File: `schemas/route.schema.json`

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

### Field reference

| Field | Required | Description |
|---|---|---|
| `task.type` | Yes | Category of work. Determines available workflows. |
| `task.risk` | Yes | Impact if the work goes wrong. Determines ceremony. |
| `task.scope` | Yes | Files and systems affected. |
| `task.summary` | No | One-line human description. Max 200 chars. |
| `route.workflow` | Yes | Name of a workflow in the registry. |
| `route.level` | Yes | Ceremony level 0–3. Must match risk. |
| `route.requirements` | No | Overrides for the workflow's default requirements. |

---

## The Validation Pipeline

```
1. Parse JSON
   ├─ Malformed → SCHEMA_PARSE
   │
2. Validate against JSON schema
   ├─ Invalid → SCHEMA_VALIDATION (with field path)
   │
3. Check workflow exists in registry
   ├─ Missing → WORKFLOW_NOT_FOUND
   │
4. Check level is consistent with risk
   ├─ Mismatch → LEVEL_RISK_MISMATCH
   │
5. Check workflow requirements against host capabilities
   ├─ Missing → CAPABILITY_MISSING (with list)
   │
6. Check scope files exist (brownfield only)
   ├─ Missing → SCOPE_FILE_NOT_FOUND (warning, not error, for greenfield)
   │
7. Emit ResolvedRoute
```

Every step returns either `{ ok: true, data }` or `{ ok: false, error }`. No exceptions cross the boundary.

---

## Error Codes

| Code | Exit | When | Agent action |
|---|---|---|---|
| `SCHEMA_PARSE` | 2 | Invalid JSON | Fix syntax. |
| `SCHEMA_VALIDATION` | 2 | Schema violation | Fix field named in `field`. |
| `WORKFLOW_NOT_FOUND` | 2 | Unknown workflow | Choose from `workflows_enabled`. |
| `LEVEL_RISK_MISMATCH` | 2 | Level does not match risk | Raise level or lower risk. |
| `CAPABILITY_MISSING` | 3 | Host lacks required capability | Change workflow, or use a host with the capability. |
| `SCOPE_FILE_NOT_FOUND` | 0 | Scope path missing | Warning only. Logged, not blocking. |

See [`docs/errors.md`](./errors.md) for the full catalog.

---

## Examples

### Valid: feature, medium risk

```json
{
  "task": {
    "type": "feature",
    "risk": "medium",
    "scope": {
      "files": ["src/auth/*"],
      "systems": ["authentication"]
    },
    "summary": "Handle Google OAuth callback"
  },
  "route": {
    "workflow": "feature",
    "level": 2
  }
}
```

Result: validated. Requirements inferred from workflow default.

### Valid: trivial chore

```json
{
  "task": {
    "type": "chore",
    "risk": "trivial",
    "scope": { "files": ["README.md"] }
  },
  "route": {
    "workflow": "docs",
    "level": 0
  }
}
```

Result: validated. Boldash may auto-approve and skip further ceremony.

### Invalid: level too low for risk

```json
{
  "task": { "type": "feature", "risk": "critical", "scope": { "files": ["src/db/*"] } },
  "route": { "workflow": "feature", "level": 1 }
}
```

Result:

```json
{
  "ok": false,
  "error": {
    "code": "LEVEL_RISK_MISMATCH",
    "message": "Risk 'critical' requires level 3, but level 1 was proposed.",
    "field": "route.level",
    "suggestion": "Raise level to 3."
  }
}
```

### Invalid: missing capability

```json
{
  "task": { "type": "migration", "risk": "high", "scope": { "files": ["db/*"] } },
  "route": { "workflow": "migration", "level": 3 }
}
```

On a host without `subagents`:

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

---

## Level and Risk

Level determines ceremony. Risk determines level. This mapping is enforced.

| Risk | Required level | Meaning |
|---|---|---|
| `trivial` | 0 | No record. No spec. No review. |
| `low` | 1 | Task record only. |
| `medium` | 2 | Task record + specification + tests. |
| `high` | 3 | Task record + specification + tests + review. |
| `critical` | 3 + human approval | Full ceremony + explicit human sign-off. |

A proposal may set a **higher** level than risk requires (more ceremony). It may not set a **lower** level.

If the agent disagrees with the mapping, it must justify it in the task record. The mapping itself is configurable in `policies/`.

---

## Scope

Scope tells Boldash (and the user) what the task will touch.

### `scope.files`

Glob patterns relative to the project root.

```json
"files": ["src/auth/*", "src/auth/**/*.ts"]
```

Used for:

- Conflict detection between sibling tasks.
- Post-task diff bounds.
- Warning when a task modifies files outside its declared scope.

### `scope.systems`

Freeform system names.

```json
"systems": ["authentication", "database"]
```

Used for:

- Human-readable summaries.
- Policy rules that apply to specific systems.

### Scope is not enforcement

Declaring `src/auth/*` does not prevent modifying `src/db/*`. Boldash warns; it does not block. Enforcement belongs in policy rules.

Declarations containing glob metacharacters are not evaluated (they state intent, not an existing path), and nothing is checked against an empty project root. A missing literal file yields one `SCOPE_FILE_NOT_FOUND` entry in an optional `warnings` array on the success payload — the key is omitted entirely when there is nothing to report, so the payloads in §What the Agent Sees stay exact.

---

## What the Agent Sees

The agent sends a proposal. Boldash returns either:

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
    "message": "...",
    "field": "...",
    "suggestion": "..."
  }
}
```

The success payload is the minimum the agent needs to proceed. The failure payload is the minimum the agent needs to correct itself. Nothing more.

### Token cost

A typical success payload is ~60 tokens. A failure payload is ~100 tokens. This is by design: routing is deterministic work, and deterministic work should cost almost nothing in tokens.

---

## See Also

- [`ARCHITECTURE.md § 6.1`](../ARCHITECTURE.md#61-router) — Router design.
- [`docs/errors.md`](./errors.md) — full error catalog.
- [`docs/verification-guide.md`](./verification-guide.md) — `done.schema.json`.