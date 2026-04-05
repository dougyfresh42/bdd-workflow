/**
 * @module commands/docs
 * @description CLI command wiring for `bdd-workflow docs`. Parses CLI options,
 * loads the project configuration, and delegates to `generateDocs`. Supports
 * an optional `--format` flag to switch between markdown (default) and HTML
 * output. Does NOT contain generation logic — that lives in
 * src/generators/docs.ts.
 */

import { Command } from 'commander';
import { generateDocs } from '../generators/docs.js';
import { loadConfig } from '../config.js';

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
      if (opts.format) {
        config.docs.format = opts.format as 'markdown' | 'html';
      }
      await generateDocs(config);
      console.log(`Docs written to ${config.docs.outputDir}/`);
    });
}
