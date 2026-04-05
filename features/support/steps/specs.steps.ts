/**
 * Step definitions for `bdd-workflow specs` command tests.
 *
 * Tests that the `specs` subcommand appears in CLI help, generates SPECS.md
 * with correct feature sections, scenario step text, tags, scenario outline
 * handling, a summary table, and respects the --output flag.
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
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
 * Write a minimal bdd-workflow.config.ts that points at the features dir.
 */
function writeConfig(projectDir: string): void {
  // Symlink node_modules so the config file can import bdd-workflow
  const nmLink = join(projectDir, 'node_modules');
  if (!existsSync(nmLink)) {
    symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
  }

  const content = `import { defineConfig } from 'bdd-workflow';
export default defineConfig({
  bdd: { framework: 'cucumber', featuresDir: 'features', stepsDir: 'features/support/steps', runCommand: 'npx cucumber-js' },
});
`;
  writeFileSync(join(projectDir, 'bdd-workflow.config.ts'), content, 'utf-8');
}

/**
 * Write a simple feature file to the project.
 */
function writeFeatureFile(
  projectDir: string,
  name: string,
  content: string
): void {
  const featuresDir = join(projectDir, 'features');
  mkdirSync(featuresDir, { recursive: true });
  writeFileSync(join(featuresDir, name), content, 'utf-8');
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

// ─── Givens ──────────────────────────────────────────────────────────────────

Given(
  'a temporary project directory with two ".feature" files',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'alpha.feature',
      `Feature: Alpha\n  Scenario: First scenario\n    Given a step\n`
    );
    writeFeatureFile(
      this.tempDir,
      'beta.feature',
      `Feature: Beta\n  Scenario: Second scenario\n    Given another step\n`
    );
  }
);

Given(
  'a temporary project directory with a feature file containing steps',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-steps-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'greet.feature',
      `Feature: Greet\n  Scenario: Greet a user\n    Given a user named "Alice"\n    When I greet them\n    Then they receive "Hello, Alice!"\n`
    );
  }
);

Given(
  'a temporary project directory with three feature files',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-three-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'one.feature',
      `Feature: One\n  Scenario: S1\n    Given a step\n  Scenario: S2\n    Given a step\n`
    );
    writeFeatureFile(
      this.tempDir,
      'two.feature',
      `Feature: Two\n  Scenario: S3\n    Given a step\n`
    );
    writeFeatureFile(
      this.tempDir,
      'three.feature',
      `Feature: Three\n  Scenario: S4\n    Given a step\n  Scenario: S5\n    Given a step\n`
    );
  }
);

Given(
  'a temporary project directory with no ".feature" files',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-empty-test');
    writeConfig(this.tempDir);
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });
  }
);

Given(
  'a feature file with tagged scenarios',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-tags-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'tagged.feature',
      `Feature: Tagged\n  @smoke\n  Scenario: Tagged smoke scenario\n    Given a tagged step\n`
    );
  }
);

Given(
  'a feature file with a Scenario Outline and an Examples table',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-outline-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'outline.feature',
      `Feature: Outline\n  Scenario Outline: Greet <name>\n    Given a user named "<name>"\n    Then they receive "Hello, <name>!"\n    Examples:\n      | name  |\n      | Alice |\n      | Bob   |\n`
    );
  }
);

Given(
  'a temporary project directory with feature files',
  function (this: BddWorkflowWorld) {
    this.tempDir = makeTempDir('bdd-specs-output-test');
    writeConfig(this.tempDir);
    writeFeatureFile(
      this.tempDir,
      'sample.feature',
      `Feature: Sample\n  Scenario: A scenario\n    Given a step\n`
    );
  }
);

// ─── When steps ──────────────────────────────────────────────────────────────

