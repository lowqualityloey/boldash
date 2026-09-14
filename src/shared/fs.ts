/**
 * Deterministic filesystem helpers.
 *
 * `writeJsonAtomic` is the ONLY sanctioned state-write primitive
 * (AGENTS.md §State mutations: all writes go through the State Engine, and all
 * state mutations use write-temp-then-rename).
 *
 * Crash-safety ordering — the property MS-2 AC-3 pins:
 *   1. serialize fully, in memory, before touching the destination;
 *   2. write a unique sibling temp file and fsync it;
 *   3. rename (atomic within a filesystem) over the destination;
 *   4. fsync the parent directory so the rename itself is durable.
 * A crash at any point leaves either the old or the new file, never a torn one,
 * and never a stray temp file after a *handled* failure.
 */
import {
  closeSync,
  fsyncSync,
  openSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

function fsyncPath(path: string): void {
  const fd = openSync(path, 'r+');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export interface WriteAtomicOptions {
  /** Extra suffix for the temp name; tests inject one to assert collision safety. */
  tempSuffix?: string;
}

/** Serialize and atomically replace `path` with pretty-printed JSON. */
export function writeJsonAtomic(
  path: string,
  value: unknown,
  opts: WriteAtomicOptions = {},
): void {
  // Step 1 — serialize before any filesystem mutation. A circular/unserializable
  // value must leave the existing file untouched.
  const payload = `${JSON.stringify(value, null, 2)}\n`;

  const dir = dirname(path);
  const tmp = join(
    dir,
    `.${basename(path)}.${process.pid}.${Math.random().toString(36).slice(2)}${opts.tempSuffix ?? ''}.tmp`,
  );

  let fd: number | undefined;
  try {
    // Step 2 — write + fsync the temp file.
    fd = openSync(tmp, 'wx', 0o644);
    writeFileSync(fd, payload, { encoding: 'utf8' });
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;

    // Step 3 — atomic rename over the destination.
    renameSync(tmp, path);

    // Step 4 — durability of the rename. Some platforms reject directory fsync;
    // there the rename is still atomic, so a failure here is not data loss.
    try {
      fsyncPath(dir);
    } catch {
      /* ENOTSPEC/EPERM on some hosts; ordering guarantee unaffected. */
    }
  } catch (error) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
    }
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* best effort: nothing further we can clean up */
    }
    throw error;
  }
}

/** True when `path` looks like a stray temp file produced by `writeJsonAtomic`. */
export function isTempArtifact(name: string): boolean {
  return /^\..+\.tmp$/.test(name) && name.includes('.tmp');
}

/** List stray temp artifacts in a directory; used by `doctor` later (MS-2 helper). */
export function findTempArtifacts(dir: string): string[] {
  try {
    return readdirSync(dir).filter(isTempArtifact);
  } catch {
    return [];
  }
}
