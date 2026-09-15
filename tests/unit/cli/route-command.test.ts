/**
 * MS-6 S3 unit tests: the route command — proposal sources, pipeline error
 * mapping, --create state effects (incl. CLI-owned events), and the P9
 * envelope token budgets (≤80 success / ≤140 failure) measured through the
 * REAL serializer (output.ts render), not vibes.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldProjectState, TaskStore } from '../../../src/core/state/index.js';
import { FixedClock } from '../../../src/shared/clock.js';
import { render } from '../../../src/cli/output.js';
import { tokenCount } from '../../../src/cli/help.js';
import { runRoute } from '../../../src/cli/commands/route.js';
import type { IoStreams } from '../../../src/cli/output.js';
import type { Envelope, RunContext } from '../../../src/cli/types.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-cli-route-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ctx(
  flags: Record<string, string | boolean> = {},
  positionals: string[] = [],
  stdin?: () => string,
  cwd: string = dir,
): RunContext {
  return {
    globals: { format: 'json', quiet: false, verbose: false, cwd, color: true },
    flags,
    positionals,
    ...(stdin ? { stdin, stdinIsTty: false } : {}),
  };
}

const PROPOSAL = JSON.stringify({
  task: {
    type: 'feature',
    risk: 'medium',
    scope: { files: ['src/**'] },
    summary: 'Build the thing',
  },
  route: { workflow: 'feature', level: 2 },
});

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

function initBoldash(): TaskStore {
  const boldashDir = join(dir, '.boldash');
  const r = scaffoldProjectState({ boldashDir, profile: 'balanced' }, new FixedClock());
  if (!r.ok) throw new Error(`scaffold failed: ${r.error.message}`);
  return new TaskStore(
    {
      stateFile: join(boldashDir, 'state', 'tasks.json'),
      eventsFile: join(boldashDir, 'events.jsonl'),
    },
    new FixedClock(),
  );
}

function rendered(env: Envelope): string {
  let out = '';
  const io: IoStreams = {
    write: (s: string) => {
      out += s;
    },
    writeErr: () => {},
    isTTY: false,
  };
  render(
    env,
    { format: 'json', quiet: false, verbose: false, cwd: dir, color: true },
    io,
  );
  return out;
}

describe('route — proposal sources', () => {
  it('inline --json routes and returns the documented payload', () => {
    const out = envData(runRoute(ctx({ json: PROPOSAL })));
    expect(out).toEqual({
      workflow: 'feature',
      level: 2,
      requirements: {
        task_record: true,
        specification: true,
        tests: true,
        review: false,
        human_approval: false,
      },
    });
  });

  it('--input reads a file; stdin works when piped', () => {
    writeFileSync(join(dir, 'proposal.json'), PROPOSAL, 'utf8');
    expect(envData(runRoute(ctx({ input: 'proposal.json' }))).workflow).toBe('feature');
    expect(envData(runRoute(ctx({}, [], () => PROPOSAL))).workflow).toBe('feature');
  });

  it('two sources at once, none on a tty, and stray positionals are usage errors', () => {
    expect(envError(runRoute(ctx({ json: PROPOSAL, input: 'x' }))).code).toBe(
      'CLI_USAGE',
    );
    const tty = ctx({});
    tty.stdinIsTty = true;
    tty.stdin = () => {
      throw new Error('never');
    };
    expect(envError(runRoute(tty)).code).toBe('CLI_USAGE');
    expect(envError(runRoute(ctx({}, ['surprise']))).code).toBe('CLI_USAGE');
  });

  it('pipeline errors pass through with catalog codes', () => {
    expect(envError(runRoute(ctx({ json: '{' }))).code).toBe('SCHEMA_PARSE');
    expect(envError(runRoute(ctx({ json: '{"task":{}}' }))).code).toBe(
      'SCHEMA_VALIDATION',
    );
    const wrongLevel = JSON.parse(PROPOSAL) as Record<string, unknown>;
    wrongLevel['route'] = { workflow: 'feature', level: 0 };
    expect(envError(runRoute(ctx({ json: JSON.stringify(wrongLevel) }))).code).toBe(
      'LEVEL_RISK_MISMATCH',
    );
    const unknown = JSON.parse(PROPOSAL) as { route: Record<string, unknown> };
    unknown.route = { workflow: 'migration', level: 2 };
    const err = envError(runRoute(ctx({ json: JSON.stringify(unknown) })));
    expect(err.code).toBe('WORKFLOW_NOT_FOUND');
    expect(err.context?.['enabled']).toEqual(['feature', 'bugfix', 'docs', 'chore']);
  });
});

describe('route --create', () => {
  it('creates a planned task with the routed level/workflow and logs events', () => {
    initBoldash();
    const out = envData(runRoute(ctx({ json: PROPOSAL, create: true })));
    expect(out['created']).toMatchObject({ id: 'TASK-001', status: 'planned' });
    const store = new TaskStore(
      {
        stateFile: join(dir, '.boldash', 'state', 'tasks.json'),
        eventsFile: join(dir, '.boldash', 'events.jsonl'),
      },
      new FixedClock(),
    );
    const got = store.get('TASK-001');
    if (!got.ok) throw new Error(`expected task: ${got.error.message}`);
    expect(got.data).toMatchObject({
      title: 'Build the thing',
      workflow: 'feature',
      level: 2,
      status: 'planned',
    });
    const events = store.readEvents();
    const actions = events.ok ? events.data.map((e) => e.action) : [];
    expect(actions).toEqual(['task.created', 'task.transitioned', 'route.validated']);
  });

  it('refuses to invent a title: --create without summary is a usage error, state untouched', () => {
    initBoldash();
    const noSummary = JSON.parse(PROPOSAL) as { task: Record<string, unknown> };
    delete noSummary.task['summary'];
    const err = envError(
      runRoute(ctx({ json: JSON.stringify(noSummary), create: true })),
    );
    expect(err.code).toBe('CLI_USAGE');
    expect(err.field).toBe('task.summary');
    const store = new TaskStore(
      {
        stateFile: join(dir, '.boldash', 'state', 'tasks.json'),
        eventsFile: join(dir, '.boldash', 'events.jsonl'),
      },
      new FixedClock(),
    );
    expect((store.list() as { data: unknown[] }).data).toHaveLength(0);
  });

  it('--create without .boldash hits the precondition; plain route works anywhere', () => {
    expect(envError(runRoute(ctx({ json: PROPOSAL, create: true }))).code).toBe(
      'CLI_PRECONDITION_FAILED',
    );
    expect(envData(runRoute(ctx({ json: PROPOSAL }))).workflow).toBe('feature');
  });

  it('route.validated is logged without --create inside an initialized repo', () => {
    const store = initBoldash();
    runRoute(ctx({ json: PROPOSAL }));
    const events = store.readEvents();
    const list = events.ok ? events.data : [];
    expect(list.some((e) => e.action === 'route.validated' && e.task === null)).toBe(
      true,
    );
  });
});

describe('route envelope token budgets (P9, via the real serializer)', () => {
  it('success envelope renders within 80 tokens', () => {
    const env = runRoute(ctx({ json: PROPOSAL }));
    expect(tokenCount(rendered(env))).toBeLessThanOrEqual(80);
    const withTask = runRoute(
      (() => {
        initBoldash();
        return ctx({ json: PROPOSAL, create: true });
      })(),
    );
    expect(tokenCount(rendered(withTask))).toBeLessThanOrEqual(80);
  });

  it('failure envelopes render within 140 tokens', () => {
    const mismatch = runRoute(
      ctx({
        json: JSON.stringify({
          task: { type: 'feature', risk: 'critical', scope: {} },
          route: { workflow: 'feature', level: 1 },
        }),
      }),
    );
    expect(tokenCount(rendered(mismatch))).toBeLessThanOrEqual(140);
    const notFound = runRoute(
      ctx({
        json: JSON.stringify({
          task: { type: 'feature', risk: 'low', scope: {} },
          route: { workflow: 'not-a-pack', level: 1 },
        }),
      }),
    );
    expect(tokenCount(rendered(notFound))).toBeLessThanOrEqual(140);
  });
});
