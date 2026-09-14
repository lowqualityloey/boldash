import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CATALOG, ERROR_CODES, exitCodeFor, type ExitCode } from '../../src/shared/errors.js';

/**
 * AC-2 (MS-2): docs/errors.md is the oracle. The catalog in code must contain
 * exactly the codes the document defines, mapped to exactly the exits it states.
 * This test is what keeps `code` stable-forever honest.
 */
const doc = readFileSync(fileURLToPath(new URL('../../docs/errors.md', import.meta.url)), 'utf8');

function docCodes(): Map<string, ExitCode> {
  const found = new Map<string, ExitCode>();
  const sections = [...doc.matchAll(/^### `([A-Z_]+)`\s*\n([\s\S]*?)(?=\n---\n|\n## )/gm)];
  for (const match of sections) {
    const code = match[1];
    const body = match[2];
    if (!code || !body) continue;
    const m = body.match(/\*\*Exit code:\*\*\s*(\d+)/);
    if (!m) throw new Error(`docs/errors.md: ${code} has no "**Exit code:** N" — the doc must state one`);
    found.set(code, Number(m[1]) as ExitCode);
  }
  return found;
}

describe('error catalog ⇔ docs/errors.md (AC-2)', () => {
  const fromDocs = docCodes();

  it('parses a non-trivial number of documented codes', () => {
    expect(fromDocs.size).toBeGreaterThanOrEqual(25);
  });

  it('code set in TypeScript equals code set in the document', () => {
    expect([...ERROR_CODES].sort()).toEqual([...fromDocs.keys()].sort());
  });

  it('every documented code maps to the documented exit', () => {
    for (const [code, exit] of fromDocs) {
      expect(exitCodeFor(code as keyof typeof ERROR_CATALOG), code).toBe(exit);
    }
  });

  it('warnings are the only zero-exit codes and they are exactly the two declared', () => {
    const zeroes = ERROR_CODES.filter((c) => ERROR_CATALOG[c] === 0).sort();
    expect(zeroes).toEqual(['HOST_UNKNOWN', 'SCOPE_FILE_NOT_FOUND']);
  });
});
