# Verification Guide

> **Status:** Specification for v0.1.0.
> **Audience:** Workflow authors.
> **Related:** [`ARCHITECTURE.md § 6.5`](../ARCHITECTURE.md#65-verification-engine)

---

## Table of Contents

- [What Verification Is](#what-verification-is)
- [What Verification Is Not](#what-verification-is-not)
- [The Contract File](#the-contract-file)
- [Check Types](#check-types)
- [Writing a Good Contract](#writing-a-good-contract)
- [Examples](#examples)
- [Gates and Exit Codes](#gates-and-exit-codes)
- [Evidence vs. Claims](#evidence-vs-claims)

---

## What Verification Is

Verification is a deterministic check that a task is complete.

It runs outside the LLM. It reads state and evidence. It executes declared commands. It returns `VERIFIED` or `BLOCKED` with a non-zero exit code on failure.

Verification is the moment Boldash becomes an enforcement layer rather than a suggestion layer.

---

## What Verification Is Not

| Verification is not     | Because                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| A correctness guarantee | It confirms evidence exists, not that the code is good.               |
| A code review           | Review is a separate workflow.                                        |
| A test runner           | It runs tests _declared in the contract_. It does not generate tests. |
| A static analyzer       | It runs analyzers you declare. It does not decide what to analyze.    |
| A security scanner      | It runs scanners you declare. It does not replace human review.       |
| An LLM judgment         | It contains no LLM calls.                                             |

If verification passes and the code is still wrong, the contract is too weak. Fix the contract, not the engine.

---

## The Contract File

Each workflow declares its verification contract in `done.schema.json`.

Location: `workflows/<name>/done.schema.json`

### Schema

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
            "enum": [
              "file_exists",
              "command",
              "regex_in_file",
              "state_check",
              "evidence_exists"
            ]
          },
          "name": { "type": "string" },
          "path": { "type": "string" },
          "run": { "type": "string" },
          "pattern": { "type": "string" },
          "check": { "type": "string" }
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
          "run": { "type": "string" }
        }
      }
    }
  }
}
```

### Field reference

| Field       | Required | Description                                            |
| ----------- | -------- | ------------------------------------------------------ |
| `task_id`   | Yes      | The task this contract applies to (usually templated). |
| `must_pass` | Yes      | Array of checks that must pass.                        |
| `must_not`  | No       | Array of checks that must fail (negative checks).      |

---

## Check Types

### `file_exists`

Passes if the file at `path` exists.

```json
{ "type": "file_exists", "name": "callback file present", "path": "src/auth/callback.ts" }
```

### `command`

Runs a shell command. Passes if the exit code is 0.

```json
{
  "type": "command",
  "name": "unit tests pass",
  "run": "npm test -- --grep oauth_callback"
}
```

Rules:

- The command must be declared in the contract. Boldash does not run undeclared commands.
- Timeout: 300 seconds by default. Configurable via `timeout_ms` in the check.
- Working directory: project root.
- stdout and stderr are captured as evidence.

### `regex_in_file`

Passes if `pattern` matches somewhere in the file at `path`.

```json
{
  "type": "regex_in_file",
  "name": "callback registered",
  "path": "src/auth/index.ts",
  "pattern": "registerCallback\\("
}
```

Patterns are JavaScript regex. Use anchors and escaping carefully.

### `state_check`

Evaluates a state expression. Passes if the expression is true.

```json
{
  "type": "state_check",
  "name": "task risk not critical",
  "check": "state.task.risk != 'critical'"
}
```

State expressions use the same constrained grammar as policy rules (see [`docs/state-model.md`](./state-model.md)).

### `evidence_exists`

Passes if evidence of the given `name` is attached to the task.

```json
{ "type": "evidence_exists", "name": "review completed", "path": "review" }
```

`path` is the evidence kind (e.g. `review`, `test-run`, `secret-scan`).

### `file_not_modified` (must_not)

Passes if the file at `path` was not modified by this task.

```json
{ "type": "file_not_modified", "name": "schema untouched", "path": "db/schema.sql" }
```

### `command_fails` (must_not)

Passes if the command exits non-zero.

```json
{ "type": "command_fails", "name": "linter finds no issues", "run": "eslint src/" }
```

Note: this check is inverted. It passes when the command fails. Use only when the semantic meaning is clear. Most checks belong in `must_pass`.

---

## Writing a Good Contract

### Rule 1 — One check per requirement

If the task has three requirements, there should be at least three `must_pass` checks, one per requirement.

```json
"must_pass": [
  { "type": "file_exists", "name": "R1 callback file", "path": "src/auth/callback.ts" },
  { "type": "regex_in_file", "name": "R2 error handling", "path": "src/auth/callback.ts", "pattern": "catch \\(" },
  { "type": "command", "name": "R3 test", "run": "npm test -- --grep oauth_callback" }
]
```

### Rule 2 — Prefer commands over regex

A command that actually runs the code is stronger than a regex that looks for a pattern. Use regex only when running is impossible.

### Rule 3 — No tautologies

Avoid checks that always pass.

```json
{ "type": "command", "name": "always passes", "run": "true" }
```

This is useless. It creates false confidence.

### Rule 4 — Timeout every command

Long-running commands can hang CI. Set `timeout_ms` when a command might exceed 300 seconds.

```json
{
  "type": "command",
  "name": "integration tests",
  "run": "npm run test:integration",
  "timeout_ms": 900000
}
```

### Rule 5 — Name every check

The `name` field is what the user sees in the verification output. Make it descriptive.

Bad: `{ "type": "command", "name": "test", ... }`

Good: `{ "type": "command", "name": "OAuth callback integration test", ... }`

---

## Examples

### A minimal feature contract

```json
{
  "task_id": "{{task_id}}",
  "must_pass": [
    { "type": "file_exists", "name": "implementation file", "path": "src/feature.ts" },
    { "type": "command", "name": "tests pass", "run": "npm test" },
    { "type": "command", "name": "typecheck pass", "run": "npm run typecheck" }
  ]
}
```

### A migration contract

```json
{
  "task_id": "{{task_id}}",
  "must_pass": [
    { "type": "file_exists", "name": "migration file", "path": "db/migrations/001.sql" },
    { "type": "file_exists", "name": "rollback file", "path": "db/rollbacks/001.sql" },
    { "type": "command", "name": "migration test", "run": "npm run test:migration" },
    { "type": "command", "name": "rollback test", "run": "npm run test:rollback" },
    { "type": "evidence_exists", "name": "backup recorded", "path": "backup" },
    { "type": "evidence_exists", "name": "review completed", "path": "review" }
  ],
  "must_not": [
    { "type": "file_not_modified", "name": "no data loss", "path": "data/critical.json" }
  ]
}
```

### A security fix contract

```json
{
  "task_id": "{{task_id}}",
  "must_pass": [
    {
      "type": "command",
      "name": "vulnerability test passes",
      "run": "npm test -- --grep cve-2024"
    },
    {
      "type": "command",
      "name": "no new high-severity deps",
      "run": "npm audit --audit-level=high"
    },
    {
      "type": "regex_in_file",
      "name": "input sanitized",
      "path": "src/input.ts",
      "pattern": "sanitize\\("
    },
    { "type": "evidence_exists", "name": "security review", "path": "security-review" }
  ]
}
```

---

## Gates and Exit Codes

`boldash verify <task>` exits:

| Code | Meaning       | When                                           |
| ---- | ------------- | ---------------------------------------------- |
| 0    | VERIFIED      | All `must_pass` passed. All `must_not` passed. |
| 1    | BLOCKED       | At least one check failed.                     |
| 2    | Invalid input | Task not found, contract malformed.            |

### Host integration

Hosts with `pre_tool_hooks` (Claude Code, Cursor, Antigravity) can run verification before a commit and block the commit if the exit code is 1.

Hosts without hooks cannot. `boldash doctor` reports this as a warning. On such hosts, verification is advisory.

### Manual gate

If you want to enforce verification regardless of host, add it to a pre-commit hook:

```bash
# .git/hooks/pre-commit
#!/bin/sh
npx boldash verify "$BOLDASH_TASK" || exit 1
```

This is not managed by Boldash. It is a fallback for hosts that lack native hooks.

---

## Evidence vs. Claims

The most important distinction in verification:

| Kind               | Example                                 | Trust                            |
| ------------------ | --------------------------------------- | -------------------------------- |
| **FACT**           | `npm test` returned exit code 0         | High. Recorded, verifiable.      |
| **CLAIM**          | Agent says "requirement R3 implemented" | Low. Not independently verified. |
| **HUMAN JUDGMENT** | Reviewer approved PR #77                | Medium. Depends on the reviewer. |
| **INFERENCE**      | "likely correct because tests pass"     | Low. Not a check.                |

Boldash checks produce FACTs. Review produces HUMAN JUDGMENT. Agent prose produces CLAIMs.

A well-written contract uses mostly FACTs. It uses HUMAN JUDGMENT for things machines cannot verify (design, tone, UX). It does not rely on CLAIMs.

If your `done.schema.json` contains a check whose only evidence is "the agent says so," rewrite it.

---

## See Also

- [`ARCHITECTURE.md § 6.5`](../ARCHITECTURE.md#65-verification-engine) — Verification Engine.
- [`docs/state-model.md`](./state-model.md) — state expressions.
- [`docs/errors.md`](./errors.md) — error codes.
