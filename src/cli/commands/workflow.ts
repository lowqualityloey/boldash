/**
 * `boldash workflow list|validate` (MS-6 S2) — read-only view of the built-in
 * workflow registry. R1 (NOTES §4): the RFC's four built-ins
 * (`feature, bugfix, docs, chore`) are canonical; `list` shows them with
 * their requirements (docs/cli-reference.md §workflow).
 *
 * **What `validate` checks in v0.1.0** (resolves the open question carried in
 * checkpoint-001): packs are typed constants — ruling D-2 defers the pack
 * *file* format (manifest.yaml) to MS-8, and `schemas/workflow.schema.json`
 * does not exist — so the honest validation surface is the registry entry
 * itself: structural integrity of the {@link WorkflowPack}, then capability
 * satisfiability against the generic-host floor (MS-7 replaces the floor with
 * probed hosts). cli-reference's manifest/done-schema wording is patched in
 * S5. Exit contract (plan-001 §3 S2): 0 valid · 2 unknown/structurally
 * broken · 3 required capability the host does not provide.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  createRegistry,
  genericContext,
  missingCapabilities,
} from '../../core/router/index.js';
import type { LifecycleStage, WorkflowPack } from '../../core/router/index.js';
import { getValidator, firstError } from '../../shared/schema.js';
import type { ErrorInfo } from '../../shared/result.js';
import type { Envelope, RunContext } from '../types.js';

/** Exhaustiveness-checked stage set (adds `never` if the type grows). */
const LIFECYCLE_STAGES: Record<LifecycleStage, true> = {
  DISCOVER: true,
  PLAN: true,
  BUILD: true,
  VERIFY: true,
  SHIP: true,
  LEARN: true,
};

const DEFAULT_REGISTRY = createRegistry();

function fail(error: ErrorInfo): Envelope {
  return { ok: false, error };
}

function usage(message: string, field: string, suggestion: string): Envelope {
  return fail({ code: 'CLI_USAGE', message, field, suggestion });
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function nonEmptyStrings(values: readonly string[]): string | undefined {
  const blank = values.find((v) => v.trim().length === 0);
  if (blank !== undefined) return 'entries must be non-empty strings';
  const dupes = values.filter((v, i) => values.indexOf(v) !== i);
  if (dupes.length > 0) return `duplicate entries: ${[...new Set(dupes)].join(', ')}`;
  return undefined;
}

/**
 * Validate one workflow pack definition: structure first (exit-2 codes),
 * then mandatory-capability satisfiability on the generic host (exit 3).
 * Pure and deterministic — returns the pack unchanged when it passes.
 */
export function validateWorkflowPack(pack: WorkflowPack):
  | {
      ok: true;
      data: WorkflowPack;
    }
  | {
      ok: false;
      error: ErrorInfo;
    } {
  const name =
    typeof pack.name === 'string' && pack.name.trim().length > 0 ? pack.name : undefined;
  if (!name) {
    return failStructural('name', 'name must be a non-empty string');
  }
  if (!Number.isInteger(pack.version) || pack.version < 1) {
    return failStructural('version', 'version must be an integer >= 1', name);
  }
  if (!(pack.lifecycle in LIFECYCLE_STAGES)) {
    return failStructural(
      'lifecycle',
      `lifecycle must be one of: ${Object.keys(LIFECYCLE_STAGES).join(', ')}`,
      name,
    );
  }
  if (typeof pack.description !== 'string' || pack.description.trim().length === 0) {
    return failStructural('description', 'description must be a non-empty string', name);
  }
  for (const field of ['requires', 'optional'] as const) {
    const values = pack[field];
    if (!isStringArray(values)) {
      return failStructural(field, `${field} must be an array of strings`, name);
    }
    const bad = nonEmptyStrings(values);
    if (bad) return failStructural(field, bad, name);
  }
  const overlap = pack.requires.filter((c) => pack.optional.includes(c));
  if (overlap.length > 0) {
    return failStructural(
      'optional',
      `capabilities cannot be both required and optional: ${overlap.join(', ')}`,
      name,
    );
  }

  // Capability floor check — host unknown until MS-7, so the honest context
  // is genericContext(). An unprobed capability is assumed unavailable
  // (router/capabilities.ts §5.4): fail-closed, matching route step 5.
  const missing = missingCapabilities(pack.requires, genericContext());
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'CAPABILITY_MISSING',
        message: `Workflow '${name}' requires '${missing[0]}', which this host does not provide.`,
        field: 'workflow.requires',
        context: { missing, host: 'generic' },
        suggestion: `The generic host floor provides: ${[...genericContext().capabilities].join(', ')}.`,
      },
    };
  }
  return { ok: true, data: pack };
}

function failStructural(
  field: string,
  message: string,
  name = '?',
): {
  ok: false;
  error: ErrorInfo;
} {
  return {
    ok: false,
    error: {
      code: 'SCHEMA_VALIDATION',
      message: `workflow pack '${name}' is invalid: ${message}`,
      field: `workflow.${field}`,
      suggestion: 'Built-in packs are validated by tests at every change.',
    },
  };
}

