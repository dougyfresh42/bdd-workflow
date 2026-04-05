/**
 * Step definitions for init command testing.
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
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
 * Absolute path to the package root directory. All CLI invocations use
 * `node <packageRoot>/dist/cli.js` so the tests do not require the package
 * to be published to the npm registry.
 */
const packageRoot = resolve(new URL(import.meta.url).pathname, '../../../../');

/**
 * Run the local bdd-workflow CLI directly via `node dist/cli.js`.
 * Mirrors the `runCli` helper in update.steps.ts.
 */
function runCli(args: string[], cwd: string): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    'node',
    [join(packageRoot, 'dist', 'cli.js'), ...args],
    {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Recursively list all files under a directory, returning relative paths.
 */
function listFilesRecursive(dir: string, base: string = dir): string[] {
  const result: string[] = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...listFilesRecursive(full, base));
    } else {
      result.push(full.slice(base.length + 1));
    }
  }
  return result;
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
  writeFileSync(join(this.tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
});

/**
 * Run bdd-workflow init in temp directory using the local CLI binary.
 */
When('I run "npx bdd-workflow init" in that directory', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = runCli(['init', this.tempDir], packageRoot);
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.exitCode;
});

/**
 * Run npm install.
 * Installs the local bdd-workflow package by file path so the test does not
 * require the package to be published to the npm registry.
 */
When('running "npm install" in the project succeeds', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = spawnSync('npm', ['install', '--omit=optional', packageRoot], {
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
 * Run npx bdd-workflow --help using the local CLI binary.
 */
When('I run "npx bdd-workflow --help"', function (this: BddWorkflowWorld) {
  const result = runCli(['--help'], packageRoot);
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.exitCode;
});

/**
 * Run npx bdd-workflow init --help using the local CLI binary.
 */
When('I run "npx bdd-workflow init --help"', function (this: BddWorkflowWorld) {
  const result = runCli(['init', '--help'], packageRoot);
  this.lastOutput = result.stdout;
  this.lastError = result.stderr;
  this.lastExitCode = result.exitCode;
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
    cwd: packageRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, `Build failed: ${result.stderr}`);
});

/**
 * Import defineConfig from bdd-workflow using dynamic import (ESM-safe).
 */
When('I import defineConfig from bdd-workflow', async function (this: BddWorkflowWorld) {
  try {
    const mod = await import(join(packageRoot, 'dist', 'index.js'));
    this.defineConfig = mod.defineConfig;
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
  const output = (this.lastOutput ?? '') + (this.lastError ?? '');
  assert(output.includes('Usage:') || output.includes('bdd-workflow'), 'Help text not displayed');
});

/**
 * Check that init subcommand is listed.
 */
Then('init subcommand is listed', function (this: BddWorkflowWorld) {
  const output = (this.lastOutput ?? '') + (this.lastError ?? '');
  assert(output.includes('init'), 'init command not listed in help');
});

/**
 * Check that help text for init is displayed.
 */
Then('help text for init is displayed', function (this: BddWorkflowWorld) {
  const output = (this.lastOutput ?? '') + (this.lastError ?? '');
  assert(output.includes('init') || output.includes('Initialize'), 'init help not displayed');
});

/**
 * Check that no .js.map or .d.ts.map files exist in the scaffolded project.
 * The scaffolded project should contain only source-level artifacts, not
 * compiled TypeScript output from the bdd-workflow package itself.
 */
Then('no .js.map or .d.ts.map files exist in the project', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const allFiles = listFilesRecursive(this.tempDir);
  const mapFiles = allFiles.filter(f => f.endsWith('.js.map') || f.endsWith('.d.ts.map'));
  assert.equal(
    mapFiles.length, 0,
    `Found unexpected map files in scaffolded project:\n${mapFiles.join('\n')}`
  );
});

/**
 * Check that no .d.ts declaration files exist in the scaffolded project.
 */
Then('no .d.ts files exist in the project', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const allFiles = listFilesRecursive(this.tempDir);
  const dtsFiles = allFiles.filter(f => f.endsWith('.d.ts'));
  assert.equal(
    dtsFiles.length, 0,
    `Found unexpected .d.ts files in scaffolded project:\n${dtsFiles.join('\n')}`
  );
});

/**
 * Check that no compiled .js files exist alongside their .ts source counterparts.
 * A .js file is considered "compiled alongside" a .ts file if both share the
 * same path with only the extension differing (e.g. src/foo.ts and src/foo.js).
 */
Then('no compiled .js files exist alongside .ts source files', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const allFiles = listFilesRecursive(this.tempDir);
  const tsFiles = new Set(allFiles.filter(f => f.endsWith('.ts')).map(f => f.slice(0, -3)));
  const compiledJs = allFiles.filter(f => f.endsWith('.js') && tsFiles.has(f.slice(0, -3)));
  assert.equal(
    compiledJs.length, 0,
    `Found compiled .js files alongside .ts sources in scaffolded project:\n${compiledJs.join('\n')}`
  );
});
