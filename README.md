# Boldash

> **The LLM proposes. Boldash validates, enforces, records, and verifies.**

Boldash is the deterministic control plane for AI coding agents. It sits between your agent (Claude Code, Cursor, Antigravity, Codex, Gemini CLI) and your repository, turning prompt-based workflows into enforceable protocol.

**Status:** Pre-alpha. Design phase. Not yet installable.
**Predecessor:** [PromptKit OS v1](https://github.com/lowqualityloey/promptkit-os)
**Full design:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## The Problem

Every AI coding framework has the same flaw:

```
Agent reads "run tests before committing"
       ↓
Agent decides whether it ran the tests
       ↓
Agent decides whether the tests passed
       ↓
Agent decides it is done
       ↓
Agent commits
```

The agent is the executor *and* the judge. That is not enforcement. It is self-attestation.

No amount of better prompts fixes this. You cannot prompt your way into a guarantee.

## The Fix

Boldash splits the work in two:

| | |
|---|---|
| **The LLM reasons.** | Plans, writes code, writes tests, proposes decisions. |
| **Boldash enforces.** | Validates routes, tracks state, checks policy, runs gates, records evidence. |

The LLM never verifies its own work. It proposes; Boldash decides.

---

## What Boldash Actually Does

### 1. Validates routing

Instead of letting the agent pick a workflow by vibes, Boldash requires a structured route proposal:

```json
{
  "task": {
    "type": "feature",
    "risk": "medium",
    "scope": { "files": ["src/auth/*"] }
  },
  "route": {
    "workflow": "feature",
    "level": 2
  }
}
```

Boldash validates it against a schema, a workflow registry, and the host's capabilities. If the proposal is invalid, the agent gets a structured error and corrects it. No silent failures.

### 2. Owns canonical state

Task state lives in `.boldash/state/*.json`. Markdown files in `docs/` are generated projections — never the source of truth. The LLM queries state with `boldash state get TASK-42` instead of reading five markdown files and guessing at relationships.

### 3. Enforces policy

```yaml
- id: commit-requires-verification
  action: git.commit
  requires:
    - "state.task.status == 'verifying'"
    - "verification.all_requirements_verified == true"
    - "git.working_tree_clean == true"
  block_message: "Cannot commit: requirements not verified."
```

The agent can ask to commit. Boldash decides whether to permit it.

### 4. Runs real gates

```bash
$ boldash verify TASK-42
✓ R1 implemented  (file src/auth/callback.ts exists)
✓ R2 implemented  (regex matched in callback.ts)
✓ R3 implemented  (test oauth_callback passed)
✓ No secrets      (secret scan passed)
✓ Tree clean      (git status --porcelain empty)

STATUS: VERIFIED
Exit code: 0
```

Non-zero exit code on failure. Host adapters use this to actually block the commit.

### 5. Records evidence

Every meaningful operation is written to an append-only event log. `boldash explain TASK-42` builds a traceability graph:

```
TASK-42
├── R1 → Implementation → Test → PASS
├── R2 → Implementation → Test → PASS
└── Risk R3 → Mitigation → Review → APPROVED

Verification: VERIFIED (3/3 requirements, 1/1 risk mitigated)
```

This answers the question *"why does Boldash think this is done?"* with recorded evidence, not agent prose.

---

## Quick Start (Planned)

Once Boldash ships v0.1.0, the three-command minimum will be:

```bash
# 1. Initialize Boldash in your project
npx boldash init

# 2. Check state
npx boldash state list

# 3. Verify a task
npx boldash verify TASK-42
```

That is it. Everything else is optional. The core value — route validation, state, verification — works with three commands.

---

## CLI Reference (Planned)

| Command | Purpose |
|---|---|
| `boldash init` | Scaffold `.boldash/`, detect host, write config |
| `boldash doctor` | Diagnose config, host, state, capabilities |
| `boldash route` | Validate an LLM route proposal |
| `boldash state get <task>` | Read canonical task state |
| `boldash state list` | List tasks with filters |
| `boldash state transition <task> <status>` | Apply a state transition |
| `boldash verify <task>` | Run verification gates (exit 0 or 1) |
| `boldash explain <task>` | Traceability graph |
| `boldash policy check <action>` | Evaluate policy rules |
| `boldash checkpoint <task>` | Snapshot task state |
| `boldash evidence list <task>` | List events for a task |
| `boldash workflow import <path>` | Import a v1 workflow pack |

Every command supports `--format json` for agent consumption.

---

## Core Concepts

**Route** — A structured proposal from the LLM describing task type, risk, scope, and desired workflow. Boldash validates it.

**Task** — A unit of work with canonical state, requirements, evidence, and a version. Tasks transition through: `proposed → planned → implementing → verifying → complete` (or `blocked` / `failed`).

**Workflow** — A named, versioned unit of work with a Markdown protocol (for the LLM) and a machine-readable contract (for Boldash).

**Lifecycle stage** — Workflows are grouped into six stages: `DISCOVER`, `PLAN`, `BUILD`, `VERIFY`, `SHIP`, `LEARN`.

**Capability** — A feature a host provides (`subagents`, `git.worktree`, `mcp`). Workflows declare their requirements; Boldash matches them to the host.

**Gate** — A deterministic check that returns PASS or BLOCK. Gates produce exit codes.

**Profile** — A policy preset: `lite`, `balanced`, `strict`, `accelerated`. Profiles change what is required, not how the system works.

**Adapter** — A host-specific implementation that translates Boldash capabilities into host-native features (hooks, briefing files, capability probes).

---

## Design Principles

1. **Separation of intelligence and enforcement.** The LLM reasons; Boldash enforces. These never cross.
2. **Canonical state is machine-readable.** Markdown is a projection, never the truth.
3. **Deterministic work belongs outside the LLM.** If a check can be code, it must not be a prompt.
4. **Every gate returns an exit code.** A gate that cannot block is a suggestion.
5. **Zero ceremony for trivial work.** Risk determines ceremony. A one-line rename should be invisible.
6. **Local-first, Git-native, no daemon.** State is files. Everything travels with the repository.
7. **Model-agnostic.** All model output is validated against schemas. No model is assumed.
8. **Graceful degradation.** If Boldash is unavailable, the agent still works — with reduced guarantees.
9. **The runtime may be complex; the LLM interface must be tiny.** Schemas and errors fit in a few hundred tokens.
10. **Every decision is explainable.** If `boldash explain` cannot justify a decision with evidence, the design is wrong.

---

## How It Compares

| | **PromptKit OS v1** | **Superpowers** | **get.ship.done** | **Boldash** |
|---|---|---|---|---|
| **Form** | Markdown protocols | Methodology + skills | Methodology | Runtime + protocols |
| **Enforcement** | Self-attestation | Self-attestation | Self-attestation | Deterministic gates |
| **State** | Distributed Markdown | Session-based | Session-based | Canonical JSON |
| **Routing** | LLM reads Markdown | Skill selection | Phase selection | Schema-validated JSON |
| **Evidence** | Prose in Markdown | None | None | Append-only event log |
| **Host support** | Generated directive files | Multiple harnesses | Claude Code | Adapter interface |
| **Distribution** | Git submodule | Plugin marketplace | npx | npm + git submodule |

Boldash does not compete on "better prompts." It competes on **enforcement**, **state**, and **evidence** — the layer that prompt frameworks cannot provide.

---

## What Boldash Is Not

- **Not an LLM.** Boldash does not generate code, write specs, or reason about design.
- **Not an IDE.** No editor, no chat interface.
- **Not a SaaS.** Local-first. No cloud dependency in the core.
- **Not a general workflow engine.** Not Airflow, Temporal, or n8n.
- **Not a sandbox.** Boldash validates commands; it does not sandbox the shell.
- **Not a correctness guarantee.** Boldash verifies evidence exists. Whether the code is *good* is a human judgment.

---

## Repository Layout

```
boldash/
├── ARCHITECTURE.md      # Full design document
├── README.md            # This file
├── package.json
├── src/
│   ├── cli/             # Command-line interface
│   ├── core/            # Router, State, Policy, Capabilities,
│   │                    # Verification, Workflow, Evidence
│   ├── adapters/        # Host-specific adapters
│   └── shared/
├── schemas/             # JSON schemas for route, state, task, evidence
├── workflows/           # Reference workflow packs
├── policies/            # Policy presets
├── bench/               # Benchmark suite
└── docs/                # User documentation
```

---

## Roadmap

| Phase | Version | Focus |
|---|---|---|
| **1** | v0.1.0 | Foundation: `init`, `route`, `state`, `verify`. Generic adapter. v1 import. |
| **2** | v0.2.0 | Policy engine, capability manager, Claude adapter, `doctor`, `explain`. |
| **3** | v0.3.0 | Event log, evidence storage, subagent protocol, Cursor adapter. |
| **4** | v0.4.0+ | Antigravity adapter, workflow registry, benchmark suite, plugin API. |

See [ARCHITECTURE.md § 16](./ARCHITECTURE.md#16-development-roadmap) for exit criteria.

---

## Benchmark Philosophy

Boldash will publish a benchmark suite. It will not claim improvements without evidence.

The primary metric is **engineering cost per verified task** — not tokens per request, not seconds per response. A run that uses 5,000 tokens and ships the wrong thing is worse than a run that uses 9,000 tokens and ships the right thing.

If Boldash cannot demonstrate improvement over baseline agents, the design is wrong and will be revisited.

---

## Migrating from PromptKit OS v1

v1 workflows can be imported:

```bash
boldash workflow import ../promptkit-os/workflows/
```

The importer parses v1 Markdown into Boldash workflow packs. The protocols survive; verification contracts are added. v1 remains valid as a protocol specification — Boldash is the runtime that makes it enforceable.

---

## Contributing

Boldash is in design phase. Contributions are welcome, but the architecture must be understood before code is written.

**Before opening a PR:**

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md).
2. Check [Open Questions](./ARCHITECTURE.md#18-open-questions) — some decisions are not yet made.
3. Open an issue describing the change and how it aligns with the [Core Principles](#design-principles).

**Before opening an issue:**

- Search existing issues.
- Be specific. "The router should reject X" is better than "routing feels wrong."
- If proposing a feature, describe what problem it solves and how it fits the architecture.

---

## License

Released under the [MIT License](./LICENSE).

---

## Acknowledgements

Boldash is a successor to [PromptKit OS](https://github.com/lowqualityloey/promptkit-os). The protocols from v1 remain valuable; Boldash adds the enforcement layer that prompts alone cannot provide.

The project draws inspiration from [Superpowers](https://github.com/obra/superpowers) and [get.ship.done](https://github.com/opengsd/gsd-core), and takes the opposite approach: instead of writing better prompts, it builds the machinery that makes prompts accountable.

---

> **The LLM proposes. Boldash validates, enforces, records, and verifies.**
>
> If a design decision does not serve that sentence, it is wrong.