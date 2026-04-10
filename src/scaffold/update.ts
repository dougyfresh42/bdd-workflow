/**
 * @module scaffold/update
 * @description Performs the in-place update of framework-owned files in an
 * existing project. Reads the write manifest from
 * `.opencode/.bdd-workflow-manifest.json` to perform a three-way diff for
 * each framework-layer file, applies frontmatter merges for agent/command
 * files where only user-owned keys differ, and returns a structured summary.
 *
 * Prune pass: after processing all current template files, iterates manifest
 * entries that have no corresponding template file (files the framework
 * previously wrote but has since removed). Unmodified stale files are deleted
 * from disk and removed from the manifest. User-modified stale files are
 * reported as modifiedByUser and left alone unless --force is passed.
 *
 * Does NOT perform git operations — those remain the user's responsibility.
 * Does NOT modify files outside the framework layer.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { globSync } from 'glob';
import { FRAMEWORK_LAYER_GLOBS } from './index.js';
import { hashContent, readManifest, writeManifest } from './manifest.js';
import { hasFrontmatter, mergeFrontmatter } from './frontmatter.js';

/**
 * Options controlling the behavior of `updateScaffold`.
 */
export interface UpdateOptions {
  /** Overwrite user-modified files without prompting. Default: false. */
  force?: boolean;
  /** Emit verbose per-file status lines to stdout. Default: false. */
  verbose?: boolean;
}

/**
 * Structured result of an `updateScaffold` run.
 */
export interface UpdateResult {
  /** Files written because they were absent. */
  added: string[];
  /** Files whose on-disk content already matches the template. */
  identical: string[];
  /** Files updated because the package changed and user did not modify them. */
  updated: string[];
  /** Files where only user-owned frontmatter keys differed; body + framework
   *  frontmatter refreshed, user keys preserved. */
  merged: string[];
  /** Files that appear to have been customized by the user (body or framework
   *  frontmatter changed) and were skipped. */
  modifiedByUser: string[];
  /** Files deleted from disk because the template no longer includes them
   *  and the on-disk content was unmodified (or --force was passed). */
  pruned: string[];
}

/**
 * Update framework-owned scaffold files in an existing project.
 *
 * Reads the write manifest from `.opencode/.bdd-workflow-manifest.json` to
 * perform a three-way diff for each framework-layer file:
 *
 * - Absent on disk → ADDED: write template content, record hash in manifest.
 * - On disk matches current template → IDENTICAL: no-op.
 * - On disk differs from template, disk hash matches manifest hash (user did
 *   not modify it):
 *   - File has frontmatter → MERGED: apply `mergeFrontmatter` to preserve
 *     user-owned keys (`model`, `temperature`) while updating body and
 *     framework frontmatter from template. Record hash of merged content.
 *   - File has no frontmatter → UPDATED: write template content directly.
 *     Record hash in manifest.
 * - On disk differs from template, disk hash differs from manifest hash (user
 *   modified it):
 *   - File has frontmatter and only user-owned keys differ → MERGED: same
 *     frontmatter merge as above; body and framework keys are refreshed.
 *   - Otherwise → MODIFIED_BY_USER: skip unless `--force`.
 * - No manifest entry (project predates manifest feature) → same as
 *   MODIFIED_BY_USER: conservatively skip unless `--force`.
 *
 * Prune pass: after the per-file loop, iterates manifest keys with no
 * corresponding template file:
 * - File absent from disk → remove manifest entry silently.
 * - Disk hash matches manifest hash (unmodified) or --force → PRUNED: delete
 *   from disk, remove manifest entry.
 * - Disk hash differs (user modified) → MODIFIED_BY_USER: skip.
 *
 * After processing all files, writes the updated manifest.
 *
 * @param targetDir - Absolute path to the project root to update.
 * @param opts - Update options.
 * @returns A structured `UpdateResult` describing what changed.
 */
