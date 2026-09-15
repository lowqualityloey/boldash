# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, Antigravity, Gemini CLI, OpenCode, etc.) working in the Boldash repository.

**Read this file before making changes.** It is the contract between you and the maintainers.

---

## Project Summary

Boldash is the deterministic control plane for AI coding agents. It sits between an agent and a software repository, validating routes, enforcing policy, tracking state, and verifying completion.

**Core rule:** The LLM proposes. Boldash validates, enforces, records, and verifies.

**Read first:**

1. `README.md` — what Boldash is
2. `PROJECT_OVERVIEW.md` — scope, audience, status
3. `ARCHITECTURE.md` — the full design

Do not start coding until you have read all three.

---

## Current Status

**Pre-alpha. Design phase. Not installable.**

| Component          | Status      |
| ------------------ | ----------- |
| Architecture       | Drafted     |
| Documentation      | In progress |
| JSON schemas       | Not started |
| CLI implementation | Not started |
| Tests              | Not started |
| Host adapters      | Not started |
| Benchmark suite    | Not started |

Most work right now is **specification**, not implementation. Do not build features that the architecture has not defined.

---

## Setup

Once the CLI exists (`v0.1.0`), the standard setup will be:

```bash
git clone https://github.com/lowqualityloey/boldash.git
cd boldash
npm install
npm run build
npm test
```

Until then, this repository contains documentation and schemas only. There is nothing to build.

**Runtime target:** Node.js 20 LTS or later.

---

## Commands (Planned)

When implementation begins, these commands will exist. Use them; do not invent alternatives.

| Command              | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `npm run build`      | Compile TypeScript to `dist/`                             |
| `npm test`           | Run the full test suite                                   |
| `npm run test:watch` | Watch mode                                                |
| `npm run lint`       | ESLint                                                    |
| `npm run typecheck`  | `tsc --noEmit`                                            |
| `npm run format`     | Prettier                                                  |
| `npm run bench`      | Run the benchmark suite                                   |
| `npm run verify`     | Lint + format check + typecheck + test (the release gate) |

**Before you propose any change is complete, run `npm run verify`.** If it fails, you are not done.

---

## Code Conventions

### Language and runtime

- **TypeScript**, strict mode.
- **Node.js 20 LTS** or later. Do not use APIs newer than the target.
- **ESM only.** No CommonJS.
- No top-level await in library code; it is allowed in CLI entry points.

### Style

- Prettier handles formatting. Do not argue with it.
- ESLint handles linting. Do not disable rules without a comment explaining why.
- Prefer `const` over `let`. Never `var`.
- Prefer named exports over default exports.
- No `any`. Use `unknown` and narrow.
- Every public function has a TSDoc comment.

### Naming

- Files: `kebab-case.ts` for modules, `PascalCase.ts` for classes-as-default-export (rare).
- Types and interfaces: `PascalCase`.
- Functions and variables: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level constants.
- JSON schemas: `kebab-case.schema.json`.

### Error handling

- Errors are values, not exceptions, at engine boundaries.
- Every engine returns a discriminated union: `{ ok: true, data }` or `{ ok: false, error }`.
- Error codes are `SCREAMING_SNAKE_CASE` strings and are documented in `docs/errors.md`.
- Never swallow an error silently. Log it as an event.

### State mutations

- All state writes go through the State Engine. Direct `fs.writeFile` on `.boldash/state/` is forbidden.
- All state mutations use write-temp-then-rename.
- All state mutations are recorded as events.

### Shell execution

- Shell commands must be declared in a workflow's `done.schema.json`. No ad-hoc `exec` calls.
- Every command has a timeout.
- stdout and stderr are captured as evidence.
- Never execute a command that is not declared in a contract.

### Security

- No network calls in the core. Adapters may make them, only with explicit user consent.
- No post-install scripts.
- Dependencies are pinned to exact versions. Do not use `^` or `~` in `package.json`.
- Every dependency addition requires a note in the PR explaining why the dependency is necessary.
- Run `npm audit` before proposing a merge.

---

## Architecture Rules

These are non-negotiable. If a task seems to require violating one, stop and ask.

