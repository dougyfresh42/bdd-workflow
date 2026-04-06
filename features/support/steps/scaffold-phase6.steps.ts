/**
 * @module steps/scaffold-phase6
 * @description Step definitions for scaffold-phase6.feature. Tests that the
 * CLI --version flag prints a valid semver version string. The 'the file
 * {string} contains {string}' step is defined in scaffold-phase2.steps.ts and
 * reused here. Reuses 'a clean temporary directory' and 'I run "npx
 * bdd-workflow init" in that directory' steps from init.steps.ts.
 */

import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

/**
 * Absolute path to the package root directory.
 */
const packageRoot = resolve(new URL(import.meta.url).pathname, '../../../../');

/**
 * Run the local bdd-workflow CLI directly via `node dist/cli.js`.
 */
function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    'node',
    [join(packageRoot, 'dist', 'cli.js'), ...args],
    {
      cwd: packageRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// ─── When steps ──────────────────────────────────────────────────────────────

/**
 * Run `bdd-workflow --version` using the local CLI binary.
 */
When(
  'I run "npx bdd-workflow --version"',
  function (this: BddWorkflowWorld) {
    const result = runCli(['--version']);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

// ─── Then steps ──────────────────────────────────────────────────────────────

/**
 * Assert the output contains a semver version string (e.g. "1.0.0" or "0.4.2").
 */
Then(
  'the output contains a semver version string',
  function (this: BddWorkflowWorld) {
    const output = this.lastOutput ?? '';
    const semverPattern = /\d+\.\d+\.\d+/;
    assert(
      semverPattern.test(output),
      `Expected output to contain a semver version string (e.g. "1.0.0").\nActual output:\n${output}`
    );
  }
);
