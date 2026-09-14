/**
 * Evidence store (MS-5 slice 2) — layout per ARCHITECTURE.md §7.1/§8.2:
 *
 *   .boldash/evidence/<TASK-id>/<kind>-<seq>.json   payload files
 *   .boldash/state/evidence.json                    the index (sole read path)
 *
 * Guarantees, in priority order:
 * 1. **Raw secrets never land on disk.** Every payload is redaction-checked
 *    after serialization; anything secret-shaped surviving redaction aborts
 *    the write with EVIDENCE_REDACTION_FAILED. This is a store-level
 *    guarantee, not a caller convention — the command runner (slice 3) is
 *    expected to pre-redact, and the store re-checks independently.
 * 2. **Path safety.** `kind` and `taskId` are validated before joining —
 *    `../evil` kinds are rejected, not written outside the tree.
 * 3. **Pre-flight then order:** the secret scan runs on the fully serialized
 *    record *before* any write, so a refused payload creates no file at all.
 *    When a write proceeds it is payload first, index second; a crash between
 *    leaves an orphaned payload (recoverable noise) — never an index entry
 *    pointing at nothing.
 * 4. **Ids:** `EVID-<kind>-<seq>`, seq = per-(task,kind) max+1 derived from
 *    the index — stable without trusting a clock.
 *
 * The store never emits events; callers pair writes with task.evidence_added
 * through the State Engine (single-writer discipline).
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { err, ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { ErrorInfo } from '../../shared/result.js';
import { writeJsonAtomic } from '../../shared/fs.js';
import type { Clock } from '../../shared/clock.js';
import { containsSecretShape } from './redact.js';

const TASK_ID_RE = /^TASK-[0-9A-Za-z-]+$/;
const KIND_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export interface EvidenceRecord {
  id: string;
  kind: string;
  task: string | null;
  created_at: string;
  summary: string;
  payload_ref: string;
  [extra: string]: unknown;
}

interface EvidenceIndex {
  schema_version: 1;
  entries: EvidenceRecord[];
}

export interface NewEvidence {
  kind: string;
  task: string | null;
  summary: string;
  /** Structured extras (command, exit_code, redaction_count…) — serialized verbatim. */
  fields?: Record<string, unknown>;
}

export type EvidenceResult = Result<EvidenceRecord, ErrorInfo>;

function fail(
  code: ErrorInfo['code'],
  message: string,
  extra: Partial<ErrorInfo> = {},
): Result<never, ErrorInfo> {
  return err({ code, message, ...extra });
}

export class EvidenceStore {
  private readonly rootDir: string;
  private readonly stateDir: string;
  private readonly indexPath: string;

  constructor(
    private readonly boldashRoot: string, // the .boldash/ directory
    private readonly clock: Clock,
  ) {
    this.rootDir = join(boldashRoot, 'evidence');
    this.stateDir = join(boldashRoot, 'state');
    this.indexPath = join(this.stateDir, 'evidence.json');
  }

  /** Evidence kinds currently recorded for a task — the evidence_exists oracle.
   * A corrupt index throws through readIndex by design: an unknown history is
   * never reported as "no evidence". */
  kindsFor(taskId: string): Set<string> {
    return new Set(
      this.readIndex()
        .filter((e) => e.task === taskId)
        .map((e) => e.kind),
    );
  }

  entriesFor(taskId: string): EvidenceRecord[] {
    return this.readIndex().filter((e) => e.task === taskId);
  }

