/**
 * Step definitions for context generation testing.
 * Tests that `bdd-workflow context` generates CONTEXT.md with all expected
 * sections from TypeScript source files and Gherkin feature files.
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

/**
 * Absolute path to the bdd-workflow package root.
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

/**
 * Write a minimal bdd-workflow.config.ts to the project directory.
 * Uses the loadConfig tsx-subprocess path so the config is loaded correctly.
 */
function writeDefaultConfig(projectDir: string): void {
  const content = `import { defineConfig } from 'bdd-workflow';
export default defineConfig({
  context: {
    outputFile: 'CONTEXT.md',
    include: ['src/**/*.ts', 'features/**/*.feature'],
    exclude: ['node_modules', 'dist'],
    sections: {
      structure: true,
      moduleSummaries: true,
      featureSummaries: true,
      exports: true,
    },
  },
});
`;
  writeFileSync(join(projectDir, 'bdd-workflow.config.ts'), content, 'utf-8');
}

/**
 * Write a minimal tsconfig.json so the TS compiler API can resolve types.
 */
function writeTsConfig(projectDir: string): void {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
  };
  writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');
}

/**
 * Write a minimal package.json so generateContext can find a description.
 */
function writePackageJson(projectDir: string): void {
  const pkg = {
    name: 'test-project',
    version: '1.0.0',
    description: 'A test project for bdd-workflow context generation',
    type: 'module',
  };
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
}

/**
 * Install bdd-workflow into the project so the config file can import it.
 * Uses the local package root to avoid requiring a published package.
 */
function installBddWorkflow(projectDir: string): void {
  spawnSync('npm', ['install', '--omit=optional', packageRoot], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
  });
}

// Track the last-created "no-jsdoc" file path for assertion
declare module '../world.ts' {
  interface BddWorkflowWorld {
    noJsDocFilePath?: string;
    contextFirstRun?: string;
    exportFunctionName?: string;
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

/**
 * Create a temporary project directory with a minimal TypeScript project
 * and a sample feature file. Sets up enough structure for context generation
 * to succeed without errors.
 */
Given(
  'a temporary project directory with TypeScript source files and feature specs',
  function (this: BddWorkflowWorld) {
    // If tempDir is already set (by "the bdd-workflow package is built" Background step
    // running first), we just augment it. Otherwise create fresh.
    if (!this.tempDir) {
      this.tempDir = join('/tmp', `bdd-ctx-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
      mkdirSync(this.tempDir, { recursive: true });
    }

    const projectDir = this.tempDir;

    // Create src/ with a minimal module
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'index.ts'),
      `/**
 * @module test-project
 * @description A test module for context generation.
 */

export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
      'utf-8'
    );

    // Create features/ with a minimal feature file
    mkdirSync(join(projectDir, 'features'), { recursive: true });
    writeFileSync(
      join(projectDir, 'features', 'hello.feature'),
      `Feature: Hello
  Scenario: Greet a user
    Given a user named "Alice"
    When I greet them
    Then they receive "Hello, Alice!"
`,
      'utf-8'
    );

    writePackageJson(projectDir);
    writeTsConfig(projectDir);
    writeDefaultConfig(projectDir);
    installBddWorkflow(projectDir);
  }
);

/**
 * Add TypeScript files with JSDoc comments to the project.
 */
Given(
  'the project has TypeScript source files with JSDoc comments',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    // src/index.ts was created in the Background step with a JSDoc comment
    // Nothing extra needed here.
  }
);

/**
 * Add a Gherkin feature file to the project.
 */
Given(
  'the project has Gherkin feature files with scenarios',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    // features/hello.feature was created in the Background step
    // Nothing extra needed here.
  }
);

/**
 * Add a TypeScript file with a specific file-level JSDoc comment.
 */
Given(
  'the project has a TypeScript file with a file-level JSDoc comment {string}',
  function (this: BddWorkflowWorld, description: string) {
    assert(this.tempDir, 'tempDir not set');
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    writeFileSync(
      join(this.tempDir, 'src', 'described.ts'),
      `/**
 * @module described
 * @description ${description}
 */

export function placeholder(): void {}
`,
      'utf-8'
    );
  }
);

/**
 * Add a TypeScript file with no file-level JSDoc comment.
 */
Given(
  'the project has a TypeScript file with no file-level JSDoc comment',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });
    const filePath = join(this.tempDir, 'src', 'undocumented.ts');
    writeFileSync(
      filePath,
      `// No JSDoc comment here
export function undocumented(): void {}
`,
      'utf-8'
    );
    this.noJsDocFilePath = 'src/undocumented.ts';
  }
);