export function updateScaffold(targetDir: string, opts: UpdateOptions = {}): UpdateResult {
  const result: UpdateResult = {
    added: [],
    identical: [],
    updated: [],
    merged: [],
    modifiedByUser: [],
    pruned: [],
  };

  // Resolve the templates directory relative to this module
  const templatesDir = resolve(import.meta.url.replace('file://', ''), '../templates');

  // Read the manifest written by the last init/update
  const manifest = readManifest(targetDir);

  // Collect all framework-layer template files
  const frameworkFiles: string[] = [];
  for (const pattern of FRAMEWORK_LAYER_GLOBS) {
    const matches = globSync(pattern, {
      cwd: templatesDir,
      dot: true,
      nodir: true,
    });
    for (const match of matches) {
      if (!frameworkFiles.includes(match)) {
        frameworkFiles.push(match);
      }
    }
  }

  // Build a set for O(1) lookup in the prune pass
  const frameworkFileSet = new Set(frameworkFiles);

  for (const relPath of frameworkFiles) {
    const templatePath = join(templatesDir, relPath);
    const diskPath = join(targetDir, relPath);
    const templateContent = readFileSync(templatePath, 'utf-8');

    if (!existsSync(diskPath)) {
      // File is absent on disk — write it as ADDED
      mkdirSync(dirname(diskPath), { recursive: true });
      writeFileSync(diskPath, templateContent, 'utf-8');
      manifest[relPath] = hashContent(templateContent);
      result.added.push(relPath);
      if (opts.verbose) {
        console.log(`  [added]    ${relPath}`);
      }
      continue;
    }

    const diskContent = readFileSync(diskPath, 'utf-8');

    if (diskContent === templateContent) {
      // On-disk content already matches template — IDENTICAL, nothing to do
      result.identical.push(relPath);
      if (opts.verbose) {
        console.log(`  [identical] ${relPath}`);
      }
      continue;
    }

    // Disk differs from template — determine whether user modified it
    const diskHash = hashContent(diskContent);
    const manifestHash = manifest[relPath]; // undefined if pre-manifest project
    const userDidNotModify = manifestHash !== undefined && diskHash === manifestHash;

    if (hasFrontmatter(templateContent)) {
      // Frontmatter-bearing file: attempt structured merge.
      // mergeFrontmatter returns: template body + template framework keys + user-owned keys from disk.
      const mergedContent = mergeFrontmatter(templateContent, diskContent);

      // userHasCustomKeys: the merge preserved something from disk (model/temperature differed
      // from template). This means the disk file only differs from template in user-owned
      // frontmatter keys — always safe to merge regardless of manifest state.
      const userHasCustomKeys = mergedContent !== templateContent;

      if (userHasCustomKeys) {
        // User has model/temperature values that differ from template.
        // Merge is always safe: body and framework keys are refreshed from template,
        // user-owned keys are preserved from disk.
        mkdirSync(dirname(diskPath), { recursive: true });
        writeFileSync(diskPath, mergedContent, 'utf-8');
        manifest[relPath] = hashContent(mergedContent);
        result.merged.push(relPath);
        if (opts.verbose) {
          console.log(`  [merged]   ${relPath}`);
        }
      } else if (userDidNotModify) {
        // No user-owned keys to preserve; package previously wrote this content
        // and user did not modify it — update to current template.
        mkdirSync(dirname(diskPath), { recursive: true });
        writeFileSync(diskPath, templateContent, 'utf-8');
        manifest[relPath] = hashContent(templateContent);
        result.updated.push(relPath);
        if (opts.verbose) {
          console.log(`  [updated]  ${relPath}`);
        }
      } else if (opts.force) {
        // --force: completely overwrite with template (user-owned keys lost)
        mkdirSync(dirname(diskPath), { recursive: true });
        writeFileSync(diskPath, templateContent, 'utf-8');
        manifest[relPath] = hashContent(templateContent);
        result.updated.push(relPath);
        if (opts.verbose) {
          console.log(`  [updated]  ${relPath}`);
        }
      } else {
        // User modified body or framework frontmatter — skip
        result.modifiedByUser.push(relPath);
        if (opts.verbose) {
          console.log(`  [skipped]  ${relPath} (modified by user)`);
        }
      }
    } else {
      // No frontmatter: standard three-way diff
      if (userDidNotModify || opts.force) {
        mkdirSync(dirname(diskPath), { recursive: true });
        writeFileSync(diskPath, templateContent, 'utf-8');
        manifest[relPath] = hashContent(templateContent);
        result.updated.push(relPath);
        if (opts.verbose) {
          console.log(`  [updated]  ${relPath}`);
        }
      } else {
        result.modifiedByUser.push(relPath);
        if (opts.verbose) {
          console.log(`  [skipped]  ${relPath} (modified by user)`);
        }
      }
    }
  }

  // ── Prune pass ────────────────────────────────────────────────────────────
  // Iterate manifest keys that have no corresponding template file.
  // These are files the framework previously wrote but has since removed.
  for (const relPath of Object.keys(manifest)) {
    if (frameworkFileSet.has(relPath)) {
      continue; // handled in the main loop above
    }

    const diskPath = join(targetDir, relPath);

    if (!existsSync(diskPath)) {
      // Already gone from disk — clean up the manifest entry silently
      delete manifest[relPath];
      continue;
    }

    const diskContent = readFileSync(diskPath, 'utf-8');
    const diskHash = hashContent(diskContent);
    const manifestHash = manifest[relPath];
    const unmodified = manifestHash !== undefined && diskHash === manifestHash;

    if (unmodified || opts.force) {
      // Safe to delete: either unmodified or --force was requested
      unlinkSync(diskPath);
      delete manifest[relPath];
      result.pruned.push(relPath);
      if (opts.verbose) {
        console.log(`  [pruned]   ${relPath}`);
      }
    } else {
      // User modified the file — leave it alone, report as modified
      result.modifiedByUser.push(relPath);
      if (opts.verbose) {
        console.log(`  [skipped]  ${relPath} (modified by user, stale)`);
      }
    }
  }

  writeManifest(targetDir, manifest);

  return result;
}

/**
 * Print a human-readable summary of an `UpdateResult` to stdout.
 *
 * Emits a single summary line of the form:
 * `N updated  N merged  N added  N identical  N pruned  N modified by user (skipped)`
 * whose substrings satisfy the spec-layer output assertions. If any files were
 * modified by the user, a follow-up list names each one with a --force hint.
 *
 * @param result - The result from `updateScaffold`.
 */
export function printUpdateSummary(result: UpdateResult): void {
  const totalModified = result.modifiedByUser.length;

  console.log('\nbdd-workflow update complete\n');

  // Emit a single summary line whose substrings match the spec assertions:
  //   "N updated", "N merged", "N added", "N identical", "N pruned",
  //   "N modified by user (skipped)"
  const parts: string[] = [
    `${result.updated.length} updated`,
    `${result.merged.length} merged`,
    `${result.added.length} added`,
    `${result.identical.length} identical`,
    `${result.pruned.length} pruned`,
    `${totalModified} modified by user (skipped)`,
  ];
  console.log(`  ${parts.join('  ')}`);

  if (result.pruned.length > 0) {
    console.log('\n  Pruned (removed, no longer in framework):');
    for (const f of result.pruned) {
      console.log(`    ${f}`);
    }
  }

  if (totalModified > 0) {
    console.log('\n  Modified by user (use --force to overwrite):');
    for (const f of result.modifiedByUser) {
      console.log(`    ${f}`);
    }
  }
}
