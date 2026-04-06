/**
 * @module steps/config-validation
 * @description Step definitions for config-validation.feature. Tests the
 * validateConfig function directly (unit-level) and also verifies that CLI
 * commands exit 1 with clear output when the project config is invalid.
 * Unit-level steps import validateConfig from the built dist/ package. The
 * integration scenario spawns the CLI in a temporary project directory.
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

/**
 * Absolute path to the package root directory.
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
      timeout: 30000,
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// Extend world with validation-test state
declare module '../world.ts' {
  interface BddWorkflowWorld {
    validationErrors?: Array<{ field: string; message: string }>;
    validationConfig?: Record<string, unknown>;
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

// ─── Import validateConfig from built dist ───────────────────────────────────

async function importValidateConfig(): Promise<{
  defineConfig: (c: Record<string, unknown>) => Record<string, unknown>;
  validateConfig: (c: Record<string, unknown>) => Array<{ field: string; message: string }>;
}> {
  const mod = await import(join(packageRoot, 'dist', 'index.js'));
  return { defineConfig: mod.defineConfig, validateConfig: mod.validateConfig };
}

// ─── Given steps ─────────────────────────────────────────────────────────────

Given('a valid bdd-workflow configuration', async function (this: BddWorkflowWorld) {
  const { defineConfig, validateConfig } = await importValidateConfig();
  this.defineConfig = defineConfig;
  this.validateConfig = validateConfig;
  this.validationConfig = defineConfig({});
});

Given(
  'a bdd-workflow config with language set to {string}',
  async function (this: BddWorkflowWorld, lang: string) {
    const { defineConfig, validateConfig } = await importValidateConfig();
    this.defineConfig = defineConfig;
    this.validateConfig = validateConfig;
    this.validationConfig = { ...defineConfig({}), language: lang };
  }
);

Given(
  'a bdd-workflow config with bdd.featuresDir set to {string}',
  async function (this: BddWorkflowWorld, value: string) {
    const { defineConfig, validateConfig } = await importValidateConfig();
    this.defineConfig = defineConfig;
    this.validateConfig = validateConfig;
    const base = defineConfig({}) as Record<string, unknown>;
    this.validationConfig = {
      ...base,
      bdd: { ...(base.bdd as object), featuresDir: value },
    };
  }
);

Given(
  'a bdd-workflow config with bdd.runCommand set to {string}',
  async function (this: BddWorkflowWorld, value: string) {
    const { defineConfig, validateConfig } = await importValidateConfig();
    this.defineConfig = defineConfig;
    this.validateConfig = validateConfig;
    const base = defineConfig({}) as Record<string, unknown>;
    this.validationConfig = {
      ...base,
      bdd: { ...(base.bdd as object), runCommand: value },
    };
  }
);

Given(
  'a bdd-workflow config with docs.style set to {string}',
  async function (this: BddWorkflowWorld, value: string) {
    const { defineConfig, validateConfig } = await importValidateConfig();
    this.defineConfig = defineConfig;
    this.validateConfig = validateConfig;
    const base = defineConfig({}) as Record<string, unknown>;
    this.validationConfig = {
      ...base,
      docs: { ...(base.docs as object), style: value },
    };
  }
);

Given(
  'a bdd-workflow config with docs.format set to {string}',
  async function (this: BddWorkflowWorld, value: string) {
    const { defineConfig, validateConfig } = await importValidateConfig();
    this.defineConfig = defineConfig;
    this.validateConfig = validateConfig;
    const base = defineConfig({}) as Record<string, unknown>;
    this.validationConfig = {
      ...base,
      docs: { ...(base.docs as object), format: value },
    };
  }
);

/**
 * Create a project with an invalid bdd-workflow.config.ts (unsupported language).
 */
Given('a project with an invalid bdd-workflow.config.ts', function (this: BddWorkflowWorld) {
  this.tempDir = join('/tmp', `bdd-cfg-invalid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  mkdirSync(this.tempDir, { recursive: true });

  // Symlink node_modules so the config can import bdd-workflow
  const nmLink = join(this.tempDir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  // Symlink bdd-workflow package itself into node_modules so config can import it
  const bwLink = join(this.tempDir, 'node_modules', 'bdd-workflow');
  if (!existsSync(bwLink)) {
    symlinkSync(packageRoot, bwLink, 'dir');
  }

  // Write an invalid config: unsupported language value
  writeFileSync(
    join(this.tempDir, 'bdd-workflow.config.ts'),
    `import { defineConfig } from 'bdd-workflow';
export default defineConfig({ language: 'ruby' as any });
`,
    'utf-8'
  );

  // Write minimal tsconfig and src so the command doesn't trip on other things
  writeFileSync(
    join(this.tempDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext' },
      include: ['src/**/*'],
    }, null, 2),
    'utf-8'
  );
  mkdirSync(join(this.tempDir, 'src'), { recursive: true });
  mkdirSync(join(this.tempDir, 'features'), { recursive: true });
});

// ─── When steps ──────────────────────────────────────────────────────────────

When('I call validateConfig', function (this: BddWorkflowWorld) {
  assert(this.validateConfig, 'validateConfig not set');
  assert(this.validationConfig, 'validationConfig not set');
  this.validationErrors = this.validateConfig(this.validationConfig);
});

// ─── Then steps ──────────────────────────────────────────────────────────────

Then('the result is an empty array', function (this: BddWorkflowWorld) {
  assert(Array.isArray(this.validationErrors), 'validationErrors is not an array');
  assert.equal(
    this.validationErrors.length,
    0,
    `Expected empty array but got: ${JSON.stringify(this.validationErrors)}`
  );
});

Then(
  'the result contains one error for field {string}',
  function (this: BddWorkflowWorld, field: string) {
    assert(Array.isArray(this.validationErrors), 'validationErrors is not an array');
    const matching = this.validationErrors.filter((e) => e.field === field);
    assert.equal(
      matching.length,
      1,
      `Expected exactly 1 error for field "${field}" but got ${matching.length}. Errors: ${JSON.stringify(this.validationErrors)}`
    );
  }
);

Then(
  'the error message mentions {string} and {string}',
  function (this: BddWorkflowWorld, a: string, b: string) {
    assert(Array.isArray(this.validationErrors), 'validationErrors is not an array');
    const allMessages = this.validationErrors.map((e) => e.message).join(' ');
    assert(
      allMessages.includes(a),
      `Expected error messages to include "${a}". Messages: ${allMessages}`
    );
    assert(
      allMessages.includes(b),
      `Expected error messages to include "${b}". Messages: ${allMessages}`
    );
  }
);

Then(
  'the error message says {string}',
  function (this: BddWorkflowWorld, expected: string) {
    assert(Array.isArray(this.validationErrors), 'validationErrors is not an array');
    const allMessages = this.validationErrors.map((e) => e.message).join(' ');
    assert(
      allMessages.includes(expected),
      `Expected error messages to contain "${expected}". Messages: ${allMessages}`
    );
  }
);
