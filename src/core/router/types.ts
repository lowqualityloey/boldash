/**
 * Router types — the shapes that cross the routing engine boundary.
 *
 * Source of truth for the wire format is `docs/routing-contract.md`, pinned by
 * `schemas/route.schema.json`. Nothing here narrows `unknown`: schema validation
 * at pipeline step 2 is the only permitted narrowing seam (P7 — model output is
 * untrusted until it validates), so duplicating guards in TypeScript would give
 * two authorities to drift.
 */

import type { ErrorCode } from '../../shared/errors.js';

/** Task types accepted by `route.schema.json` (`task.type`). */
export type TaskType =
  | 'bugfix'
  | 'feature'
  | 'refactor'
  | 'migration'
  | 'security'
  | 'architecture'
  | 'docs'
  | 'chore';

/** Risk classifications (`task.risk`). Risk determines the required level. */
export type Risk = 'trivial' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Ceremony levels 0–3, matching `route.level` (minimum 0, maximum 3).
 * Level 3 plus `human_approval` expresses the documented `critical` tier.
 */
export type CeremonyLevel = 0 | 1 | 2 | 3;

/**
 * Lifecycle stage a workflow belongs to (`ARCHITECTURE.md` §16 glossary:
 * "A grouping of workflows: DISCOVER, PLAN, BUILD, VERIFY, SHIP, LEARN").
 * Carried by a pack for reporting; the router does not branch on it.
 */
export type LifecycleStage = 'DISCOVER' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP' | 'LEARN';

/**
 * What the active host can actually do, as probed by an adapter.
 *
 * Core code never learns about hosts (AGENTS.md architecture rule 8); it receives
 * this value. `capabilities` is a set of names, not booleans per known key, so an
 * unknown requirement is reported missing rather than silently satisfied —
 * matching `ARCHITECTURE.md` §5.4: "Capability probe inconclusive ⇒ assume the
 * capability is unavailable."
 */
export interface CapabilityContext {
  /** Host identifier for error context (`docs/errors.md` CAPABILITY_MISSING). */
  host: string;
  /** Capability names the host provides. Absent means unavailable. */
  capabilities: ReadonlySet<string>;
}

/** Declared scope. Advisory only: scope warns, it never blocks (§Scope). */
export interface RouteScope {
  /** Glob patterns relative to project root. */
  files?: string[];
  /** Freeform system names for summaries and policy rules. */
  systems?: string[];
}

/** The `task` half of a routing proposal, post-validation. */
export interface RouteTaskInput {
  type: TaskType;
  risk: Risk;
  scope: RouteScope;
  summary?: string;
}

/** Overridable subset of {@link RequirementFlags} (`route.requirements`). */
export interface RequirementOverrides {
  task_record?: boolean;
  specification?: boolean;
  tests?: boolean;
  review?: boolean;
  human_approval?: boolean;
}

/** The `route` half of a routing proposal, post-validation. */
export interface RouteProposalInput {
  workflow: string;
  level: CeremonyLevel;
  requirements?: RequirementOverrides;
}

/** A complete, schema-valid routing proposal. */
export interface RouteProposal {
  task: RouteTaskInput;
  route: RouteProposalInput;
}

/** The five ceremony keys a workflow can require. Field names are contractual. */
export interface RequirementFlags {
  task_record: boolean;
  specification: boolean;
  tests: boolean;
  review: boolean;
  human_approval: boolean;
}

/**
 * A non-blocking finding from pipeline step 6.
 *
 * Present on a successful route only when non-empty (plan §12 D-3), so the
 * documented success payloads stay byte-identical to `routing-contract.md`.
 * Warnings never become failures: `SCOPE_FILE_NOT_FOUND` exits 0 by design.
 */
export interface RoutingWarning {
  code: ErrorCode;
  message: string;
  field?: string;
  context?: Record<string, unknown>;
}

/** Step 7 output: the minimum the agent needs to proceed (§What the Agent Sees). */
export interface ResolvedRoute {
  workflow: string;
  level: CeremonyLevel;
  requirements: RequirementFlags;
  /** Omitted entirely when there is nothing to report, never `[]`. */
  warnings?: RoutingWarning[];
}
