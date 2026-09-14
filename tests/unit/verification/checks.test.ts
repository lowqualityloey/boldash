import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck } from '../../../src/core/verification/checks.js';
import { EvidenceStore } from '../../../src/core/verification/evidence.js';
import { FixedClock } from '../../../src/shared/clock.js';
import type { VerifyEnv } from '../../../src/core/verification/types.js';
import type { Task } from '../../../src/core/state/types.js';

/**
 * PASS *and* BLOCK per check type (AGENTS: a gate that only passes is not a
 * gate). Real temp project dirs; real bash. The EvidenceStore is the real
 * writer, so command outcomes also exercise redaction + ids end-to-end.
 */
let dir: string;
let store: EvidenceStore;
let task: Task;
const mkTask = (): Task => ({
  schema_version: 1,
  id: 'TASK-010',
  title: 'x',
  type: 'feature',
  risk: 'medium',
  level: 2,
  status: 'verifying',
  requirements: [{ id: 'R1', text: 'ok' }],
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

function env(overrides: Partial<VerifyEnv> = {}): VerifyEnv {
  const all = store.readIndex().filter((e) => e.task === task.id);
  return {
    cwd: dir,
    task,
    evidenceKinds: new Set(all.map((e) => e.kind)),
    evidenceEntries: all,
    ...overrides,
  };
}

const run = (check: Parameters<typeof runCheck>[0], e = env()) =>
  runCheck(check, { env: e, evidence: store });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-checks-'));
  store = new EvidenceStore(join(dir, '.boldash'), new FixedClock());
  task = mkTask();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file_exists', () => {
  it('PASS present / BLOCK missing / BLOCK escape', async () => {
    writeFileSync(join(dir, 'a.txt'), 'x');
    expect(
      (await run({ type: 'file_exists', name: 'a present', path: 'a.txt' })).outcome.pass,
    ).toBe(true);
    expect(
      (await run({ type: 'file_exists', name: 'b present', path: 'b.txt' })).outcome.pass,
    ).toBe(false);
    const escape = await run({
      type: 'file_exists',
      name: 'outside',
      path: '../../etc/passwd',
    });
    expect(escape.outcome.pass).toBe(false);
    expect(escape.outcome.detail).toContain('escapes');
  });
});

describe('regex_in_file', () => {
  it('PASS match / BLOCK non-match / BLOCK invalid regex / BLOCK missing file', async () => {
    writeFileSync(join(dir, 'src.ts'), 'registerCallback(handler);');
    expect(
      (
        await run({
          type: 'regex_in_file',
          name: 'cb wired',
          path: 'src.ts',
          pattern: 'registerCallback\\(',
        })
      ).outcome.pass,
    ).toBe(true);
    expect(
      (
        await run({
          type: 'regex_in_file',
          name: 'cb wired',
          path: 'src.ts',
          pattern: 'noSuchThing',
        })
      ).outcome.pass,
    ).toBe(false);
    const bad = await run({
      type: 'regex_in_file',
      name: 'bad pattern here',
      path: 'src.ts',
      pattern: '(unclosed',
    });
    expect(bad.outcome.pass).toBe(false);
    expect(bad.outcome.error?.code).toBe('VERIFY_CONTRACT_INVALID');
    expect(
      (
        await run({
          type: 'regex_in_file',
          name: 'gone file here',
          path: 'nope.ts',
          pattern: 'x',
        })
      ).outcome.pass,
    ).toBe(false);
  });
});

describe('state_check', () => {
  it('PASS true expression / BLOCK false / BLOCK grammar rejection carries error', async () => {
    expect(
      (
        await run({
          type: 'state_check',
          name: 'not critical',
          check: "state.task.risk != 'critical'",
        })
      ).outcome.pass,
    ).toBe(true);
    expect(
      (
        await run({
          type: 'state_check',
          name: 'is docs type',
          check: "state.task.type == 'docs'",
        })
      ).outcome.pass,
    ).toBe(false);
    const junk = await run({
      type: 'state_check',
      name: 'junk expression',
      check: 'rm -rf /',
    });
    expect(junk.outcome.pass).toBe(false);
    expect(junk.outcome.error?.code).toBe('VERIFY_CONTRACT_INVALID');
  });
});

describe('evidence_exists', () => {
  it('PASS when kind recorded / BLOCK when absent — fresh env each time', async () => {
    expect(
      (await run({ type: 'evidence_exists', name: 'review attached', path: 'review' }))
        .outcome.pass,
    ).toBe(false);
    store.record({ kind: 'review', task: task.id, summary: 'lgtm' });
    const r = await run({
      type: 'evidence_exists',
      name: 'review attached',
      path: 'review',
    });
    expect(r.outcome.pass).toBe(true);
  });

  it('corrupt index cannot masquerade as empty kinds (gate preflight owns it; env injected)', async () => {
    writeFileSync(join(dir, '.boldash-bogus'), ''); // keep dir stable; corrupt the real index below
    mkdirSync(join(dir, '.boldash', 'state'), { recursive: true });
    writeFileSync(
      join(dir, '.boldash', 'state', 'evidence.json'),
      '{"schema_version":42}',
    );
    expect(() => store.readIndex()).toThrow(/rejected/); // env() would throw before any check runs
  });
});

