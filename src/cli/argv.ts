/**
 * Hand-rolled argv parser (ADR-0004 — no runtime dependency on a parser lib).
 * Driven entirely by the command registry: the same FlagSpec data powers
 * parsing and help, so the two can never disagree.
 *
 * Grammar: [globals/flags interleaved] <command> [<subcommand>] [flags] [positionals]
 * Unknown flag/command, missing value, or bad enum value ⇒ CLI_USAGE (exit 2).
 */
import { err, ok } from '../shared/result.js';
import type { Result } from '../shared/result.js';
import { resolve } from 'node:path';
import type { CommandSpec, FlagSpec, GlobalFlags, ParsedInvocation } from './types.js';

export const GLOBAL_FLAGS: FlagSpec[] = [
  {
    name: 'format',
    takesValue: true,
    values: ['human', 'json'],
    help: 'Output format. Default: human.',
  },
  { name: 'quiet', takesValue: false, help: 'Suppress non-error output.' },
  { name: 'verbose', takesValue: false, help: 'Include debug output.' },
  { name: 'cwd', takesValue: true, help: 'Working directory.' },
  { name: 'config', takesValue: true, help: 'Path to .boldash/config.yaml.' },
  { name: 'no-color', takesValue: false, help: 'Disable ANSI colors.' },
  { name: 'help', takesValue: false, help: 'Print help.' },
  { name: 'version', takesValue: false, help: 'Print version.' },
];

function usage(message: string, field: string, extra: Record<string, unknown> = {}) {
  return err({
    code: 'CLI_USAGE' as const,
    message,
    field,
    suggestion: 'Run `boldash --help` for usage.',
    ...(Object.keys(extra).length ? { context: extra } : {}),
  });
}

function matchFlag(name: string, specs: FlagSpec[]): FlagSpec | undefined {
  return specs.find((f) => f.name === name);
}

function validateValue(spec: FlagSpec, value: string): string | undefined {
  if (spec.values && !spec.values.includes(value)) {
    return `--${spec.name} must be one of: ${spec.values.join(', ')}.`;
  }
  return undefined;
}

/**
 * Parse `argv` (already stripped of `node script` prefixes) against a registry.
 * Returns a typed usage error — never throws — for anything unrecognized.
 */
export function parseArgs(
  argv: readonly string[],
  registry: readonly CommandSpec[],
): Result<ParsedInvocation> {
  const globals: GlobalFlags = {
    format: 'human',
    quiet: false,
    verbose: false,
    cwd: process.cwd(),
    color: true,
  };
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: CommandSpec | undefined;
  let sub: CommandSpec | undefined;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token === '--') {
      for (let j = i + 1; j < argv.length; j += 1) {
        const rest = argv[j];
        if (rest !== undefined) positionals.push(rest);
      }
      break;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      const name = eq >= 0 ? body.slice(0, eq) : body;
      const inline = eq >= 0 ? body.slice(eq + 1) : undefined;

      const global = matchFlag(name, GLOBAL_FLAGS);
      const cmdFlag = matchFlag(name, [
        ...(command?.flags ?? []),
        ...(sub?.flags ?? []),
        ...(command?.subcommands?.flatMap((s) => s.flags) ?? []),
      ]);
      const spec = global ?? cmdFlag;
      if (!spec) return usage(`Unknown flag '--${name}'.`, `--${name}`);

      let value: string | boolean = true;
      if (spec.takesValue) {
        if (inline !== undefined) {
          value = inline;
        } else {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith('--')) {
            return usage(`Flag '--${name}' requires a value.`, `--${name}`);
          }
          value = next;
          i += 1;
        }
        const bad = validateValue(spec, String(value));
        if (bad) return usage(bad, `--${name}`);
      } else if (inline !== undefined) {
        return usage(`Flag '--${name}' does not take a value.`, `--${name}`);
      }

      switch (name) {
        case 'format':
          globals.format = String(value) as GlobalFlags['format'];
          break;
        case 'quiet':
          globals.quiet = true;
          break;
        case 'verbose':
          globals.verbose = true;
          break;
        case 'cwd':
          globals.cwd = resolve(globals.cwd, String(value));
          break;
        case 'config':
          globals.config = String(value);
          break;
        case 'no-color':
          globals.color = false;
          break;
        case 'help':
          help = true;
          break;
        case 'version':
          version = true;
          break;
        default:
          flags[name] = value;
      }
      continue;
    }

    // bare token: command, then subcommand, then positional
    if (!command) {
      const found = registry.find((c) => c.name === token);
      if (!found) {
        return usage(`Unknown command '${token}'.`, token, {
          supported_commands: registry.map((c) => c.name),
        });
      }
      command = found;
      continue;
    }
    if (!sub && command.subcommands) {
      const subFound = command.subcommands.find((s) => s.name === token);
      if (subFound) {
        sub = subFound;
        continue;
      }
      return usage(`Unknown ${command.name} subcommand '${token}'.`, token, {
        supported_subcommands: command.subcommands.map((s) => s.name),
      });
    }
    positionals.push(token);
  }

  if (version && !command) {
    return ok({ globals, flags, positionals, help, version: true });
  }
  if (command && !command.run && !sub) {
    // command exists in the registry but is not wired yet — never shown in help
    return usage(`Command '${command.name}' is not available.`, command.name);
  }
  return ok({
    globals,
    flags,
    positionals,
    help,
    version: version && !command,
    ...(command ? { command } : {}),
    ...(sub ? { sub } : {}),
  });
}
