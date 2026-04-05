/**
 * @module commands/check
 * @description Implements the `bdd-workflow check` CLI subcommand. Runs the
 * project's full verification suite — type-check followed by the Cucumber test
 * suite — and exits non-zero if either step fails. Intended as the canonical
 * pre-review gate referenced by the bdd-workflow skill and command files.
 * Does NOT run the build — type-checking is performed via `npx tsc --noEmit` only.
 */

import { Command } from 'commander';
import { spawnSync } from 'node:child_process';

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
    .action(() => {
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
