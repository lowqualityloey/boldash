/**
 * State-engine scaffold (MS-6 S1) — the ONLY sanctioned writer of the
 * initial `.boldash/` layout. Direct `fs.writeFile` on `.boldash/state/`
 * is forbidden (AGENTS.md §State mutations), so `boldash init` calls this.
 *
 * Shapes: tasks.json is schema-validated before write (same discipline as
 * TaskStore). decisions.json/evidence.json use the engine-defined container
 * shapes (EvidenceStore §header). project.json is a role stub: profile +
 * empty capability list, to be filled by the MS-7 capability probe
 * (ARCHITECTURE.md step "Write capabilities to project.json").
 * config.yaml is a literal template written NOT parsed — the core has no
 * YAML parser and ajv is the sole runtime dependency (ADR-0003).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import { writeJsonAtomic } from '../../shared/fs.js';
import type { Clock } from '../../shared/clock.js';
import { getValidator, firstError } from '../../shared/schema.js';

export const PROFILES = ['lite', 'balanced', 'strict', 'accelerated'] as const;
export type Profile = (typeof PROFILES)[number];

export interface ScaffoldInput {
  /** Absolute path of the `.boldash/` directory to create. */
  boldashDir: string;
  profile: Profile;
  /** Forced host adapter name; omitted = auto-detect, which is MS-7 scope. */
  host?: string;
  /**
   * Probed capability names written to `project.json` (MS-7 S2). Plain
   * strings — never adapter types — so core keeps zero knowledge of
   * `src/adapters/` (architecture rule 8). Omitted = unprobed floor.
   */
  capabilities?: readonly string[];
}

export interface ScaffoldResult {
  created: string[];
}

function ioFail(what: string, cause: unknown): Result<never, ErrorInfo> {
  return err({
    code: 'IO_ERROR',
    message: `cannot initialize ${what}: ${String(cause)}`,
    field: what,
    suggestion: 'Check permissions and available disk space, then re-run.',
  });
}

/**
 * Create the `.boldash/` tree with schema-valid, empty state files.
 * Fails closed: a validated payload is never written, and any fs error is
 * returned as an IO_ERROR result — never thrown.
 */
export function scaffoldProjectState(
  input: ScaffoldInput,
  clock: Clock,
): Result<ScaffoldResult, ErrorInfo> {
  const { boldashDir, profile } = input;
  const stateDir = join(boldashDir, 'state');
  const evidenceDir = join(boldashDir, 'evidence');
  const created: string[] = [];

  try {
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(evidenceDir, { recursive: true });
  } catch (cause) {
    return ioFail(boldashDir, cause);
  }

  const tasksFile = join(stateDir, 'tasks.json');
  const tasksPayload = { schema_version: 1, tasks: [] };
  const validateTasks = getValidator('taskStateFile');
  if (!validateTasks(tasksPayload)) {
    return err({
      code: 'SCHEMA_VALIDATION',
      message: `refusing to write invalid scaffold: ${firstError('taskStateFile', validateTasks)}`,
      field: tasksFile,
    });
  }
  try {
    writeJsonAtomic(tasksFile, tasksPayload);
    created.push('state/tasks.json');
  } catch (cause) {
    return ioFail(tasksFile, cause);
  }

  const eventsFile = join(boldashDir, 'events.jsonl');
  try {
    // never truncate an existing audit trail — creation is idempotent
    if (!existsSync(eventsFile)) {
      writeFileSync(eventsFile, '', 'utf8');
      created.push('events.jsonl');
    }
  } catch (cause) {
    return ioFail(eventsFile, cause);
  }

  const others: Array<[string, Record<string, unknown>]> = [
    [
      join(stateDir, 'project.json'),
      {
        schema_version: 1,
        profile,
        capabilities: [...(input.capabilities ?? [])],
        created_at: clock.nowIso(),
      },
    ],
    [join(stateDir, 'decisions.json'), { schema_version: 1, decisions: [] }],
    [join(stateDir, 'evidence.json'), { schema_version: 1, entries: [] }],
  ];
  for (const [path, payload] of others) {
    try {
      writeJsonAtomic(path, payload);
      created.push(path.slice(boldashDir.length + 1));
    } catch (cause) {
      return ioFail(path, cause);
    }
  }

  const configFile = join(boldashDir, 'config.yaml');
  try {
    const template = [
      '# Boldash project configuration — written by `boldash init`.',
      '# Read by the MS-7 config/profile UX; the v0.1.0 core never parses YAML (ADR-0003).',
      `profile: ${profile}`,
      ...(input.host ? [`host: ${input.host}`] : ['# host: auto (MS-7 detection)']),
      '',
    ].join('\n');
    if (!existsSync(configFile) || readFileSync(configFile, 'utf8') !== template) {
      writeFileSync(configFile, template, 'utf8');
      created.push('config.yaml');
    }
  } catch (cause) {
    return ioFail(configFile, cause);
  }

  return ok({ created });
}
