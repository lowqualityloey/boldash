/**
 * `boldash init` (MS-6 S1, ruled scaffold-only — NOTES §4 R3).
 * Creates the `.boldash/` tree and engine-valid state files through the
 * State Engine scaffold; writes NO pack files (format deferred to MS-8)
 * and no host briefing (MS-7). config.yaml is a literal template.
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { systemClock } from '../../shared/clock.js';
import {
  scaffoldProjectState,
  PROFILES,
  type Profile,
} from '../../core/state/scaffold.js';
import type { Envelope, RunContext } from '../types.js';
import type { ErrorInfo } from '../../shared/result.js';

function fail(error: ErrorInfo): Envelope {
  return { ok: false, error };
}

/** Runner for `boldash init`. Never throws; every path returns an envelope. */
export function runInit(ctx: RunContext): Envelope {
  const boldashDir = join(ctx.globals.cwd, '.boldash');
  const force = ctx.flags['force'] === true;
  const rawProfile = String(ctx.flags['profile'] ?? 'balanced');
  if (!PROFILES.includes(rawProfile as Profile)) {
    return fail({
      code: 'CLI_USAGE',
      message: `Unknown profile '${rawProfile}'.`,
      field: '--profile',
      suggestion: `Supported profiles: ${PROFILES.join(', ')}.`,
    });
  }
  const hostFlag = ctx.flags['host'];
  const host = typeof hostFlag === 'string' && hostFlag.length > 0 ? hostFlag : undefined;

  if (existsSync(boldashDir)) {
    if (!force) {
      return fail({
        code: 'CLI_PRECONDITION_FAILED',
        message: 'This repository is already initialized (.boldash/ exists).',
        field: '.boldash',
        suggestion:
          'Re-run with --force to overwrite (destructive), or inspect the existing setup.',
      });
    }
    try {
      rmSync(boldashDir, { recursive: true });
    } catch (cause) {
      return fail({
        code: 'IO_ERROR',
        message: `cannot remove existing .boldash/: ${String(cause)}`,
        field: '.boldash',
      });
    }
  }

  const scaffold = scaffoldProjectState(
    { boldashDir, profile: rawProfile as Profile, ...(host ? { host } : {}) },
    systemClock,
  );
  if (!scaffold.ok) {
    return fail(scaffold.error);
  }
  return {
    ok: true,
    data: {
      initialized: true,
      path: boldashDir,
      profile: rawProfile,
      ...(host ? { host } : {}),
      created: scaffold.data.created,
    },
  };
}
