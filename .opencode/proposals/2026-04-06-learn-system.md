---
date: 2026-04-06
phase: 5
status: proposed
---

# Proposal: Learn System

## Summary

Implement the Phase 5 meta-feedback loop for the `bdd-workflow` framework. This adds a
`bdd-workflow learn` CLI command with `list` and `promote` subcommands, a `src/learn/`
module for parsing and managing learning entries, and an upgraded `/learn` OpenCode
command that creates richer, validated learning entries. Learnings are markdown files
with YAML frontmatter stored in `.opencode/learnings/`; when promoted, each creates a
GitHub issue on the framework repository via the `gh` CLI.

**User-visible impact:**
- `npx bdd-workflow learn list` — tabular view of all captured learnings and their status
- `npx bdd-workflow learn promote [--dry-run]` — publishes unpromoted learnings as GitHub issues
- `/learn [feedback text]` — enriched OpenCode command that produces a fully-structured
  learning entry conforming to the defined format
- Learning entries are updated in-place (frontmatter) to track promotion state

---

## Doc Updates (the WHY layer)

### New file: `src/commands/learn.ts`

```typescript
/**
 * @module commands/learn
 * @description CLI command wiring for `bdd-workflow learn`. Provides two subcommands:
 * `list` (prints a formatted table of all learning entries) and `promote` (creates
 * GitHub issues from unpromoted learnings via the `gh` CLI). Does NOT contain
 * parsing or promotion logic — that lives in src/learn/index.ts and src/learn/promote.ts.
 */
```

`learnCommand()`:
```typescript
/**
 * Build the `bdd-workflow learn` Commander command tree.
 *
 * Registers the `list` and `promote` subcommands and wires them to their
 * respective action handlers in src/learn/index.ts and src/learn/promote.ts.
 *
 * @returns The configured Commander `Command` instance.
 */
export function learnCommand(): Command
```

### New file: `src/learn/index.ts`

```typescript
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
```

Exported interfaces and functions:
```typescript
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
export interface LearningEntry { ... }

/**
 * Glob all `.md` files under `config.workflow.learningsDir`, parse each one,
 * and return them sorted by filename (ascending date order).
 *
 * @param config - The loaded BddWorkflowConfig.
 * @returns Array of parsed LearningEntry objects.
 */
export async function listLearnings(config: BddWorkflowConfig): Promise<LearningEntry[]>

/**
 * Parse a single learning entry file.
 *
 * @param filePath - Absolute path to the learning entry `.md` file.
 * @returns A fully-populated LearningEntry.
 */
export async function parseLearningFile(filePath: string): Promise<LearningEntry>

/**
 * Update a learning entry's frontmatter to mark it as promoted.
 * Sets `promoted: true`, `status: 'promoted'`, and `github_issue: issueNumber`.
 *
 * @param entry        - The LearningEntry to update (must have a valid `filePath`).
 * @param issueNumber  - The GitHub issue number assigned after promotion.
 */
export async function markAsPromoted(entry: LearningEntry, issueNumber: number): Promise<void>
```

### New file: `src/learn/promote.ts`

```typescript
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
```

```typescript
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
): Promise<void>
```

### Modified file: `src/config.ts`

Add `repository` to `WorkflowConfig`:

```typescript
/**
 * @property repository - GitHub repository (owner/name) for `bdd-workflow learn promote`.
 *   Defaults to `'douglasdollars/bdd-workflow'`. Users can override in bdd-workflow.config.ts.
 */
export interface WorkflowConfig {
  // ... existing fields ...
  repository: string;
}
```

Default value: `'douglasdollars/bdd-workflow'`.

### Modified file: `src/cli.ts`

Add a JSDoc comment for the `learnCommand` registration (consistent with existing comments):

```typescript
// Register the learn subcommand (list and promote learning entries).
program.addCommand(learnCommand());
```

### Modified template: `src/scaffold/templates/.opencode/commands/learn.md`

The Phase 2 stub is replaced with the richer Phase 5 content (see Implementation Plan).
No JSDoc applies to template files.

---

## BDD Specs (the WHAT layer)

### New file: `features/learn.feature`

