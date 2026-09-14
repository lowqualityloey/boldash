/**
 * Built-in workflow registry (pipeline step 3).
 *
 * **Scope is the RFC's, not ARCHITECTURE's.** `docs/specs/2026-09-15-spec-v0.1.0-foundation.md`
 * §5 fixes MS-4 at *four* built-in packs — `feature`, `bugfix`, `docs`, `chore` — while
 * `ARCHITECTURE.md` §10.3 lists eight reference packs (`feature`, `bugfix`, `refactor`,
 * `migration`, `test`, `review`, `commit`, `release`) and `docs/cli-reference.md:125`
 * documents `boldash init` printing a third set. Those three disagree; the conflict is
 * tracked rather than silently resolved here, because MS-6's golden tests will assert
 * CLI output against whichever set ships. See issue #12 and `docs/NOTES.md` §4.
 *
 * Packs are typed constants, not files: `ARCHITECTURE.md` §5.3 specifies
 * `manifest.yaml`, and a YAML parser would breach the ajv-only runtime-dependency
 * invariant. Ruling **D-2** (`…ms4-router.plan-001.md` §12) defers the pack *file*
 * format to MS-8 under its own ADR. {@link WorkflowPack} is the shape that decision
 * will have to fit.
 */

import type { LifecycleStage } from './types.js';

/** A workflow's declared requirements and defaults. */
export interface WorkflowPack {
  /** Registry key, matched against `route.workflow` at step 3. */
  name: string;
  /** Pack version; travels with the repository, never inferred from git. */
  version: number;
  lifecycle: LifecycleStage;
  /**
   * Mandatory capabilities. Kept within {@link ../capabilities.GENERIC_BASELINE}
   * for every built-in — a pack that demanded `git.commit` would fail step 5 on
   * the generic host and so violate P8 (graceful degradation). Asserted by test,
   * not by comment.
   */
  requires: readonly string[];
  /** Nice-to-have capabilities; never a routing precondition. */
  optional: readonly string[];
  /** One-line purpose, for `boldash workflow list` (MS-6 surface). */
  description: string;
}

/**
 * The four built-ins. `requires` is derived from what the workflow must do with
 * only a filesystem, a shell, read-only git and a human: write the change, run
 * the commands its `done.schema.json` declares, read state back. `docs` needs no
 * shell, so it asks for less — a smaller floor is a smaller blast radius.
 */
export const WORKFLOW_PACKS: readonly WorkflowPack[] = [
  {
    name: 'feature',
    version: 1,
    lifecycle: 'BUILD',
    requires: ['filesystem.read', 'filesystem.write', 'shell.execute', 'git.read'],
    optional: ['git.commit', 'subagents', 'pre_tool_hooks'],
    description: 'Implement a new capability end to end.',
  },
  {
    name: 'bugfix',
    version: 1,
    lifecycle: 'VERIFY',
    requires: ['filesystem.read', 'filesystem.write', 'shell.execute', 'git.read'],
    optional: ['git.commit', 'pre_tool_hooks'],
    description: 'Diagnose and repair a defect, with a regression test.',
  },
  {
    name: 'docs',
    version: 1,
    lifecycle: 'BUILD',
    requires: ['filesystem.read', 'filesystem.write'],
    optional: ['git.read', 'git.commit'],
    description: 'Change documentation and prose only.',
  },
  {
    name: 'chore',
    version: 1,
    lifecycle: 'BUILD',
    requires: ['filesystem.read', 'filesystem.write', 'shell.execute'],
    optional: ['git.read', 'git.commit'],
    description: 'Mechanical maintenance: formatting, dependency bumps, tidy-ups.',
  },
];

/** The registry seam step 3 reads. */
export interface WorkflowRegistry {
  /** The pack registered under `name`, or `undefined` (step 3 → WORKFLOW_NOT_FOUND). */
  get(name: string): WorkflowPack | undefined;
  /** Whether `name` resolves. */
  has(name: string): boolean;
  /** Every registered name, in registration order. */
  names(): string[];
}

/**
 * Build a registry, optionally overriding the built-ins.
 *
 * The parameter is the point, not a convenience ({@link ../} plan §12 **D-1**): the
 * routing-contract's `CAPABILITY_MISSING` example routes `workflow: "migration"`,
 * which is not one of the four built-ins, and step 3 runs before step 5. So the
 * documented payload must be testable against a registry that *does* carry
 * `migration` while the default registry stays at four. MS-8's importer needs the
 * same seam to register packs it writes.
 *
 * @param packs - definitions to register; defaults to {@link WORKFLOW_PACKS}.
 * @throws Error on a duplicate or blank name — a programming fault at construction,
 *         not a routing outcome, so it is loud rather than a `Result`.
 */
export function createRegistry(
  packs: readonly WorkflowPack[] = WORKFLOW_PACKS,
): WorkflowRegistry {
  const byName = new Map<string, WorkflowPack>();
  for (const pack of packs) {
    if (!pack.name) {
      throw new Error('createRegistry: a workflow pack needs a non-empty name');
    }
    if (byName.has(pack.name)) {
      throw new Error(`createRegistry: duplicate workflow pack '${pack.name}'`);
    }
    byName.set(pack.name, pack);
  }
  return {
    get(name) {
      const pack = byName.get(name);
      if (!pack) return undefined;
      // Copy out: callers must not be able to mutate a shared built-in.
      return { ...pack, requires: [...pack.requires], optional: [...pack.optional] };
    },
    has(name) {
      return byName.has(name);
    },
    names() {
      return [...byName.keys()];
    },
  };
}
