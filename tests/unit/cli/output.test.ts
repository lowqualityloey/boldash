/**
 * MS-6 S1 (AC-2): the output kernel — envelope rendering, key stability,
 * quiet/verbose/color semantics. Docs contract: docs/cli-reference.md
 * §Output Contract / §Global Flags.
 */
import { describe, expect, it } from 'vitest';
import { render, sortDeep } from '../../../src/cli/output.js';
import type { IoStreams } from '../../../src/cli/output.js';
import type { GlobalFlags } from '../../../src/cli/types.js';

function collector() {
  const out: string[] = [];
  const err: string[] = [];
  const io: IoStreams = {
    write: (s) => out.push(s),
    writeErr: (s) => err.push(s),
    isTTY: false,
  };
  return { out, err, io };
}

const G = (over: Partial<GlobalFlags> = {}): GlobalFlags => ({
  format: 'json',
  quiet: false,
  verbose: false,
  cwd: '/nowhere',
  color: false,
  ...over,
});

describe('sortDeep (stable JSON, P1)', () => {
  it('sorts nested keys and keeps arrays ordered', () => {
    const sorted = sortDeep({ b: { z: 1, a: 2 }, a: [3, { y: 1, x: 2 }] }) as Record<
      string,
      unknown
    >;
    expect(Object.keys(sorted)).toEqual(['a', 'b']);
    expect(JSON.stringify(sorted)).toBe('{"a":[3,{"x":2,"y":1}],"b":{"a":2,"z":1}}');
  });
});

describe('render — json format (machine surface)', () => {
  it('writes a success envelope to stdout with sorted keys', () => {
    const c = collector();
    const code = render({ ok: true, data: { z: 1, a: 2 } }, G(), c.io);
    expect(code).toBe(0);
    expect(c.out.join('')).toBe('{"data":{"a":2,"z":1},"ok":true}\n');
    expect(c.err).toHaveLength(0);
  });

  it('writes failure envelopes to stdout, exit per catalog', () => {
    const c = collector();
    const code = render(
      {
        ok: false,
        error: { code: 'CLI_USAGE', message: 'nope' },
      },
      G(),
      c.io,
    );
    expect(code).toBe(2);
    expect(JSON.parse(c.out[0] ?? '{}')).toMatchObject({
      ok: false,
      error: { code: 'CLI_USAGE', message: 'nope' },
    });
  });

  it('CONCURRENT_MODIFICATION renders exit 4 per the errors map', () => {
    const c = collector();
    const code = render(
      { ok: false, error: { code: 'CONCURRENT_MODIFICATION', message: 'x' } },
      G(),
      c.io,
    );
    expect(code).toBe(4);
  });
});

describe('render — quiet / verbose / color', () => {
  it('--quiet suppresses success output in both formats', () => {
    const c = collector();
    const code = render({ ok: true, data: { a: 1 } }, G({ quiet: true }), c.io);
    expect(code).toBe(0);
    expect(c.out).toHaveLength(0);
  });

  it('--quiet never suppresses errors', () => {
    const c = collector();
    const code = render(
      { ok: false, error: { code: 'CLI_USAGE', message: 'm' } },
      G({ quiet: true }),
      c.io,
    );
    expect(code).toBe(2);
    expect(c.out.join('')).toContain('CLI_USAGE');
  });

  it('--verbose adds stderr lines only; stdout stays machine-clean', () => {
    const c = collector();
    render({ ok: true, data: { a: 1 } }, G({ verbose: true }), c.io, ['one', 'two']);
    expect(c.out.join('')).toBe('{"data":{"a":1},"ok":true}\n');
    expect(c.err.join('')).toBe('[verbose] one\n[verbose] two\n');
  });

  it('human format on a TTY with color emits ANSI; --no-color does not', () => {
    const ttyIo = (color: boolean): { got(): string } => {
      let text = '';
      render(
        { ok: false, error: { code: 'CLI_USAGE', message: 'm' } },
        G({ format: 'human', color }),
        { write: (s) => (text += s), writeErr: () => {}, isTTY: true },
      );
      return { got: () => text };
    };
    expect(ttyIo(true).got()).toContain('\u001b[31m');
    expect(ttyIo(false).got()).not.toContain('\u001b[');
  });

  it('human format never emits ANSI when the stream is not a TTY', () => {
    let text = '';
    const io: IoStreams = { write: (s) => (text += s), writeErr: () => {}, isTTY: false };
    render(
      { ok: true, data: { created: ['a', 'b'] } },
      G({ format: 'human', color: true }),
      io,
    );
    expect(text).not.toContain('\u001b[');
    expect(text).toContain('✓ ok');
  });
});
