/**
 * @module scaffold/frontmatter
 * @description Utilities for parsing, merging, and serializing YAML frontmatter
 * in OpenCode agent and command markdown files. Enables `update` to refresh
 * framework-owned content (body text, structural frontmatter keys like
 * `description`, `mode`, `agent`, `permission`) while preserving user-owned
 * keys (`model`, `temperature`) that users legitimately customize to match
 * their LLM provider.
 *
 * Uses the already-present `gray-matter` dependency for frontmatter parsing.
 * Does NOT perform any file I/O — callers are responsible for reading and
 * writing files.
 */

import matter from 'gray-matter';

/**
 * Frontmatter keys that belong to the user, not the framework.
 * During `update`, these keys are taken from the on-disk file (preserving
 * user customizations) rather than from the template.
 *
 * - `model`: LLM provider/model string (e.g. "openai/gpt-4o")
 * - `temperature`: Sampling temperature (0.0–2.0)
 *
 * All other frontmatter keys (`description`, `mode`, `agent`, `permission`,
 * etc.) are framework-owned and always updated from the template.
 */
export const USER_OWNED_FRONTMATTER_KEYS = ['model', 'temperature'] as const;

/**
 * Return true if the given file content begins with a YAML frontmatter block
 * (i.e. starts with `---\n` or `---\r\n`).
 *
 * @param content - Raw file content to inspect.
 */
export function hasFrontmatter(content: string): boolean {
  return content.startsWith('---\n') || content.startsWith('---\r\n');
}

/**
 * Merge a template file's content with an on-disk file's user-owned
 * frontmatter keys.
 *
 * Takes the template as the base (body + framework frontmatter), then
 * overlays any user-owned keys that are present in the on-disk version.
 * If the on-disk file has no frontmatter, or if the template has no
 * frontmatter, returns the template content unchanged.
 *
 * Key order in the output: template keys first (in template order), then any
 * user-owned keys not already present in the template. This produces stable
 * output across repeated updates, avoiding spurious git diffs.
 *
 * Example: if the template has `model: anthropic/claude-sonnet-4-5` and the
 * user's file has `model: openai/gpt-4o`, the merged result uses the
 * template body and framework keys but retains `model: openai/gpt-4o`.
 *
 * @param templateContent - Raw content of the template file.
 * @param diskContent - Raw content of the on-disk file.
 * @returns Merged content string.
 */
export function mergeFrontmatter(templateContent: string, diskContent: string): string {
  if (!hasFrontmatter(templateContent) || !hasFrontmatter(diskContent)) {
    return templateContent;
  }

  const templateParsed = matter(templateContent);
  const diskParsed = matter(diskContent);

  // Build merged data: start with template key order, overlay user-owned keys from disk
  const mergedData: Record<string, unknown> = {};

  // First pass: insert all template keys in their original order
  for (const key of Object.keys(templateParsed.data)) {
    mergedData[key] = templateParsed.data[key];
  }

  // Second pass: overlay user-owned keys from disk (if present on disk)
  for (const key of USER_OWNED_FRONTMATTER_KEYS) {
    if (key in diskParsed.data) {
      mergedData[key] = diskParsed.data[key];
    }
  }

  // Third pass: append any user-owned keys that were NOT in the template
  for (const key of USER_OWNED_FRONTMATTER_KEYS) {
    if (!(key in templateParsed.data) && key in diskParsed.data) {
      mergedData[key] = diskParsed.data[key];
    }
  }

  return matter.stringify(templateParsed.content, mergedData);
}
