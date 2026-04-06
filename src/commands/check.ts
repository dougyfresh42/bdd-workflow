/**
 * @module commands/check
 * @description Implements the `bdd-workflow check` CLI subcommand. Runs the
 * project's full verification suite — type-check followed by the Cucumber test
 * suite — and exits non-zero if either step fails. Calls validateConfig and
 * exits 1 with a clear error message if the project config is invalid. Exits 1
 * with an actionable message if tsconfig.json is not found. Intended as the
 * canonical pre-review gate referenced by the bdd-workflow skill and command
 * files. Does NOT run the build — type-checking is performed via
 * `npx tsc --noEmit` only.
 */

import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, assertValidConfig } from '../config.js';

/**
 * Create the `check` subcommand for Commander.
 *
 * Runs `npx tsc --noEmit` followed by `npx cucumber-js` in the current working
 * directory. Exits with the failing command's exit code on failure, or 0 on
 * success.
 *
 * @returns Commander `Command` instance for the `check` subcommand.
 */
export function checkCommand(): Command {
  return new Command('check')
    .description('Type-check and run tests (pre-review gate)')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts: { config?: string }) => {
      const config = await loadConfig(opts.config);
      assertValidConfig(config);

      // Check for tsconfig.json before invoking tsc
      if (!existsSync(join(process.cwd(), 'tsconfig.json'))) {
        console.error(
          'bdd-workflow check: TypeScript config not found. Run `npx tsc --init` to create one.'
        );
        process.exit(1);
      }

      // Step 1: type-check
      console.log('bdd-workflow check: running npx tsc --noEmit...');
      const tsc = spawnSync('npx', ['tsc', '--noEmit'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
      });

      if (tsc.status !== 0) {
        console.error('bdd-workflow check: type-check failed.');
        process.exit(tsc.status ?? 1);
      }

      // Step 2: cucumber tests
      console.log('bdd-workflow check: running npx cucumber-js...');
      const cucumber = spawnSync('npx', ['cucumber-js'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
      });

      if (cucumber.status !== 0) {
        console.error('bdd-workflow check: cucumber tests failed.');
        process.exit(cucumber.status ?? 1);
      }

      console.log('bdd-workflow check: all checks passed.');
    });
}
