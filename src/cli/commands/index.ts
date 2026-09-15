/**
 * Command registry — the single source of truth for what the CLI accepts
 * and advertises (parser + help are generated from this data).
 *
 * Honesty rule (AGENTS §Host Adapter Rules generalized): a command appears
 * here only when it is implemented; `boldash --help` never lists a surface
 * that returns "not available". S2 wired state reads + workflow list/validate;
 * S3 adds route + state writes, S4 adds verify + workflow import.
 * Flag enums mirror schemas/task.schema.json — a unit test guards drift.
 */
import type { CommandSpec, CommandRunner, Envelope } from '../types.js';
import { runInit } from './init.js';
import {
  DEFAULT_LIMIT,
  RISK_VALUES,
  runStateGet,
  runStateList,
  STATUS_VALUES,
  TYPE_VALUES,
} from './state.js';
import { runWorkflowList, runWorkflowValidate } from './workflow.js';
import { PROFILES } from '../../core/state/index.js';

/** A command family whose subcommands all require selection (`state`, `workflow`). */
function familyUsage(name: string, subs: readonly string[]): CommandRunner {
  return (): Envelope => ({
    ok: false,
    error: {
      code: 'CLI_USAGE',
      message: `'${name}' requires a subcommand.`,
      field: name,
      suggestion: `Subcommands: ${subs.join(', ')}.`,
    },
  });
}

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
  {
    name: 'state',
    summary: 'Read canonical state.',
    flags: [],
    run: familyUsage('state', ['get', 'list']),
    subcommands: [
      {
        name: 'get',
        summary: 'Print one task by id.',
        flags: [],
        run: runStateGet,
      },
      {
        name: 'list',
        summary: 'List tasks with filters.',
        flags: [
          {
            name: 'status',
            takesValue: true,
            values: STATUS_VALUES,
            help: 'Filter by status.',
          },
          {
            name: 'risk',
            takesValue: true,
            values: RISK_VALUES,
            help: 'Filter by risk.',
          },
          {
            name: 'type',
            takesValue: true,
            values: TYPE_VALUES,
            help: 'Filter by type.',
          },
          { name: 'owner', takesValue: true, help: 'Filter by owner.' },
          {
            name: 'limit',
            takesValue: true,
            help: `Max results. Default: ${DEFAULT_LIMIT}.`,
          },
        ],
        run: runStateList,
      },
    ],
  },
  {
    name: 'workflow',
    summary: 'Inspect workflow packs.',
    flags: [],
    run: familyUsage('workflow', ['list', 'validate']),
    subcommands: [
      {
        name: 'list',
        summary: 'List enabled workflows and their requirements.',
        flags: [],
        run: runWorkflowList,
      },
      {
        name: 'validate',
        summary: 'Validate one workflow pack.',
        flags: [],
        run: runWorkflowValidate,
      },
    ],
  },
];
