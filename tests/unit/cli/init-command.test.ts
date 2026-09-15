/**
 * MS-7 S2 unit tests: `runInit` host wiring against real temp dirs
 * (AGENTS: never mock fs). Detection matrix, refusal paths, and the
 * persisted capability set — the built-bin golden side lives in
 * `tests/golden/cli-init.test.ts`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exitCodeFor } from '../../../src/shared/errors.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';
import { ADVISORY_MODE_NOTE, runInit } from '../../../src/cli/commands/init.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-cli-init-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ctx(
  flags: Record<string, string | boolean> = {},
  cwd: string = dir,
): RunContext {
  return {
    globals: { format: 'json', quiet: false, verbose: false, cwd, color: true },
    flags,
    positionals: [],
  };
}

function gitRepo(): string {
  mkdirSync(join(dir, '.git'));
  return dir;
}

function errOf(e: Envelope): { code: string; field?: string } {
  if (e.ok) throw new Error(`expected failure, got ok`);
  return { code: e.error.code, ...(e.error.field ? { field: e.error.field } : {}) };
}

function dataOf(e: Envelope): Record<string, unknown> {
  if (!e.ok) throw new Error(`expected ok, got: ${e.error.code} ${e.error.message}`);
  return e.data as Record<string, unknown>;
}

describe('runInit host wiring (MS-7 S2)', () => {
  it('refuses outside a git repo — CLI_PRECONDITION_FAILED, exit 2 (AC-2)', () => {
    const e = runInit(ctx());
    expect(errOf(e)).toMatchObject({ code: 'CLI_PRECONDITION_FAILED', field: '.git' });
    expect(exitCodeFor('CLI_PRECONDITION_FAILED')).toBe(2);
    expect(existsSync(join(dir, '.boldash'))).toBe(false);
  });

  it('rejects an unknown --host — CLI_USAGE naming supported adapters (R2)', () => {
    const e = runInit(ctx({ host: 'claude' }, gitRepo()));
    expect(errOf(e)).toMatchObject({ code: 'CLI_USAGE', field: '--host' });
    expect(existsSync(join(dir, '.boldash'))).toBe(false);
  });

  it('rejects an unknown --profile before touching the filesystem (AC-4)', () => {
    const e = runInit(ctx({ profile: 'nope' }, gitRepo()));
    expect(errOf(e)).toMatchObject({ code: 'CLI_USAGE', field: '--profile' });
    expect(existsSync(join(dir, '.boldash'))).toBe(false);
  });

  it('auto-detect warns HOST_UNKNOWN plus advisory mode on a bare repo', () => {
    const data = dataOf(runInit(ctx({}, gitRepo())));
    expect(data['adapter']).toBe('generic');
    expect(data['warnings']).toEqual(['HOST_UNKNOWN', ADVISORY_MODE_NOTE]);
    expect(data['capabilities']).toEqual([
      'filesystem.read',
      'filesystem.write',
      'shell.execute',
      'git.read',
      'human_approval',
    ]);
  });

  it('a forced --host drops HOST_UNKNOWN but keeps advisory mode', () => {
    const data = dataOf(runInit(ctx({ host: 'generic' }, gitRepo())));
    expect(data['warnings']).toEqual([ADVISORY_MODE_NOTE]);
    expect(data['host']).toBe('generic');
  });

  it('persists the probed set to project.json and the profile to config.yaml (AC-4)', () => {
    dataOf(runInit(ctx({ profile: 'lite' }, gitRepo())));
    const project = JSON.parse(
      readFileSync(join(dir, '.boldash', 'state', 'project.json'), 'utf8'),
    ) as { profile: string; capabilities: string[] };
    expect(project.profile).toBe('lite');
    expect(project.capabilities).toEqual([
      'filesystem.read',
      'filesystem.write',
      'shell.execute',
      'git.read',
      'human_approval',
    ]);
    const config = readFileSync(join(dir, '.boldash', 'config.yaml'), 'utf8');
    expect(config).toContain('profile: lite');
  });
});
