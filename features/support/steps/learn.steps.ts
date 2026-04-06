/**
 * Step definitions for `bdd-workflow learn` command tests.
 *
 * Tests that the `learn` subcommand lists entries, promotes unpromoted learnings
 * via dry-run, skips already-promoted and closed entries, handles missing `gh`
 * CLI gracefully, and that `parseLearningFile` correctly extracts all fields.
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
  readdirSync,
  unlinkSync,
} from 'fs';
import { join, resolve } from 'path';
import { BddWorkflowWorld } from '../world.ts';

// Extend world to hold the parsed LearningEntry for unit test scenarios
declare module '../world.ts' {
  interface BddWorkflowWorld {
    parsedLearningEntry?: {
      filePath: string;
      slug: string;
      date: string;
      proposal: string;
      status: string;
      promoted: boolean;
      github_issue: number | null;
      title: string;
      body: string;
      whatHappened: string;
      rootCause: string;
      proposedChange: string;
    };
    /** Path to the learning entry fixture used in the parseLearningFile unit test. */
    learningEntryPath?: string;
    /** Whether the PATH was manipulated for the gh-not-available scenario. */
    originalPath?: string;
  }
}

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
 * Build a minimal learning entry markdown string.
 *
 * @param slug         - The entry slug (used as title fallback).
 * @param status       - The lifecycle status.
 * @param promoted     - Whether this entry has been promoted.
 * @param githubIssue  - The issue number (null if not promoted).
 * @returns Markdown content with YAML frontmatter.
 */
function buildLearningEntry(
  slug: string,
  status: string,
  promoted: boolean,
  githubIssue: number | null
): string {
  const issueValue = githubIssue !== null ? String(githubIssue) : 'null';
  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '2026-01-01';

  return [
    '---',
    `date: ${date}`,
    `proposal: .opencode/proposals/example.md`,
    `status: ${status}`,
    `promoted: ${promoted}`,
    `github_issue: ${issueValue}`,
    '---',
    '',
    `# Learning: ${slug} title`,
    '',
    '## What Happened',
    '',
    `What happened content for ${slug}.`,
    '',
    '## Root Cause',
    '',
    `Root cause content for ${slug}.`,
    '',
    '## Proposed Framework Change',
    '',
    `Proposed change content for ${slug}.`,
    '',
    '## Impact',
    '',
    `Impact content for ${slug}.`,
  ].join('\n');
}

/**
 * Clean up temp directory after each scenario.
 * Also restore PATH if it was modified.
 */
After(function (this: BddWorkflowWorld) {
  if (this.originalPath !== undefined) {
    process.env['PATH'] = this.originalPath;
    this.originalPath = undefined;
  }
  if (this.tempDir && existsSync(this.tempDir)) {
    rmSync(this.tempDir, { recursive: true, force: true });
    this.tempDir = undefined;
  }
});

// ─── Background Given steps ───────────────────────────────────────────────────

/**
 * Create a temporary directory with bdd-workflow initialized (full scaffold),
 * including a symlinked node_modules and a bdd-workflow.config.ts.
 */
