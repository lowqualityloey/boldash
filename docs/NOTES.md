# Boldash — Project Notes & Working State

> Plain-Markdown working record (salvaged from the pre-reset tracker on 2026-09-14).
> Once `boldash` itself ships, canonical state moves to `.boldash/state/*.json` and generated
> `docs/STATE.md` projections (`ARCHITECTURE.md` §6.2, §7) — this file becomes that projection's
> hand-edited ancestor and can then retire.

## 1. Position

- **Phase:** Pre-alpha, design complete → implementation next.
- **Milestones** (mirrors `ARCHITECTURE.md` §16):
  - [x] **M1** — Design & Architecture corpus (`README`, `ARCHITECTURE`, `PROJECT OVERVIEW`, `SECURITY`, `LICENSE`, `CHANGELOG`)
  - [ ] **M2** — v0.1.0 Foundation: `init`, `route`, `state`, `verify`, generic adapter, v1 workflow import
  - [ ] **M3** — v0.2.0: policy engine, capability manager, Claude adapter, `doctor`, `explain`
  - [ ] **M4** — v0.3.0: event log, evidence storage, subagent protocol, Cursor adapter
  - [ ] **M5** — v0.4.0+: Antigravity adapter, workflow registry, benchmark suite, plugin API
- **Branch:** `main` (single maintainer: @lowqualityloey)

## 2. Document Authority Map

| Question about… | Authority |
|---|---|
| Agent contract & hard rules | `AGENTS.md` (root) |
| Product intent, audience, success metric, failure modes | `PROJECT OVERVIEW.md` |
| System design, engines, schemas, roadmap, testing | `ARCHITECTURE.md` |
| Public pitch & comparison | `README.md` |
| Contribution process, ADR rules, doc style | `CONTRIBUTING.md` |
| v0.1.0 surface: commands, flags, exit codes | `docs/cli-reference.md` |
| Route contract: schema, validation pipeline, risk→level map | `docs/routing-contract.md` |
| Verification: `done.schema.json`, check types, FACT/CLAIM typing | `docs/verification-guide.md` |
| Error catalog: stable codes → exit codes | `docs/errors.md` |
| User onboarding: 10-minute first task | `docs/getting-started.md` |
| Positioning Q&A / objections | `docs/faq.md` |
| Threat model & reporting | `SECURITY.md` |
| Working state & invariants | this file |

> The v1 engine is intentionally reinstalled (submodule + injected block between
> `PROMPTKIT_START/END` in `AGENTS.md`, lines 374–470). Its `docs/STATE.md` is a fresh
> unfilled template; this file remains the human working record until Boldash's own
> state engine replaces both.

## 3. Locked Invariants (Do Not Undo)

Source: `ARCHITECTURE.md` §2 (P1–P10) + Appendix B.

1. **P1** Separation of intelligence and enforcement — the LLM reasons; Boldash enforces. Never cross.
2. **P2** Canonical state is machine-readable JSON; Markdown is a projection, never the truth.
3. **P3** Deterministic work belongs outside the LLM — if a check can be code, it must not be a prompt.
4. **P4** Every gate returns an exit code; a gate that cannot block is a suggestion.
5. **P5** Zero ceremony for trivial work; risk determines ceremony.
6. **P6** Local-first, Git-native, no daemon, no database, no cloud core.
7. **P7** Model-agnostic; all model output schema-validated before trusted.
8. **P8** Graceful degradation — without Boldash the agent still works with reduced guarantees.
9. **P9** Tiny LLM interface — schemas/commands/errors fit in a few hundred tokens.
10. **P10** Every decision explainable via `boldash explain` with a traceable evidence chain.
11. **Tie-breaker** — *"The LLM proposes. Boldash validates, enforces, records, and verifies."* Any decision not serving that sentence is wrong.

## 4. Open Items

### Governance rulings (adopted — canonical copy; the 9 Task Records link here)

- [x] **Push-boundary conflict — resolved 2026-09-14 15:00 UTC, tracked as #11.** All 9 Task Records claimed `Human-only: … pushes …`, while `AGENTS.md` forbids only force-pushes and every completed milestone had in fact been pushed by the agent. The literal rule and the established pattern contradicted each other, so which file an agent happened to read first decided whether it asked or just pushed. Adopted:
  - **Human-only**: any merge into `main` from a branch or PR, force-pushes, releases, tags.
  - **Agent**: may commit to `main` after per-milestone maintainer sign-off; may **push** to `main` only under **explicit per-instance** authorization for that specific push.
  - **No standing rights.** Earlier pushes never imply the next one, and **silence is not authorization**. A push not named in the approval is a violation even when it is docs-only and even when its neighbour was approved — this session crossed that line once (`b58d86a`) and disclosed it; the wording now exists so the next session does not have to rediscover it.