/** Runner for `boldash workflow list`. */
export function runWorkflowList(ctx: RunContext): Envelope {
  const [extra] = ctx.positionals;
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'workflow list',
      'Usage: boldash workflow list.',
    );
  }
  const workflows = DEFAULT_REGISTRY.names().flatMap((n) => {
    const pack = DEFAULT_REGISTRY.get(n);
    return pack ? [pack] : [];
  });
  return { ok: true, data: { workflows } };
}

/** Runner for `boldash workflow validate <name>`. */
export function runWorkflowValidate(ctx: RunContext): Envelope {
  const [name, extra] = ctx.positionals;
  if (!name) {
    return usage(
      'workflow validate requires a workflow name.',
      'workflow',
      'Usage: boldash workflow validate <name>.',
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'workflow',
      'Usage: boldash workflow validate <name>.',
    );
  }
  const pack = DEFAULT_REGISTRY.get(name);
  if (!pack) {
    return fail({
      code: 'WORKFLOW_NOT_FOUND',
      message: `Workflow '${name}' is not enabled.`,
      field: 'workflow',
      context: { enabled: DEFAULT_REGISTRY.names() },
      suggestion: 'Choose from the enabled workflows (`boldash workflow list`).',
    });
  }
  const validated = validateWorkflowPack(pack);
  if (!validated.ok) return fail(validated.error);
  return { ok: true, data: { valid: true, workflow: validated.data } };
}

const ANY_TEMPLATE = /\{\{\s*(?!task_id\s*\}\})[^{}]*\}\}/;

function templateError(field: string): ErrorInfo {
  return {
    code: 'VERIFY_CONTRACT_INVALID',
    message: `unsupported template in ${field}: only {{task_id}} is legal (D1).`,
    field,
  };
}

function hasBadTemplate(value: unknown, field: string): ErrorInfo | null {
  if (typeof value === 'string' && ANY_TEMPLATE.test(value)) return templateError(field);
  return null;
}

/**
 * Runner for `boldash workflow import <path>` (MS-6 S4).
 *
 * S4 scope (plan-001 §3, checkpoint-003): schema-validated pack import,
 * exits 0/2/3. Core never parses YAML, and the v1 Markdown importer is
 * MS-8 — so `<path>` is a JSON file (pack definition and/or done contract)
 * or a directory containing `done.schema.json` plus an optional
 * `pack.json`/`manifest.json`. The importer emits a CONSERVATIVE STUB
 * contract: `command` / `command_fails` checks are never copied (they would
 * execute arbitrary commands); only side-effect-free checks travel, and an
 * import with no safe checks still ships a single `evidence_exists` stub so
 * the file satisfies the meta-schema (≥1 must_pass). The count of skipped
 * runnable checks is reported — never silently expanded.
 *
 * `workflow list` is unchanged (packs stay typed constants until MS-8);
 * the import surface is the written files.
 */
