/**
 * @module generators/structure
 * @description Generates an indented directory tree string from the file
 * paths matched by the configured include/exclude patterns. Uses `glob` for
 * file collection. Does NOT depend on the system `tree` binary — the tree is
 * rendered in-process.
 */

import { glob } from 'glob';
import { BddWorkflowConfig } from '../config.js';

/** Internal tree node type for building the directory tree. */
type TreeNode = { [segment: string]: TreeNode };

/**
 * Generate a human-readable indented directory tree string.
 *
 * Collects all files matching config.context.include patterns (excluding
 * config.context.exclude), builds a nested tree object, and renders it as
 * 2-space-indented text.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Indented tree string (no trailing newline)
 */
export async function generateDirectoryTree(config: BddWorkflowConfig): Promise<string> {
  const allFiles: string[] = [];

  for (const pattern of config.context.include) {
    const matches = await glob(pattern, {
      ignore: config.context.exclude,
    });
    allFiles.push(...matches);
  }

  // Deduplicate and sort for deterministic output (POSIX paths — glob always returns /)
  const uniqueFiles = [...new Set(allFiles)].sort();

  if (uniqueFiles.length === 0) return '(no files)';

  // Build a nested tree object from paths
  const tree: TreeNode = {};
  for (const filePath of uniqueFiles) {
    const parts = filePath.split('/');
    let node = tree;
    for (const part of parts) {
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part];
    }
  }

  // Render tree to string
  return renderTree(tree, 0).trimEnd();
}

/**
 * Recursively render a tree node to an indented string.
 *
 * Directories (nodes with children) are listed before files at each level.
 * Within each group, entries are sorted alphabetically.
 *
 * @param node - Current tree node
 * @param depth - Current indentation depth
 * @returns Rendered string with newlines
 */
function renderTree(node: TreeNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const keys = Object.keys(node).sort();

  // Separate directories (non-empty node children) from files (empty children)
  const dirs = keys.filter(k => Object.keys(node[k]).length > 0);
  const files = keys.filter(k => Object.keys(node[k]).length === 0);

  let result = '';

  for (const dir of dirs) {
    result += `${indent}${dir}/\n`;
    result += renderTree(node[dir], depth + 1);
  }

  for (const file of files) {
    result += `${indent}${file}\n`;
  }

  return result;
}
