/**
 * Declared-command runner (MS-5 slice 3).
 *
 * Provenance rule made physical: this module's input type is `CommandCheck`
 * (or `CommandFailsCheck`) — a shape that only exists after validation
 * against done.schema.json. There is no entry point that takes a loose string
 * (FMEA row 5 / SECURITY.md §1: "only commands written here may ever be
 * executed"). Tests that want to prove this call through the types.
 *
 * Timeout mechanics: the child is its own process group leader (`detached`),
 * so hanging commands with children die whole — SIGTERM, 2 s grace, SIGKILL.
 * A killed-by-timeout run is a FACT recorded in evidence with timedOut: true,
 * which the gate aggregates into exit 12 (docs/errors.md).
 */

import { spawn } from 'node:child_process';
import type { CommandCheck, CommandFailsCheck } from './types.js';

export const DEFAULT_COMMAND_TIMEOUT_MS = 300_000; // verification-guide Rule 4
export const OUTPUT_CAP_BYTES = 1_048_576; // 1 MiB per stream; marker appended on truncate

export interface CommandRun {
  /** null when killed before exit. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** true when either stream hit OUTPUT_CAP_BYTES. */
  truncated: boolean;
  duration_ms: number;
}

type RunCheck = Pick<CommandCheck | CommandFailsCheck, 'run' | 'timeout_ms'>;

const TRUNCATION_MARKER = '\n…[output truncated at 1 MiB cap]';

export async function runDeclaredCommand(
  check: RunCheck,
  cwd: string,
  opts: { deadlineGraceMs?: number } = {},
): Promise<CommandRun> {
  const timeoutMs = check.timeout_ms ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const graceMs = opts.deadlineGraceMs ?? 2_000;
  const started = Date.now();

  return await new Promise<CommandRun>((resolve) => {
    // Shell semantics are the contract's own words (`npm test -- --grep …`);
    // the string arrived typed+validated, and `cwd` anchors the workdir.
    const child = spawn('bash', ['-c', check.run], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BOLDASH_VERIFY_RUN: '1' },
    });

    let out = '';
    let errText = '';
    let outCap = false;
    let errCap = false;
    let timedOut = false;
    let settled = false;

    const take = (
      chunk: Buffer | string,
      existing: string,
      capped: boolean,
    ): [string, boolean] => {
      if (capped) return [existing, true];
      const text = existing + chunk.toString();
      if (text.length >= OUTPUT_CAP_BYTES) {
        return [text.slice(0, OUTPUT_CAP_BYTES) + TRUNCATION_MARKER, true];
      }
      return [text, false];
    };

    child.stdout?.on('data', (c: Buffer) => {
      [out, outCap] = take(c, out, outCap);
    });
    child.stderr?.on('data', (c: Buffer) => {
      [errText, errCap] = take(c, errText, errCap);
    });

    const killer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
      setTimeout(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, graceMs).unref();
    }, timeoutMs);
    killer.unref();

    const finish = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(killer);
      resolve({
        exitCode,
        stdout: out,
        stderr: errText,
        timedOut,
        truncated: outCap || errCap,
        duration_ms: Date.now() - started,
      });
    };

    child.on('error', () => finish(null));
    child.on('close', (code) => finish(timedOut ? null : code));
  });
}