1. **The LLM never verifies its own work.** Verification is deterministic. If a check can be code, it must not be a prompt.
2. **Canonical state is JSON.** Markdown is a projection, never the source of truth. Do not add a feature that treats Markdown as input to a decision.
3. **Every gate returns an exit code.** A check that cannot block is not a gate. Do not call something a "gate" if it only warns.
4. **The LLM-facing surface stays small.** If a change adds more than ~200 tokens to what the agent must read at routing time, justify it.
5. **No daemon. No database. No cloud.** State is files. Everything travels with the repository.
6. **Model-agnostic.** Do not assume any specific model's output format. Validate against schemas.
7. **Graceful degradation.** If Boldash is unavailable, the agent should still work with reduced guarantees. Do not create hard dependencies on the runtime.
8. **Adapters are the only place that knows about hosts.** Core code must not import from `src/adapters/`. If you need host-specific behavior in core, define a capability.
9. **Policy rules are pure.** They read state; they never mutate it.
10. **Every decision is explainable.** If `boldash explain` cannot justify a decision with recorded evidence, the design is wrong.

Full rationale in `ARCHITECTURE.md § 2`.

---

## Directory Layout

```
boldash/
├── src/
│   ├── cli/           # Commands, output formatting. Entry point.
│   ├── core/          # Router, State, Policy, Capabilities, Verification, Workflow, Evidence.
│   ├── adapters/      # Host-specific. Only place that knows about Claude, Cursor, etc.
│   └── shared/        # Types, errors, constants.
├── schemas/           # JSON schemas. The contracts.
├── workflows/         # Reference workflow packs.
├── policies/          # Policy presets.
├── bench/             # Benchmark suite.
└── docs/              # User-facing documentation.
```

**Rules:**

- `src/core/` must not import from `src/adapters/`.
- `src/core/` must not import from `src/cli/`.
- `src/adapters/` may import from `src/core/` and `src/shared/`.
- `src/cli/` may import from anywhere.
- Schemas are the source of truth for data shapes. Generate TypeScript types from schemas; do not hand-write them.

---

## Testing Requirements

Every change requires tests. No exceptions.

| Change type | Required tests                                |
| ----------- | --------------------------------------------- |
| New command | Integration test against a fixture repository |
| New schema  | Schema validation tests + fixtures            |
| New engine  | Unit tests for every branch                   |
| New adapter | Contract test suite (shared across adapters)  |
| Bug fix     | Regression test that fails before the fix     |
| Refactor    | Existing tests must pass unchanged            |
| Docs        | No tests required                             |

**Do not mark a task complete because tests pass.** Tests are evidence, not proof. If your change affects a verification gate, you must also verify the gate actually blocks on failure.

---

## What Agents Must Not Do

Explicit boundaries. Violating any of these is grounds for the change to be reverted.

- **Do not edit generated files.** Files under `docs/` that start with `<!-- GENERATED BY BOLDASH -->` are projections. Do not edit them by hand.
- **Do not add dependencies without justification.** Every new dependency is a liability. Explain why in the PR.
- **Do not bypass the State Engine.** Never write directly to `.boldash/state/`.
- **Do not run undeclared shell commands.** Every command must be declared in a contract.
- **Do not disable tests or lint rules.** If a rule is wrong, discuss it in an issue first.
- **Do not use `any`.** Use `unknown` and narrow.
- **Do not commit secrets.** Not in code, not in tests, not in fixtures, not in evidence.
- **Do not build features the architecture does not define.** If a feature seems missing, propose an ADR first.
- **Do not touch `LICENSE`, `SECURITY.md`, or `CHANGELOG.md` structure** without maintainer review.
- **Do not force-push to `main`.** Ever.

