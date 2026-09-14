# Implementation Plan 001 — MS-4 Router (proposal only)

- **Task ID**: `TASK-2026-09-15-v010-ms4-router` · **Issue**: #4
- **Specification**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §5 (MS-4 row)
- **Canonical surface doc**: `docs/routing-contract.md`
- **Author**: DSH agent session · **Created**: 2026-09-14 14:48 UTC (`date -u`)
- **Status**: **PROPOSAL — awaiting GO-MS4.** No `src/` file was created or modified while
  writing this. MS-4 Execution State remains `planned`; the pointer is unclaimed.

## 0. Verification baseline at time of writing

| Item | Value | Source |
|---|---|---|
| Revision | `eb87c7e` == origin/main | `git rev-parse` |
| Gate | `npm run verify` exit 0 · lint 0 · tsc 0 · **42/42** | executed this session |
| CI | `completed/success` on headSha `eb87c7e` | `gh run list` (exact-sha match) |
| Runtime deps | `ajv@8.20.0` only | `package.json` |
| Catalog parity | `src/shared/errors.ts` ≡ `docs/errors.md`, proven by doc-as-oracle test | `tests/unit/errors.test.ts` |

## 1. Inputs and provenance (nothing below is inferred)

| Fact used | Where it comes from |
|---|---|
| 7 pipeline steps + which error each emits | `docs/routing-contract.md` §The Validation Pipeline |
| Every step returns `{ok:true,data}` / `{ok:false,error}`; no exceptions cross the boundary | same section, closing line |
| The 4 example payloads to use verbatim | §Examples: `Valid: feature, medium risk` · `Valid: trivial chore` · `Invalid: level too low for risk` · `Invalid: missing capability` |
| Success payload shape (exactly 3 fields) | §What the Agent Sees |
| Risk→level map, one-way (higher allowed, lower rejected) | §Level and Risk |
| Token claim "~60 success / ~100 failure" | §Token cost |
| `route.schema.json` exists; `task.type` enum has 8 values incl. `migration`; `route.workflow` is a **free string** (not an enum) | `schemas/route.schema.json` |
| Exits: `WORKFLOW_NOT_FOUND 2` · `LEVEL_RISK_MISMATCH 2` · `SCOPE_FILE_NOT_FOUND 0 // warning` · `CAPABILITY_MISSING 3` | `src/shared/errors.ts` lines 17–30 |
| Generic host has `filesystem.read/write`, `shell.execute`, `git.read`, `human_approval`; **lacks** `git.commit`, `git.branch`, `git.worktree`, `github`, `mcp`, **`subagents`**, `pre/post_tool_hooks` | `ARCHITECTURE.md` §5.3 matrix, Generic column |
| Pack declaration format `workflows/<name>/manifest.yaml` with `requires:`/`optional:` | `ARCHITECTURE.md` §5.3 |
| RFC scope: "7-step pipeline, built-in registry (**4 packs**), risk→level map, capability context (generic host)" | spec §5 MS-4 row |

## 2. Module design

```
src/core/router/
  types.ts        # RiskLevel, WorkflowPack, CapabilityContext, RoutingInput,
                  # ResolvedRoute, RoutingWarning, PipelineStep
  levels.ts       # REQUIRED_LEVEL_BY_RISK + requirementsFor(level, risk) + overrides
  registry.ts     # WORKFLOW_PACKS (4 built-ins) + WorkflowRegistry interface + createRegistry()
  capabilities.ts # GENERIC_BASELINE + hasRequired(pack, ctx)
  scope.ts        # checkScope(files, {cwd, mode, fileExists})
  pipeline.ts     # route(): the 7 ordered steps
  index.ts        # named re-exports (public surface)
workflows/        # 4 pack directories (see decision D-2)
tests/unit/router/*.test.ts
```

Rules honoured: `src/core/router/` imports **only** from `src/shared/` (no `adapters/`,
no `cli/`, no `core/state/`). No `any`; `unknown` + narrowing on all JSON input. Every
exported function gets TSDoc. `ajv` stays confined to `shared/schema.ts` — the router calls
`getValidator('route')` and never touches ajv directly. No new runtime dependency.

## 3. Pipeline → behaviour map

