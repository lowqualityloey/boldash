/**
 * `boldash state transition|requirement|evidence` (MS-6 S3) — the write side
 * of the state family. Every mutation goes through the State Engine (single
 * writer, optimistic versions, events recorded); nothing here touches
 * tasks.json directly. Exits 0/2/4 (CONCURRENT/LOCKED are the 4-class).
 *
 * **AC-8 file-baseline capture** (NOTES §4, MS-5 handoff): on the
 * `planned → implementing` edge, the CLI captures `file-baseline` evidence
 * (path + sha256) for every `file_not_modified` path in the task's BOUND
 * contract. Binding (ruling in record §Scope Change): a task's workflow pack
 * layout documented at RFC §3.2 — `.boldash/workflows/<workflow>/done.schema.json`
 * — which is also exactly why D1's `{{task_id}}` template exists. No
 * workflow, no contract file, or no `must_not` entries ⇒ zero bound paths ⇒
 * vacuous capture (later `file_not_modified` keeps its fail-closed "no
 * baseline" block). Capture runs BEFORE the transition: a failed capture
 * leaves state untouched; a recorded baseline orphaned by a later guard
 * failure is benign (the consumer matches task + path + hash).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  EvidenceStore,
  loadContract,
  resolveInside,
} from '../../core/verification/index.js';
import { systemClock } from '../../shared/clock.js';
import type { Task } from '../../core/state/index.js';
import { precondition, storeIn, usage, fail, STATUS_VALUES } from './state.js';
import type { Envelope, RunContext } from '../types.js';

/** Event actor for every CLI-originated write (MS-6 has no identity layer). */
export const CLI_ACTOR = 'cli';

function evidenceStoreIn(cwd: string): EvidenceStore {
  return new EvidenceStore(join(cwd, '.boldash'), systemClock);
}

/**
 * Capture file baselines for the task's bound contract (see file header).
 * Returns an error envelope when capture fails, or null when there is
 * nothing to capture / capture succeeded.
 */
export function captureFileBaselines(cwd: string, task: Task): Envelope | null {
  if (!task.workflow) return null;
  const contractPath = join(
    cwd,
    '.boldash',
    'workflows',
    task.workflow,
    'done.schema.json',
  );
  if (!existsSync(contractPath)) return null;

  const contract = loadContract(contractPath, task.id);
  if (!contract.ok) return fail(contract.error);
  const negatives = (contract.data.must_not ?? []).flatMap((check) =>
    check.type === 'file_not_modified' ? [check] : [],
  );
  if (negatives.length === 0) return null;

  const store = evidenceStoreIn(cwd);
  const ids: string[] = [];
  for (const check of negatives) {
    const abs = resolveInside(cwd, check.path);
    if (abs === null) {
      return fail({
        code: 'VERIFY_CONTRACT_INVALID',
        message: `must_not path '${check.path}' escapes the project root; refusing to capture.`,
        field: 'must_not.path',
      });
    }
    // Same hash format the consumer computes (verification/checks.ts
    // file_not_modified); an absent file baselines as null, so later
    // creation counts as modification.
    const hash = existsSync(abs)
      ? `sha256:${createHash('sha256').update(readFileSync(abs)).digest('hex')}`
      : null;
    const recorded = store.record({
      kind: 'file-baseline',
      task: task.id,
      summary: `file baseline for ${check.path} at planned->implementing`,
      fields: { path: check.path, hash },
    });
    if (!recorded.ok) return fail(recorded.error);
    ids.push(recorded.data.id);
  }
  // EvidenceStore never emits (its documented contract); the CLI pairs the
  // write through the State Engine event seam.
  const logged = storeIn(cwd).logEvent('task.evidence_added', task.id, CLI_ACTOR, {
    evidence: ids,
    reason: 'file-baseline',
  });
  if (!logged.ok) return fail(logged.error);
  return null;
}

function twoPositionals(
  ctx: RunContext,
  command: string,
): { id: string; status: string } | Envelope {
  const [id, status, extra] = ctx.positionals;
  if (!id || !status) {
    return usage(
      `'${command}' requires a task id and a target status.`,
      command,
      `Usage: boldash state ${command} <task-id> <status>.`,
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      command,
      `Usage: boldash state ${command} <task-id> <status>.`,
    );
  }
  return { id, status };
}

