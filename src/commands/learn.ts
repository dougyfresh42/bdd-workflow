/**
 * @module commands/learn
 * @description CLI command wiring for `bdd-workflow learn`. Provides two subcommands:
 * `list` (prints a formatted table of all learning entries) and `promote` (creates
 * GitHub issues from unpromoted learnings via the `gh` CLI). Does NOT contain
 * parsing or promotion logic — that lives in src/learn/index.ts and src/learn/promote.ts.
 */

import { Command } from 'commander';
import { promoteLearnings } from '../learn/promote.js';
import { listLearnings } from '../learn/index.js';
import { loadConfig } from '../config.js';

/**
 * Build the `bdd-workflow learn` Commander command tree.
 *
 * Registers the `list` and `promote` subcommands and wires them to their
 * respective action handlers in src/learn/index.ts and src/learn/promote.ts.
 *
 * @returns The configured Commander `Command` instance.
 */
export function learnCommand(): Command {
  const cmd = new Command('learn')
    .description('Manage workflow learnings');

  cmd
    .command('list')
    .description('List all learning entries and their status')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      const learnings = await listLearnings(config);

      if (learnings.length === 0) {
        return;
      }

      // Print a table: date  slug  status  github_issue
      for (const l of learnings) {
        const issueRef = l.github_issue ? `#${l.github_issue}` : '-';
        console.log(
          `${l.date}  ${l.slug.padEnd(40)}  ${l.status.padEnd(10)}  ${issueRef}`
        );
      }
    });

  cmd
    .command('promote')
    .description('Create GitHub issues from accumulated learnings')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .option('--dry-run', 'Show what would be promoted without creating issues')
    .action(async (opts: { config?: string; dryRun?: boolean }) => {
      const config = await loadConfig(opts.config);
      await promoteLearnings(config, { dryRun: opts.dryRun ?? false });
    });

  return cmd;
}
