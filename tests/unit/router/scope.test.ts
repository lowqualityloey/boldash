import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkScope } from '../../../src/core/router/scope.js';
import { exitCodeFor } from '../../../src/shared/errors.js';

/**
 * T-10 / T-11 (plan §6): step-6 scope checking. Real temp directories only —
 * the existence predicate is the real one, never a canned stub (AGENTS.md).
 */
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-scope-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('checkScope (T-10: PASS silent, BLOCK warning-only)', () => {
  it('passes silently when every literal file exists', () => {
    writeFileSync(join(dir, 'README.md'), '# hi');
    expect(checkScope(['README.md'], { cwd: dir })).toEqual([]);
  });

  it('warns (never fails) for a missing literal file, with the doc-pinned message', () => {
    writeFileSync(join(dir, 'README.md'), '# hi');
    const warnings = checkScope(['README.md', 'src/x.ts'], { cwd: dir });
    expect(warnings).toHaveLength(1);
    const w = warnings[0];
    expect(w?.code).toBe('SCOPE_FILE_NOT_FOUND');
    expect(w?.message).toBe("Scope file 'src/x.ts' not found.");
    expect(w?.field).toBe('task.scope.files');
    expect(exitCodeFor('SCOPE_FILE_NOT_FOUND')).toBe(0); // warning: exit 0 by contract
  });

  it('skips glob declarations instead of false-warning on greenfield targets', () => {
    // Brownfield root (one real file) so the greenfield guard cannot mask the glob rule:
    writeFileSync(join(dir, 'package.json'), '{}');
    const warnings = checkScope(['src/new-module/*', 'src/auth/**/*.ts', 'a?b.ts'], { cwd: dir });
    expect(warnings).toEqual([]);
  });

  it('resolves absolute declarations without joining cwd', () => {
    const abs = join(dir, 'there.ts');
    writeFileSync(abs, '');
    expect(checkScope([abs], { cwd: dir })).toEqual([]);
    expect(checkScope([join(dir, 'gone.ts')], { cwd: dir })).toHaveLength(1);
  });
});

describe('checkScope greenfield mode (T-11)', () => {
  it('raises no warnings in an empty root — nothing exists yet, by definition', () => {
    expect(checkScope(['README.md', 'src/app.ts'], { cwd: dir })).toEqual([]);
  });

  it('treats an absent root as greenfield, not as an IO failure', () => {
    expect(checkScope(['x.md'], { cwd: join(dir, 'nope') })).toEqual([]);
  });

  it('skips entirely when no cwd is provided (pure routing mode)', () => {
    expect(checkScope(['definitely-missing-xyz.ts'], {})).toEqual([]);
  });

  it('no scope declared → no warnings even in a brownfield root', () => {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'a.ts'), '');
    expect(checkScope(undefined, { cwd: dir })).toEqual([]);
  });
});
