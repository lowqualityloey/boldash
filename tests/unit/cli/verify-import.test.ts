/**
 * MS-6 S4 unit tests: `verify TASK|--all` cold path + `workflow import` stub.
 * Every guard exercised PASS and BLOCK through the CLI runners (AC-5); the
 * import never copies runnable `command` checks (conservative stub).
 */
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldProjectState, TaskStore } from '../../../src/core/state/index.js';
import type { Task } from '../../../src/core/state/index.js';
import { FixedClock } from '../../../src/shared/clock.js';
import { exitCodeFor } from '../../../src/shared/errors.js';
import { runVerify } from '../../../src/cli/commands/verify.js';
import { runWorkflowImport } from '../../../src/cli/commands/workflow.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';

let dir: string;
let clock: FixedClock;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-cli-s4-'));
  clock = new FixedClock();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ctx(
  flags: Record<string, string | boolean> = {},
  positionals: string[] = [],
): RunContext {
  return {
    globals: { format: 'json', quiet: false, verbose: false, cwd: dir, color: true },
    flags,
    positionals,
  };
}

function store(): TaskStore {
  const boldash = join(dir, '.boldash');
  return new TaskStore(
    {
      stateFile: join(boldash, 'state', 'tasks.json'),
      eventsFile: join(boldash, 'events.jsonl'),
    },
    clock,
  );
}

function initBoldash(): void {
  const r = scaffoldProjectState(
    { boldashDir: join(dir, '.boldash'), profile: 'balanced' },
    clock,
  );
  if (!r.ok) throw new Error(`scaffold failed: ${r.error.message}`);
}

function seedTask(workflow = 'feature'): Task {
  const s = store();
  const created = s.create(
    {
      title: 'T',
      type: 'feature',
      risk: 'low',
      level: 1,
      ...(workflow ? { workflow } : {}),
    },
    'seed',
  );
  if (!created.ok) throw new Error(created.error.message);
  const withReq = s.addRequirement(
    created.data.id,
    { id: 'R1', text: 'does it' },
    created.data.version,
    'seed',
  );
  if (!withReq.ok) throw new Error(withReq.error.message);
  const planned = s.transition(withReq.data.id, 'planned', withReq.data.version, 'seed');
  if (!planned.ok) throw new Error(planned.error.message);
  const verifying = s.transition(
    planned.data.id,
    'implementing',
    planned.data.version,
    'seed',
  );
  if (!verifying.ok) throw new Error(verifying.error.message);
  const v2 = s.transition(verifying.data.id, 'verifying', verifying.data.version, 'seed');
  if (!v2.ok) throw new Error(v2.error.message);
  return v2.data;
}

function writeContract(contract: unknown, workflow = 'feature'): void {
  const packDir = join(dir, '.boldash', 'workflows', workflow);
  mkdirSync(packDir, { recursive: true });
  writeFileSync(join(packDir, 'done.schema.json'), JSON.stringify(contract), 'utf8');
}

function err(e: Envelope): { code: string; field?: string } {
  if (e.ok) throw new Error('expected failure envelope');
  return e.error;
}

describe('verify (S4)', () => {
  it('VERIFIED exit 0 on a passing file_exists contract + logs verify.run', async () => {
    initBoldash();
    const task = seedTask();
    writeFileSync(join(dir, 'present.txt'), 'here\n', 'utf8');
    writeContract({
      task_id: '{{task_id}}',
      must_pass: [{ type: 'file_exists', name: 'present file', path: 'present.txt' }],
    });
    const out = await runVerify(ctx({}, [task.id]));
    expect(out.ok).toBe(true);
    const events = readFileSync(join(dir, '.boldash', 'events.jsonl'), 'utf8');
    expect(events).toContain('verify.run');
  });

  it('BLOCKED exit 1 when a check fails (gate blocks, not warns)', async () => {
    initBoldash();
    const task = seedTask();
    writeContract({
      task_id: '{{task_id}}',
      must_pass: [{ type: 'file_exists', name: 'missing file', path: 'nope.txt' }],
    });
    const out = await runVerify(ctx({}, [task.id]));
    expect(err(out).code).toBe('VERIFY_BLOCKED');
    expect(exitCodeFor('VERIFY_BLOCKED')).toBe(1);
  });

  it('missing contract maps to VERIFY_CONTRACT_INVALID exit 2 (no skip)', async () => {
    initBoldash();
    const task = seedTask();
    const out = await runVerify(ctx({}, [task.id]));
    expect(err(out).code).toBe('VERIFY_CONTRACT_INVALID');
    expect(exitCodeFor('VERIFY_CONTRACT_INVALID')).toBe(2);
  });

  it('unbound task (no workflow) refuses with VERIFY_CONTRACT_INVALID', async () => {
    initBoldash();
    const s = store();
    const created = s.create(
      { title: 'T', type: 'feature', risk: 'low', level: 1 },
      'seed',
    );
    if (!created.ok) throw new Error(created.error.message);
    const out = await runVerify(ctx({}, [created.data.id]));
    expect(err(out).code).toBe('VERIFY_CONTRACT_INVALID');
  });

  it('unknown task id maps to STATE_TASK_NOT_FOUND exit 2', async () => {
    initBoldash();
    expect(err(await runVerify(ctx({}, ['TASK-404']))).code).toBe('STATE_TASK_NOT_FOUND');
  });

  it('timeout exit 12 with a real short-timeout command check', async () => {
    initBoldash();
    const task = seedTask();
    writeContract({
      task_id: '{{task_id}}',
      must_pass: [
        { type: 'command', name: 'hangs briefly', run: 'sleep 5', timeout_ms: 1000 },
      ],
    });
    const out = await runVerify(ctx({}, [task.id]));
    expect(err(out).code).toBe('VERIFY_COMMAND_TIMEOUT');
    expect(exitCodeFor('VERIFY_COMMAND_TIMEOUT')).toBe(12);
  });

  it('--all verifies every verifying task; empty set is ok true exit 0', async () => {
    initBoldash();
    const empty = await runVerify(ctx({ all: true }));
    expect(empty.ok).toBe(true);
    expect((empty as { ok: true; data: { total: number } }).data.total).toBe(0);

    const task = seedTask();
    writeFileSync(join(dir, 'present.txt'), 'x', 'utf8');
    writeContract({
      task_id: '{{task_id}}',
      must_pass: [{ type: 'file_exists', name: 'present file', path: 'present.txt' }],
    });
    const all = await runVerify(ctx({ all: true }));
    expect(all.ok).toBe(true);
    expect((all as { ok: true; data: { verified: string[] } }).data.verified).toContain(
      task.id,
    );
  });

  it('--all blocks (exit 1) when any verifying task fails', async () => {
    initBoldash();
    seedTask();
    writeContract({
      task_id: '{{task_id}}',
      must_pass: [{ type: 'file_exists', name: 'missing file', path: 'nope.txt' }],
    });
    expect(err(await runVerify(ctx({ all: true }))).code).toBe('VERIFY_BLOCKED');
  });

  it('usage: no id and no --all, or --all with an id, are CLI_USAGE', async () => {
    initBoldash();
    expect(err(await runVerify(ctx())).code).toBe('CLI_USAGE');
    expect(err(await runVerify(ctx({ all: true }, ['TASK-001']))).code).toBe('CLI_USAGE');
  });

  it('precondition without .boldash/', async () => {
    expect(err(await runVerify(ctx({}, ['TASK-001']))).code).toBe(
      'CLI_PRECONDITION_FAILED',
    );
  });
});