---

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`, `revert`.

**Scopes:** `cli`, `router`, `state`, `policy`, `capabilities`, `verification`, `workflow`, `evidence`, `adapter-claude`, `adapter-cursor`, `adapter-antigravity`, `adapter-generic`, `schemas`, `docs`, `bench`.

**Examples:**

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

**Rules:**

- One logical change per commit.
- Subject line under 72 characters.
- Body wrapped at 72 characters.
- Reference issues in the footer.

---

## Pull Request Expectations

Every PR must include:

1. **What changed** and why.
2. **Which architecture section** this aligns with (or which ADR justifies a change).
3. **How it was tested.** Commands run, evidence produced.
4. **What is not covered.** Known gaps, follow-ups, open questions.
5. **If it changes a gate:** proof that the gate blocks on failure.

PRs that cannot point to an architecture section will be asked to open an ADR first.

---

## When You Are Uncertain

Do not guess. Do not invent.

**If the architecture does not define a behavior:**

1. Stop.
2. Open an issue describing the gap.
3. Propose an ADR.
4. Wait for a decision.

**If the architecture defines a behavior you disagree with:**

1. Follow it.
2. Open an issue explaining the disagreement.
3. Do not silently deviate.

**If two architecture sections conflict:**

1. Treat it as a bug in the documentation.
2. Open an issue.
3. Ask which one takes precedence.

---

## Zero-Ceremony Principle

Boldash asks users to skip ceremony for trivial work. Apply the same standard to your own contributions.

- A typo fix does not need an ADR.
- A new workflow does.
- A refactor does not need a benchmark.
- A change to the verification engine does.

Match the weight of the process to the weight of the change.

---

## Host Adapter Rules

If you are working on an adapter:

- Adapters must implement `HostAdapter` from `src/adapters/adapter-types.ts`.
- Every adapter must pass the shared contract test suite.
- Adapters must declare capabilities honestly. Do not claim a capability the host does not provide.
- Adapters must degrade gracefully. If the host lacks `pre_tool_hooks`, the adapter must not pretend it can enforce.
- Never assume a specific host version. Detect features at runtime.

---

## Evidence and Verification

If your change affects verification:

- Add a test that confirms the gate blocks when it should.
- Add a test that confirms the gate passes when it should.
- Update `docs/verification-guide.md` if you add a new check type.
- Update `docs/errors.md` if you add a new error code.

Gates that do not block are worse than no gates. They create false confidence.

---

## Documentation Rules

- Every new command gets a section in `docs/cli-reference.md`.
- Every new schema gets a section in `docs/state-model.md` or `docs/routing-contract.md`.
- Every new error code gets a section in `docs/errors.md`.
- Every architectural decision gets an ADR in `docs/adr/`.
- Docs and code ship together. A PR that adds a feature without docs is incomplete.

---

## Relationship to PromptKit OS v1

Boldash is the successor to [PromptKit OS v1](https://github.com/lowqualityloey/promptkit-os). v1 workflows can be imported via `boldash workflow import`.

**Do not modify the v1 repository from Boldash work.** They are separate projects. If a change is needed in v1, it is a separate PR.

**Do not assume v1 behavior is correct.** v1 is a protocol specification, not a runtime. Where v1 says "the agent should check X," Boldash must replace that with a deterministic check.

---

## Reference: The One Rule

If you remember nothing else from this file:

> **The LLM proposes. Boldash validates, enforces, records, and verifies.**

Every decision you make in this repository should be traceable to that sentence. If a change does not serve it, the change is wrong.

---

## Contact

- **Issues:** https://github.com/lowqualityloey/boldash/issues
- **Security:** see `SECURITY.md`. Do not open public issues for vulnerabilities.
- **Discussions:** https://github.com/lowqualityloey/boldash/discussions

<!-- PROMPTKIT_START -->

## PromptKit OS: Engineering Operating System

PromptKit OS is active in this workspace (`./.promptkit`). Follow these protocols, workflows, and quality gates during pair-programming, design, code generation, and review:

### Fast Shorthand Triggers (Collision-Free)

Activate workflows anytime with these namespaced triggers:

- `pk:route`: Engineering lifecycle router and workflow decision matrix.
- `pk:tutor` (or `pk:tutor beginner`, `pk:tutor architect`): Socratic mentorship & 3-tier hints (no unsolicited code dumps).
- `pk:grill`: Intensive Staff Engineer architecture interview and defense drill.
- `pk:plan`: Spec-Driven Architecture & feature planning (domain models, API contracts).
- `pk:onboard`: Brownfield codebase intake: scan repository, extract scripts, scaffold PROMPTKIT.md.
- `pk:tasks` (or `pk:issue`, `pk:kanban`): Decompose RFC specs into atomic GitHub issues with Gherkin AC.
- `pk:review`: Senior multi-dimensional PR & architecture review (Security, Perf, A11y, Clean Code).
- `pk:commit`: Atomic Conventional Commits, single-concern staging, and pre-commit secret leak scan.
- `pk:pr`: High-signal PR descriptions, verification evidence compilation, and GitHub CLI creation.
- `pk:debug`: Hypothesis-driven scientific debugging & root cause analysis (5-Whys).
- `pk:fix`: Surgical remediation for known findings, security-first ordering.
- `pk:refactor`: Structural debt remediation, Golden Master pinning, Mikado method.
- `pk:perf`: Empirical performance profiling, latency SLAs, EXPLAIN ANALYZE.
- `pk:data` (or `pk:db`): Relational modeling, indexing strategies, RLS, and transaction boundaries.
- `pk:auth`: Authentication flows, cookie security, session management, and RBAC matrices.
- `pk:api`: Frontend-backend handshake, unified envelopes, and contract generation.
- `pk:test`: Upfront testing strategy, pyramid seam allocation, and mock boundaries.
- `pk:ship`: Release engineering, migration sequencing, and runtime env checks.
- `pk:spike` (or `pk:research`): Technical spikes, benchmarks, and multi-vector trade-off matrices.
- `pk:design`: Modern UI/UX, Design Tokens, and WCAG 2.2 Level AA accessibility.
- `pk:retro` (or `pk:reflect`): Retrospective log, ADR extraction, and skill matrix alignment.
- `pk:checkpoint` (or `pk:handoff`): Session state compaction, docs/STATE.md update, and handover prompt.
- `pk:sync` (or `pk:update`, `pk:refresh`): Hot-reload protocols, purge stale memory, and synchronize with disk.
- `pk:profile`: Switch Lite/Balanced/Turbo profile at runtime via the idempotent installer re-injection path.

### Smart Auto-Route & Guardrails (Triggers Are Optional)

You do not need to memorize triggers. If a prompt lacks an explicit `pk:` trigger, apply this triage:

- **Fast-Path (Zero Overhead)**: For simple questions, lookups, formatting, or single-line tweaks, answer directly. No heavy ceremony. **Risk-before-size**: 1-line security or data edits escalate immediately.
- **TL;DR-First Output**: Start every substantive turn with TL;DR 1-3 bullets (≤40 words: outcome+next), then Details (tables/checklists/file:lines), then Next. Grade-8 plain (outcome first, jargon second in parens). No paragraph >3 lines, no essay walls. L0 exempt; L2/L3 evidence never shortened. `TL;DR` live only; `Session Summary` checkpoint-only.
- **Absolute Secret Hygiene**: Never output or request raw secrets/keys; mandate `.env.example` templates and local `.env`.
- **Session Endurance**: Nudge at ~15 substantive turns, hard checkpoint at ~30 turns / 90min (L2/L3 hard, L1 advisory). Whenever you cannot recite invariants from a current `docs/STATE.md` read, run `pk:checkpoint` and recommend a fresh session.
- **STATE.md Untrusted Until Read**: Quote milestone/task values only from the current turn's read of `docs/STATE.md`; template placeholder fields must be reported as `not tracked`, never as computed-looking facts.
- **Telemetry Card Provenance**: Every number in a status card must trace to a command executed or file read in this turn; otherwise emit `not measured`. Never claim a green Quality Gate without an executed check this turn.
- **Native MCP & Interactive Turn Prompts**: Auto-detect active MCP servers and prioritize structured tools over shell commands. For branching choices or next steps, invoke native selection tools (e.g. `ask_question`) if supported; otherwise format max 3-4 priced choices under `> [!TIP] ### 💡 Next Steps (Type number & Enter):` with Option 1 `(Recommended + why)`. Each option = action + outcome + time + requirement, plus safe exit (show details, no changes). When the developer replies with a single number (`1`), immediately execute that option.
- **Dual-Compatible Telemetry Status Cards**: Single 3-line blockquote spec: `> 📊 Milestone: <name> [████░░] n/m (pct%) — source: STATE.md read this turn` / `> 🎯 Active: <task>` / `> 🟢 Quality Gate: <measured this turn / not measured>`. Text fallback `(n of m done)` for screen readers.
  Halting for human decisions uses `> [!IMPORTANT]` titled `### 🛑 Action Required From You:` (PR links as `[#N — title](url)`, no HTML). Blocked states use `> [!WARNING]` titled `### ⚠️ Blocked: Waiting on Human Input:`. Milestone completion / next lifecycle recommendations (e.g. `pk:checkpoint`, `pk:pr`, `pk:tasks`) use `> [!TIP]` titled `### 💡 Next Recommended Step:`. Always prefix callouts with `> ` (never bare `[!TIP]`), zero raw HTML, perfect rendering across all terminal CLIs and IDEs.
