/**
 * The seven built-in checks (MS-5 slice 3). One dispatcher, total by
 * construction: every PassCheck/NotCheck variant maps to an outcome; the
 * switch is exhaustive over the union, so a new meta-schema type without an
 * implementation is a compile error, not a runtime shrug.
 *
 * Containment: contract-authored `path` values resolve INSIDE the project root
 * or the check fails closed (`..`, absolute escapes refused) — file_exists
 * must not become a filesystem oracle outside the repo.
 *
 * Evidence views (kinds/baselines) arrive precomputed on VerifyEnv by the
 * gate; a check never reaches the store for a read, so a corrupt index can
 * only surface as the gate-level IO_ERROR refusal — never as a silent
 * "no evidence" that flips a check. Writes (command output) still go through
 * the store so secret redaction stays enforced at the single write boundary.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ErrorInfo } from '../../shared/result.js';
import { parseStateExpression } from './grammar.js';
import { runDeclaredCommand } from './command.js';
import type { CheckOutcome, NotCheck, PassCheck, VerifyEnv } from './types.js';
import type { EvidenceStore } from './evidence.js';
import { redactText } from './redact.js';

export interface CheckDeps {
  env: VerifyEnv;
  evidence: EvidenceStore;
}

function outcome(
  check: PassCheck | NotCheck,
  pass: boolean,
  detail: string,
  extra: { evidenceId?: string; error?: ErrorInfo } = {},
): CheckOutcome {
  return {
    name: check.name,
    type: check.type,
    pass,
    detail,
    ...(extra.evidenceId !== undefined ? { evidenceId: extra.evidenceId } : {}),
    ...(extra.error !== undefined ? { error: extra.error } : {}),
  };
}

/** Absolute path inside root, or null when the declaration escapes. */
export function resolveInside(root: string, declared: string): string | null {
  const abs = resolve(root, declared);
  const boundary = resolve(root);
  return abs === boundary || abs.startsWith(`${boundary}/`) ? abs : null;
}

function clip(s: string): string {
  return s.length <= 120 ? s : `${s.slice(0, 120)}…`;
}
function tail(s: string, n: number): string {
  return s.length <= n ? s : `…${s.slice(-n)}`;
}

