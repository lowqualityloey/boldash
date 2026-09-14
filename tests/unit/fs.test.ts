import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findTempArtifacts, writeJsonAtomic } from '../../src/shared/fs.js';

/**
 * AC-3 (MS-2): writeJsonAtomic is crash-safe in its ordering.
 * Uses real temp directories; never mocks the filesystem (AGENTS.md).
 */
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-fs-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('writeJsonAtomic (AC-3)', () => {
  it('writes valid pretty JSON with trailing newline and leaves no temp behind', () => {
    const target = join(dir, 'tasks.json');
    writeJsonAtomic(target, { schema_version: 1, tasks: [{ id: 'TASK-1' }] });
    expect(JSON.parse(readFileSync(target, 'utf8')).schema_version).toBe(1);
    expect(readFileSync(target, 'utf8').endsWith('\n')).toBe(true);
    expect(findTempArtifacts(dir)).toEqual([]);
  });

  it('replaces an existing file wholly (no torn interleaving)', () => {
    const target = join(dir, 'state.json');
    writeFileSync(target, `${'x'.repeat(5000)}\n`);
    const next = { payload: 'small', n: 42 };
    writeJsonAtomic(target, next);
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual(next);
  });

  it('a serialization failure leaves the original bytes untouched and creates no temp', () => {
    const target = join(dir, 'keep.json');
    const before = '{"original":true}\n';
    writeFileSync(target, before);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeJsonAtomic(target, circular)).toThrow();
    expect(readFileSync(target, 'utf8')).toBe(before);
    expect(findTempArtifacts(dir)).toEqual([]);
  });

  it('is durable across concurrent writers: final content equals one complete write', () => {
    const target = join(dir, 'multi.json');
    for (let i = 0; i < 10; i++) writeJsonAtomic(target, { writer: i, padded: 'y'.repeat(2000) });
    const final = JSON.parse(readFileSync(target, 'utf8')) as { writer: number };
    expect(final.writer).toBe(9);
    expect(findTempArtifacts(dir)).toEqual([]);
  });

  it('fails cleanly when the destination directory does not exist (no stray temps, caller decides)', () => {
    const missing = join(dir, 'nope', 'deep.json');
    expect(() => writeJsonAtomic(missing, { a: 1 })).toThrow();
    const leftovers = findTempArtifacts(dir);
    expect(leftovers).toEqual([]);
    expect(() => statSync(missing)).toThrow();
  });

  it('creates a fresh file when the destination is absent', () => {
    const target = join(dir, 'new.json');
    writeJsonAtomic(target, [1, 2, 3]);
    expect(statSync(target).isFile()).toBe(true);
  });

  it('does not silently mkdir parents (State Engine owns layout creation)', () => {
    mkdirSync(join(dir, 'tracked'), { recursive: true });
    expect(() => writeJsonAtomic(join(dir, 'tracked', 'sub', 'x.json'), {})).toThrow();
  });
});
