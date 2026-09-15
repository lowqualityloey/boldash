/**
 * Host-adapter contract (ARCHITECTURE.md §5.2, verbatim shape).
 *
 * Adapters are the ONLY place that knows about a specific agent host
 * (architecture rule 8 — `src/core/` must never import this directory).
 * v0.1.0 ships the generic adapter only (`generic.ts`); per-host adapters
 * are Phase 2/3 scope and must pass `contract-suite.ts` before they land.
 */

/**
 * Every capability the §5.3 matrix names. The union is closed: a pack that
 * requires a name outside this set fails closed as unavailable (router
 * `hasCapability` returns false for unknown names), and the adapter suite
 * proves this list covers every matrix row by parsing the document.
 */
export const ALL_CAPABILITIES = [
  'filesystem.read',
  'filesystem.write',
  'shell.execute',
  'git.read',
  'git.commit',
  'git.branch',
  'git.worktree',
  'github',
  'mcp',
  'subagents',
  'human_approval',
  'pre_tool_hooks',
  'post_tool_hooks',
] as const;

/** A capability name from the §5.3 matrix. */
export type CapabilityName = (typeof ALL_CAPABILITIES)[number];

/** The set of capabilities a probed host provides. */
export type CapabilitySet = ReadonlySet<CapabilityName>;

/** Result of host detection (`detectHost`). */
export interface DetectResult {
  /** Adapter selected to serve this project. Always `generic` in v0.1.0. */
  adapter: string;
  /**
   * Best-effort hint of the surrounding host (e.g. `claude`), used only to
   * name it in the `HOST_UNKNOWN` warning. Never trusted for enforcement.
   */
  detectedName?: string;
  /** Whether `cwd` sits inside a git working tree (`.git` present). */
  gitRepo: boolean;
  /** Warning codes for the CLI envelope (`HOST_UNKNOWN`, advisory mode). */
  warnings: string[];
}

/** Result of briefing-file installation (`appendBriefing` / `install`). */
export interface BriefingResult {
  /** Absolute path of the briefing file. */
  path: string;
  /** True when the block was already present and nothing was written. */
  skipped: boolean;
}

/** Result of `install` (ARCH §5.2). */
export interface InstallResult {
  briefing: BriefingResult;
  capabilities: CapabilityName[];
  warnings: string[];
}

/** Result of `diagnose` (ARCH §5.2). */
export interface DiagnosticResult {
  ok: boolean;
  adapter: string;
  warnings: string[];
}

/** Handler invoked before a host tool executes; return false to block it. */
export type PreToolHandler = (tool: string) => boolean;

/** Handler invoked after a host tool executes; used for evidence capture. */
export type PostToolHandler = (tool: string) => void;

/**
 * Every adapter implements this interface (ARCH §5.2).
 *
 * Honesty rule (AGENTS.md): declare capabilities the host truly provides.
 * A host without `pre_tool_hooks` serves in advisory mode — it can warn,
 * log, and report, but never block.
 */
export interface HostAdapter {
  /** Adapter identifier, e.g. "claude", "cursor", "generic". */
  readonly name: string;

  /** Capabilities this host provides. Populated by probing or declared statically. */
  readonly capabilities: CapabilitySet;

  /** Called once during `boldash init`. Writes host-specific briefing files. */
  install(projectRoot: string): Promise<InstallResult>;

  /** Called during `boldash doctor`. Verifies the host is still healthy. */
  diagnose(projectRoot: string): Promise<DiagnosticResult>;

  /**
   * Register a hook that runs before a host tool executes.
   * Returns false to block the tool.
   * Hosts without hook support return a no-op.
   */
  onBeforeTool(tool: string, handler: PreToolHandler): void;

  /**
   * Register a hook that runs after a host tool executes.
   * Used for evidence capture.
   */
  onAfterTool(tool: string, handler: PostToolHandler): void;

  /** Returns true if the host supports the named capability. */
  hasCapability(name: string): boolean;
}
