/**
 * The routing pipeline — seven ordered steps (docs/routing-contract.md
 * §The Validation Pipeline), and the public heart of MS-4.
 *
 * Discipline this file exists to enforce:
 * - Every step returns `Result`; **no exceptions cross the boundary** (contract,
 *   closing line) — malformed JSON is data, not a thrown error.
 * - Order is load-bearing: step 3 (registry) precedes step 5 (capabilities), so
 *   an unregistered workflow reports `WORKFLOW_NOT_FOUND` rather than pretending
 *   its capabilities were checked (plan ruling D-1, proven by T-5).
 * - Narrowing `unknown` happens ONLY through the schema validator (P7). The cast
 *   after `validate` passes is the single trust point.
 * - The router is stateless: no events, no state writes (D-3 ruling; CLI owns
 *   logging in MS-6).
 */

import { err, ok, type Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import { getValidator, firstError } from '../../shared/schema.js';
import { exitCodeFor } from '../../shared/errors.js';
import { missingCapabilities } from './capabilities.js';
import { applyOverrides, isLevelSufficient, requiredLevelFor, requirementsFor } from './levels.js';
import { createRegistry, type WorkflowRegistry } from './registry.js';
import { checkScope } from './scope.js';
import type { CapabilityContext, ResolvedRoute, RouteProposal } from './types.js';

export interface RouteDependencies {
  /** Registry for step 3; defaults to the built-in four-pack set. */
  registry?: WorkflowRegistry;
  /** Host capabilities for step 5, probed by the adapter layer. */
  context: CapabilityContext;
  /** Project root for step 6 scope checks; omit to skip step 6 checks. */
  cwd?: string;
}

/** Dotted JSON path form used by docs/errors.md (`route.level`, not `/route/level`). */
function dottedField(instancePath: string | undefined): string | undefined {
  if (!instancePath) return undefined;
  const trimmed = instancePath.replace(/^\//, '').replace(/\//g, '.');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Steps 1 + 2: parse text and validate against route.schema.json.
 * Exported separately so the CLI can report parse and validation distinctly.
 */
export function parseProposal(text: string): Result<RouteProposal> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return err({
      code: 'SCHEMA_PARSE',
      message: `${String(cause)}`,
      field: 'route',
      suggestion: 'Provide valid JSON.',
    });
  }
  return validateProposal(parsed);
}

/** Step 2 alone: validate an already-parsed value. */
export function validateProposal(input: unknown): Result<RouteProposal> {
  const validate = getValidator('route');
  if (!validate(input)) {
    const info = validate.errors?.[0];
    const field = dottedField(info?.instancePath);
    return err({
      code: 'SCHEMA_VALIDATION',
      message: firstError('route', validate),
      ...(field ? { field } : {}),
      suggestion: 'Fix the field named in `field` against route.schema.json.',
    });
  }
  // Single trust point: everything below sees schema-shaped values only (P7).
  return ok(input as RouteProposal);
}

/**
 * Steps 3–7. `proposal` must already be schema-valid (use {@link route} or
 * {@link parseProposal} to get there; feeding unvalidated data here is a
 * programming error, not a routing outcome).
 */
export function routeValidated(
  proposal: RouteProposal,
  deps: RouteDependencies,
): Result<ResolvedRoute> {
  const registry = deps.registry ?? createRegistry();
  const { task, route } = proposal;

  // Step 3 — registry membership. context.enabled per AC-4.
  const pack = registry.get(route.workflow);
  if (!pack) {
    return err({
      code: 'WORKFLOW_NOT_FOUND',
      message: `Workflow '${route.workflow}' is not enabled.`,
      field: 'route.workflow',
      context: { enabled: registry.names() },
      suggestion: 'Choose from the enabled workflows.',
    });
  }

  // Step 4 — the one-way risk→level rule, then the one-way override rule.
  const required = requiredLevelFor(task.risk);
  if (!isLevelSufficient(route.level, task.risk)) {
    return err({
      code: 'LEVEL_RISK_MISMATCH',
      message: `Risk '${task.risk}' requires level ${required}, but level ${route.level} was proposed.`,
      field: 'route.level',
      suggestion: `Raise level to ${required}.`,
    });
  }
  const derived = requirementsFor(route.level, task.risk);
  const merged = applyOverrides(derived, route.requirements);
  if (!merged.ok) {
    return err({
      code: 'SCHEMA_VALIDATION',
      message: `route.requirements may only add ceremony; it tried to remove: ${merged.removed.join(', ')}.`,
      field: 'route.requirements',
      suggestion: `Level ${route.level} requires those flags. Raise the workflow bar via a different route, never by switching ceremony off.`,
    });
  }

  // Step 5 — every gap reported at once, declaration order preserved.
  const missing = missingCapabilities(pack.requires, deps.context);
  if (missing.length > 0) {
    return err({
      code: 'CAPABILITY_MISSING',
      message: `Workflow '${pack.name}' requires '${missing.join("', '")}', which this host does not provide.`,
      field: 'route.workflow',
      context: { missing, host: deps.context.host },
      suggestion: 'Use a workflow the host supports, or switch to a host providing the capability.',
    });
  }

  // Step 6 — advisory scope warnings; never a failure (exit stays 0 on success).
  const warnings = checkScope(task.scope.files, { ...(deps.cwd ? { cwd: deps.cwd } : {}) });

  // Step 7 — the minimum the agent needs to proceed.
  const resolved: ResolvedRoute = {
    workflow: pack.name,
    level: route.level,
    requirements: merged.data,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return ok(resolved);
}

/** Full pipeline for either raw text or an already-parsed value. */
export function route(input: string | unknown, deps: RouteDependencies): Result<ResolvedRoute> {
  const parsed = typeof input === 'string' ? parseProposal(input) : validateProposal(input);
  if (!parsed.ok) return parsed;
  return routeValidated(parsed.data, deps);
}

/** Convenience: the documented exit code for any pipeline error code. */
export function routeExit(code: ErrorInfo['code']): number {
  return exitCodeFor(code);
}
