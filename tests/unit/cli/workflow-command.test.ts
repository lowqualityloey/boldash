/**
 * MS-6 S2 unit tests: workflow registry views. validateWorkflowPack is
 * exercised BOTH ways (AC-5 discipline): every built-in passes, and each
 * structural/capability violation is produced as a synthetic pack and
 * confirmed to block with the right code (gates that don't block are worse
 * than no gates).
 */
import { describe, expect, it } from 'vitest';
import {
  runWorkflowList,
  runWorkflowValidate,
  validateWorkflowPack,
} from '../../../src/cli/commands/workflow.js';
import { REGISTRY } from '../../../src/cli/commands/index.js';
import { WORKFLOW_PACKS } from '../../../src/core/router/index.js';
import type { WorkflowPack } from '../../../src/core/router/index.js';
import { exitCodeFor } from '../../../src/shared/errors.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';

function ctx(
  flags: Record<string, string | boolean> = {},
  positionals: string[] = [],
): RunContext {
  return {
    globals: {
      format: 'json',
      quiet: false,
      verbose: false,
      cwd: process.cwd(),
      color: true,
    },
    flags,
    positionals,
  };
}

function envData(e: Envelope): Record<string, unknown> {
  if (!e.ok) throw new Error(`expected ok, got: ${e.error.code} ${e.error.message}`);
  return e.data as Record<string, unknown>;
}

function envError(e: Envelope): {
  code: string;
  field?: string;
  context?: Record<string, unknown>;
} {
  if (e.ok) throw new Error('expected failure envelope');
  return e.error;
}

/** Mutate one field of a valid built-in pack for block-side tests. */
const [FIRST_PACK] = WORKFLOW_PACKS;
if (!FIRST_PACK) throw new Error('built-in registry unexpectedly empty');
function broken(patch: Partial<WorkflowPack>): WorkflowPack {
  // Test seam: deliberate invalid variants of a valid pack — the cast is the
  // point (runtime guards must catch what the type system forbids).
  return { ...FIRST_PACK, ...patch } as WorkflowPack;
}

describe('validateWorkflowPack — PASS side', () => {
  it('all four built-ins validate cleanly (exit-0 path)', () => {
    expect(WORKFLOW_PACKS).toHaveLength(4);
    for (const pack of WORKFLOW_PACKS) {
      const res = validateWorkflowPack(pack);
      expect(res.ok, pack.name).toBe(true);
    }
  });
});

describe('validateWorkflowPack — BLOCK side', () => {
  const structural: Array<[string, WorkflowPack]> = [
    ['blank name', broken({ name: '  ' })],
    ['zero version', broken({ version: 0 })],
    ['fractional version', broken({ version: 1.5 })],
    [
      'unknown lifecycle',
      broken({ lifecycle: 'NOPE' as unknown as WorkflowPack['lifecycle'] }),
    ],
    ['blank description', broken({ description: ' ' })],
    ['duplicate requires', broken({ requires: ['filesystem.read', 'filesystem.read'] })],
    ['blank capability', broken({ requires: [''] })],
    ['non-string requires', broken({ requires: [1 as unknown as string] })],
    ['requires ∩ optional', broken({ requires: ['git.commit', 'filesystem.read'] })],
  ];
  for (const [label, pack] of structural) {
    it(`${label} → SCHEMA_VALIDATION (exit 2)`, () => {
      const res = validateWorkflowPack(pack);
      if (res.ok) throw new Error(`${label}: validation should have blocked`);
      expect(res.error.code).toBe('SCHEMA_VALIDATION');
      expect(exitCodeFor(res.error.code)).toBe(2);
      expect(res.error.field).toMatch(/^workflow\./);
    });
  }

  it('requires beyond the generic floor → CAPABILITY_MISSING (exit 3)', () => {
    // optional is overridden too: if 'subagents' stayed in optional, the
    // structural requires∩optional guard (correctly) blocks first — proven
    // by the overlap case above — so this fixture must clear it.
    const res = validateWorkflowPack(
      broken({ requires: ['filesystem.read', 'subagents'], optional: ['git.commit'] }),
    );
    if (res.ok) throw new Error('capability check should have blocked');
    expect(res.error.code).toBe('CAPABILITY_MISSING');
    expect(exitCodeFor(res.error.code)).toBe(3);
    expect(res.error.context).toMatchObject({ missing: ['subagents'], host: 'generic' });
  });

  it('optional beyond the floor stays advisory — never a precondition', () => {
    const res = validateWorkflowPack(broken({ optional: ['github'] }));
    expect(res.ok).toBe(true);
  });
});

describe('workflow list (S2, ruling R1)', () => {
  it('shows exactly the four canonical built-ins in registry order', () => {
    const out = envData(runWorkflowList(ctx()));
    const names = (out.workflows as WorkflowPack[]).map((w) => w.name);
    expect(names).toEqual(['feature', 'bugfix', 'docs', 'chore']);
    const feature = (out.workflows as WorkflowPack[])[0];
    expect(feature?.requires.length).toBeGreaterThan(0);
    expect(feature?.description).toBeTruthy();
  });

  it('rejects stray positionals', () => {
    expect(envError(runWorkflowList(ctx({}, ['extra']))).code).toBe('CLI_USAGE');
  });
});

describe('workflow validate <name> (S2)', () => {
  it('valid built-in → { valid: true, workflow } envelope', () => {
    const out = envData(runWorkflowValidate(ctx({}, ['feature'])));
    expect(out.valid).toBe(true);
    expect((out.workflow as WorkflowPack).name).toBe('feature');
  });

  it('unregistered name → WORKFLOW_NOT_FOUND with the canonical enabled set', () => {
    const err = envError(runWorkflowValidate(ctx({}, ['migration'])));
    expect(err.code).toBe('WORKFLOW_NOT_FOUND');
    expect(exitCodeFor('WORKFLOW_NOT_FOUND')).toBe(2);
    expect(err.context?.enabled).toEqual(['feature', 'bugfix', 'docs', 'chore']);
  });

  it('missing or extra positionals are usage errors', () => {
    expect(envError(runWorkflowValidate(ctx())).code).toBe('CLI_USAGE');
    expect(envError(runWorkflowValidate(ctx({}, ['feature', 'x']))).code).toBe(
      'CLI_USAGE',
    );
  });
});

describe('registry honesty (S2)', () => {
  it('only wired subcommands are registered — import landed in S4', async () => {
    const workflow = REGISTRY.find((c) => c.name === 'workflow');
    expect((workflow?.subcommands ?? []).map((s) => s.name)).toEqual([
      'list',
      'validate',
      'import',
    ]);
    const err = envError(
      (await workflow?.run?.(ctx())) ?? ({ ok: true, data: null } as Envelope),
    );
    expect(err.code).toBe('CLI_USAGE');
  });
});
