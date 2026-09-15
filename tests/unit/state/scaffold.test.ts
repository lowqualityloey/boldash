/**
 * MS-6 S1: scaffoldProjectState — every branch. The State Engine scaffold is
 * the only sanctioned writer of the initial .boldash/ tree (AGENTS.md
 * §State mutations); init's precondition/force logic is golden-tested against
 * the built CLI (tests/golden/cli-init.test.ts).
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldProjectState } from '../../../src/core/state/scaffold.js';
import { FixedClock } from '../../../src/shared/clock.js';
import { getValidator } from '../../../src/shared/schema.js';

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'boldash-scaffold-'));
}

const clock = new FixedClock('2026-09-15T01:24:00.000Z');

describe('scaffoldProjectState — happy path', () => {
  it('creates the full §3.4-style tree with engine-valid contents', () => {
    const root = join(workspace(), '.boldash');
    const r = scaffoldProjectState({ boldashDir: root, profile: 'balanced' }, clock);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const tasks = JSON.parse(readFileSync(join(root, 'state/tasks.json'), 'utf8'));
    expect(getValidator('taskStateFile')(tasks)).toBe(true);

    expect(JSON.parse(readFileSync(join(root, 'state/evidence.json'), 'utf8'))).toEqual({
      schema_version: 1,
      entries: [],
    });
    const decisions = JSON.parse(
      readFileSync(join(root, 'state/decisions.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(decisions).toEqual({ schema_version: 1, decisions: [] });

    const project = JSON.parse(
      readFileSync(join(root, 'state/project.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(project).toMatchObject({
      schema_version: 1,
      profile: 'balanced',
      capabilities: [],
      created_at: '2026-09-15T01:24:00.000Z',
    });

    expect(readFileSync(join(root, 'events.jsonl'), 'utf8')).toBe('');
    const config = readFileSync(join(root, 'config.yaml'), 'utf8');
    expect(config).toContain('profile: balanced');
    expect(config).not.toMatch(/^host:/m); // only the commented MS-7 placeholder line
  });

  it('records a forced host in the config template', () => {
    const root = join(workspace(), '.boldash');
    scaffoldProjectState({ boldashDir: root, profile: 'strict', host: 'claude' }, clock);
    expect(readFileSync(join(root, 'config.yaml'), 'utf8')).toContain('host: claude');
  });

  it('never truncates an existing events.jsonl', () => {
    const root = join(workspace(), '.boldash');
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(join(root, 'events.jsonl'), '{"keep":"me"}\n', 'utf8');
    scaffoldProjectState({ boldashDir: root, profile: 'lite' }, clock);
    expect(readFileSync(join(root, 'events.jsonl'), 'utf8')).toBe('{"keep":"me"}\n');
  });

  it('is idempotent over its own output (same tree, same config)', () => {
    const root = join(workspace(), '.boldash');
    const first = scaffoldProjectState({ boldashDir: root, profile: 'balanced' }, clock);
    const second = scaffoldProjectState({ boldashDir: root, profile: 'balanced' }, clock);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data.created).not.toContain('config.yaml');
  });
});

describe('scaffoldProjectState — failure branches', () => {
  it('returns IO_ERROR (never throws) when the tree cannot be created', () => {
    const blocker = join(workspace(), 'blocker');
    writeFileSync(blocker, 'not a directory', 'utf8');
    const r = scaffoldProjectState(
      { boldashDir: join(blocker, '.boldash'), profile: 'balanced' },
      clock,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('IO_ERROR');
    expect(r.error.field).toContain('.boldash');
  });
});
