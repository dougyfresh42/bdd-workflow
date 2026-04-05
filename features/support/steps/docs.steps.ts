/**
 * Step definitions for `bdd-workflow docs` command tests.
 *
 * Tests that the `docs` subcommand appears in CLI help, generates markdown or
 * HTML API documentation via TypeDoc, fails gracefully on missing entry points,
 * and surfaces TypeDoc errors clearly.
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

/**
 * Absolute path to the package root directory.
 */
const packageRoot = resolve(new URL(import.meta.url).pathname, '../../../../');

/**
 * Run the local bdd-workflow CLI directly via `node dist/cli.js`.
 */
function runCli(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    'node',
    [join(packageRoot, 'dist', 'cli.js'), ...args],
    {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Create a unique temporary directory.
 */
function makeTempDir(prefix: string): string {
  const dir = join(
    '/tmp',
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Scaffold a minimal TypeScript project suitable for running TypeDoc.
 * Symlinks node_modules from the package root so TypeDoc can resolve types
 * without a full npm install.
 */
function scaffoldDocsProject(dir: string, withEntryPoint = true): void {
  // Symlink node_modules for binary access
  const nmLink = join(dir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'test-docs-project', version: '1.0.0', type: 'module' }, null, 2),
    'utf-8'
  );

  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          declaration: true,
          outDir: 'dist',
        },
        include: ['src/**/*'],
      },
      null,
      2
    ),
    'utf-8'
  );

  if (withEntryPoint) {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `/**
 * @module test-docs
 * @description A test module for bdd-workflow docs generation.
 */

/**
 * Returns a greeting string.
 * @param name - The name to greet
 * @returns The greeting message
 */
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
      'utf-8'
    );
  }
}

/**
 * Clean up temp directory after each scenario.
 */
After(function (this: BddWorkflowWorld) {
  if (this.tempDir && existsSync(this.tempDir)) {
    rmSync(this.tempDir, { recursive: true, force: true });
    this.tempDir = undefined;
  }
});

// ─── Shared step: "the bdd-workflow CLI is installed" ───────────────────────
// (also used by specs.steps.ts — both files register it, but Cucumber deduplicates
//  by exact string so we guard with a try/catch-less approach: use distinct wording)

Given(
  'the bdd-workflow CLI is installed',
  function (this: BddWorkflowWorld) {
    // The CLI binary is available at dist/cli.js in the package root.
    // No setup needed — this step is a documentation-only precondition.
  }
);

// ─── docs-specific Givens ────────────────────────────────────────────────────

Given(
  'a temporary project directory with TypeScript source files and JSDoc comments',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-docs-test');
    scaffoldDocsProject(this.tempDir, true);
  }
);

Given(
  'the project has a valid {string} entry point',
  function (this: BddWorkflowWorld, _entryPoint: string) {
    // src/index.ts was already created in scaffoldDocsProject
    assert(this.tempDir, 'tempDir not set');
    assert(
      existsSync(join(this.tempDir, 'src', 'index.ts')),
      'Expected src/index.ts to exist'
    );
  }
);

Given(
  'a temporary project directory with TypeScript source files',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-docs-test');
    scaffoldDocsProject(this.tempDir, true);
  }
);

Given(
  'a temporary project directory with no {string}',
  function (this: BddWorkflowWorld, _missing: string) {
    this.tempDir = makeTempDir('bdd-docs-no-entry');
    scaffoldDocsProject(this.tempDir, false);
  }
);

Given(
  'a temporary project directory with a malformed TypeScript file',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-docs-malformed');
    scaffoldDocsProject(this.tempDir, true);
    // Overwrite index.ts with a syntax error
    writeFileSync(
      join(this.tempDir, 'src', 'index.ts'),
      `export function broken( {}\n`, // deliberate syntax error
      'utf-8'
    );
  }
);

// ─── docs When steps ─────────────────────────────────────────────────────────

When(
  'I run "bdd-workflow --help"',
  function (this: BddWorkflowWorld) {
    const result = runCli(['--help'], packageRoot);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "bdd-workflow docs" in the project directory',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['docs'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "bdd-workflow docs --format html" in the project directory',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['docs', '--format', 'html'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

// ─── docs Then steps ─────────────────────────────────────────────────────────

Then(
  'the output contains {string}',
  function (this: BddWorkflowWorld, expected: string) {
    assert(
      this.lastOutput?.includes(expected),
      `Expected output to contain "${expected}".\nActual output:\n${this.lastOutput}`
    );
  }
);

Then(
  'the command exits with code 0',
  function (this: BddWorkflowWorld) {
    assert.equal(
      this.lastExitCode,
      0,
      `Expected exit code 0 but got ${this.lastExitCode}.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'the {string} directory is created',
  function (this: BddWorkflowWorld, dirName: string) {
    assert(this.tempDir, 'tempDir not set');
    const dirPath = join(this.tempDir, dirName.replace(/\/$/, ''));
    assert(
      existsSync(dirPath),
      `Expected directory "${dirName}" to exist at ${dirPath}.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'it contains at least one markdown file',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const docsDir = join(this.tempDir, 'docs');
    assert(existsSync(docsDir), `docs/ directory does not exist`);

    function findMd(dir: string): boolean {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (findMd(join(dir, entry.name))) return true;
        } else if (entry.name.endsWith('.md')) {
          return true;
        }
      }
      return false;
    }

    assert(
      findMd(docsDir),
      `Expected at least one .md file in docs/ but found none.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'the {string} directory contains HTML files',
  function (this: BddWorkflowWorld, dirName: string) {
    assert(this.tempDir, 'tempDir not set');
    const dirPath = join(this.tempDir, dirName.replace(/\/$/, ''));
    assert(existsSync(dirPath), `Expected directory "${dirName}" to exist`);

    function findHtml(dir: string): boolean {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (findHtml(join(dir, entry.name))) return true;
        } else if (entry.name.endsWith('.html')) {
          return true;
        }
      }
      return false;
    }

    assert(
      findHtml(dirPath),
      `Expected at least one .html file in ${dirName} but found none.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'the command exits with a non-zero code',
  function (this: BddWorkflowWorld) {
    assert.notEqual(
      this.lastExitCode,
      0,
      `Expected non-zero exit code but got 0.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'the output contains a helpful error message',
  function (this: BddWorkflowWorld) {
    assert(
      this.lastOutput && this.lastOutput.length > 0,
      'Expected error output but got empty string'
    );
    // The error should mention the missing entry point or a recognizable message
    const hasHelp =
      this.lastOutput.includes('entry point') ||
      this.lastOutput.includes('src/index.ts') ||
      this.lastOutput.includes('not found') ||
      this.lastOutput.includes('Error') ||
      this.lastOutput.includes('error');
    assert(
      hasHelp,
      `Expected output to contain a helpful error message.\nActual output:\n${this.lastOutput}`
    );
  }
);

Then(
  'the error output is not swallowed',
  function (this: BddWorkflowWorld) {
    assert(
      this.lastOutput && this.lastOutput.trim().length > 0,
      `Expected error output to be non-empty but it was empty`
    );
  }
);
