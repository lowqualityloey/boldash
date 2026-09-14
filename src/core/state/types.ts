/**
 * Domain types mirroring schemas/*.schema.json.
 *
 * Schemas are the source of truth (AGENTS.md §Directory Layout rules); these
 * types are hand-written for v0.1.0 because the runtime dep budget is spent on
 * ajv (ADR 0003). Shape agreement is currently protected only by
 * `tests/unit/schemas.test.ts` validating the schemas themselves — the promised
 * type⇄schema drift test was NEVER written (this comment previously claimed it
 * existed; corrected 2026-09-14). Added to MS-9's docs/test debt list.
 * Regeneration remains a Phase 2 concern (ADR 0003 consequence note).
 */

export type TaskType =
  | 'bugfix'
  | 'feature'
  | 'refactor'
  | 'migration'
  | 'security'
  | 'architecture'
  | 'docs'
  | 'chore';

export type Risk = 'trivial' | 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus =
  | 'proposed'
  | 'planned'
  | 'implementing'
  | 'verifying'
  | 'complete'
  | 'blocked'
  | 'failed';

export interface Requirement {
  id: string; // ^R\d+$
  text: string;
  evidence?: string[]; // EVID-* refs (FACTs only)
}

export interface RiskItem {
  id: string; // ^RSK-\d+$
  text: string;
  mitigation?: string;
}

export interface Scope {
  files?: string[];
  systems?: string[];
}

export interface Task {
  schema_version: 1;
  id: string; // TASK-...
  title: string;
  type: TaskType;
  risk: Risk;
  level: 0 | 1 | 2 | 3;
  status: TaskStatus;
  requirements: Requirement[];
  risks?: RiskItem[];
  scope?: Scope;
  workflow?: string;
  owner?: string | null;
  summary?: string;
  /** Optimistic concurrency token (every read carries it; every write must echo it). */
  version: number;
  blocked_reason?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface TaskStateFile {
  schema_version: 1;
  tasks: Task[];
}

export type EventAction =
  | 'task.created'
  | 'task.transitioned'
  | 'task.requirement_added'
  | 'task.evidence_added'
  | 'task.claimed'
  | 'verify.run'
  | 'state.migrated'
  | 'route.validated'
  | 'policy.blocked';

export interface Event {
  id: string; // evt_[0-9a-z]+
  ts: string;
  task: string | null;
  action: EventAction;
  actor: string;
  payload?: Record<string, unknown>;
}

/** Input for creating a task — everything the caller decides, nothing the store owns. */
export interface NewTask {
  title: string;
  type: TaskType;
  risk: Risk;
  level: 0 | 1 | 2 | 3;
  requirements?: Requirement[];
  scope?: Scope;
  workflow?: string;
  summary?: string;
}
