/**
 * Command registry — the single source of truth for what the CLI accepts
 * and advertises (parser + help are generated from this data).
 *
 * Honesty rule (AGENTS §Host Adapter Rules generalized): a command appears
 * here only when it is implemented; `boldash --help` never lists a surface
 * that returns "not available". Slices S2-S4 add route/state/verify/workflow.
 */
import type { CommandSpec } from '../types.js';
import { runInit } from './init.js';
import { PROFILES } from '../../core/state/scaffold.js';

export const REGISTRY: CommandSpec[] = [
  {
    name: 'init',
    summary: 'Initialize Boldash in the current repository.',
    description:
      'Creates .boldash/ (state files, evidence dir, events log, config template). Scaffold-only in v0.1.0: no packs, no briefing (MS-7).',
    flags: [
      {
        name: 'profile',
        takesValue: true,
        values: PROFILES,
        help: 'Workflow profile. Default: balanced.',
      },
      { name: 'host', takesValue: true, help: 'Force a host adapter name.' },
      {
        name: 'force',
        takesValue: false,
        help: 'Overwrite an existing .boldash/ (destructive).',
      },
    ],
    run: runInit,
  },
];
