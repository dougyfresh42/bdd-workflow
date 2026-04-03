/**
 * Orchestrator for scaffolding a project directory.
 * Walks the templates directory, applies substitutions, and writes files.
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { globSync } from 'glob';

export interface ScaffoldOptions {
  existing?: boolean;
  force?: boolean;
  projectName?: string;
}

/**
 * Scaffold a project with bdd-workflow structure.
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
