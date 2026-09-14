import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_CEREMONY_LEVEL,
  MIN_CEREMONY_LEVEL,
  REQUIREMENT_KEYS,
  REQUIRED_LEVEL_BY_RISK,
  RISKS,
  applyOverrides,
  isLevelSufficient,
  requiredLevelFor,
  requirementsFor,
} from '../../../src/core/router/levels.js';
import { loadSchemaText } from '../../../src/shared/schema.js';
import type {
  CeremonyLevel,
  RequirementFlags,
  RequirementOverrides,
  Risk,
} from '../../../src/core/router/types.js';

/**
 * MS-4 first slice (GO-MS4, scoped): risk→level enforcement and requirement
 * derivation — pipeline step 4.
 *
 * The doc is the oracle, not a copy of its values: the risk→level table and the
 * documented success payload are parsed out of `docs/routing-contract.md` and the
 * level bounds out of `schemas/route.schema.json`. Reword either document and
 * these tests fail — which is the point (P2, and the same discipline
 * `tests/unit/errors.test.ts` applies to the error catalog).
 *
 * Every guard proves both directions: that it permits what the contract allows
 * and that it blocks what it must (AGENTS.md — a gate that only passes is not a gate).
 */

const CONTRACT = readFileSync(
  new URL('../../../docs/routing-contract.md', import.meta.url),
  'utf8',
);

/** Parse §Level and Risk into { risk: { level, humanApproval } }. */
function parseLevelTable(): Record<string, { level: number; humanApproval: boolean }> {
  const start = CONTRACT.indexOf('## Level and Risk');
  const block = CONTRACT.slice(start, CONTRACT.indexOf('## Scope', start));
  expect(start).toBeGreaterThan(-1);
  expect(block.length).toBeGreaterThan(0);
  const table: Record<string, { level: number; humanApproval: boolean }> = {};
  for (const line of block.split('\n')) {
    const m = /^\|\s*`([a-z]+)`\s*\|\s*(\d+)([^|]*)\|/.exec(line);
    if (!m) continue;
    const [, risk, level, tail] = m;
    if (!risk || !level || !tail) continue;
    table[risk] = {
      level: Number(level),
      humanApproval: tail.includes('human approval'),
    };
  }
  return table;
}

/** The first ```json block under §What the Agent Sees — the contract's success payload. */
function documentedSuccessPayload(): {
  ok: boolean;
  data: { workflow: string; level: number; requirements: RequirementFlags };
} {
  const start = CONTRACT.indexOf('## What the Agent Sees');
  const from = CONTRACT.indexOf('```json', start);
  const to = CONTRACT.indexOf('```', from + 7);
  return JSON.parse(CONTRACT.slice(from + 7, to).trim());
}

describe('risk→level table matches the routing contract (doc as oracle)', () => {
  const table = parseLevelTable();

  it('covers exactly the risks the document lists, no more and no fewer', () => {
    expect(Object.keys(table).sort()).toEqual([...RISKS].sort());
    expect(Object.keys(REQUIRED_LEVEL_BY_RISK).sort()).toEqual([...RISKS].sort());
  });

  it('maps every risk to the level the document demands', () => {
    for (const risk of RISKS) {
      const doc = table[risk];
      expect(doc, `doc row missing for ${risk}`).toBeDefined();
      expect(requiredLevelFor(risk), `level for ${risk}`).toBe(doc?.level);
    }
  });

  it('agrees with route.schema.json on the risk enum and the level bounds', () => {
    const schema = JSON.parse(loadSchemaText('route'));
    expect([...schema.properties.task.properties.risk.enum].sort()).toEqual(
      [...RISKS].sort(),
    );
    expect(schema.properties.route.properties.level.minimum).toBe(MIN_CEREMONY_LEVEL);
    expect(schema.properties.route.properties.level.maximum).toBe(MAX_CEREMONY_LEVEL);
    expect(MAX_CEREMONY_LEVEL).toBe(3);
  });
});

describe('one-way level rule (higher allowed, lower rejected)', () => {
  it('PASSES at the required level and at every level above it', () => {
    for (const risk of RISKS) {
      const required = requiredLevelFor(risk);
      for (let level = required; level <= MAX_CEREMONY_LEVEL; level++) {
        expect(isLevelSufficient(level as CeremonyLevel, risk), `${risk}@${level}`).toBe(
          true,
        );
      }
    }
  });

  it('BLOCKS every level below the required one', () => {
    const blocked: string[] = [];
    for (const risk of RISKS) {
      const required = requiredLevelFor(risk);
      for (let level = MIN_CEREMONY_LEVEL; level < required; level++) {
        expect(isLevelSufficient(level as CeremonyLevel, risk), `${risk}@${level}`).toBe(
          false,
        );
        blocked.push(`${risk}@${level}`);
      }
    }
    // The BLOCK half is only real if it actually exercised combinations:
    // trivial requires 0, so it contributes none — every other risk contributes `required`.
    expect(blocked).toEqual([
      'low@0',
      'medium@0',
      'medium@1',
      'high@0',
      'high@1',
      'high@2',
      'critical@0',
      'critical@1',
      'critical@2',
    ]);
    expect(blocked.length).toBe(RISKS.reduce((n, r) => n + requiredLevelFor(r), 0));
  });

  it('accepts the contract example that raises ceremony for a trivial task', () => {
    expect(isLevelSufficient(3, 'trivial')).toBe(true);
    expect(isLevelSufficient(0, 'trivial')).toBe(true);
  });

  it('rejects the literal §Examples payload: critical at level 1', () => {
    expect(isLevelSufficient(1, 'critical')).toBe(false);
    expect(requiredLevelFor('critical')).toBe(3);
  });
});