| # | Step | Failure | Exit | Notes |
|---|---|---|---|---|
| 1 | Parse JSON | `SCHEMA_PARSE` | 2 | input arrives as text; malformed → step 1 error |
| 2 | Validate vs `route.schema.json` | `SCHEMA_VALIDATION` | 2 | ajv instancePath → dotted `field` (e.g. `route.level`) |
| 3 | Workflow in registry | `WORKFLOW_NOT_FOUND` | 2 | `context.enabled` = registered names (AC-4) |
| 4 | Level consistent with risk | `LEVEL_RISK_MISMATCH` | 2 | `field: "route.level"`, suggestion "Raise level to N." |
| 5 | Requirements vs capabilities | `CAPABILITY_MISSING` | 3 | `context.missing: string[]` (the list, per P4/AC) |
| 6 | Scope files exist | `SCOPE_FILE_NOT_FOUND` | **0** | warning channel, never a `Result` failure |
| 7 | Emit `ResolvedRoute` | — | 0 | `{workflow, level, requirements}` |

Step 3 preceding step 5 is load-bearing for the test design in §6 (see D-1).

## 4. Level and requirements derivation

Required level (from §Level and Risk): `trivial 0 · low 1 · medium 2 · high 3 · critical 3`.
Guard: `proposed >= required` (higher permitted, lower → step-4 error).

| Level | task_record | specification | tests | review | human_approval |
|---|---|---|---|---|---|
| 0 | false | false | false | false | false |
| 1 | true | false | false | false | false |
| 2 | true | true | true | false | false |
| 3 | true | true | true | true | risk-dependent |

`human_approval` is forced `true` when `risk === "critical"` (the "3 **+ human approval**"
row). Level-2 row reproduces the documented success payload field-for-field.
`route.requirements` overrides individual booleans; it may only **add** ceremony — an
override that removes a level-required key is rejected at step 4 rather than silently
honoured (see D-3 note in §8).

## 5. Registry and capability context

`WorkflowRegistry` is an interface, not a singleton: `get(name)`, `names()`, and
`createRegistry(packs = WORKFLOW_PACKS)`. That seam exists because the pipeline must be
testable with a pack the built-ins do not ship (D-1) and because MS-8's importer must
register packs it writes.

The 4 built-ins (`feature`, `bugfix`, `docs`, `chore`) require **only** capabilities the
Generic column grants. If any required `git.commit` or `subagents`, every built-in would
fail step 5 on a generic host — a P8 graceful-degradation violation. This constraint is
asserted in a test, not just stated here.

## 6. Test plan (every gate proves PASS **and** BLOCK)

No mocked `fs`, no mocked clocks (inherited invariant). File-existence tests run against
real temp directories created with `mkdtemp`; the `fileExists` seam is a real predicate
over that directory, not a stub returning canned values.

| Test | Fixture | Asserts |
|---|---|---|
| T-1 example 1 valid feature/medium | literal JSON, §Examples | `ok:true`; data **deep-equals the documented payload** |
| T-2 example 2 trivial chore | literal JSON | `ok:true`; all requirements false |
| T-3 example 3 level too low | literal JSON | `ok:false` `LEVEL_RISK_MISMATCH`, `field:"route.level"`, message contains "requires level 3", exit 2 |
| T-4 example 4 missing capability | literal JSON + registry containing a `migration` pack requiring `subagents`, generic context | `ok:false` `CAPABILITY_MISSING`, `context.missing==["subagents"]`, exit 3 |
| T-5 same payload, **default** registry | literal JSON | `ok:false` `WORKFLOW_NOT_FOUND` (step 3 fires first) + `context.enabled` lists exactly the 4 built-ins |
| T-6 malformed JSON | `"{"` | `SCHEMA_PARSE`, no throw |
| T-7 schema-invalid | `{}`; `route.level: 9`; unknown key (`additionalProperties:false`) | `SCHEMA_VALIDATION` with the offending dotted path |
| T-8 BLOCK half of step 3 | 4 built-ins registered | each resolves (PASS); a 5th unknown name fails (BLOCK) |
| T-9 higher-level-allowed | `risk:trivial, level:3` | passes with level-3 requirements (one-way rule) |
| T-10 scope PASS/BLOCK | temp dir with `README.md`, asking for `README.md` + `src/x.ts` | PASS silent; missing → warning **only**, `ok:true`, exit 0 (AC-3) |
| T-11 greenfield mode | empty dir | no warning raised |
| T-12 token budget (AC-2) | payloads from T-1, T-2 | `JSON.stringify(data).length/4 <= 80`; also measured on **pretty-printed** form (worst case) |
| T-13 built-ins safe on generic | all 4 packs | none yields `CAPABILITY_MISSING` |

Measured now against the doc's own success payload: compact **159 B → 39.8 tokens**,
pretty **234 B → 58.5 tokens**; both inside the 80 budget with headroom. (Side note: the
doc's "~100 tokens" claim for a failure payload measures 251 B → 62.8 tokens; prose
approximation, not a gate — flagged for the MS-9 docs audit.)