/**
 * Add a feature file with a specific feature name.
 */
Given(
  'the project has a feature file with feature name {string}',
  function (this: BddWorkflowWorld, featureName: string) {
    assert(this.tempDir, 'tempDir not set');
    mkdirSync(join(this.tempDir, 'features'), { recursive: true });
    writeFileSync(
      join(this.tempDir, 'features', 'named.feature'),
      `Feature: ${featureName}\n`,
      'utf-8'
    );
  }
);

/**
 * Add a scenario to the named feature file.
 */
Given(
  'that feature file has a scenario named {string}',
  function (this: BddWorkflowWorld, scenarioName: string) {
    assert(this.tempDir, 'tempDir not set');
    const featurePath = join(this.tempDir, 'features', 'named.feature');
    const current = existsSync(featurePath) ? readFileSync(featurePath, 'utf-8') : '';
    writeFileSync(
      featurePath,
      current + `  Scenario: ${scenarioName}\n    Given a step\n`,
      'utf-8'
    );
  }
);

/**
 * Add a TypeScript file that exports a function with the given signature.
 * The signature string is parsed to extract the function name and a placeholder
 * return type so we can write valid TS.
 */
Given(
  'the project has a TypeScript file exporting a function {string}',
  function (this: BddWorkflowWorld, signature: string) {
    assert(this.tempDir, 'tempDir not set');
    mkdirSync(join(this.tempDir, 'src'), { recursive: true });

    // Extract function name from signature like "createSession(userId: string): Promise<Session>"
    const nameMatch = signature.match(/^(\w+)\(/);
    const funcName = nameMatch ? nameMatch[1] : 'exportedFn';
    this.exportFunctionName = funcName;

    // Write a TS file with the declared function — use 'any' return type for simplicity
    // so we don't need to define the Session interface in this test helper
    writeFileSync(
      join(this.tempDir, 'src', 'api.ts'),
      `/**
 * @module api
 * @description API module for testing exports extraction.
 */

export interface Session {
  id: string;
  userId: string;
}

export async function createSession(userId: string): Promise<Session> {
  return { id: 'test', userId };
}
`,
      'utf-8'
    );
  }
);

/**
 * Write a bdd-workflow.config.ts with a specific section option disabled.
 * Accepts strings like "featureSummaries: false" or "exports: false".
 */
Given(
  'bdd-workflow.config.ts has {string}',
  function (this: BddWorkflowWorld, configOption: string) {
    assert(this.tempDir, 'tempDir not set');

    // Parse the option: "featureSummaries: false" or "exports: false"
    const match = configOption.match(/^(\w+):\s*(true|false)$/);
    if (!match) {
      throw new Error(`Cannot parse config option: "${configOption}"`);
    }
    const [, key, value] = match;

    // Build sections config with the given key overridden
    const sections: Record<string, string> = {
      structure: 'true',
      moduleSummaries: 'true',
      featureSummaries: 'true',
      exports: 'true',
    };
    sections[key] = value;

    const content = `import { defineConfig } from 'bdd-workflow';
export default defineConfig({
  context: {
    outputFile: 'CONTEXT.md',
    include: ['src/**/*.ts', 'features/**/*.feature'],
    exclude: ['node_modules', 'dist'],
    sections: {
      structure: ${sections.structure},
      moduleSummaries: ${sections.moduleSummaries},
      featureSummaries: ${sections.featureSummaries},
      exports: ${sections.exports},
    },
  },
});
`;
    writeFileSync(join(this.tempDir, 'bdd-workflow.config.ts'), content, 'utf-8');
  }
);

/**
 * Add TypeScript source files but no feature files.
 */
Given(
  'the project has TypeScript source files but no Gherkin feature files',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    // Remove any .feature files that the Background step may have created
    const featuresDir = join(this.tempDir, 'features');
    if (existsSync(featuresDir)) {
      rmSync(featuresDir, { recursive: true, force: true });
    }
    mkdirSync(featuresDir, { recursive: true });
    // src/index.ts is already present from Background
  }
);

