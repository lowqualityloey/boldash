/**
 * MS-6 S2 golden tests (AC-1/AC-2/AC-4/AC-7): `state get|list` and
 * `workflow list|validate` through the BUILT bin on throwaway fixture repos —
 * process-level proof of exit codes, envelopes, and honest help.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getValidator } from '../../src/shared/schema.js';

const BIN = fileURLToPath(new URL('../../dist/cli/main.js', import.meta.url));

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function boldash(args: string[], cwd?: string): Run {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

type Json = Record<string, unknown>;

function envelope(out: string): Json {
  return JSON.parse(out.trim()) as Json;
}

/** Narrow `data` of a success envelope; throws (test failure) if absent. */
function payload(env: Json): Json {
  expect(env.ok).toBe(true);
  return env.data as Json;
}

function taskIds(v: unknown): string[] {
  return (v as Array<{ id: string }>).map((t) => t.id);
}

const repos: string[] = [];
function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'boldash-golden-s2-'));
  repos.push(dir);
  mkdirSync(join(dir, '.git'));
  return dir;
}

/**
 * Test-fixture seeding only: the AGENTS no-direct-write rule binds product
 * code paths; every task object here is engine-validated on read, so a
 * malformed fixture surfaces as a state error rather than silently passing.
 */
function seedInitializedRepo(): string {
  const repo = fixtureRepo();
  expect(boldash(['init', '--cwd', repo]).status).toBe(0);
  const ts = '2026-09-15T00:00:00.000Z';
  writeFileSync(
    join(repo, '.boldash', 'state', 'tasks.json'),
    JSON.stringify({
      schema_version: 1,
      tasks: [
        {
          schema_version: 1,
          id: 'TASK-001',
          title: 'Plan a thing',
          type: 'feature',
          risk: 'medium',
          level: 2,
          status: 'planned',
          requirements: [{ id: 'R1', text: 'thing exists' }],
          version: 2,
          created_at: ts,
          updated_at: ts,
        },
        {
          schema_version: 1,
          id: 'TASK-002',
          title: 'Fix a thing',
          type: 'bugfix',
          risk: 'low',
          level: 1,
          status: 'proposed',
          requirements: [],
          owner: 'agent-01',
          version: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
    }),
    'utf8',
  );
  return repo;
}

let repo: string;
beforeAll(() => {
  repo = seedInitializedRepo();
});
afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

describe('golden: state get|list (S2)', () => {
  it('state get returns the canonical task; data validates against the task schema', () => {
    const run = boldash(['state', 'get', 'TASK-001', '--cwd', repo, '--format', 'json']);
    expect(run.status, run.stderr).toBe(0);
    const env = envelope(run.stdout);
    expect(env.ok).toBe(true);
    const task = env.data as Json;
    expect(task.id).toBe('TASK-001');
    expect(getValidator('task')(env.data)).toBe(true);
  });

  it('JSON is byte-stable across runs (sorted keys, no ANSI, AC-2)', () => {
    const a = boldash(['state', 'get', 'TASK-001', '--cwd', repo, '--format', 'json']);
    const b = boldash(['--format', 'json', 'state', 'get', 'TASK-001', '--cwd', repo]);
    expect(a.stdout).toBe(b.stdout);
    expect(a.stdout).not.toContain('\u001b[');
  });

  it('unknown task → STATE_TASK_NOT_FOUND, exit 2 (reads never exit 4)', () => {
    const run = boldash(['state', 'get', 'TASK-404', '--cwd', repo, '--format', 'json']);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: { code: 'STATE_TASK_NOT_FOUND' },
    });
  });

  it('uninitialized repo → CLI_PRECONDITION_FAILED, exit 2', () => {
    const bare = fixtureRepo();
    const run = boldash(['state', 'get', 'TASK-001', '--cwd', bare, '--format', 'json']);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: { code: 'CLI_PRECONDITION_FAILED' },
    });
  });

  it('state list filters by status/owner and applies --limit with the true total', () => {
    const planned = boldash([
      'state',
      'list',
      '--status',
      'planned',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(planned.status, planned.stderr).toBe(0);
    expect(taskIds(payload(envelope(planned.stdout)).tasks)).toEqual(['TASK-001']);

    const owned = boldash([
      'state',
      'list',
      '--owner',
      'agent-01',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(taskIds(payload(envelope(owned.stdout)).tasks)).toEqual(['TASK-002']);

    const limited = boldash([
      'state',
      'list',
      '--limit',
      '1',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    const data = payload(envelope(limited.stdout));
    expect(data.total).toBe(2);
    expect((data.tasks as unknown[]).length).toBe(1);
  });

  it('bad filter enum and bad limit → usage errors, exit 2 (AC-4)', () => {
    const badEnum = boldash(['state', 'list', '--status', 'nope', '--cwd', repo]);
    expect(badEnum.status).toBe(2);
    expect(badEnum.stdout).toContain('must be one of');

    const badLimit = boldash([
      'state',
      'list',
      '--limit',
      '0',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(badLimit.status).toBe(2);
    expect(envelope(badLimit.stdout)).toMatchObject({
      ok: false,
      error: { code: 'CLI_USAGE', field: '--limit' },
    });
  });

  it('bare `state` names its wired subcommands (exit 2, not silence)', () => {
    const run = boldash(['state', '--cwd', repo, '--format', 'json']);
    expect(run.status).toBe(2);
    const env = envelope(run.stdout);
    expect(env).toMatchObject({ ok: false, error: { code: 'CLI_USAGE' } });
    const error = env.error as Json;
    expect(error.suggestion).toContain('get, list');
  });
});

describe('golden: workflow list|validate (S2)', () => {
  it('workflow list shows exactly the four canonical built-ins with requirements (R1)', () => {
    const run = boldash(['workflow', 'list', '--cwd', repo, '--format', 'json']);
    expect(run.status, run.stderr).toBe(0);
    const workflows = payload(envelope(run.stdout)).workflows as Array<{
      name: string;
      requires: string[];
    }>;
    expect(workflows.map((w) => w.name)).toEqual(['feature', 'bugfix', 'docs', 'chore']);
    expect(workflows[0]?.requires.length).toBeGreaterThan(0);
  });

  it('workflow validate feature → exit 0 valid', () => {
    const run = boldash([
      'workflow',
      'validate',
      'feature',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(run.status, run.stderr).toBe(0);
    const data = payload(envelope(run.stdout));
    expect(data.valid).toBe(true);
    expect((data.workflow as Json).name).toBe('feature');
  });

  it('workflow validate migration → WORKFLOW_NOT_FOUND, exit 2, enabled set attached', () => {
    const run = boldash([
      'workflow',
      'validate',
      'migration',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: {
        code: 'WORKFLOW_NOT_FOUND',
        context: { enabled: ['feature', 'bugfix', 'docs', 'chore'] },
      },
    });
  });

  it('import is wired since S4: unknown path is a contract error, not CLI_USAGE', () => {
    const run = boldash(['workflow', 'import', 'x', '--cwd', repo, '--format', 'json']);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: { code: 'VERIFY_CONTRACT_INVALID' },
    });
  });

  it('family help is honest and inside budget; root lists the wired families', () => {
    for (const [name, budget] of [
      ['state', 40],
      ['workflow', 40],
    ] as const) {
      const help = boldash([name, '--help']);
      expect(help.status, help.stderr).toBe(0);
      expect(help.stdout.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(budget);
    }
    const root = boldash(['--help']);
    expect(root.stdout).toContain('state');
    expect(root.stdout).toContain('workflow');
    expect(root.stdout.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(200);
  });
});
