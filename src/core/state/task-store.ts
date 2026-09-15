import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import { writeJsonAtomic } from '../../shared/fs.js';
import type { Clock } from '../../shared/clock.js';
import { getValidator, firstError } from '../../shared/schema.js';
import { allowedFrom, canTransition } from './transitions.js';
import type {
  Event,
  EventAction,
  NewTask,
  Requirement,
  Task,
  TaskStateFile,
  TaskStatus,
} from './types.js';

export interface TaskStorePaths {
  /** Absolute path to .boldash/state/tasks.json */
  stateFile: string;
  /** Absolute path to .boldash/events.jsonl */
  eventsFile: string;
}

export type StoreResult<T> = Result<T, ErrorInfo>;

const EMPTY: TaskStateFile = { schema_version: 1, tasks: [] };

function einfo(
  code: ErrorInfo['code'],
  message: string,
  extra: Partial<ErrorInfo> = {},
): ErrorInfo {
  return { code, message, ...extra };
}

function nextNumber(taskId: string): number {
  const m = /^TASK-(\d+)$/.exec(taskId);
  const n = m?.[1];
  return n === undefined ? 0 : Number(n);
}

/**
 * The only sanctioned writer of tasks.json (AGENTS.md §State mutations).
 * Every mutation: load → guard → bump version → validate → atomic write → event.
 */
export class TaskStore {
  private seq = 0;

  constructor(
    private readonly paths: TaskStorePaths,
    private readonly clock: Clock,
  ) {}

  // ---------- reads ----------

