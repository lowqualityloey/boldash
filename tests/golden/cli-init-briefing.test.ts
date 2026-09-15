/**
 * MS-7 S3 golden tests (AC-1): the briefing block through the BUILT bin on
 * throwaway fixture repositories — process-level proof that init appends
 * exactly one marker block, survives `--force` re-inits, coexists with other
 * tools' blocks byte-for-byte, and that a refusal still touches nothing.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRIEFING_END, BRIEFING_START } from '../../src/adapters/index.js';

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
  const dir = mkdtempSync(join(tmpdir(), 'boldash-golden-briefing-'));
  mkdirSync(join(dir, '.git'));
  return dir;
}

type Json = Record<string, unknown>;

function envelope(out: string): Json {
  return JSON.parse(out.trim()) as Json;
}

function briefingFile(repo: string): string {
  return readFileSync(join(repo, 'AGENTS.md'), 'utf8');
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('golden: boldash init briefing append (AC-1)', () => {
  it('fresh repo gets exactly one briefing block; envelope reports the write', () => {
    const repo = fixtureRepo();
    const run = boldash(['init', '--format', 'json', '--cwd', repo]);
    expect(run.status, run.stderr).toBe(0);
    expect(envelope(run.stdout)['data']).toMatchObject({
      briefing: { path: join(repo, 'AGENTS.md'), skipped: false },
    });
    const text = briefingFile(repo);
    expect(countOf(text, BRIEFING_START)).toBe(1);
    expect(countOf(text, BRIEFING_END)).toBe(1);
  });

  it('double init --force coalesces to exactly one block; second run skips', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--format', 'json', '--cwd', repo]).status).toBe(0);
    const second = boldash(['init', '--force', '--format', 'json', '--cwd', repo]);
    expect(second.status, second.stderr).toBe(0);
    expect(envelope(second.stdout)['data']).toMatchObject({
      briefing: { skipped: true },
    });
    expect(boldash(['init', '--force', '--format', 'json', '--cwd', repo]).status).toBe(
      0,
    );
    const text = briefingFile(repo);
    expect(countOf(text, BRIEFING_START)).toBe(1);
    expect(countOf(text, BRIEFING_END)).toBe(1);
  });

  it('PromptKit block survives byte-for-byte; Boldash block is appended after it', () => {
    const repo = fixtureRepo();
    const foreign =
      '<!-- PROMPTKIT_START -->\n\n## PromptKit OS\n\nkeep me exact\n\n<!-- PROMPTKIT_END -->\n';
    writeFileSync(join(repo, 'AGENTS.md'), foreign, 'utf8');
    expect(boldash(['init', '--format', 'json', '--cwd', repo]).status).toBe(0);
    const text = briefingFile(repo);
    expect(text.startsWith(foreign)).toBe(true);
    expect(countOf(text, BRIEFING_START)).toBe(1);
    expect(countOf(text, 'PROMPTKIT_START')).toBe(1);
  });

  it('re-run without --force refuses (exit 2) and changes nothing', () => {
    const repo = fixtureRepo();
    expect(boldash(['init', '--format', 'json', '--cwd', repo]).status).toBe(0);
    const before = briefingFile(repo);
    const refused = boldash(['init', '--format', 'json', '--cwd', repo]);
    expect(refused.status).toBe(2);
    expect(envelope(refused.stdout)['error']).toMatchObject({
      code: 'CLI_PRECONDITION_FAILED',
    });
    expect(briefingFile(repo)).toBe(before);
  });
});
