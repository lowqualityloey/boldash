/**
 * Public surface of the routing engine (MS-4). MS-6 CLI code imports ONLY from
 * here; nothing in core re-imports through deep paths.
 */

export type {
  CapabilityContext,
  CeremonyLevel,
  LifecycleStage,
  RequirementFlags,
  RequirementOverrides,
  ResolvedRoute,
  Risk,
  RouteProposal,
  RouteScope,
  RouteTaskInput,
  RoutingWarning,
  TaskType,
} from './types.js';
export {
  MIN_CEREMONY_LEVEL,
  MAX_CEREMONY_LEVEL,
  REQUIRED_LEVEL_BY_RISK,
  REQUIREMENTS_BY_LEVEL,
  RISKS,
  requiredLevelFor,
  isLevelSufficient,
  requirementsFor,
  applyOverrides,
} from './levels.js';
export type { OverrideResult, RequirementKey } from './levels.js';
export { REQUIREMENT_KEYS } from './levels.js';
export type { WorkflowPack, WorkflowRegistry } from './registry.js';
export { WORKFLOW_PACKS, createRegistry } from './registry.js';
export {
  GENERIC_BASELINE,
  genericContext,
  hasCapability,
  missingCapabilities,
  capabilitiesSatisfied,
} from './capabilities.js';
export { checkScope } from './scope.js';
export type { ScopeCheckOptions } from './scope.js';
export {
  route,
  routeValidated,
  parseProposal,
  validateProposal,
  routeExit,
} from './pipeline.js';
export type { RouteDependencies } from './pipeline.js';
