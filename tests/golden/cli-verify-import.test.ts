/**
 * MS-6 S4 golden tests (AC-1, AC-5, AC-7): verify + workflow import through
 * the built bin — PASS and BLOCK per gate exercised through the CLI surface,
 * exits 0/1/2/12 + 0/2/3, JSON envelopes schema-shaped.
 */
import { spawnSync } from 'node:child_process';
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
  const dir = mkdtempSync(join(tmpdir(), 'boldash-golden-s4-'));
  repos.push(dir);
  return dir;
}

const PROPOSAL = JSON.stringify({
  task: {
    type: 'feature',
    risk: 'low',
    scope: { files: ['src/**'] },
    summary: 'Verify journey',
  },
  route: { workflow: 'feature', level: 1 },
});

function toVerifying(repo: string): string {
  expect(boldash(['init', '--cwd', repo]).status).toBe(0);
  expect(
    boldash(['route', '--json', PROPOSAL, '--create', '--cwd', repo, '--format', 'json'])
      .status,
  ).toBe(0);
  expect(
    boldash(['state', 'requirement', 'add', 'TASK-001', 'holds the line', '--cwd', repo])
      .status,
  ).toBe(0);
  expect(
    boldash(['state', 'transition', 'TASK-001', 'implementing', '--cwd', repo]).status,
  ).toBe(0);
  expect(
    boldash(['state', 'transition', 'TASK-001', 'verifying', '--cwd', repo]).status,
  ).toBe(0);
  return 'TASK-001';
}

afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

describe('golden: verify (S4)', () => {
  it('PASS exit 0 then BLOCK exit 1 on the same task (AC-5 both directions)', () => {
    const repo = fixtureRepo();
    toVerifying(repo);
    const packDir = join(repo, '.boldash', 'workflows', 'feature');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(join(repo, 'present.txt'), 'here\n', 'utf8');
    writeFileSync(
      join(packDir, 'done.schema.json'),
      JSON.stringify({
        task_id: '{{task_id}}',
        must_pass: [{ type: 'file_exists', name: 'present file', path: 'present.txt' }],
      }),
      'utf8',
    );

    const pass = boldash(['verify', 'TASK-001', '--cwd', repo, '--format', 'json']);
    expect(pass.status, pass.stderr).toBe(0);
    expect(envelope(pass.stdout)).toMatchObject({
      ok: true,
      data: { task: 'TASK-001', status: 'VERIFIED' },
    });

    writeFileSync(
      join(packDir, 'done.schema.json'),
      JSON.stringify({
        task_id: '{{task_id}}',
        must_pass: [{ type: 'file_exists', name: 'missing file', path: 'gone.txt' }],
      }),
      'utf8',
    );
    const blocked = boldash(['verify', 'TASK-001', '--cwd', repo, '--format', 'json']);
    expect(blocked.status).toBe(1);
    expect(envelope(blocked.stdout)).toMatchObject({
      ok: false,
      error: { code: 'VERIFY_BLOCKED' },
    });
  });

  it('missing contract exit 2; timeout exit 12 with a real short-timeout command', () => {
    const bare = fixtureRepo();
    toVerifying(bare);
    const missing = boldash(['verify', 'TASK-001', '--cwd', bare, '--format', 'json']);
    expect(missing.status).toBe(2);
    expect(envelope(missing.stdout)).toMatchObject({
      error: { code: 'VERIFY_CONTRACT_INVALID' },
    });

    const packDir = join(bare, '.boldash', 'workflows', 'feature');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(
      join(packDir, 'done.schema.json'),
      JSON.stringify({
        task_id: '{{task_id}}',
        must_pass: [{ type: 'command', name: 'hangs', run: 'sleep 5', timeout_ms: 1000 }],
      }),
      'utf8',
    );
    const timed = boldash(['verify', 'TASK-001', '--cwd', bare, '--format', 'json']);
    expect(timed.status).toBe(12);
    expect(envelope(timed.stdout)).toMatchObject({
      error: { code: 'VERIFY_COMMAND_TIMEOUT' },
    });
  });

  it('--all scans verifying tasks; unknown id is exit 2', () => {
    const repo = fixtureRepo();
    toVerifying(repo);
    const packDir = join(repo, '.boldash', 'workflows', 'feature');
    mkdirSync(packDir, { recursive: true });
    writeFileSync(join(repo, 'present.txt'), 'x', 'utf8');
    writeFileSync(
      join(packDir, 'done.schema.json'),
      JSON.stringify({
        task_id: '{{task_id}}',
        must_pass: [{ type: 'file_exists', name: 'present file', path: 'present.txt' }],
      }),
      'utf8',
    );
    const all = boldash(['verify', '--all', '--cwd', repo, '--format', 'json']);
    expect(all.status, all.stderr).toBe(0);
    expect((envelope(all.stdout).data as Json).verified).toContain('TASK-001');

    const ghost = boldash(['verify', 'TASK-404', '--cwd', repo, '--format', 'json']);
    expect(ghost.status).toBe(2);
    expect(envelope(ghost.stdout)).toMatchObject({
      error: { code: 'STATE_TASK_NOT_FOUND' },
    });
  });
});

describe('golden: workflow import (S4)', () => {
  it('imports a pack file as a stub contract (exit 0), strips commands', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--cwd', repo]).status).toBe(0);
    const src = join(repo, 'pack.json');
    writeFileSync(
      src,
      JSON.stringify({
        name: 'imported-flow',
        description: 'Imported',
        lifecycle: 'BUILD',
        requires: ['filesystem.read'],
        optional: [],
        contract: {
          task_id: '{{task_id}}',
          must_pass: [
            { type: 'command', name: 'danger', run: 'echo hi' },
            { type: 'file_exists', name: 'safe', path: 'a.txt' },
          ],
        },
      }),
      'utf8',
    );
    const imported = boldash([
      'workflow',
      'import',
      src,
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(imported.status, imported.stderr).toBe(0);
    expect(envelope(imported.stdout).data).toMatchObject({
      imported: true,
      workflow: 'imported-flow',
      skipped_commands: 1,
    });
    const written = JSON.parse(
      readFileSync(
        join(repo, '.boldash', 'workflows', 'imported-flow', 'done.schema.json'),
        'utf8',
      ),
    ) as {
      must_pass: Array<{ type: string }>;
    };
    expect(written.must_pass.every((c) => c.type !== 'command')).toBe(true);

    const missing = boldash([
      'workflow',
      'import',
      join(repo, 'absent.json'),
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(missing.status).toBe(2);
  });
});
