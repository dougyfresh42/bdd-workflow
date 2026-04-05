/**
 * Step definitions for the bdd-workflow check command.
 * Tests that `bdd-workflow check` runs npx tsc --noEmit and npx cucumber-js
 * in sequence, passes on a clean project, and fails fast when either fails.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, symlinkSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

/**
 * Absolute path to the package root directory. All CLI invocations use
 * `node <packageRoot>/dist/cli.js` so the tests do not require the package
 * to be published to the npm registry.
 */
const packageRoot = resolve(new URL(import.meta.url).pathname, '../../../../');

/**
 * Run the local bdd-workflow CLI directly via `node dist/cli.js`.
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
 * Create a unique temporary directory path.
 */
function makeTempDir(): string {
  const dir = join('/tmp', `bdd-check-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Write the minimal files needed for `bdd-workflow check` to run in a
 * temp directory: package.json, tsconfig.json, src/index.ts, cucumber.js,
 * and a symlink to the package root's node_modules so that `npx tsc` and
 * `npx cucumber-js` resolve their binaries without a full `npm install`.
 */
function scaffoldMinimalProject(dir: string): void {
  // Symlink node_modules from the package root so npx can resolve tsc and cucumber
  const nmLink = join(dir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0', type: 'module' }, null, 2),
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
          noEmit: true,
        },
        include: ['src/**/*', 'features/**/*.ts'],
      },
      null,
      2
    ),
    'utf-8'
  );

  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'src', 'index.ts'),
    `export const hello = (): string => 'hello';\n`,
    'utf-8'
  );
}

/**
 * Create a minimal project with a passing Cucumber scenario.
 * Uses a symlinked node_modules from the package root for fast setup.
 */
Given('a minimal project with a passing Cucumber scenario', function (this: BddWorkflowWorld) {
  this.tempDir = makeTempDir();
  scaffoldMinimalProject(this.tempDir);

  // Write a cucumber.js config using tsx/esm/api (same loader as the package root)
  writeFileSync(
    join(this.tempDir, 'cucumber.js'),
    `const defaultProfile = { loader: ['tsx/esm/api'], import: ['features/**/*.steps.ts'], paths: ['features/**/*.feature'] };\nexport { defaultProfile as default };\n`,
    'utf-8'
  );

  // Write a passing feature
  const featuresDir = join(this.tempDir, 'features');
  mkdirSync(featuresDir, { recursive: true });
  writeFileSync(
    join(featuresDir, 'passing.feature'),
    `Feature: Passing scenario\n  Scenario: This scenario passes\n    Given everything is fine\n`,
    'utf-8'
  );

  // Write a step definition for the passing scenario
  writeFileSync(
    join(featuresDir, 'passing.steps.ts'),
    `import { Given } from '@cucumber/cucumber';\nGiven('everything is fine', function () {});\n`,
    'utf-8'
  );
});

/**
 * Create a minimal project with a failing Cucumber scenario.
 * The scenario has an undefined step, causing Cucumber to exit non-zero.
 */
Given('a minimal project with a failing Cucumber scenario', function (this: BddWorkflowWorld) {
  this.tempDir = makeTempDir();
  scaffoldMinimalProject(this.tempDir);

  // Write a cucumber.js config pointing at the features directory
  writeFileSync(
    join(this.tempDir, 'cucumber.js'),
    `export default { default: { paths: ['features/**/*.feature'] } };\n`,
    'utf-8'
  );

  // Write a failing feature (undefined step → Cucumber exits non-zero)
  const featuresDir = join(this.tempDir, 'features');
  mkdirSync(featuresDir, { recursive: true });
  writeFileSync(
    join(featuresDir, 'failing.feature'),
    `Feature: Failing scenario\n  Scenario: This scenario always fails\n    Given a step that does not exist\n`,
    'utf-8'
  );
});

/**
 * Run `bdd-workflow check` in the temp directory using the local CLI binary.
 */
When('I run "bdd-workflow check" in that directory', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const result = runCli(['check'], this.tempDir);
  this.lastOutput = result.stdout + result.stderr;
  this.lastExitCode = result.exitCode;
});

/**
 * Assert the command exited with status 0 (success).
 */
Then('the command exits with status 0', function (this: BddWorkflowWorld) {
  assert.equal(
    this.lastExitCode,
    0,
    `Expected exit code 0 but got ${this.lastExitCode}. Output:\n${this.lastOutput}`
  );
});

/**
 * Overwrite a file in the temp project with content that contains a
 * TypeScript type error (assigning a number to a string-typed variable).
 */
Given(
  'the file {string} contains a type error',
  function (this: BddWorkflowWorld, filePath: string) {
    assert(this.tempDir, 'tempDir not set');
    const fullPath = join(this.tempDir, filePath);
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    writeFileSync(
      fullPath,
      // Deliberate type error: number assigned to string
      `export const value: string = 42;\n`,
      'utf-8'
    );
  }
);
