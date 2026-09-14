import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyTask, buildEnv } from '../../../src/core/verification/gate.js';
import { EvidenceStore } from '../../../src/core/verification/evidence.js';
import { FixedClock } from '../../../src/shared/clock.js';
import type {
  GateResult,
  VerificationContract,
} from '../../../src/core/verification/types.js';
import type { Task } from '../../../src/core/state/types.js';

/**
 * Gate aggregation: every outcome reported, blocking names the failures,
 * timeout wins 12 over 1, corrupt history refuses the run, and the gate
 * writes NO state (CLI's job, MS-6).
 */
let dir: string;
let store: EvidenceStore;
let task: Task;
const deps = () => ({ cwd: dir, evidence: store, clock: new FixedClock() });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-gate-'));
  store = new EvidenceStore(join(dir, '.boldash'), new FixedClock());
  task = {
    schema_version: 1,
    id: 'TASK-020',
    title: 'gate',
    type: 'bugfix',
    risk: 'low',
    level: 1,
    status: 'verifying',
    requirements: [{ id: 'R1', text: 'ok' }],
    version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function contract(over: Partial<VerificationContract> = {}): VerificationContract {
  return {
    task_id: task.id,
    must_pass: [{ type: 'file_exists', name: 'truth marker', path: 'marker.txt' }],
    ...over,
  };
}

async function gate(c: VerificationContract): Promise<GateResult> {
  const r = await verifyTask(c, task, deps());
  if (!r.ok) throw new Error(`gate errored: ${r.error.code}`);
  return r.data;
}

describe('verifyTask aggregation', () => {
  it('all-pass VERIFIED exit 0', async () => {
    writeFileSync(join(dir, 'marker.txt'), 'x');
    const g = await gate(contract());
    expect(g.status).toBe('VERIFIED');
    expect(g.exit).toBe(0);
    expect(g.checks.every((c) => c.pass)).toBe(true);
  });

  it('three pass, one fail → BLOCKED naming EVERY failure, exits 1', async () => {
    writeFileSync(join(dir, 'marker.txt'), 'x');
    const g = await gate(
      contract({
        must_pass: [
          { type: 'file_exists', name: 'truth marker', path: 'marker.txt' },
          { type: 'command', name: 'green command runs', run: 'true' },
          { type: 'state_check', name: 'risk is low', check: "state.task.risk == 'low'" },
          { type: 'file_exists', name: 'ghost file absent', path: 'ghost.txt' },
          { type: 'command', name: 'red command runs', run: 'exit 7' },
        ],
        must_not: [{ type: 'command_fails', name: 'lint stays green', run: 'true' }], // exit 0 → inverted fail
      }),
    );
    expect(g.status).toBe('BLOCKED');
    expect(g.exit).toBe(1);
    const failed = g.checks.filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toEqual(['ghost file absent', 'red command runs', 'lint stays green']);
    // passing checks still produced evidence (the command) — proof survives failure
    expect(
      g.checks.find((c) => c.name === 'green command runs')?.evidenceId,
    ).toBeDefined();
  });

  it('timeout anywhere aggregates to exit 12 over 1', async () => {
    const g = await gate(
      contract({
        must_pass: [
          { type: 'file_exists', name: 'truth marker', path: 'missing-marker.txt' }, // blocks → would be 1
          {
            type: 'command',
            name: 'hangs forever here',
            run: 'sleep 30',
            timeout_ms: 1000,
          }, // forces 12
        ],
      }),
    );
    expect(g.status).toBe('BLOCKED');
    expect(g.exit).toBe(12);
  }, 20_000);

  it('contract/task mismatch refuses as VERIFY_CONTRACT_INVALID (exit-2 class)', async () => {
    const r = await verifyTask(contract({ task_id: 'TASK-OTHER' }), task, deps());
    if (r.ok) throw new Error('expected refusal');
    expect(r.error.code).toBe('VERIFY_CONTRACT_INVALID');
    expect(r.error.field).toBe('task_id');
  });

  it('corrupt evidence index aborts the whole run as IO_ERROR — never "VERIFIED against nothing"', async () => {
    mkdirSync(join(dir, '.boldash', 'state'), { recursive: true });
    writeFileSync(join(dir, '.boldash', 'state', 'evidence.json'), 'not json at all');
    const r = await verifyTask(contract(), task, deps());
    if (r.ok) throw new Error('expected refusal on corrupt history');
    expect(r.error.code).toBe('IO_ERROR');
    const also = buildEnv(deps(), task);
    expect(also.ok).toBe(false);
  });

  it('gate writes evidence (proof) but never task state or events (MS-6 owns those)', async () => {
    await gate(
      contract({
        must_pass: [{ type: 'command', name: 'green command runs', run: 'true' }],
      }),
    );
    // evidence MUST appear — a command ran, so its output is the recorded proof:
    expect(existsSync(join(dir, '.boldash', 'state', 'evidence.json'))).toBe(true);
    expect(
      existsSync(join(dir, '.boldash', 'evidence', 'TASK-020', 'test-run-1.json')),
    ).toBe(true);
    // tasks.json / events.jsonl belong to the State Engine via the CLI (single writer):
    expect(existsSync(join(dir, '.boldash', 'state', 'tasks.json'))).toBe(false);
    expect(existsSync(join(dir, '.boldash', 'events.jsonl'))).toBe(false);
  });
});
