/**
 * Step definitions for roadmap command testing.
 *
 * Tests that `bdd-workflow roadmap` subcommands (show, status, link, validate,
 * worktree) work correctly: reading/writing the roadmap YAML, validating
 * structural constraints, associating proposals with steps, and creating git
 * worktrees with copied proposals.
 *
 * Re-uses shared steps from other step files:
 * - 'the output contains {string}'      — defined in docs.steps.ts
 * - 'the command exits with status 0'   — defined in check.steps.ts
 * - 'the command exits with status 1'   — defined in error-handling.steps.ts
 * - 'the file {string} exists'          — defined in scaffold-phase2.steps.ts
 * - 'I run "npx bdd-workflow --help"'   — defined in init.steps.ts
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync,
} from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

// Extend world with test properties (guards against re-declaration from other step files)
declare module '../world.ts' {
  interface BddWorkflowWorld {
    parsedRoadmap?: unknown;
  }
}

/**
 * Absolute path to the package root directory. All CLI invocations use
 * `node <packageRoot>/dist/cli.js` so tests do not require publishing.
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
      timeout: 30000,
    }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Create a unique temporary directory and initialize a minimal bdd-workflow
 * project inside it (with symlinked node_modules and bdd-workflow init run).
 *
 * Returns the path to the initialized project directory.
 */
function createInitializedProject(): string {
  const dir = join(
    '/tmp',
    `bdd-roadmap-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  mkdirSync(dir, { recursive: true });

  // Symlink node_modules so CLI can find packages
  const nmLink = join(dir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  // Run bdd-workflow init
  const initResult = runCli(['init', dir], packageRoot);
  assert.equal(initResult.exitCode, 0, `bdd-workflow init failed: ${initResult.stderr}`);

  // Initialize a git repo (required for worktree commands)
  spawnSync('git', ['init'], { cwd: dir, stdio: 'pipe', encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe', encoding: 'utf-8' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'pipe', encoding: 'utf-8' });

  return dir;
}

/**
 * Write a minimal roadmap YAML to the given project directory.
 */
function writeRoadmapYaml(projectDir: string, content: string): void {
  const roadmapDir = join(projectDir, '.opencode');
  mkdirSync(roadmapDir, { recursive: true });
  writeFileSync(join(roadmapDir, 'roadmap.yaml'), content, 'utf-8');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

After(function (this: BddWorkflowWorld) {
  if (this.tempDir && existsSync(this.tempDir)) {
    rmSync(this.tempDir, { recursive: true, force: true });
    this.tempDir = undefined;
  }
});

// ── Background Given ─────────────────────────────────────────────────────────

Given('an initialized bdd-workflow project', function (this: BddWorkflowWorld) {
  this.tempDir = createInitializedProject();
});

// ── Given steps for roadmap setup ─────────────────────────────────────────────

Given('no roadmap file exists', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  // Ensure the roadmap file does not exist (it should not after init, but be explicit)
  const roadmapPath = join(this.tempDir, '.opencode', 'roadmap.yaml');
  if (existsSync(roadmapPath)) {
    rmSync(roadmapPath);
  }
});

Given(
  'a roadmap file with two steps: {string} \\(pending) and {string} \\(done)',
  function (this: BddWorkflowWorld, step1: string, step2: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: ${step1}\n    title: ${step1} title\n    status: pending\n  - id: ${step2}\n    title: ${step2} title\n    status: done\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with 3 pending steps and 1 done step',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: step-a\n    title: Step A\n    status: pending\n  - id: step-b\n    title: Step B\n    status: pending\n  - id: step-c\n    title: Step C\n    status: pending\n  - id: step-d\n    title: Step D\n    status: done\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with a step {string} \\(pending)',
  function (this: BddWorkflowWorld, stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: ${stepId}\n    title: ${stepId} title\n    status: pending\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a proposal file {string} exists',
  function (this: BddWorkflowWorld, filePath: string) {
    assert(this.tempDir, 'tempDir not set');
    const fullPath = join(this.tempDir, filePath);
    const parentDir = join(fullPath, '..');
    mkdirSync(parentDir, { recursive: true });
    writeFileSync(
      fullPath,
      `---\ntitle: Test Proposal\ndate: 2026-04-08\nstatus: proposed\n---\n\n# Test Proposal\n`,
      'utf-8'
    );
  }
);

