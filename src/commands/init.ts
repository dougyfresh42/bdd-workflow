/**
 * The init subcommand for bdd-workflow.
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scaffoldProject } from '../scaffold/index.js';

/**
 * Create the init subcommand.
 */
export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a project with bdd-workflow')
    .argument('[dir]', 'Target directory (defaults to current directory)')
    .option('--force', 'Overwrite existing files')
    .action(async (dir: string | undefined, opts: { force?: boolean }) => {
      const targetDir = resolve(dir ?? '.');
      const isExisting = existsSync(join(targetDir, 'package.json'));

      try {
        await scaffoldProject(targetDir, { existing: isExisting, force: opts.force });
      } catch (err) {
        console.error('Error scaffolding project:', err);
        process.exit(1);
      }
    });
}
