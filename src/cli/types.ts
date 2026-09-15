/**
 * CLI-layer shared types (MS-6 S1).
 * The envelope shapes mirror the Output Contract in docs/cli-reference.md:
 * stdout always carries `{ok:true,data}` or `{ok:false,error}` under
 * `--format json`; ErrorInfo is the single error shape (docs/errors.md).
 */
import type { ErrorInfo } from '../shared/result.js';

/** Output format selected via `--format`. */
export type OutputFormat = 'human' | 'json';

/** Resolved global flags (docs/cli-reference.md §Global Flags). */
export interface GlobalFlags {
  format: OutputFormat;
  quiet: boolean;
  verbose: boolean;
  /** Absolute, resolved against process.cwd() when `--cwd` is relative. */
  cwd: string;
  config?: string;
  color: boolean;
}

/** A parsed command line ready for dispatch. */
export interface ParsedInvocation {
  globals: GlobalFlags;
  /** Top-level command, when one was given. */
  command?: CommandSpec;
  /** Matched subcommand, when the command has one. */
  sub?: CommandSpec;
  /** Command/sub-level flags by long name (value or true). */
  flags: Record<string, string | boolean>;
  /** Remaining positional arguments. */
  positionals: string[];
  /** `--help` appeared at the deepest matched level (or root). */
  help: boolean;
  /** `--version` appeared with no command. */
  version: boolean;
}

/** Engine-independent success/failure payload written to stdout. */
export type Envelope = { ok: true; data: unknown } | { ok: false; error: ErrorInfo };

/** Execution context handed to a command runner. */
export interface RunContext {
  globals: GlobalFlags;
  flags: Record<string, string | boolean>;
  positionals: string[];
  sub?: CommandSpec;
}

/** A command's entry point. Runners must not throw; they return envelopes. */
export type CommandRunner = (ctx: RunContext) => Envelope;

/** Declarative flag spec used by both the parser and the help generator. */
export interface FlagSpec {
  name: string;
  takesValue: boolean;
  /** When set, the value must be one of these (case-sensitive). */
  values?: readonly string[];
  help: string;
}

/** Declarative command registry entry (ADR-0004: data-driven argv). */
export interface CommandSpec {
  name: string;
  /** One-line summary shown in root help. Kept short (AC-3 token budget). */
  summary: string;
  /** Longer description shown in command help; optional. */
  description?: string;
  flags: FlagSpec[];
  subcommands?: CommandSpec[];
  /** Absent = command defined but not yet wired (never registered in S1+). */
  run?: CommandRunner;
}
