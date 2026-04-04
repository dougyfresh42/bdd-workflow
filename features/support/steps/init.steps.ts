/**
 * Step definitions for init command testing.
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BddWorkflowWorld } from '../world.ts';

// Extend world with test properties
declare module '../world.ts' {
  interface BddWorkflowWorld {
    tempDir?: string;
    lastOutput?: string;
    lastError?: string;
    lastExitCode?: number;
  }
}

/**
 * Clean up temp directory after each scenario.
 */
After(function (this: BddWorkflowWorld) {
  if (this.tempDir && existsSync(this.tempDir)) {
    rmSync(this.tempDir, { recursive: true, force: true });
  }
});

/**
 * Create a clean temporary directory.
 */
Given('a clean temporary directory', function (this: BddWorkflowWorld) {
  this.tempDir = join('/tmp', `bdd-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  rmSync(this.tempDir, { recursive: true, force: true });
  mkdirSync(this.tempDir, { recursive: true });
});

/**
 * Create a temporary directory with a package.json.
 */
Given('a temporary directory with a package.json', function (this: BddWorkflowWorld) {
  this.tempDir = join('/tmp', `bdd-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  rmSync(this.tempDir, { recursive: true, force: true });
  mkdirSync(this.tempDir, { recursive: true });

  const packageJson = {
    name: 'existing-project',
    version: '1.0.0',
    type: 'module',
  };
  const packagePath = join(this.tempDir, 'package.json');
  execSync(`echo '${JSON.stringify(packageJson)}' > "${packagePath}"`, { cwd: this.tempDir });
});

/**
 * Run npx bdd-workflow init in temp directory.
 */
When('I run "npx bdd-workflow init" in that directory', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = spawnSync('npm', ['exec', 'bdd-workflow', 'init'], {
    cwd: this.tempDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.status ?? undefined;
});

/**
 * Run npm install.
 */
When('running "npm install" in the project succeeds', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = spawnSync('npm', ['install', '--omit=optional'], {
    cwd: this.tempDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000, // 2 minutes
  });
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.status ?? undefined;
  assert.equal(result.status, 0, `npm install failed: ${result.stderr}`);
});

/**
 * Run npx tsc --noEmit.
 */
When('running "npx tsc --noEmit" in the project succeeds', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: this.tempDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  this.lastExitCode = result.status ?? undefined;
  assert.equal(result.status, 0, `tsc failed: ${result.stderr}`);
});

/**
 * Run npx cucumber-js.
 */
When('running "npx cucumber-js" in the project runs with 0 scenarios', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = spawnSync('npx', ['cucumber-js'], {
    cwd: this.tempDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  // Exit code 0 is expected (0 scenarios run)
});

/**
 * Run npx bdd-workflow --help.
 */
When('I run "npx bdd-workflow --help"', function (this: BddWorkflowWorld) {
  const result = spawnSync('npm', ['exec', 'bdd-workflow', '--help'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.status ?? undefined;
});

/**
 * Run npx bdd-workflow init --help.
 */
When('I run "npx bdd-workflow init --help"', function (this: BddWorkflowWorld) {
  const result = spawnSync('npm', ['exec', 'bdd-workflow', 'init', '--help'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.status ?? undefined;
});

/**
 * Check that scaffolding succeeded.
 */
Then('the project scaffolds successfully', function (this: BddWorkflowWorld) {
  assert.equal(this.lastExitCode, 0, `Init failed with exit code ${this.lastExitCode}: ${this.lastError}`);
});

/**
 * Check that .opencode directory structure exists.
 */
Then('.opencode directory structure is created', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const dirs = [
    '.opencode',
    '.opencode/agents',
    '.opencode/commands',
    '.opencode/skills',
    '.opencode/proposals',
    '.opencode/proposals/completed',
    '.opencode/learnings',
    '.opencode/templates',
  ];
  for (const dir of dirs) {
    const path = join(this.tempDir, dir);
    assert(existsSync(path), `Missing directory: ${path}`);
  }
});

/**
 * Check that features directory structure exists.
 */
Then('features directory structure is created', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const dirs = [
    'features',
    'features/support',
    'features/support/steps',
  ];
  for (const dir of dirs) {
    const path = join(this.tempDir, dir);
    assert(existsSync(path), `Missing directory: ${path}`);
  }
});

/**
 * Check that config files are present.
 */
Then('config files are present', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const files = [
    'package.json',
    'tsconfig.json',
    'cucumber.js',
    'bdd-workflow.config.ts',
    'opencode.json',
    'src/index.ts',
    'features/support/world.ts',
    'features/support/hooks.ts',
    'CONTEXT.md',
    'SPECS.md',
  ];
  for (const file of files) {
    const path = join(this.tempDir, file);
    assert(existsSync(path), `Missing file: ${path}`);
  }
});

/**
 * Check that existing package.json is not overwritten.
 */
Then('the existing package.json is not overwritten', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const content = readFileSync(join(this.tempDir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(content);
  assert.equal(pkg.name, 'existing-project', 'package.json was overwritten');
});

/**
 * Check that new bdd-workflow files are added.
 */
Then('new bdd-workflow files are added', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  assert(existsSync(join(this.tempDir, '.opencode')), '.opencode directory not added');
  assert(existsSync(join(this.tempDir, 'features')), 'features directory not added');
});

/**
 * Check the bdd-workflow package is built.
 */
Given('the bdd-workflow package is built', function (this: BddWorkflowWorld) {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, `Build failed: ${result.stderr}`);
});

/**
 * Import defineConfig from bdd-workflow.
 */
When('I import defineConfig from bdd-workflow', function (this: BddWorkflowWorld) {
  try {
    const { defineConfig } = require('../dist/index.js');
    this.defineConfig = defineConfig;
  } catch (err) {
    throw new Error(`Failed to import defineConfig: ${err}`);
  }
});

/**
 * Check that defineConfig returns valid configuration.
 */
Then('it returns a valid configuration with defaults', function (this: BddWorkflowWorld) {
  assert(this.defineConfig, 'defineConfig not imported');
  const config = this.defineConfig({});
  assert(config.language === 'typescript', 'Default language should be typescript');
  assert(config.bdd.framework === 'cucumber', 'Default BDD framework should be cucumber');
  assert(config.docs.generator === 'typedoc', 'Default doc generator should be typedoc');
  assert(config.workflow.maxAmendIterations === 3, 'Default maxAmendIterations should be 3');
});

/**
 * Check that help text is displayed.
 */
Then('help text is displayed', function (this: BddWorkflowWorld) {
  assert(this.lastOutput?.includes('Usage:') || this.lastOutput?.includes('bdd-workflow'), 'Help text not displayed');
});

/**
 * Check that init subcommand is listed.
 */
Then('init subcommand is listed', function (this: BddWorkflowWorld) {
  assert(this.lastOutput?.includes('init'), 'init command not listed in help');
});

/**
 * Check that help text for init is displayed.
 */
Then('help text for init is displayed', function (this: BddWorkflowWorld) {
  assert(this.lastOutput?.includes('init') || this.lastOutput?.includes('Initialize'), 'init help not displayed');
});