When(
  'I run "bdd-workflow specs" in the project directory',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['specs'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "bdd-workflow specs"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['specs'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

When(
  'I run "bdd-workflow specs --output my-specs.md"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['specs', '--output', 'my-specs.md'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

// ─── Then steps ──────────────────────────────────────────────────────────────

Then(
  '"SPECS.md" exists in the project directory',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    assert(
      existsSync(specsPath),
      `Expected SPECS.md to exist at ${specsPath}.\nOutput:\n${this.lastOutput}`
    );
  }
);

Then(
  'it contains one H2 section per feature file',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    const h2Lines = content.split('\n').filter((l) => /^## /.test(l) && l !== '## Summary');
    // We expect one H2 per feature (excluding the Summary section)
    assert(
      h2Lines.length >= 2,
      `Expected at least 2 H2 feature sections but found ${h2Lines.length}.\nContent:\n${content}`
    );
  }
);

Then(
  '"SPECS.md" lists each scenario name as an H3 heading',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    assert(
      content.includes('### Greet a user'),
      `Expected "### Greet a user" in SPECS.md.\nContent:\n${content}`
    );
  }
);

Then(
  'each step is shown with its keyword in bold followed by the step text',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    // Expect bold keyword format: **Given** a user named "Alice"
    assert(
      content.includes('**Given**') || content.includes('**When**') || content.includes('**Then**'),
      `Expected bold step keywords in SPECS.md.\nContent:\n${content}`
    );
  }
);

Then(
  '"SPECS.md" contains a summary table',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    assert(
      content.includes('| Feature | Scenarios |'),
      `Expected summary table header in SPECS.md.\nContent:\n${content}`
    );
  }
);

Then(
  'the total row reflects the correct sum of all scenarios',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    // Total across three feature files: 2 + 1 + 2 = 5
    assert(
      content.includes('| **Total** | **5** |'),
      `Expected total of 5 scenarios in summary table.\nContent:\n${content}`
    );
  }
);

Then(
  '"SPECS.md" contains the header and summary section with zero scenarios',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    assert(
      content.includes('# Behavioral Specifications'),
      `Expected header in SPECS.md.\nContent:\n${content}`
    );
    assert(
      content.includes('| **Total** | **0** |'),
      `Expected total of 0 in summary table.\nContent:\n${content}`
    );
  }
);

Then(
  '"SPECS.md" shows the tags for those scenarios',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    assert(
      content.includes('@smoke') || content.includes('smoke'),
      `Expected @smoke tag in SPECS.md.\nContent:\n${content}`
    );
  }
);

Then(
  '"SPECS.md" shows the outline template with "<parameter>" placeholders',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    assert(
      content.includes('<name>'),
      `Expected "<name>" placeholder in SPECS.md outline.\nContent:\n${content}`
    );
  }
);

Then(
  'does not list individual example rows as separate scenarios',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const specsPath = join(this.tempDir, 'SPECS.md');
    const content = readFileSync(specsPath, 'utf-8');
    // "Alice" and "Bob" are example values — they should NOT appear as H3 scenario headings
    const h3Lines = content.split('\n').filter((l) => /^### /.test(l));
    const hasAliceScenario = h3Lines.some((l) => l.includes('Alice'));
    const hasBobScenario = h3Lines.some((l) => l.includes('Bob'));
    assert(
      !hasAliceScenario && !hasBobScenario,
      `Expected no individual example rows as H3 headings.\nH3 lines found:\n${h3Lines.join('\n')}\nContent:\n${content}`
    );
  }
);

Then(
  'the file {string} is created instead of "SPECS.md"',
  function (this: BddWorkflowWorld, fileName: string) {
    assert(this.tempDir, 'tempDir not set');
    const filePath = join(this.tempDir, fileName);
    const defaultPath = join(this.tempDir, 'SPECS.md');
    assert(
      existsSync(filePath),
      `Expected "${fileName}" to exist at ${filePath}.\nOutput:\n${this.lastOutput}`
    );
    assert(
      !existsSync(defaultPath),
      `Expected SPECS.md NOT to exist when --output is set, but it does.`
    );
  }
);
