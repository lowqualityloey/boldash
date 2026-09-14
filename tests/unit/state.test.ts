import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskStore } from '../../src/core/state/task-store.js';
import { TRANSITIONS, allowedFrom, canTransition, isTerminal } from '../../src/core/state/transitions.js';
import { FixedClock } from '../../src/shared/clock.js';
import type { Task, TaskStatus } from '../../src/core/state/types.js';
/**
 * MS-3: state engine tests. Real filesystem (AGENTS: never mock fs), injected
 * clock. AC-1 names/exit mappings are proven in errors.test.ts; here we prove
 * the engine produces exactly those codes.
 */
let dir: string;
let store: TaskStore;
let clock: FixedClock;
const stateFile = () => join(dir, '.boldash', 'state', 'tasks.json');
const eventsFile = () => join(dir, '.boldash', 'events.jsonl');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-state-'));
  clock = new FixedClock();
  store = new TaskStore({ stateFile: stateFile(), eventsFile: eventsFile() }, clock);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function data<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error.message}`);
  return r.data;
}
function fail(r: { ok: boolean; error?: { code: string; message: string; context?: Record<string, unknown> } }): {
  code: string;
  message: string;
  context?: Record<string, unknown>;
} {
  if (r.ok) throw new Error('expected failure, got ok');
  return r.error!;
}
function makeTask(partial = {}): Task {
  return data(
    store.create({ title: 'OAuth callback', type: 'feature', risk: 'medium', level: 2, ...partial }, 'agent-01'),
  );
}

describe('lifecycle transitions (AC-1)', () => {
  it('walks proposed→planned→implementing→verifying→complete, bumping version each step', () => {
    const t = makeTask({ requirements: [{ id: 'R1', text: 'endpoint exists' }] });
    let cur = t;
    const chain: TaskStatus[] = ['planned', 'implementing', 'verifying', 'complete'];
    for (const [i, to] of chain.entries()) {
      cur = data(store.transition(t.id, to, cur.version, 'agent-01'));
      expect(cur.status).toBe(to);
      expect(cur.version).toBe(i + 2);
    }
    expect(cur.completed_at).toBe('2026-01-01T00:00:00.000Z');
    expect(isTerminal(cur.status)).toBe(true);
  });

  it('rejects proposed→complete with allowed set in context', () => {
    const t = makeTask();
    const e = fail(store.transition(t.id, 'complete', t.version, 'agent-01'));
    expect(e.code).toBe('STATE_INVALID_TRANSITION');
    expect(e.context?.allowed_from_proposed).toEqual(allowedFrom('proposed'));
    expect(e.context?.allowed_from_proposed).not.toContain('complete');
  });

  it('terminal states cannot be reopened', () => {
    const t = makeTask({ requirements: [{ id: 'R1', text: 'x' }] });
    data(store.transition(t.id, 'planned', 1, 'a'));
    data(store.transition(t.id, 'implementing', 2, 'a'));
    data(store.transition(t.id, 'failed', 3, 'a'));
    expect(fail(store.transition(t.id, 'planned', 4, 'a')).code).toBe('STATE_INVALID_TRANSITION');
  });

  it('blocked requires a reason and records it; blocked can resume', () => {
    const t = makeTask();
    expect(fail(store.transition(t.id, 'blocked', t.version, 'a')).code).toBe('SCHEMA_VALIDATION');
    const b = data(store.transition(t.id, 'blocked', t.version, 'a', { blockedReason: 'waiting on creds' }));
    expect(b.blocked_reason).toBe('waiting on creds');
    const back = data(store.transition(t.id, 'planned', b.version, 'a'));
    expect(back.status).toBe('planned');
  });
});

describe('optimistic concurrency (AC-2)', () => {
  it('two writers from the same version: exactly one succeeds, other gets CONCURRENT_MODIFICATION', () => {
    const t = makeTask();
    const a = new TaskStore({ stateFile: stateFile(), eventsFile: eventsFile() }, clock);
    const b = new TaskStore({ stateFile: stateFile(), eventsFile: eventsFile() }, clock);
    const first = a.transition(t.id, 'planned', t.version, 'writer-a');
    const second = b.transition(t.id, 'planned', t.version, 'writer-b');
    expect(first.ok).toBe(true);
    const e = fail(second);
    expect(e.code).toBe('CONCURRENT_MODIFICATION');
    expect(e.context).toMatchObject({ expected_version: 1, current_version: 2 });
  });

  it('a stale write never clobbers the version field', () => {
    const t = makeTask();
    data(store.transition(t.id, 'planned', t.version, 'a'));
    const stale = fail(store.transition(t.id, 'implementing', t.version, 'a'));
    expect(stale.code).toBe('CONCURRENT_MODIFICATION');
    expect(data(store.get(t.id)).version).toBe(2);
  });
});

describe('requirement guard (AC-5)', () => {
  it('proposed→planned→implementing with zero requirements → STATE_MISSING_REQUIREMENT', () => {
    const t = makeTask(); // create() no longer fabricates requirements from the title
    const p = data(store.transition(t.id, 'planned', t.version, 'a'));
    const e = fail(store.transition(t.id, 'implementing', p.version, 'a'));
    expect(e.code).toBe('STATE_MISSING_REQUIREMENT');
    expect(data(store.get(t.id)).version).toBe(2); // guard rejected before any write
  });

  it('addRequirement then transition succeeds and bumps version', () => {
    const t = makeTask();
    const u = data(store.addRequirement(t.id, { id: 'R2', text: 'error path' }, t.version, 'a'));
    expect(u.requirements).toHaveLength(1);
    expect(u.version).toBe(2);
    data(store.transition(t.id, 'planned', 2, 'a'));
    expect(data(store.transition(t.id, 'implementing', 3, 'a')).status).toBe('implementing');
  });

  it('duplicate requirement id is rejected', () => {
    const t = makeTask();
    const u = data(store.addRequirement(t.id, { id: 'R1', text: 'first' }, t.version, 'a'));
    expect(fail(store.addRequirement(t.id, { id: 'R1', text: 'dup' }, u.version, 'a')).code).toBe('SCHEMA_VALIDATION');
  });
});

describe('event log (AC-4)', () => {
  it('each mutation appends exactly one event; filtered read by task works', () => {
    const t = makeTask();
    data(store.transition(t.id, 'planned', t.version, 'a'));
    const all = data(store.readEvents());
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.action)).toEqual(['task.created', 'task.transitioned']);
    const mine = data(store.readEvents(t.id));
    expect(mine.every((e) => e.task === t.id)).toBe(true);
    expect(readFileSync(eventsFile(), 'utf8').trim().split('\n')).toHaveLength(2);
  });

  it('corrupt event line fails safe with EVENT_LOG_CORRUPT', () => {
    makeTask();
    writeFileSync(eventsFile(), 'not json\n', { flag: 'a' });
    expect(fail(store.readEvents()).code).toBe('EVENT_LOG_CORRUPT');
  });
});

describe('corrupt state fails safe (AC-3)', () => {
  it('garbage tasks.json → SCHEMA_PARSE, file untouched, no auto-reset', () => {
    mkdirSync(join(dir, '.boldash', 'state'), { recursive: true });
    const before = '{" this is ": broken';
    writeFileSync(stateFile(), before);
    const e = fail(store.get('TASK-001'));
    expect(e.code).toBe('SCHEMA_PARSE');
    expect(readFileSync(stateFile(), 'utf8')).toBe(before);
  });

  it('future schema_version → SCHEMA_VERSION_MISMATCH, never guesses', () => {
    makeTask();
    const raw = JSON.parse(readFileSync(stateFile(), 'utf8'));
    raw.schema_version = 2;
    writeFileSync(stateFile(), JSON.stringify(raw));
    const e = fail(store.list());
    expect(e.code).toBe('SCHEMA_VERSION_MISMATCH');
    expect(e.message).toContain('schema_version 2');
  });

  it('schema-invalid task (missing required) → SCHEMA_VALIDATION', () => {
    mkdirSync(join(dir, '.boldash', 'state'), { recursive: true });
    writeFileSync(stateFile(), JSON.stringify({ schema_version: 1, tasks: [{ id: 'TASK-001' }] }));
    expect(fail(store.list()).code).toBe('SCHEMA_VALIDATION');
  });

  it('missing file reads as empty state (bootstrap ok)', () => {
    expect(data(store.list())).toEqual([]);
  });
});

describe('transitions matrix', () => {
  it('is total over TaskStatus and terminal states have no exits', () => {
    const all = Object.keys(TRANSITIONS) as TaskStatus[];
    expect(new Set(all)).toEqual(new Set(['proposed', 'planned', 'implementing', 'verifying', 'complete', 'blocked', 'failed']));
    expect(canTransition('complete', 'proposed')).toBe(false);
    expect(allowedFrom('failed')).toEqual([]);
    for (const from of all) for (const to of allowedFrom(from)) expect(canTransition(from, to)).toBe(true);
  });
});
