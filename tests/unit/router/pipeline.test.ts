import { describe, expect, it } from 'vitest';
import {
  route,
  parseProposal,
  validateProposal,
  routeExit,
} from '../../../src/core/router/pipeline.js';
import { createRegistry, type WorkflowPack } from '../../../src/core/router/registry.js';
import {
  genericContext,
  GENERIC_BASELINE,
} from '../../../src/core/router/capabilities.js';
import type { CapabilityContext } from '../../../src/core/router/types.js';
import type { ErrorInfo, Result } from '../../../src/shared/result.js';
import { documentedSuccessPayload, documentedMigrationRequires } from './doc-oracle.js';

/**
 * MS-4 slices 4–5: the seven-step pipeline, tested with the literal JSON from
 * docs/routing-contract.md §Examples — every gate proven in BOTH directions
 * (AGENTS.md). T-numbers follow plan-001 §6.
 */

const generic = genericContext();
const ctx = (capabilities: string[]): CapabilityContext => ({
  host: 'probe',
  capabilities: new Set(capabilities),
});

/** The four literal proposals from §Examples, copied verbatim. */
const EXAMPLE_1 = {
  task: {
    type: 'feature',
    risk: 'medium',
    scope: { files: ['src/auth/*'], systems: ['authentication'] },
    summary: 'Handle Google OAuth callback',
  },
  route: { workflow: 'feature', level: 2 },
} as const;

const EXAMPLE_2 = {
  task: { type: 'chore', risk: 'trivial', scope: { files: ['README.md'] } },
  route: { workflow: 'docs', level: 0 },
} as const;

const EXAMPLE_3 = {
  task: { type: 'feature', risk: 'critical', scope: { files: ['src/db/*'] } },
  route: { workflow: 'feature', level: 1 },
} as const;

const EXAMPLE_4 = {
  task: { type: 'migration', risk: 'high', scope: { files: ['db/*'] } },
  route: { workflow: 'migration', level: 3 },
} as const;

/** Injected migration pack (D-1): built from the ARCHITECTURE §5.3 manifest. */
const MIGRATION_PACK: WorkflowPack = {
  name: 'migration',
  version: 1,
  lifecycle: 'BUILD',
  requires: documentedMigrationRequires(), // subagents + git.commit + shell + fs + git.read
  optional: ['github', 'mcp'], // mirrors the §5.3 manifest's optional list
  description: 'Apply schema or data changes with rollback.',
};
const migrationRegistry = createRegistry([{ ...MIGRATION_PACK }]);

function errOf(r: Result<unknown, ErrorInfo>): ErrorInfo {
  if (r.ok) throw new Error('expected failure, got ok');
  return r.error;
}

describe('T-1 example 1: valid feature/medium', () => {
  it('resolves with a payload deep-equal to the documented success payload', () => {
    const r = route(EXAMPLE_1, { context: generic });
    if (!r.ok) throw new Error(`unexpected: ${JSON.stringify(r.error)}`);
    const documented = documentedSuccessPayload();
    expect(r.data.workflow).toBe(documented.data.workflow);
    expect(r.data.level).toBe(documented.data.level);
    expect(r.data.requirements).toEqual(documented.data.requirements);
    expect('warnings' in r.data).toBe(false); // D-3: key absent, not empty
  });

  it('accepts the string form identically (step-1 parse path)', () => {
    const asText = route(JSON.stringify(EXAMPLE_1), { context: generic });
    const asValue = route(EXAMPLE_1, { context: generic });
    expect(asText).toEqual(asValue);
  });
});

describe('T-2 example 2: trivial chore', () => {
  it('resolves with all-false requirements', () => {
    const r = route(EXAMPLE_2, { context: generic });
    if (!r.ok) throw new Error(`unexpected: ${JSON.stringify(r.error)}`);
    expect(r.data.requirements).toEqual({
      task_record: false,
      specification: false,
      tests: false,
      review: false,
      human_approval: false,
    });
  });
});

describe('T-3 example 3: level too low', () => {
  it('fails LEVEL_RISK_MISMATCH with doc-shaped message and exit 2', () => {
    const e = errOf(route(EXAMPLE_3, { context: generic }));
    expect(e.code).toBe('LEVEL_RISK_MISMATCH');
    expect(e.message).toBe("Risk 'critical' requires level 3, but level 1 was proposed.");
    expect(e.field).toBe('route.level');
    expect(routeExit(e.code)).toBe(2);
  });
});

describe('T-4 example 4: missing capability (D-1 injected registry)', () => {
  it('fails CAPABILITY_MISSING with context.missing exactly ["subagents"] on a Cursor-like host', () => {
    // Mirrors docs/errors.md: host provides everything the migration pack needs
    // except subagents — exactly the documented example outcome.
    const cursorLike = ctx([
      'filesystem.read',
      'filesystem.write',
      'shell.execute',
      'git.read',
      'git.commit',
      'human_approval',
    ]);
    const e = errOf(
      route(EXAMPLE_4, { context: cursorLike, registry: migrationRegistry }),
    );
    expect(e.code).toBe('CAPABILITY_MISSING');
    expect(e.context?.missing).toEqual(['subagents']);
    expect(routeExit(e.code)).toBe(3);
  });
});

