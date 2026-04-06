/**
 * @module learn/index
 * @description Parses, lists, and updates learning entry files stored in
 * `.opencode/learnings/`. Learning entries are markdown files with YAML frontmatter
 * conforming to the LearningEntry schema. Provides `listLearnings` to enumerate
 * all entries and `markAsPromoted` to update frontmatter after a GitHub issue is
 * created. Does NOT perform GitHub API calls — that is handled by src/learn/promote.ts.
 * Does NOT write new learning entries — that is the responsibility of the /learn
 * OpenCode command.
 */

import matter from 'gray-matter';
import { glob } from 'glob';
import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { BddWorkflowConfig } from '../config.js';

/**
 * Represents a fully-parsed learning entry.
 *
 * @property filePath    - Absolute path to the `.md` file on disk.
 * @property slug        - Filename without extension (e.g. `2026-04-06-my-learning`).
 * @property date        - ISO date string from frontmatter.
 * @property proposal    - Relative path to the associated proposal, or empty string.
 * @property status      - Lifecycle state: `new | reviewed | promoted | closed`.
 * @property promoted    - Whether promotion has occurred.
 * @property github_issue - GitHub issue number set after promotion, or null.
 * @property title       - Extracted from the `# Learning: ...` heading in the body.
 * @property body        - Full markdown body (without frontmatter).
 * @property whatHappened  - Extracted from the `## What Happened` section.
 * @property rootCause     - Extracted from the `## Root Cause` section.
 * @property proposedChange - Extracted from the `## Proposed Framework Change` section.
 */
export interface LearningEntry {
  filePath: string;
  slug: string;
  date: string;
  proposal: string;
  status: 'new' | 'reviewed' | 'promoted' | 'closed';
  promoted: boolean;
  github_issue: number | null;
  title: string;
  body: string;
  whatHappened: string;
  rootCause: string;
  proposedChange: string;
}

/**
 * Glob all `.md` files under `config.workflow.learningsDir`, parse each one,
 * and return them sorted by filename (ascending date order).
 *
 * @param config - The loaded BddWorkflowConfig.
 * @returns Array of parsed LearningEntry objects.
 */
export async function listLearnings(config: BddWorkflowConfig): Promise<LearningEntry[]> {
  const pattern = join(config.workflow.learningsDir, '*.md');
  const files = await glob(pattern);
  return Promise.all(files.sort().map(parseLearningFile));
}

/**
 * Parse a single learning entry file.
 *
 * @param filePath - Absolute path to the learning entry `.md` file.
 * @returns A fully-populated LearningEntry.
 */
export async function parseLearningFile(filePath: string): Promise<LearningEntry> {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  const slug = basename(filePath, '.md');
  const title = body.match(/^#\s+Learning:\s+(.+)$/m)?.[1] ?? slug;

  return {
    filePath,
    slug,
    date: String(data['date'] ?? ''),
    proposal: String(data['proposal'] ?? ''),
    status: (data['status'] as LearningEntry['status']) ?? 'new',
    promoted: Boolean(data['promoted'] ?? false),
    github_issue: (data['github_issue'] as number | null) ?? null,
    title,
    body,
    whatHappened: extractSection(body, 'What Happened'),
    rootCause: extractSection(body, 'Root Cause'),
    proposedChange: extractSection(body, 'Proposed Framework Change'),
  };
}

/**
 * Extract a named section from a markdown body.
 * Returns the trimmed content between the heading and the next `##` heading (or end of file).
 *
 * @param body    - Markdown body text (without frontmatter).
 * @param heading - The heading text to search for (without `## ` prefix).
 * @returns The section content, or an empty string if not found.
 */
function extractSection(body: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  return body.match(regex)?.[1]?.trim() ?? '';
}

/**
 * Update a learning entry's frontmatter to mark it as promoted.
 * Sets `promoted: true`, `status: 'promoted'`, and `github_issue: issueNumber`.
 *
 * @param entry        - The LearningEntry to update (must have a valid `filePath`).
 * @param issueNumber  - The GitHub issue number assigned after promotion.
 */
export async function markAsPromoted(entry: LearningEntry, issueNumber: number): Promise<void> {
  const content = await readFile(entry.filePath, 'utf-8');
  const { data, content: body } = matter(content);
  data['promoted'] = true;
  data['status'] = 'promoted';
  data['github_issue'] = issueNumber;
  await writeFile(entry.filePath, matter.stringify(body, data));
}