/**
 * Run `bdd-workflow context` in the project.
 *
 * Also saves the first-run content to `this.contextFirstRun` for use by the
 * determinism scenario's `Given` step (which calls this via the `Given` keyword
 * in the feature file). Cucumber resolves Given/When/Then interchangeably, so
 * a single definition covers both the `Given` and `When` usages.
 */
When(
  'I run "npx bdd-workflow context" in the project',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['context'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
    // Save first-run content for determinism scenario
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    if (existsSync(contextPath)) {
      this.contextFirstRun = readFileSync(contextPath, 'utf-8');
    }
  }
);

/**
 * Run `bdd-workflow context` a second time (for the determinism scenario).
 */
When(
  'I run "npx bdd-workflow context" again in the project',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['context'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Assert CONTEXT.md was created at the project root.
 */
Then(
  'CONTEXT.md is created at the project root',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    assert(
      existsSync(contextPath),
      `CONTEXT.md was not created at ${contextPath}. CLI output: ${this.lastOutput}`
    );
  }
);

/**
 * Assert CONTEXT.md contains a specific section heading.
 */
Then(
  'CONTEXT.md contains a {string} section',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    assert(existsSync(contextPath), `CONTEXT.md not found at ${contextPath}`);
    const content = readFileSync(contextPath, 'utf-8');
    assert(
      content.includes(sectionHeading),
      `CONTEXT.md does not contain section "${sectionHeading}".\nContent:\n${content}`
    );
  }
);

/**
 * Assert a section of CONTEXT.md includes a specific file path.
 * Used for "the ## Modules section includes the file path" (without specifying the path).
 */
Then(
  'the {string} section includes the file path',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');
    // Extract the section
    const section = extractSection(content, sectionHeading);
    assert(section !== null, `Section "${sectionHeading}" not found in CONTEXT.md`);
    // The file path for the described.ts file should be present
    assert(
      section.includes('described.ts'),
      `Section "${sectionHeading}" does not include the file path "described.ts".\nSection content:\n${section}`
    );
  }
);

/**
 * Assert a section of CONTEXT.md includes specific text.
 */
Then(
  'the {string} section includes the text {string}',
  function (this: BddWorkflowWorld, sectionHeading: string, text: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');
    const section = extractSection(content, sectionHeading);
    assert(section !== null, `Section "${sectionHeading}" not found in CONTEXT.md`);
    assert(
      section.includes(text),
      `Section "${sectionHeading}" does not include text "${text}".\nSection content:\n${section}`
    );
  }
);

/**
 * Assert a section of CONTEXT.md includes specific text (generic version).
 */
Then(
  'the {string} section includes {string}',
  function (this: BddWorkflowWorld, sectionHeading: string, text: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');
    const section = extractSection(content, sectionHeading);
    assert(section !== null, `Section "${sectionHeading}" not found in CONTEXT.md`);
    assert(
      section.includes(text),
      `Section "${sectionHeading}" does not include "${text}".\nSection content:\n${section}`
    );
  }
);

/**
 * Assert the ## Modules section does not include the undocumented file path.
 */