describe('requirement derivation', () => {
  it('reproduces the payload documented in §What the Agent Sees', () => {
    const doc = documentedSuccessPayload();
    expect(doc.ok).toBe(true);
    expect(requirementsFor(doc.data.level as CeremonyLevel, 'medium')).toEqual(
      doc.data.requirements,
    );
  });

  it('matches the Meaning column: level 1 record · level 2 +spec+tests · level 3 +review', () => {
    expect(requirementsFor(0, 'trivial')).toEqual({
      task_record: false,
      specification: false,
      tests: false,
      review: false,
      human_approval: false,
    });
    expect(
      Object.entries(requirementsFor(1, 'low'))
        .filter(([, v]) => v)
        .map(([k]) => k),
    ).toEqual(['task_record']);
    expect(
      Object.entries(requirementsFor(2, 'medium'))
        .filter(([, v]) => v)
        .map(([k]) => k),
    ).toEqual(['task_record', 'specification', 'tests']);
    expect(
      Object.entries(requirementsFor(3, 'high'))
        .filter(([, v]) => v)
        .map(([k]) => k),
    ).toEqual(['task_record', 'specification', 'tests', 'review']);
  });

  it('forces human_approval for critical at level 3, and never infers it for high', () => {
    const table = parseLevelTable();
    expect(table['critical']?.humanApproval).toBe(true);
    expect(table['high']?.humanApproval).toBe(false);
    expect(
      Object.entries(table)
        .filter(([, v]) => v.humanApproval)
        .map(([k]) => k),
    ).toEqual(['critical']);
    expect(requirementsFor(3, 'critical').human_approval).toBe(true);
    expect(requirementsFor(3, 'high').human_approval).toBe(false);
  });

  it('returns a fresh copy so callers cannot poison the shared tables', () => {
    const first = requirementsFor(2, 'medium');
    first.tests = false;
    expect(requirementsFor(2, 'medium').tests).toBe(true);
    expect(REQUIRED_LEVEL_BY_RISK.medium).toBe(2);
  });
});

describe('route.requirements overrides (add ceremony only)', () => {
  const base: RequirementFlags = requirementsFor(2, 'medium');

  it('PASSES an override that adds ceremony', () => {
    const r = applyOverrides(base, { review: true, human_approval: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.review).toBe(true);
      expect(r.data.human_approval).toBe(true);
      expect(r.data.tests).toBe(true);
    }
  });

  it('BLOCKS an override that switches off a requirement its level imposes', () => {
    const r = applyOverrides(base, { tests: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.removed).toEqual(['tests']);
  });

  it('reports every attempted removal in one result, in contract key order', () => {
    // critical@3 is the only tier where all five flags are on, so all three
    // attempted switches-off are genuine removals — and they come back ordered
    // by REQUIREMENT_KEYS, not by the order the proposal listed them.
    const r = applyOverrides(requirementsFor(3, 'critical'), {
      human_approval: false,
      task_record: false,
      specification: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.removed).toEqual(['task_record', 'specification', 'human_approval']);
      expect(r.removed.every((k) => REQUIREMENT_KEYS.includes(k))).toBe(true);
    }
  });

  it('ignores absent keys and accepts no-op overrides', () => {
    expect(applyOverrides(base, {})).toEqual({ ok: true, data: base });
    expect(applyOverrides(base, { tests: true })).toEqual({ ok: true, data: base });
    expect(applyOverrides(base)).toEqual({ ok: true, data: base });
  });

  it('does not mutate the caller’s base flags', () => {
    const snapshot: RequirementFlags = { ...base };
    applyOverrides(base, { review: true });
    expect(base).toEqual(snapshot);
  });

  it('applies to every key: no requirement can be silently dropped at any level', () => {
    for (const level of [0, 1, 2, 3] as const) {
      for (const risk of RISKS) {
        const flags = requirementsFor(level, risk);
        for (const key of REQUIREMENT_KEYS) {
          const r = applyOverrides(flags, { [key]: false } as RequirementOverrides);
          if (flags[key]) {
            expect(r.ok, `level ${level} ${risk} ${key}`).toBe(false);
          } else {
            expect(r.ok, `level ${level} ${risk} ${key}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('exhaustiveness', () => {
  it('covers every risk with a defined required level and no stray keys', () => {
    const risks: Risk[] = [...RISKS];
    for (const risk of risks) {
      expect(typeof REQUIRED_LEVEL_BY_RISK[risk]).toBe('number');
    }
    expect(new Set(risks).size).toBe(risks.length);
  });
});
