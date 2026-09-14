/**
 * Scope-file checking — pipeline step 6 (docs/routing-contract.md §Scope).
 *
 * Advisory by design: a missing declared file produces a WARNING on an otherwise
 * successful route, never a failure (§Scope "Scope is not enforcement"). Two
 * conservative skips keep the warning honest:
 *
 * 1. **Glob patterns are not evaluated.** `src/auth/*` is a declaration of
 *    intent, not a file. Statically verifying it would require a glob engine and
 *    — worse — would produce false "not found" warnings for greenfield targets
 *    like `src/new-module/*` that the task is about to create. Anything
 *    containing glob metacharacters is skipped, silently.
 * 2. **Greenfield roots are not checked.** An empty (or absent) project root
 *    means every declared file is yet to exist; warning on each would be noise
 *    that trains users to ignore warnings (verification-theater risk).
 *
 * `fileExists` is injectable as a seam for exotic callers, but tests run the
 * real predicate against real temp directories (AGENTS.md: no mocked fs).
 */

import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { RoutingWarning } from './types.js';

export interface ScopeCheckOptions {
  /** Project root the globs/paths are resolved against. Absent ⇒ skip checking. */
  cwd?: string;
  /** Existence predicate; defaults to `existsSync`. */
  fileExists?: (absolutePath: string) => boolean;
}

const GLOB_METACHARACTERS = /[*?[\]{}]/;

/** True when the root has no entries (or does not exist): nothing to check yet. */
function isGreenfieldRoot(cwd: string): boolean {
  try {
    return readdirSync(cwd).length === 0;
  } catch {
    return true;
  }
}

/**
 * Collect step-6 warnings for a proposal's `task.scope.files`.
 * Returns `[]` (never undefined-noise) when everything is satisfied or skipped;
 * the pipeline omits `warnings` entirely on an empty list (plan ruling D-3).
 *
 * @param files - declared scope globs; `undefined` when the proposal declared none.
 */
export function checkScope(
  files: readonly string[] | undefined,
  options: ScopeCheckOptions = {},
): RoutingWarning[] {
  const { cwd, fileExists = existsSync } = options;
  if (!files || files.length === 0 || cwd === undefined) return [];
  if (isGreenfieldRoot(cwd)) return [];

  const warnings: RoutingWarning[] = [];
  for (const declared of files) {
    if (GLOB_METACHARACTERS.test(declared)) continue; // pattern, not a file — advisory skip
    const resolved = isAbsolute(declared) ? declared : join(cwd, declared);
    if (fileExists(resolved)) continue;
    warnings.push({
      code: 'SCOPE_FILE_NOT_FOUND',
      // Wording pinned to docs/routing-contract.md §Error Codes example.
      message: `Scope file '${declared}' not found.`,
      field: 'task.scope.files',
      context: { declared },
    });
  }
  return warnings;
}
