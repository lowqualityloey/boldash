import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { RequirementFlags } from '../../../src/core/router/types.js';

/**
 * Doc-as-oracle readers shared by the router suites.
 *
 * These parse the repository's own design documents so the tests assert what the
 * contract *says*, not what a test author remembered. Each parser fails loudly if
 * its anchor section disappears: a silent empty result would turn every derived
 * assertion into a vacuous pass.
 *
 * (`tests/unit/router/levels.test.ts` carries its own copy of the level-table
 * parser; it landed in the signed-off slice-1 commit and is left untouched.
 * Consolidating it here is a logged follow-up, not a silent refactor.)
 */

const at = (rel: string) => new URL(rel, import.meta.url);

export const CONTRACT: string = readFileSync(
  at('../../../docs/routing-contract.md'),
  'utf8',
);
export const ARCH: string = readFileSync(at('../../../ARCHITECTURE.md'), 'utf8');

/** Parse §Level and Risk into `{ risk: { level, humanApproval } }`. */
export function parseLevelTable(): Record<
  string,
  { level: number; humanApproval: boolean }
> {
  const start = CONTRACT.indexOf('## Level and Risk');
  expect(start, '§Level and Risk missing from routing-contract.md').toBeGreaterThan(-1);
  const table: Record<string, { level: number; humanApproval: boolean }> = {};
  for (const line of CONTRACT.slice(start, CONTRACT.indexOf('## Scope', start)).split(
    '\n',
  )) {
    const m = /^\|\s*`([a-z]+)`\s*\|\s*(\d+)([^|]*)\|/.exec(line);
    const [, risk, level, tail] = m ?? [];
    if (risk && level && tail)
      table[risk] = {
        level: Number(level),
        humanApproval: tail.includes('human approval'),
      };
  }
  expect(
    Object.keys(table).length,
    'no rows parsed from §Level and Risk',
  ).toBeGreaterThan(3);
  return table;
}

/** The first json block under §What the Agent Sees — the contract's success payload. */
export function documentedSuccessPayload(): {
  ok: boolean;
  data: { workflow: string; level: number; requirements: RequirementFlags };
} {
  const start = CONTRACT.indexOf('## What the Agent Sees');
  expect(start, '§What the Agent Sees missing').toBeGreaterThan(-1);
  const from = CONTRACT.indexOf('```json', start);
  const to = CONTRACT.indexOf('```', from + 7);
  return JSON.parse(CONTRACT.slice(from + 7, to).trim());
}

/** Parse the §5.3 adapter matrix into `{ host: Set<capability> }`, honouring ✓ / ✗. */
export function parseMatrix(): Record<string, Set<string>> {
  const start = ARCH.indexOf('### 5.3 Adapter Capability Matrix');
  expect(start, '§5.3 matrix missing from ARCHITECTURE.md').toBeGreaterThan(-1);
  const block = ARCH.slice(start, ARCH.indexOf('A host that lacks', start));
  const header = /^\|\s*Capability\s*\|(.+)\|\s*$/m.exec(block);
  expect(header, 'matrix header not found').not.toBeNull();
  const hosts = (header?.[1] ?? '')
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);
  const byHost: Record<string, Set<string>> = Object.fromEntries(
    hosts.map((h) => [h, new Set<string>()] as const),
  );
  // Capability names use dots AND underscores (`git.read`, `pre_tool_hooks`); a
  // narrower class here would silently drop rows and make every derived assertion
  // vacuously true — which is why the row-count guard below is load-bearing.
  const rows = block.split('\n').filter((l) => /^\|\s*`[a-z_.]+`\s*\|/.test(l));
  expect(rows.length, 'no rows parsed from the matrix').toBeGreaterThanOrEqual(13);
  for (const row of rows) {
    const cells = row
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c !== '');
    const capability = cells[0]?.replace(/`/g, '');
    if (!capability) continue;
    cells.slice(1, 1 + hosts.length).forEach((mark, i) => {
      const host = hosts[i];
      if (host && mark === '✓') byHost[host]?.add(capability);
    });
  }
  return byHost;
}

/** Every capability named anywhere in the matrix, for typo detection. */
export function matrixCapabilityNames(matrix: Record<string, Set<string>>): Set<string> {
  const all = new Set<string>();
  for (const caps of Object.values(matrix)) for (const c of caps) all.add(c);
  return all;
}

/** The `requires:` list of the §5.3 migration manifest — the corpus's only worked pack. */
export function documentedMigrationRequires(): string[] {
  const start = ARCH.indexOf('workflow: migration');
  expect(start, 'migration manifest example missing').toBeGreaterThan(-1);
  const block = ARCH.slice(start, ARCH.indexOf('```', start));
  const reqs = /requires:\n((?:\s+-\s+\S+\n?)+)/.exec(block);
  expect(reqs, 'requires list not found').not.toBeNull();
  const list = (reqs?.[1] ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  expect(list.length).toBeGreaterThan(0);
  return list;
}

/** Lifecycle stages from the §16 glossary row ("DISCOVER, PLAN, BUILD, VERIFY, SHIP, LEARN"). */
export function glossaryLifecycleStages(): string[] {
  const line = ARCH.split('\n').find((l) => l.includes('Lifecycle stage'));
  expect(line, 'glossary Lifecycle stage row missing').toBeDefined();
  const stages = (line ?? '')
    .replace(/.*:\s*/, '')
    .replace(/\.\s*$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  expect(stages.length).toBeGreaterThanOrEqual(4);
  return [...new Set(stages)];
}
