/**
 * verifyTask — the gate (MS-5 slice 3).
 *
 * Aggregation rules (docs/verification-guide.md §Gates and Exit Codes):
 * - every must_pass AND must_not runs to completion; all outcomes are
 *   reported, not just the first failure (a blocked run that names only one
 *   problem sends agents back for a second run — verification is a FACT
 *   factory, not a quiz).
 * - a check that cannot even be EVALUATED (bad regex, unknown grammar) is
 *   blocking: no permissive defaults, exit 1 with a carried error.
 * - timeout anywhere → exit 12 (VERIFY_COMMAND_TIMEOUT wins over 1).
 * - corrupt evidence history → the run refuses as IO_ERROR (exit 11);
 *   "unknown kinds" must never read as "no evidence".
 * - the gate NEVER writes state; the CLI persists the verify.run event and
 *   the verifying→complete transition (single State Engine writer, MS-6).
 */

import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Clock } from '../../shared/clock.js';
import { runCheck } from './checks.js';
import type { EvidenceStore } from './evidence.js';
import type {
  CheckOutcome,
  GateResult,
  NotCheck,
  PassCheck,
  VerificationContract,
  VerifyEnv,
} from './types.js';

export interface GateDeps {
  cwd: string;
  evidence: EvidenceStore;
  clock: Clock;
}

export function buildEnv(
  deps: GateDeps,
  task: VerifyEnv['task'],
): Result<VerifyEnv, ErrorInfo> {
  const all = deps.evidence.tryReadIndex();
  if (all === null) {
    return err({
      code: 'IO_ERROR',
      message: 'evidence index unreadable — refusing to verify against unknown history',
      field: '.boldash/state/evidence.json',
      suggestion:
        'Restore .boldash/state/evidence.json from Git (it is committed by design, P6), then re-run.',
    });
  }
  const mine = all.filter((e) => e.task === task.id);
  return ok({
    cwd: deps.cwd,
    task,
    evidenceKinds: new Set(mine.map((e) => e.kind)),
    evidenceEntries: mine,
  });
}

export async function verifyTask(
  contract: VerificationContract,
  task: VerifyEnv['task'],
  deps: GateDeps,
): Promise<Result<GateResult, ErrorInfo>> {
  const envResult = buildEnv(deps, task);
  if (!envResult.ok) return envResult;
  const env = envResult.data;

  if (contract.task_id !== task.id) {
    return err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `contract targets '${contract.task_id}' but task under verification is '${task.id}'`,
      field: 'task_id',
      suggestion:
        'Bind contracts with the {{task_id}} template or use the matching task.',
    });
  }

  const started = deps.clock.nowIso();
  const outcomes: CheckOutcome[] = [];
  let anyTimeout = false;

  for (const check of contract.must_pass as readonly PassCheck[]) {
    const r = await runCheck(check, { env, evidence: deps.evidence });
    outcomes.push(r.outcome);
    anyTimeout ||= r.timedOut;
  }
  for (const check of (contract.must_not ?? []) as readonly NotCheck[]) {
    const r = await runCheck(check, { env, evidence: deps.evidence });
    outcomes.push(r.outcome);
    anyTimeout ||= r.timedOut;
  }

  const blocked = outcomes.some((o) => !o.pass);
  const result: GateResult = {
    status: blocked ? 'BLOCKED' : 'VERIFIED',
    task: task.id,
    checks: outcomes,
    exit: anyTimeout ? 12 : blocked ? 1 : 0,
    started_at: started,
    finished_at: deps.clock.nowIso(),
  };
  return ok(result);
}
