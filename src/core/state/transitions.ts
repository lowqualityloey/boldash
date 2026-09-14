import type { TaskStatus } from './types.js';

/**
 * Allowed lifecycle transitions (ARCHITECTURE.md §6.2 / task lifecycle in README).
 * `proposed → planned → implementing → verifying → complete`, with `blocked` and
 * `failed` reachable from the non-terminal states. Terminal states are terminal.
 *
 * The matrix is the single authority; `boldash state transition` refuses anything
 * not listed and reports the allowed set in the error context (docs/errors.md
 * STATE_INVALID_TRANSITION).
 */
export const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  proposed: ['planned', 'blocked', 'failed'],
  planned: ['implementing', 'blocked', 'failed'],
  implementing: ['verifying', 'blocked', 'failed'],
  verifying: ['complete', 'implementing', 'blocked', 'failed'],
  complete: [],
  blocked: ['proposed', 'planned', 'implementing', 'verifying', 'failed'],
  failed: [],
} as const;

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedFrom(from: TaskStatus): TaskStatus[] {
  return [...TRANSITIONS[from]];
}

/** True once a task can no longer be re-opened. */
export function isTerminal(status: TaskStatus): boolean {
  return status === 'complete' || status === 'failed';
}
