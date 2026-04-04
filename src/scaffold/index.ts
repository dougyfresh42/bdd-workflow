/**
 * Orchestrator for scaffolding a project directory.
 * Walks the templates directory, applies substitutions, and writes files.
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import { hashContent, writeManifest, type Manifest } from './manifest.js';

/**
 * Glob patterns that identify framework-owned files within a scaffolded project.
 * Files matching these patterns are candidates for `update` operations; files
 * outside this set are always treated as user-owned and never touched by update.
 *
 * The framework layer covers:
 * - `.opencode/agents/**`           — agent persona definitions
 * - `.opencode/commands/**`         — OpenCode slash commands
 * - `.opencode/skills/**`           — skill instruction files
 * - `.opencode/templates/**`        — proposal / review / learning templates
 *
 * NOT included (user-owned):
 * - `.opencode/proposals/**`        — user's proposals and learnings
 * - `.opencode/learnings/**`        — user's captured learnings
 * - `src/**`, `features/**`         — user's code and specs
 * - `CONTEXT.md`, `SPECS.md`        — generated/maintained by user or tooling
 * - `package.json`, `tsconfig.json`, etc. — user project config
 */
export const FRAMEWORK_LAYER_GLOBS = [
  '.opencode/agents/**',
  '.opencode/commands/**',
  '.opencode/skills/**',
  '.opencode/templates/**',
];

/**
 * Relative path to the file whose presence marks a directory as an
 * initialized bdd-workflow project. Used by `update` (and potentially
 * `init`) to guard operations that require prior initialization.
 */
export const BDD_WORKFLOW_MARKER = '.opencode/skills/bdd-workflow/SKILL.md';

/**
 * Directory prefixes derived from {@link FRAMEWORK_LAYER_GLOBS}. A file whose
 * relative path starts with one of these prefixes is a framework-layer file.
 */
const FRAMEWORK_LAYER_PREFIXES = FRAMEWORK_LAYER_GLOBS.map(g => g.replace('/**', '/'));

export interface ScaffoldOptions {
  existing?: boolean;
  force?: boolean;
  projectName?: string;
}

/**
 * Scaffold a project with bdd-workflow structure.
 * After writing all files, writes a manifest of SHA-256 hashes for all
 * framework-layer files to `.opencode/.bdd-workflow-manifest.json`.
 *
 * @param targetDir - Target directory to scaffold into
 * @param opts - Scaffolding options
 */
export async function scaffoldProject(targetDir: string, opts: ScaffoldOptions = {}): Promise<void> {
  const projectName = opts.projectName || 'my-project';
  const isExisting = opts.existing ?? false;

  // Ensure target directory exists
  mkdirSync(targetDir, { recursive: true });

  // Get the templates directory relative to this file
  const templatesDir = resolve(import.meta.url.replace('file://', ''), '../templates');

  // Collect all template files (excluding .gitkeep)
  const templateFiles = globSync('**/*', {
    cwd: templatesDir,
    dot: true,
    nodir: false,
  });

  let filesCreated = 0;
  let filesSkipped = 0;
  const frameworkLayerFilesWritten: string[] = [];

  for (const relPath of templateFiles) {
    const sourcePath = join(templatesDir, relPath);
    const targetPath = join(targetDir, relPath);

    // Get file stats
    const stats = statSync(sourcePath);

    // Skip if target exists and not forcing
    if (existsSync(targetPath) && !opts.force) {
      filesSkipped++;
      continue;
    }

    // Create parent directories
    const parentDir = dirname(targetPath);
    if (parentDir !== targetDir) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Copy file or directory
    try {
      if (stats.isDirectory()) {
        // For directories, just ensure they exist
        mkdirSync(targetPath, { recursive: true });
      } else {
        // For files, copy with force option
        cpSync(sourcePath, targetPath, { force: opts.force ?? false });
        filesCreated++;
        if (FRAMEWORK_LAYER_PREFIXES.some(prefix => relPath.startsWith(prefix))) {
          frameworkLayerFilesWritten.push(relPath);
        }
      }
    } catch (err) {
      // Silently skip if source doesn't exist or is a directory marker
      if (relPath.endsWith('.gitkeep')) {
        filesSkipped++;
      } else {
        throw err;
      }
    }
  }

  // Record SHA-256 hashes for framework-layer files in the manifest
  const manifest: Manifest = {};
  for (const relPath of frameworkLayerFilesWritten) {
    const diskPath = join(targetDir, relPath);
    if (existsSync(diskPath)) {
      manifest[relPath] = hashContent(readFileSync(diskPath, 'utf-8'));
    }
  }
  writeManifest(targetDir, manifest);

  console.log('\n✓ Project scaffolded successfully at', targetDir);
  console.log(`  Created: ${filesCreated} files`);
  if (filesSkipped > 0) {
    console.log(`  Skipped: ${filesSkipped} existing files`);
  }
  console.log('\nNext steps:');
  console.log(`  1. cd ${relative(process.cwd(), targetDir)}`);
  console.log('  2. npm install');
  console.log('  3. npx cucumber-js');
}
