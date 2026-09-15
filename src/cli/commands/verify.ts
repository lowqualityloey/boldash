/**
 * `boldash verify TASK|--all` (MS-6 S4) — the verification cold path through
 * the CLI surface.
 *
 * Contract discovery reuses the S3 binding ruling (record §Scope Change S3-1):
 * a task's bound contract is `.boldash/workflows/<task.workflow>/done.schema.json`.
 * No workflow, no contract file, or an unreadable contract ⇒
 * VERIFY_CONTRACT_INVALID (exit 2) — never a silent skip.
 *
 * Engine flow per plan-001 §3 S4: `loadContract` (meta-schema + D1 templates)
 * → `buildEnv` (fail-closed on corrupt evidence) → `verifyTask`
 * (every must_pass AND must_not runs; timeout anywhere ⇒ exit 12).
 *
 * CLI owns the audit log (gate.ts header; engine never writes state): every
 * completed gate run appends a `verify.run` event. The CLI does NOT
 * auto-transition `verifying → complete/failed` — cli-reference §verify shows
 * no transition side effect, so humans/agents transition explicitly. This is
 * the safest reading, recorded here and in the Task Record.
 *
 * `--all` scans tasks in `verifying` status (engine list filter). Zero
 * verifying tasks ⇒ ok true with an empty report (exit 0) — the minimal
 * honest behavior, recorded in the Task Record (handoff-003 gap).
 *
 * Exit contract: 0 VERIFIED · 1 BLOCKED (VERIFY_BLOCKED) · 2 invalid input
 * (VERIFY_CONTRACT_INVALID / STATE_TASK_NOT_FOUND / CLI_USAGE) · 12 timeout
 * (VERIFY_COMMAND_TIMEOUT wins over 1, per gate aggregation).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  EvidenceStore,
  buildEnv,
  loadContract,
  verifyTask,
} from '../../core/verification/index.js';
import type { GateResult } from '../../core/verification/index.js';
import { systemClock } from '../../shared/clock.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Task } from '../../core/state/index.js';
import { fail, precondition, storeIn, usage } from './state.js';
import { CLI_ACTOR } from './state-writes.js';
import type { Envelope, RunContext } from '../types.js';

function evidenceStoreIn(cwd: string): EvidenceStore {
  return new EvidenceStore(join(cwd, '.boldash'), systemClock);
}

/** Bound contract path for a task (S3 ruling); null when unbound. */
function boundContractPath(cwd: string, task: Task): string | null {
  if (!task.workflow) return null;
  return join(cwd, '.boldash', 'workflows', task.workflow, 'done.schema.json');
}

function blockError(result: GateResult, taskId: string): ErrorInfo {
  const timedOut = result.checks.some((c) => c.error?.code === 'VERIFY_COMMAND_TIMEOUT');
  if (timedOut || result.exit === 12) {
    return {
      code: 'VERIFY_COMMAND_TIMEOUT',
      message: `Verification of ${taskId} timed out.`,
      field: 'verify',
      suggestion: 'Increase timeout_ms in the contract, or narrow the command scope.',
      context: {
        task: taskId,
        failed_checks: result.checks.filter((c) => !c.pass).map((c) => c.name),
      },
    };
  }
  return {
    code: 'VERIFY_BLOCKED',
    message: `Verification failed: ${result.checks.filter((c) => !c.pass).length} checks did not pass.`,
    field: 'verify',
    context: {
      task: taskId,
      failed_checks: result.checks.filter((c) => !c.pass).map((c) => c.name),
    },
    suggestion: `Run \`boldash state get ${taskId}\` to see missing evidence.`,
  };
}

