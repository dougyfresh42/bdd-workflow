/**
 * @module commands/specs
 * @description CLI command wiring for `bdd-workflow specs`. Parses CLI
 * options, loads and validates the project configuration, and delegates to
 * `generateSpecs`. Handles empty feature directories gracefully (exit 0, info
 * message). Does NOT contain generation logic — that lives in
 * src/generators/specs.ts.
 */

import { Command } from 'commander';
import { generateSpecs } from '../generators/specs.js';
import { loadConfig, assertValidConfig } from '../config.js';
import { parseFeatureFilesDetailed } from '../parsers/gherkin.js';

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
      assertValidConfig(config);
      const outputPath = opts.output as string;

      const features = await parseFeatureFilesDetailed(config);
      if (features.length === 0) {
        console.info('[bdd-workflow] No .feature files found. Nothing to write to SPECS.md.');
        return;
      }

      await generateSpecs(config, outputPath);
      console.log(`SPECS.md written to ${outputPath}`);
    });
}
