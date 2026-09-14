/**
 * Capability matching for pipeline step 5 (`ARCHITECTURE.md` §5.2/§5.3).
 *
 * Pure: reads a {@link CapabilityContext}, never probes a host. Probing belongs to
 * adapters (architecture rule 8 — core must not import `src/adapters/`), so the
 * router's only knowledge of hosts is the set it is handed.
 *
 * The generic baseline below is the `Generic` column of the §5.3 matrix, and
 * `tests/unit/router/capabilities.test.ts` proves it against that table by parsing
 * the document — the same oracle discipline used for the error catalog and the
 * risk→level map. If the matrix changes, this module fails loudly instead of
 * drifting quietly.
 */

import type { CapabilityContext } from './types.js';

/**
 * What a host that provides *nothing* beyond the file system, a shell, read-only
 * git and a human still gets. Deliberately excludes `git.commit`, `git.branch`,
 * `git.worktree`, `github`, `mcp`, `subagents`, and both hook families.
 *
 * Hooks are the interesting omissions: without `pre_tool_hooks` a host cannot
 * *block* anything, so enforcement there is advisory (§5.3 closing note).
 */
export const GENERIC_BASELINE: ReadonlySet<string> = new Set([
  'filesystem.read',
  'filesystem.write',
  'shell.execute',
  'git.read',
  'human_approval',
]);

/**
 * A named capability the host provides.
 *
 * Unknown names are false, not errors: an unprobed capability is assumed
 * unavailable (§5.4), which keeps a typo in a pack conservative rather than
 * permissive.
 */
export function hasCapability(context: CapabilityContext, name: string): boolean {
  return context.capabilities.has(name);
}

/**
 * The requirements a host cannot satisfy, in declaration order.
 *
 * Order is contractual: `docs/errors.md` shows CAPABILITY_MISSING carrying
 * `context.missing` as a list, and step 5 reports *all* gaps rather than the
 * first, so one routing call gives the agent the whole correction.
 *
 * @param requires - capability names a workflow declares mandatory.
 * @param context - the active host's capability set.
 */
export function missingCapabilities(
  requires: readonly string[],
  context: CapabilityContext,
): string[] {
  return requires.filter((name) => !context.capabilities.has(name));
}

/**
 * Whether a workflow's mandatory capabilities are all available.
 *
 * @param requires - capability names a workflow declares mandatory.
 * @param context - the active host's capability set.
 * @returns `false` means step 5 must fail with `CAPABILITY_MISSING` (exit 3).
 */
export function capabilitiesSatisfied(
  requires: readonly string[],
  context: CapabilityContext,
): boolean {
  return missingCapabilities(requires, context).length === 0;
}

/**
 * A context carrying the generic baseline — the honest floor used when no adapter
 * has probed a host yet, and what MS-7 replaces with real detection.
 *
 * Returns a copy. Handing out {@link GENERIC_BASELINE} itself would let any caller
 * mutate the module-level set for every later route call, and `ReadonlySet` only
 * forbids that at compile time.
 */
export function genericContext(): CapabilityContext {
  return { host: 'generic', capabilities: new Set(GENERIC_BASELINE) };
}
