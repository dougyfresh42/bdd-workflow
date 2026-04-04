/**
 * @module commands/update
 * @description Implements the `bdd-workflow update` CLI subcommand. Responsible
 * for refreshing framework-owned scaffold files (agents, commands, skills, and
 * templates) in an existing initialized project to match the
 * current version of the bdd-workflow package. Does NOT touch user-owned files
 * (source code, feature files, CONTEXT.md, SPECS.md, package.json,
 * tsconfig.json, or any file not tracked in the scaffold templates' framework
 * layer). Produces a human-readable diff summary showing updated, identical, and
 * user-modified files.
 */

import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { updateScaffold, printUpdateSummary } from '../scaffold/update.js';
import { BDD_WORKFLOW_MARKER } from '../scaffold/index.js';

/**
 * Create the `update` subcommand for Commander.
 *
 * Resolves the target directory, verifies it is an initialized bdd-workflow
 * project (presence of `.opencode/skills/bdd-workflow/SKILL.md` is the
 * canonical marker), then delegates to `updateScaffold`.
 *
 * @returns Commander `Command` instance for the `update` subcommand.
 */
export function updateCommand(): Command {
  return new Command('update')
    .description('Refresh framework-owned scaffold files to the latest package version')
    .argument('[dir]', 'Target directory (defaults to current directory)')
    .option('--force', 'Overwrite user-modified files without prompting')
    .option('--verbose', 'Emit per-file status lines')
    .action((dir: string | undefined, opts: { force?: boolean; verbose?: boolean }) => {
      const targetDir = resolve(dir ?? '.');
      const markerFile = join(targetDir, BDD_WORKFLOW_MARKER);

      if (!existsSync(markerFile)) {
        console.error(
          `Error: "${targetDir}" is not an initialized bdd-workflow project.\n` +
          `Run "bdd-workflow init" first, or specify the correct directory.`
        );
        process.exit(1);
      }

      try {
        const result = updateScaffold(targetDir, { force: opts.force, verbose: opts.verbose });
        printUpdateSummary(result);
      } catch (err) {
        console.error('Error updating scaffold:', err);
        process.exit(1);
      }
    });
}
