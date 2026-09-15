/**
 * MS-6 S3 golden tests (AC-1…AC-4, AC-8): the full agent journey through the
 * built bin — route (json + stdin) → --create planned task → requirement add
 * → planned→implementing transition → file-baseline capture on disk — plus
 * the exit-code contract (0/2/3 route; 0/2/4 state writes).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('../../dist/cli/main.js', import.meta.url));

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function boldash(args: string[], cwd?: string, stdin?: string): Run {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    ...(stdin !== undefined ? { input: stdin } : {}),
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

type Json = Record<string, unknown>;

function envelope(out: string): Json {
  return JSON.parse(out.trim()) as Json;
}

const repos: string[] = [];
function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'boldash-golden-s3-'));
  repos.push(dir);
  return dir;
}

const PROPOSAL = JSON.stringify({
  task: {
    type: 'feature',
    risk: 'medium',
    scope: { files: ['src/**'] },
    summary: 'Ship the golden path',
  },
  route: { workflow: 'feature', level: 2 },
});

const LOCKED = 'protected/lock.md';
const CONTRACT = JSON.stringify({
  task_id: '{{task_id}}',
  must_pass: [{ name: 'impl exists', type: 'file_exists', path: 'src/impl.ts' }],
  must_not: [{ name: 'lock untouched', type: 'file_not_modified', path: LOCKED }],
});

afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

describe('golden: route (S3)', () => {
  it('routes inline JSON within the P9 success budget, and refuses bad levels (exit 2)', () => {
    const dir = fixtureRepo();
    const ok = boldash(['route', '--json', PROPOSAL, '--cwd', dir, '--format', 'json']);
    expect(ok.status, ok.stderr).toBe(0);
    const env = envelope(ok.stdout);
    expect(env).toMatchObject({
      ok: true,
      data: { workflow: 'feature', level: 2 },
    });
    expect(ok.stdout.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(80);

    const badLevel = PROPOSAL.replace('"level":2', '"level":0');
    const mismatch = boldash([
      'route',
      '--json',
      badLevel,
      '--cwd',
      dir,
      '--format',
      'json',
    ]);
    expect(mismatch.status).toBe(2);
    expect(envelope(mismatch.stdout)).toMatchObject({
      ok: false,
      error: { code: 'LEVEL_RISK_MISMATCH' },
    });
    expect(mismatch.stdout.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
  });

  it('reads a piped proposal from stdin', () => {
    const dir = fixtureRepo();
    const piped = boldash(['route', '--cwd', dir, '--format', 'json'], dir, PROPOSAL);
    expect(piped.status, piped.stderr).toBe(0);
    expect(envelope(piped.stdout).data).toMatchObject({ workflow: 'feature' });
  });

  it('--create writes a planned task (events included); without init it is a precondition error', () => {
    const bare = fixtureRepo();
    const refused = boldash([
      'route',
      '--json',
      PROPOSAL,
      '--create',
      '--cwd',
      bare,
      '--format',
      'json',
    ]);
    expect(refused.status).toBe(2);
    expect(envelope(refused.stdout)).toMatchObject({
      error: { code: 'CLI_PRECONDITION_FAILED' },
    });

    const repo = fixtureRepo();
    expect(boldash(['init', '--cwd', repo]).status).toBe(0);
    const created = boldash([
      'route',
      '--json',
      PROPOSAL,
      '--create',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(created.status, created.stderr).toBe(0);
    expect(envelope(created.stdout).data).toMatchObject({
      created: { id: 'TASK-001', status: 'planned' },
    });

    const got = boldash(['state', 'get', 'TASK-001', '--cwd', repo, '--format', 'json']);
    expect(envelope(got.stdout).data).toMatchObject({
      title: 'Ship the golden path',
      workflow: 'feature',
      status: 'planned',
    });
    const events = readFileSync(join(repo, '.boldash', 'events.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { action: string });
    expect(events.map((e) => e.action)).toEqual([
      'task.created',
      'task.transitioned',
      'route.validated',
    ]);
  });
});

describe('golden: state writes + AC-8 capture (S3)', () => {
  it('requirement add → implementing captures sha256 baselines the engine can consume', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--cwd', repo]).status).toBe(0);
    // Contract + protected file placed as fixtures (product writes stay in
    // the engines); the CLI must discover and baseline them on the edge.
    const packDir = join(repo, '.boldash', 'workflows', 'feature');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(join(packDir, 'done.schema.json'), CONTRACT, 'utf8');
    mkdirSync(join(repo, 'protected'), { recursive: true });
    const content = '# stay as you are\n';
    writeFileSync(join(repo, LOCKED), content, 'utf8');

    expect(
      boldash([
        'route',
        '--json',
        PROPOSAL,
        '--create',
        '--cwd',
        repo,
        '--format',
        'json',
      ]).status,
    ).toBe(0);

    const noReq = boldash([
      'state',
      'transition',
      'TASK-001',
      'implementing',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(noReq.status).toBe(2);
    expect(envelope(noReq.stdout)).toMatchObject({
      error: { code: 'STATE_MISSING_REQUIREMENT' },
    });

    const req = boldash([
      'state',
      'requirement',
      'add',
      'TASK-001',
      'lock file stays untouched',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(req.status, req.stderr).toBe(0);
    expect((envelope(req.stdout).data as Json).requirements).toHaveLength(1);

    const moved = boldash([
      'state',
      'transition',
      'TASK-001',
      'implementing',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(moved.status, moved.stderr).toBe(0);
    expect((envelope(moved.stdout).data as Json).status).toBe('implementing');

    const index = JSON.parse(
      readFileSync(join(repo, '.boldash', 'state', 'evidence.json'), 'utf8'),
    ) as { entries: Array<Record<string, unknown>> };
    const baseline = index.entries.find((e) => e['kind'] === 'file-baseline');
    expect(baseline).toMatchObject({
      path: LOCKED,
      task: 'TASK-001',
      hash: `sha256:${createHash('sha256').update(content).digest('hex')}`,
    });
  });

  it('state write exits: blocked without reason 2, unknown task 2, evidence add 0', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--cwd', repo]).status).toBe(0);
    boldash(['route', '--json', PROPOSAL, '--create', '--cwd', repo, '--format', 'json']);

    const blockedNoReason = boldash([
      'state',
      'transition',
      'TASK-001',
      'blocked',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(blockedNoReason.status).toBe(2);
    expect(envelope(blockedNoReason.stdout)).toMatchObject({
      error: { code: 'CLI_USAGE', field: '--reason' },
    });

    const blocked = boldash([
      'state',
      'transition',
      'TASK-001',
      'blocked',
      '--reason',
      'needs API keys',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(blocked.status, blocked.stderr).toBe(0);
    expect(envelope(blocked.stdout).data as Json).toMatchObject({
      status: 'blocked',
      blocked_reason: 'needs API keys',
    });

    const missing = boldash([
      'state',
      'evidence',
      'add',
      'TASK-404',
      '--type',
      'test-run',
      '--ref',
      'evt_1',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(missing.status).toBe(2);

    const ev = boldash([
      'state',
      'evidence',
      'add',
      'TASK-001',
      '--type',
      'test-run',
      '--ref',
      'evt_1',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(ev.status, ev.stderr).toBe(0);
    expect((envelope(ev.stdout).data as { evidence: Json }).evidence).toMatchObject({
      kind: 'test-run',
      task: 'TASK-001',
    });
  });

  it('registry honesty holds at S4: verify is wired (precondition without init)', () => {
    const dir = fixtureRepo();
    const v = boldash(['verify', '--all', '--cwd', dir, '--format', 'json']);
    expect(v.status).toBe(2);
    expect(envelope(v.stdout)).toMatchObject({
      error: { code: 'CLI_PRECONDITION_FAILED' },
    });
  });
});
