/**
 * Result is the engine-boundary error discipline (AGENTS.md §Error handling):
 * engines return discriminated unions; exceptions never cross a boundary.
 */
export interface ErrorInfo {
  /** Stable identifier — never renamed, never localized (docs/errors.md). */
  code: ErrorCode;
  /** Human-readable; mutable between versions. Agents branch on `code`, not this. */
  message: string;
  /** JSON path to the offending field, when applicable. */
  field?: string;
  /** Remediation hint. Not guaranteed correct. */
  suggestion?: string;
  /** Structured data specific to the code. */
  context?: Record<string, unknown>;
}

import type { ErrorCode } from './errors.js';

export type Result<T, E = ErrorInfo> = { ok: true; data: T } | { ok: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E extends ErrorInfo>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; data: T } {
  return r.ok;
}