Given(
  'a roadmap file with no step named {string}',
  function (this: BddWorkflowWorld, _stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    // Write a roadmap that does NOT contain the given step id
    const content = `title: Test Roadmap\nsteps:\n  - id: some-other-step\n    title: Some other step\n    status: pending\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with a step {string}',
  function (this: BddWorkflowWorld, stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: ${stepId}\n    title: ${stepId} title\n    status: pending\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with valid steps and no structural errors',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Valid Roadmap\nsteps:\n  - id: step-one\n    title: Step One\n    status: pending\n  - id: step-two\n    title: Step Two\n    status: done\n    depends_on:\n      - step-one\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with a step missing the {string} field',
  function (this: BddWorkflowWorld, field: string) {
    assert(this.tempDir, 'tempDir not set');
    // Conservative interpretation: if field is "title", omit the title field
    let stepYaml: string;
    if (field === 'title') {
      stepYaml = `  - id: step-no-title\n    status: pending`;
    } else if (field === 'id') {
      stepYaml = `  - title: Step Without ID\n    status: pending`;
    } else if (field === 'status') {
      stepYaml = `  - id: step-no-status\n    title: Step Without Status`;
    } else {
      stepYaml = `  - id: step-missing\n    status: pending`;
    }
    const content = `title: Invalid Roadmap\nsteps:\n${stepYaml}\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with two steps sharing the id {string}',
  function (this: BddWorkflowWorld, stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Invalid Roadmap\nsteps:\n  - id: ${stepId}\n    title: First ${stepId}\n    status: pending\n  - id: ${stepId}\n    title: Second ${stepId}\n    status: pending\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file where step {string} depends_on {string}',
  function (this: BddWorkflowWorld, stepId: string, missingDep: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Invalid Roadmap\nsteps:\n  - id: ${stepId}\n    title: ${stepId} title\n    status: pending\n    depends_on:\n      - ${missingDep}\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with a step {string} linked to proposal {string}',
  function (this: BddWorkflowWorld, stepId: string, proposalFilename: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: ${stepId}\n    title: ${stepId} title\n    status: pending\n    proposal: ${proposalFilename}\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap file with a step {string} and no linked proposal',
  function (this: BddWorkflowWorld, stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Test Roadmap\nsteps:\n  - id: ${stepId}\n    title: ${stepId} title\n    status: pending\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

Given(
  'a roadmap YAML file conforming to the RoadmapStep schema',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const content = `title: Schema Test Roadmap\nsteps:\n  - id: feature-a\n    title: Feature A\n    status: pending\n    description: First feature to implement\n  - id: feature-b\n    title: Feature B\n    status: in-progress\n    depends_on:\n      - feature-a\n  - id: feature-c\n    title: Feature C\n    status: done\n  - id: feature-d\n    title: Feature D\n    status: skipped\n`;
    writeRoadmapYaml(this.tempDir, content);
  }
);

// ── When steps (specific, not generic) ───────────────────────────────────────

When(
  'I run "npx bdd-workflow roadmap show"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'show'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap status"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'status'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap link setup 2026-04-08-setup.md"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'link', 'setup', '2026-04-08-setup.md'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap link nonexistent some-proposal.md"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'link', 'nonexistent', 'some-proposal.md'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap link setup missing-proposal.md"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'link', 'setup', 'missing-proposal.md'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap validate"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'validate'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "npx bdd-workflow roadmap worktree setup"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['roadmap', 'worktree', 'setup'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When('I parse the roadmap file', async function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  // Load the compiled roadmap module and call readRoadmap
  const mod = await import(join(packageRoot, 'dist', 'roadmap', 'index.js'));
  const config = {
    language: 'typescript',
    bdd: {
      framework: 'cucumber',
      featuresDir: 'features',
      stepsDir: 'features/support/steps',
      runCommand: 'npx cucumber-js',
    },
    docs: {
      style: 'jsdoc',
      generator: 'typedoc',
      outputDir: 'docs',
      format: 'markdown',
    },
    context: {
      outputFile: 'CONTEXT.md',
      include: ['src/**/*'],
      exclude: ['node_modules'],
      sections: {
        structure: true,
        moduleSummaries: true,
        featureSummaries: true,
        exports: true,
      },
    },
    workflow: {
      maxAmendIterations: 3,
      autoReviewAfterApply: true,
      autoContextAfterArchive: true,
      proposalDir: '.opencode/proposals',
      learningsDir: '.opencode/learnings',
      repository: 'test/test',
      roadmapFile: '.opencode/roadmap.yaml',
    },
  };

  // Temporarily change cwd to the temp project for readRoadmap to resolve paths
  const originalCwd = process.cwd();
  process.chdir(this.tempDir);
  try {
    this.parsedRoadmap = mod.readRoadmap(config);
  } finally {
    process.chdir(originalCwd);
  }
});

// ── Then steps ────────────────────────────────────────────────────────────────

Then(
  'the output contains {string} and {string}',
  function (this: BddWorkflowWorld, text1: string, text2: string) {
    assert(
      this.lastOutput?.includes(text1),
      `Expected output to contain "${text1}".\nActual output:\n${this.lastOutput}`
    );
    assert(
      this.lastOutput?.includes(text2),
      `Expected output to contain "${text2}".\nActual output:\n${this.lastOutput}`
    );
  }
);

Then(
  'the roadmap file contains proposal {string} under step {string}',
  function (this: BddWorkflowWorld, proposalFilename: string, stepId: string) {
    assert(this.tempDir, 'tempDir not set');
    const roadmapPath = join(this.tempDir, '.opencode', 'roadmap.yaml');
    const content = readFileSync(roadmapPath, 'utf-8');
    assert(
      content.includes(proposalFilename),
      `Expected roadmap to contain proposal "${proposalFilename}" for step "${stepId}".\nActual:\n${content}`
    );
    const stepIdx = content.indexOf(`id: ${stepId}`);
    assert(
      stepIdx !== -1,
      `Step "${stepId}" not found in roadmap`
    );
  }
);

Then(
  'the directory {string} exists',
  function (this: BddWorkflowWorld, dirPath: string) {
    assert(this.tempDir, 'tempDir not set');
    const fullPath = join(this.tempDir, dirPath);
    assert(
      existsSync(fullPath),
      `Expected directory to exist: ${fullPath}`
    );
  }
);

Then('the output contains the worktree path', function (this: BddWorkflowWorld) {
  assert(this.tempDir, 'tempDir not set');
  const expectedPath = join(this.tempDir, '.worktrees');
  assert(
    this.lastOutput?.includes('.worktrees') || this.lastOutput?.includes(expectedPath),
    `Expected output to contain worktree path.\nActual output:\n${this.lastOutput}`
  );
});

Then(
  'all steps have required fields: id, title, status',
  function (this: BddWorkflowWorld) {
    assert(this.parsedRoadmap, 'parsedRoadmap not set');
    const roadmap = this.parsedRoadmap as {
      steps: Array<{ id?: string; title?: string; status?: string }>;
    };
    assert(Array.isArray(roadmap.steps), 'roadmap.steps should be an array');
    for (const step of roadmap.steps) {
      assert(step.id, `Step is missing required field "id": ${JSON.stringify(step)}`);
      assert(step.title, `Step "${step.id}" is missing required field "title"`);
      assert(step.status, `Step "${step.id}" is missing required field "status"`);
    }
  }
);

Then(
  'status values are one of: pending, in-progress, done, skipped',
  function (this: BddWorkflowWorld) {
    assert(this.parsedRoadmap, 'parsedRoadmap not set');
    const roadmap = this.parsedRoadmap as {
      steps: Array<{ id?: string; status?: string }>;
    };
    const validStatuses = ['pending', 'in-progress', 'done', 'skipped'];
    for (const step of roadmap.steps) {
      assert(
        validStatuses.includes(step.status ?? ''),
        `Step "${step.id}" has invalid status: "${step.status}". Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }
);
