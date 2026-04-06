/**
 * @module commands/context
 * @description CLI command wiring for `bdd-workflow context`. Parses CLI
 * options, loads and validates the project configuration, and delegates to
 * `generateContext`. Handles empty feature set and empty source file set
 * gracefully with info messages (exits 0). Does NOT contain generation
 * logic — that lives in src/generators/context.ts.
 */

import { Command } from 'commander';
import { generateContext } from '../generators/context.js';
import { loadConfig, assertValidConfig } from '../config.js';
import { extractModuleSummaries } from '../parsers/jsdoc.js';
import { parseFeatureFiles } from '../parsers/gherkin.js';

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
        assertValidConfig(config);

        // Informational warnings for empty state (do not exit non-zero)
        const [modules, features] = await Promise.all([
          extractModuleSummaries(config),
          parseFeatureFiles(config),
        ]);
        if (modules.length === 0) {
          console.info('[bdd-workflow] No TypeScript source files found — modules section will be empty.');
        }
        if (features.length === 0) {
          console.info('[bdd-workflow] No .feature files found — feature summaries section will be empty.');
        }

        await generateContext(config);
        console.log('CONTEXT.md updated.');
      } catch (err) {
        console.error('Error generating context:', err);
        process.exit(1);
      }
    });
}