```gherkin
Feature: bdd-workflow learn command
  As a developer using the bdd-workflow framework
  I want to capture, list, and promote workflow learnings
  So that recurring friction points can be fed back as improvements to the framework

  Background:
    Given a clean temporary directory with bdd-workflow initialized
    And a learning entry "2026-04-01-missing-error-spec.md" with status "new"
    And a learning entry "2026-04-02-ambiguous-proposal.md" with status "new"
    And a learning entry "2026-04-03-already-done.md" with status "promoted" and github_issue 42

  Scenario: learn subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output contains "learn"

  Scenario: learn list prints all learning entries
    When I run "npx bdd-workflow learn list"
    Then the output contains "2026-04-01-missing-error-spec"
    And the output contains "2026-04-02-ambiguous-proposal"
    And the output contains "2026-04-03-already-done"

  Scenario: learn list shows status and issue reference
    When I run "npx bdd-workflow learn list"
    Then the output contains "new"
    And the output contains "promoted"
    And the output contains "#42"

  Scenario: learn promote --dry-run prints issue content without creating issues
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output contains "DRY RUN"
    And the output contains "missing-error-spec"
    And the output contains "ambiguous-proposal"
    And no GitHub issues are created

  Scenario: learn promote skips already-promoted learnings
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "already-done"

  Scenario: learn promote skips learnings with status closed
    Given a learning entry "2026-04-04-closed.md" with status "closed"
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "closed"

  Scenario: learn promote fails gracefully when gh is not available
    Given the "gh" CLI is not available in PATH
    When I run "npx bdd-workflow learn promote"
    Then the command exits with a non-zero status
    And the output contains "gh"

  Scenario: promoted learnings are not re-promoted on subsequent runs
    Given "2026-04-01-missing-error-spec.md" has been promoted to issue #99
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "missing-error-spec"

  Scenario: learn list shows no entries gracefully when learnings directory is empty
    Given the learnings directory exists but contains no files
    When I run "npx bdd-workflow learn list"
    Then the command exits with status 0
    And the output does not contain "Error"

  Scenario: parseLearningFile correctly parses all frontmatter fields
    Given a valid learning entry file with all required frontmatter and sections
    When I parse the file with parseLearningFile
    Then the returned entry has the correct date, slug, status, promoted, and github_issue
    And the entry title matches the "# Learning:" heading
    And whatHappened, rootCause, and proposedChange are correctly extracted
```

### Modified file: `features/scaffold-phase2.feature`

Add one scenario to verify the `/learn` command includes all required prompts:

```gherkin
  Scenario: learn command prompts for all required learning entry sections
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/learn.md" contains text "What Happened"
    And the file ".opencode/commands/learn.md" contains text "Root Cause"
    And the file ".opencode/commands/learn.md" contains text "Proposed Framework Change"
```

---

## Implementation Plan (the HOW layer)

### Files to create

1. **`src/commands/learn.ts`** — Commander command tree with `list` and `promote`
   subcommands. Delegates to `src/learn/index.ts` and `src/learn/promote.ts`.
   Follows the same pattern as `src/commands/specs.ts` (load config, delegate, done).

2. **`src/learn/index.ts`** — Core parsing and management module:
   - `listLearnings(config)` — globs `*.md` in `config.workflow.learningsDir`, sorts,
     and calls `parseLearningFile` on each.
   - `parseLearningFile(filePath)` — uses `gray-matter` to split frontmatter/body,
     extracts the title from `# Learning: ...`, and uses `extractSection` for the
     three body sections.
   - `markAsPromoted(entry, issueNumber)` — reads file, mutates frontmatter via
     `gray-matter`, writes back.
   - Uses `gray-matter` (already a dependency) and `glob` (already a dependency).

3. **`src/learn/promote.ts`** — GitHub promotion module:
   - Before iterating, checks that `gh` is available via `execSync('gh --version', ...)`
     in a try/catch; throws a user-friendly error if absent.
   - Filters `listLearnings` result to entries where `!l.promoted && l.status === 'new'`.
   - Builds `issueTitle` and `issueBody` from entry sections.
   - In dry-run mode: prints to stdout only.
   - In live mode: calls `gh issue create --repo <config.workflow.repository> ...` via
     `execSync`, parses the returned issue URL to extract the issue number, calls
     `markAsPromoted`.
   - Target repo comes from `config.workflow.repository` (new config field, see below).