export async function runCheck(
  check: PassCheck | NotCheck,
  deps: CheckDeps,
): Promise<{ outcome: CheckOutcome; timedOut: boolean }> {
  const { env, evidence } = deps;

  switch (check.type) {
    case 'file_exists': {
      const p = resolveInside(env.cwd, check.path);
      if (p === null)
        return {
          outcome: outcome(check, false, `path '${check.path}' escapes the project root`),
          timedOut: false,
        };
      const present = existsSync(p);
      return {
        outcome: outcome(
          check,
          present,
          present ? `found ${check.path}` : `missing ${check.path}`,
        ),
        timedOut: false,
      };
    }

    case 'regex_in_file': {
      const p = resolveInside(env.cwd, check.path);
      if (p === null)
        return {
          outcome: outcome(check, false, `path '${check.path}' escapes the project root`),
          timedOut: false,
        };
      if (!existsSync(p))
        return {
          outcome: outcome(check, false, `file ${check.path} not found`),
          timedOut: false,
        };
      let re: RegExp;
      try {
        re = new RegExp(check.pattern);
      } catch (cause) {
        return {
          outcome: outcome(check, false, `invalid regex: ${String(cause)}`, {
            error: {
              code: 'VERIFY_CONTRACT_INVALID',
              message: `invalid regex pattern in check '${check.name}': ${String(cause)}`,
              field: 'pattern',
            },
          }),
          timedOut: false,
        };
      }
      const hit = re.test(readFileSync(p, 'utf8'));
      return {
        outcome: outcome(
          check,
          hit,
          hit ? `pattern matched in ${check.path}` : `pattern NOT found in ${check.path}`,
        ),
        timedOut: false,
      };
    }

    case 'state_check': {
      const expr = parseStateExpression(check.check);
      if (!expr.ok)
        return {
          outcome: outcome(check, false, expr.error.message, { error: expr.error }),
          timedOut: false,
        };
      const value = expr.data.evaluate(env.task);
      return {
        outcome: outcome(
          check,
          value,
          value ? `expression true: ${check.check}` : `expression false: ${check.check}`,
        ),
        timedOut: false,
      };
    }

    case 'evidence_exists': {
      const kinds = env.evidenceKinds;
      const has = kinds.has(check.path);
      return {
        outcome: outcome(
          check,
          has,
          has
            ? `evidence of kind '${check.path}' attached to ${env.task.id}`
            : `no evidence of kind '${check.path}' on ${env.task.id} (kinds present: ${[...kinds].join(', ') || 'none'})`,
        ),
        timedOut: false,
      };
    }

    case 'command': {
      const run = await runDeclaredCommand(check, env.cwd);
      // Command text, stdout and stderr are redacted INDEPENDENTLY: a
      // stream-relative failure must not blank the whole record, and stderr
      // must never be echoed raw because redaction happened on stdout+stderr.
      const cmdRed = redactText(check.run);
      const outRed = redactText(run.stdout);
      const errRed = redactText(run.stderr);
      const safeCmd = cmdRed.status === 'failed' ? '[REDACTION FAILED]' : cmdRed.value;
      const safeOut = outRed.status === 'failed' ? '[REDACTION FAILED]' : outRed.value;
      const safeErr = errRed.status === 'failed' ? '[REDACTION FAILED]' : errRed.value;
      const allRedactable =
        cmdRed.status !== 'failed' &&
        outRed.status !== 'failed' &&
        errRed.status !== 'failed';
      const pass = !run.timedOut && run.exitCode === 0 && allRedactable;
      const redactionCount =
        (outRed.status === 'redacted' ? outRed.count : 0) +
        (errRed.status === 'redacted' ? errRed.count : 0) +
        (cmdRed.status === 'redacted' ? cmdRed.count : 0);
      const rec = evidence.record({
        kind: 'test-run',
        task: env.task.id,
        summary: `${clip(safeCmd)}: exit ${run.timedOut ? 'TIMEOUT' : (run.exitCode ?? 'killed')}`,
        fields: {
          command: clip(safeCmd),
          exit_code: run.exitCode,
          timed_out: run.timedOut,
          truncated: run.truncated,
          duration_ms: run.duration_ms,
          stdout: safeOut,
          stderr_tail: tail(safeErr, 4000),
          ...(redactionCount > 0 ? { redaction_count: redactionCount } : {}),
        },
      });
      const evidenceId = rec.ok ? rec.data.id : undefined;

      if (run.timedOut) {
        return {
          outcome: outcome(check, false, 'command timed out', {
            error: {
              code: 'VERIFY_COMMAND_TIMEOUT',
              message: `Command '${check.name}' exceeded ${check.timeout_ms ?? 300000} ms.`,
              field: 'run',
            },
            ...(evidenceId !== undefined ? { evidenceId } : {}),
          }),
          timedOut: true,
        };
      }
      if (!rec.ok) {
        // Evidence that could not be written is a failed gate, not a note:
        // "VERIFIED" with no proof behind it is exactly verification theater.
        return {
          outcome: outcome(
            check,
            false,
            `command exit ${run.exitCode ?? 'signal'} but evidence write failed`,
            {
              error: rec.error,
              ...(evidenceId !== undefined ? { evidenceId } : {}),
            },
          ),
          timedOut: false,
        };
      }
      const detail = pass
        ? 'exit 0'
        : run.exitCode !== 0 || run.exitCode === null
          ? `exit ${run.exitCode ?? 'signal'}`
          : 'exit 0, but output contained unredactable secrets (blocked, not cleared)';
      return {
        outcome: outcome(check, pass, detail, {
          ...(evidenceId !== undefined ? { evidenceId } : {}),
        }),
        timedOut: false,
      };
    }

    case 'command_fails': {
      const run = await runDeclaredCommand(check, env.cwd);
      if (run.timedOut) {
        return {
          outcome: outcome(
            check,
            false,
            'command timed out; inversion cannot be judged',
            {
              error: {
                code: 'VERIFY_COMMAND_TIMEOUT',
                message: `must_not command '${check.name}' exceeded its timeout.`,
                field: 'run',
              },
            },
          ),
          timedOut: true,
        };
      }
      const pass = run.exitCode !== null && run.exitCode !== 0;
      return {
        outcome: outcome(
          check,
          pass,
          pass
            ? `confirmed non-zero exit (${run.exitCode}): ${check.name}`
            : `INVERTED: command unexpectedly succeeded (exit 0): ${check.name}`,
        ),
        timedOut: false,
      };
    }

    case 'file_not_modified': {
      // Fail-closed baseline semantics (v0.1.0): a baseline must exist for
      // this task+path as 'file-baseline' evidence. Absence of a baseline is
      // NOT proof of absence of modification; baseline capture lands with the
      // CLI's implementing-entry transition (MS-6).
      const p = resolveInside(env.cwd, check.path);
      if (p === null)
        return {
          outcome: outcome(check, false, `path '${check.path}' escapes the project root`),
          timedOut: false,
        };
      const hash = existsSync(p)
        ? `sha256:${createHash('sha256').update(readFileSync(p)).digest('hex')}`
        : null;
      const baselines = env.evidenceEntries.filter(
        (e) => e.kind === 'file-baseline' && e['path'] === check.path,
      );
      if (baselines.length === 0) {
        return {
          outcome: outcome(
            check,
            false,
            `no baseline recorded for ${check.path} on ${env.task.id} — cannot claim it was unmodified (baseline capture lands with MS-6)`,
          ),
          timedOut: false,
        };
      }
      const unchanged = baselines.some((b) => b['hash'] === hash);
      return {
        outcome: outcome(
          check,
          unchanged,
          unchanged
            ? `${check.path} matches its baseline hash`
            : `${check.path} differs from baseline (modified!)`,
        ),
        timedOut: false,
      };
    }
  }
}
