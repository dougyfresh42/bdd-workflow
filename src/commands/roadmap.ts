/**
 * @module commands/roadmap
 * @description CLI command wiring for `bdd-workflow roadmap`. Provides five
 * subcommands: `show` (prints the current roadmap with step status as a
 * formatted table), `link` (associates a proposal file with a roadmap step),
 * `status` (prints a progress summary: pending / in-progress / done counts),
 * `validate` (checks the roadmap YAML for structural errors), and `worktree`
 * (creates a git worktree for a step and copies its linked proposal in).
 * Loads and validates the project configuration before all subcommands.
 * Does NOT contain roadmap parsing or mutation logic — that lives in
 * src/roadmap/index.ts. Does NOT contain worktree creation logic — that
 * lives in src/roadmap/worktree.ts.
 */

import { Command } from 'commander';
import { join } from 'node:path';
import { loadConfig, assertValidConfig } from '../config.js';
import {
  readRoadmap,
  linkProposal,
  validateRoadmap,
  printRoadmapTable,
  printRoadmapStatus,
} from '../roadmap/index.js';
import { createStepWorktree } from '../roadmap/worktree.js';

/**
 * Create the `roadmap` subcommand for Commander.
 *
 * Registers five sub-subcommands: show, status, link, validate, worktree.
 * All subcommands load and validate the project configuration before running.
 *
 * @returns Commander `Command` instance for the `roadmap` subcommand.
 */
export function roadmapCommand(): Command {
  const roadmap = new Command('roadmap')
    .description('Manage the project roadmap (show, status, link, validate, worktree)');

  // ── show ──────────────────────────────────────────────────────────────────
  roadmap
    .command('show')
    .description('Print roadmap table with step statuses')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      const rm = readRoadmap(config);
      if (!rm) {
        const roadmapPath = join(
          process.cwd(),
          config.workflow.roadmapFile ?? '.opencode/roadmap.yaml'
        );
        console.log(`No roadmap found at ${roadmapPath}.`);
        process.exit(0);
      }

      printRoadmapTable(rm);
    });

  // ── status ────────────────────────────────────────────────────────────────
  roadmap
    .command('status')
    .description('Print progress summary (pending / in-progress / done counts)')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      const rm = readRoadmap(config);
      if (!rm) {
        const roadmapPath = join(
          process.cwd(),
          config.workflow.roadmapFile ?? '.opencode/roadmap.yaml'
        );
        console.log(`No roadmap found at ${roadmapPath}.`);
        process.exit(0);
      }

      printRoadmapStatus(rm);
    });

  // ── link ──────────────────────────────────────────────────────────────────
  roadmap
    .command('link <step-id> <proposal-file>')
    .description('Associate a proposal file with a roadmap step')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (stepId: string, proposalFile: string, opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      try {
        linkProposal(config, stepId, proposalFile);
        console.log(`Linked proposal "${proposalFile}" to step "${stepId}".`);
      } catch (err) {
        console.error(`bdd-workflow roadmap link: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── validate ──────────────────────────────────────────────────────────────
  roadmap
    .command('validate')
    .description('Check roadmap YAML for structural errors')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      const rm = readRoadmap(config);
      if (!rm) {
        console.error('No roadmap found. Create one at .opencode/roadmap.yaml first.');
        process.exit(1);
      }

      const errors = validateRoadmap(rm);
      if (errors.length > 0) {
        console.error('Roadmap validation errors:');
        for (const err of errors) {
          const prefix = err.stepId ? `  [step: ${err.stepId}] ` : '  ';
          console.error(`${prefix}${err.field}: ${err.message}`);
        }
        process.exit(1);
      }

      console.log('roadmap is valid');
    });

  // ── worktree ──────────────────────────────────────────────────────────────
  roadmap
    .command('worktree <step-id>')
    .description('Create a git worktree for a step and copy its linked proposal in')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (stepId: string, opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      try {
        const result = createStepWorktree(config, stepId);
        console.log(`Worktree created at: ${result.path}`);
        console.log(`Branch: ${result.branch}`);
        console.log(`Proposal copied to: ${result.proposalPath}`);
      } catch (err) {
        console.error(`bdd-workflow roadmap worktree: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return roadmap;
}
