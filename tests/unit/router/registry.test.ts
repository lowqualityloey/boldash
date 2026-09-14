import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_PACKS,
  createRegistry,
  type WorkflowPack,
} from '../../../src/core/router/registry.js';
import {
  GENERIC_BASELINE,
  capabilitiesSatisfied,
  missingCapabilities,
} from '../../../src/core/router/capabilities.js';
import type { CapabilityContext } from '../../../src/core/router/types.js';
import {
  documentedMigrationRequires,
  glossaryLifecycleStages,
  matrixCapabilityNames,
  parseMatrix,
} from './doc-oracle.js';

/**
 * MS-4 slice 2 (GO-MS4): the built-in registry — pipeline step 3, plus the D-1
 * injection seam.
 *
 * Built-ins are asserted *structurally* rather than by transcription: their
 * capability names must exist in the §5.3 matrix, their lifecycle stages in the §16
 * glossary, and their requirements must be satisfiable by a generic host. A typo or
 * an over-reaching `requires` therefore fails a test instead of surfacing as a
 * routing mystery at MS-6.
 */

const MATRIX = parseMatrix();
const KNOWN_CAPABILITIES = matrixCapabilityNames(MATRIX);
const LIFECYCLE_STAGES = glossaryLifecycleStages();
const generic: CapabilityContext = { host: 'generic', capabilities: GENERIC_BASELINE };

/** The §5.3 migration pack, rebuilt from the document — the D-1 injection fixture. */
function migrationPack(): WorkflowPack {
  return {
    name: 'migration',
    version: 1,
    lifecycle: 'BUILD',
    requires: documentedMigrationRequires(),
    optional: ['github', 'mcp'],
    description: 'Apply schema or data changes with rollback.',
  };
}

describe('built-in pack set (RFC §5 scope)', () => {
  it('registers exactly feature, bugfix, docs, chore — the four the RFC names', () => {
    expect(WORKFLOW_PACKS.map((p) => p.name)).toEqual([
      'feature',
      'bugfix',
      'docs',
      'chore',
    ]);
    expect(createRegistry().names()).toEqual(['feature', 'bugfix', 'docs', 'chore']);
  });

  it('gives every pack a usable shape for the MS-6 workflow list', () => {
    for (const pack of WORKFLOW_PACKS) {
      expect(pack.name).toBeTruthy();
      expect(pack.version).toBeGreaterThanOrEqual(1);
      expect(pack.description.length, `${pack.name} needs a description`).toBeGreaterThan(
        0,
      );
      expect(LIFECYCLE_STAGES, `lifecycle of ${pack.name}`).toContain(pack.lifecycle);
    }
  });

  it('names only capabilities that exist in the §5.3 matrix (typo guard)', () => {
    for (const pack of WORKFLOW_PACKS) {
      for (const name of [...pack.requires, ...pack.optional]) {
        expect(
          KNOWN_CAPABILITIES.has(name),
          `${pack.name} declares unknown '${name}'`,
        ).toBe(true);
      }
    }
  });

  it('never lists a capability as both mandatory and optional', () => {
    for (const pack of WORKFLOW_PACKS) {
      const overlap = pack.requires.filter((r) => pack.optional.includes(r));
      expect(overlap, `${pack.name} overlap`).toEqual([]);
    }
  });
});

describe('T-13 — no built-in is un-routable on a generic host (P8)', () => {
  it('requires only what the Generic column actually provides', () => {
    for (const pack of WORKFLOW_PACKS) {
      expect(
        missingCapabilities(pack.requires, generic),
        `${pack.name} on generic`,
      ).toEqual([]);
      expect(
        capabilitiesSatisfied(pack.requires, generic),
        `${pack.name} on generic`,
      ).toBe(true);
    }
  });

  it('would catch the regression it claims to prevent', () => {
    // git.commit is ✗ for Generic, so a built-in demanding it must fail this suite.
    const poisoned: WorkflowPack = { ...WORKFLOW_PACKS[0]!, requires: ['git.commit'] };
    expect(missingCapabilities(poisoned.requires, generic)).toEqual(['git.commit']);
    expect(capabilitiesSatisfied(poisoned.requires, generic)).toBe(false);
  });
});

describe('lookup (step 3)', () => {
  it('resolves a registered workflow and returns its declared requirements', () => {
    const pack = createRegistry().get('feature');
    expect(pack).toBeDefined();
    expect(pack?.lifecycle).toBe('BUILD');
    expect(pack?.requires).toContain('filesystem.write');
  });

  it('returns undefined for an unknown name instead of throwing', () => {
    const registry = createRegistry();
    expect(registry.get('nope')).toBeUndefined();
    expect(registry.has('nope')).toBe(false);
  });

  it('hands out copies so a caller cannot mutate a shared built-in', () => {
    const registry = createRegistry();
    const pack = registry.get('chore');
    expect(pack).toBeDefined();
    (pack?.requires as string[]).push('subagents');
    (pack?.optional as string[]).push('subagents');
    expect(registry.get('chore')?.requires).toEqual([
      'filesystem.read',
      'filesystem.write',
      'shell.execute',
    ]);
    expect(WORKFLOW_PACKS.find((p) => p.name === 'chore')?.requires).not.toContain(
      'subagents',
    );
  });

  it('returns a fresh names() array each call', () => {
    const registry = createRegistry();
    registry.names().push('injected');
    expect(registry.names()).toEqual(['feature', 'bugfix', 'docs', 'chore']);
  });
});

describe('createRegistry injection seam (ruling D-1)', () => {
  it('does NOT resolve migration on the default registry — so step 3 beats step 5', () => {
    const registry = createRegistry();
    expect(registry.has('migration')).toBe(false);
    expect(registry.get('migration')).toBeUndefined();
  });

  it('resolves migration when a registry is built with it, proving the seam exists for the example', () => {
    const registry = createRegistry([...WORKFLOW_PACKS, migrationPack()]);
    expect(registry.names()).toHaveLength(5);
    expect(registry.get('migration')?.requires).toContain('subagents');
  });

  it('shows why the default registry yields WORKFLOW_NOT_FOUND and only the injected one reaches CAPABILITY_MISSING', () => {
    const requires = migrationPack().requires;
    // Cursor-like host: has git.commit et al., lacks subagents.
    const cursor: CapabilityContext = {
      host: 'cursor',
      capabilities: new Set(MATRIX.Cursor ?? []),
    };
    expect(missingCapabilities(requires, cursor)).toEqual(['subagents']);
    // Generic host is short of two, and step 3 (name lookup) never even gets there.
    expect(missingCapabilities(requires, generic)).toContain('git.commit');
  });

  it('accepts an empty registry without collapsing', () => {
    const registry = createRegistry([]);
    expect(registry.names()).toEqual([]);
    expect(registry.has('feature')).toBe(false);
  });

  it('refuses duplicate and blank names at construction', () => {
    expect(() => createRegistry([migrationPack(), migrationPack()])).toThrow(
      /duplicate workflow pack 'migration'/,
    );
    expect(() => createRegistry([{ ...migrationPack(), name: '' }])).toThrow(
      /non-empty name/,
    );
  });
});
