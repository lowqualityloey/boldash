/**
 * MS-6 S1 (AC-3): help token budgets — root help ≤200, command help ≤40
 * (RFC §1.2 / P9, tested as whitespace words, the deterministic proxy).
 */
import { describe, expect, it } from 'vitest';
import { commandHelp, rootHelp, tokenCount } from '../../../src/cli/help.js';
import { REGISTRY } from '../../../src/cli/commands/index.js';
import type { CommandSpec } from '../../../src/cli/types.js';

/** Every registered spec, subcommands included (registry grows per slice). */
function walk(specs: readonly CommandSpec[]): CommandSpec[] {
  return specs.flatMap((s) => [s, ...(s.subcommands ? walk(s.subcommands) : [])]);
}

describe('help budgets (AC-3)', () => {
  it('root help stays within the 200-token budget', () => {
    const text = rootHelp(REGISTRY, '0.0.1');
    expect(tokenCount(text)).toBeLessThanOrEqual(200);
    expect(text).toContain('init');
  });

  it('every registered command help stays within 40 tokens', () => {
    for (const spec of walk(REGISTRY)) {
      expect(tokenCount(commandHelp(spec)), spec.name).toBeLessThanOrEqual(40);
      expect(commandHelp(spec)).toContain(`boldash ${spec.name}`);
    }
  });

  it('root help advertises only registered commands (no unwired surface)', () => {
    const text = rootHelp(REGISTRY, '0.0.1');
    for (const unbuilt of ['verify']) {
      expect(text).not.toContain(`  ${unbuilt} `);
    }
    // Wired families must appear (honesty, both ways): state/workflow since
    // S2, route/state-writes since S3.
    expect(text).toContain('  state ');
    expect(text).toContain('  workflow ');
    expect(text).toContain('  route ');
  });
});
