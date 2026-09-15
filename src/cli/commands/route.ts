/**
 * `boldash route` (MS-6 S3) — the router coupling. Reads a proposal from
 * `--input <path>`, `--json '<inline>'`, or piped stdin (exactly one source),
 * runs it through the router's public pipeline surface, and answers with the
 * documented envelope (cli-reference §route). Exit codes 0/2/3.
 *
 * **CLI owns the audit log** (ruling D-3: the router is stateless): every
 * VALID route decision appends a `route.validated` event — but only inside an
 * initialized repository; routing a proposal elsewhere must not silently
 * create `.boldash/` (the log is skipped, and `--create` carries its own
 * precondition error).
 *
 * `--create` writes the routed task: `TaskStore.create` → `proposed`, then
 * `proposed → planned` (plan-001 §3 S3: proposal becomes a `planned` task).
 * The title comes from `task.summary` — a proposal without one gets a usage
 * error instead of an invented title. The AC-8 file-baseline capture does NOT
 * fire here: it belongs to the `planned → implementing` edge, in `transition`.
 *
 * Envelope token budget (P9 / RFC §1.2): success ≤80, failure ≤140 —
 * asserted by the serializer tests in tests/unit/cli/route-command.test.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  genericContext,
  parseProposal,
  routeValidated,
} from '../../core/router/index.js';
import type { ResolvedRoute, RouteProposal } from '../../core/router/index.js';
import type { TaskStore } from '../../core/state/index.js';
import { precondition, storeIn, usage, fail } from './state.js';
import { CLI_ACTOR } from './state-writes.js';
import type { Envelope, RunContext } from '../types.js';

function readProposalText(
  ctx: RunContext,
): { ok: true; data: string } | { ok: false; envelope: Envelope } {
  const cwd = ctx.globals.cwd;
  const input = ctx.flags['input'];
  const inline = ctx.flags['json'];
  const hasInput = input !== undefined;
  const hasJson = inline !== undefined;
  if (hasInput && hasJson) {
    return {
      ok: false,
      envelope: usage(
        'Exactly one proposal source may be given.',
        '--input',
        'Use one of --input <path>, --json <proposal>, or piped stdin.',
      ),
    };
  }
  if (hasJson) return { ok: true, data: String(inline) };
  if (hasInput) {
    try {
      return { ok: true, data: readFileSync(resolve(cwd, String(input)), 'utf8') };
    } catch (cause) {
      return {
        ok: false,
        envelope: usage(
          `Cannot read --input: ${String(cause)}`,
          '--input',
          'Point --input at a readable file, or pass the proposal another way.',
        ),
      };
    }
  }
  if (ctx.stdinIsTty === true || !ctx.stdin) {
    return {
      ok: false,
      envelope: usage(
        'No proposal given.',
        'route',
        'Pass --input <path>, --json <proposal>, or pipe JSON on stdin.',
      ),
    };
  }
  try {
    return { ok: true, data: ctx.stdin() };
  } catch (cause) {
    return {
      ok: false,
      envelope: usage(
        `No JSON received on stdin: ${String(cause)}`,
        'route',
        'Pipe the proposal JSON, or use --input/--json.',
      ),
    };
  }
}

function createPlannedTask(
  store: TaskStore,
  proposal: RouteProposal,
  resolved: ResolvedRoute,
): Envelope {
  const summary = proposal.task.summary;
  if (!summary || summary.trim().length === 0) {
    return usage(
      '--create needs a task title; the proposal carries no task.summary.',
      'task.summary',
      'Add a non-empty "summary" to the proposal task, or route without --create.',
    );
  }
  const scope = proposal.task.scope;
  const created = store.create(
    {
      title: summary,
      type: proposal.task.type,
      risk: proposal.task.risk,
      level: resolved.level,
      workflow: resolved.workflow,
      ...(scope?.files?.length ? { scope: { ...scope, files: scope.files } } : {}),
    },
    CLI_ACTOR,
  );
  if (!created.ok) return fail(created.error);
  const planned = store.transition(
    created.data.id,
    'planned',
    created.data.version,
    CLI_ACTOR,
  );
  if (!planned.ok) return fail(planned.error);
  const logged = store.logEvent('route.validated', planned.data.id, CLI_ACTOR, {
    workflow: resolved.workflow,
    level: resolved.level,
  });
  if (!logged.ok) return fail(logged.error);
  return {
    ok: true,
    data: {
      ...resolved,
      created: {
        id: planned.data.id,
        status: planned.data.status,
        version: planned.data.version,
      },
    },
  };
}

/** Runner for `boldash route`. */
export function runRoute(ctx: RunContext): Envelope {
  const [extra] = ctx.positionals;
  if (extra !== undefined) {
    return usage(
      `Unexpected argument '${extra}'.`,
      'route',
      'Usage: boldash route --input <path> | --json <proposal> (or piped stdin).',
    );
  }
  const source = readProposalText(ctx);
  if (!source.ok) return source.envelope;

  const parsed = parseProposal(source.data);
  if (!parsed.ok) return fail(parsed.error);
  const cwd = ctx.globals.cwd;
  const routed = routeValidated(parsed.data, { context: genericContext(), cwd });
  if (!routed.ok) return fail(routed.error);
  const resolved = routed.data;

  const store = storeIn(cwd);
  if (ctx.flags['create'] === true) {
    if (!existsSync(join(cwd, '.boldash'))) return precondition(cwd);
    return createPlannedTask(store, parsed.data, resolved);
  }
  // Audit is CLI-owned (D-3) — logged inside an initialized repo only; an
  // uninitialized cwd has no state directory to append to, by design.
  if (existsSync(join(cwd, '.boldash'))) {
    const logged = store.logEvent('route.validated', null, CLI_ACTOR, {
      workflow: resolved.workflow,
      level: resolved.level,
    });
    if (!logged.ok) return fail(logged.error);
  }
  return { ok: true, data: resolved };
}