- **Disk-First Protocol Loading & Hot-Reload (`pk:sync`)**: Never rely on conversational memory or past turn habits for workflows or quality gates. Always read `.promptkit/workflows/<trigger>.md` freshly from disk. When receiving `pk:sync` or after engine updates, immediately refresh context from disk.
- **Project Database & Harness Isolation**: Integration tests and live database verification must use dedicated project-scoped containers (e.g. `./docker-compose.yml` or project-named instances). Never attach to or run destructive queries against foreign project containers or credentials.
- **Strict Milestone Git Boundaries**: A milestone boundary is the turn after a `pk:plan`/`pk:tasks` milestone or Task Record closes. Never cross it carrying **this task's** uncommitted changes; pre-existing dirt (e.g., fresh `init.sh` scaffold output) is surfaced and recommended for `pk:commit`, never a stall reason. At milestone end: stage atomically (`pk:commit`), update `docs/STATE.md`, request human sign-off (`> [!IMPORTANT]`).
- **Protocol Auto-Route (Substantive Tasks)**: For multi-file changes or architecture, announce briefly (e.g. `[PromptKit OS: Auto-routed to pk:plan]`) and adopt the matching workflow:
  - Defects, bugs, crashes, test failures -> `pk:debug`
  - Known defects, review findings, security patches -> `pk:fix`
  - Code refactoring, structural cleanup -> `pk:refactor`
  - Performance regressions, latency -> `pk:perf`
  - New features, redesigns -> `pk:plan`
  - Repo intake, setup, audit -> `pk:onboard`
  - Task breakdowns, issue creation -> `pk:tasks`
  - DB schema, indexing, migrations -> `pk:data`
  - Auth, sessions, cookies, RBAC -> `pk:auth`
  - Endpoints, contracts, client types -> `pk:api`
  - Test suites, seam allocation, mocking -> `pk:test`
  - Code audits, PR reviews -> `pk:review`
  - Git commits, staging -> `pk:commit`
  - Pull requests, PR descriptions -> `pk:pr`
  - Context bloat, session handover -> `pk:checkpoint`
  - Deployments, env validation, releases -> `pk:ship`