describe('command (PASS and BLOCK and TIMEOUT)', () => {
  it('exit 0 passes with test-run evidence; exit 1 blocks with captured output', async () => {
    const pass = await run({ type: 'command', name: 'truth command', run: 'echo hello' });
    expect(pass.outcome.pass).toBe(true);
    expect(pass.outcome.evidenceId).toBe('EVID-test-run-1');
    const ev = JSON.parse(
      (await import('node:fs')).readFileSync(
        join(dir, '.boldash', 'evidence', 'TASK-010', 'test-run-1.json'),
        'utf8',
      ),
    );
    expect(ev.stdout).toContain('hello');

    const block = await run({ type: 'command', name: 'false command', run: 'exit 3' });
    expect(block.outcome.pass).toBe(false);
    expect(block.outcome.detail).toContain('exit 3');
    expect(block.outcome.evidenceId).toBe('EVID-test-run-2');
  });

  it('timeout kills the group: timedOut fact, exit-12 error attached, evidence recorded', async () => {
    const r = await run({
      type: 'command',
      name: 'hanging command',
      run: 'sleep 30',
      timeout_ms: 1000,
    });
    expect(r.timedOut).toBe(true);
    expect(r.outcome.pass).toBe(false);
    expect(r.outcome.error?.code).toBe('VERIFY_COMMAND_TIMEOUT');
    expect(r.outcome.evidenceId).toBeDefined();
  }, 20_000);

  it('secret in captured output redacts into evidence, never raw', async () => {
    const r = await run({
      type: 'command',
      name: 'leaky command runs here',
      run: 'echo \'token = "s3cr3t-value"\'',
    });
    expect(r.outcome.pass).toBe(true);
    const { readFileSync } = await import('node:fs');
    const ev = readFileSync(
      join(dir, '.boldash', 'evidence', 'TASK-010', 'test-run-1.json'),
      'utf8',
    );
    expect(ev).not.toContain('s3cr3t-value');
    expect(ev).toContain('[REDACTED]');
  });

  it('stdout and stderr are redacted independently: clean stdout survives a stderr secret', async () => {
    const r = await run({
      type: 'command',
      name: 'mixed stream command',
      run: 'echo "all good on out"; echo "api_key = \\"bad-value\\"" >&2',
    });
    expect(r.outcome.pass).toBe(true); // exit 0, both streams redactable
    const { readFileSync } = await import('node:fs');
    const ev = JSON.parse(
      readFileSync(
        join(dir, '.boldash', 'evidence', 'TASK-010', 'test-run-1.json'),
        'utf8',
      ),
    );
    expect(ev.stdout).toContain('all good on out'); // NOT blanked by the stderr side
    expect(ev.stderr_tail).toContain('[REDACTED]');
    expect(JSON.stringify(ev)).not.toContain('bad-value');
    expect(ev.redaction_count).toBeGreaterThanOrEqual(1);
  });
});

describe('must_not checks (inversion)', () => {
  it('command_fails: non-zero passes, exit 0 inverts to BLOCK', async () => {
    expect(
      (await run({ type: 'command_fails', name: 'linter silent runs', run: 'exit 2' }))
        .outcome.pass,
    ).toBe(true);
    const inverted = await run({
      type: 'command_fails',
      name: 'linter silent runs',
      run: 'exit 0',
    });
    expect(inverted.outcome.pass).toBe(false);
    expect(inverted.outcome.detail).toContain('INVERTED');
  });

  it('file_not_modified: fail-closed without baseline; PASS on match; BLOCK on drift', async () => {
    writeFileSync(join(dir, 'schema.sql'), 'v1');
    const noBase = await run({
      type: 'file_not_modified',
      name: 'schema untouched',
      path: 'schema.sql',
    });
    expect(noBase.outcome.pass).toBe(false);
    expect(noBase.outcome.detail).toContain('no baseline');

    const hash = `sha256:${createHash('sha256').update(Buffer.from('v1')).digest('hex')}`;
    store.record({
      kind: 'file-baseline',
      task: task.id,
      summary: 'entry',
      fields: { path: 'schema.sql', hash },
    });
    expect(
      (
        await run({
          type: 'file_not_modified',
          name: 'schema untouched',
          path: 'schema.sql',
        })
      ).outcome.pass,
    ).toBe(true);

    writeFileSync(join(dir, 'schema.sql'), 'v2-dirty');
    const drifted = await run({
      type: 'file_not_modified',
      name: 'schema untouched',
      path: 'schema.sql',
    });
    expect(drifted.outcome.pass).toBe(false);
    expect(drifted.outcome.detail).toContain('modified');
  });
});
