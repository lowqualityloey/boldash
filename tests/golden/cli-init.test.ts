/**
 * MS-6 S1 golden tests (AC-1/AC-4): the BUILT CLI (dist/cli/main.js, via the
 * package.json bin entry) run against throwaway fixture repositories.
 * `npm test` builds first (pretest). These prove packaging + argv + exit
 * codes + envelope against a real process — not an in-process mock.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('../../dist/cli/main.js', import.meta.url));

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function boldash(args: string[], cwd?: string): Run {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function fixtureRepo(): string {
  return mkdtempSync(join(tmpdir(), 'boldash-golden-'));
}

function envelope(out: string): Record<string, never> {
  return JSON.parse(out.trim()) as Record<string, never>;
}

describe('golden: boldash init (AC-1)', () => {
  it('produces the scaffold tree and a valid envelope, exit 0', () => {
    const repo = fixtureRepo();
    const run = boldash(['init', '--format', 'json', '--cwd', repo]);
    expect(run.status, run.stderr).toBe(0);
    const env = envelope(run.stdout);
    expect(env).toMatchObject({ ok: true });
    expect(env['data']).toMatchObject({ initialized: true, profile: 'balanced' });

    for (const f of [
      '.boldash/state/tasks.json',
      '.boldash/state/project.json',
      '.boldash/state/decisions.json',
      '.boldash/state/evidence.json',
      '.boldash/events.jsonl',
      '.boldash/config.yaml',
    ]) {
      expect(existsSync(join(repo, f)), f).toBe(true);
    }
    expect(existsSync(join(repo, '.boldash/evidence'))).toBe(true);
    // ruled scaffold-only (NOTES §4 R3): no pack files anywhere
    expect(existsSync(join(repo, '.boldash/workflows'))).toBe(false);
  });

  it('is byte-stable JSON across equivalent runs (sorted keys, P1)', () => {
    const a = envelope(
      boldash(['init', '--format', 'json', '--cwd', fixtureRepo()]).stdout,
    );
    const b = envelope(
      boldash(['--format', 'json', 'init', '--cwd', fixtureRepo()]).stdout,
    );
    const strip = (o: unknown): string =>
      JSON.stringify(o)
        .replace(/"path":"[^"]+"/g, '""')
        .replace(/"created_at":"[^"]+"/g, '""');
    expect(strip(a)).toBe(strip(b));
  });

  it('refuses to clobber an existing .boldash/ — exit 2, structured error', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--cwd', repo]).status).toBe(0);
    const run = boldash(['init', '--cwd', repo, '--format', 'json']);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: { code: 'CLI_PRECONDITION_FAILED', field: '.boldash' },
    });
  });

  it('--force rebuilds the scaffold, exit 0', () => {
    const repo = fixtureRepo();
    boldash(['init', '--cwd', repo, '--profile', 'strict']);
    writeMarker(repo);
    const run = boldash([
      'init',
      '--force',
      '--profile',
      'strict',
      '--cwd',
      repo,
      '--format',
      'json',
    ]);
    expect(run.status, run.stderr).toBe(0);
    expect(envelope(run.stdout)).toMatchObject({ ok: true, data: { profile: 'strict' } });
    expect(existsSync(join(repo, '.boldash/marker.txt'))).toBe(false);
  });
});

function writeMarker(repo: string): void {
  writeFileSync(join(repo, '.boldash/marker.txt'), 'x', 'utf8');
}

describe('golden: argv + envelope contract (AC-4)', () => {
  it('unknown flag → exit 2 CLI_USAGE with field', () => {
    const run = boldash(['init', '--froce', '--format', 'json']);
    expect(run.status).toBe(2);
    expect(envelope(run.stdout)).toMatchObject({
      ok: false,
      error: { code: 'CLI_USAGE', field: '--froce' },
    });
  });

  it('unknown command → exit 2 listing supported commands', () => {
    const run = boldash(['nope', '--format', 'json']);
    expect(run.status).toBe(2);
    expect(JSON.stringify(envelope(run.stdout))).toContain('supported_commands');
  });

  it('bad --format value is caught even for a failing parse', () => {
    const run = boldash(['--format', 'yaml', 'init']);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain('human, json');
  });

  it('--help exits 0 and honors the root budget; --version prints', () => {
    const help = boldash(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(200);
    const v = boldash(['--version']);
    expect(v.status).toBe(0);
    expect(v.stdout).toMatch(/^boldash \d+\.\d+\.\d+/);
  });

  it('bare invocation is a usage error, not silence (P10)', () => {
    const run = boldash([]);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain('A command is required');
  });
});