describe('workflow import (S4)', () => {
  it('imports a pack file: writes stub contract + manifest, reports', () => {
    initBoldash();
    const src = join(dir, 'pack.json');
    writeFileSync(
      src,
      JSON.stringify({
        name: 'review-flow',
        description: 'Review pack',
        lifecycle: 'VERIFY',
        requires: ['filesystem.read'],
        optional: [],
      }),
      'utf8',
    );
    const out = runWorkflowImport(ctx({}, [src]));
    expect(out.ok).toBe(true);
    const data = (out as { ok: true; data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      imported: true,
      workflow: 'review-flow',
      stubbed: true,
      skipped_commands: 0,
    });
    expect(
      existsSync(join(dir, '.boldash', 'workflows', 'review-flow', 'done.schema.json')),
    ).toBe(true);
    expect(
      existsSync(join(dir, '.boldash', 'workflows', 'review-flow', 'manifest.json')),
    ).toBe(true);
  });

  it('strips runnable command checks (conservative stub) and counts them', () => {
    initBoldash();
    const src = join(dir, 'risky.json');
    writeFileSync(
      src,
      JSON.stringify({
        task_id: '{{task_id}}',
        must_pass: [
          { type: 'command', name: 'run anything', run: 'rm -rf /tmp/x' },
          { type: 'file_exists', name: 'safe check', path: 'a.txt' },
        ],
      }),
      'utf8',
    );
    const out = runWorkflowImport(ctx({}, [src]));
    expect(out.ok).toBe(true);
    expect(
      (out as { ok: true; data: { skipped_commands: number } }).data.skipped_commands,
    ).toBe(1);
    const written = JSON.parse(
      readFileSync(
        join(dir, '.boldash', 'workflows', 'risky', 'done.schema.json'),
        'utf8',
      ),
    ) as {
      must_pass: Array<{ type: string }>;
    };
    expect(written.must_pass.every((c) => c.type !== 'command')).toBe(true);
  });

  it('missing path and bad JSON are exit-2 errors, never throws', () => {
    initBoldash();
    expect(err(runWorkflowImport(ctx({}, [join(dir, 'absent.json')]))).code).toBe(
      'VERIFY_CONTRACT_INVALID',
    );
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{', 'utf8');
    expect(err(runWorkflowImport(ctx({}, [bad]))).code).toBe('SCHEMA_PARSE');
    expect(err(runWorkflowImport(ctx())).code).toBe('CLI_USAGE');
  });

  it('capability-gated packs surface CAPABILITY_MISSING exit 3 without writing', () => {
    initBoldash();
    const src = join(dir, 'needy.json');
    writeFileSync(
      src,
      JSON.stringify({
        name: 'needy',
        requires: ['quantum-compute'],
        optional: [],
        description: 'Needs the future',
        lifecycle: 'BUILD',
      }),
      'utf8',
    );
    const out = runWorkflowImport(ctx({}, [src]));
    expect(err(out).code).toBe('CAPABILITY_MISSING');
    expect(exitCodeFor('CAPABILITY_MISSING')).toBe(3);
    expect(existsSync(join(dir, '.boldash', 'workflows', 'needy'))).toBe(false);
  });
});
