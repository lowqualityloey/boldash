# Project Architectural Profile (`PROMPTKIT.md`)

> **Instructions for AI**: Read this file during every session. This project's supreme
> contracts are `AGENTS.md` (agent rules) and `PROJECT OVERVIEW.md` (intent);
> `ARCHITECTURE.md` is the design authority. This file configures the PromptKit OS v1
> engine (`.promptkit` submodule) that dogfoods the repository.

## 0. PromptKit OS Profile
- **Profile**: turbo · **Installed**: 2026-09-15 · **Engine**: `.promptkit` @ `v1.5.1-26`
- **Note**: v1 engine intentionally reinstalled; its directive block is appended inside
  `AGENTS.md` between `PROMPTKIT_START/END` markers. Native AGENTS.md content wins on conflict.

profile: turbo

## 1. Project Overview & Domain
- **Project Name**: Boldash — deterministic control plane for AI coding agents (successor to PromptKit OS v1; a different layer, not a rewrite).
- **Primary Users**: devs pairing with agents; small teams; v1 users wanting enforcement.
- **Status**: pre-alpha · M1 design closed · **M2 v0.1.0 in progress** (MS-1 scaffold).

## 2. Active Technology Stack
- **Language & Runtime**: TypeScript 6.0.3 (strict, ESM/NodeNext) on Node ≥20 (dev: v24; CI matrix 20/22/24)
- **Testing**: vitest 5 (dev-only) · **Lint/Format**: eslint 10 flat + typescript-eslint, prettier
- **Runtime deps policy**: exact-pinned; v0.1.0 targets ajv@8 as the ONLY runtime dependency (ADR 0003)
- **No database, no daemon, no cloud core** (P6). State = files.

## 3. Project Commands (Root / Global)
- **Install**: `npm ci` (or `npm install --cache <tmp>` while the user npm cache is root-owned on this machine)
- **Build**: `npm run build` · **Typecheck**: `npm run typecheck` · **Lint**: `npm run lint`
- **Tests**: `npm test` · **THE GATE**: `npm run verify` (lint → typecheck → test; CONTRIBUTING §The release gate)
- **Format**: `npm run format` / `format:check` (not in gate by design)

## 4. Monorepo & Workspace Topology
- **N/A (Standalone Repository)** — single package; `src/{cli,core,adapters,shared}` per AGENTS.md import rules.

## 5. MCP Capabilities & Task Tracking
- **Task Tracking System**: Local Markdown (`docs/tasks/` canonical) **mirrored to GitHub Issues** via `gh` CLI (no GitHub MCP in session; `gh` auth verified 2026-09-15).
- Other MCP servers: N/A → terminal/CLI fallback per Progressive Enhancement.
- **Issue map**: MS-1→#1 … MS-9→#9 (see `docs/STATE.md` §2); #10 = CODE_OF_CONDUCT follow-up.

## 6. Artifact Paths
v1 defaults (`docs/{specs,tasks,adrs,tests,rca,...}/`) — plus Boldash's own future paths: canonical runtime state will live in `.boldash/` (committed — see `.gitignore` guard note). ADR dir: this repo uses `docs/adrs/` (`CONTRIBUTING.md`/`AGENTS.md` say `docs/adr/` — unification pending, RFC §3.4 amendment list).

## 7. Non-Negotiable Guardrails
- **P1–P10 + tie-breaker** — `ARCHITECTURE.md` §2 / Appendix B (verbatim list in `docs/NOTES.md` §3).
- **No code for a milestone without a `ready` Local Task Record and maintainer GO.**
- **AGENTS.md rules bind agents here**: no `any`; gate tests must prove pass AND block; no undeclared commands; exact pins; no post-install scripts; human-only merge/force-push/tag.
- **Docs–code ship together**: new error codes → `docs/errors.md`; new flags → `docs/cli-reference.md`.
- **Session discipline**: STATE.md untrusted until read; telemetry numbers must trace to checks executed in-turn.