export function runWorkflowImport(ctx: RunContext): Envelope {
  const [source, extra] = ctx.positionals;
  if (!source) {
    return usage(
      'workflow import requires a path.',
      'workflow',
      'Usage: boldash workflow import <path>.',
    );
  }
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'workflow',
      'Usage: boldash workflow import <path>.',
    );
  }
  const cwd = ctx.globals.cwd;
  if (!existsSync(join(cwd, '.boldash'))) {
    return fail({
      code: 'CLI_PRECONDITION_FAILED',
      message: 'This repository is not initialized (.boldash/ not found).',
      field: '.boldash',
      suggestion: 'Run `boldash init` first.',
      context: { cwd },
    });
  }
  const abs = resolve(cwd, source);
  let isDir: boolean;
  try {
    isDir = statSync(abs).isDirectory();
  } catch {
    return fail({
      code: 'VERIFY_CONTRACT_INVALID',
      message: `Import path '${source}' does not exist.`,
      field: 'path',
      suggestion: 'Point at a JSON pack file or a directory with done.schema.json.',
    });
  }

  let packRaw: unknown = null;
  let contractRaw: unknown = null;
  try {
    if (isDir) {
      const manifestPath = join(abs, 'pack.json');
      const altManifest = join(abs, 'manifest.json');
      if (existsSync(manifestPath)) {
        packRaw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
      } else if (existsSync(altManifest)) {
        packRaw = JSON.parse(readFileSync(altManifest, 'utf8')) as unknown;
      }
      const contractOrigin = join(abs, 'done.schema.json');
      if (!existsSync(contractOrigin)) {
        return fail({
          code: 'VERIFY_CONTRACT_INVALID',
          message: `Directory '${source}' has no done.schema.json.`,
          field: 'path',
          suggestion: 'Add done.schema.json, or point at a pack JSON file.',
        });
      }
      contractRaw = JSON.parse(readFileSync(contractOrigin, 'utf8')) as unknown;
    } else {
      const parsed = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
      if (Array.isArray((parsed as { must_pass?: unknown }).must_pass)) {
        contractRaw = parsed;
      } else {
        packRaw = parsed;
        if (parsed['contract'] !== undefined) contractRaw = parsed['contract'];
      }
    }
  } catch (cause) {
    return fail({
      code: 'SCHEMA_PARSE',
      message: `Import source is not valid JSON: ${String(cause)}`,
      field: 'path',
    });
  }

  const fallbackName = basename(abs, '.json') || 'imported';
  const packObj = (packRaw ?? {}) as Record<string, unknown>;
  const rawName = packObj['name'];
  const name =
    typeof rawName === 'string' && rawName.trim().length > 0
      ? rawName.trim()
      : fallbackName;
  if (name.includes('/') || name.includes('\\') || name.trim().length === 0) {
    return fail({
      code: 'SCHEMA_VALIDATION',
      message: `Pack name '${name}' is not a valid workflow name.`,
      field: 'name',
      suggestion: 'Use a short kebab-case name (e.g. my-workflow).',
    });
  }

  const pack: WorkflowPack = {
    name,
    version: typeof packObj['version'] === 'number' ? (packObj['version'] as number) : 1,
    lifecycle: (packObj['lifecycle'] as LifecycleStage) ?? 'BUILD',
    requires: Array.isArray(packObj['requires'])
      ? (packObj['requires'] as string[])
      : ['filesystem.read', 'filesystem.write'],
    optional: Array.isArray(packObj['optional']) ? (packObj['optional'] as string[]) : [],
    description:
      typeof packObj['description'] === 'string' &&
      (packObj['description'] as string).length > 0
        ? (packObj['description'] as string)
        : `Imported workflow ${name}.`,
  };
  const checked = validateWorkflowPack(pack);
  if (!checked.ok) return fail(checked.error);

  let skippedCommands = 0;
  let stub: { task_id: string; must_pass: unknown[]; must_not?: unknown[] };
  if (contractRaw !== null) {
    const validate = getValidator('doneContract');
    if (!validate(contractRaw)) {
      return fail({
        code: 'VERIFY_CONTRACT_INVALID',
        message: firstError('doneContract', validate),
        field: 'contract_path',
        suggestion: 'Fix against schemas/done.schema.json (the meta-schema).',
      });
    }
    const contract = contractRaw as {
      task_id: unknown;
      must_pass: Array<Record<string, unknown>>;
      must_not?: Array<Record<string, unknown>>;
    };
    const badTask = hasBadTemplate(contract.task_id, 'task_id');
    if (badTask) return fail(badTask);
    const safePass: Array<Record<string, unknown>> = [];
    for (const [i, check] of contract.must_pass.entries()) {
      for (const f of ['run', 'path', 'pattern', 'check'] as const) {
        const bad =
          check[f] !== undefined
            ? hasBadTemplate(check[f], `must_pass[${i}].${f}`)
            : null;
        if (bad) return fail(bad);
      }
      if (check['type'] === 'command') {
        skippedCommands += 1;
        continue;
      }
      safePass.push(check);
    }
    const safeNeg: Array<Record<string, unknown>> = [];
    for (const [i, check] of (contract.must_not ?? []).entries()) {
      for (const f of ['run', 'path'] as const) {
        const bad =
          check[f] !== undefined ? hasBadTemplate(check[f], `must_not[${i}].${f}`) : null;
        if (bad) return fail(bad);
      }
      if (check['type'] === 'command_fails') {
        skippedCommands += 1;
        continue;
      }
      safeNeg.push(check);
    }
    stub =
      safePass.length > 0
        ? {
            task_id: '{{task_id}}',
            must_pass: safePass,
            ...(safeNeg.length > 0 ? { must_not: safeNeg } : {}),
          }
        : {
            task_id: '{{task_id}}',
            must_pass: [
              {
                type: 'evidence_exists',
                name: `import recorded for ${name}`,
                path: 'import',
              },
            ],
          };
    if (safePass.length === 0) skippedCommands = contract.must_pass.length - 0;
  } else {
    stub = {
      task_id: '{{task_id}}',
      must_pass: [
        { type: 'evidence_exists', name: `import recorded for ${name}`, path: 'import' },
      ],
    };
  }

  const destDir = join(cwd, '.boldash', 'workflows', name);
  const destContract = join(destDir, 'done.schema.json');
  const destManifest = join(destDir, 'manifest.json');
  const overwrote = existsSync(destContract) || existsSync(destManifest);
  mkdirSync(destDir, { recursive: true });
  writeFileSync(destContract, `${JSON.stringify(stub, null, 2)}\n`, 'utf8');
  writeFileSync(
    destManifest,
    `${JSON.stringify({ name: pack.name, version: pack.version, lifecycle: pack.lifecycle, requires: pack.requires, optional: pack.optional, description: pack.description }, null, 2)}\n`,
    'utf8',
  );
  return {
    ok: true,
    data: {
      imported: true,
      workflow: name,
      dir: destDir,
      contract: destContract,
      stubbed: true,
      skipped_commands: skippedCommands,
      overwrote,
      note: 'Conservative stub: runnable command checks are never imported. `workflow list` still shows the 4 built-ins until MS-8.',
    },
  };
}
