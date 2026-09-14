import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadContract } from '../../../src/core/verification/contract.js';

/**
 * D1 ruling tests: exactly one legal template ({{task_id}}); every other
 * placeholder is rejected at LOAD time, not silently carried to a check.
 */
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'boldash-contract-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const write = (name: string, obj: unknown): string => {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(obj));
  return p;
};

const base = {
  task_id: '{{task_id}}',
  must_pass: [
    { type: 'file_exists', name: 'entry exists', path: 'src/{{task_id}}/main.ts' },
  ],
};

describe('loadContract (D1)', () => {
  it('resolves {{task_id}} in task_id AND nested string fields', () => {
    const r = loadContract(write('done.json', base), 'TASK-042');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.task_id).toBe('TASK-042');
    expect(r.data.must_pass[0]).toMatchObject({ path: 'src/TASK-042/main.ts' });
  });

  it('rejects any other {{ }} template with VERIFY_CONTRACT_INVALID naming the field', () => {
    const bad = {
      task_id: 'TASK-042',
      must_pass: [{ type: 'command', name: 'sneaky', run: 'npm run {{script}}' }],
    };
    const r = loadContract(write('bad.json', bad), 'TASK-042');
    if (r.ok) throw new Error('must reject unresolved template');
    expect(r.error.code).toBe('VERIFY_CONTRACT_INVALID');
    expect(r.error.field).toContain('must_pass[0].run');
  });

  it('rejects unknown templates inside task_id itself', () => {
    const r = loadContract(
      write('t.json', { ...base, task_id: '{{project}}' }),
      'TASK-042',
    );
    if (r.ok) throw new Error('must reject');
    expect(r.error.field).toBe('task_id');
  });

  it('non-template task_id literals pass through untouched', () => {
    const r = loadContract(write('lit.json', { ...base, task_id: 'TASK-7' }), 'TASK-9');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.task_id).toBe('TASK-7');
  });

  it('meta-schema violations → VERIFY_CONTRACT_INVALID; bad JSON → SCHEMA_PARSE; missing file → refused read', () => {
    // A BigInt cannot be stringified, so the write itself must throw on a real
    // serialization failure — the SCHEMA_PARSE branch needs raw invalid JSON:
    const badJsonPath = join(dir, 'broken.json');
    writeFileSync(badJsonPath, '{ nope');
    const parseFail = loadContract(badJsonPath, 'TASK-1');
    expect(parseFail.ok ? 'ok' : parseFail.error.code).toBe('SCHEMA_PARSE');
    const schemaFail = loadContract(write('s.json', { task_id: 'T' }), 'TASK-1'); // must_pass missing
    expect(schemaFail.ok ? 'ok' : schemaFail.error.code).toBe('VERIFY_CONTRACT_INVALID');
    const gone = loadContract(join(dir, 'nowhere.json'), 'TASK-1');
    if (gone.ok) throw new Error('missing file must be refused');
    expect(gone.error.code).toBe('VERIFY_CONTRACT_INVALID');
    // JSON that parses but is not an object (a bare string) fails the meta-schema:
    expect(loadContract(write('str.json', '{ not json'), 'TASK-1').ok).toBe(false);
  });

  it('resolved output is itself meta-schema-valid (no post-resolution drift)', () => {
    const r = loadContract(write('v.json', base), 'TASK-042');
    if (!r.ok) throw new Error(r.error.message);
    const round = loadContract(write('v2.json', r.data), 'TASK-042');
    expect(round.ok).toBe(true);
  });
});
