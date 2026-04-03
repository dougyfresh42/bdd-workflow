# Phase 5 — Learn System

**Prerequisite reading**: [docs/design.md](design.md)
**Depends on**: Phase 2 (workflow active, `/learn` command stub exists)

**Goal**: Implement the meta-feedback loop. The learn system captures friction points and implementation divergences, stores them as structured learning entries, and provides a mechanism to promote them as improvement proposals to the `bdd-workflow` framework itself.

**This phase should be implemented using the bdd-workflow itself** (bootstrap from Phase 2).

---

## What the Learn System Is

The learn system is a **self-improvement mechanism** for the framework. It answers: "Based on real usage, how should the workflow be better?"

Three triggers:
1. **Explicit**: User runs `/learn [feedback text]` at any point
2. **Automatic (proposed)**: After review that required 2+ amendment rounds
3. **Automatic (proposed)**: When the implementer notes a significant divergence from the proposal

Learnings accumulate locally in `.opencode/learnings/`. When the user is ready to contribute improvements back, `/learn promote` creates GitHub issues on the `bdd-workflow` repository.

---

## Deliverables

1. `src/commands/learn.ts` — CLI command for the `promote` subcommand
2. `src/learn/index.ts` — Learning entry parsing and management logic
3. `src/learn/promote.ts` — GitHub issue creation via `gh` CLI
4. Updated `/learn` OpenCode command (filling in the Phase 2 stub with richer behavior)
5. Updated `/learn promote` command
6. Learning entry format validated and parseable
7. Integration test: promote flow creates expected GitHub issue content

---

## Learning Entry Format

Learning entries are markdown files with YAML frontmatter. They live in `.opencode/learnings/`.

Filename: `YYYY-MM-DD-short-slug.md`

```markdown
---
date: 2026-04-02
proposal: .opencode/proposals/2026-04-02-add-auth.md
status: new          # new | reviewed | promoted | closed
promoted: false
github_issue: null   # Set to issue number after promotion
---

# Learning: Missing error handling spec caused test failures

## What Happened

The proposal specified a scenario for successful login but did not specify what happens
when the database is unavailable. The apply step implemented optimistic behavior (no error
handling). The review step caught this as a test gap, requiring two amendment rounds.

## Root Cause

The proposal template's "Risks and Considerations" section is easy to fill in vaguely.
There's no prompt to think specifically about error conditions for each scenario.

## Proposed Framework Change

Add an explicit "Error Scenarios" subsection to the BDD Specs section of the proposal template.
Require at least one sad-path scenario for any feature that interacts with external systems.

### Target File
`.opencode/templates/proposal.md` and `.opencode/skills/bdd-propose/SKILL.md`

### Proposed Change to `bdd-propose` SKILL.md
In the "Rules for good Gherkin" section, add:

> For any scenario that involves I/O (database, network, file system), include at least
> one corresponding sad-path scenario covering the failure case.

### Proposed Change to `proposal.md` template
Under BDD Specs section, add a subsection prompt:

> ### Error Scenarios
> [For each external interaction, describe the failure case scenario]

## Impact

Reduces the frequency of amendment rounds caused by missing error coverage.
Affects any developer using the proposal workflow with external system interactions.
```

---

## CLI: `npx bdd-workflow learn`

The `learn` CLI command handles the promote subcommand (the `/learn` OpenCode command handles entry creation — see Phase 2).

### `src/commands/learn.ts`

```typescript
import { Command } from 'commander';
import { promoteLearnings } from '../learn/promote.js';
import { listLearnings } from '../learn/index.js';
import { loadConfig } from '../config.js';

export function learnCommand(): Command {
  const cmd = new Command('learn')
    .description('Manage workflow learnings');

  cmd
    .command('promote')
    .description('Create GitHub issues from accumulated learnings')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .option('--dry-run', 'Show what would be promoted without creating issues')
    .action(async (opts) => {
      const config = await loadConfig(opts.config);
      await promoteLearnings(config, { dryRun: opts.dryRun ?? false });
    });

  cmd
    .command('list')
    .description('List all learning entries and their status')
    .option('--config <path>', 'Path to bdd-workflow.config.ts')
    .action(async (opts) => {
      const config = await loadConfig(opts.config);
      const learnings = await listLearnings(config);
      // Print a table: date, slug, status, github_issue
      for (const l of learnings) {
        const issueRef = l.github_issue ? `#${l.github_issue}` : '-';
        console.log(`${l.date}  ${l.slug.padEnd(40)}  ${l.status.padEnd(10)}  ${issueRef}`);
      }
    });

  return cmd;
}
```

### `src/learn/index.ts`

Parses and manages learning entry files.

```typescript
import matter from 'gray-matter';
import { glob } from 'glob';
import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { BddWorkflowConfig } from '../config.js';

export interface LearningEntry {
  filePath: string;
  slug: string;
  date: string;
  proposal: string;
  status: 'new' | 'reviewed' | 'promoted' | 'closed';
  promoted: boolean;
  github_issue: number | null;
  title: string;
  body: string;          // Full markdown body (without frontmatter)
  whatHappened: string;  // Extracted from "## What Happened" section
  rootCause: string;     // Extracted from "## Root Cause" section
  proposedChange: string;// Extracted from "## Proposed Framework Change" section
}

