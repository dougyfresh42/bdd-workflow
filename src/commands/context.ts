/**
 * @module commands/context
 * @description CLI command wiring for `bdd-workflow context`. Parses CLI
 * options, loads the project configuration, and delegates to
 * `generateContext`. Does NOT contain generation logic — that lives in
 * src/generators/context.ts.
 */

import { Command } from 'commander';
import { generateContext } from '../generators/context.js';
import { loadConfig } from '../config.js';

/**
 * Create the context subcommand.
 *
 * @returns Commander Command instance for `bdd-workflow context`
 */
export function contextCommand(): Command {
  return new Command('context')
    .description('Regenerate CONTEXT.md from source files and feature specs')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        await generateContext(config);
        console.log('CONTEXT.md updated.');
      } catch (err) {
        console.error('Error generating context:', err);
        process.exit(1);
      }
    });
}
