/**
 * Verification engine domain types — the TypeScript mirror of
 * `schemas/done.schema.json` (the schema remains the source of truth;
 * tests/unit/schemas.test.ts pins the shape pairings MS-2 established).
 *
 * Design rule (AGENTS.md §Error handling): everything that can fail returns a
 * discriminated union. No check implementation is allowed to throw across
 * `verifyTask`'s boundary — a crashed check must surface as a failed outcome,
 * never as an invisible exception.
 */

import type { Task } from '../state/types.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { EvidenceRecord } from './evidence.js';

/** Ceremony-free literal unions kept aligned with the meta-schema enums. */
export type PassCheckType =
  'file_exists' | 'command' | 'regex_in_file' | 'state_check' | 'evidence_exists';

export type NotCheckType = 'file_not_modified' | 'command_fails';

/** Common fields every check carries (meta-schema `definitions.common`). */
export interface CheckBase {
  /** User-visible label; Rule 5: descriptive, never just "test". */
  name: string;
  /** Per-check override of the 300 s command default (RFC §3.4 amendment). */
  timeout_ms?: number;
}

export interface FileExistsCheck extends CheckBase {
  type: 'file_exists';
  path: string;
}

export interface CommandCheck extends CheckBase {
  type: 'command';
  run: string;
}

export interface RegexInFileCheck extends CheckBase {
  type: 'regex_in_file';
  path: string;
  pattern: string;
}

export interface StateCheckCheck extends CheckBase {
  type: 'state_check';
  /** Constrained grammar — see grammar.ts (D2 ruling; full spec deferred to #13). */
  check: string;
}

export interface EvidenceExistsCheck extends CheckBase {
  type: 'evidence_exists';
  /** Evidence KIND (e.g. `review`, `test-run`), not a filesystem path. */
  path: string;
}

export interface FileNotModifiedCheck extends CheckBase {
  type: 'file_not_modified';
  path: string;
}

export interface CommandFailsCheck extends CheckBase {
  type: 'command_fails';
  run: string;
}

export type PassCheck =
  | FileExistsCheck
  | CommandCheck
  | RegexInFileCheck
  | StateCheckCheck
  | EvidenceExistsCheck;

export type NotCheck = FileNotModifiedCheck | CommandFailsCheck;

/** A schema-validated `done.schema.json` document. */
export interface VerificationContract {
  task_id: string;
  must_pass: [PassCheck, ...PassCheck[]];
  must_not?: NotCheck[];
}

export type GateStatus = 'VERIFIED' | 'BLOCKED';

/** Per-check verdict. Evidence references are FACTs produced by execution. */
export interface CheckOutcome {
  name: string;
  type: PassCheckType | NotCheckType;
  pass: boolean;
  /** Why it failed / what was observed; never raw secrets (redaction precedes). */
  detail: string;
  /** EVID-* id when the check produced evidence. */
  evidenceId?: string;
  /** Set when the check could not be evaluated at all (grammar reject, IO). */
  error?: ErrorInfo;
}

export interface GateResult {
  status: GateStatus;
  task: string;
  checks: CheckOutcome[];
  /** First blocking failure's exit contribution; gates aggregate to 0 or 1 (timeouts keep 12). */
  exit: 0 | 1 | 12;
  started_at: string;
  finished_at: string;
}

/** Everything a check may consult, injected by the gate layer (no ambient
 * reads). Evidence views are computed once up front by verifyTask, so a
 * corrupt index fails the whole run loudly instead of masquerading as
 * "no evidence" — and no check ever swallows an index error to pass. */
export interface VerifyEnv {
  /** Absolute project root; every `path` resolves against it, escape-checked. */
  cwd: string;
  /** The task under verification (freshly loaded by the caller). */
  task: Task;
  /** Kinds currently attached to the task (evidence_exists oracle). */
  evidenceKinds: ReadonlySet<string>;
  /** Full entries for the task (file_not_modified baseline lookup). */
  evidenceEntries: readonly EvidenceRecord[];
}
