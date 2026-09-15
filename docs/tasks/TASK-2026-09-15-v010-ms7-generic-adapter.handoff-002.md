# Handoff Record 002 — DSH session (MS-7 S4) → maintainer sign-off of MS-7

- **Task ID**: `TASK-2026-09-15-v010-ms7-generic-adapter` (#7, `in_progress`) · **Slices done**: S1 ✅ S2 ✅ S3 ✅ S4 ✅ per plan-001 §3
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §3.4 · **Checkpoint**: `…ms7-generic-adapter.checkpoint-002.md`
- **Revision to validate against**: `origin/main` = `765d6d0` (S3 tip + boundary records, CI green). The S4 work is **local only**: `31d7c61` (docs truth pass) + the boundary commit containing this file. If this file is present on `origin/main`, the push GO was given — re-check `git log` and do not assume.
- **Nature of the work**: **docs only**. S4 changed no code, no schema, no error catalogue.

## Receiver validation checklist (complete BEFORE any conclusion)

- [ ] `git pull` · `git log --oneline -6` (expect `31d7c61` + a boundary commit above `765d6d0` if pushed); `git status` clean — records beat briefings; surface stale premises instead of coding over them
- [ ] `npm ci --cache /tmp/boldash-npm-cache && npm run verify` → exit 0, **364/364**, four stages (never read a gate through a pipe without `${PIPESTATUS[0]}`)
- [ ] Read order: `AGENTS.md` → this handoff + checkpoint-002 → `docs/STATE.md` → the MS-7 record (§3 AC results, §6 evidence) → `docs/cli-reference.md` §init → `docs/getting-started.md` §Initialize/§Your First Verification → `git show 31d7c61` (the docs diff)
- [ ] `gh issue view 7` — still OPEN, `priority/p1`
- [ ] Recite: rule 8 · R2 · R4 · R6 · R7 · R9 · two-arg `validateWorkflowPack` · briefing failure = `ADAPTER_INIT_FAILED` envelope · disclosed route-level exit-3 deviation · silence ≠ authorization · per-instance push naming · `date -u`
- [ ] Spot-check the honesty claim yourself: run `node dist/cli/main.js init --cwd <fresh git dir>` and `… verify <task>` and confirm the doc examples match the real output — the whole point of S4 was that these had drifted

## Sign-off procedure (MS-6 pattern; sign-off is not implicit)

1. Gate green on the boundary tip, checklist above complete.
2. Walk §3 of the record: AC-1…AC-4 are marked Satisfied with evidence pointers and annotated "maintainer sign-off pending" — that annotation is deliberate; the ACs are _self_-verified.
3. On the maintainer's explicit word: flip the record's Completion Gate to `completed` (Acceptance Results / Changed-File Summary / Completion Decision + timestamp), refresh `docs/STATE.md` (§§1/2/3/7/8), then close #7. MS-8 (#8) opens with its own plan — no MS-8 code before that.
4. Push remains a separate, explicitly named per-instance authorization. If it is withheld, the S4 commits stay local and that is a valid end state — record it as such rather than implying it was pushed.

## Known gaps the receiver must NOT paper over

- **Route-level capability exit-3 is unreachable in v0.1.0** (disclosed deviation, unchanged by S4): the route registry is built-ins-only, so AC-3 is proven through `workflow import` with the same `missingCapabilities` + context objects. R6 equality is pinned by the route PASS goldens; do not invent a route-level CAPABILITY_MISSING golden, and do not read the docs as promising one — `cli-reference.md` §route still shows the built-ins-only reality
- **Two stale-claim classes remain, by explicit non-expansion** (GO-S4 named its scope; these were found mid-flight and are recorded, not fixed): (1) `getting-started.md` §"A commit is blocked…" advises `boldash policy check` / `boldash explain` — both deferred, and the blocking scenario cannot occur in v0.1.0; (2) `getting-started.md` §"Reading the State" shows a `state list` table while the CLI prints the envelope dump. A ruling (fix now / fold into MS-9 integration docs / leave as roadmap prose) belongs to the maintainer
- **Half-completed init on briefing failure** stays half-completed by design: `.boldash/` exists, `AGENTS.md` missing, `ADAPTER_INIT_FAILED` exit 3; recovery is fix-permissions + `init --force`. Cli-reference now says exactly this — do not soften it into a warning
- **`workflow list` still shows only the 4 built-ins after import** (registry in memory until MS-8) — unchanged from MS-6 S4; not a docs bug, not to be "fixed" by re-reading files in a docs pass
- **`STATE.md` §5 still describes MS-4 as the current gate** and lists the closed GO-MS1–4 line — stale tracker prose from earlier milestones, left untouched (outside GO-S4 scope). Flagged for the sign-off refresh rather than silently rewritten
- **The docs now describe a CLI whose human output is raw envelope formatting** (init/verify/state list). That is an accurate description of a v0.1.0 UX rough edge, not an endorsement — a future display-formatting milestone may make `cli-reference`/`getting-started` examples obsolete again. When that happens, rewrite from a capture; do not patch prose
