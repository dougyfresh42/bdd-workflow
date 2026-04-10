/**
 * Step definitions for Phase 2 scaffold testing.
 * Tests that all OpenCode skills, commands, agents, and templates are properly scaffolded.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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
 * Check that multiple files exist.
 */
Then('the following skill files exist:', function (this: BddWorkflowWorld, dataTable) {
  assert(this.tempDir, 'tempDir not set');
  const rows = dataTable.hashes();
  for (const row of rows) {
    const path = join(this.tempDir, row.path);
    assert(
      existsSync(path),
      `Missing skill file: ${path}`
    );
  }
});

/**
 * Check that multiple command files exist.
 */
Then('the following command files exist:', function (this: BddWorkflowWorld, dataTable) {
  assert(this.tempDir, 'tempDir not set');
  const rows = dataTable.hashes();
  for (const row of rows) {
    const path = join(this.tempDir, row.path);
    assert(
      existsSync(path),
      `Missing command file: ${path}`
    );
  }
});

/**
 * Check that a specific file exists.
 */
Then('the file {string} exists', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  assert(
    existsSync(fullPath),
    `File does not exist: ${fullPath}`
  );
});

/**
 * Check that a specific file does not exist.
 */
Then('the file {string} does not exist', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  assert(
    !existsSync(fullPath),
    `File should not exist but does: ${fullPath}`
  );
});

/**
 * Check that a specific file is not empty.
 */
Then('the file {string} is not empty', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  assert(existsSync(fullPath), `File does not exist: ${fullPath}`);
  const content = readFileSync(fullPath, 'utf-8');
  assert(content.trim().length > 0, `File is empty: ${fullPath}`);
});

/**
 * Check that a template file contains YAML frontmatter.
 */
Then('the template file {string} contains frontmatter', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  assert(
    content.startsWith('---'),
    `Template ${filePath} does not start with YAML frontmatter`
  );
  const lines = content.split('\n');
  let foundClosing = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('---')) {
      foundClosing = true;
      break;
    }
  }
  assert(foundClosing, `Template ${filePath} does not have closing YAML frontmatter`);
});

/**
 * Check that a template file contains a specific section header.
 */
Then('the template file {string} contains section {string}', function (this: BddWorkflowWorld, filePath: string, section: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  assert(
    content.includes(section),
    `Template ${filePath} does not contain section: ${section}`
  );
});

/**
 * Check that a file contains specific text.
 */
Then('the file {string} contains text {string}', function (this: BddWorkflowWorld, filePath: string, text: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  assert(
    content.includes(text),
    `File ${filePath} does not contain: "${text}"`
  );
});

/**
 * Check that a file contains YAML frontmatter.
 */
Then('the file {string} contains YAML frontmatter', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  assert(
    content.startsWith('---'),
    `File ${filePath} does not start with YAML frontmatter`
  );
});

/**
 * Check that a file contains valid JSON.
 */
Then('the file {string} contains valid JSON', function (this: BddWorkflowWorld, filePath: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  try {
    JSON.parse(content);
  } catch (err) {
    throw new Error(`File ${filePath} does not contain valid JSON: ${err}`);
  }
});

/**
 * Check that a JSON file contains a specific key.
 */
Then('the file {string} contains {string}', function (this: BddWorkflowWorld, filePath: string, key: string) {
  assert(this.tempDir, 'tempDir not set');
  const fullPath = join(this.tempDir, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  assert(
    content.includes(key),
    `File ${filePath} does not contain: "${key}"`
  );
});
