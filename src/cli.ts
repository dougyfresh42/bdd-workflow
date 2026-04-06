#!/usr/bin/env node
/**
 * CLI entry point for bdd-workflow.
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import { contextCommand } from './commands/context.js';
import { checkCommand } from './commands/check.js';
import { docsCommand } from './commands/docs.js';
import { specsCommand } from './commands/specs.js';
import { learnCommand } from './commands/learn.js';

const program = new Command();

program
  .name('bdd-workflow')
  .description('Agentic BDD development workflow framework')
  .version('0.1.0');

program.addCommand(initCommand());
// Register the update subcommand (refreshes framework-owned scaffold files).
program.addCommand(updateCommand());
// Register the context subcommand (regenerates CONTEXT.md).
program.addCommand(contextCommand());
// Register the check subcommand (pre-review type-check and test gate).
program.addCommand(checkCommand());
// Register the docs subcommand (generates API documentation via TypeDoc).
program.addCommand(docsCommand());
// Register the specs subcommand (generates SPECS.md from Gherkin feature files).
program.addCommand(specsCommand());
// Register the learn subcommand (list and promote learning entries).
program.addCommand(learnCommand());

program.parse(process.argv);
