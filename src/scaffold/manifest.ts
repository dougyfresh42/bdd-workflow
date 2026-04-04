/**
 * @module scaffold/manifest
 * @description Manages the bdd-workflow write manifest at
 * `.opencode/.bdd-workflow-manifest.json`. The manifest records the SHA-256
 * hash of each framework-layer file at the time it was last written by
 * `bdd-workflow init` or `bdd-workflow update`. This enables `update` to
 * perform a true three-way diff: if the on-disk content's hash matches the
 * recorded hash, the file was not modified by the user and can be safely
 * overwritten with the new template version. If the hashes differ, the user
 * has customized the file and the update is skipped (or merged, for
 * frontmatter-bearing files).
 *
 * Does NOT track user-owned files. Does NOT perform file I/O beyond reading
 * and writing the single manifest JSON file.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MANIFEST_PATH = '.opencode/.bdd-workflow-manifest.json';

/**
 * The shape of `.opencode/.bdd-workflow-manifest.json`.
 * Maps relative file paths (from project root) to the SHA-256 hex digest of
 * the content that `bdd-workflow` last wrote to that path.
 */
export type Manifest = Record<string, string>;

/**
 * Read the bdd-workflow manifest from a project directory.
 * Returns an empty object if the manifest file does not exist (e.g. project
 * was initialized before manifests were introduced).
 *
 * @param targetDir - Absolute path to the project root.
 * @returns The manifest, or `{}` if absent.
 */
export function readManifest(targetDir: string): Manifest {
  const manifestPath = join(targetDir, MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as Manifest;
  } catch {
    return {};
  }
}

/**
 * Write the bdd-workflow manifest to a project directory, creating the
 * `.opencode/` directory if necessary.
 *
 * @param targetDir - Absolute path to the project root.
 * @param manifest - The manifest to persist.
 */
export function writeManifest(targetDir: string, manifest: Manifest): void {
  const manifestPath = join(targetDir, MANIFEST_PATH);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Compute the SHA-256 hex digest of a UTF-8 string.
 * Used to record file content at write time and compare at update time.
 *
 * @param content - UTF-8 string to hash.
 * @returns Lowercase hex SHA-256 digest.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