Then(
  'the {string} section does not include that file',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');
    const section = extractSection(content, sectionHeading);
    // Section may not exist at all (which satisfies the assertion)
    if (section === null) return;
    const fileName = this.noJsDocFilePath ?? 'undocumented.ts';
    assert(
      !section.includes(fileName),
      `Section "${sectionHeading}" should not include "${fileName}" but it does.\nSection:\n${section}`
    );
  }
);

/**
 * Assert the ## Public API section includes the exported function signature.
 */
Then(
  'the {string} section includes the function signature',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');
    const section = extractSection(content, sectionHeading);
    assert(section !== null, `Section "${sectionHeading}" not found in CONTEXT.md`);
    const funcName = this.exportFunctionName ?? 'createSession';
    assert(
      section.includes(funcName),
      `Section "${sectionHeading}" does not include function "${funcName}".\nSection:\n${section}`
    );
  }
);

/**
 * Assert both CONTEXT.md runs produce identical content (excluding the timestamp line).
 * Uses a regex literal to avoid Cucumber Expression treating ( ) as optional groups.
 */
Then(
  /^both CONTEXT\.md files are byte-for-byte identical \(excluding the timestamp line\)$/,
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    assert(this.contextFirstRun !== undefined, 'First run content not captured');

    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const secondRun = readFileSync(contextPath, 'utf-8');

    // Strip timestamp lines before comparing
    const stripTimestamp = (s: string) =>
      s.split('\n').filter(line => !line.startsWith('> Last updated:')).join('\n');

    const first = stripTimestamp(this.contextFirstRun);
    const second = stripTimestamp(secondRun);

    assert.equal(
      second,
      first,
      'CONTEXT.md output differs between two runs (excluding timestamp line)'
    );
  }
);

/**
 * Assert CONTEXT.md was created without errors (exit code 0 and file exists).
 */
Then(
  'CONTEXT.md is created without errors',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    assert.equal(
      this.lastExitCode,
      0,
      `bdd-workflow context exited with non-zero code ${this.lastExitCode}. Output: ${this.lastOutput}`
    );
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    assert(existsSync(contextPath), `CONTEXT.md was not created at ${contextPath}`);
  }
);

/**
 * Assert the ## Features section is omitted or shows "No feature files found".
 */
Then(
  'the {string} section is omitted or shows "No feature files found"',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    const content = readFileSync(contextPath, 'utf-8');

    const hasSection = content.includes(sectionHeading);
    if (!hasSection) {
      // Section omitted — acceptable
      return;
    }

    const section = extractSection(content, sectionHeading);
    assert(
      section !== null && section.includes('No feature files found'),
      `Section "${sectionHeading}" exists but does not show "No feature files found".\nSection:\n${section}`
    );
  }
);

/**
 * Assert CONTEXT.md does NOT contain a specific section heading.
 */
Then(
  'CONTEXT.md does not contain a {string} section',
  function (this: BddWorkflowWorld, sectionHeading: string) {
    assert(this.tempDir, 'tempDir not set');
    const contextPath = join(this.tempDir, 'CONTEXT.md');
    assert(existsSync(contextPath), `CONTEXT.md not found at ${contextPath}`);
    const content = readFileSync(contextPath, 'utf-8');
    assert(
      !content.includes(sectionHeading),
      `CONTEXT.md should not contain section "${sectionHeading}" but it does.\nContent:\n${content}`
    );
  }
);

/**
 * Extract a section from markdown content by its heading.
 * Returns everything from the heading line until the next heading of the same
 * or higher level, or end of file.
 *
 * @param content - Full markdown content
 * @param heading - Section heading to find (e.g. "## Modules")
 * @returns Section text, or null if not found
 */
function extractSection(content: string, heading: string): string | null {
  const headingLevel = heading.match(/^(#+)/)?.[1].length ?? 2;
  const lines = content.split('\n');
  const startIdx = lines.findIndex(line => line === heading || line.startsWith(heading));
  if (startIdx === -1) return null;

  const endPattern = new RegExp(`^#{1,${headingLevel}} `);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (endPattern.test(lines[i]) && !lines[i].startsWith(heading)) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n');
}
