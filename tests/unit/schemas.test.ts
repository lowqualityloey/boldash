import { describe, expect, it } from 'vitest';
import { getValidator, type SchemaName } from '../../src/shared/schema.js';

/** Fixtures mirror the examples in docs/routing-contract.md verbatim. */
const validRoute = {
  task: {
    type: 'feature',
    risk: 'medium',
    scope: { files: ['src/auth/*'], systems: ['authentication'] },
    summary: 'Handle Google OAuth callback',
  },
  route: { workflow: 'feature', level: 2 },
};

const validTask = {
  schema_version: 1,
  id: 'TASK-001',
  title: 'Handle Google OAuth callback',
  type: 'feature',
  risk: 'medium',
  level: 2,
  status: 'proposed',
  requirements: [{ id: 'R1', text: 'callback endpoint exists' }],
  version: 1,
  created_at: '2026-09-15T00:00:00.000Z',
  updated_at: '2026-09-15T00:00:00.000Z',
};

const validDone = {
  task_id: 'TASK-001',
  must_pass: [
    { type: 'file_exists', name: 'callback file present', path: 'src/auth/callback.ts' },
    {
      type: 'command',
      name: 'OAuth callback integration test',
      run: 'npm test -- --grep oauth',
      timeout_ms: 900000,
    },
    {
      type: 'regex_in_file',
      name: 'callback registered',
      path: 'src/auth/index.ts',
      pattern: 'registerCallback\\(',
    },
    {
      type: 'state_check',
      name: 'risk not critical',
      check: "state.task.risk != 'critical'",
    },
    { type: 'evidence_exists', name: 'review completed', path: 'review' },
  ],
  must_not: [
    { type: 'file_not_modified', name: 'schema untouched', path: 'db/schema.sql' },
    { type: 'command_fails', name: 'linter finds no issues', run: 'eslint src/' },
  ],
};

const validEvent = {
  id: 'evt_9381',
  ts: '2026-09-15T00:00:00.000Z',
  task: 'TASK-001',
  action: 'verify.run',
  actor: 'agent-01',
  payload: { status: 'VERIFIED' },
};

function check(name: SchemaName, value: unknown): boolean {
  const v = getValidator(name);
  return v(value) === true;
}

describe('route.schema.json (AC-1)', () => {
  it('accepts the contract-valid proposal', () =>
    expect(check('route', validRoute)).toBe(true));
  it('rejects unknown top-level keys', () =>
    expect(check('route', { ...validRoute, hacker: true })).toBe(false));
  it('rejects out-of-range level and unknown risk', () => {
    expect(
      check('route', { ...validRoute, route: { workflow: 'feature', level: 9 } }),
    ).toBe(false);
    expect(
      check('route', { ...validRoute, task: { ...validRoute.task, risk: 'yolo' } }),
    ).toBe(false);
  });
});

describe('task.schema.json (AC-1)', () => {
  it('accepts a minimal proposed task', () =>
    expect(check('task', validTask)).toBe(true));
  it('rejects a complete task without completed_at and a blocked task without reason', () => {
    expect(check('task', { ...validTask, status: 'complete' })).toBe(false);
    expect(check('task', { ...validTask, status: 'blocked' })).toBe(false);
  });
  it('accepts empty requirements (structure permits; lifecycle enforces ≥1) but rejects bad ids and wrong version', () => {
    expect(check('task', { ...validTask, requirements: [] })).toBe(true);
    expect(check('task', { ...validTask, id: 'task one' })).toBe(false);
    expect(check('task', { ...validTask, schema_version: 2 })).toBe(false);
  });
});

describe('task-state-file.schema.json (AC-1)', () => {
  it('accepts a versioned file of tasks ($ref into task.schema.json)', () =>
    expect(check('taskStateFile', { schema_version: 1, tasks: [validTask] })).toBe(true));
  it('rejects garbage at any depth', () => {
    expect(
      check('taskStateFile', { schema_version: 1, tasks: [{ id: 'TASK-001' }] }),
    ).toBe(false);
    expect(check('taskStateFile', { schema_version: 1 })).toBe(false); // tasks required
  });
});

describe('done.schema.json (AC-1, AC-4)', () => {
  it('accepts contracts covering every built-in check type, with timeout_ms (AC-4 amendment)', () =>
    expect(check('doneContract', validDone)).toBe(true));
  it('rejects unknown check types', () =>
    expect(
      check('doneContract', {
        task_id: 'TASK-001',
        must_pass: [{ type: 'static_analysis', name: 'bogus check', run: 'true' }],
      }),
    ).toBe(false));
  it('rejects malformed per-type payloads (command without run; file_exists without path; extras)', () => {
    expect(
      check('doneContract', {
        task_id: 'T',
        must_pass: [{ type: 'command', name: 'missing run here' }],
      }),
    ).toBe(false);
    expect(
      check('doneContract', {
        task_id: 'T',
        must_pass: [{ type: 'file_exists', name: 'no path at all' }],
      }),
    ).toBe(false);
    expect(
      check('doneContract', {
        task_id: 'T',
        must_pass: [
          { type: 'file_exists', name: 'sneaky extra key', path: 'x', exploit: 'rm -rf' },
        ],
      }),
    ).toBe(false);
  });
  it('rejects an empty must_pass (a contract must assert something)', () =>
    expect(check('doneContract', { task_id: 'T', must_pass: [] })).toBe(false));
});

describe('event.schema.json (AC-1)', () => {
  it('accepts a verify.run event', () => expect(check('event', validEvent)).toBe(true));
  it('rejects unknown actions and malformed ids', () => {
    expect(check('event', { ...validEvent, action: 'task.yolo' })).toBe(false);
    expect(check('event', { ...validEvent, id: 'event-1' })).toBe(false);
  });
});
