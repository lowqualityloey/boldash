# MS-5 Design Note 001 — Verification Engine

- **Task**: `TASK-2026-09-15-v010-ms5-verification` · **Spec**: `docs/specs/2026-09-15-spec-v0.1.0-foundation.md` §2.2/§3.4/§4/§5 MS-5
- **Contract**: `docs/verification-guide.md` · **Errors**: `docs/errors.md` · **Layouts**: `ARCHITECTURE.md` §7.1, §8.2
- **Date**: 2026-09-14 (date -u) · **Status**: ADOPTED — D1–D3 answered 2026-09-14 ({{task_id}} resolution; minimal grammar + #13; narrow redactor); engine shipped in slices 1–3 (`539444c`/`6f1e981`/`5e5c3e6`)
- **Mode**: TDD disabled; **PASS and BLOCK tests mandatory for every check type** (AGENTS.md — this milestone is where that rule earns its keep)

## 1. Interfaces (deep modules, deletion-tested in RFC §2.2)

```
src/core/verification/
  ├── types.ts       Contract, CheckOutcome, GateResult, VerifyDeps (discriminated unions)
  ├── grammar.ts     state_check mini-expression parser (pure, no eval — see §3-D2)
  ├── evidence.ts    EvidenceStore: atomic write + evidence.json index; sole EVID-* minter
  ├── redact.ts      best-effort secret patterns → clean value | REDACTED | REDACTION_FAILED
  ├── command.ts     declared-command executor: spawn('bash',['-c',cmd]) + timeout + output caps
  ├── checks.ts      seven check implementations behind one runCheck(check, deps)
  ├── gate.ts        verifyTask(contract, task, deps) → GateResult (pure except runner calls)
  └── index.ts       public surface (MS-6 imports only from here)
```

- **Exit codes come from `shared/errors.js`** — MS-2's doc-oracle test already proves that map equals `docs/errors.md`; MS-5 consumes, never re-derives. `VERIFY_COMMAND_TIMEOUT` → 12, `EVIDENCE_REDACTION_FAILED` → 10, `POLICY_BLOCKED`/`VERIFY_BLOCKED` → 1.
- **No exceptions cross `verifyTask`**; every failure is a `Result`/`GateResult` value (P4).
- **Timeout default 300 s**, per-check `timeout_ms` override; `SIGTERM` → grace → `SIGKILL` of the process group; killed-by-timeout is a FACT in evidence, not a swallowed error.
- **Command provenance**: the executor accepts a command string ONLY from a schema-validated contract object (no exec entry point reachable any other way — FMEA row 5, test-enforced).
- **Output capture caps** (1 MiB stdout/stderr, truncate-with-marker) — prevents evidence-bloat DoS; FMEA addition.

## 2. Evidence layout (ARCHITECTURE §7.1 + §8.2)

```
.boldash/evidence/TASK-42/test-run-9381.json     payload: {id, kind, task, summary, command?, exit_code?, stdout?, stderr?, created_at}
.boldash/state/evidence.json                     index: [{id, task, kind, payload_ref, created_at, summary}]
```

- **id = `EVID-<kind>-<seq>`** (matches `task.schema.json` `^EVID-[0-9A-Za-z-]+$`, which I checked accepts hyphenated kinds, and the §8.2 filename style). Sequence: per-task, 1-based, derived from the index — stable without a clock.
- `evidence_exists(path=kind)` passes iff the **task** has index entries of that kind.
- Writes go through the store atomically; every evidence write pairs with a `task.evidence_added` event (MS-3 machinery).

## 3. Decisions needing your answer (the honest gaps)

| #      | Question                                                                                                      | Options                                                                            | Recommendation                                                                                                                                                                                                  | Why it matters                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Contract `path`/`run`/`pattern`/`check` templates (`{{task_id}}`): resolve or require literal in v0.1.0?      | resolve / require-literal                                                          | **Resolve** — a naive single-`{{task_id}}` replace, reject any other `{{ }}` with `VERIFY_CONTRACT_INVALID`                                                                                                     | The guide's own examples ship templates; requiring literals contradicts the shipped contract examples                                       |
| **D2** | `state_check` grammar — `verification-guide.md:145` defers to **`docs/state-model.md`, which does not exist** | invent minimal grammar now / stub with explicit error code until state-model ships | **Minimal grammar now**: dotted paths (`state.task.<field>`), `==`/`!=` against quoted strings & numerics, boolean fields; anything else = `VERIFY_CONTRACT_INVALID` with "grammar reserved for state-model.md" | The engine must not `eval()` contract strings (SECURITY.md §1); the catalog promises this check works; state-model.md is an MS-9 doc anyway |
| **D3** | Secret-redaction patterns (errors.md promises the code; nobody defined the detector)                          | broad regex set / narrow set                                                       | **Narrow, high-confidence set**: `ghp_…`, `github_pat_…`, AKIA, PEM header lines, `password                                                                                                                     | secret                                                                                                                                      | token | api_key`*assignments with quoted values*; default action REDACT (not fail); fail`EVIDENCE_REDACTION_FAILED` only when a match exists but cannot be safely replaced | False "clean" is the verification-theater failure; false alarms train users to bypass — narrow set + always-logged is the honest middle |

## 4. Test plan (TDD mode is off, so this table IS the discipline)

| Check                        | PASS case                   | BLOCK case                    | Extra                                                                                                                                                                             |
| ---------------------------- | --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| file_exists                  | fixture file present        | renamed/missing               | symlink dir edge                                                                                                                                                                  |
| command                      | `exit 0` script in temp cwd | nonzero exit captured as FACT | **hang → SIGKILL at timeout, exit 12, killed=true in evidence**; **undeclared-command negative: executor refuses when passed a non-contract source (type-level + runtime guard)** |
| regex_in_file                | multiline anchor pattern    | non-match + missing file      | invalid regex → VERIFY_CONTRACT_INVALID                                                                                                                                           |
| state_check                  | risk != 'critical' true     | false                         | malformed expression → CONTRACT_INVALID (grammar is pure: fuzz list of 10 rejects)                                                                                                |
| evidence_exists              | attached `test-run`         | none of kind                  | kind case-sensitivity locked                                                                                                                                                      |
| file_not_modified (must_not) | untouched file              | modified                      | git-dirty baseline note                                                                                                                                                           |
| command_fails (must_not)     | exit 2 command              | exit 0 inverts → BLOCK        | timeout semantics identical                                                                                                                                                       |

Gate tests: one contract with 3 pass + 1 fail → `VERIFY_BLOCKED` exit 1, **failing check named**, passing checks still recorded as evidence; all-pass → `VERIFIED` + `task.evidence_added`/`verify.run` events; empty must_pass is schema-impossible (AC-4 proven in MS-2).

## 5. Sequence (slices, each shown before commit per Gated Mode)

1. types + gate skeleton + grammar.ts (with fuzz tests) → diff, sign-off
2. evidence store + redaction (fixture-driven) → diff, sign-off
3. command runner + remaining checks + gate integration → diff, sign-off
4. record evidence + #5 update (same commit as slice 3; docs ship with code)

## 6. Non-goals (v0.1.0)

Caching (`--no-cache` is v0.3.0 per ADR 0005), parallel check execution, container isolation of commands (SECURITY.md §1 remains "declared commands run on host"), policy evaluation (MS-3+… Phase 2), interactive review collection (`human_approval` is a _requirement flag_, not a check type).
