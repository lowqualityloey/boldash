# Error Catalog

> **Status:** Specification for v0.1.0.
> **Audience:** Users, agents consuming CLI output, contributors.

---

## Table of Contents

- [Error Format](#error-format)
- [Exit Codes](#exit-codes)
- [Schema Errors](#schema-errors)
- [Routing Errors](#routing-errors)
- [State Errors](#state-errors)
- [Policy Errors](#policy-errors)
- [Capability Errors](#capability-errors)
- [Verification Errors](#verification-errors)
- [Evidence Errors](#evidence-errors)
- [Host Errors](#host-errors)
- [Internal Errors](#internal-errors)
- [Adding an Error Code](#adding-an-error-code)

---

## Error Format

Every error is a JSON object.

```json
{
  "ok": false,
  "error": {
    "code": "SCREAMING_SNAKE_CASE",
    "message": "human-readable description",
    "field": "optional.json.path",
    "suggestion": "optional remediation hint",
    "context": { "optional": "additional data" }
  }
}
```

| Field        | Required | Description                                        |
| ------------ | -------- | -------------------------------------------------- |
| `code`       | Yes      | Stable identifier. Never localized.                |
| `message`    | Yes      | Human-readable. May change between versions.       |
| `field`      | No       | JSON path to the offending field, when applicable. |
| `suggestion` | No       | Remediation hint. Not guaranteed to be correct.    |
| `context`    | No       | Additional structured data specific to the code.   |

**Rules:**

- `code` is stable. Never rename a code. Add a new one.
- `message` is not stable. Do not parse it. Use `code`.
- Agents should branch on `code`, not `message`.

---

## Exit Codes

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 0    | Success                                   |
| 1    | Verification failed / policy blocked      |
| 2    | Invalid input / schema error              |
| 3    | Missing capability / host incompatibility |
| 4    | Concurrency conflict                      |
| 10   | Internal error                            |
| 11   | Unexpected I/O error                      |
| 12   | Timeout                                   |

Every error code maps to one of these. The mapping is in the table below.

---

## Schema Errors

### `SCHEMA_PARSE`

Input is not valid JSON.

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_PARSE",
    "message": "Unexpected token '}' at position 42.",
    "field": "route"
  }
}
```

**Exit code:** 2.
**Fix:** Provide valid JSON.

---

### `SCHEMA_VALIDATION`

Input does not conform to the schema.

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION",
    "message": "route.level must be an integer between 0 and 3.",
    "field": "route.level",
    "suggestion": "Set route.level to a value in [0, 1, 2, 3]."
  }
}
```

**Exit code:** 2.
**Fix:** Correct the field named in `field`.

---

### `SCHEMA_VERSION_MISMATCH`

A state file declares a schema version Boldash does not support.

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH",
    "message": "tasks.json declares schema_version 2; this Boldash supports 1.",
    "field": ".boldash/state/tasks.json.schema_version",
    "suggestion": "Upgrade Boldash, or restore from an older commit."
  }
}
```

**Exit code:** 2.
**Fix:** Upgrade Boldash, or restore the state file.

---

## Routing Errors

### `WORKFLOW_NOT_FOUND`

The proposed workflow is not in the registry.

```json
{
  "ok": false,
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "Workflow 'microservice' is not enabled.",
    "field": "route.workflow",
    "context": { "enabled": ["feature", "bugfix", "refactor"] },
    "suggestion": "Choose from the enabled workflows."
  }
}
```

**Exit code:** 2.
**Fix:** Choose an enabled workflow, or enable the workflow.

---

### `LEVEL_RISK_MISMATCH`

The proposed level does not match the task's risk.

```json
{
  "ok": false,
  "error": {
    "code": "LEVEL_RISK_MISMATCH",
    "message": "Risk 'high' requires level 3, but level 2 was proposed.",
    "field": "route.level",
    "suggestion": "Raise level to 3."
  }
}
```

**Exit code:** 2.
**Fix:** Raise the level, or lower the risk.

---

### `SCOPE_FILE_NOT_FOUND`

A file declared in scope does not exist.

```json
{
  "ok": false,
  "error": {
    "code": "SCOPE_FILE_NOT_FOUND",
    "message": "Scope file 'src/auth/handler.ts' not found.",
    "field": "task.scope.files",
    "suggestion": "This is a warning for greenfield tasks; ignore if the file is to be created."
  }
}
```

**Exit code:** 0 (warning).
**Fix:** Correct the path, or ignore for greenfield tasks.

---

## State Errors

### `STATE_INVALID_TRANSITION`

Requested transition violates the lifecycle.

```json
{
  "ok": false,
  "error": {
    "code": "STATE_INVALID_TRANSITION",
    "message": "Cannot transition TASK-001 from 'planned' to 'complete'.",
    "field": "status",
    "context": { "allowed_from_planned": ["implementing", "failed"] },
    "suggestion": "Transition to 'implementing' first."
  }
}
```

**Exit code:** 2.
**Fix:** Follow the lifecycle.

---

### `STATE_TASK_NOT_FOUND`

The task does not exist.

```json
{
  "ok": false,
  "error": {
    "code": "STATE_TASK_NOT_FOUND",
    "message": "No task with id TASK-999.",
    "field": "task_id",
    "suggestion": "Run `boldash state list` to see existing tasks."
  }
}
```

**Exit code:** 2.
**Fix:** Use a valid task ID.

---

### `STATE_MISSING_REQUIREMENT`

A transition requires a requirement that is not present.

```json
{
  "ok": false,
  "error": {
    "code": "STATE_MISSING_REQUIREMENT",
    "message": "Transition to 'implementing' requires at least one requirement.",
    "field": "requirements",
    "suggestion": "Add at least one requirement with `boldash state requirement add`."
  }
}
```

**Exit code:** 2.
**Fix:** Add the missing data.

---

### `CONCURRENT_MODIFICATION`

Another actor modified the task since it was last read.

```json
{
  "ok": false,
  "error": {
    "code": "CONCURRENT_MODIFICATION",
    "message": "Task TASK-001 was modified by another actor.",
    "field": "version",
    "context": { "expected_version": 7, "current_version": 8 },
    "suggestion": "Re-read the task and reapply your change."
  }
}
```

**Exit code:** 4.
**Fix:** Re-read and retry.

---

### `STATE_LOCKED`

The task is under an active lease held by another owner.

```json
{
  "ok": false,
  "error": {
    "code": "STATE_LOCKED",
    "message": "Task TASK-001 is leased to agent-01 until 2026-09-14T11:00:00Z.",
    "field": "owner",
    "context": { "owner": "agent-01", "expires_at": "2026-09-14T11:00:00Z" }
  }
}
```

**Exit code:** 4.
**Fix:** Wait for the lease to expire, or contact the owner.

---

## Policy Errors

### `POLICY_BLOCKED`

An action is blocked by a policy rule.

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_BLOCKED",
    "message": "Cannot commit: requirements not verified.",
    "field": "action",
    "context": { "rule": "commit-requires-verification", "action": "git.commit" },
    "suggestion": "Run `boldash verify TASK-001` and resolve pending requirements."
  }
}
```

**Exit code:** 1.
**Fix:** Satisfy the rule's requirements.

---

### `POLICY_RULE_INVALID`

A policy rule is malformed.

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_RULE_INVALID",
    "message": "Rule 'commit-requires-verification' has an invalid expression.",
    "field": "policies.default.rules[0].requires[1]",
    "suggestion": "Check the expression grammar in docs/policies.md."
  }
}
```

**Exit code:** 2.
**Fix:** Correct the rule.

---

## Capability Errors

### `CAPABILITY_MISSING`

The workflow requires a capability the host does not provide.

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_MISSING",
    "message": "Workflow 'migration' requires 'subagents', which this host does not provide.",
    "field": "route.workflow",
    "context": { "missing": ["subagents"], "host": "cursor" },
    "suggestion": "Use the 'refactor' workflow, or switch to a host with subagent support."
  }
}
```

**Exit code:** 3.
**Fix:** Change workflow or host.

---

### `CAPABILITY_UNKNOWN`

The host declares an unknown capability.

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_UNKNOWN",
    "message": "Capability 'quantum-compute' is not recognized.",
    "field": "capabilities",
    "suggestion": "Check the capability list in ARCHITECTURE.md § 5.3."
  }
}
```

**Exit code:** 3.
**Fix:** Remove or correct the capability declaration.

---

## Verification Errors

### `VERIFY_BLOCKED`

Verification failed.

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_BLOCKED",
    "message": "Verification failed: 2 checks did not pass.",
    "context": {
      "failed_checks": ["R3 not implemented", "Review missing"]
    },
    "suggestion": "Run `boldash explain TASK-001` to see missing evidence."
  }
}
```

**Exit code:** 1.
**Fix:** Resolve the failed checks.

---

### `VERIFY_CONTRACT_INVALID`

The `done.schema.json` is malformed.

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_CONTRACT_INVALID",
    "message": "done.schema.json has an invalid check type 'static_analysis'.",
    "field": "must_pass[2].type",
    "suggestion": "Use one of: file_exists, command, regex_in_file, state_check, evidence_exists."
  }
}
```

**Exit code:** 2.
**Fix:** Correct the contract.

---

### `VERIFY_COMMAND_TIMEOUT`

A command check exceeded its timeout.

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_COMMAND_TIMEOUT",
    "message": "Command check 'integration tests' exceeded 300000ms.",
    "context": { "command": "npm run test:integration", "timeout_ms": 300000 },
    "suggestion": "Increase timeout_ms in the contract, or narrow the test scope."
  }
}
```

**Exit code:** 12.
**Fix:** Increase timeout or narrow the command.

---

### `VERIFY_COMMAND_UNDECLARED`

A command was attempted that is not declared in the contract.

```json
{
  "ok": false,
  "error": {
    "code": "VERIFY_COMMAND_UNDECLARED",
    "message": "Cannot run undeclared command 'rm -rf /'.",
    "context": { "command": "rm -rf /" },
    "suggestion": "Declare the command in the workflow's done.schema.json."
  }
}
```

**Exit code:** 2.
**Fix:** Declare the command, or remove the attempt.

---

## Evidence Errors

### `EVIDENCE_NOT_FOUND`

Requested evidence does not exist.

```json
{
  "ok": false,
  "error": {
    "code": "EVIDENCE_NOT_FOUND",
    "message": "No evidence with id evt_9999.",
    "field": "evidence_id",
    "suggestion": "Run `boldash evidence list TASK-001` to see available evidence."
  }
}
```

**Exit code:** 2.
**Fix:** Use a valid evidence ID.

---

### `EVIDENCE_REDACTION_FAILED`

Secret redaction failed before writing evidence.

```json
{
  "ok": false,
  "error": {
    "code": "EVIDENCE_REDACTION_FAILED",
    "message": "Could not redact potential secret in evidence payload.",
    "field": "evidence",
    "suggestion": "Review the payload manually. Do not commit raw secrets."
  }
}
```

**Exit code:** 10.
**Fix:** Review the payload. Remove secrets.

---

### `EVENT_LOG_CORRUPT`

The event log contains an unparseable line.

```json
{
  "ok": false,
  "error": {
    "code": "EVENT_LOG_CORRUPT",
    "message": "events.jsonl line 42 is not valid JSON.",
    "field": ".boldash/events.jsonl:42",
    "suggestion": "Restore from Git, or remove the line if it is clearly corrupt."
  }
}
```

**Exit code:** 11.
**Fix:** Repair the log.

---

## Host Errors

### `HOST_UNKNOWN`

Host could not be detected.

```json
{
  "ok": false,
  "error": {
    "code": "HOST_UNKNOWN",
    "message": "Could not detect host. Falling back to generic adapter.",
    "suggestion": "Specify --host <name>, or configure host in .boldash/config.yaml."
  }
}
```

**Exit code:** 0 (warning).
**Fix:** Specify the host, or accept the generic adapter.

---

### `ADAPTER_INIT_FAILED`

The adapter could not initialize.

```json
{
  "ok": false,
  "error": {
    "code": "ADAPTER_INIT_FAILED",
    "message": "Claude adapter could not register pre-tool hooks.",
    "field": "adapter",
    "suggestion": "Check that Claude Code is installed and the version is supported."
  }
}
```

**Exit code:** 3.
**Fix:** Update the host or the adapter.

---

### `HOOK_REGISTRATION_FAILED`

A hook could not be registered.

```json
{
  "ok": false,
  "error": {
    "code": "HOOK_REGISTRATION_FAILED",
    "message": "Could not register pre-commit hook.",
    "context": { "host": "cursor", "hook": "pre_tool" },
    "suggestion": "Verification will be advisory on this host."
  }
}
```

**Exit code:** 3.
**Fix:** Continue with advisory mode, or upgrade the host.

---

## Internal Errors

### `INTERNAL_ERROR`

An unexpected error occurred.

```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred.",
    "context": { "trace_id": "abc123", "version": "0.1.0" },
    "suggestion": "Open an issue with the trace_id."
  }
}
```

**Exit code:** 10.
**Fix:** Report the bug.

---

### `IO_ERROR`

A filesystem operation failed.

```json
{
  "ok": false,
  "error": {
    "code": "IO_ERROR",
    "message": "Could not write .boldash/state/tasks.json: permission denied.",
    "field": ".boldash/state/tasks.json",
    "suggestion": "Check file permissions."
  }
}
```

**Exit code:** 11.
**Fix:** Correct the permissions.

---

### `TIMEOUT`

An operation exceeded its timeout.

```json
{
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Operation timed out after 300000ms.",
    "suggestion": "Increase the timeout, or narrow the operation."
  }
}
```

**Exit code:** 12.
**Fix:** Adjust timeout or scope.

---

## Adding an Error Code

When adding a new error code:

1. Add it to this file, following the existing format.
2. Add a test that produces it.
3. Add a mapping to an exit code.
4. Never rename an existing code. Add a new one, deprecate the old.
5. Never localize the `code` field. Only `message` may be localized.
6. Keep `message` stable enough that logs are readable, but do not promise it.

See [`AGENTS.md § Evidence and Verification`](../AGENTS.md#evidence-and-verification).

---

## See Also

- [`docs/cli-reference.md`](./cli-reference.md)
- [`docs/routing-contract.md`](./routing-contract.md)
- [`docs/verification-guide.md`](./verification-guide.md)
- [`docs/state-model.md`](./state-model.md)
