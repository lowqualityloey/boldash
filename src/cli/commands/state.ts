/**
 * `boldash state get|list` (MS-6 S2) — read-only views over canonical state.
 * Everything here goes through the State Engine's public surface; nothing
 * in this file mutates state (writes are S3: transition/requirement/evidence).
 *
 * Exit contract (plan-001 §3 S2, corrected slip): unknown id →
 * STATE_TASK_NOT_FOUND (exit 2); the family's 4-exit codes
 * (CONCURRENT_MODIFICATION/STATE_LOCKED) belong to transition/claim, not reads.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TaskStore, TRANSITIONS } from '../../core/state/index.js';
import type { TaskStatus } from '../../core/state/index.js';
import { systemClock } from '../../shared/clock.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Envelope, RunContext } from '../types.js';

/** Status values accepted by `--status`, derived from the transition matrix. */
export const STATUS_VALUES: readonly TaskStatus[] = Object.keys(
  TRANSITIONS,
) as TaskStatus[];

/** Risk values accepted by `--risk` — mirrors task.schema.json (drift-tested). */
export const RISK_VALUES = ['trivial', 'low', 'medium', 'high', 'critical'] as const;

/** Type values accepted by `--type` — mirrors task.schema.json (drift-tested). */
export const TYPE_VALUES = [
  'bugfix',
  'feature',
  'refactor',
  'migration',
  'security',
  'architecture',
  'docs',
  'chore',
] as const;

/** `state list --limit` default (docs/cli-reference.md §state list). */
export const DEFAULT_LIMIT = 50;

function fail(error: ErrorInfo): Envelope {
  return { ok: false, error };
}

function usage(message: string, field: string, suggestion: string): Envelope {
  return fail({ code: 'CLI_USAGE', message, field, suggestion });
}

function precondition(cwd: string): Envelope {
  return fail({
    code: 'CLI_PRECONDITION_FAILED',
    message: 'This repository is not initialized (.boldash/ not found).',
    field: '.boldash',
    suggestion: 'Run `boldash init` first.',
    context: { cwd },
  });
}

function storeIn(cwd: string): TaskStore {
  const boldashDir = join(cwd, '.boldash');
  return new TaskStore(
    {
      stateFile: join(boldashDir, 'state', 'tasks.json'),
      eventsFile: join(boldashDir, 'events.jsonl'),
    },
    systemClock,
  );
}

/** Reject enum-flag values the parser could never have produced (belt + braces). */
function enumFlag<T extends string>(
  ctx: RunContext,
  name: string,
  values: readonly T[],
): { ok: true; value?: T } | { ok: false; envelope: Envelope } {
  const raw = ctx.flags[name];
  if (raw === undefined) return { ok: true };
  const match = values.find((v) => v === raw);
  if (match === undefined) {
    return {
      ok: false,
      envelope: usage(
        `--${name} must be one of: ${values.join(', ')}.`,
        `--${name}`,
        'Run `boldash state list --help` for accepted values.',
      ),
    };
  }
  return { ok: true, value: match };
}

/** Runner for `boldash state get <task-id>`; data is the canonical task, verbatim. */
export function runStateGet(ctx: RunContext): Envelope {
  const [id, extra] = ctx.positionals;
  if (!id) {
    return usage(
      'state get requires a task id.',
      'task_id',
      'Usage: boldash state get <task-id>.',
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'task_id',
      'Usage: boldash state get <task-id>.',
    );
  }
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const got = storeIn(cwd).get(id);
  return got.ok ? { ok: true, data: got.data } : fail(got.error);
}

/** Runner for `boldash state list`; applies engine filters, then the CLI-side limit. */
export function runStateList(ctx: RunContext): Envelope {
  const [extra] = ctx.positionals;
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'state list',
      'Usage: boldash state list [--status <s>] [--risk <r>] [--type <t>] [--owner <o>] [--limit <n>].',
    );
  }
  const status = enumFlag(ctx, 'status', STATUS_VALUES);
  if (!status.ok) return status.envelope;
  const risk = enumFlag(ctx, 'risk', RISK_VALUES);
  if (!risk.ok) return risk.envelope;
  const type = enumFlag(ctx, 'type', TYPE_VALUES);
  if (!type.ok) return type.envelope;

  let limit = DEFAULT_LIMIT;
  const rawLimit = ctx.flags['limit'];
  if (rawLimit !== undefined) {
    if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
      return usage(
        '--limit must be a positive integer.',
        '--limit',
        `Default limit is ${DEFAULT_LIMIT}.`,
      );
    }
    limit = Number(rawLimit);
  }

  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
  const ownerRaw = ctx.flags['owner'];
  const listed = storeIn(cwd).list({
    ...(status.value ? { status: status.value } : {}),
    ...(risk.value ? { risk: risk.value } : {}),
    ...(type.value ? { type: type.value } : {}),
    ...(typeof ownerRaw === 'string' && ownerRaw.length > 0 ? { owner: ownerRaw } : {}),
  });
  if (!listed.ok) return fail(listed.error);
  return {
    ok: true,
    data: {
      total: listed.data.length,
      limit,
      tasks: listed.data.slice(0, limit),
    },
  };
}
