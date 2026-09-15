# MS-7 Plan-001 — Generic adapter + init UX (slices S1–S4)

- **Task**: `TASK-2026-09-15-v010-ms7-generic-adapter` (#7, OPEN) · **Spec**: RFC §3.4 (init row), §5 MS-7 row, §4 FMEA (git-repo, probe), §8 briefing risk · **ARCH**: §5.2 interface, §5.3 matrix, §5.4 failures, §6.4 (capabilities → project.json)
- **GO**: maintainer "go" 2026-09-15 10:48 UTC (receiver session; slice approval pending — no code until plan approved)
- **Baseline**: `origin/main` = `5264d1a` (MS-6 completed, 319/319, CI green) · tree clean

## 0. Receiver checklist result (5/5 this session)

1. `git status` clean, `main` in sync with `origin/main` @ `5264d1a` — no stale premises.
2. MS-6 `completed` verified on disk (record Completion Gate + STATE §§1/2/3/7); #6 closed COMPLETED; #7 OPEN, body names this record authoritative.
3. Read order done: AGENTS.md (standing) → STATE.md → MS-7 record → RFC §§2–4 → ARCH §5 → cli-reference §init → getting-started briefing → errors.md Host Errors → `init.ts` → `scaffold.ts` → `capabilities.ts` (+ `route.ts`/`workflow.ts` consumers).
4. Invariants recited: P1–P10 · ajv-only (no YAML parser — ADR-0003) · core never imports adapters · silence ≠ authorization · per-instance push · `date -u` · gates never through pipes.
5. No contradictions found between record, RFC, and ARCH — except precision gaps closed by rulings R1–R9 below (presented for approval, not smuggled in).

## 1. What MS-7 builds (and what it does not)

`src/adapters/` does not exist yet — MS-7 creates it with exactly one adapter (`generic`).
Host-specific adapters (Claude/Cursor/…) stay Phase 2/3 per RFC §1.3 and record Non-Goals.

| #   | Work                                                              | ACs          |
| --- | ----------------------------------------------------------------- | ------------ |
| S1  | `adapter-types.ts` + `generic.ts` + contract suite; matrix oracle | (foundation) |
| S2  | `init` wiring: git refusal, probe→project.json, --host, warnings  | AC-2, AC-4   |
| S3  | Briefing append e2e + route/validate probe wiring                 | AC-1, AC-3   |
| S4  | Doc-sync + verification-example rewrite + boundary + sign-off     | (AC-6 equiv) |

## 2. Rulings for maintainer approval (nothing below ships without a yes)

- **R1 — "git true" means `git.read` only.** The record's probe shorthand resolves to the exact §5.3 Generic column, already encoded as `GENERIC_BASELINE` (`filesystem.read/write`, `shell.execute`, `git.read`, `human_approval`). `git.commit/branch/worktree`, `github`, `mcp`, `subagents`, hooks are false. The oracle test parses the matrix from ARCHITECTURE.md, so drift fails loudly.
- **R2 — `--host` accepts only `generic` in v0.1.0.** Any other value → `CLI_USAGE` exit 2 naming the supported set. Auto-detect sniffs env markers for the five named hosts solely to name them in the `HOST_UNKNOWN` warning (exit 0, `data.warnings`); the adapter is always generic. `--host generic` → no warning.
- **R3 — AC-2 reuses `CLI_PRECONDITION_FAILED` (exit 2).** No new error code. Matches FMEA "refuse with structured error". Detection lives in the adapter (`detectHost` reports `gitRepo`); the CLI refuses.
- **R4 — AC-1 idempotency is about the briefing block, not `--force`.** Markers present → append is a no-op (proven by double-append golden). `events.jsonl`/`config.yaml` scaffold paths are already idempotent. `--force` stays destructive by contract; re-run without `--force` keeps the MS-6 refusal (golden preserved).
- **R5 — AC-4 is write-side; MS-7 locks it.** Scaffold already persists `profile:` to `config.yaml` and `profile` to `project.json`; invalid `--profile` already exits 2. Runtime source of truth is `project.json` — `config.yaml` is a human mirror the core never parses (ADR-0003). No YAML parsing added.
- **R6 — route/validate consume the adapter probe, not new file reads.** Values equal today's floor; provenance moves to the adapter. Reading `project.json` capabilities inside the route path is deferred (MS-9/doctor scope). AC-3 is proven through the adapter-sourced context.
- **R7 — no new error codes expected.** Catalog reuse only (`errors.md` §Adding an Error Code enforced — a gap stops the slice and becomes a proposal, not a silent addition).
- **R8 — ARCH §5.2 followed verbatim** (async `install`/`diagnose`, hook no-ops). Generic cannot block → init output carries the advisory-mode note (§5.3 closing note).
- **R9 — only `AGENTS.md` gets a briefing block in MS-7.** `CLAUDE.md`/`.mdc`/others stay unwritten; docs updated to generic-only truth (deferred sections marked, same honesty rule as MS-6 S5).

## 3. Slice detail

### S1 — adapter module + contract suite (no CLI wiring)

- `src/adapters/adapter-types.ts`: `HostAdapter` (ARCH §5.2 verbatim), `CapabilityName` (13 literals from the §5.3 matrix), `CapabilitySet`, `DetectResult` (`adapter`, `detectedName?`, `gitRepo`, `warnings`), `BriefingResult`.
- `src/adapters/generic.ts`: `detectHost(cwd)` (env markers → name hint; `.git` presence; always resolves `generic`), `probeCapabilities()` (exact §5.3 Generic column), `appendBriefing(projectRoot)` (`AGENTS.md`, `BOLDASH_START/END` markers, create-or-append, markers-present → no-op, PromptKit coexistence by construction — markers never match `PROMPTKIT_` lines), `install`/`diagnose`/hook no-ops per §5.4.
- `src/adapters/index.ts` barrel; `src/adapters/contract-suite.ts` shared suite (AGENTS.md requirement) — every adapter must pass it; generic is its first subject.
- Tests: unit (detect × cases, probe oracle vs parsed matrix, append/create/no-op-duplicate/coexistence fixture, inconclusive→false) + contract suite green. Full gate green; no CLI changes, so all 319 existing tests untouched.

### S2 — init wiring (AC-2, AC-4)

- `runInit`: adapter `detectHost` first → not-a-repo → `CLI_PRECONDITION_FAILED` exit 2 (AC-2 golden: temp dir without `.git`); `--host` rule R2; probe → `project.json` `capabilities` fill (State Engine write path — scaffold extended, still the only writer); `HOST_UNKNOWN`/advisory warnings into `data.warnings`; envelope gains `adapter`, `capabilities`, `warnings` (additive — golden asserts updated, never loosened).
- AC-4 locks: golden `profile: lite` line in `config.yaml` + `project.json` profile field; invalid profile exit 2 (existing behavior, now pinned).
- Tests: unit (flag/warning matrix) + golden cli-init extensions (AC-2 refusal, AC-4 persist, warning envelope). Gate green.

### S3 — briefing e2e + route wiring (AC-1, AC-3)

- Briefing: golden double-`init --force` → exactly one marker block; pre-existing `AGENTS.md` with `PROMPTKIT_` markers → Boldash block appended, PromptKit bytes untouched; `state untouched` = second `init` (no `--force`) still refuses and modifies nothing.
- Route: `route` + `workflow validate` build context from the adapter probe (R6); golden `subagents`-requiring pack → `CAPABILITY_MISSING` exit 3 naming the adapter source (AC-3). Existing PASS paths unchanged.
- Tests: golden cli-init-briefing (new) + cli-route-state/cli-state-workflow extensions. Gate green.

### S4 — doc-sync + boundary + sign-off

- `cli-reference.md` §init: briefing truth (generic `AGENTS.md` block, markers, idempotent), `--host` rule, advisory note; scope-note line 7/68 updated.
- `getting-started.md`: init output (generic adapter + advisory), briefing section (generic-only; others marked deferred), verification-example rewrite (handoff-004 known gap — CLI renders envelope dump, example must match).
- `errors.md`: unchanged unless R7 breaks (then per-code tests first).
- Record AC results + evidence, STATE refresh, checkpoint + handoff, sign-off (tests are evidence, not proof).

## 4. Non-goals (stop-and-ask triggers)

Per-host adapters, `doctor` command, hook enforcement, YAML parsing, `project.json` reads in the route path, pack files (MS-8), policy/capability manager (M3). Any slice needing one stops and proposes instead.
