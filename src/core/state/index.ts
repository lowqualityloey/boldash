/**
 * Public surface of the State Engine (MS-2 core + MS-6 S1 scaffold).
 * Consumers — including the MS-6 CLI — import from here, never through
 * deep module paths (plan-001 §4.1). Re-exports only: no logic lives in
 * this file, so the barrel can never disagree with the modules behind it.
 */

export type {
  Event,
  EventAction,
  NewTask,
  Requirement,
  Risk,
  RiskItem,
  Scope,
  Task,
  TaskStateFile,
  TaskStatus,
  TaskType,
} from './types.js';

export { TRANSITIONS, allowedFrom, canTransition, isTerminal } from './transitions.js';

export { TaskStore } from './task-store.js';
export type { StoreResult, TaskStorePaths } from './task-store.js';

export { scaffoldProjectState, PROFILES } from './scaffold.js';
export type { Profile, ScaffoldInput, ScaffoldResult } from './scaffold.js';