export async function listLearnings(config: BddWorkflowConfig): Promise<LearningEntry[]> {
  const pattern = join(config.workflow.learningsDir, '*.md');
  const files = await glob(pattern);
  return Promise.all(files.sort().map(parseLearningFile));
}

export async function parseLearningFile(filePath: string): Promise<LearningEntry> {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  const slug = basename(filePath, '.md');
  const title = body.match(/^#\s+Learning:\s+(.+)$/m)?.[1] ?? slug;

  return {
    filePath,
    slug,
    date: data.date,
    proposal: data.proposal ?? '',
    status: data.status ?? 'new',
    promoted: data.promoted ?? false,
    github_issue: data.github_issue ?? null,
    title,
    body,
    whatHappened: extractSection(body, 'What Happened'),
    rootCause: extractSection(body, 'Root Cause'),
    proposedChange: extractSection(body, 'Proposed Framework Change'),
  };
}

function extractSection(body: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  return body.match(regex)?.[1]?.trim() ?? '';
}

export async function markAsPromoted(entry: LearningEntry, issueNumber: number): Promise<void> {
  const content = await readFile(entry.filePath, 'utf-8');
  const { data, content: body } = matter(content);
  data.promoted = true;
  data.status = 'promoted';
  data.github_issue = issueNumber;
  await writeFile(entry.filePath, matter.stringify(body, data));
}
```

### `src/learn/promote.ts`

Creates GitHub issues from unpromoted learnings using the `gh` CLI.

```typescript
import { execSync } from 'node:child_process';
import { listLearnings, markAsPromoted } from './index.js';
import { BddWorkflowConfig } from '../config.js';

const BDD_WORKFLOW_REPO = 'your-org/bdd-workflow'; // TODO: set in config

export async function promoteLearnings(
  config: BddWorkflowConfig,
  opts: { dryRun: boolean }
): Promise<void> {
  const learnings = await listLearnings(config);
  const unpromoted = learnings.filter(l => !l.promoted && l.status === 'new');

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
      `gh issue create --repo ${BDD_WORKFLOW_REPO} --title "${issueTitle}" --body "${issueBody.replace(/"/g, '\\"')}" --label "${labels}"`,
      { encoding: 'utf-8' }
    );

    // gh outputs the issue URL, extract the number
    const issueUrl = result.trim();
    const issueNumber = parseInt(issueUrl.split('/').pop() ?? '0');

    await markAsPromoted(learning, issueNumber);
    console.log(`Promoted: ${learning.slug} -> ${issueUrl}`);
  }
}

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
```

---

## Updated OpenCode Commands (Phase 2 stubs → full implementation)

The `/learn` command in Phase 2 already contains the prompt for creating learning entries. Phase 5 refines it based on the defined learning entry format.

### Updated `.opencode/commands/learn.md`

```markdown
---
description: Capture a workflow learning. Usage: /learn [feedback text]
model: anthropic/claude-sonnet-4-5
---

Load the `bdd-workflow` skill.

Capture a learning from the current or most recent workflow cycle.

Context:
- Proposals directory: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -3`
- Existing learnings: !`ls .opencode/learnings/*.md 2>/dev/null | wc -l` existing entries

User feedback (if provided): $ARGUMENTS

Analyze the workflow cycle:
1. How did the final implementation differ from the proposal?
2. Did the review require multiple amendment rounds? If so, why?
3. What was unclear, missing, or wrong in the framework that caused friction?
4. What specific change to which skill, command, or template would prevent this?

Create a learning entry at `.opencode/learnings/YYYY-MM-DD-slug.md` where today's date is: !`date +%Y-%m-%d`

Use the template at `.opencode/templates/learning.md`. The entry must include all required sections:
- What Happened
- Root Cause
- Proposed Framework Change (with Target File and Proposed Change subsections)
- Impact

After saving, print the file path and the one-sentence summary of the proposed change.
```

---

## Acceptance Criteria

- [ ] `npx bdd-workflow learn list` prints a formatted table of all learning entries with their status
- [ ] `npx bdd-workflow learn promote --dry-run` prints issue content without creating anything
- [ ] `npx bdd-workflow learn promote` creates GitHub issues and updates the learning entry frontmatter
- [ ] After promotion, `npx bdd-workflow learn list` shows the learning as `promoted` with issue number
- [ ] Promoted learnings are not re-promoted on subsequent runs
- [ ] `/learn` OpenCode command creates a valid learning entry that can be parsed by `parseLearningFile`
- [ ] Learning entries with `status: closed` are not promoted
- [ ] BDD scenarios cover: listing learnings, promoting a learning, idempotent promotion

---

## Notes

- The `gh` CLI must be installed and authenticated in the user's environment for `promote` to work. The command should check for `gh` availability and print a clear error if not found.
- The `BDD_WORKFLOW_REPO` constant should become configurable — add a `learn.repository` field to `BddWorkflowConfig` in a future revision.
- Phase 5 intentionally does NOT implement automatic triggering of `/learn` after multiple amendments — that's a future enhancement. The current design requires explicit user invocation.
- The `/learn promote` OpenCode command (as opposed to the CLI command) should just delegate to the CLI: `!npx bdd-workflow learn promote`.