## 7. Acceptance-criteria traceability

| AC | Covered by |
|---|---|
| AC-1 all 4 examples as tests | T-1 … T-4 (+T-5) |
| AC-2 success payload ≤ 80 tokens | T-12 |
| AC-3 `SCOPE_FILE_NOT_FOUND` warning-only, exit 0 | T-10, T-11 |
| AC-4 unknown workflow → `WORKFLOW_NOT_FOUND` with enabled list | T-5, T-8 |

## 8. Three gaps requiring your ruling before code

**D-1 — the CAPABILITY_MISSING example cannot be reached on the default registry.**
Example 4 routes `workflow: "migration"`, but the RFC fixes the built-in registry at
**4 packs** (feature/bugfix/docs/chore) and `migration` is not one of them — while
`migration` *is* a valid `task.type`. Step 3 runs before step 5, so on the default registry
that payload returns `WORKFLOW_NOT_FOUND`, never `CAPABILITY_MISSING`.
*Recommendation*: keep 4 packs; make the registry injectable (§5); test the literal payload
both ways (T-4 with an injected `migration` pack, T-5 with the default). No scope change,
both documented behaviours proven. *Alternative*: add `migration` as a 5th built-in, which
needs a Scope Change Record against the RFC "4 packs" line.

**D-2 — `manifest.yaml` collides with the ajv-only runtime dependency.**
`ARCHITECTURE.md` §5.3 specifies packs as `workflows/<name>/manifest.yaml`, but no YAML
parser is available and adding one breaches the ajv-only invariant — **this needs a
decision, not a silent workaround**.
*Recommendation*: ship the 4 built-ins as typed constants in `registry.ts` (zero parsing,
zero deps, deterministic), declare the `WorkflowPack` shape now, and defer the pack **file**
format to MS-8 — where packs are produced anyway — under its own ADR.
*Alternatives*: (b) hand-rolled subset parser, following the ADR-0004 precedent that
"dependencies are liabilities"; (c) `manifest.json` today, deviating from the §5.3 naming.

**D-3 — warnings have no home in the documented payload.**
Step 6 must report missing scope files without failing, but §What the Agent Sees fixes the
success payload to exactly `{workflow, level, requirements}`.
*Recommendation*: add an optional `warnings?: RoutingWarning[]` present **only when
non-empty**, so T-1/T-2 payloads stay byte-identical to the docs. Being additive to a
documented contract, this requires one new line in `routing-contract.md` in the same commit
(docs and code ship together). Router stays stateless — it writes no events and no state;
logging is MS-6's CLI concern (RFC links MS-4 to MS-2 only).

## 9. Explicitly out of scope for MS-4

Policy engine and `policies/` presets (RFC §1.3; the risk→level map's "configurable in
`policies/`" note is deferred), CLI `route` command and serialization (MS-6), host adapters
and real capability probing (MS-7), workflow import (MS-8), benchmarks, any release/tag.

## 10. Sequencing on GO

1. Patch MS-4 record `planned → ready → in_progress`; claim the pointer (backticked, per
   the MS-3 retry lesson).
2. `types.ts` + `levels.ts` + their tests (T-9 first — cheapest pure logic).
3. `registry.ts` + `capabilities.ts` (T-13, T-4, T-5).
4. `scope.ts` (T-10, T-11).
5. `pipeline.ts` (T-1…T-8, T-12).
6. Docs line for `warnings` (D-3) + `npm run verify` + commit `feat(router): …` with the
   diff proposed for sign-off before staging.

Estimated 14–18 test cases, ~350–450 lines of source. No migration, no persistent state,
no new dependency — low risk, as the record's Risk field says.

## 11. Invariants this plan protects

- **P3/P4** every failing step returns a code and a real exit; step 6 is deliberately *not*
  called a gate because it cannot block.
- **P7** all input schema-validated before trusted.
- **P9** payload shape pinned to the doc; AC-2 measured, not asserted by faith.
- **Structure permits, lifecycle enforces** — the level guard and capability guard live in
  the pipeline, so no catalog error is orphaned (the MS-3 lesson, applied pre-emptively:
  all 4 routing codes already exist and all 4 are reachable).
- **ajv-only** — D-2 is surfaced instead of quietly consuming a dependency.
- **PASS + BLOCK per gate** and **no mocked fs/clocks** in §6.
- **Post-write read-back** on every record patch in step 1.
