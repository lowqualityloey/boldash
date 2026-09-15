# Checkpoint Record 002 — TASK-2026-09-15-v010-ms7-generic-adapter (session boundary: S4 → maintainer sign-off)

- **Task ID**: `TASK-2026-09-15-v010-ms7-generic-adapter` (#7) · **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §3.4 (init row), §5 MS-7, §8 briefing risk · **Plan**: `…ms7-generic-adapter.plan-001.md` (approved, R1–R9)
- **Checkpoint type**: Session boundary (final slice: this instance received a fresh GO — `GO-S4 as planned`, incl. the two flagged honesty items, with push explicitly deferred to a separate per-instance GO)
- **Branch / Revision**: `main` @ `765d6d0` (receiver baseline) + `31d7c61` (S4 docs) + this boundary commit — **local, unpushed**
- **Timestamp**: 2026-09-15 12:40 UTC (`date -u`)

## State

- **MS-7**: `in_progress` · #7 OPEN · M2: MS-1…6 ✅ · **S1 ✅ S2 ✅ S3 ✅ / S4 ✅ executed (docs truth pass)** — no code open; **maintainer sign-off is the only remaining gate**
- **Suite**: **364/364** four-stage gate exit 0 re-run on the S4 tip (lint 0, format:check 0, typecheck 0, 34 files) — docs-only change, run anyway per handoff-001
- **Working tree at this boundary**: clean apart from this record + handoff-002 (docs-only, unpushed)
- **Receiver checklist (handoff-001)**: 5/5 — clean tree, gate green, full read order, #7 OPEN, invariants recited

## Completed this session (S4, plan-001 §3 — AC-6 equivalent: doc-sync + boundary)

- **`docs/cli-reference.md` §init rewritten to shipped behavior**: git-working-tree precondition (AC-2, `CLI_PRECONDITION_FAILED` exit 2), `AGENTS.md` briefing in **Creates** + a `### Briefing` subsection (markers, create/append/skip semantics, byte-stability, R9 generic-only, deferred per-host files), `--host` R2 rule (v0.1.0 accepts `generic` only, else `CLI_USAGE` exit 2; auto-detect only _names_ a host for `HOST_UNKNOWN`), probe/warning envelope example, exit codes `0, 2` → **`0, 2, 3`** with the `ADAPTER_INIT_FAILED` half-complete-state path stated honestly
- **`docs/getting-started.md` rewritten to the real renders**: init example replaced (decorated `Boldash init / ✓ Detected host: Claude Code` fiction → the actual envelope dump), verify success **and** blocked examples replaced (the handoff-004 known gap: the CLI renders the envelope, not per-requirement lines), `AGENTS.md` added to the created tree, briefing section generic-only with the other three hosts marked deferred (R9)
- **Honesty items ruled on by GO-S4** (flagged before the GO, not smuggled): `npx boldash doctor` removed from onboarding (deferred command) and the "Claude pre-tool hook blocks `git commit`" block replaced with the truth — **nothing blocks in v0.1.0**, generic has no `pre_tool_hooks`, `verify` is log-only so the transition is explicit
- **Every claim traced to a live capture this session**: init renders from the built bin in a fresh git repo; verify PASS/BLOCK renders from a replicated golden fixture (exit 0 / exit 1, `1 checks did not pass` verbatim); `ADAPTER_INIT_FAILED` → exit 3 confirmed at `src/shared/errors.ts:43` + `docs/errors.md:580`
- **`docs/errors.md`: unchanged** — catalog already carried `ADAPTER_INIT_FAILED`; S3/S4 reused existing codes (R7). A finding, not an omission

## Decisions & invariants (bind the next session)

- **Docs must be copied from a real run, never authored from intent.** Both example rewrites in this repo's history (MS-6 S5, MS-7 S4) existed because the prose described a CLI that had never been built; the S4 rule is capture-the-bin-output-then-paste
- **Deferred things are marked, never deleted**: `doctor`, host adapters, per-host briefings, pack files all stay documented with explicit "deferred past v0.1.0" tags (MS-6 S5 honesty rule). Deleting them would hide the roadmap; leaving them unmarked was the defect
- **A third stale-claim class was found but NOT fixed** (disclosed, not smuggled): `getting-started.md` §"A commit is blocked but I do not know why" tells users to run `boldash policy check` / `boldash explain` — both deferred, and the blocking scenario itself cannot occur in v0.1.0; the `state list` example in §"Reading the State" is a table render while the CLI prints the envelope dump. Both fall outside GO-S4's named scope → recorded here for a ruling, not silently expanded
- **STATE.md structural repair**: MS-7 S1/S2/S3 session-log rows had been appended _inside_ §7 (between its numbered items 1 and 2) instead of into §8's table. Relocated verbatim to §8 — content unchanged, positions fixed; a tracker defect that would have misled the next session, disclosed in the ⇒ row
- **`BRIEFING_BLOCK` text and all code untouched** — S4 changed no code at all (docs commit stat: 2 files, +159/−73)
- Unchanged locked set: R2 `--host` allowlist · R4 idempotency marker-scoped, `--force` destructive · R6 probe provenance/values-equal-floor · R9 only `AGENTS.md` · rule 8 core never imports adapters · `validateWorkflowPack(pack, context)` two-arg · briefing failure = `ADAPTER_INIT_FAILED` envelope · silence ≠ authorization · per-instance push naming · `date -u` · read-bytes-before-write · gates never through a pipe without `PIPESTATUS`

## Anomalies & lessons (this session — for NOTES §6 mining)

1. **Editor-replacement scope trap**: replacing an anchor block that _ends_ at a section heading silently deletes that heading. The `---` + `## boldash doctor` heading was swallowed by the §init rewrite and caught only by re-reading the file after the edit. The cheap rescue checks were `grep -n '^## '` plus fence parity (`grep -c '^```'` must be even) on both docs before the gate
2. **A `✗` glyph was silently dropped** while re-typing a captured render into the doc (a leading space took its place). Copy captured output verbatim and diff it against the capture — "typing what it looks like" is how the fiction got in originally
3. **`route --create` requires `task.scope`** — a fixture replay that omitted it exited 2 and produced a _misleading_ downstream `STATE_TASK_NOT_FOUND` in the verify capture. Replay fixture commands verbatim; never paraphrase them
4. **The gate is a docs gate too**: `format:check` is part of the four-stage gate, so `npx prettier --write <touched docs>` immediately before `npm run verify` remains the working pattern (6th milestone running)

## Blockers

- None mechanical. **Open gate: maintainer sign-off of MS-7** (S1–S4 executed, no code open) → record `completed` → #7 closed → MS-8 (#8) opens with its own plan. The S4 commits are unpushed and need a **fresh per-instance GO naming the tip** — GO-S4 deliberately withheld push authorization.

## Exactly one prioritized next action

**Maintainer sign-off** (`…ms7-generic-adapter.handoff-002.md`): re-run the gate on the boundary tip, run the sign-off checklist against §3 AC results, give the word (that closes MS-7), then either authorize the push of the S4 commits by name or leave them local. Do not treat sign-off as implicit, and do not start MS-8 code before #8 has its own plan.
