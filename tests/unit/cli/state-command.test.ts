/**
 * MS-6 S2 unit tests: `state get|list` runners against real temp repos
 * (AGENTS: never mock fs), seeded through the State Engine — plus the
 * flag-enum⇄schema drift guard for the registry's filter values.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldProjectState, TaskStore } from '../../../src/core/state/index.js';
import { FixedClock } from '../../../src/shared/clock.js';
import { getValidator, loadSchemaText } from '../../../src/shared/schema.js';
import { exitCodeFor } from '../../../src/shared/errors.js';
import {
  DEFAULT_LIMIT,
  RISK_VALUES,
  runStateGet,
  runStateList,
  STATUS_VALUES,
  TYPE_VALUES,
} from '../../../src/cli/commands/state.js';
import { REGISTRY } from '../../../src/cli/commands/index.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';
import type { Result } from '../../../src/shared/result.js';
import type { Task, TaskStateFile } from '../../../src/core/state/index.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-cli-state-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ctx(
  flags: Record<string, string | boolean> = {},
  positionals: string[] = [],
  cwd: string = dir,
): RunContext {
  return {
    globals: { format: 'json', quiet: false, verbose: false, cwd, color: true },
    flags,
    positionals,
  };
}

function initBoldash(): void {
  const r = scaffoldProjectState(
    { boldashDir: join(dir, '.boldash'), profile: 'balanced' },
    new FixedClock(),
  );
  if (!r.ok) throw new Error(`scaffold failed: ${r.error.message}`);
}

function seedStore(): TaskStore {
  return new TaskStore(
    {
      stateFile: join(dir, '.boldash', 'state', 'tasks.json'),
      eventsFile: join(dir, '.boldash', 'events.jsonl'),
    },
    new FixedClock(),
  );
}

function data<T>(r: Result<T, { message: string }>): T {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error.message}`);
  return r.data;
}

function envData(e: Envelope): Record<string, unknown> {
  if (!e.ok) throw new Error(`expected ok, got: ${e.error.code} ${e.error.message}`);
  return e.data as Record<string, unknown>;
}

function envError(e: Envelope): {
  code: string;
  field?: string;
  context?: Record<string, unknown>;
} {
  if (e.ok) throw new Error('expected failure envelope');
  return e.error;
}

describe('state get (S2)', () => {
  it('returns the canonical task, schema-valid against task.schema.json', () => {
    initBoldash();
    const task = data(
      seedStore().create({ title: 'T', type: 'feature', risk: 'medium', level: 1 }, 'a'),
    );
    const env = runStateGet(ctx({}, [task.id]));
    const got = envData(env) as unknown as Task;
    expect(got.id).toBe(task.id);
    expect(getValidator('task')(got)).toBe(true);
  });

  it('unknown id → STATE_TASK_NOT_FOUND (exit 2, reads never hit the 4-class)', () => {
    initBoldash();
    const err = envError(runStateGet(ctx({}, ['TASK-404'])));
    expect(err.code).toBe('STATE_TASK_NOT_FOUND');
    expect(exitCodeFor('STATE_TASK_NOT_FOUND')).toBe(2);
  });

  it('missing .boldash/ → CLI_PRECONDITION_FAILED before any store touch', () => {
    const err = envError(runStateGet(ctx({}, ['TASK-001'])));
    expect(err.code).toBe('CLI_PRECONDITION_FAILED');
  });

  it('no id and extra arguments are usage errors', () => {
    initBoldash();
    expect(envError(runStateGet(ctx())).code).toBe('CLI_USAGE');
    expect(envError(runStateGet(ctx({}, ['TASK-001', 'x']))).code).toBe('CLI_USAGE');
  });

  it('corrupt state surfaces the engine error, never a silent empty (fail-closed)', () => {
    initBoldash();
    writeFileSync(join(dir, '.boldash', 'state', 'tasks.json'), '{', 'utf8');
    expect(envError(runStateGet(ctx({}, ['TASK-001']))).code).toBe('SCHEMA_PARSE');
  });
});

describe('state list (S2)', () => {
  function seedThree(): void {
    initBoldash();
    const store = seedStore();
    data(store.create({ title: 'feat', type: 'feature', risk: 'medium', level: 2 }, 'a'));
    data(store.create({ title: 'fix', type: 'bugfix', risk: 'low', level: 1 }, 'a'));
    data(store.create({ title: 'doc', type: 'docs', risk: 'high', level: 0 }, 'a'));
  }

  it('lists everything with total/limit and schema-valid tasks', () => {
    seedThree();
    const out = envData(runStateList(ctx()));
    expect(out.total).toBe(3);
    expect(out.limit).toBe(DEFAULT_LIMIT);
    const validate = getValidator('task');
    for (const t of out.tasks as Task[]) expect(validate(t)).toBe(true);
  });

  it('filters by status, risk, and type through the engine', () => {
    seedThree();
    const store = seedStore();
    const first = data(store.list())[0];
    if (!first) throw new Error('seed missing');
    data(store.transition(first.id, 'planned', first.version, 'a'));

    const planned = envData(runStateList(ctx({ status: 'planned' })));
    expect((planned.tasks as Task[]).map((t) => t.id)).toEqual([first.id]);
    const low = envData(runStateList(ctx({ risk: 'low' })));
    expect((low.tasks as Task[]).map((t) => t.title)).toEqual(['fix']);
    const docs = envData(runStateList(ctx({ type: 'docs' })));
    expect((docs.tasks as Task[]).map((t) => t.title)).toEqual(['doc']);
  });

  it('filters by owner via direct fixture state (leases arrive with claim flows)', () => {
    initBoldash();
    const file: TaskStateFile = {
      schema_version: 1,
      tasks: [
        {
          schema_version: 1,
          id: 'TASK-009',
          title: 'owned',
          type: 'chore',
          risk: 'trivial',
          level: 0,
          status: 'proposed',
          requirements: [],
          owner: 'agent-07',
          version: 1,
          created_at: '2026-09-15T00:00:00.000Z',
          updated_at: '2026-09-15T00:00:00.000Z',
        },
      ],
    };
    // Test fixture seeding — the no-direct-write rule binds product code;
    // the engine still validates this file on read.
    writeFileSync(
      join(dir, '.boldash', 'state', 'tasks.json'),
      JSON.stringify(file),
      'utf8',
    );
    const hit = envData(runStateList(ctx({ owner: 'agent-07' })));
    expect((hit.tasks as Task[]).map((t) => t.id)).toEqual(['TASK-009']);
    expect(envData(runStateList(ctx({ owner: 'nobody' }))).total).toBe(0);
  });

  it('--limit slices results but reports the filtered total', () => {
    seedThree();
    const out = envData(runStateList(ctx({ limit: '2' })));
    expect(out.total).toBe(3);
    expect((out.tasks as Task[]).length).toBe(2);
  });

  it('bad limits and bypassed enum guards are usage errors (exit 2)', () => {
    initBoldash();
    for (const limit of ['0', '-1', 'x', '1.5']) {
      expect(envError(runStateList(ctx({ limit }))).code).toBe('CLI_USAGE');
    }
    expect(envError(runStateList(ctx({ status: 'nope' }))).code).toBe('CLI_USAGE');
    expect(envError(runStateList(ctx({}, ['surprise']))).code).toBe('CLI_USAGE');
  });
});

describe('registry drift guards (S2)', () => {
  const schema = JSON.parse(loadSchemaText('task')) as {
    properties: Record<string, { enum?: string[] }>;
  };

  it('flag enums mirror task.schema.json exactly', () => {
    expect([...STATUS_VALUES].sort()).toEqual(
      [...(schema.properties.status?.enum ?? [])].sort(),
    );
    expect([...RISK_VALUES].sort()).toEqual(
      [...(schema.properties.risk?.enum ?? [])].sort(),
    );
    expect([...TYPE_VALUES].sort()).toEqual(
      [...(schema.properties.type?.enum ?? [])].sort(),
    );
  });

  it('bare family runner is a usage error naming the wired subcommands', async () => {
    const state = REGISTRY.find((c) => c.name === 'state');
    expect(state?.run).toBeDefined();
    const err = envError(
      (await state?.run?.(ctx())) ?? ({ ok: true, data: null } as Envelope),
    );
    expect(err.code).toBe('CLI_USAGE');
    const envelope = await state?.run?.(ctx());
    if (envelope && !envelope.ok) {
      expect(envelope.error.suggestion).toContain('get, list');
    }
  });
});
