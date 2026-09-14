/**
 * ajv seam (ADR 0003): the ONLY module importing ajv. Engines receive
 * validators compiled here; swapping the validator library later touches
 * exactly this file. Draft-07 is ajv@8's default — no ajv-formats is
 * deliberate: date-times are ISO-pattern validated, keeping ajv the
 * single runtime dependency (AGENTS.md §Security: dependencies are liabilities).
 */
import type { ValidateFunction } from 'ajv';
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Validator = ValidateFunction;

// src/shared/schema.ts → repo root is two levels up (src/shared → src → boldash).
const SCHEMA_DIR = fileURLToPath(new URL('../../schemas/', import.meta.url));

/** Canonical registry of v0.1.0 schema ids → files. */
export const SCHEMA_FILES = {
  route: 'route.schema.json',
  task: 'task.schema.json',
  taskStateFile: 'task-state-file.schema.json',
  doneContract: 'done.schema.json',
  event: 'event.schema.json',
} as const;

export type SchemaName = keyof typeof SCHEMA_FILES;

let cached: Map<SchemaName, ValidateFunction> | null = null;

export function loadSchemaText(name: SchemaName): string {
  return readFileSync(`${SCHEMA_DIR}${SCHEMA_FILES[name]}`, 'utf8');
}

/** Compile all five schemas once per process; strict mode surfaces typos loudly. */
export function getValidator(name: SchemaName): ValidateFunction {
  if (!cached) {
    const ajv = new Ajv({ allErrors: true, strict: true });
    const compiled = new Map<SchemaName, ValidateFunction>();
    for (const key of Object.keys(SCHEMA_FILES) as SchemaName[]) {
      const schema = JSON.parse(loadSchemaText(key));
      const validate = ajv.compile(schema);
      compiled.set(key, validate);
    }
    cached = compiled;
  }
  const v = cached.get(name);
  if (!v) throw new Error(`schema '${name}' failed to compile — impossible after init`);
  return v;
}

export function firstError(name: SchemaName, validate: ValidateFunction): string {
  const e = validate.errors?.[0];
  if (!e) return `${name}: validator reported no error detail`;
  return `${name}${e.instancePath ? ` at ${e.instancePath}` : ''}: ${e.message ?? 'invalid'}`;
}
