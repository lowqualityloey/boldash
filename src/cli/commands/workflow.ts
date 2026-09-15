/**
 * `boldash workflow list|validate` (MS-6 S2) — read-only view of the built-in
 * workflow registry. R1 (NOTES §4): the RFC's four built-ins
 * (`feature, bugfix, docs, chore`) are canonical; `list` shows them with
 * their requirements (docs/cli-reference.md §workflow).
 *
 * **What `validate` checks in v0.1.0** (resolves the open question carried in
 * checkpoint-001): packs are typed constants — ruling D-2 defers the pack
 * *file* format (manifest.yaml) to MS-8, and `schemas/workflow.schema.json`
 * does not exist — so the honest validation surface is the registry entry
 * itself: structural integrity of the {@link WorkflowPack}, then capability
 * satisfiability against the generic-host floor (MS-7 replaces the floor with
 * probed hosts). cli-reference's manifest/done-schema wording is patched in
 * S5. Exit contract (plan-001 §3 S2): 0 valid · 2 unknown/structurally
 * broken · 3 required capability the host does not provide.
 */
import {
  createRegistry,
  genericContext,
  missingCapabilities,
} from '../../core/router/index.js';
import type { LifecycleStage, WorkflowPack } from '../../core/router/index.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Envelope, RunContext } from '../types.js';

/** Exhaustiveness-checked stage set (adds `never` if the type grows). */
const LIFECYCLE_STAGES: Record<LifecycleStage, true> = {
  DISCOVER: true,
  PLAN: true,
  BUILD: true,
  VERIFY: true,
  SHIP: true,
  LEARN: true,
};

const DEFAULT_REGISTRY = createRegistry();

function fail(error: ErrorInfo): Envelope {
  return { ok: false, error };
}

function usage(message: string, field: string, suggestion: string): Envelope {
  return fail({ code: 'CLI_USAGE', message, field, suggestion });
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function nonEmptyStrings(values: readonly string[]): string | undefined {
  const blank = values.find((v) => v.trim().length === 0);
  if (blank !== undefined) return 'entries must be non-empty strings';
  const dupes = values.filter((v, i) => values.indexOf(v) !== i);
  if (dupes.length > 0) return `duplicate entries: ${[...new Set(dupes)].join(', ')}`;
  return undefined;
}

/**
 * Validate one workflow pack definition: structure first (exit-2 codes),
 * then mandatory-capability satisfiability on the generic host (exit 3).
 * Pure and deterministic — returns the pack unchanged when it passes.
 */
export function validateWorkflowPack(pack: WorkflowPack):
  | {
      ok: true;
      data: WorkflowPack;
    }
  | {
      ok: false;
      error: ErrorInfo;
    } {
  const name =
    typeof pack.name === 'string' && pack.name.trim().length > 0 ? pack.name : undefined;
  if (!name) {
    return failStructural('name', 'name must be a non-empty string');
  }
  if (!Number.isInteger(pack.version) || pack.version < 1) {
    return failStructural('version', 'version must be an integer >= 1', name);
  }
  if (!(pack.lifecycle in LIFECYCLE_STAGES)) {
    return failStructural(
      'lifecycle',
      `lifecycle must be one of: ${Object.keys(LIFECYCLE_STAGES).join(', ')}`,
      name,
    );
  }
  if (typeof pack.description !== 'string' || pack.description.trim().length === 0) {
    return failStructural('description', 'description must be a non-empty string', name);
  }
  for (const field of ['requires', 'optional'] as const) {
    const values = pack[field];
    if (!isStringArray(values)) {
      return failStructural(field, `${field} must be an array of strings`, name);
    }
    const bad = nonEmptyStrings(values);
    if (bad) return failStructural(field, bad, name);
  }
  const overlap = pack.requires.filter((c) => pack.optional.includes(c));
  if (overlap.length > 0) {
    return failStructural(
      'optional',
      `capabilities cannot be both required and optional: ${overlap.join(', ')}`,
      name,
    );
  }

  // Capability floor check — host unknown until MS-7, so the honest context
  // is genericContext(). An unprobed capability is assumed unavailable
  // (router/capabilities.ts §5.4): fail-closed, matching route step 5.
  const missing = missingCapabilities(pack.requires, genericContext());
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'CAPABILITY_MISSING',
        message: `Workflow '${name}' requires '${missing[0]}', which this host does not provide.`,
        field: 'workflow.requires',
        context: { missing, host: 'generic' },
        suggestion: `The generic host floor provides: ${[...genericContext().capabilities].join(', ')}.`,
      },
    };
  }
  return { ok: true, data: pack };
}

function failStructural(
  field: string,
  message: string,
  name = '?',
): {
  ok: false;
  error: ErrorInfo;
} {
  return {
    ok: false,
    error: {
      code: 'SCHEMA_VALIDATION',
      message: `workflow pack '${name}' is invalid: ${message}`,
      field: `workflow.${field}`,
      suggestion: 'Built-in packs are validated by tests at every change.',
    },
  };
}

/** Runner for `boldash workflow list`. */
export function runWorkflowList(ctx: RunContext): Envelope {
  const [extra] = ctx.positionals;
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'workflow list',
      'Usage: boldash workflow list.',
    );
  }
  const workflows = DEFAULT_REGISTRY.names().flatMap((n) => {
    const pack = DEFAULT_REGISTRY.get(n);
    return pack ? [pack] : [];
  });
  return { ok: true, data: { workflows } };
}

/** Runner for `boldash workflow validate <name>`. */
export function runWorkflowValidate(ctx: RunContext): Envelope {
  const [name, extra] = ctx.positionals;
  if (!name) {
    return usage(
      'workflow validate requires a workflow name.',
      'workflow',
      'Usage: boldash workflow validate <name>.',
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'workflow',
      'Usage: boldash workflow validate <name>.',
    );
  }
  const pack = DEFAULT_REGISTRY.get(name);
  if (!pack) {
    return fail({
      code: 'WORKFLOW_NOT_FOUND',
      message: `Workflow '${name}' is not enabled.`,
      field: 'workflow',
      context: { enabled: DEFAULT_REGISTRY.names() },
      suggestion: 'Choose from the enabled workflows (`boldash workflow list`).',
    });
  }
  const validated = validateWorkflowPack(pack);
  if (!validated.ok) return fail(validated.error);
  return { ok: true, data: { valid: true, workflow: validated.data } };
}