  record(input: NewEvidence): EvidenceResult {
    if (!KIND_RE.test(input.kind)) {
      return fail(
        'SCHEMA_VALIDATION',
        `evidence kind '${input.kind}' is not [a-z0-9-] shaped`,
        { field: 'kind', suggestion: 'Use kinds like review, test-run, secret-scan.' },
      );
    }
    if (input.task !== null && !TASK_ID_RE.test(input.task)) {
      return fail('SCHEMA_VALIDATION', `task id '${input.task}' is malformed`, {
        field: 'task',
      });
    }
    const entries = this.tryReadIndex();
    if (entries === null) {
      // Result boundary discipline: an unreadable history aborts the write as
      // an error value — never thrown across record(), and never mistaken
      // for "empty" (which would silently clobber existing evidence).
      return fail(
        'IO_ERROR',
        `refusing to write evidence: existing index unreadable (${this.indexPath})`,
        {
          suggestion:
            'Repair or restore .boldash/state/evidence.json from Git, then retry.',
        },
      );
    }
    const seq =
      entries
        .filter((e) => e.task === input.task && e.kind === input.kind)
        .map((e) => Number(/-(\d+)$/.exec(e.id)?.[1] ?? '0'))
        .reduce((a, b) => Math.max(a, b), 0) + 1;
    const id = `EVID-${input.kind}-${seq}`;
    const relPath =
      input.task === null
        ? join('evidence', `project-${id}.json`)
        : join('evidence', input.task, `${input.kind}-${seq}.json`);

    const record: EvidenceRecord = {
      id,
      kind: input.kind,
      task: input.task,
      created_at: this.clock.nowIso(),
      // Callers pre-redact structured output; the post-serialization scan below
      // is the store's independent backstop for every field, summary included.
      summary: input.summary,
      payload_ref: relPath.split(/[\\/]/).join('/'), // forward slashes in committed refs
      ...(input.fields ?? {}),
    };

    // Guarantee 1: serialize → redact-check the FINAL bytes; never write raw.
    let serialized: string;
    try {
      serialized = JSON.stringify(record, null, 2) + '\n';
    } catch (cause) {
      return fail(
        'SCHEMA_VALIDATION',
        `evidence payload unserializable: ${String(cause)}`,
        {
          field: 'fields',
        },
      );
    }
    if (containsSecretShape(serialized)) {
      return fail(
        'EVIDENCE_REDACTION_FAILED',
        'Could not redact potential secret in evidence payload.',
        {
          field: 'evidence',
          suggestion: 'Review the payload manually. Do not commit raw secrets.',
        },
      );
    }

    const absPayload = join(this.boldashRoot, relPath);
    try {
      mkdirSync(dirname(absPayload), { recursive: true });
      writeJsonAtomic(absPayload, JSON.parse(serialized));
      this.writeIndex([...entries, record]);
    } catch (cause) {
      return fail('IO_ERROR', `evidence write failed: ${String(cause)}`, {
        field: relPath,
      });
    }
    return ok(record);
  }

  /** Low-level index read (public for explain/doctor use later; read-only). */
  readIndex(): EvidenceRecord[] {
    if (!existsSync(this.indexPath)) return [];
    let text: string;
    try {
      text = readFileSync(this.indexPath, 'utf8');
    } catch (cause) {
      throw new Error(`EVIDENCE index unreadable (${this.indexPath})`, { cause });
    }
    let raw: Partial<EvidenceIndex>;
    try {
      raw = JSON.parse(text) as Partial<EvidenceIndex>;
    } catch (cause) {
      throw new Error(`EVIDENCE index corrupt (${this.indexPath})`, { cause });
    }
    // Deliberately outside the try: a shape violation must report as itself,
    // not be relabelled "corrupt" by the parse handler above.
    if (raw.schema_version !== 1 || !Array.isArray(raw.entries)) {
      throw new Error(
        `EVIDENCE index rejected (${this.indexPath}): unexpected evidence.json shape`,
      );
    }
    return raw.entries;
  }

  /** Null = readIndex threw (corrupt/rejected/unreadable). Callers must fail closed.
   * Public: verifyTask uses this to abort the WHOLE run as a value when history
   * is unreadable — never silently treating "unknown" as "no evidence". */
  tryReadIndex(): EvidenceRecord[] | null {
    try {
      return this.readIndex();
    } catch {
      return null;
    }
  }

  private writeIndex(entries: EvidenceRecord[]): void {
    mkdirSync(this.stateDir, { recursive: true });
    writeJsonAtomic(this.indexPath, { schema_version: 1, entries });
  }
}
