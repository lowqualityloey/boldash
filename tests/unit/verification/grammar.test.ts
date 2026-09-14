import { describe, expect, it } from 'vitest';
import { parseStateExpression } from '../../../src/core/verification/grammar.js';
import type { Task } from '../../../src/core/state/types.js';

/**
 * MS-5 slice 1: the constrained grammar (ruling D2, #13 subset).
 * PASS and BLOCK pairs per form, plus an injection fuzz list that MUST be
 * rejected — a parser that accepts junk is the verification-theater failure.
 */

const task: Task = {
  schema_version: 1,
  id: 'TASK-001',
  title: 'OAuth callback',
  type: 'feature',
  risk: 'medium',
  level: 2,
  status: 'implementing',
  requirements: [{ id: 'R1', text: 'endpoint exists' }],
  version: 3,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function evalOk(src: string, t: Task = task): boolean {
  const r = parseStateExpression(src);
  if (!r.ok) throw new Error(`expected parse-ok: ${r.error.message}`);
  return r.data.evaluate(t);
}

function reject(src: string): void {
  const r = parseStateExpression(src);
  if (r.ok) throw new Error(`expected rejection, parsed as: ${r.data.source}`);
  expect(r.error.code).toBe('VERIFY_CONTRACT_INVALID');
  expect(r.error.message).toContain('#13');
}

describe('form A: state.task.<field> equality', () => {
  it("PASS/BLOCK pair on the guide's own example", () => {
    expect(evalOk("state.task.risk != 'critical'")).toBe(true);
    const critical: Task = { ...task, risk: 'critical' };
    expect(evalOk("state.task.risk != 'critical'", critical)).toBe(false);
  });

  it('accepts numbers, booleans, null, and double-quoted strings', () => {
    expect(evalOk('state.task.level == 2')).toBe(true);
    expect(evalOk('state.task.status == "implementing"')).toBe(true);
    expect(evalOk('state.task.blocked_reason == null')).toBe(true);
    // same comparison without the state.task. prefix is a REJECTION, not shorthand:
    reject("blocked_reason == 'waiting'");
  });

  it('different-type equality is false, never coerced', () => {
    expect(evalOk("state.task.level == '2'")).toBe(false);
    expect(evalOk("state.task.level != '2'")).toBe(true);
    expect(evalOk('state.task.version == 3')).toBe(true);
  });

  it('whitespace and no-space forms both parse (tokenizer trims, never skips junk)', () => {
    expect(evalOk("state.task.risk!='critical'")).toBe(true);
    expect(evalOk("   state.task.risk   !=   'critical'  ")).toBe(true);
  });

  it('preserves source verbatim for explain output (P10)', () => {
    const r = parseStateExpression("state.task.risk != 'critical'");
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.source).toBe("state.task.risk != 'critical'");
  });
});

describe('form B: requirements length', () => {
  it('PASS/BLOCK pair on the only useful comparison family', () => {
    expect(evalOk('state.requirements.length >= 1')).toBe(true);
    expect(evalOk('state.requirements.length > 1')).toBe(false);
    const empty: Task = { ...task, requirements: [] };
    expect(evalOk('state.requirements.length == 0', empty)).toBe(true);
  });

  it('rejects string or boolean literals against length', () => {
    const r1 = parseStateExpression("state.requirements.length == 'one'");
    if (r1.ok) throw new Error('unexpected parse');
    expect(r1.error.message).toContain('number');
  });
});

describe('fail-closed fuzz list (everything here must be REJECTED)', () => {
  const evil = [
    '',
    '   ',
    'state.task.risk', // no operator
    'state.task.risk == ', // no literal
    "state.task.password == 'hunter2'", // unknown field
    "state.project.name == 'x'", // unapproved root segment
    'task.risk == "medium"', // missing state. prefix
    'state.task.requirements.length == 1', // requirements lives at state.requirements
    "state.task.risk =~ 'critical'", // regex operator does not exist
    "state.task.risk = 'critical'", // single = is not ==
    "state.task.risk != 'critical' && state.task.type == 'docs'", // no boolean AND yet
    "(state.task.risk == 'critical')", // parens rejected
    'state.task.level.toString() == 2', // member calls rejected
    'constructor.constructor("return process")()', // classic sandbox escape
    'state.task.id == "x"; rm -rf /', // statement injection
    'state.task.id == `tpl`', // template literals are not literals here
    'state..task.risk == "x"', // double dot
    'state.task.risk !== "critical"', // JS !== is not the grammar
    '7 == state.task.level', // reversed operands not accepted
    '$(whoami)',
    'state.task.risk == "critical" extra tokens here', // trailing junk
  ];
  for (const src of evil) it(`rejects ${JSON.stringify(src)}`, () => reject(src));

  it('rejects deep-path smuggling under an approved first segment', () => {
    reject('state.task.requirements[0].id == "R1"'); // brackets → stray char
    reject('state.requirements.length.length == 1'); // only the exact path is allowed
  });
});
