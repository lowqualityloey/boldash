/**
 * Generic host adapter (MS-7 S1) — the only adapter in v0.1.0.
 *
 * A generic host provides the file system, a shell, read-only git, and a
 * human (the §5.3 Generic column, shared with the router's `GENERIC_BASELINE`
 * so the two can never disagree). It cannot commit, spawn subagents, or
 * enforce hooks, so it serves in advisory mode: warn, log, report — never
 * block (§5.3 closing note).
 *
 * Detection is best-effort and only ever names the surroundings for the
 * `HOST_UNKNOWN` warning; the selected adapter is always `generic`.
 * No subprocess is ever spawned: PATH binaries are resolved with plain
 * `existsSync` checks, never `exec`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { GENERIC_BASELINE } from '../core/router/capabilities.js';
import { err, ok } from '../shared/result.js';
import type { ErrorInfo, Result } from '../shared/result.js';
import type {
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

/** This adapter's identifier. */
export const GENERIC_ADAPTER_NAME = 'generic';

/** Briefing file the generic adapter owns. */
export const GENERIC_BRIEFING_FILE = 'AGENTS.md';

/** Marker pair guarding the Boldash block (append-only, idempotent). */
export const BRIEFING_START = '<!-- BOLDASH_START -->';
export const BRIEFING_END = '<!-- BOLDASH_END -->';

/**
 * The briefing block installed into `AGENTS.md`. Deliberately short: the
 * LLM-facing surface stays small (architecture rule 4). Markers are HTML
 * comments so they never disturb other tooling that shares the file —
 * including PromptKit's own `PROMPTKIT_START/END` blocks.
 */
export const BRIEFING_BLOCK = `${BRIEFING_START}
# Boldash

This repository is managed by Boldash, the deterministic control plane:
the agent proposes, Boldash validates, enforces, records, and verifies.

- State: \`.boldash/state/tasks.json\` (JSON is truth; Markdown is projection)
- Route before work: \`boldash route --input proposal.json\`
- Verify before done: \`boldash verify <TASK-ID>\`
${BRIEFING_END}
`;

/** Detected-host hint markers: project files, then PATH binaries. */
const PROJECT_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ['CLAUDE.md', 'claude'],
  ['.cursor', 'cursor'],
  ['.antigravity', 'antigravity'],
];

const BINARY_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ['claude', 'claude'],
  ['cursor', 'cursor'],
  ['codex', 'codex'],
  ['gemini', 'gemini'],
];

/**
 * Best-effort name hint for the surrounding host, or `undefined` when
 * nothing is recognized. Precedence: `BOLDASH_HOST` override (documented in
 * cli-reference §Environment), then project markers, then PATH binaries.
 * A hint never changes the selected adapter — only the warning text.
 *
 * @param projectRoot - directory to scan for host marker files.
 * @param env - environment mapping (injectable for deterministic tests).
 * @param pathValue - PATH string to scan for host binaries.
 */
export function hintHost(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  pathValue: string = process.env.PATH ?? '',
): string | undefined {
  const override = (env['BOLDASH_HOST'] ?? '').trim();
  if (override.length > 0) return override;
  for (const [marker, name] of PROJECT_MARKERS) {
    try {
      if (existsSync(join(projectRoot, marker))) return name;
    } catch {
      /* unreadable entry reads as absent — detection stays best-effort */
    }
  }
  const dirs = pathValue.split(delimiter).filter((d) => d.length > 0);
  for (const [binary, name] of BINARY_MARKERS) {
    for (const dir of dirs) {
      try {
        if (existsSync(join(dir, binary))) return name;
      } catch {
        /* same best-effort discipline as above */
      }
    }
  }
  return undefined;
}

/**
 * True when `cwd` holds a `.git` entry. Best-effort: an unreadable
 * directory reads as absent, never as an error.
 */
function hasGitDir(cwd: string): boolean {
  try {
    return existsSync(join(cwd, '.git'));
  } catch {
    return false;
  }
}

/**
 * Detect the host serving `cwd`. Always resolves the generic adapter in
 * v0.1.0; a recognized surrounding host is reported as a name hint plus a
 * `HOST_UNKNOWN` warning (errors.md: exit 0 — detection never blocks).
 *
 * @param cwd - working directory that should hold the project.
 */
