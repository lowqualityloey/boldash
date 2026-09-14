# Pull Request

## What & Why
<!-- One or two sentences: the problem solved and the change made. Link design anchors (ARCHITECTURE.md §, PROJECT OVERVIEW section) when relevant. -->

- **Issue(s):** #
- **Design reference:** `ARCHITECTURE.md §` / `docs/specs/` / N/A

## Verification Evidence
<!-- Boldash's own rule: claims without evidence are suggestions. Paste real command output or link CI runs. "Not run" is an acceptable, honest answer. -->

| Check | Command / Source | Result |
|---|---|---|
| Tests | `npm test` *(when toolchain exists)* | |
| Typecheck | | |
| Manual | steps or N/A | |

## Impact

- **Public CLI surface** (`boldash <cmd>`, exit codes, JSON output shape, schemas): changed / unchanged — if changed, document the contract delta below.
- **State / event-log format:** changed / unchanged
- **Docs:** which files updated

## Contract Delta (only if public surface changed)

Before → After, and the migration path for existing users/packs.

## Rollback
<!-- How to reverse safely: revert-only, data cleanup needed, or state migration required. -->

## Pre-Submission Checklist
- [ ] No secrets committed (`.env*`, tokens, keys) — evidence files reviewed
- [ ] Deterministic checks added where they replaced prose rules (P3)
- [ ] Every new gate has an exit-code path (P4)
- [ ] LLM-facing surface kept minimal — no schema/README bloat (P9)
- [ ] `docs/NOTES.md` history/invariants still accurate after this change
