/**
 * Help text generation — derived from the same registry data as the parser,
 * so help can never drift from what argv actually accepts.
 * AC-3 budget (RFC §1.2 / P9): root help ≤200 tokens, command help ≤40;
 * approximated as whitespace-separated words (deterministic, tested).
 */
import type { CommandSpec } from './types.js';

/** Approximate token count: whitespace-delimited words. */
export function tokenCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Root help: usage, one line per registered command, compact global flags.
 * Only implemented (runner-bearing) commands are listed — the CLI never
 * advertises a surface it cannot honor.
 */
export function rootHelp(registry: readonly CommandSpec[], version: string): string {
  const lines = [
    'boldash — deterministic control plane for AI coding agents',
    '',
    `Usage: boldash <command> [options]   (v${version})`,
    '',
    'Commands:',
    ...registry.map((c) => `  ${pad(c.name)}${c.summary}`),
    '',
    'Flags:',
    '  --format human|json   Output format (default: human).',
    '  --quiet  --verbose    Output control.',
    '  --cwd <path>          Working directory.',
    '  --config <path>  --no-color',
    '  --help   --version',
  ];
  return `${lines.join('\n')}\n`;
}

const pad = (name: string): string =>
  `${name}${' '.repeat(Math.max(2, 12 - name.length))}`;

/**
 * Command help: usage line, summary, flag table — terse by contract (AC-3:
 * ≤40 tokens). Global flags are documented only in root help, never repeated.
 */
export function commandHelp(spec: CommandSpec): string {
  const subs = spec.subcommands ?? [];
  const lines = [
    `Usage: boldash ${spec.name}${subs.length ? ' <subcommand>' : ''} [options]`,
    spec.summary,
    ...(subs.length
      ? ['', 'Subcommands:', ...subs.map((s) => `  ${pad(s.name)}${s.summary}`)]
      : []),
    '',
    'Options:',
    ...spec.flags.map((f) => `  --${f.name}${f.takesValue ? ' <v>' : ''}  ${f.help}`),
  ];
  return `${lines.join('\n')}\n`;
}
