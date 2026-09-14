import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EvidenceStore } from '../../../src/core/verification/evidence.js';
import { FixedClock } from '../../../src/shared/clock.js';

/**
 * MS-5 slice 2: evidence store. Guarantees under test — raw secrets never
 * reach disk; path inputs are validated; payload-before-index write order;
 * ids derived from the index, not the clock; kindsFor oracle for slice 3.
 */
let dir: string;
let store: EvidenceStore;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-evid-'));
  store = new EvidenceStore(dir, new FixedClock());
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function data<T>(
  r: { ok: true; data: T } | { ok: false; error: { message: string } },
): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}
function failr(r: { ok: boolean; error?: { code: string; message: string } }): {
  code: string;
  message: string;
} {
  if (r.ok) throw new Error('expected failure');
  return r.error!;
}

describe('record + ids', () => {
  it('mints EVID-<kind>-<seq> and writes payload under the task dir', () => {
    const rec = data(
      store.record({
        kind: 'test-run',
        task: 'TASK-001',
        summary: '12 passed',
        fields: { exit_code: 0 },
      }),
    );
    expect(rec.id).toBe('EVID-test-run-1');
    expect(rec.payload_ref).toBe('evidence/TASK-001/test-run-1.json');
    const onDisk = JSON.parse(
      readFileSync(join(dir, 'evidence', 'TASK-001', 'test-run-1.json'), 'utf8'),
    );
    expect(onDisk.summary).toBe('12 passed');
    expect(onDisk.exit_code).toBe(0);
  });

  it('per-(task,kind) sequence increments from the index; other kinds independent', () => {
    expect(
      data(store.record({ kind: 'test-run', task: 'TASK-001', summary: 'a' })).id,
    ).toBe('EVID-test-run-1');
    expect(
      data(store.record({ kind: 'test-run', task: 'TASK-001', summary: 'b' })).id,
    ).toBe('EVID-test-run-2');
    expect(
      data(store.record({ kind: 'review', task: 'TASK-001', summary: 'r' })).id,
    ).toBe('EVID-review-1');
    expect(
      data(store.record({ kind: 'test-run', task: 'TASK-002', summary: 'x' })).id,
    ).toBe('EVID-test-run-1');
  });

  it('null task lands under a project-scoped file', () => {
    const rec = data(
      store.record({ kind: 'secret-scan', task: null, summary: 'repo-wide' }),
    );
    expect(rec.task).toBeNull();
    expect(rec.payload_ref).toBe('evidence/project-EVID-secret-scan-1.json');
    expect(existsSync(join(dir, 'evidence', 'project-EVID-secret-scan-1.json'))).toBe(
      true,
    );
  });
});

describe('evidence_exists oracle', () => {
  it('kindsFor reflects recorded kinds per task only', () => {
    data(store.record({ kind: 'test-run', task: 'TASK-001', summary: 'a' }));
    data(store.record({ kind: 'review', task: 'TASK-002', summary: 'b' }));
    expect([...store.kindsFor('TASK-001')]).toEqual(['test-run']);
    expect([...store.kindsFor('TASK-002')]).toEqual(['review']);
    expect(store.kindsFor('TASK-999').size).toBe(0);
  });

  it('empty store yields empty kinds and empty index read', () => {
    expect(store.kindsFor('TASK-001').size).toBe(0);
    expect(store.readIndex()).toEqual([]);
  });
});

describe('input validation and fail-closed paths', () => {
  it('rejects path-traversal and malformed kinds', () => {
    for (const kind of ['../evil', 'UPPER', 'has space', '', '-lead']) {
      const e = failr(store.record({ kind, task: 'TASK-001', summary: 'x' }));
      expect(e.code, kind).toBe('SCHEMA_VALIDATION');
    }
  });

  it('rejects malformed task ids', () => {
    expect(
      failr(store.record({ kind: 'review', task: 'TASK/../x', summary: 's' })).code,
    ).toBe('SCHEMA_VALIDATION');
  });

  it('refuses to write when a secret shape survives redaction (exit-10 class), file absent', () => {
    // First record seeds evidence/ so "nothing lands" below is a real claim:
    // the secret payload must add no file, not merely find a dir that never existed.
    data(store.record({ kind: 'review', task: 'TASK-001', summary: 'prior' }));
    const filesBefore = readdirSync(join(dir, 'evidence', 'TASK-001'));
    const e = failr(
      store.record({
        kind: 'test-run',
        task: 'TASK-001',
        summary: 'ok',
        fields: { stdout: 'auth token = "s3cr3t-abc"' },
      }),
    );
    expect(e.code).toBe('EVIDENCE_REDACTION_FAILED');
    // Pre-flight guard: the secret scan runs on the serialized record BEFORE
    // either write, so no payload file appears and the index gains no entry.
    expect(readdirSync(join(dir, 'evidence', 'TASK-001'))).toEqual(filesBefore);
    expect(store.readIndex()).toHaveLength(1);
    expect(store.readIndex()[0]?.id).toBe('EVID-review-1');
  });

  it('distinguishes corrupt JSON from rejected shape, failing closed on both', () => {
    data(store.record({ kind: 'review', task: 'TASK-001', summary: 'ok' }));
    writeFileSync(join(dir, 'state', 'evidence.json'), '{nope');
    expect(() => store.readIndex()).toThrow(/corrupt/);
    writeFileSync(
      join(dir, 'state', 'evidence.json'),
      '{"schema_version":99,"entries":[]}',
    );
    expect(() => store.readIndex()).toThrow(/rejected/);
  });

  it('record() refuses to write onto an unreadable index (no silent clobber)', () => {
    mkdirSync(join(dir, 'state'), { recursive: true });
    writeFileSync(join(dir, 'state', 'evidence.json'), '{"schema_version":1}'); // entries missing → rejected
    const e = failr(store.record({ kind: 'review', task: 'TASK-001', summary: 'x' }));
    expect(e.code).toBe('IO_ERROR');
    // the refused index is still there, byte-identical — refusal, not overwrite:
    expect(readFileSync(join(dir, 'state', 'evidence.json'), 'utf8')).toBe(
      '{"schema_version":1}',
    );
  });
});
