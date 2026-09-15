# Handoff Record 001 — DSH session (MS-7 S3) → GO-S4 docs truth pass

- **Task ID**: `TASK-2026-09-15-v010-ms7-generic-adapter` (#7, `in_progress`) · **Slices done**: S1 ✅ S2 ✅ S3 ✅ per plan-001 §3
- **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §3.4 · **Checkpoint**: `…ms7-generic-adapter.checkpoint-001.md`
- **Revision to validate against**: `origin/main` = `2507e69` (S3 tip: `bf99c7e` feat + `29b2930` state + `2507e69` evidence); boundary records (this + checkpoint-001) push pending

## Receiver validation checklist (complete BEFORE any edit)

- [ ] `git pull` · `git log --oneline -6` (top: boundary docs records or `2507e69`); `git status` clean — records beat briefings; surface stale premises, never code over them
- [ ] `npm ci --cache /tmp/boldash-npm-cache && npm run verify` → exit 0, **364/364** (four stages; never read a gate through a pipe without `${PIPESTATUS[0]}`)
- [ ] Read order: `AGENTS.md` → handoff-001 + checkpoint-001 → `docs/STATE.md` → MS-7 record + plan-001 (§S4 + R1–R9) → `docs/cli-reference.md` §init → `docs/getting-started.md` → `src/cli/{probe-context,commands/init,commands/workflow,commands/route}.ts` → `src/adapters/generic.ts`
- [ ] `gh issue view 7` — claimed, in_progress
- [ ] Recite: rule 8 (core never imports adapters; CLI is the seam) · R6 (probe provenance, values equal floor) · R9 (only AGENTS.md gets a block in MS-7) · R4 (idempotency is marker-scoped, `--force` stays destructive) · briefing failure = `ADAPTER_INIT_FAILED` envelope, never swallowed · `validateWorkflowPack(pack, context)` is two-arg · silence ≠ authorization · per-instance push naming · `date -u`

## Scope accepted by receiver

**GO-S4: docs truth pass** (plan-001 §S4 — docs only, no code):

- `cli-reference.md` §init: briefing truth (generic `AGENTS.md` block, `BOLDASH_START/END` markers, idempotent skip, `briefing` envelope field, `ADAPTER_INIT_FAILED` failure path), `--host` allowlist rule (R2: generic only), advisory note; scope-note lines (7/68) updated
- `getting-started.md`: init output (generic adapter + advisory + briefing), briefing section (generic-only; other hosts marked deferred per R9 honesty), **verification-example rewrite** — handoff-004 known gap: CLI renders the envelope dump, example must match
- `docs/errors.md`: no change expected — `ADAPTER_INIT_FAILED` already catalogued; S3 reused existing codes (finding, not omission)
- Gate stays 364/364 green (docs changes cannot break it, run it anyway); commit `docs(cli-reference)`-style, push needs per-instance GO

## Known gaps the receiver must NOT paper over

- **cli-route-state golden NOT extended** (disclosed deviation): route registry is built-ins-only, so route exit-3 is unreachable through the CLI in v0.1.0; R6 value-equality is pinned by existing route PASS goldens, provenance by `probe-context.test.ts` + the AC-3 import golden. Do not fake a route-level capability block
- **Half-completed init on briefing failure**: `.boldash/` exists, `AGENTS.md` missing — recovery is fix-permissions + `init --force`; if S4 docs describe this, describe it honestly
- `workflow list` still shows only built-ins after import (registry in-memory until MS-8) — unchanged from MS-6 S4 gap; do not "fix" in a docs pass
- Briefing content itself (the 5 lines inside `BRIEFING_BLOCK`) is S1-shipped text; S4 may align docs prose to it but must not edit the block without a fresh disclosure + golden re-check (byte-stability tests exist in the adapter contract suite)
- S4 is the final MS-7 slice and includes the boundary + maintainer sign-off procedure (plan-001 §3) — after it, MS-7 closes per the MS-6 pattern: record → `completed`, close #7, MS-8 (#8) opens with its own plan. Do not treat sign-off as implicit