### Files to modify

4. **`src/config.ts`** — Add `repository: string` to `WorkflowConfig` interface and
   default to `'douglasdollars/bdd-workflow'`. No breaking change (new optional-with-default
   field).

5. **`src/cli.ts`** — Import `learnCommand` from `./commands/learn.js` and register it
   with `program.addCommand(learnCommand())`.

6. **`src/scaffold/templates/.opencode/commands/learn.md`** — Replace the Phase 2 stub
   with the Phase 5 richer prompt (see below). Following AGENTS.md, this is the template
   file; after editing, run `npm run build && npx bdd-workflow update` to propagate to
   `.opencode/commands/learn.md`.

7. **`features/scaffold-phase2.feature`** — Add the new scenario described in BDD Specs.

8. **`features/learn.feature`** — New feature file.

### Updated `/learn` command content

Replace `src/scaffold/templates/.opencode/commands/learn.md` body with:

```markdown
---
description: "Capture a workflow learning or feedback. Usage: /learn [feedback text]"
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

### Step definitions

Add new step definitions to `features/support/steps/` (or a new `learn.steps.ts` file)
to support the new scenarios in `features/learn.feature`. These steps:
- Create a temporary directory with `bdd-workflow init`
- Write learning entry fixture files with controlled frontmatter
- Run `npx bdd-workflow learn list` / `learn promote --dry-run`
- Assert on stdout content and exit codes
- For the `gh not available` scenario: stub PATH to exclude `gh`

### Design decisions

- **`repository` in config vs. hard-coded constant**: The roadmap explicitly requests
  this become configurable. Adding it to `WorkflowConfig` now avoids a later breaking
  change. The default is set to the actual framework repo.

- **`execSync` for `gh` CLI calls**: Consistent with other places in the codebase that
  shell out (`loadConfigViaTsx` uses `spawnSync`). Using `execSync` here keeps the
  promote logic simple and is acceptable because the CLI is run interactively.

- **Gray-matter for frontmatter manipulation**: Already a dependency (used in
  `src/scaffold/frontmatter.ts`). Reusing it keeps the dependency count flat.

- **No automatic triggering of `/learn`**: As specified in the roadmap notes, automatic
  triggering after multiple amendments is explicitly deferred to a future phase.

---

## Risks and Considerations

### Breaking changes
- `WorkflowConfig` gains a new `repository` field. Because the type is populated via
  `defineConfig` with defaults, existing `bdd-workflow.config.ts` files that do not
  set `repository` will continue to work unchanged. Not a breaking change.
- `src/cli.ts` gains a new subcommand. Additive only.

### Dependencies on external systems
- `npx bdd-workflow learn promote` requires `gh` CLI installed and authenticated.
  This is documented in the roadmap notes. The implementation guards with a pre-flight
  check and prints a clear error message if `gh` is absent.

### Edge cases
- **Empty learnings directory**: `listLearnings` returns an empty array; `learn list`
  prints nothing (no error). Covered by the "graceful empty state" scenario.
- **`status: closed` entries**: `promoteLearnings` filters to `status === 'new'` only,
  so closed entries are silently skipped.
- **Already-promoted entries**: `promoted: true` flag prevents re-promotion even if
  `status` is accidentally not updated.
- **Malformed frontmatter**: `parseLearningFile` uses `gray-matter` which tolerates
  missing keys by returning `undefined`; defaults are applied in the mapping step.
- **gh output format**: The promote logic parses the issue URL to extract the number.
  If `gh` changes its output format, this could silently set `github_issue: 0`.
  A future improvement could use `gh api` with JSON output.

### Performance
- `listLearnings` reads every `.md` file in `.opencode/learnings/` synchronously via
  `readFile`. For typical usage (tens of entries, not thousands) this is fine.

### Scaffold update requirement
After editing `src/scaffold/templates/.opencode/commands/learn.md`, the implementer
must run `npm run build && npx bdd-workflow update` per AGENTS.md to propagate the
template change to the live `.opencode/commands/learn.md`. This will be a user-visible
diff in git.
