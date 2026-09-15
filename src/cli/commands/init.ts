/**
 * `boldash init` (MS-6 S1 scaffold-only, ruled NOTES §4 R3; MS-7 S2 host wiring).
 * Creates the `.boldash/` tree through the State Engine scaffold, detects the
 * host through the generic adapter, and records the probed capabilities in
 * `project.json`. Writes NO pack files (format deferred to MS-8); the host
 * briefing lands in S3. config.yaml stays a literal template (ADR-0003).
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_ADAPTERS, detectHost, probeCapabilities } from '../../adapters/index.js';
import { systemClock } from '../../shared/clock.js';
import { scaffoldProjectState, PROFILES, type Profile } from '../../core/state/index.js';
import type { Envelope, RunContext } from '../types.js';
import type { ErrorInfo } from '../../shared/result.js';

/**
 * Generic hosts cannot enforce hooks — they serve in advisory mode
 * (ARCHITECTURE.md §5.3 closing note). Carried in every init envelope so
 * the limitation is visible, never silent.
 */
export const ADVISORY_MODE_NOTE = 'ADVISORY_MODE';

function fail(error: ErrorInfo): Envelope {
  return { ok: false, error };
}

/** Runner for `boldash init`. Never throws; every path returns an envelope. */
export function runInit(ctx: RunContext): Envelope {
  const cwd = ctx.globals.cwd;
  const boldashDir = join(cwd, '.boldash');
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
  if (host !== undefined && !KNOWN_ADAPTERS.includes(host)) {
    return fail({
      code: 'CLI_USAGE',
      message: `Unknown host adapter '${host}'.`,
      field: '--host',
      suggestion: `Supported adapters: ${KNOWN_ADAPTERS.join(', ')}.`,
    });
  }

  // Detection runs before any mutation: outside a git working tree there is
  // nothing to initialize (AC-2, FMEA "init outside a Git repo" row).
  const detected = detectHost(cwd);
  if (!detected.gitRepo) {
    return fail({
      code: 'CLI_PRECONDITION_FAILED',
      message: `Cannot initialize outside a git repository (no .git in '${cwd}').`,
      field: '.git',
      suggestion: 'Run `boldash init` inside a git working tree.',
    });
  }

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

  const capabilities = [...probeCapabilities()];
  const scaffold = scaffoldProjectState(
    {
      boldashDir,
      profile: rawProfile as Profile,
      ...(host ? { host } : {}),
      capabilities,
    },
    systemClock,
  );
  if (!scaffold.ok) {
    return fail(scaffold.error);
  }
  // A forced host means the operator already chose: no HOST_UNKNOWN warning.
  // Advisory mode is unconditional on generic — enforcement cannot block.
  const warnings =
    host !== undefined
      ? [ADVISORY_MODE_NOTE]
      : [...detected.warnings, ADVISORY_MODE_NOTE];
  return {
    ok: true,
    data: {
      initialized: true,
      path: boldashDir,
      profile: rawProfile,
      ...(host ? { host } : {}),
      adapter: 'generic',
      capabilities,
      warnings,
      created: scaffold.data.created,
    },
  };
}
