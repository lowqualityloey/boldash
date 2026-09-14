/**
 * Contract loading: read a done.schema.json file, validate against the
 * meta-schema (ajv, single trust gate), and resolve D1 templates.
 *
 * D1 ruling: exactly one template is legal — `{{task_id}}`, substituted with
 * the task under verification. ANY other `{{ }}` is rejected at load time with
 * VERIFY_CONTRACT_INVALID: an unresolved placeholder that survives to a check
 * silently passes/fails on a literal `{{...}}` string — a gate with a hole
 * you can't see (verification theater).
 */

import { readFileSync } from 'node:fs';
import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import { getValidator, firstError } from '../../shared/schema.js';
import type { NotCheck, PassCheck, VerificationContract } from './types.js';

const ANY_TEMPLATE = /\{\{\s*(?!task_id\s*\}\})[^{}]*\}\}/;

export function loadContract(
  path: string,
  taskId: string,
): Result<VerificationContract, ErrorInfo> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (cause) {
    return err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `cannot read contract ${path}: ${String(cause)}`,
      field: 'contract_path',
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return err({
      code: 'SCHEMA_PARSE',
      message: `contract ${path} is not valid JSON: ${String(cause)}`,
      field: 'contract_path',
    });
  }
  const validate = getValidator('doneContract');
  if (!validate(raw)) {
    return err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: firstError('doneContract', validate),
      field: 'contract_path',
      suggestion: 'Fix against schemas/done.schema.json (the meta-schema).',
    });
  }
  const contract = raw as VerificationContract;

  // task_id template (D1) — the only placeholder position allowed here.
  if (ANY_TEMPLATE.test(contract.task_id)) {
    return err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: 'unsupported template in task_id: only {{task_id}} is legal (D1).',
      field: 'task_id',
    });
  }
  const resolvedTaskId = contract.task_id === '{{task_id}}' ? taskId : contract.task_id;

  const failTemplate = (field: string): Result<never, ErrorInfo> =>
    err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `unsupported template in ${field}: only {{task_id}} is legal (D1).`,
      field,
    });

  /** Resolve {{task_id}} in one template-legal string field; refuse anything else. */
  const subst = (value: string, field: string): Result<string, ErrorInfo> =>
    ANY_TEMPLATE.test(value)
      ? failTemplate(field)
      : ok(value.replaceAll('{{task_id}}', resolvedTaskId));

  // Per-variant handling — exhaustive switch, so a future check type without a
  // resolution rule is a COMPILE error, not a silently unsubstituted template.
  const passCheck = (check: PassCheck, i: number): Result<PassCheck, ErrorInfo> => {
    switch (check.type) {
      case 'command': {
        const r = subst(check.run, `must_pass[${i}].run`);
        return r.ok ? ok({ ...check, run: r.data }) : r;
      }
      case 'regex_in_file': {
        const p = subst(check.path, `must_pass[${i}].path`);
        if (!p.ok) return p;
        const re = subst(check.pattern, `must_pass[${i}].pattern`);
        return re.ok ? ok({ ...check, path: p.data, pattern: re.data }) : re;
      }
      case 'state_check': {
        const r = subst(check.check, `must_pass[${i}].check`);
        return r.ok ? ok({ ...check, check: r.data }) : r;
      }
      case 'file_exists':
      case 'evidence_exists': {
        const r = subst(check.path, `must_pass[${i}].path`);
        return r.ok ? ok({ ...check, path: r.data }) : r;
      }
    }
  };

  const passChecks: PassCheck[] = [];
  for (const [i, check] of contract.must_pass.entries()) {
    const r = passCheck(check, i);
    if (!r.ok) return r;
    passChecks.push(r.data);
  }

  const negChecks: NotCheck[] = [];
  for (const [i, check] of (contract.must_not ?? []).entries()) {
    const r =
      check.type === 'command_fails'
        ? subst(check.run, `must_not[${i}].run`)
        : subst(check.path, `must_not[${i}].path`);
    if (!r.ok) return r;
    negChecks.push(
      check.type === 'command_fails'
        ? { ...check, run: r.data }
        : { ...check, path: r.data },
    );
  }

  const head = passChecks[0];
  if (!head) {
    return err({
      code: 'VERIFY_CONTRACT_INVALID',
      message: 'must_pass resolved to empty (meta-schema requires ≥1)',
      field: 'must_pass',
    });
  }
  return ok({
    task_id: resolvedTaskId,
    must_pass: [head, ...passChecks.slice(1)],
    ...(negChecks.length > 0 ? { must_not: negChecks } : {}),
  });
}
