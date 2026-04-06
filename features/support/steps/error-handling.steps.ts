/**
 * @module steps/error-handling
 * @description Step definitions for error-handling.feature. Tests that CLI
 * commands print clear, actionable messages and exit with the correct code
 * when encountering empty projects, missing files, or unavailable tools.
 * All scenarios spawn the CLI in a temporary directory and examine stdout/stderr
 * and the exit code. Reuses shared Given/When/Then steps from other step files
 * where they already exist (e.g. the 'gh' PATH manipulation from learn.steps.ts,
 * 'the output contains {string}' from docs.steps.ts, and 'the command exits
 * with status 0' from check.steps.ts).
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
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
  cwd: string,
  env?: NodeJS.ProcessEnv
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    'node',
    [join(packageRoot, 'dist', 'cli.js'), ...args],
    {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
      env: env ?? process.env,
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Create a minimal project directory with node_modules symlinked and a
 * bdd-workflow.config.ts so that CLI commands can load config without
 * requiring a full npm install. Does NOT create src/ or features/ dirs —
 * individual Given steps add them as needed.
 */
function scaffoldMinimalProjectBase(dir: string): void {
  const nmLink = join(dir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'error-test-project', version: '1.0.0', type: 'module' }, null, 2),
    'utf-8'
  );

  writeFileSync(
    join(dir, 'bdd-workflow.config.ts'),
    `import { defineConfig } from 'bdd-workflow';
export default defineConfig({});
`,
    'utf-8'
  );
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

// ─── Given steps ─────────────────────────────────────────────────────────────

/**
 * Create a project with a features/ directory that contains no .feature files.
 * Also creates src/ with a TypeScript file so context generation can run.
 */
Given(
  'a project with no .feature files in the features directory',
  function (this: BddWorkflowWorld) {
    this.tempDir = join(
      '/tmp',
      `bdd-err-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    mkdirSync(this.tempDir, { recursive: true });
    scaffoldMinimalProjectBase(this.tempDir);

    // Empty features/ directory
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });

    // Minimal src/ so context doesn't trip on missing source files
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    writeFileSync(
      join(this.tempDir, 'src', 'index.ts'),
      `/**
 * @module index
 * @description Test module.
 */
export const hello = (): string => 'hello';
`,
      'utf-8'
    );

    writeFileSync(
      join(this.tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        include: ['src/**/*'],
      }, null, 2),
      'utf-8'
    );
  }
);

/**
 * Create a project with no TypeScript files in the src directory.
 * Has a valid feature file so context doesn't warn about features too.
 */
Given(
  'a project with no TypeScript files in the src directory',
  function (this: BddWorkflowWorld) {
    this.tempDir = join(
      '/tmp',
      `bdd-err-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    mkdirSync(this.tempDir, { recursive: true });
    scaffoldMinimalProjectBase(this.tempDir);

    // Empty src/ (no .ts files)
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });

    // Features with a sample feature so feature parser finds something
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });
    writeFileSync(
      join(this.tempDir, 'features', 'sample.feature'),
      `Feature: Sample\n  Scenario: A scenario\n    Given a step\n`,
      'utf-8'
    );

    writeFileSync(
      join(this.tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        include: ['src/**/*'],
      }, null, 2),
      'utf-8'
    );
  }
);

/**
 * Create a project where the configured entry point (src/index.ts) does not
 * exist. The docs command checks for this file and exits 1 with a clear message.
 */
Given(
  'a project where the configured entry point does not exist',
  function (this: BddWorkflowWorld) {
    this.tempDir = join(
      '/tmp',
      `bdd-err-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    mkdirSync(this.tempDir, { recursive: true });
    scaffoldMinimalProjectBase(this.tempDir);

    // Create src/ but deliberately omit src/index.ts
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });

    writeFileSync(
      join(this.tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          declaration: true,
          outDir: 'dist',
        },
        include: ['src/**/*'],
      }, null, 2),
      'utf-8'
    );
  }
);

/**
 * Create a project with no tsconfig.json.
 * The check command checks for this file and exits 1 with an actionable message.
 */
Given(
  'a project with no tsconfig.json',
  function (this: BddWorkflowWorld) {
    this.tempDir = join(
      '/tmp',
      `bdd-err-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    mkdirSync(this.tempDir, { recursive: true });
    scaffoldMinimalProjectBase(this.tempDir);

    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    writeFileSync(join(this.tempDir, 'src', 'index.ts'), `export const x = 1;\n`, 'utf-8');
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });

    // Deliberately do NOT write tsconfig.json
  }
);

// ─── When steps ──────────────────────────────────────────────────────────────

/**
 * Run `bdd-workflow specs` in the temp project directory.
 */
When(
  'I run "npx bdd-workflow specs" in the project',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['specs'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Run `bdd-workflow learn promote` in the temp project directory, or in the
 * package root if tempDir is not set. Passes the current process.env so the
 * PATH manipulation from the 'gh CLI is not available in PATH' Given step
 * takes effect.
 */
When(
  'I run "npx bdd-workflow learn promote" in the project',
  function (this: BddWorkflowWorld) {
    // If no tempDir was set by a prior Given, fall back to the package root
    // (which is a valid initialized bdd-workflow project).
    const cwd = this.tempDir ?? packageRoot;
    const result = runCli(['learn', 'promote'], cwd, process.env);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Run `bdd-workflow docs` in the temp project directory.
 */
When(
  'I run "npx bdd-workflow docs" in the project',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['docs'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Run `bdd-workflow check` in the temp project directory.
 */
When(
  'I run "npx bdd-workflow check" in the project',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['check'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

// ─── Then steps ──────────────────────────────────────────────────────────────

/**
 * Assert the command exited with status 1.
 */
Then(
  'the command exits with status 1',
  function (this: BddWorkflowWorld) {
    assert.equal(
      this.lastExitCode,
      1,
      `Expected exit code 1 but got ${this.lastExitCode}. Output:\n${this.lastOutput}`
    );
  }
);

/**
 * Assert the output contains a message about no feature files.
 * Matches the info log printed by context and specs commands when zero feature
 * files are found.
 */
Then(
  'the output contains a message about no feature files',
  function (this: BddWorkflowWorld) {
    const output = this.lastOutput ?? '';
    const hasMessage =
      output.includes('No .feature files found') ||
      output.includes('feature files') ||
      output.includes('feature summaries');
    assert(
      hasMessage,
      `Expected output to contain a message about no feature files.\nActual output:\n${output}`
    );
  }
);

/**
 * Assert the output contains a message about no source files.
 * Matches the info log printed by context when zero TypeScript source files are found.
 */
Then(
  'the output contains a message about no source files',
  function (this: BddWorkflowWorld) {
    const output = this.lastOutput ?? '';
    const hasMessage =
      output.includes('No TypeScript source files found') ||
      output.includes('source files') ||
      output.includes('modules section');
    assert(
      hasMessage,
      `Expected output to contain a message about no source files.\nActual output:\n${output}`
    );
  }
);

/**
 * Assert the output contains an error about the missing entry point.
 * Matches the error thrown by generateDocs when src/index.ts is absent.
 */
Then(
  'the output contains an error about the missing entry point',
  function (this: BddWorkflowWorld) {
    const output = this.lastOutput ?? '';
    const hasMessage =
      output.includes('entry point not found') ||
      output.includes('src/index.ts') ||
      output.includes('entry point');
    assert(
      hasMessage,
      `Expected output to contain an error about the missing entry point.\nActual output:\n${output}`
    );
  }
);
