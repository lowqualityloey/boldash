# Frequently Asked Questions

> **Status:** Specification for v0.1.0.
> **Audience:** Visitors, evaluators.

---

## General

### What is Boldash?

Boldash is a deterministic control plane for AI coding agents. It sits between the agent and the repository, validating routes, enforcing policy, tracking state, and verifying completion.

One sentence: **The LLM proposes. Boldash validates, enforces, records, and verifies.**

### Is Boldash available?

No. It is pre-alpha. The design is documented. The runtime is not yet built. See [`PROJECT_OVERVIEW.md § Project Status`](../PROJECT_OVERVIEW.md#project-status).

### Why the name "Boldash"?

"Bold" for confidence and clarity. "Dash" for speed and a bit of self-deprecation. The `ash` suffix is also a nod to `slash` commands, which the project uses.

### Is Boldash a fork of PromptKit OS?

No. It is a successor. PromptKit OS v1 is a protocol specification. Boldash is the runtime that makes the specification enforceable. They are separate projects. See [`docs/migration-from-v1.md`](./migration-from-v1.md).

### How is Boldash different from Superpowers?

Superpowers is a methodology and skill library. It makes agents more systematic by giving them better prompts. Boldash does not compete on prompts. It competes on **enforcement**, **state**, and **evidence** — the layer that prompts alone cannot provide.

See [`PROJECT_OVERVIEW.md § What Boldash Is`](../PROJECT_OVERVIEW.md#what-boldash-is).

### How is Boldash different from get.ship.done?

get.ship.done is a methodology. Boldash is a runtime. They are not in the same category. A user could theoretically use both — get.ship.done's methodology, enforced by Boldash's runtime.

---

## Design

### Does Boldash replace the LLM?

No. The LLM reasons, plans, and writes code. Boldash coordinates, validates, and verifies. These responsibilities never cross.

### Does Boldash write code?

No. Boldash does not generate code, write specs, or reason about design.

### Does Boldash call an LLM?

No. The core has no LLM calls. Verification is deterministic.

### Does Boldash need a daemon?

No. There is no background process. The CLI runs on demand.

### Does Boldash need a database?

No. State is files under `.boldash/state/`. It is Git-friendly.

### Does Boldash need the cloud?

No. The core is local-first. There is no cloud dependency.

### Why is Markdown not the source of truth?

Markdown is excellent for humans and terrible for machines. Reading five Markdown files to infer task state makes the LLM a distributed query engine. Boldash makes JSON canonical and generates Markdown for humans.

See [`docs/state-model.md`](./state-model.md).

### Why is routing a JSON contract?

Because a routing decision that only lives in prose cannot be validated, replayed, or corrected. A JSON contract can be all three.

See [`docs/routing-contract.md`](./routing-contract.md).

---

## Usage

### How do I install Boldash?

```bash
npx boldash init
```

Requires Node.js 20 LTS. See [`docs/getting-started.md`](./getting-started.md).

### Which hosts does Boldash support?

Claude Code, Cursor, Antigravity, Codex, Gemini CLI, OpenCode, and a generic fallback. Support is at the capability level, not the instruction level. See [`ARCHITECTURE.md § 5.3`](../ARCHITECTURE.md#53-adapter-capability-matrix).

### Can I use Boldash with my existing prompt framework?

Yes. v1 workflows can be imported via `boldash workflow import`. Other frameworks may be importable in future versions. See [`docs/migration-from-v1.md`](./migration-from-v1.md).

### Do I have to use all of Boldash?

No. The three-command minimum is `init`, `state`, and `verify`. Everything else is optional.

### Can I disable Boldash for a task?

Yes. `lite` profile reduces ceremony. Trivial tasks (risk `trivial`) skip most of it automatically.

### Can I bypass verification?

The CLI does not prevent bypass. Hosts with `pre_tool_hooks` can enforce verification before a commit; hosts without hooks cannot. `boldash doctor` reports the limitation.

Boldash is a tool, not a prison. If you bypass it, you lose the guarantee.

---

## State

### What lives in `.boldash/state/`?

Four files: `project.json`, `tasks.json`, `decisions.json`, `evidence.json`. See [`docs/state-model.md`](./state-model.md).

### Is state committed to Git?

Yes. State travels with the repository. This is deliberate — teammates see the same task state.

### Can I edit `.boldash/state/tasks.json` by hand?

You can, but you should not. Manual edits bypass validation and event logging. Use `boldash state` commands.

### What happens if two agents edit state at once?

Optimistic locking. The second writer gets `CONCURRENT_MODIFICATION`. It must re-read and retry.

### What happens if I lose `.boldash/state/`?

You lose task state, decisions, and the evidence index. Evidence payloads under `.boldash/evidence/` may survive. Recovery is manual. Commit state regularly.

### Can I keep state out of Git?

You can add `.boldash/state/` to `.gitignore`, but you lose cross-machine persistence and teammate visibility. Not recommended.

---

## Verification

### What does `boldash verify` actually check?

Whatever the workflow's `done.schema.json` declares. See [`docs/verification-guide.md`](./verification-guide.md).

### Can verification run tests?

Yes, if the contract declares a command check that runs them.

### What if my tests are flaky?

Verification does not retry. A flaky test is a failing test. Fix the test.

### Can verification call an LLM?

No. Verification is deterministic by design.

### Can I write my own checks?

The v0.1.0 check types are fixed: `file_exists`, `command`, `regex_in_file`, `state_check`, `evidence_exists`. Custom check types may be supported in future versions via a plugin API. For v0.1.0, compose existing types.

### What if verification passes but the code is wrong?

The contract is too weak. Add stronger checks. Boldash confirms evidence exists, not that the code is correct.

---

## Profiles

### Which profile should I use?

Start with `balanced`. It is the default and is reasonable for most cases.

- `lite` if you want minimal ceremony.
- `strict` if you need maximum enforcement.
- `accelerated` if you want speed on low-risk tasks and rigor on high-risk ones.

### Can I define a custom profile?

Yes. Copy a preset in `.boldash/config.yaml` and edit.

### Do profiles change the architecture?

No. They change policy parameters only. The engines are identical.

---

## Security

### Does Boldash run shell commands?

Yes, during verification, but only commands declared in a workflow's `done.schema.json`. Undeclared commands are not executed.

### Does Boldash sandbox commands?

No. Sandboxing is the host's responsibility. See [`SECURITY.md`](../SECURITY.md).

### Does Boldash store secrets?

No. Evidence is scanned for common secret patterns and redacted before writing.

### How do I report a vulnerability?

See [`SECURITY.md`](../SECURITY.md). Do not open public issues for security vulnerabilities.

---

## Comparison

### How is Boldash different from plain prompts?

Prompts are suggestions. Boldash is enforcement. A prompt says "run tests before committing." Boldash blocks the commit when tests fail.

### How is Boldash different from a CI system?

CI runs after a push. Boldash runs before a commit or release. They are complementary.

### How is Boldash different from a policy engine like OPA?

OPA is a general-purpose policy engine. Boldash is a control plane for AI coding agents. Boldash includes a policy engine, but that is one of six components.

### How is Boldash different from a project management tool?

Project management tools track human work. Boldash tracks agent work with machine-readable state and deterministic verification.

---

## Roadmap

### When will Boldash be available?

v0.1.0 is planned. See [`ARCHITECTURE.md § 16`](../ARCHITECTURE.md#16-development-roadmap). No date is committed. The project ships when the foundation is correct, not on a schedule.

### Will there be a cloud version?

The core is local-first. A cloud offering is not planned for v0.1.0 through v0.4.0. It may be explored later, but the core will remain usable without it.

### Will Boldash support more hosts?

Yes. Adapters are pluggable. See [`ARCHITECTURE.md § 5`](../ARCHITECTURE.md#5-layer-1-host-adapters).

### Will Boldash support custom check types?

Planned for a future version via a plugin API. v0.1.0 uses the five built-in types.

### Will there be a GUI?

No. Boldash is a CLI. Markdown projections are the human-facing output.

---

## Contributing

### How can I contribute?

Read [`AGENTS.md`](../AGENTS.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

### I am an AI agent. How do I work on this repo?

Read [`AGENTS.md`](../AGENTS.md) first. It defines your contract.

### Can I propose a new workflow?

Yes. Open an issue describing the workflow and the problem it solves. Workflows ship as packs; they do not require changes to the core.

### Can I propose a new host adapter?

Yes. Implement `HostAdapter` and pass the shared contract test suite. See [`ARCHITECTURE.md § 5.2`](../ARCHITECTURE.md#52-adapter-interface).

### Can I propose an architectural change?

Open an issue first. If the change is significant, it needs an ADR. See [`AGENTS.md`](../AGENTS.md).

---

## Troubleshooting

### Boldash is too slow

Likely causes:

- Verification is running expensive commands. Cache results or narrow the checks.
- Many tasks are in `verifying`. Run `boldash verify --all` in CI, not on every commit.
- The host adapter is polling. Check `boldash doctor`.

### Boldash is too heavy

Switch to `lite`:

```bash
boldash init --profile lite
```

### Boldash is not enforcing

Check `boldash doctor`. If your host lacks `pre_tool_hooks`, enforcement is advisory.

### The agent ignores Boldash

Some hosts prioritize agent output over instruction files. In that case, Boldash runs as a CLI but the agent does not consult it. Add a pre-commit hook as a fallback.

### Everything is broken

```bash
boldash doctor --fix
```

If that fails, open an issue with the full `doctor` output.

---

## See Also

- [`README.md`](../README.md)
- [`PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md)
- [`ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`docs/getting-started.md`](./getting-started.md)
- [`docs/errors.md`](./errors.md)
