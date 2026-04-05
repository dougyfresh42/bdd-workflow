/**
 * @module commands/specs
 * @description CLI command wiring for `bdd-workflow specs`. Parses CLI
 * options, loads the project configuration, and delegates to `generateSpecs`.
 * Supports an optional `--output` flag to override the default SPECS.md path.
 * Does NOT contain generation logic — that lives in src/generators/specs.ts.
 */

import { Command } from 'commander';
import { generateSpecs } from '../generators/specs.js';
import { loadConfig } from '../config.js';

/**
 * Create and return the `specs` Commander subcommand.
 *
 * @returns Configured Commander Command object for the `specs` subcommand
 */
export function specsCommand(): Command {
  return new Command('specs')
    .description('Generate SPECS.md from Gherkin .feature files')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .option('--output <path>', 'Output file path', 'SPECS.md')
    .action(async (opts) => {
      const config = await loadConfig(opts.config);
      const outputPath = opts.output as string;
      await generateSpecs(config, outputPath);
      console.log(`SPECS.md written to ${outputPath}`);
    });
}
