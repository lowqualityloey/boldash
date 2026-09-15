# Checkpoint Record 001 — TASK-2026-09-15-v010-ms7-generic-adapter (session boundary: S3 → S4)

- **Task ID**: `TASK-2026-09-15-v010-ms7-generic-adapter` (#7) · **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §3.4 (init row), §5 MS-7, §8 briefing risk · **Plan**: `…ms7-generic-adapter.plan-001.md` (approved, R1–R9)
- **Checkpoint type**: Session boundary (slice-scoped GO: this instance received GO-S3 + a per-instance push GO naming `bf99c7e`/`29b2930` + evidence `2507e69`)
- **Branch / Revision**: `main` @ `2507e69` (= S3 feat `bf99c7e` + state `29b2930` + evidence `2507e69`), all pushed
- **Timestamp**: 2026-09-15 12:14 UTC (`date -u`)

## State

- **MS-7**: `in_progress` · #7 claimed · M2: MS-1…6 ✅ · **S1 ✅ S2 ✅ S3 ✅ / S4 open (doc-sync + boundary + sign-off; GO-S4 needed — final slice)**
- **Suite**: **364/364** four-stage gate green this session (11 new tests over S2's 353)
- **CI**: run 34966807770 @ `29b2930` — success ×3 matrices (node 20/22/24), headSha-asserted via `gh run watch --exit-status`
- **Working tree at this boundary**: clean except this record + handoff-001 (docs-only, push pending per-instance)

## Completed this session (S3, plan-001 §3 — AC-1, AC-3)

- **Briefing append in `runInit`** (AC-1): `appendBriefing(cwd)` lands last — after scaffold success, so every refusal path above mutates nothing. Envelope gains `briefing: { path, skipped }`. Failure → `ADAPTER_INIT_FAILED` exit 3 (catalogued `docs/errors.md` §Host Errors; field `adapter`; suggestion names `init --force` recovery) — never a swallowed warning, per AGENTS error-handling
- **Probe seam** (AC-3, ruling R6): new `src/cli/probe-context.ts` — `probeContext()` = `{ host: GENERIC_ADAPTER_NAME, capabilities: probeCapabilities() }`, fresh set per call. `route.ts` step 5 and `workflow.ts` validate/import now consume the adapter probe, not core's `genericContext()`; values equal the floor by construction — provenance moved, rule 8 intact (core imports nothing from `src/adapters/`)
- **`validateWorkflowPack(pack, context)`**: explicit `CapabilityContext` param; CAPABILITY_MISSING suggestion names `'<host>' adapter probe` as source; file header + capability comment rewritten to S3 truth
- **Registry honesty**: `init` description no longer claims "no briefing"; now states the AGENTS.md append + "Packs land in MS-8"
- **Tests (+11)**: `tests/golden/cli-init-briefing.test.ts` (fresh single block + envelope report · double `--force` coalesces, second skips · PromptKit block survives byte-for-byte prefix · no-`--force` re-run refuses exit 2 and touches nothing); AC-3 import golden in `cli-state-workflow.test.ts` (subagents-requiring pack → exit 3, `context: { missing, host: 'generic' }`, suggestion names probe, nothing written); `tests/unit/cli/probe-context.test.ts` (host identity, R6 equality with floor + probe, per-call freshness); 3 `runInit` briefing units (PASS, `--force` skip, BLOCK via `AGENTS.md`-as-directory → `ADAPTER_INIT_FAILED` exit 3 with scaffold honestly present)

## Decisions & invariants (bind the next session)

- **Briefing failure = error envelope, not warning**: two catalogued candidates were weighed (`IO_ERROR` in-file precedent vs warning-token in `genericAdapter.install`); chose `ADAPTER_INIT_FAILED` because errors.md documents it as exactly "adapter could not initialize" and AGENTS forbids silent swallowing. Half-completed state is honest: `.boldash/` exists, briefing doesn't; recovery is fix-permissions + `init --force`
- **Briefing order = after scaffold**: a failure then requires `--force` to recover; the alternative (before scaffold) was rejected because refusal checks gate on `.boldash/` existence and the load-bearing product is the state tree
- **`validateWorkflowPack` is no longer single-arg** — any future caller (MS-8 pack-directory registry?) must pass the probed context explicitly; do not restore a default floor import in core-adjacent code
- R6 unchanged: route-level CAPABILITY_MISSING stays unreachable through the CLI in v0.1.0 (route registry = built-ins only); the AC-3 e2e therefore rides `workflow import`, same `missingCapabilities` + context objects — this is a disclosed deviation from plan-001 §S3's "cli-route-state extension", NOT an omission
- Unchanged locked set: R9 only `AGENTS.md` gets a block · R4 idempotency is marker-scoped · silence ≠ authorization · per-instance push naming · `date -u` · read-bytes-before-write · gates never read through pipes without `PIPESTATUS`

## Anomalies & lessons (this session — for NOTES §6 mining)

1. **Prettier⇄edit loop (6th milestone)**: three new files drifted format again; batching `npx prettier --write` immediately before the gate stayed the working pattern
2. **`sed` with `|` delimiter fails on markdown table rows** (content contains pipes): use `#` delimiter for doc tables; a stray `/dev/null` expression was a no-op — proof the value came from `git diff`, not guesswork
3. **`--force` re-init keeps AGENTS.md**: `rmSync` targets only `.boldash/`, so the skip-side of idempotency is exercised by every `--force` test — worth remembering for MS-8 pack files

## Blockers

- None mechanical. Open gate: **GO-S4** (docs truth pass) — plan-001 §S4 scope; per-instance push authorization for this boundary's records

## Exactly one prioritized next action

**GO-S4 → docs truth pass** (`…ms7-generic-adapter.handoff-001.md`): cli-reference §init briefing truth + `--host` rule, getting-started init output + briefing section + verification-example rewrite (handoff-004 known gap), deferred-host honesty (R9), scope-note lines. No code changes; docs and tests ship together rule does not apply (docs need no tests) but every claim must trace to shipped behavior verified this session.
