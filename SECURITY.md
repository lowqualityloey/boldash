# Security Policy

## Supported Versions

Boldash is pre-alpha. No stable release exists yet.

| Version         | Supported           |
| --------------- | ------------------- |
| `main` branch   | ✅                  |
| Tagged releases | ❌ (none exist yet) |

Once `v0.1.0` ships, the latest minor release will be supported. Older minors receive security fixes for 90 days after a new minor is released.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

**Preferred:** [GitHub Security Advisories](https://github.com/lowqualityloey/boldash/security/advisories/new)

**Fallback email:** `security@example.com` _(replace before publishing)_

Please include:

- A description of the issue
- Steps to reproduce
- Affected versions or commits
- Impact assessment — what an attacker could do
- Any suggested remediation

## Response Timeline

| Stage                  | Target               |
| ---------------------- | -------------------- |
| Acknowledgment         | 72 hours             |
| Initial triage         | 7 days               |
| Fix or mitigation plan | 30 days              |
| Coordinated disclosure | 90 days after report |

These are targets, not guarantees. As a solo-maintained project, timelines may slip. You will be kept informed at every stage.

## Scope

**In scope:**

- The `boldash` CLI and its published packages
- JSON schemas under `schemas/`
- Reference workflow packs under `workflows/`
- Reference policy presets under `policies/`
- Host adapters under `src/adapters/`
- The state, evidence, and event-log formats

**Out of scope:**

- The behavior of the host agent (Claude Code, Cursor, Antigravity, etc.)
- The behavior of the underlying LLM
- OS-level sandboxing — Boldash does not sandbox by design (see [ARCHITECTURE.md § 12](./ARCHITECTURE.md#12-security-model))
- Vulnerabilities in third-party dependencies — report upstream, but tell us too
- Social engineering against maintainers or users

## Threat Model

Boldash assumes:

- The user is trusted.
- The host agent is **semi-trusted** — it may produce incorrect or malicious output.
- The repository may contain untrusted content, such as a cloned dependency.
- Boldash must not escalate privileges beyond what the user already has.

## Known Design Limitations

These are documented non-goals, not vulnerabilities.

1. **Boldash runs shell commands declared in verification contracts.** If an attacker can modify a `done.schema.json`, they can cause Boldash to run arbitrary commands under the user's account. Mitigation: review workflow packs before adopting them, and run `boldash doctor` after pulling changes.

2. **Boldash does not sandbox.** It relies on the host's execution model and the OS. Documented in [ARCHITECTURE.md § 3](./ARCHITECTURE.md#3-non-goals).

3. **Boldash trusts the local repository.** If the repository is compromised, the state, evidence, and event log are compromised.

4. **Evidence redaction is best-effort.** Boldash scans for common secret patterns before writing evidence, but no scanner is complete. Do not commit evidence you have not reviewed.

## Disclosure Policy

Boldash follows coordinated disclosure. Reporters are credited in release notes unless they ask to remain anonymous. There is no bug bounty at this time.

## Security-Relevant Design Decisions

- No network calls in the core.
- No post-install scripts.
- Dependencies are pinned; `npm audit` runs on every release.
- All state mutations are logged as events.
- Commands run during verification must be declared in the workflow's `done.schema.json`.
- Evidence is scanned for common secret patterns and redacted before writing.

See [ARCHITECTURE.md § 12](./ARCHITECTURE.md#12-security-model) for the full security model.