  load(): StoreResult<TaskStateFile> {
    if (!existsSync(this.paths.stateFile)) return ok(EMPTY);
    let raw: string;
    try {
      raw = readFileSync(this.paths.stateFile, 'utf8');
    } catch (cause) {
      return err(
        einfo('IO_ERROR', `cannot read ${this.paths.stateFile}: ${String(cause)}`),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return err(
        einfo('SCHEMA_PARSE', `tasks.json is not valid JSON: ${String(cause)}`, {
          field: this.paths.stateFile,
          suggestion:
            'Restore from Git. Boldash never rewrites corrupt state automatically.',
        }),
      );
    }
    const validate = getValidator('taskStateFile');
    if (!validate(parsed)) {
      const version = (parsed as { schema_version?: unknown }).schema_version;
      if (typeof version === 'number' && version !== 1) {
        return err(
          einfo(
            'SCHEMA_VERSION_MISMATCH',
            `tasks.json declares schema_version ${version}; this Boldash supports 1`,
            {
              field: `${this.paths.stateFile}.schema_version`,
              suggestion: 'Upgrade Boldash, or restore the file from an older commit.',
            },
          ),
        );
      }
      return err(
        einfo('SCHEMA_VALIDATION', firstError('taskStateFile', validate), {
          field: this.paths.stateFile,
        }),
      );
    }
    return ok(parsed as TaskStateFile);
  }

  get(taskId: string): StoreResult<Task> {
    const file = this.load();
    if (!file.ok) return file;
    const task = file.data.tasks.find((t) => t.id === taskId);
    if (!task) return this.notFound(taskId);
    return ok(task);
  }

  list(
    filter: Partial<Pick<Task, 'status' | 'risk' | 'type' | 'owner'>> = {},
  ): StoreResult<Task[]> {
    const file = this.load();
    if (!file.ok) return file;
    const tasks = file.data.tasks.filter((t) =>
      Object.entries(filter).every(
        ([k, v]) => v === undefined || t[k as keyof Task] === v,
      ),
    );
    return ok(tasks);
  }

  // ---------- mutations ----------

  create(input: NewTask, actor: string): StoreResult<Task> {
    const file = this.load();
    if (!file.ok) return file;
    const iso = this.clock.nowIso();
    const requirements = input.requirements ?? [];
    const task: Task = {
      schema_version: 1,
      id: this.nextId(file.data.tasks),
      title: input.title,
      type: input.type,
      risk: input.risk,
      level: input.level,
      status: 'proposed',
      requirements,
      version: 1,
      created_at: iso,
      updated_at: iso,
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.workflow ? { workflow: input.workflow } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
    };
    const checked = this.validateTask(task);
    if (!checked.ok) return checked;
    const saved = this.saveWith([...file.data.tasks, task]);
    if (!saved.ok) return saved;
    this.emit('task.created', task.id, actor, { risk: task.risk, level: task.level });
    return ok(task);
  }

  transition(
    taskId: string,
    to: TaskStatus,
    expectedVersion: number,
    actor: string,
    opts: { blockedReason?: string } = {},
  ): StoreResult<Task> {
    const found = this.findForWrite(taskId, expectedVersion);
    if (!found.ok) return found;
    const { file, idx, task } = found.data;

    if (!canTransition(task.status, to)) {
      return err(
        einfo(
          'STATE_INVALID_TRANSITION',
          `Cannot transition ${taskId} from '${task.status}' to '${to}'.`,
          {
            field: 'status',
            context: { [`allowed_from_${task.status}`]: allowedFrom(task.status) },
            suggestion: `Allowed targets from '${task.status}': ${allowedFrom(task.status).join(', ') || 'none (terminal)'}.`,
          },
        ),
      );
    }
    if (to === 'implementing' && task.requirements.length === 0) {
      return err(
        einfo(
          'STATE_MISSING_REQUIREMENT' satisfies ErrorInfo['code'],
          "Transition to 'implementing' requires at least one requirement.",
          {
            field: 'requirements',
            suggestion:
              'Add at least one requirement with `boldash state requirement add`.',
          },
        ),
      );
    }

    const reason = opts.blockedReason ?? null;
    if (to === 'blocked' && reason === null) {
      return err(
        einfo(
          'SCHEMA_VALIDATION',
          "Transition to 'blocked' requires a non-empty blockedReason.",
          {
            field: 'blocked_reason',
            suggestion: 'The blocked state must record why, and what unblocks it.',
          },
        ),
      );
    }

    const iso = this.clock.nowIso();
    const updated: Task = {
      ...task,
      status: to,
      version: task.version + 1,
      updated_at: iso,
      blocked_reason: to === 'blocked' ? reason : null,
      ...(to === 'complete' ? { completed_at: iso } : {}),
    };
    const checked = this.validateTask(updated);
    if (!checked.ok) return checked;
    const tasks = [...file.tasks];
    tasks[idx] = updated;
    const saved = this.saveWith(tasks);
    if (!saved.ok) return saved;
    this.emit('task.transitioned', updated.id, actor, {
      from: task.status,
      to,
      version: updated.version,
      ...(reason !== null && to === 'blocked' ? { reason } : {}),
    });
    return ok(updated);
  }

  addRequirement(
    taskId: string,
    req: Requirement,
    expectedVersion: number,
    actor: string,
  ): StoreResult<Task> {
    const found = this.findForWrite(taskId, expectedVersion);
    if (!found.ok) return found;
    const { file, idx, task } = found.data;
    if (task.requirements.some((r) => r.id === req.id)) {
      return err(
        einfo('SCHEMA_VALIDATION', `Requirement ${req.id} already exists on ${taskId}.`, {
          field: 'requirements',
        }),
      );
    }
    const updated: Task = {
      ...task,
      requirements: [...task.requirements, req],
      version: task.version + 1,
      updated_at: this.clock.nowIso(),
    };
    const checked = this.validateTask(updated);
    if (!checked.ok) return checked;
    const tasks = [...file.tasks];
    tasks[idx] = updated;
    const saved = this.saveWith(tasks);
    if (!saved.ok) return saved;
    this.emit('task.requirement_added', updated.id, actor, { requirement: req.id });
    return ok(updated);
  }

  addEvidence(
    taskId: string,
    requirementId: string,
    evidenceRef: string,
    expectedVersion: number,
    actor: string,
  ): StoreResult<Task> {
    const found = this.findForWrite(taskId, expectedVersion);
    if (!found.ok) return found;
    const { file, idx, task } = found.data;
    const rIdx = task.requirements.findIndex((r) => r.id === requirementId);
    if (rIdx < 0) {
      return err(
        einfo('EVIDENCE_NOT_FOUND', `No requirement ${requirementId} on ${taskId}.`, {
          field: 'requirements',
        }),
      );
    }
    const requirements = task.requirements.map((r, i) =>
      i === rIdx ? { ...r, evidence: [...(r.evidence ?? []), evidenceRef] } : r,
    );
    const updated: Task = {
      ...task,
      requirements,
      version: task.version + 1,
      updated_at: this.clock.nowIso(),
    };
    const checked = this.validateTask(updated);
    if (!checked.ok) return checked;
    const tasks = [...file.tasks];
    tasks[idx] = updated;
    const saved = this.saveWith(tasks);
    if (!saved.ok) return saved;
    this.emit('task.evidence_added', updated.id, actor, {
      requirement: requirementId,
      evidence: evidenceRef,
    });
    return ok(updated);
  }

  /** Read + validate the event log; optional filter by task id. */
  readEvents(taskId?: string): StoreResult<Event[]> {
    if (!existsSync(this.paths.eventsFile)) return ok([]);
    const events: Event[] = [];
    const validate = getValidator('event');
    const lines = readFileSync(this.paths.eventsFile, 'utf8')
      .split('\n')
      .filter((l) => l.length > 0);
    for (const [i, line] of lines.entries()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (cause) {
        return err(
          einfo(
            'EVENT_LOG_CORRUPT',
            `events.jsonl line ${i + 1} is not valid JSON: ${String(cause)}`,
            {
              field: `${this.paths.eventsFile}:${i + 1}`,
            },
          ),
        );
      }
      if (!validate(parsed)) {
        return err(
          einfo(
            'EVENT_LOG_CORRUPT',
            `events.jsonl line ${i + 1} fails event schema: ${firstError('event', validate)}`,
            {
              field: `${this.paths.eventsFile}:${i + 1}`,
            },
          ),
        );
      }
      const ev = parsed as Event;
      if (!taskId || ev.task === taskId) events.push(ev);
    }
    return ok(events);
  }

  /**
   * Public event-logging seam (MS-6 S3): the router and gate are stateless by
   * ruling D-3 — the CLI owns audit logging, and every state write must be
   * recorded as an event (AGENTS §State mutations). This is the ONE sanctioned
   * way for a caller to append events without mutating a task (e.g. pairing
   * an EvidenceStore write, per evidence.ts §"callers pair"). The event is
   * built and validated by the same private pipeline every mutation uses.
   */
  logEvent(
    action: EventAction,
    taskId: string | null,
    actor: string,
    payload: Record<string, unknown> = {},
  ): StoreResult<true> {
    try {
      this.emit(action, taskId, actor, payload);
    } catch (cause) {
      // emit throws only on internally invalid events — a bug, surfaced as a
      // value at this boundary, never swallowed (AGENTS §Error handling).
      return err(einfo('INTERNAL_ERROR', String(cause), { field: 'event' }));
    }
    return ok(true);
  }

  // ---------- internals ----------

  /** Load, locate task, and enforce the optimistic version guard in one step. */
  private findForWrite(
    taskId: string,
    expectedVersion: number,
  ): StoreResult<{ file: TaskStateFile; idx: number; task: Task }> {
    const loaded = this.load();
    if (!loaded.ok) return loaded;
    const file = loaded.data;
    const idx = file.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return this.notFound(taskId);
    const task = file.tasks[idx];
    if (!task) return this.notFound(taskId);
    if (task.version !== expectedVersion) {
      return err(
        einfo(
          'CONCURRENT_MODIFICATION',
          `Task ${taskId} was modified by another actor.`,
          {
            field: 'version',
            context: { expected_version: expectedVersion, current_version: task.version },
            suggestion: 'Re-read the task and reapply your change.',
          },
        ),
      );
    }
    return ok({ file, idx, task });
  }

  private saveWith(tasks: Task[]): StoreResult<true> {
    const next: TaskStateFile = { schema_version: 1, tasks };
    const validate = getValidator('taskStateFile');
    if (!validate(next)) {
      return err(
        einfo(
          'SCHEMA_VALIDATION',
          `refusing to write invalid state: ${firstError('taskStateFile', validate)}`,
          {
            field: this.paths.stateFile,
            suggestion: 'State that fails validation is never written.',
          },
        ),
      );
    }
    try {
      mkdirSync(dirname(this.paths.stateFile), { recursive: true });
      writeJsonAtomic(this.paths.stateFile, next);
    } catch (cause) {
      return err(
        einfo('IO_ERROR', `could not write ${this.paths.stateFile}: ${String(cause)}`, {
          field: this.paths.stateFile,
        }),
      );
    }
    return ok(true);
  }

  private validateTask(task: Task): StoreResult<true> {
    const validate = getValidator('task');
    if (!validate(task)) {
      return err(
        einfo('SCHEMA_VALIDATION', firstError('task', validate), {
          suggestion:
            'The constructed task violates task.schema.json — a state-engine bug or bad input.',
        }),
      );
    }
    return ok(true);
  }

  private emit(
    action: EventAction,
    taskId: string | null,
    actor: string,
    payload: Record<string, unknown>,
  ): void {
    const event: Event = {
      id: this.nextEventId(),
      ts: this.clock.nowIso(),
      task: taskId,
      action,
      actor,
      payload,
    };
    const validate = getValidator('event');
    if (!validate(event)) {
      // Programming bug, not user input: failing loud beats a silently corrupt audit trail (P10).
      throw new Error(
        `INTERNAL: refusing to emit invalid event: ${firstError('event', validate)}`,
      );
    }
    mkdirSync(dirname(this.paths.eventsFile), { recursive: true });
    appendFileSync(this.paths.eventsFile, `${JSON.stringify(event)}\n`, 'utf8');
  }

  private nextId(tasks: Task[]): string {
    const nums = tasks.map((t) => nextNumber(t.id)).filter((n) => n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return `TASK-${String(max + 1).padStart(3, '0')}`;
  }

  private nextEventId(): string {
    this.seq += 1;
    return `evt_${this.clock.nowEpochMs().toString(36)}${this.seq.toString(36)}`.toLowerCase();
  }

  private notFound(taskId: string): StoreResult<never> {
    return err(
      einfo('STATE_TASK_NOT_FOUND', `No task with id ${taskId}.`, {
        field: 'task_id',
        suggestion: 'Run `boldash state list` to see existing tasks.',
      }),
    );
  }
}
