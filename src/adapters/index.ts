/**
 * Adapter barrel (MS-7 S1) — the CLI's only entry to host knowledge.
 *
 * Core code must never import this directory (architecture rule 8); the
 * CLI resolves an adapter here and hands plain capability sets to core.
 */
export type {
  BriefingResult,
  CapabilityName,
  CapabilitySet,
  DetectResult,
  DiagnosticResult,
  HostAdapter,
  InstallResult,
  PostToolHandler,
  PreToolHandler,
} from './adapter-types.js';
export { ALL_CAPABILITIES } from './adapter-types.js';
export {
  BRIEFING_BLOCK,
  BRIEFING_END,
  BRIEFING_START,
  GENERIC_ADAPTER_NAME,
  GENERIC_BRIEFING_FILE,
  appendBriefing,
  detectHost,
  genericAdapter,
  hintHost,
  probeCapabilities,
} from './generic.js';

/** Adapter names the CLI accepts in `--host` (R2: generic only in v0.1.0). */
export const KNOWN_ADAPTERS: readonly string[] = ['generic'] as const;
