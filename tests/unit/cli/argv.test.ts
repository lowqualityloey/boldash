/**
 * MS-6 S1 (AC-4): argv parser — every branch unit-tested.
 * Same FlagSpec data drives parse and help (no drift possible by design).
 */
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../src/cli/argv.js';
import type { CommandSpec } from '../../../src/cli/types.js';

const noop = () => ({ ok: true as const, data: null });

const REGISTRY: CommandSpec[] = [
  {
    name: 'init',
    summary: 'Initialize.',
    flags: [
      {
        name: 'profile',
        takesValue: true,
        values: ['lite', 'balanced'],
        help: 'Profile.',
      },
      { name: 'force', takesValue: false, help: 'Overwrite.' },
    ],
    run: noop,
  },
  {
    name: 'state',
    summary: 'State ops.',
    flags: [],
    subcommands: [
      { name: 'get', summary: 'Read one.', flags: [], run: noop },
      { name: 'list', summary: 'Read all.', flags: [], run: noop },
    ],
    run: noop,
  },
];

function ok(argv: string[]) {
  const r = parseArgs(argv, REGISTRY);
  if (!r.ok)
    throw new Error(`expected parse success, got ${r.error.code}: ${r.error.message}`);
  return r.data;
}

describe('parseArgs — success paths', () => {
  it('parses a bare command', () => {
    const p = ok(['init']);
    expect(p.command?.name).toBe('init');
    expect(p.globals.format).toBe('human');
    expect(p.help).toBe(false);
    expect(p.version).toBe(false);
  });

  it('collects command flags and positionals after the command', () => {
    const p = ok(['init', '--profile', 'lite', '--force', 'extra']);
    expect(p.flags).toEqual({ profile: 'lite', force: true });
    expect(p.positionals).toEqual(['extra']);
  });

  it('accepts --flag=value form', () => {
    const p = ok(['init', '--profile=lite']);
    expect(p.flags.profile).toBe('lite');
  });

  it('accepts global flags before and after the command', () => {
    const p = ok(['--quiet', 'init', '--verbose']);
    expect(p.globals.quiet).toBe(true);
    expect(p.globals.verbose).toBe(true);
  });

  it('resolves --cwd against the current directory', () => {
    const p = ok(['--cwd', 'relative/dir', 'init']);
    expect(p.globals.cwd).toContain('relative/dir');
    expect(p.globals.cwd.startsWith('/')).toBe(true);
  });

  it('matches subcommands', () => {
    const p = ok(['state', 'get', 'TASK-001']);
    expect(p.command?.name).toBe('state');
    expect(p.sub?.name).toBe('get');
    expect(p.positionals).toEqual(['TASK-001']);
  });

  it('passes everything after -- as positionals', () => {
    const p = ok(['state', 'list', '--', '--force']);
    expect(p.positionals).toEqual(['--force']);
  });

  it('handles --help and --version flags', () => {
    expect(ok(['--help']).help).toBe(true);
    expect(ok(['init', '--help']).help).toBe(true);
    expect(ok(['--version']).version).toBe(true);
  });

  it('ignores --version when a command is present', () => {
    const p = ok(['init', '--version']);
    expect(p.version).toBe(false);
  });
});

describe('parseArgs — usage errors (exit 2)', () => {
  const errOf = (argv: string[]) => {
    const r = parseArgs(argv, REGISTRY);
    if (r.ok) throw new Error('expected parse failure');
    return r.error;
  };

  it('rejects unknown flags with field', () => {
    const e = errOf(['init', '--froce']);
    expect(e.code).toBe('CLI_USAGE');
    expect(e.field).toBe('--froce');
  });

  it('rejects unknown commands and lists supported', () => {
    const e = errOf(['nope']);
    expect(e.code).toBe('CLI_USAGE');
    expect(e.context?.supported_commands).toEqual(['init', 'state']);
  });

  it('rejects unknown subcommands', () => {
    const e = errOf(['state', 'frobnicate']);
    expect(e.code).toBe('CLI_USAGE');
    expect(e.context?.supported_subcommands).toEqual(['get', 'list']);
  });

  it('rejects a missing flag value', () => {
    expect(errOf(['init', '--profile']).message).toContain('requires a value');
  });

  it('rejects a value that looks like a flag', () => {
    expect(errOf(['--cwd', '--quiet', 'init']).code).toBe('CLI_USAGE');
  });

  it('enforces enum values for --format and command flags', () => {
    expect(errOf(['--format', 'yaml', 'init']).message).toContain('human, json');
    expect(errOf(['init', '--profile', 'turbo']).message).toContain('lite, balanced');
  });

  it('rejects --=value style on boolean flags', () => {
    expect(errOf(['init', '--force=yes']).message).toContain('does not take a value');
  });
});