/** Runner for `boldash state transition <task-id> <status> [--reason <text>]`. */
export function runStateTransition(ctx: RunContext): Envelope {
  const args = twoPositionals(ctx, 'transition');
  if (!('id' in args)) return args;
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const store = storeIn(cwd);
  const found = store.get(args.id);
  if (!found.ok) return fail(found.error);
  const task = found.data;

  const to = STATUS_VALUES.find((status) => status === args.status);
  if (!to) {
    return usage(
      `'${args.status}' is not a task status.`,
      'status',
      `Allowed: ${STATUS_VALUES.join(', ')}.`,
    );
  }
  const reason = ctx.flags['reason'];
  if (to === 'blocked' && (typeof reason !== 'string' || reason.trim().length === 0)) {
    return usage(
      "Transition to 'blocked' requires a reason — blocked must say why.",
      '--reason',
      'Add --reason <text>.',
    );
  }

  if (task.status === 'planned' && to === 'implementing') {
    const baselineFailure = captureFileBaselines(cwd, task);
    if (baselineFailure) return baselineFailure;
  }
  const moved = store.transition(
    args.id,
    to,
    task.version,
    CLI_ACTOR,
    to === 'blocked' ? { blockedReason: String(reason) } : {},
  );
  return moved.ok ? { ok: true, data: moved.data } : fail(moved.error);
}

/** Runner for `boldash state requirement add <task-id> <text>`. */
export function runStateRequirement(ctx: RunContext): Envelope {
  const [sub, ...rest] = ctx.positionals;
  if (sub !== 'add') {
    return usage(
      sub
        ? `Unknown requirement subcommand '${sub}'.`
        : "'requirement' requires a subcommand.",
      'requirement',
      'Subcommands: add.',
    );
  }
  const [id, ...textParts] = rest;
  const text = textParts.join(' ').trim();
  if (!id || text.length === 0) {
    return usage(
      'requirement add needs a task id and requirement text.',
      'requirement',
      'Usage: boldash state requirement add <task-id> <text>.',
    );
  }
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const store = storeIn(cwd);
  const found = store.get(id);
  if (!found.ok) return fail(found.error);
  // R-ids are auto-assigned next (schema: ^R\\d+$); the engine validates the
  // shape and refuses duplicates — the CLI never edits state by hand.
  const maxR = found.data.requirements.reduce(
    (acc, req) => Math.max(acc, Number(/^R(\d+)$/.exec(req.id)?.[1] ?? '0')),
    0,
  );
  const added = store.addRequirement(
    id,
    { id: `R${maxR + 1}`, text },
    found.data.version,
    CLI_ACTOR,
  );
  return added.ok ? { ok: true, data: added.data } : fail(added.error);
}

/** Runner for `boldash state evidence add <task-id> --type <kind> --ref <ref>`. */
export function runStateEvidence(ctx: RunContext): Envelope {
  const [sub, ...rest] = ctx.positionals;
  if (sub !== 'add') {
    return usage(
      sub ? `Unknown evidence subcommand '${sub}'.` : "'evidence' requires a subcommand.",
      'evidence',
      'Subcommands: add.',
    );
  }
  const [id, extra] = rest;
  if (!id) {
    return usage(
      'evidence add needs a task id.',
      'evidence',
      'Usage: boldash state evidence add <task-id> --type <kind> --ref <ref>.',
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'evidence',
      'Usage: boldash state evidence add <task-id> --type <kind> --ref <ref>.',
    );
  }
  const type = ctx.flags['type'];
  const ref = ctx.flags['ref'];
  if (typeof type !== 'string' || type.length === 0) {
    return usage(
      '--type is required (evidence kind).',
      '--type',
      'Example: --type test-run.',
    );
  }
  if (typeof ref !== 'string' || ref.length === 0) {
    return usage(
      '--ref is required (what to point at).',
      '--ref',
      'Example: --ref evt_9381.',
    );
  }
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const found = storeIn(cwd).get(id);
  if (!found.ok) return fail(found.error);

  const recorded = evidenceStoreIn(cwd).record({
    kind: type,
    task: id,
    summary: `manual evidence: ${ref}`,
    fields: { ref },
  });
  if (!recorded.ok) return fail(recorded.error);
  const logged = storeIn(cwd).logEvent('task.evidence_added', id, CLI_ACTOR, {
    evidence: recorded.data.id,
    ref,
  });
  if (!logged.ok) return fail(logged.error);
  return { ok: true, data: { evidence: recorded.data } };
}
