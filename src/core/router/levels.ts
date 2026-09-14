/**
 * Risk → level enforcement and requirement derivation (pipeline step 4).
 *
 * Pure logic: reads the proposal, never mutates, never touches the filesystem.
 * The mapping and the one-way rule come verbatim from
 * `docs/routing-contract.md` §Level and Risk; the requirement rows come from the
 * same table's "Meaning" column, with the documented `critical → 3 + human
 * approval` tier expressed by forcing that one flag in {@link requirementsFor}.
 *
 * Making the table `as const` and exhaustive over `Risk` is deliberate: adding a
 * risk to `route.schema.json` without adding a row here is a compile error, and
 * `tests/unit/router/levels.test.ts` proves the two agree against the schema file
 * itself — the same doc-as-oracle discipline MS-2 uses for the error catalog.
 */

import type {
  CeremonyLevel,
  RequirementFlags,
  RequirementOverrides,
  Risk,
} from './types.js';

/** Every risk classification, in ascending order. Mirrors `task.risk` in the schema. */
export const RISKS: readonly Risk[] = [
  'trivial',
  'low',
  'medium',
  'high',
  'critical',
] as const;

/** Inclusive bounds of `route.level` (schema: minimum 0, maximum 3). */
export const MIN_CEREMONY_LEVEL = 0;
export const MAX_CEREMONY_LEVEL = 3;

/**
 * The minimum ceremony level each risk demands.
 *
 * `high` and `critical` both require level 3; they differ only in that
 * `critical` additionally forces `human_approval` (see {@link requirementsFor}).
 */
export const REQUIRED_LEVEL_BY_RISK: Readonly<Record<Risk, CeremonyLevel>> = {
  trivial: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 3,
} as const;

/**
 * Ceremony implied by each level, before risk-specific adjustments.
 *
 * Level 2 reproduces the documented success payload for
 * `feature`/`medium` exactly, field for field (§What the Agent Sees).
 */
export const REQUIREMENTS_BY_LEVEL: Readonly<Record<CeremonyLevel, RequirementFlags>> = {
  0: {
    task_record: false,
    specification: false,
    tests: false,
    review: false,
    human_approval: false,
  },
  1: {
    task_record: true,
    specification: false,
    tests: false,
    review: false,
    human_approval: false,
  },
  2: {
    task_record: true,
    specification: true,
    tests: true,
    review: false,
    human_approval: false,
  },
  3: {
    task_record: true,
    specification: true,
    tests: true,
    review: true,
    human_approval: false,
  },
} as const;

/** The five contractual requirement keys. */
export type RequirementKey = keyof RequirementFlags;

/** Order used whenever requirement flags are serialized or compared. */
export const REQUIREMENT_KEYS: readonly RequirementKey[] = [
  'task_record',
  'specification',
  'tests',
  'review',
  'human_approval',
] as const;

/** Outcome of validating explicit `route.requirements` overrides. */
export type OverrideResult =
  | { ok: true; data: RequirementFlags }
  | {
      ok: false;
      /** Keys the proposal tried to switch off. */ removed: RequirementKey[];
    };

/**
 * The minimum level a risk demands.
 *
 * @param risk - validated `task.risk` value.
 */
export function requiredLevelFor(risk: Risk): CeremonyLevel {
  return REQUIRED_LEVEL_BY_RISK[risk];
}

/**
 * The one-way rule: a proposal may choose **more** ceremony than its risk
 * requires, never less.
 *
 * @param proposed - level carried by the proposal.
 * @param risk - validated `task.risk` value.
 * @returns `true` when the level is sufficient; `false` means step 4 must fail
 *          with `LEVEL_RISK_MISMATCH` (exit 2).
 */
export function isLevelSufficient(proposed: CeremonyLevel, risk: Risk): boolean {
  return proposed >= requiredLevelFor(risk);
}

/**
 * Resolve the requirement flags a route implies, after the level check passes.
 *
 * `critical` risk forces `human_approval: true` at any level, per the
 * "3 + human approval" row. The returned object is always a fresh copy, so
 * callers cannot mutate the shared tables.
 *
 * @param level - the proposal's level, already proven sufficient.
 * @param risk - validated `task.risk` value.
 */
export function requirementsFor(level: CeremonyLevel, risk: Risk): RequirementFlags {
  const base = REQUIREMENTS_BY_LEVEL[level];
  const resolved: RequirementFlags = { ...base };
  if (risk === 'critical') {
    resolved.human_approval = true;
  }
  return resolved;
}

/**
 * Apply explicit `route.requirements` overrides to derived flags.
 *
 * Overrides may only **add** ceremony — a proposal that tries to switch off a
 * requirement its level already imposes is rejected rather than silently
 * honoured, mirroring {@link isLevelSufficient}'s one-way rule. Removals are
 * reported as a list so the caller can build one accurate error instead of
 * failing on the first key it happens to encounter.
 *
 * @param base - flags from {@link requirementsFor}.
 * @param overrides - the proposal's `route.requirements`, if any.
 */
export function applyOverrides(
  base: RequirementFlags,
  overrides?: RequirementOverrides,
): OverrideResult {
  if (!overrides) {
    return { ok: true, data: { ...base } };
  }
  const merged: RequirementFlags = { ...base };
  const removed: RequirementKey[] = [];
  for (const key of REQUIREMENT_KEYS) {
    const requested = overrides[key];
    if (requested === undefined) continue;
    if (!requested && base[key]) {
      removed.push(key);
      continue;
    }
    merged[key] = requested;
  }
  if (removed.length > 0) {
    return { ok: false, removed };
  }
  return { ok: true, data: merged };
}
