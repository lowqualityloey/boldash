/**
 * Public surface of the verification engine (MS-5). The CLI (MS-6) imports
 * ONLY from here.
 */

export type {
  CheckBase,
  CheckOutcome,
  CommandCheck,
  CommandFailsCheck,
  EvidenceExistsCheck,
  FileExistsCheck,
  FileNotModifiedCheck,
  GateResult,
  GateStatus,
  NotCheck,
  NotCheckType,
  PassCheck,
  PassCheckType,
  RegexInFileCheck,
  StateCheckCheck,
  VerificationContract,
  VerifyEnv,
} from './types.js';
export { parseStateExpression } from './grammar.js';
export type { Literal, StateExpression } from './grammar.js';
export { containsSecretShape, redactText } from './redact.js';
export type { RedactResult } from './redact.js';
export { EvidenceStore } from './evidence.js';
export type { EvidenceRecord, EvidenceResult, NewEvidence } from './evidence.js';
export {
  runDeclaredCommand,
  DEFAULT_COMMAND_TIMEOUT_MS,
  OUTPUT_CAP_BYTES,
} from './command.js';
export type { CommandRun } from './command.js';
export { runCheck, resolveInside } from './checks.js';
export type { CheckDeps } from './checks.js';
export { loadContract } from './contract.js';
export { verifyTask, buildEnv } from './gate.js';
export type { GateDeps } from './gate.js';
