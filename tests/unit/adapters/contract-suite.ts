/**
 * Shared adapter contract suite (MS-7 S1).
 *
 * AGENTS.md requires every adapter to pass this suite before it lands.
 * Generic is its first subject (`contract.test.ts`); per-host adapters
 * reuse it unchanged in Phase 2/3. Lives under `tests/` (not `src/`) so
 * runtime code keeps zero coupling to the test runner (ADR-0002).
 *
 * Each assertion states the architectural rule it pins, so a failure reads
 * as the violated rule, not just a red test.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { CapabilityName, HostAdapter } from '../../../src/adapters/index.js';
import {
  ALL_CAPABILITIES,
  BRIEFING_END,
  BRIEFING_START,
} from '../../../src/adapters/index.js';
import { matrixCapabilityNames, parseMatrix } from '../router/doc-oracle.js';

const MATRIX = parseMatrix();

function countBlocks(text: string): number {
  return text.split(BRIEFING_START).length - 1;
}

/**
 * Register the full contract against `adapter`. Call inside a `describe`
 * block; the temp project root is fresh per case.
 *
 * @param adapter - the adapter under contract.
 * @param label - human name used in assertion messages.
 */
export function assertAdapterContract(adapter: HostAdapter, label: string): void {
  const freshRoot = (): string => mkdtempSync(join(tmpdir(), 'boldash-adapter-'));

  it(`${label}: declares a non-empty adapter name`, () => {
    expect(adapter.name.length).toBeGreaterThan(0);
  });

  it(`${label}: capability list covers every name the §5.3 matrix uses`, () => {
    // A capability the matrix names but the type union lacks would fail
    // closed everywhere with no honest declaration path — fail loudly here.
    for (const name of matrixCapabilityNames(MATRIX)) {
      expect(
        (ALL_CAPABILITIES as readonly string[]).includes(name),
        `matrix names '${name}' but ALL_CAPABILITIES lacks it`,
      ).toBe(true);
    }
  });

  it(`${label}: hasCapability agrees with the declared set on every matrix name`, () => {
    for (const name of matrixCapabilityNames(MATRIX)) {
      expect(adapter.hasCapability(name), name).toBe(
        adapter.capabilities.has(name as CapabilityName),
      );
    }
  });

  it(`${label}: unknown capability names are false, never errors (§5.4)`, () => {
    expect(adapter.hasCapability('not.a.real.capability')).toBe(false);
    expect(adapter.hasCapability('')).toBe(false);
  });

  it(`${label}: install writes exactly one briefing block`, async () => {
    const root = freshRoot();
    const installed = await adapter.install(root);
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(countBlocks(text)).toBe(1);
    expect(text).toContain(BRIEFING_END);
    expect(installed.briefing.skipped).toBe(false);
  });

  it(`${label}: install is idempotent — second run writes nothing`, async () => {
    const root = freshRoot();
    const first = await adapter.install(root);
    const before = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const second = await adapter.install(root);
    const after = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(after).toBe(before);
    expect(countBlocks(after)).toBe(1);
    expect(first.briefing.skipped).toBe(false);
    expect(second.briefing.skipped).toBe(true);
  });

  it(`${label}: hook registration never throws, even without hook support`, () => {
    expect(() => adapter.onBeforeTool('write', () => true)).not.toThrow();
    expect(() => adapter.onAfterTool('write', () => {})).not.toThrow();
  });

  it(`${label}: diagnose resolves a well-formed result`, async () => {
    const root = freshRoot();
    const result = await adapter.diagnose(root);
    expect(result.adapter).toBe(adapter.name);
    expect(typeof result.ok).toBe('boolean');
    expect(Array.isArray(result.warnings)).toBe(true);
  });
}
