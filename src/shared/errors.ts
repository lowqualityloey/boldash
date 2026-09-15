/**
 * The error catalog (docs/errors.md) as a tested constant.
 * AC-2 (MS-2): this set must equal the codes in docs/errors.md, and the
 * code→exit mapping must match the document — the docs are the oracle
 * (tests/unit/errors.test.ts parses them).
 *
 * Rules: codes are stable forever; new failure mode ⇒ new code, never a rename.
 */
export type ExitCode = 0 | 1 | 2 | 3 | 4 | 10 | 11 | 12;

export const ERROR_CATALOG = {
  // schema errors
  SCHEMA_PARSE: 2,
  SCHEMA_VALIDATION: 2,
  SCHEMA_VERSION_MISMATCH: 2,
  // routing errors
  WORKFLOW_NOT_FOUND: 2,
  LEVEL_RISK_MISMATCH: 2,
  SCOPE_FILE_NOT_FOUND: 0, // warning: logged, never blocks
  // state errors
  STATE_INVALID_TRANSITION: 2,
  STATE_TASK_NOT_FOUND: 2,
  STATE_MISSING_REQUIREMENT: 2,
  CONCURRENT_MODIFICATION: 4,
  STATE_LOCKED: 4,
  // policy errors
  POLICY_BLOCKED: 1,
  POLICY_RULE_INVALID: 2,
  // capability errors
  CAPABILITY_MISSING: 3,
  CAPABILITY_UNKNOWN: 3,
  // verification errors
  VERIFY_BLOCKED: 1,
  VERIFY_CONTRACT_INVALID: 2,
  VERIFY_COMMAND_TIMEOUT: 12,
  VERIFY_COMMAND_UNDECLARED: 2,
  // evidence errors
  EVIDENCE_NOT_FOUND: 2,
  EVIDENCE_REDACTION_FAILED: 10,
  EVENT_LOG_CORRUPT: 11,
  // host errors
  HOST_UNKNOWN: 0, // warning: falls back to generic adapter
  ADAPTER_INIT_FAILED: 3,
  HOOK_REGISTRATION_FAILED: 3,
  // cli errors (added MS-6 S1 via docs/errors.md §Adding an Error Code)
  CLI_USAGE: 2,
  CLI_PRECONDITION_FAILED: 2,
  // internal errors
  INTERNAL_ERROR: 10,
  IO_ERROR: 11,
  TIMEOUT: 12,
} as const satisfies Record<string, ExitCode>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export const ERROR_CODES = Object.keys(ERROR_CATALOG) as ErrorCode[];

export function exitCodeFor(code: ErrorCode): ExitCode {
  return ERROR_CATALOG[code];
}