describe('T-5 same payload on the DEFAULT registry (step 3 before step 5)', () => {
  it('fails WORKFLOW_NOT_FOUND, not CAPABILITY_MISSING — the ordering is load-bearing', () => {
    const e = errOf(route(EXAMPLE_4, { context: generic }));
    expect(e.code).toBe('WORKFLOW_NOT_FOUND');
    expect(e.context?.enabled).toEqual(['feature', 'bugfix', 'docs', 'chore']);
    expect(routeExit(e.code)).toBe(2);
  });
});

describe('T-6/T-7 malformed and invalid input never throw', () => {
  it('malformed JSON → SCHEMA_PARSE via text path (P4: error is data)', () => {
    const e = errOf(parseProposal('{ "task": '));
    expect(e.code).toBe('SCHEMA_PARSE');
    expect(e.field).toBe('route');
  });

  it('empty object → SCHEMA_VALIDATION naming the missing required path', () => {
    const e = errOf(validateProposal({}));
    expect(e.code).toBe('SCHEMA_VALIDATION');
    expect(e.message).toMatch(/task|route/);
  });

  it('out-of-range level → SCHEMA_VALIDATION with dotted field route.level', () => {
    const e = errOf(
      validateProposal({ ...EXAMPLE_1, route: { workflow: 'feature', level: 9 } }),
    );
    expect(e.code).toBe('SCHEMA_VALIDATION');
    expect(e.field).toBe('route.level');
  });

  it('unknown top-level key rejected (additionalProperties:false)', () => {
    const e = errOf(validateProposal({ ...EXAMPLE_1, exploit: true }));
    expect(e.code).toBe('SCHEMA_VALIDATION');
  });
});

describe('T-8 step-3 PASS/BLOCK pair', () => {
  it('all four built-ins resolve; a fifth name does not', () => {
    for (const name of ['feature', 'bugfix', 'docs', 'chore']) {
      const proposal = { ...EXAMPLE_2, route: { workflow: name, level: 0 } };
      expect(route(proposal, { context: generic }).ok).toBe(true);
    }
    const miss = route(
      { ...EXAMPLE_2, route: { workflow: 'microservice', level: 0 } },
      { context: generic },
    );
    expect(errOf(miss).code).toBe('WORKFLOW_NOT_FOUND');
  });
});

describe('T-9 one-way rules, end to end', () => {
  it('higher-than-required level is accepted with the higher requirements', () => {
    const r = route(
      {
        task: { type: 'chore', risk: 'trivial', scope: {} },
        route: { workflow: 'chore', level: 3 },
      },
      { context: generic },
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.data.requirements.review).toBe(true);
    expect(r.data.requirements.human_approval).toBe(false); // trivial risk does not force approval
  });

  it('critical risk forces human_approval at level 3', () => {
    const r = route(
      {
        task: { type: 'security', risk: 'critical', scope: {} },
        route: { workflow: 'feature', level: 3 },
      },
      { context: generic },
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.data.requirements.human_approval).toBe(true);
  });

  it('overrides may add ceremony', () => {
    const r = route(
      {
        ...EXAMPLE_1,
        route: { workflow: 'feature', level: 2, requirements: { review: true } },
      },
      { context: generic },
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.data.requirements.review).toBe(true);
  });

  it('overrides may NOT remove ceremony', () => {
    const e = errOf(
      route(
        {
          ...EXAMPLE_1,
          route: { workflow: 'feature', level: 2, requirements: { tests: false } },
        },
        { context: generic },
      ),
    );
    expect(e.code).toBe('SCHEMA_VALIDATION');
    expect(e.field).toBe('route.requirements');
    expect(e.message).toContain('tests');
  });
});

describe('T-10/T-11 through the full pipeline', () => {
  it('missing literal scope file becomes a warning on an ok route, exit 0', () => {
    const r = route(
      {
        task: {
          type: 'docs',
          risk: 'trivial',
          scope: { files: ['definitely-missing-9f2c.md'] },
        },
        route: { workflow: 'docs', level: 0 },
      },
      { context: generic, cwd: process.cwd() },
    );
    if (!r.ok)
      throw new Error(`warnings must never fail the route: ${JSON.stringify(r.error)}`);
    expect(r.data.warnings).toHaveLength(1);
    expect(r.data.warnings?.[0]?.code).toBe('SCOPE_FILE_NOT_FOUND');
    expect(routeExit('SCOPE_FILE_NOT_FOUND')).toBe(0);
  });
});

describe('T-12 token budget (AC-2)', () => {
  const payloads = [EXAMPLE_1, EXAMPLE_2] as const;
  for (const [i, p] of payloads.entries()) {
    it(`success payload #${i + 1} ≤ 80 tokens, compact and pretty (bytes/4)`, () => {
      const r = route(p, { context: generic });
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      const compact = JSON.stringify(r.data).length / 4;
      const pretty = JSON.stringify(r.data, null, 2).length / 4;
      expect(compact).toBeLessThanOrEqual(80);
      expect(pretty).toBeLessThanOrEqual(80);
    });
  }

  it('generic built-ins never trigger CAPABILITY_MISSING (T-13)', () => {
    for (const name of ['feature', 'bugfix', 'docs', 'chore']) {
      const r = route(
        { ...EXAMPLE_1, route: { workflow: name, level: 2 } },
        { context: { host: 'generic', capabilities: GENERIC_BASELINE } },
      );
      if (!r.ok) expect(r.error.code).not.toBe('CAPABILITY_MISSING');
    }
  });
});
