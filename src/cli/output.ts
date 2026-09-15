/**
 * Output formatting kernel (MS-6 S1) — the only place that touches stdout.
 *
 * Contract (docs/cli-reference.md §Output Contract):
 * - `--format json`: stable, sorted-key envelope JSON on stdout for BOTH
 *   success and failure; no ANSI ever.
 * - `--quiet`: suppress non-error output (success rendering).
 * - `--verbose`: extra lines on stderr only; stdout stays machine-clean.
 * - ANSI color only for human format, only when allowed (TTY, not --no-color).
 */
import { exitCodeFor } from '../shared/errors.js';
import type { ErrorCode } from '../shared/errors.js';
import type { ErrorInfo } from '../shared/result.js';
import type { Envelope, GlobalFlags } from './types.js';

/** Injectable streams for deterministic tests. */
export interface IoStreams {
  write(out: string): void;
  writeErr(out: string): void;
  isTTY: boolean;
}

export const processStreams = (): IoStreams => ({
  write: (o) => process.stdout.write(o),
  writeErr: (o) => process.stderr.write(o),
  isTTY: process.stdout.isTTY === true,
});

/** Recursively sort object keys so JSON output is byte-stable (P1). */
export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function colorize(text: string, code: string, g: GlobalFlags, io: IoStreams): string {
  return g.color && io.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function errorLines(error: ErrorInfo): string[] {
  return [
    `✗ ${error.code}: ${error.message}`,
    ...(error.field ? [`  field: ${error.field}`] : []),
    ...(error.suggestion ? [`  → ${error.suggestion}`] : []),
  ];
}

/**
 * Render one envelope to the streams and return the process exit code.
 * The envelope is the single output unit: never partial writes, never both.
 */
export function render(
  envelope: Envelope,
  globals: GlobalFlags,
  io: IoStreams,
  verboseLines: string[] = [],
): number {
  let code: number;
  if (envelope.ok) {
    code = 0;
    // --quiet suppresses non-error output (docs/cli-reference.md §Global
    // Flags) — including a JSON success envelope; exit code carries success.
    if (!globals.quiet) {
      io.write(
        globals.format === 'json'
          ? `${JSON.stringify(sortDeep(envelope))}\n`
          : humanSuccess(envelope.data, globals, io),
      );
    }
  } else {
    code = exitFor(envelope.error.code);
    io.write(
      globals.format === 'json'
        ? `${JSON.stringify(sortDeep(envelope))}\n`
        : `${colorize(errorLines(envelope.error).join('\n'), '31', globals, io)}\n`,
    );
  }
  if (globals.verbose) {
    for (const line of verboseLines) io.writeErr(`[verbose] ${line}\n`);
  }
  return code;
}

function humanSuccess(data: unknown, globals: GlobalFlags, io: IoStreams): string {
  const body =
    typeof data === 'object' && data !== null
      ? Object.entries(data as Record<string, unknown>)
          .map(([k, v]) =>
            Array.isArray(v)
              ? `${k}:\n${v.map((item) => `  ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')}`
              : `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`,
          )
          .join('\n')
      : String(data);
  return `${colorize('✓ ok', '32', globals, io)}\n${body}\n`;
}

function exitFor(code: ErrorCode): number {
  return exitCodeFor(code);
}