export function detectHost(cwd: string): DetectResult {
  const hint = hintHost(cwd);
  return {
    adapter: GENERIC_ADAPTER_NAME,
    ...(hint ? { detectedName: hint } : {}),
    gitRepo: hasGitDir(cwd),
    warnings: hint ? [] : ['HOST_UNKNOWN'],
  };
}

/**
 * The probed capability set of a generic host: exactly the §5.3 Generic
 * column, single-sourced from the router's `GENERIC_BASELINE` so the two
 * can never disagree. (The cast is pinned by the matrix-oracle test:
 * every baseline member must appear in the Generic column.) A fresh copy
 * every call — callers must not mutate shared state.
 */
export function probeCapabilities(): CapabilitySet {
  return new Set<CapabilityName>(GENERIC_BASELINE as ReadonlySet<CapabilityName>);
}

function ioFail(what: string, cause: unknown): Result<never, ErrorInfo> {
  return err({
    code: 'IO_ERROR',
    message: `cannot write briefing file ${what}: ${String(cause)}`,
    field: what,
    suggestion: 'Check permissions and available disk space, then re-run.',
  });
}

/**
 * Append the Boldash briefing block to `AGENTS.md` in `projectRoot`,
 * creating the file when absent. Append-only and idempotent: when the
 * marker block is already present nothing is written (`skipped: true`),
 * and existing content — including other tools' marker blocks — is never
 * modified, only preserved byte-for-byte before the append.
 *
 * @param projectRoot - directory that owns the briefing file.
 */
export function appendBriefing(projectRoot: string): Result<BriefingResult, ErrorInfo> {
  const path = join(projectRoot, GENERIC_BRIEFING_FILE);
  let existing: string | null = null;
  try {
    if (existsSync(path)) existing = readFileSync(path, 'utf8');
  } catch (cause) {
    return ioFail(path, cause);
  }
  if (existing !== null && existing.includes(BRIEFING_START)) {
    return ok({ path, skipped: true });
  }
  const prefix =
    existing === null
      ? ''
      : existing.endsWith('\n') || existing.length === 0
        ? existing
        : `${existing}\n`;
  try {
    writeFileSync(path, `${prefix}${BRIEFING_BLOCK}`, 'utf8');
  } catch (cause) {
    return ioFail(path, cause);
  }
  return ok({ path, skipped: false });
}

/**
 * The generic adapter: honest floor capabilities, advisory hooks, briefing
 * via `appendBriefing`. `install`/`diagnose` are async per ARCH §5.2 though
 * the work underneath is synchronous filesystem I/O.
 */
export const genericAdapter: HostAdapter = {
  name: GENERIC_ADAPTER_NAME,

  /**
   * Fresh copy per access: handing out one shared set would let any caller
   * mutate every later reader (same aliasing rule as `genericContext()`).
   */
  get capabilities(): CapabilitySet {
    return probeCapabilities();
  },

  async install(projectRoot: string): Promise<InstallResult> {
    const briefing = appendBriefing(projectRoot);
    if (!briefing.ok) {
      return {
        briefing: { path: join(projectRoot, GENERIC_BRIEFING_FILE), skipped: true },
        capabilities: [],
        warnings: ['ADAPTER_INIT_FAILED'],
      };
    }
    const capabilities = [...probeCapabilities()];
    return { briefing: briefing.data, capabilities, warnings: ['ADVISORY_MODE'] };
  },

  async diagnose(projectRoot: string): Promise<DiagnosticResult> {
    const detected = detectHost(projectRoot);
    return {
      ok: true,
      adapter: GENERIC_ADAPTER_NAME,
      warnings: detected.warnings,
    };
  },

  onBeforeTool(tool: string, handler: PreToolHandler): void {
    // No hook support on a generic host (§5.3): registration is accepted and
    // ignored so callers need no host conditional. Enforcement is advisory.
    void tool;
    void handler;
  },

  onAfterTool(tool: string, handler: PostToolHandler): void {
    // Same no-op discipline as onBeforeTool.
    void tool;
    void handler;
  },

  hasCapability(name: string): boolean {
    return (GENERIC_BASELINE as ReadonlySet<string>).has(name);
  },
};
