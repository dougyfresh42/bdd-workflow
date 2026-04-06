/**
 * @module commands/docs
 * @description CLI command wiring for `bdd-workflow docs`. Parses CLI options,
 * loads and validates the project configuration, and delegates to
 * `generateDocs`. Handles missing entry point and TypeDoc compilation failures
 * with clear error output and exit 1. Does NOT contain generation logic —
 * that lives in src/generators/docs.ts.
 */

import { Command } from 'commander';
import { generateDocs } from '../generators/docs.js';
import { loadConfig, assertValidConfig } from '../config.js';

/**
 * Create and return the `docs` Commander subcommand.
 *
 * @returns Configured Commander Command object for the `docs` subcommand
 */
export function docsCommand(): Command {
  return new Command('docs')
    .description('Generate API documentation from JSDoc comments')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .option('--format <format>', 'Output format: markdown or html', 'markdown')
    .action(async (opts) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);
      if (opts.format) {
        config.docs.format = opts.format as 'markdown' | 'html';
      }
      try {
        await generateDocs(config);
        console.log(`Docs written to ${config.docs.outputDir}/`);
      } catch (err) {
        console.error('bdd-workflow docs: failed to generate docs.');
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