### Still open

- [ ] `SECURITY.md`: replace `security@example.com` placeholder with a real contact (or delete the fallback line; GitHub Security Advisories is the preferred channel).
- [ ] `PROJECT OVERVIEW.md`: filename contains a space — consider `PROJECT-OVERVIEW.md` for link/CLI ergonomics.
- [ ] Resolve `ARCHITECTURE.md` §18 Open Questions that touch Phase 1 (during the v0.1.0 spec).
- [ ] First ADRs in `docs/adrs/`: runtime/tooling choice, state format, adapter contract.
- [ ] **Built-in workflow pack set conflicts three ways — #12.** RFC §5/MS-4 say 4 (`feature, bugfix, docs, chore`); `ARCHITECTURE.md` §10.3 says 8 (`+ refactor, migration, test, review, commit, release`, and no `docs`/`chore`); `ARCHITECTURE.md` §12 + `cli-reference.md:125` print 5 (`feature, bugfix, refactor, test, review`). Must settle before MS-6, whose golden tests assert that documented `init` output line. MS-4 implements the RFC's 4 and absorbs the discrepancy through D-1's injectable registry; `src/core/router/registry.ts`'s header records the compromise at the point of use.

### Doc-review findings (spec corpus read 2026-09-15 — for maintainer decision, not yet fixed)

- [ ] `faq.md` (×3) & `CONTRIBUTING.md` (×2) link to `PROJECT_OVERVIEW.md` (underscore); actual file is `PROJECT OVERVIEW.md` (space). Resolve by renaming the file or the links.
- [ ] `CONTRIBUTING.md` License section links `./LICENSE.md` — actual file is `LICENSE`.
- [ ] ADR directory drift: `CONTRIBUTING.md`/`AGENTS.md` say `docs/adr/` + `ADR-NNN-*.md`; existing scaffold is `docs/adrs/`. Pick one.
- [ ] Exit-code ambiguity: `VERIFY_COMMAND_TIMEOUT` is exit 12 (`errors.md`), but `verify` is documented as exiting only 0/1/2 (`cli-reference.md`, `verification-guide.md`). Decide: check-timeout ⇒ BLOCKED(1) or 12.
- [ ] `verification-guide.md` Rule 4 uses `timeout_ms` in checks, but the contract schema's check properties omit it — add the field.
- [ ] `errors.md` suggests `boldash state requirement add`, which `cli-reference.md` doesn't list — add or rename.
- [ ] `getting-started.md` init tree lists 2 state files; `cli-reference.md` init creates 4 (`project`, `tasks`, `decisions`, `evidence` JSON). Align.
- [ ] Forward links to `docs/state-model.md` and `docs/migration-from-v1.md` — planned, not yet written (expected; write during M2).

## 5. Known Risks

- `README.md` layout + `SECURITY.md` scope describe planned artifacts (`src/`, `schemas/`, …) that don't exist yet — acceptable only while clearly labeled "Planned".
- The project can stall at design phase (named failure mode). Mitigation: M2 exit criteria are small; next concrete step is the v0.1.0 spec, not more vision docs.

## 6. History

| Date | Event |
|---|---|
| 2026-09-14 | Lineage intake: Boldash confirmed as v2 successor to PromptKit OS v1 (different layer, not rewrite). |
| 2026-09-14 | Anomaly sweep: SECURITY filename typo, MIT license declaration, template placeholders populated. |
| 2026-09-14 | v1 engine (`.promptkit` submodule + directives) used briefly to dogfood the repo, then **fully removed in a history reset** — repo reborn as a pure Boldash design corpus (single initial commit, force-pushed). |
| 2026-09-15 | Lead Engineer intentionally reinstalled v1 (`submodule add + init.sh`, @v1.5.1-26) alongside new native `AGENTS.md`; authored the 7-doc v0.1.0 surface-spec corpus. |
| 2026-09-15 | `pk:plan` (L2/Full): v0.1.0 Foundation RFC — 9 milestones, 6 decision records, FMEA; §18-Q1 resolved (single `tasks.json`). Maintainer approved same session (TDD disabled; vitest+ajv@8+hand-rolled argv). |
| 2026-09-15 | `pk:tasks` → 9 records + issues #1–#9 (+#10 CODE_OF_CONDUCT gap). **MS-1 executed**: toolchain pinned, `npm ci && npm run verify` green, CI run 34848611604 success (node 20/22/24) → record `awaiting_review`. **Incident + lesson**: all 9 records were silently truncated to 0 bytes by an agent scripting bug — `open(f,"w").write(open(f).read()…)` performs the truncating open *before* the read — and committed empty; caught by cross-checking grep vs git log, restored fully. Standing rules: build content in memory before opening for write; assert non-zero byte counts after batch writes; never trust success prints that follow silent string-replaces. |
