#!/usr/bin/env node
/**
 * CLI entry point (MS-6 S1). Top-level await is permitted only here
 * (AGENTS.md §Language and runtime). `run()` is exported and stream-injected
 * so golden tests can exercise the whole dispatch path without spawning;
 * tests/golden additionally spawns the built bin to prove the packaging.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from './argv.js';
import { REGISTRY } from './commands/index.js';
import { commandHelp, rootHelp } from './help.js';
import { processStreams, render } from './output.js';
import type { IoStreams } from './output.js';
import type { Envelope, GlobalFlags } from './types.js';

/** Package version, read from the repository package.json (dist-safe path). */
export function boldashVersion(): string {
  const pkg = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return pkg.version;
}

/** Base globals for rendering errors raised before parsing completed. */
function baseGlobals(): GlobalFlags {
  return {
    format: 'human',
    quiet: false,
    verbose: false,
    cwd: process.cwd(),
    color: true,
  };
}

/**
 * A failed parse loses the partial flags it saw, but `--format json` before
 * the offending token must still yield a machine envelope — pre-scan it.
 * (--quiet only suppresses success output, so it is irrelevant here.)
 */
function detectFormat(argv: readonly string[]): GlobalFlags {
  const g = baseGlobals();
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === '--format' && argv[i + 1] === 'json') g.format = 'json';
    else if (tok === '--format=json') g.format = 'json';
    else if (tok === '--no-color') g.color = false;
  }
  return g;
}

function usageError(message: string, suggestion: string): Envelope {
  return {
    ok: false,
    error: {
      code: 'CLI_USAGE',
      message,
      field: 'command',
      suggestion,
      context: { supported_commands: REGISTRY.map((c) => c.name) },
    },
  };
}

/**
 * Parse, dispatch, render. Returns the process exit code (docs/errors.md map).
 * Never throws: a runner bug surfaces as INTERNAL_ERROR + exit 10.
 * Async: `verify` awaits the verification engine (declared commands).
 */
export async function run(
  argv: readonly string[],
  io: IoStreams = processStreams(),
): Promise<number> {
  const parsed = parseArgs(argv, REGISTRY);
  if (!parsed.ok) {
    return render({ ok: false, error: parsed.error }, detectFormat(argv), io);
  }
  const { globals, command, sub, help, version } = parsed.data;

  if (version && !command) {
    const v = boldashVersion();
    if (globals.format === 'json') {
      return render({ ok: true, data: { name: 'boldash', version: v } }, globals, io);
    }
    if (!globals.quiet) io.write(`boldash ${v}\n`);
    return 0;
  }
  if (help) {
    const target = sub ?? command;
    const text = target ? commandHelp(target) : rootHelp(REGISTRY, boldashVersion());
    if (!globals.quiet) io.write(text);
    return 0;
  }
  const runner = sub?.run ?? command?.run;
  if (!command || !runner) {
    return render(
      usageError('A command is required.', 'Run `boldash --help` to list commands.'),
      globals,
      io,
    );
  }
  let envelope: Envelope;
  try {
    const spec = sub ?? command;
    let stdinText: string | undefined;
    envelope = await runner({
      globals,
      flags: parsed.data.flags,
      positionals: parsed.data.positionals,
      ...(sub ? { sub } : {}),
      ...(spec?.readsStdin
        ? {
            stdin: () => {
              if (stdinText === undefined) stdinText = readFileSync(0, 'utf8');
              return stdinText;
            },
            stdinIsTty: process.stdin.isTTY === true,
          }
        : {}),
    });
  } catch (cause) {
    // A thrown runner is a bug, not user input: never leak a stack trace as
    // the only signal — render the catalog error and exit 10 (P10).
    envelope = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: String(cause) },
    };
  }
  const verboseLines = globals.verbose
    ? [`argv=${JSON.stringify(argv)}`, `cwd=${globals.cwd}`, `ok=${envelope.ok}`]
    : [];
  return render(envelope, globals, io, verboseLines);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  process.exitCode = await run(process.argv.slice(2));
}