/** Run the gate for one task; logs the CLI-owned `verify.run` event. */
async function verifyOne(cwd: string, task: Task): Promise<Envelope> {
  const contractPath = boundContractPath(cwd, task);
  if (contractPath === null) {
    return fail({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `Task ${task.id} has no bound workflow contract (task.workflow is unset).`,
      field: 'contract_path',
      suggestion:
        'Bind the task to a workflow with a done.schema.json, or record why it is unverifiable.',
    });
  }
  if (!existsSync(contractPath)) {
    return fail({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `Contract not found for task ${task.id}: ${contractPath} does not exist.`,
      field: 'contract_path',
      suggestion: `Import the workflow pack first (\`boldash workflow import <path>\`).`,
    });
  }
  const contract = loadContract(contractPath, task.id);
  if (!contract.ok) return fail(contract.error);

  const evidence = evidenceStoreIn(cwd);
  const deps = { cwd, evidence, clock: systemClock };
  // buildEnv fail-closed (corrupt index ⇒ IO_ERROR exit 11) surfaces as-is.
  const env = buildEnv(deps, task);
  if (!env.ok) return fail(env.error);

  const gated = await verifyTask(contract.data, task, deps);
  if (!gated.ok) return fail(gated.error);
  const result = gated.data;

  const logged = storeIn(cwd).logEvent('verify.run', task.id, CLI_ACTOR, {
    status: result.status,
    exit: result.exit,
    checks: result.checks.map((c) => ({ name: c.name, type: c.type, pass: c.pass })),
  });
  if (!logged.ok) return fail(logged.error);

  if (result.status === 'VERIFIED') {
    return {
      ok: true,
      data: { task: task.id, status: result.status, checks: result.checks },
    };
  }
  return fail(blockError(result, task.id));
}

/** Runner for `boldash verify <TASK-id> | --all`. */
export async function runVerify(ctx: RunContext): Promise<Envelope> {
  const [id, extra] = ctx.positionals;
  const all = ctx.flags['all'] === true;
  if (all && id !== undefined) {
    return usage(
      '`verify --all` takes no task id.',
      '--all',
      'Usage: boldash verify <task-id> OR boldash verify --all.',
    );
  }
  if (!all && !id) {
    return usage(
      'verify requires a task id or --all.',
      'verify',
      'Usage: boldash verify <task-id> OR boldash verify --all.',
    );
  }
  if (!all && extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'verify',
      'Usage: boldash verify <task-id>.',
    );
  }
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const store = storeIn(cwd);

  if (all) {
    const listed = store.list({ status: 'verifying' });
    if (!listed.ok) return fail(listed.error);
    const tasks = listed.data;
    const results: Array<{
      task: string;
      status: string;
      checks?: unknown;
      error?: ErrorInfo;
    }> = [];
    let anyTimeout = false;
    let anyBlocked = false;
    for (const task of tasks) {
      const r = await verifyOne(cwd, task);
      if (r.ok) {
        results.push({
          task: task.id,
          status: 'VERIFIED',
          checks: (r.data as { checks: unknown }).checks,
        });
      } else {
        results.push({ task: task.id, status: 'BLOCKED', error: r.error });
        if (r.error.code === 'VERIFY_COMMAND_TIMEOUT') anyTimeout = true;
        else if (r.error.code === 'VERIFY_BLOCKED') anyBlocked = true;
        else return fail(r.error);
      }
    }
    if (anyTimeout) {
      return fail({
        code: 'VERIFY_COMMAND_TIMEOUT',
        message: `Verification timed out on ${results.filter((r) => r.error?.code === 'VERIFY_COMMAND_TIMEOUT').length} task(s).`,
        field: 'verify',
        context: { results },
      });
    }
    if (anyBlocked) {
      return fail({
        code: 'VERIFY_BLOCKED',
        message: `Verification blocked on ${results.filter((r) => r.status === 'BLOCKED').length} task(s).`,
        field: 'verify',
        context: { results },
      });
    }
    return {
      ok: true,
      data: { total: tasks.length, verified: tasks.map((t) => t.id), results },
    };
  }

  const found = store.get(id as string);
  if (!found.ok) return fail(found.error);
  return verifyOne(cwd, found.data);
}