### Workflows & Protocols Reference

Load lazily by convention — never preload:

- Workflow: `.promptkit/workflows/<trigger>.md` (e.g. `pk:plan` -> `workflows/plan.md`, `pk:design` -> `workflows/design-system.md`)
- Trigger-to-file exceptions (the convention alone would misresolve these): `pk:spike` -> `research.md`, `pk:retro` -> `reflect.md`, `pk:grill` -> `tutor.md`, `pk:design` -> `design-system.md`; all other triggers match their file name.
- Protocols: `.promptkit/protocols/{setup,context-sync,code-quality-gate,subagent-delegation}.md`
- Router: load `.promptkit/workflows/route.md` only when routing is ambiguous or Level 3 escalation/downgrade rules are needed
- Project files: `./PROMPTKIT.md`, `./DESIGN.md`, `./docs/STATE.md` (if present)

### Task Ceremony Levels (classify here — do not load route.md to decide)

Declare on line 1 of Turn 1: `[PromptKit OS: Level <0-3> (<Name>) — <1-line reason>]`

- **L0 Direct**: questions, lookups, doc typos, formatting, non-risky 1-line edits. `understand -> change -> verify`. No task record. Risk-before-size: 1-line security/data edits escalate.
- **L1 Standard**: localized bug fix, small self-contained feature, no schema/auth/breaking contract. Inline planning; no Task Record file.
- **L2 Controlled**: schema/migrations, auth, permissions, public contracts, multi-component. Requires `docs/tasks/<task-id>.md` + spec before implementation.
- **L3 Release-Critical**: release, tag, deploy, high-impact contract change. Requires L2 evidence + `pk:ship` + explicit human approval.
- **Escalate** immediately if scope grows into persistent data, auth, public contracts, or multiple components. **Ties take the higher level.** Downgrades must be announced with a one-line reason; silent downgrade is a protocol violation. `workflows/route.md` remains the canonical authority for these rules and for downgrade guardrails.

### Project Artifact Output Paths

All generated project documentation must be saved to the host project:

- State Tracker: docs/STATE.md
- ADRs: docs/adrs/
- Technical Specs: docs/specs/
- Task Breakdowns: docs/tasks/
- Post-Mortems: docs/rca/
- Spikes: docs/spikes/
- Design Specs: docs/design/
- Data Models: docs/data/
- Auth Specs: docs/auth/
- API Contracts: docs/api/
- Test Plans: docs/tests/
- Review Reports: docs/reviews/
- Performance Audits: docs/perf/
- Releases: docs/releases/
- CI Triage Evidence: docs/releases/ci-triage/

<!-- PROMPTKIT_END -->
