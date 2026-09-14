# Changelog

All notable changes to Boldash will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Agent contract (`AGENTS.md`), contribution guide (`CONTRIBUTING.md`), and the v0.1.0 surface specification corpus (`docs/cli-reference.md`, `docs/routing-contract.md`, `docs/verification-guide.md`, `docs/errors.md`, `docs/getting-started.md`, `docs/faq.md`).
- Approved v0.1.0 Foundation RFC (`docs/specs/2026-09-15-spec-v0.1.0-foundation.md`) with FMEA and 9-milestone split; canonical Task Records `docs/tasks/TASK-2026-09-15-v010-ms*` linked to GitHub issues #1–#9; ADRs 0001–0005.
- Initial design-phase corpus: `README.md`, `ARCHITECTURE.md`, `PROJECT OVERVIEW.md`, `SECURITY.md`, `CHANGELOG.md`, MIT `LICENSE`.
- Working-state notes with milestone roadmap, document-authority map, and locked invariants (`docs/NOTES.md`).
- Boldash-native GitHub templates (PR evidence table, task issues with verification seams).
- **MS-1 scaffold (v0.1.0):** TypeScript strict + ESM toolchain, `npm run verify` release gate (lint → typecheck → vitest), ESLint 10 flat config, CI workflow on Node 20/22/24, populated `PROMPTKIT.md` project profile.

### Changed

- `README.md` License section now declares MIT (was "TBD"), matching the shipped `LICENSE`.

### Deprecated

_Nothing yet._

### Removed

- PromptKit OS v1 engine experiment (`.promptkit` submodule, generated `AGENTS.md` / `CLAUDE.md` directives, `PROMPTKIT.md`, `docs/STATE.md` tracker) — the repository was reset to a pure Boldash design corpus.

### Fixed

- Renamed `SECURITY.md.md` → `SECURITY.md` (double-extension filename typo).
- Broken `LICENSE.md` link in `PROJECT OVERVIEW.md` corrected to the actual `LICENSE` file.

### Security

_Nothing yet._

---

## Release Notes Convention

When a release is cut, move entries from `[Unreleased]` into a new version section. Use the following template:

```markdown
## [0.1.0] - YYYY-MM-DD

### Added

- Initial release.

### Changed

-

### Deprecated

-

### Removed

-

### Fixed

-

### Security

-
```

Add a `compare` link at the bottom once the first release exists:

```markdown
[Unreleased]: https://github.com/lowqualityloey/boldash/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lowqualityloey/boldash/releases/tag/v0.1.0
```
