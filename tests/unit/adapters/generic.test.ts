/**
 * MS-7 S1 (plan-001): generic adapter unit tests.
 *
 * Detection uses pointed temp dirs (never the ambient environment, except an
 * explicitly injected `env` mapping), so cases are deterministic on any host.
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRIEFING_END,
  BRIEFING_START,
  appendBriefing,
  detectHost,
  genericAdapter,
  hintHost,
  probeCapabilities,
} from '../../../src/adapters/index.js';
import { parseMatrix } from '../router/doc-oracle.js';

const MATRIX = parseMatrix();

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'boldash-generic-'));
}

describe('hintHost (best-effort name hint, never enforcement)', () => {
  it('BOLDASH_HOST override wins over everything', () => {
    expect(hintHost(freshRoot(), { BOLDASH_HOST: 'cursor' }, '')).toBe('cursor');
  });

  it('project marker files hint their host', () => {
    const root = freshRoot();
    writeFileSync(join(root, 'CLAUDE.md'), '# host file\n', 'utf8');
    expect(hintHost(root, {}, '')).toBe('claude');
  });

  it('PATH binaries hint their host without spawning anything', () => {
    const root = freshRoot();
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'codex'), '', 'utf8');
    expect(hintHost(freshRoot(), {}, bin)).toBe('codex');
  });

  it('unrecognized surroundings hint nothing', () => {
    expect(hintHost(freshRoot(), {}, '')).toBeUndefined();
  });
});

describe('detectHost (always generic in v0.1.0)', () => {
  it('resolves generic with HOST_UNKNOWN off-repo and unrecognized', () => {
    const detected = detectHost(freshRoot());
    expect(detected.adapter).toBe('generic');
    expect(detected.gitRepo).toBe(false);
    expect(detected.detectedName).toBeUndefined();
    expect(detected.warnings).toEqual(['HOST_UNKNOWN']);
  });

  it('sees a git working tree and drops no git warning', () => {
    const root = freshRoot();
    mkdirSync(join(root, '.git'));
    const detected = detectHost(root);
    expect(detected.gitRepo).toBe(true);
  });

  it('a recognized host clears HOST_UNKNOWN but keeps generic', () => {
    const root = freshRoot();
    mkdirSync(join(root, '.cursor'));
    const detected = detectHost(root);
    expect(detected.adapter).toBe('generic');
    expect(detected.detectedName).toBe('cursor');
    expect(detected.warnings).toEqual([]);
  });
});

describe('probeCapabilities (plan-001 R1)', () => {
  it('equals exactly the §5.3 Generic column', () => {
    expect([...probeCapabilities()].sort()).toEqual([...(MATRIX.Generic ?? [])].sort());
  });

  it('returns a fresh copy — callers cannot poison later probes', () => {
    const first = new Set(probeCapabilities());
    first.clear();
    expect(probeCapabilities().size).toBeGreaterThan(0);
  });

  it('generic adapter agrees: subagents false, shell true, unknown false', () => {
    expect(genericAdapter.hasCapability('subagents')).toBe(false);
    expect(genericAdapter.hasCapability('shell.execute')).toBe(true);
    expect(genericAdapter.hasCapability('git.commit')).toBe(false);
    expect(genericAdapter.hasCapability('nope')).toBe(false);
  });

  it('the adapter object hands out copies, not its live set', () => {
    // A rogue caller holding the returned reference and mutating through it.
    const seen = genericAdapter.capabilities as unknown as Set<string>;
    seen.clear();
    expect(genericAdapter.capabilities.size).toBeGreaterThan(0);
  });
});

describe('appendBriefing (markers, idempotency, coexistence)', () => {
  it('creates AGENTS.md with exactly one guarded block', () => {
    const root = freshRoot();
    const result = appendBriefing(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skipped).toBe(false);
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(text).toContain(BRIEFING_START);
    expect(text).toContain(BRIEFING_END);
  });

  it('appends to an existing file without touching its bytes', () => {
    const root = freshRoot();
    const original = '# My repo\n\nSome notes.\n';
    writeFileSync(join(root, 'AGENTS.md'), original, 'utf8');
    const result = appendBriefing(root);
    expect(result.ok).toBe(true);
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(text.startsWith(original)).toBe(true);
    expect(text.split(BRIEFING_START).length - 1).toBe(1);
  });

  it('second append is a byte-identical no-op (AC-1 idempotency core)', () => {
    const root = freshRoot();
    appendBriefing(root);
    const before = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const result = appendBriefing(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skipped).toBe(true);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(before);
  });

  it('coexists with PromptKit marker blocks untouched', () => {
    const root = freshRoot();
    const promptkit =
      '<!-- PROMPTKIT_START -->\n\n## PromptKit OS\n\n<!-- PROMPTKIT_END -->\n';
    writeFileSync(join(root, 'AGENTS.md'), promptkit, 'utf8');
    const result = appendBriefing(root);
    expect(result.ok).toBe(true);
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(text).toContain(promptkit);
    expect(text.split(BRIEFING_START).length - 1).toBe(1);
  });
});
