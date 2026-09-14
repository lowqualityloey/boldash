# Contributing to Boldash

> **Audience:** Human contributors. If you are an AI coding agent, read [`PROJECT OVERVIEW.md`](./PROJECT%20OVERVIEW.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2 first — the principles there are your contract.
> **Status:** Boldash is pre-alpha. The design is documented. The runtime is not yet built. Some contribution paths below are forward-looking.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing Requirements](#testing-requirements)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Architecture Changes](#architecture-changes)
- [Documentation Changes](#documentation-changes)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Security Issues](#security-issues)
- [Code of Conduct](#code-of-conduct)
- [Getting Help](#getting-help)

---

## Ways to Contribute

Not everything is code. Boldash needs all of these:

| Contribution                  | Effort | Impact    |
| ----------------------------- | ------ | --------- |
| Report a bug                  | Low    | High      |
| Improve documentation         | Low    | High      |
| Propose a workflow pack       | Medium | High      |
| Propose a host adapter        | High   | High      |
| Write a verification contract | Medium | Medium    |
| Add a test                    | Medium | Medium    |
| Implement a CLI command       | High   | High      |
| Benchmark agent performance   | High   | Very High |
| Translate documentation       | Medium | Medium    |
| Review a PR                   | Medium | High      |

If you are unsure where to start, look for issues labeled `good first issue` or `help wanted`.

---

## Before You Start

Read these three files. In order.

1. [`README.md`](./README.md) — what Boldash is.
2. [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) — scope, audience, status.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the design.

You do not need to memorize them. You do need to know what problem the project solves and what it explicitly refuses to do (see [`ARCHITECTURE.md § 3`](./ARCHITECTURE.md#3-non-goals)).

If you have not read them, stop and read them now. Every PR that ignores the architecture will be closed with a pointer back to these documents.

---

## Development Setup

### Prerequisites

| Tool       | Version                       |
| ---------- | ----------------------------- |
| Node.js    | 20 LTS or later               |
| npm        | 10 or later                   |
| Git        | 2.30 or later                 |
| TypeScript | Provided by `devDependencies` |

Optional:

| Tool                                           | Why                                           |
| ---------------------------------------------- | --------------------------------------------- |
| `gh` CLI                                       | For GitHub integration tests                  |
| Claude Code, Cursor, or another supported host | For adapter integration tests                 |
| `jq`                                           | For inspecting JSON output during development |

### Clone and install

```bash
git clone https://github.com/lowqualityloey/boldash.git
cd boldash
npm install
```

### Build

```bash
npm run build
```

Output goes to `dist/`. The CLI entry point is `dist/cli/index.js`.

### Run locally

```bash
node dist/cli/index.js --help
# or, after `npm link`:
boldash --help
```

### Run tests

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run test:unit     # unit tests only
npm run test:contract # adapter contract tests
npm run test:integration # fixture-repo integration tests
```

### Lint and typecheck

```bash
npm run lint
npm run typecheck
```

### The release gate

Before proposing a change is complete, run:

```bash
npm run verify
```

This runs lint, typecheck, and the full test suite. **If `verify` fails, you are not done.**

---

## Project Structure

```
boldash/
├── src/
│   ├── cli/           # Commands and output formatting
│   ├── core/          # Router, State, Policy, Capabilities,
│   │                  # Verification, Workflow, Evidence
│   ├── adapters/      # Host-specific implementations
│   └── shared/        # Types, errors, constants
├── schemas/           # JSON schemas. The contracts.
├── workflows/         # Reference workflow packs
├── policies/          # Policy presets
├── bench/             # Benchmark suite
├── docs/              # User documentation
└── tests/             # Test suites
```

### Import rules

- `src/core/` must not import from `src/adapters/`.
- `src/core/` must not import from `src/cli/`.
- `src/adapters/` may import from `src/core/` and `src/shared/`.
- `src/cli/` may import from anywhere.

If you need host-specific behavior inside `core/`, define a capability instead of an import. See [`ARCHITECTURE.md § 5`](./ARCHITECTURE.md#5-layer-1-host-adapters).

---

## Making Changes

### Before writing code

For anything beyond a small fix:

1. Open an issue describing the problem or proposal.
2. Wait for a maintainer to confirm scope.
3. If the change touches architecture, open an ADR first (see [Architecture Changes](#architecture-changes)).

This is not bureaucracy. It prevents you from writing a large PR that cannot be merged because it conflicts with the design.

### While writing code

- Follow the conventions in this document (see [Import rules](#import-rules), [Commit Conventions](#commit-conventions), and [Test conventions](#test-conventions)). They apply to humans and agents alike.
- Run `npm run verify` frequently. Do not wait until the end.
- Keep commits small and focused. One logical change per commit.
- Write tests as you go, not after. Tests are part of the change, not a follow-up.

### Before opening a PR

- `npm run verify` passes.
- You have updated documentation if behavior changed.
- You have updated `CHANGELOG.md` under `[Unreleased]` if the change is user-visible.
- You have read your own diff. Every line. Twice.
- You have removed debug output, commented-out code, and TODOs you do not intend to address.

---

## Testing Requirements

Tests are not optional. Every change requires them.

| Change            | Required test                                                      |
| ----------------- | ------------------------------------------------------------------ |
| New CLI command   | Integration test against a fixture repository                      |
| New schema        | Schema validation test with valid and invalid fixtures             |
| New engine branch | Unit test for each branch                                          |
| New adapter       | Shared contract test suite                                         |
| Bug fix           | Regression test that fails before the fix                          |
| Refactor          | Existing tests pass unchanged                                      |
| Documentation     | None                                                               |
| Workflow pack     | Contract test that `manifest.yaml` and `done.schema.json` validate |

### Test conventions

- Test files live next to the code they test: `router.ts` → `router.test.ts`.
- Integration tests live in `tests/integration/`.
- Fixture repositories live in `tests/fixtures/`. Keep them minimal.
- One assertion per test where practical. A test that checks five things is five tests.
- Do not mock the filesystem. Use real temp directories and clean up.
- Do not mock the clock. Inject time when you need determinism.

### What "passing" means

Passing tests are evidence, not proof. If your change affects a verification gate:

- Add a test that confirms the gate **blocks** when it should.
- Add a test that confirms the gate **passes** when it should.

A gate that only passes is not a gate. See [`docs/verification-guide.md`](./docs/verification-guide.md).

---

## Commit Conventions

Boldash uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`, `revert`.

### Scopes

`cli`, `router`, `state`, `policy`, `capabilities`, `verification`, `workflow`, `evidence`, `adapter-claude`, `adapter-cursor`, `adapter-antigravity`, `adapter-generic`, `schemas`, `docs`, `bench`.

### Examples

```
feat(router): validate route proposals against capability set

Adds a check that fails routing when a workflow requires a capability
the host does not provide. Returns CAPABILITY_MISSING with the missing
capability list.

Closes #42
```

```
fix(state): prevent concurrent writes from clobbering version field

State transitions now use optimistic locking. A write that would
overwrite a newer version fails with CONCURRENT_MODIFICATION.

Fixes #51
```

```
docs(verification): add examples for migration and security contracts
```

### Rules

- Subject line under 72 characters.
- Subject line in imperative mood ("add", not "added").
- Body wrapped at 72 characters.
- Blank line between subject and body.
- Reference issues in the footer (`Closes #42`, `Fixes #51`, `Refs #17`).
- One logical change per commit. If you need "and" in the subject, split the commit.

---

## Pull Request Process

### Opening a PR

1. Fork the repository.
2. Create a branch: `git checkout -b feat/router-capability-check`.
3. Make your changes.
4. Run `npm run verify`.
5. Push and open a PR against `main`.

### PR description template

Every PR should answer:

```markdown
## What changed

One paragraph. What does this PR do?

## Why

One paragraph. What problem does it solve? Link the issue.

## How it was tested

- Commands run:
- Evidence produced:
- Edge cases covered:

## What is not covered

Known gaps, follow-ups, open questions.

## Checklist

- [ ] `npm run verify` passes
- [ ] Tests added or updated
- [ ] Documentation updated (if behavior changed)
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (if user-visible)
- [ ] Architecture section referenced (or ADR linked)
- [ ] No new dependencies, or justified in the description
```

### Review

- A maintainer will review within 7 days.
- Review comments are requests, not commands. Discuss them.
- If you disagree with a review comment, say so with reasoning.
- If a PR stalls, comment on it. Do not open a duplicate.

### Merging

- Squash merge by default. One PR, one commit on `main`.
- The PR title becomes the commit subject. Make it follow Conventional Commits.
- Maintainers merge. Do not merge your own PR unless you are a maintainer.

---

## Architecture Changes

A change is architectural if it:

- Adds, removes, or renames a core engine.
- Changes the state model, routing schema, or verification contract format.
- Changes how adapters interact with core.
- Changes the security model.
- Changes a design principle in [`ARCHITECTURE.md § 2`](./ARCHITECTURE.md#2-core-principles).

If your change is architectural, **do not open a PR first**. Open an ADR.

### Writing an ADR

1. Copy `docs/adr/template.md` (to be created; until then, follow the format in [`ARCHITECTURE.md § 8.4`](./ARCHITECTURE.md#84-decision-adr)).
2. Name it `docs/adr/ADR-NNN-short-title.md`.
3. Fill in: Context, Decision, Consequences, Alternatives considered.
4. Open a PR that adds only the ADR.
5. After the ADR is accepted, open the implementation PR.

An ADR that is still `proposed` does not authorize code. Wait for `accepted`.

---

## Documentation Changes

Documentation is code. It ships with the same rigor.

### Rules

- Docs and code ship together. A PR that adds a feature without docs is incomplete.
- Every new command gets a section in `docs/cli-reference.md`.
- Every new schema gets a section in `docs/state-model.md` or `docs/routing-contract.md`.
- Every new error code gets a section in `docs/errors.md`.
- Every architectural decision gets an ADR.
- Do not add a new `.md` file without a distinct audience and a distinct question. See [`PROJECT_OVERVIEW.md § Where to Read More`](./PROJECT_OVERVIEW.md#where-to-read-more).

### Style

- Second person ("you"), present tense ("the command returns").
- Active voice. "Boldash validates" not "the route is validated."
- Short sentences. One idea per sentence.
- Tables for comparisons. Lists for sequences. Prose for explanations.
- No marketing language. No "simply", "just", "obviously", "easy".
- Code fences for every command, JSON, YAML, and file tree.
- No screenshots unless the content cannot be expressed as text.

---

## Reporting Bugs

Open an issue using the bug report template. Include:

- **What you expected** — one sentence.
- **What happened** — one sentence.
- **Steps to reproduce** — numbered, minimal.
- **Environment** — OS, Node version, host agent, Boldash version.
- **Output** — paste the exact output, not a paraphrase.
- **`boldash doctor` output** — this is almost always relevant.

If you can reproduce the bug in a fixture repository, include it. A minimal reproduction is worth more than a detailed description.

**Do not open public issues for security vulnerabilities.** See [Security Issues](#security-issues).

---

## Requesting Features

Open an issue using the feature request template. Include:

- **The problem** — what are you trying to do that Boldash does not support?
- **Why current behavior is insufficient** — what have you tried?
- **A proposed solution** — optional. Describe behavior, not implementation.
- **Alternatives considered** — what else could solve this?

Feature requests are not commitments. A maintainer will triage and may close with a pointer to the non-goals.

If your request conflicts with [`ARCHITECTURE.md § 3`](./ARCHITECTURE.md#3-non-goals), explain why the non-goal should change. Do not assume it will.

---

## Security Issues

**Do not open a public issue for security vulnerabilities.**

Report via [GitHub Security Advisories](https://github.com/lowqualityloey/boldash/security/advisories/new) or see [`SECURITY.md`](./SECURITY.md) for the full policy.

Expect acknowledgment within 72 hours.

---

## Code of Conduct

This project follows the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md).

By participating, you agree to uphold it. Report unacceptable behavior to the contact listed in `CODE_OF_CONDUCT.md`.

Harassment, discrimination, and personal attacks are not tolerated. Neither is "just asking questions" in bad faith.

---

## Getting Help

| Question type                               | Where                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| "How do I use Boldash?"                     | Open a [Discussion](https://github.com/lowqualityloey/boldash/discussions) |
| "Is this a bug?"                            | Open an issue using the bug template                                       |
| "Should Boldash do X?"                      | Open an issue using the feature template                                   |
| "I want to contribute but don't know where" | Open a Discussion or comment on a `good first issue`                       |
| "Security vulnerability"                    | See [`SECURITY.md`](./SECURITY.md)                                         |
| "Code of conduct issue"                     | See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)                           |

Response times are best-effort. This is a small project. Be patient. If a week passes without a response, comment on your own issue to bump it.

---

## Recognition

Contributors are credited in release notes. Significant contributions are credited in the README's acknowledgements section.

There is no bug bounty at this time.

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE.md), the same license that covers the project.

---

Thank you for contributing. Boldash exists because people like you show up.
