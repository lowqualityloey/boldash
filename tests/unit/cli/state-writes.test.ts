/**
 * MS-6 S3 unit tests: state writes + the AC-8 file-baseline capture.
 * The capture tests are consumer-proven: after the CLI records baselines,
 * the VERIFICATION engine's own runCheck is executed against them —
 * PASS unmodified / BLOCK modified / BLOCK no-baseline — so the format is
 * proven against what actually consumes it, not against a mirror.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldProjectState, TaskStore } from '../../../src/core/state/index.js';
import type { Task } from '../../../src/core/state/index.js';
import { FixedClock } from '../../../src/shared/clock.js';
import {
  buildEnv,
  EvidenceStore,
  runCheck,
} from '../../../src/core/verification/index.js';
import {
  captureFileBaselines,
  runStateEvidence,
  runStateRequirement,
  runStateTransition,
} from '../../../src/cli/commands/state-writes.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';

let dir: string;
let clock: FixedClock;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-cli-writes-'));
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

function seedPlannedTask(withRequirement = false): Task {
  const s = store();
  const created = s.create(
    { title: 'T', type: 'feature', risk: 'low', level: 1, workflow: 'feature' },
    'seed',
  );
  if (!created.ok) throw new Error(created.error.message);
  if (withRequirement) {
    const req = s.addRequirement(
      created.data.id,
      { id: 'R1', text: 'does the thing' },
      created.data.version,
      'seed',
    );
    if (!req.ok) throw new Error(req.error.message);
  }
  const planned = s.transition(
    created.data.id,
    'planned',
    created.data.version + (withRequirement ? 1 : 0),
    'seed',
  );
  if (!planned.ok) throw new Error(planned.error.message);
  return planned.data;
}

function writeWorkflowContract(pack: unknown, workflow = 'feature'): void {
  const packDir = join(dir, '.boldash', 'workflows', workflow);
  mkdirSync(packDir, { recursive: true });
  writeFileSync(
    join(packDir, 'done.schema.json'),
    typeof pack === 'string' ? pack : JSON.stringify(pack),
    'utf8',
  );
}

const LOCKED = 'protected/lock.md';
const CONTRACT = {
  task_id: '{{task_id}}',
  must_pass: [{ name: 'impl exists', type: 'file_exists', path: 'src/impl.ts' }],
  must_not: [
    { name: 'lock untouched', type: 'file_not_modified', path: LOCKED },
    { name: 'no secrets', type: 'command_fails', run: 'grep -r SECRET src/' },
  ],
};

function envData(e: Envelope): Record<string, unknown> {
  if (!e.ok) throw new Error(`expected ok, got: ${e.error.code} ${e.error.message}`);
  return e.data as Record<string, unknown>;
}

function envError(e: Envelope): { code: string; field?: string; message: string } {
  if (e.ok) throw new Error('expected failure envelope');
  return e.error;
}

function taskStatus(id: string): string {
  const got = store().get(id);
  return got.ok ? got.data.status : `error:${got.error.code}`;
}

describe('state transition — guards both ways', () => {
  beforeEach(initBoldash);

  it('implementing without requirements BLOCKS, then PASSES after requirement add', () => {
    const task = seedPlannedTask();
    const blocked = envError(runStateTransition(ctx({}, [task.id, 'implementing'])));
    expect(blocked.code).toBe('STATE_MISSING_REQUIREMENT');
    const added = envData(
      runStateRequirement(ctx({}, ['add', task.id, 'does the thing'])),
    );
    expect((added as { requirements: unknown[] }).requirements).toHaveLength(1);
    const moved = envData(runStateTransition(ctx({}, [task.id, 'implementing'])));
    expect((moved as { status: string }).status).toBe('implementing');
  });

  it('illegal edge → STATE_INVALID_TRANSITION; bad status/id → usage; unknown → not found', () => {
    const task = seedPlannedTask();
    expect(envError(runStateTransition(ctx({}, [task.id, 'complete']))).code).toBe(
      'STATE_INVALID_TRANSITION',
    );
    expect(envError(runStateTransition(ctx({}, [task.id, 'nope']))).code).toBe(
      'CLI_USAGE',
    );
    expect(envError(runStateTransition(ctx({}, [task.id]))).code).toBe('CLI_USAGE');
    expect(envError(runStateTransition(ctx({}, ['TASK-404', 'planned']))).code).toBe(
      'STATE_TASK_NOT_FOUND',
    );
  });

  it('blocked requires --reason and records the machine field', () => {
    const task = seedPlannedTask();
    expect(envError(runStateTransition(ctx({}, [task.id, 'blocked']))).code).toBe(
      'CLI_USAGE',
    );
    const moved = envData(
      runStateTransition(ctx({ reason: 'waiting on API' }, [task.id, 'blocked'])),
    );
    expect(moved).toMatchObject({ status: 'blocked', blocked_reason: 'waiting on API' });
    expect(taskStatus(task.id)).toBe('blocked');
  });

  it('corrupt or missing state surfaces engine errors, never a silent success', () => {
    const task = seedPlannedTask();
    writeFileSync(join(dir, '.boldash', 'state', 'tasks.json'), '{', 'utf8');
    expect(envError(runStateTransition(ctx({}, [task.id, 'implementing']))).code).toBe(
      'SCHEMA_PARSE',
    );
  });
});

describe('state transition — precondition (fresh dir, no init)', () => {
  it('uninitialized repo → precondition before any state read', () => {
    expect(envError(runStateTransition(ctx({}, ['TASK-001', 'planned']))).code).toBe(
      'CLI_PRECONDITION_FAILED',
    );
  });
});

describe('state requirement add (S3)', () => {
  beforeEach(initBoldash);

  it('auto-numbers R-ids and echoes the updated task', () => {
    const task = seedPlannedTask();
    const first = envData(runStateRequirement(ctx({}, ['add', task.id, 'one'])));
    expect(
      (first as { requirements: { id: string; text: string }[] }).requirements,
    ).toHaveLength(1);
    const second = envData(
      runStateRequirement(ctx({}, ['add', task.id, 'two', 'words'])),
    );
    expect(
      (second as { requirements: { id: string }[] }).requirements.map((r) => r.id),
    ).toEqual(['R1', 'R2']);
    expect((second as { requirements: { text: string }[] }).requirements[1]?.text).toBe(
      'two words',
    );
  });

  it('missing verb, id, or text are usage errors', () => {
    expect(envError(runStateRequirement(ctx({}, []))).code).toBe('CLI_USAGE');
    expect(envError(runStateRequirement(ctx({}, ['delete', 'TASK-001']))).code).toBe(
      'CLI_USAGE',
    );
    expect(envError(runStateRequirement(ctx({}, ['add', 'TASK-001']))).code).toBe(
      'CLI_USAGE',
    );
  });
});

describe('state evidence add (S3)', () => {
  beforeEach(initBoldash);

  it('records an EvidenceStore entry keyed to the task and pairs the event', () => {
    const task = seedPlannedTask();
    const out = envData(
      runStateEvidence(ctx({ type: 'test-run', ref: 'evt_9381' }, ['add', task.id])),
    );
    const evidence = out.evidence as { id: string; kind: string; task: string };
    expect(evidence).toMatchObject({
      id: 'EVID-test-run-1',
      kind: 'test-run',
      task: task.id,
    });
    const index = JSON.parse(
      readFileSync(join(dir, '.boldash', 'state', 'evidence.json'), 'utf8'),
    ) as { entries: Array<Record<string, unknown>> };
    expect(
      index.entries.some((e) => e['id'] === 'EVID-test-run-1' && e['ref'] === 'evt_9381'),
    ).toBe(true);
    const events = store().readEvents();
    const last = events.ok ? events.data[events.data.length - 1] : undefined;
    expect(last).toMatchObject({ action: 'task.evidence_added', task: task.id });
    expect(last?.payload).toMatchObject({ evidence: 'EVID-test-run-1', ref: 'evt_9381' });
  });

  it('invalid kind (store guard) and missing flags/args are refusals, not silent writes', () => {
    const task = seedPlannedTask();
    expect(
      envError(runStateEvidence(ctx({ type: 'Bad Kind', ref: 'x' }, ['add', task.id])))
        .code,
    ).toBe('SCHEMA_VALIDATION');
    expect(envError(runStateEvidence(ctx({ ref: 'x' }, ['add', task.id]))).code).toBe(
      'CLI_USAGE',
    );
    expect(envError(runStateEvidence(ctx({ type: 't' }, ['add', task.id]))).code).toBe(
      'CLI_USAGE',
    );
    expect(
      envError(runStateEvidence(ctx({ type: 't', ref: 'r' }, ['add', 'TASK-404']))).code,
    ).toBe('STATE_TASK_NOT_FOUND');
  });
});

describe('AC-8 file-baseline capture at planned→implementing (consumer-proven)', () => {
  async function fileNotModifiedOutcome(task: Task) {
    const evidence = new EvidenceStore(join(dir, '.boldash'), clock);
    const env = buildEnv({ cwd: dir, evidence, clock }, task);
    if (!env.ok) throw new Error(`buildEnv failed: ${env.error.message}`);
    const { outcome } = await runCheck(
      { name: 'lock untouched', type: 'file_not_modified', path: LOCKED },
      { env: env.data, evidence },
    );
    return outcome;
  }

  it('captures sha256 baselines the verification engine ACCEPTS (PASS side)', async () => {
    initBoldash();
    writeFileSync(join(dir, 'protected-init-marker'), '', 'utf8');
    mkdirSync(join(dir, 'protected'), { recursive: true });
    const content = '# do not touch\n';
    writeFileSync(join(dir, LOCKED), content, 'utf8');
    writeWorkflowContract(CONTRACT);
    const task = seedPlannedTask(true);

    const moved = envData(runStateTransition(ctx({}, [task.id, 'implementing'])));
    expect((moved as { status: string }).status).toBe('implementing');

    const expectedHash = `sha256:${createHash('sha256').update(content).digest('hex')}`;
    const index = JSON.parse(
      readFileSync(join(dir, '.boldash', 'state', 'evidence.json'), 'utf8'),
    ) as { entries: Array<Record<string, unknown>> };
    const baseline = index.entries.find((e) => e['kind'] === 'file-baseline');
    expect(baseline).toMatchObject({ path: LOCKED, hash: expectedHash, task: task.id });

    const updated = store().get(task.id);
    if (!updated.ok) throw new Error('task vanished');
    expect((await fileNotModifiedOutcome(updated.data)).pass).toBe(true);
  });

  it('a modification after capture BLOCKS the must_not check (fail-closed stays real)', async () => {
    initBoldash();
    mkdirSync(join(dir, 'protected'), { recursive: true });
    writeFileSync(join(dir, LOCKED), 'original\n', 'utf8');
    writeWorkflowContract(CONTRACT);
    const task = seedPlannedTask(true);
    runStateTransition(ctx({}, [task.id, 'implementing']));
    writeFileSync(join(dir, LOCKED), 'tampered!!\n', 'utf8');
    const updated = store().get(task.id);
    if (!updated.ok) throw new Error('task vanished');
    const outcome = await fileNotModifiedOutcome(updated.data);
    expect(outcome.pass).toBe(false);
    expect(outcome.detail).toContain('differs from baseline');
  });

  it('no bound contract → vacuous capture; the consumer still blocks without a baseline', async () => {
    initBoldash();
    const task = seedPlannedTask(true);
    const moved = envData(runStateTransition(ctx({}, [task.id, 'implementing'])));
    expect((moved as { status: string }).status).toBe('implementing');
    const updated = store().get(task.id);
    if (!updated.ok) throw new Error('task vanished');
    const outcome = await fileNotModifiedOutcome(updated.data);
    expect(outcome.pass).toBe(false);
    expect(outcome.detail).toContain('no baseline');
  });

  it('escape or corrupt contract refuses the transition — state never advances', () => {
    initBoldash();
    writeWorkflowContract({
      task_id: '{{task_id}}',
      must_pass: [{ name: 'x', type: 'file_exists', path: 'a' }],
      must_not: [{ name: 'escape', type: 'file_not_modified', path: '../outside' }],
    });
    const task = seedPlannedTask(true);
    expect(envError(runStateTransition(ctx({}, [task.id, 'implementing']))).code).toBe(
      'VERIFY_CONTRACT_INVALID',
    );
    expect(taskStatus(task.id)).toBe('planned');

    writeWorkflowContract('{ not json', 'bugfix');
    const s = store();
    const t2 = s.create(
      { title: 'u', type: 'bugfix', risk: 'low', level: 1, workflow: 'bugfix' },
      'seed',
    );
    if (!t2.ok) throw new Error('seed');
    const r2 = s.addRequirement(
      t2.data.id,
      { id: 'R1', text: 'x' },
      t2.data.version,
      'seed',
    );
    if (!r2.ok) throw new Error('seed');
    const p2 = s.transition(t2.data.id, 'planned', r2.data.version, 'seed');
    if (!p2.ok) throw new Error('seed');
    expect(envError(runStateTransition(ctx({}, [t2.data.id, 'implementing']))).code).toBe(
      'SCHEMA_PARSE',
    );
    expect(taskStatus(t2.data.id)).toBe('planned');
  });

  it('captureFileBaselines returns null when the task has no workflow (no invention)', () => {
    initBoldash();
    const s = store();
    const t = s.create(
      { title: 'bare', type: 'chore', risk: 'trivial', level: 0 },
      'seed',
    );
    if (!t.ok) throw new Error('seed');
    expect(captureFileBaselines(dir, t.data)).toBeNull();
  });
});
