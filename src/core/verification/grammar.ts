/**
 * The constrained state-expression grammar (MS-5 slice 1, ruling D2).
 *
 * docs/verification-guide.md defers the full grammar to docs/state-model.md,
 * which does not exist yet (#13). This module is the de-facto v0.1.0 subset —
 * deliberately tiny, closed, and **never** `eval`/`Function`-backed:
 * contract strings arrive from JSON authored by agents, so evaluating them
 * would be remote code execution wearing a "check" costume (SECURITY.md §1).
 *
 * Accepted forms (whitespace-insensitive):
 *   state.task.<field> == <literal>        state.task.<field> != <literal>
 *   state.requirements.length <op> <number>   where <op> ∈ == != < <= > >=
 *
 * <field> is the scalar allowlist below; <literal> is a quoted string,
 * number, `true`, `false`, or `null`. Anything else — unknown paths, other
 * roots, boolean AND/OR, parens, function calls, injections — fails closed
 * with VERIFY_CONTRACT_INVALID pointing at #13, never a permissive default.
 *
 * Equality semantics: `==` requires same-type values (string vs number is
 * always unequal); `!=` is its exact negation. No coercion, no loose compare.
 */

import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Task } from '../state/types.js';

/** Scalars safe to compare — derived from schemas/task.schema.json scalar fields. */
const SCALAR_FIELDS = [
  'id',
  'title',
  'type',
  'risk',
  'level',
  'status',
  'workflow',
  'owner',
  'summary',
  'version',
  'blocked_reason',
  'created_at',
  'updated_at',
  'completed_at',
] as const;

type ScalarField = (typeof SCALAR_FIELDS)[number];

type EqOp = '==' | '!=';
type CmpOp = EqOp | '<' | '<=' | '>' | '>=';

export type Literal = string | number | boolean | null;

export interface StateExpression {
  /** Evaluate against the task under verification. Total: never throws. */
  evaluate(task: Task): boolean;
  /** Canonical rendering for explain output (P10). */
  readonly source: string;
}

function invalid(src: string, detail: string): Result<never, ErrorInfo> {
  return err({
    code: 'VERIFY_CONTRACT_INVALID',
    message: `state expression rejected: ${detail}. Grammar reserved for docs/state-model.md (#13); v0.1.0 subset only.`,
    field: 'check',
    context: { expression: src },
    suggestion:
      'Use: state.task.<field> == |!= literal  OR  state.requirements.length < == != < <= > >= N',
  });
}

/** Tokenizer: strict regex scan; anything unmatched is a rejection, not skipped. */
const TOKEN =
  /^\s*(?:(==|!=|<=|>=|[<>])|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null|[A-Za-z_][A-Za-z0-9_.]*)|(.))/;

interface Token {
  kind: 'op' | 'word' | 'literal';
  value: string;
}

function tokenize(src: string): Token[] | undefined {
  const tokens: Token[] = [];
  let rest = src;
  while (rest.trim().length > 0) {
    const m = TOKEN.exec(rest);
    if (!m || m.index !== 0) return undefined;
    const op = m[1];
    const atom = m[2];
    const bad = m[3];
    if (bad) return undefined; // stray character: reject, never skip
    if (op) tokens.push({ kind: 'op', value: op });
    else if (atom)
      tokens.push({
        kind: /^(?:'|"|-?\d|true$|false$|null$)/.test(atom) ? 'literal' : 'word',
        value: atom,
      });
    else return undefined;
    rest = rest.slice(m[0].length);
  }
  return tokens;
}

function parseLiteral(raw: string): Literal | undefined {
  if (/^'.*'$/.test(raw) || /^".*"$/.test(raw)) return raw.slice(1, -1);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function scalarOf(task: Task, field: ScalarField): Literal | undefined {
  const v: unknown = task[field];
  return typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v === null
    ? v
    : undefined;
}

function eq(op: EqOp, left: Literal, right: Literal): boolean {
  const same = left === right;
  return op === '==' ? same : !same;
}

/**
 * Parse one expression. Called once at contract-load time (fail fast, before
 * any command runs); the returned evaluator is pure over the task.
 */
export function parseStateExpression(src: string): Result<StateExpression, ErrorInfo> {
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return invalid(src, 'empty or unrecognized tokens');

  // Form A: state.task.<field> == |!= literal   (3 tokens: path op value).
  // Only claims paths it owns: anything NOT starting with `state.` must fall
  // through so a mistyped Form-B path still reaches the specific handler.
  if (tokens.length === 3) {
    const [path, opTok, litTok] = [tokens[0], tokens[1], tokens[2]];
    const isTaskPath = path?.kind === 'word' && path.value.startsWith('state.task.');
    if (
      isTaskPath &&
      opTok?.kind === 'op' &&
      (opTok.value === '==' || opTok.value === '!=') &&
      litTok?.kind === 'literal'
    ) {
      const lit = parseLiteral(litTok.value);
      if (lit === undefined) return invalid(src, `bad literal ${litTok.value}`);
      const segments = path.value.split('.');
      if (segments.length !== 3) {
        return invalid(src, `path '${path.value}' is not state.task.<field>`);
      }
      const field = segments[2];
      if (!SCALAR_FIELDS.includes(field as ScalarField)) {
        return invalid(src, `field '${field}' is not a comparable scalar`);
      }
      const f = field as ScalarField;
      const op = opTok.value as EqOp;
      return ok({
        source: src,
        evaluate: (task) => eq(op, scalarOf(task, f) ?? null, lit),
      });
    }
  }

  // Form B: state.requirements.length <cmp> <number>   (3 tokens)
  if (tokens.length === 3) {
    const [path, opTok, numTok] = [tokens[0], tokens[1], tokens[2]];
    if (
      path?.kind === 'word' &&
      path.value === 'state.requirements.length' &&
      opTok?.kind === 'op' &&
      numTok?.kind === 'literal'
    ) {
      const n = parseLiteral(numTok.value);
      if (typeof n !== 'number')
        return invalid(src, 'length comparisons require a number');
      const cmp = opTok.value as CmpOp;
      return ok({
        source: src,
        evaluate: (task) => {
          const len = task.requirements.length;
          switch (cmp) {
            case '==':
              return len === n;
            case '!=':
              return len !== n;
            case '<':
              return len < n;
            case '<=':
              return len <= n;
            case '>':
              return len > n;
            case '>=':
              return len >= n;
          }
        },
      });
    }
  }

  return invalid(src, 'does not match the v0.1.0 subset grammar');
}
