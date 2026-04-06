/**
 * @module learn/promote
 * @description Promotes unpromoted learning entries to GitHub issues by invoking
 * the `gh` CLI. Filters to entries with `status: new` and `promoted: false`,
 * constructs a structured issue body from each entry's sections, and calls
 * `markAsPromoted` to update frontmatter after successful creation. Supports a
 * `--dry-run` mode that prints issue content without creating anything. Checks
 * for `gh` CLI availability before running and exits with a clear error if not
 * found. Does NOT parse learning files — that is handled by src/learn/index.ts.
 */

import { execSync } from 'node:child_process';
import { listLearnings, markAsPromoted, type LearningEntry } from './index.js';
import type { BddWorkflowConfig } from '../config.js';

/**
 * Promote all unpromoted learnings to GitHub issues.
 *
 * Requires the `gh` CLI to be installed and authenticated. Checks availability
 * before iterating. In dry-run mode, prints issue title and body only.
 *
 * @param config  - The loaded BddWorkflowConfig (used for learningsDir and
 *                  workflow.repository for the target repo).
 * @param opts    - `{ dryRun: boolean }` — when true, no issues are created.
 * @throws If `gh` is not available and dryRun is false.
 */
export async function promoteLearnings(
  config: BddWorkflowConfig,
  opts: { dryRun: boolean }
): Promise<void> {
  // Check gh availability before doing any work (skip in dry-run mode)
  if (!opts.dryRun) {
    try {
      execSync('gh --version', { stdio: 'pipe', encoding: 'utf-8' });
    } catch {
      console.error(
        '[bdd-workflow] Error: The "gh" CLI is required for "learn promote" but was not found in PATH.\n' +
          'Install gh from https://cli.github.com/ and authenticate with "gh auth login".'
      );
      process.exit(1);
    }
  }

  const learnings = await listLearnings(config);
  const unpromoted = learnings.filter((l) => !l.promoted && l.status === 'new');

  if (unpromoted.length === 0) {
    console.log('No new learnings to promote.');
    return;
  }

  console.log(`Found ${unpromoted.length} learning(s) to promote.`);

  for (const learning of unpromoted) {
    const issueTitle = `[Framework Improvement] ${learning.title}`;
    const issueBody = buildIssueBody(learning);
    const labels = 'framework-improvement,from-learning';

    if (opts.dryRun) {
      console.log(`\n--- DRY RUN: Would create issue ---`);
      console.log(`Title: ${issueTitle}`);
      console.log(`Body:\n${issueBody}`);
      continue;
    }

    const result = execSync(
      `gh issue create --repo ${config.workflow.repository} --title ${JSON.stringify(issueTitle)} --body ${JSON.stringify(issueBody)} --label ${JSON.stringify(labels)}`,
      { encoding: 'utf-8' }
    );

    // gh outputs the issue URL; extract the issue number from the last path segment
    const issueUrl = result.trim();
    const issueNumber = parseInt(issueUrl.split('/').pop() ?? '0', 10);

    await markAsPromoted(learning, issueNumber);
    console.log(`Promoted: ${learning.slug} -> ${issueUrl}`);
  }
}

/**
 * Build the GitHub issue body from a learning entry's parsed sections.
 *
 * @param learning - The LearningEntry to format.
 * @returns A markdown string suitable for use as a GitHub issue body.
 */
function buildIssueBody(learning: LearningEntry): string {
  return [
    `## Summary`,
    ``,
    `This issue was auto-generated from a learning entry captured during project development.`,
    ``,
    `**Source project proposal**: \`${learning.proposal}\``,
    `**Learning date**: ${learning.date}`,
    ``,
    `## What Happened`,
    ``,
    learning.whatHappened,
    ``,
    `## Root Cause`,
    ``,
    learning.rootCause,
    ``,
    `## Proposed Framework Change`,
    ``,
    learning.proposedChange,
  ].join('\n');
}
