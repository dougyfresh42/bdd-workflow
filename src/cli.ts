#!/usr/bin/env node
/**
 * CLI entry point for bdd-workflow.
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';

const program = new Command();

program
  .name('bdd-workflow')
  .description('Agentic BDD development workflow framework')
  .version('0.1.0');

program.addCommand(initCommand());
// Register the update subcommand (refreshes framework-owned scaffold files).
program.addCommand(updateCommand());

program.parse(process.argv);
