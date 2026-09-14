import { describe, expect, it } from 'vitest';
import {
  GENERIC_BASELINE,
  capabilitiesSatisfied,
  genericContext,
  hasCapability,
  missingCapabilities,
} from '../../../src/core/router/capabilities.js';
import type { CapabilityContext } from '../../../src/core/router/types.js';
import { ARCH, documentedMigrationRequires, parseMatrix } from './doc-oracle.js';

/**
 * MS-4 slice 2 (GO-MS4): capability matching — pipeline step 5.
 *
 * `ARCHITECTURE.md` §5.3's adapter matrix is the oracle (parsed in `doc-oracle.ts`),
 * so the baseline cannot drift from the design document unnoticed. The §5.3 migration
 * manifest is the only capability set the corpus actually specifies, and it proves
 * the contract's CAPABILITY_MISSING example against a real host column.
 */

const MATRIX = parseMatrix();

function contextFor(host: string): CapabilityContext {
  const caps = MATRIX[host];
  expect(caps, `no '${host}' column in the §5.3 matrix`).toBeDefined();
  return { host, capabilities: new Set(caps) };
}

describe('generic baseline matches the §5.3 matrix (doc as oracle)', () => {
  it('equals exactly the capabilities the Generic column grants', () => {
    expect([...GENERIC_BASELINE].sort()).toEqual([...(MATRIX.Generic ?? [])].sort());
    expect(GENERIC_BASELINE.size).toBeGreaterThan(0);
  });

  it('excludes the capabilities the document marks ✗ for Generic', () => {
    for (const name of [
      'git.commit',
      'git.worktree',
      'github',
      'mcp',
      'subagents',
      'pre_tool_hooks',
    ]) {
      expect(MATRIX.Generic?.has(name), `doc should say Generic lacks ${name}`).toBe(
        false,
      );
      expect(GENERIC_BASELINE.has(name)).toBe(false);
    }
  });

  it('keeps the two facts that make generic-host enforcement advisory, not absent', () => {
    // §5.3 closing note: without pre_tool_hooks a host cannot *block*; a human can still approve.
    expect(GENERIC_BASELINE.has('pre_tool_hooks')).toBe(false);
    expect(GENERIC_BASELINE.has('human_approval')).toBe(true);
    expect(ARCH).toContain("Boldash's enforcement is advisory");
  });
});

describe('hasCapability', () => {
  it('PASSES for a provided capability and BLOCKS for an absent one', () => {
    const ctx = genericContext();
    expect(hasCapability(ctx, 'filesystem.read')).toBe(true);
    expect(hasCapability(ctx, 'subagents')).toBe(false);
  });

  it('treats an unknown capability as unavailable rather than erroring', () => {
    // §5.4: "Capability probe inconclusive ⇒ assume the capability is unavailable."
    expect(hasCapability(genericContext(), 'totally.made.up')).toBe(false);
    expect(missingCapabilities(['totally.made.up'], genericContext())).toEqual([
      'totally.made.up',
    ]);
  });
});

describe('missingCapabilities', () => {
  it('PASSES with an empty list when everything is available', () => {
    expect(
      missingCapabilities(['filesystem.read', 'git.read'], genericContext()),
    ).toEqual([]);
    expect(capabilitiesSatisfied([], genericContext())).toBe(true);
  });

  it('BLOCKS and reports every gap in declaration order', () => {
    expect(
      missingCapabilities(['subagents', 'filesystem.read', 'mcp'], genericContext()),
    ).toEqual(['subagents', 'mcp']);
    expect(
      capabilitiesSatisfied(['subagents', 'filesystem.read', 'mcp'], genericContext()),
    ).toBe(false);
  });

  it('preserves duplicates as declared instead of deduplicating', () => {
    expect(missingCapabilities(['mcp', 'mcp'], genericContext())).toEqual(['mcp', 'mcp']);
  });

  it('is order-insensitive as a set', () => {
    const ctx = genericContext();
    expect(new Set(missingCapabilities(['mcp', 'subagents'], ctx))).toEqual(
      new Set(missingCapabilities(['subagents', 'mcp'], ctx)),
    );
  });
});

describe('the §5.3 migration manifest against real host columns', () => {
  const requires = documentedMigrationRequires();

  it('reads the documented requirement list out of ARCHITECTURE.md', () => {
    expect(requires).toContain('subagents');
    expect(requires).toContain('git.commit');
  });

  it('reproduces the contract error exactly on a host with git.commit but no subagents', () => {
    // docs/errors.md shows context.missing == ["subagents"] for host "cursor". Only a
    // Cursor-shaped column satisfies every *other* migration requirement — so the
    // documented example is a Cursor-like host, not the generic one.
    expect(missingCapabilities(requires, contextFor('Cursor'))).toEqual(['subagents']);
  });

  it('reports more than one gap on a generic host, proving the list is not capped at one', () => {
    const missing = missingCapabilities(requires, genericContext());
    expect(missing).toContain('subagents');
    expect(missing.length).toBeGreaterThan(1);
  });

  it('finds at least one matrix column where migration routes cleanly', () => {
    const clean = Object.entries(MATRIX)
      .filter(([, caps]) =>
        capabilitiesSatisfied(requires, { host: 'probe', capabilities: caps }),
      )
      .map(([host]) => host);
    expect(clean).toContain('Claude');
  });
});

describe('genericContext', () => {
  it('is the documented floor, labelled for error context', () => {
    const ctx = genericContext();
    expect(ctx.host).toBe('generic');
    expect([...ctx.capabilities].sort()).toEqual([...GENERIC_BASELINE].sort());
  });

  it('hands out a copy so no caller can poison the shared baseline', () => {
    const ctx = genericContext();
    // The cast is deliberate: ReadonlySet blocks this at compile time (which is how
    // tsc caught the un-cast version), so the assertion targets a caller that defeats
    // the type anyway.
    (ctx.capabilities as Set<string>).add('subagents');
    expect(GENERIC_BASELINE.has('subagents')).toBe(false);
    expect(genericContext().capabilities.has('subagents')).toBe(false);
  });
});