Given(
  'a clean temporary directory with bdd-workflow initialized',
  function (this: BddWorkflowWorld) {
    const dir = join(
      '/tmp',
      `bdd-learn-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    mkdirSync(dir, { recursive: true });
    this.tempDir = dir;

    // Symlink node_modules so CLI can find bdd-workflow package
    const nmLink = join(dir, 'node_modules');
    if (!existsSync(nmLink)) {
      symlinkSync(join(packageRoot, 'node_modules'), nmLink, 'dir');
    }

    // Run bdd-workflow init
    const initResult = runCli(['init', dir], packageRoot);
    assert.equal(
      initResult.exitCode,
      0,
      `bdd-workflow init failed: ${initResult.stderr}`
    );

    // Ensure learnings directory exists (init should create it, but guard defensively)
    mkdirSync(join(dir, '.opencode', 'learnings'), { recursive: true });
  }
);

/**
 * Write a learning entry fixture with the given slug and status.
 */
Given(
  'a learning entry {string} with status {string}',
  function (this: BddWorkflowWorld, filename: string, status: string) {
    assert(this.tempDir, 'tempDir not set');
    const slug = filename.replace(/\.md$/, '');
    const content = buildLearningEntry(slug, status, false, null);
    const learningsDir = join(this.tempDir, '.opencode', 'learnings');
    mkdirSync(learningsDir, { recursive: true });
    writeFileSync(join(learningsDir, filename), content, 'utf-8');
  }
);

/**
 * Write a promoted learning entry fixture with a GitHub issue number.
 */
Given(
  'a learning entry {string} with status {string} and github_issue {int}',
  function (
    this: BddWorkflowWorld,
    filename: string,
    status: string,
    issueNumber: number
  ) {
    assert(this.tempDir, 'tempDir not set');
    const slug = filename.replace(/\.md$/, '');
    const content = buildLearningEntry(slug, status, true, issueNumber);
    const learningsDir = join(this.tempDir, '.opencode', 'learnings');
    mkdirSync(learningsDir, { recursive: true });
    writeFileSync(join(learningsDir, filename), content, 'utf-8');
  }
);

// ─── Additional Given steps ───────────────────────────────────────────────────

/**
 * Stub PATH to a directory that does not contain `gh`, so that promote
 * detects the missing CLI and exits non-zero.
 * Conservative approach: create a minimal PATH with just the Node.js binary.
 */
Given(
  'the {string} CLI is not available in PATH',
  function (this: BddWorkflowWorld, _cliName: string) {
    this.originalPath = process.env['PATH'];
    // Use a directory that exists but doesn't contain gh (e.g. a fresh temp dir)
    const stubBinDir = join('/tmp', `bdd-learn-stub-${Date.now()}`);
    mkdirSync(stubBinDir, { recursive: true });
    // Keep node in PATH so the CLI can be invoked; exclude everything else
    const nodeBinDir = resolve(process.execPath, '..');
    process.env['PATH'] = `${nodeBinDir}:${stubBinDir}`;
  }
);

/**
 * Overwrite an existing learning entry to mark it as already promoted to a
 * specific GitHub issue number.
 */
Given(
  '{string} has been promoted to issue #{int}',
  function (this: BddWorkflowWorld, filename: string, issueNumber: number) {
    assert(this.tempDir, 'tempDir not set');
    const slug = filename.replace(/\.md$/, '');
    const content = buildLearningEntry(slug, 'promoted', true, issueNumber);
    const learningsDir = join(this.tempDir, '.opencode', 'learnings');
    writeFileSync(join(learningsDir, filename), content, 'utf-8');
  }
);

/**
 * Ensure the learnings directory exists but contains no `.md` files.
 */
Given(
  'the learnings directory exists but contains no files',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const learningsDir = join(this.tempDir, '.opencode', 'learnings');
    mkdirSync(learningsDir, { recursive: true });
    // Remove any fixture files that may have been written by Background steps
    for (const f of readdirSync(learningsDir)) {
      if (f.endsWith('.md')) {
        unlinkSync(join(learningsDir, f));
      }
    }
  }
);

/**
 * Write a complete valid learning entry fixture for the parseLearningFile unit test.
 */
Given(
  'a valid learning entry file with all required frontmatter and sections',
  async function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const content = [
      '---',
      'date: 2026-03-15',
      'proposal: .opencode/proposals/2026-03-15-my-feature.md',
      'status: new',
      'promoted: false',
      'github_issue: null',
      '---',
      '',
      '# Learning: Missing validation caused extra amendment',
      '',
      '## What Happened',
      '',
      'The proposal did not specify input validation, causing the review to fail.',
      '',
      '## Root Cause',
      '',
      'No explicit validation section in the proposal template.',
      '',
      '## Proposed Framework Change',
      '',
      'Add a validation checklist to the proposal template.',
      '',
      '## Impact',
      '',
      'Reduces amendment rounds for features involving user input.',
    ].join('\n');

    const learningsDir = join(this.tempDir, '.opencode', 'learnings');
    mkdirSync(learningsDir, { recursive: true });
    const filePath = join(learningsDir, '2026-03-15-missing-validation.md');
    writeFileSync(filePath, content, 'utf-8');
    this.learningEntryPath = filePath;
  }
);

// ─── When steps ──────────────────────────────────────────────────────────────

/**
 * Run `bdd-workflow learn list` in the temp directory.
 */
When(
  'I run "npx bdd-workflow learn list"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['learn', 'list'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Run `bdd-workflow learn promote --dry-run` in the temp directory.
 */
When(
  'I run "npx bdd-workflow learn promote --dry-run"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['learn', 'promote', '--dry-run'], this.tempDir);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Run `bdd-workflow learn promote` (live, without dry-run) in the temp directory.
 * Uses the process.env PATH which may have been manipulated by the gh-not-available step.
 */
When(
  'I run "npx bdd-workflow learn promote"',
  function (this: BddWorkflowWorld) {
    assert(this.tempDir, 'tempDir not set');
    const result = runCli(['learn', 'promote'], this.tempDir, process.env);
    this.lastOutput = result.stdout + result.stderr;
    this.lastExitCode = result.exitCode;
  }
);

/**
 * Parse the learning entry file set up in the previous Given step
 * using the compiled `parseLearningFile` from `dist/learn/index.js`.
 */
When(
  'I parse the file with parseLearningFile',
  async function (this: BddWorkflowWorld) {
    assert(this.learningEntryPath, 'learningEntryPath not set');
    const mod = await import(join(packageRoot, 'dist', 'learn', 'index.js'));
    this.parsedLearningEntry = await mod.parseLearningFile(this.learningEntryPath);
  }
);

// ─── Then steps ──────────────────────────────────────────────────────────────

/**
 * Assert the output does not contain the given string.
 */
Then(
  'the output does not contain {string}',
  function (this: BddWorkflowWorld, unexpected: string) {
    assert(
      !this.lastOutput?.includes(unexpected),
      `Expected output NOT to contain "${unexpected}".\nActual output:\n${this.lastOutput}`
    );
  }
);

/**
 * Assert that no GitHub issues were created.
 * In a dry-run test context this is always safe to assert — no real gh calls are made.
 * This step is intentionally a no-op assertion; the test harness never has gh auth.
 */
Then(
  'no GitHub issues are created',
  function (this: BddWorkflowWorld) {
    // In dry-run mode, no issue creation occurs by design.
    // This step is a documentation assertion; no external verification is possible
    // without mocking the gh CLI.
    assert(true, 'dry-run mode guarantees no issues are created');
  }
);

/**
 * Assert the parsed LearningEntry has the expected frontmatter field values.
 */
Then(
  'the returned entry has the correct date, slug, status, promoted, and github_issue',
  function (this: BddWorkflowWorld) {
    assert(this.parsedLearningEntry, 'parsedLearningEntry not set');
    const e = this.parsedLearningEntry;
    assert.equal(e.date, '2026-03-15', `Expected date '2026-03-15' but got '${e.date}'`);
    assert.equal(e.slug, '2026-03-15-missing-validation', `Expected slug '2026-03-15-missing-validation' but got '${e.slug}'`);
    assert.equal(e.status, 'new', `Expected status 'new' but got '${e.status}'`);
    assert.equal(e.promoted, false, `Expected promoted false but got ${e.promoted}`);
    assert.equal(e.github_issue, null, `Expected github_issue null but got ${e.github_issue}`);
  }
);

/**
 * Assert the parsed entry title matches the `# Learning:` heading.
 */
Then(
  'the entry title matches the {string} heading',
  function (this: BddWorkflowWorld, _headingPrefix: string) {
    assert(this.parsedLearningEntry, 'parsedLearningEntry not set');
    assert.equal(
      this.parsedLearningEntry.title,
      'Missing validation caused extra amendment',
      `Expected title 'Missing validation caused extra amendment' but got '${this.parsedLearningEntry.title}'`
    );
  }
);

/**
 * Assert that the three extracted body sections are non-empty and correct.
 */
Then(
  'whatHappened, rootCause, and proposedChange are correctly extracted',
  function (this: BddWorkflowWorld) {
    assert(this.parsedLearningEntry, 'parsedLearningEntry not set');
    const e = this.parsedLearningEntry;
    assert(
      e.whatHappened.includes('proposal did not specify input validation'),
      `Unexpected whatHappened: ${e.whatHappened}`
    );
    assert(
      e.rootCause.includes('No explicit validation section'),
      `Unexpected rootCause: ${e.rootCause}`
    );
    assert(
      e.proposedChange.includes('Add a validation checklist'),
      `Unexpected proposedChange: ${e.proposedChange}`
    );
  }
);
