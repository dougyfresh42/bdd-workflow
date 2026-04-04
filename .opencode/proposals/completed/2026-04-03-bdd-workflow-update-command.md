---
date: 2026-04-03
slug: bdd-workflow-update-command
status: superseded
---

# Proposal: `npx bdd-workflow update` — In-Place Repository Update Command

> **Superseded:** This proposal was implemented and then extended during development. The manifest-based three-way diff and frontmatter merge capabilities described in `completed/2026-04-03-update-manifest-three-way-diff.md` were applied concurrently. See that proposal for the final algorithm.

## 1. Summary

Add a new `update` subcommand (`npx bdd-workflow update`) that refreshes the bdd-workflow scaffold files in an already-initialized repository to match the latest version of the package. This is the counterpart to `init`: where `init` creates the scaffold from scratch, `update` surgically refreshes only the framework-owned files (agents, commands, skills, templates) while leaving user-owned files untouched.

This command is necessary for the framework to stay self-hosting: as skills, commands, agents, and templates evolve (Phases 3–6 and beyond), existing repos — including the bdd-workflow repo itself — need a way to pull in improvements without re-running `init --force` (which would clobber user work) or manually diffing files.

**User-visible impact**: Running `npx bdd-workflow update` in any bdd-workflow-initialized project will print a summary of updated, skipped (identical), and user-modified files, giving the user full visibility into what changed.

---

## 2. Doc Updates (the WHY layer)

### `src/commands/update.ts` — new file-level `@module` comment

```typescript
/**
 * @module commands/update
 * @description Implements the `bdd-workflow update` CLI subcommand. Responsible
 * for refreshing framework-owned scaffold files (agents, commands, skills,
 * templates, and opencode.json) in an existing initialized project to match the
 * current version of the bdd-workflow package. Does NOT touch user-owned files
 * (source code, feature files, CONTEXT.md, SPECS.md, package.json,
 * tsconfig.json, or any file not tracked in the scaffold templates' framework
 * layer). Produces a human-readable diff summary showing updated, identical, and
 * user-modified files.
 */
```

### `updateCommand()` function JSDoc

```typescript
/**
 * Create the `update` subcommand for Commander.
 *
 * Resolves the target directory, verifies it is an initialized bdd-workflow
 * project (presence of `.opencode/skills/bdd-workflow/SKILL.md` is the
 * canonical marker), then delegates to `updateScaffold`.
 *
 * @returns Commander `Command` instance for the `update` subcommand.
 */
```

### `src/scaffold/update.ts` — new file-level `@module` comment

```typescript
/**
 * @module scaffold/update
 * @description Performs the in-place update of framework-owned files in an
 * existing project. Compares each framework-layer template file against its
 * counterpart on disk, classifies the result as UPDATED, IDENTICAL, NEW, or
 * MODIFIED_BY_USER, writes updates, and returns a structured summary. Does NOT
 * perform git operations — those remain the user's responsibility. Does NOT
 * modify files outside the framework layer.
 */
```

### `updateScaffold()` function JSDoc

```typescript
/**
 * Update framework-owned scaffold files in an existing project.
 *
 * Iterates over every file in the framework layer of the templates directory,
 * compares its content to the on-disk version (if present), and:
 * - Writes the template version if the file is absent (NEW) or if it matches
 *   the previous package version's content and has since changed upstream (UPDATED).
 * - Reports the file as IDENTICAL if the template and disk content already match.
 * - Reports the file as MODIFIED_BY_USER if the disk content differs from both
 *   the current template and the previous template (user has customized it);
 *   in this case the file is NOT overwritten unless `--force` is passed.
 *
 * @param targetDir - Absolute path to the project root to update.
 * @param opts - Update options.
 * @returns A structured `UpdateResult` describing what changed.
 */
```

### `UpdateOptions` and `UpdateResult` interfaces

```typescript
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
  /** Files written because they were absent or upstream-changed. */
  updated: string[];
  /** Files whose on-disk content already matches the template. */
  identical: string[];
  /** Files that appear to have been customized by the user and were skipped. */
  modifiedByUser: string[];
  /** Files written for the first time (did not exist before). */
  added: string[];
}
```

### `src/scaffold/index.ts` — add `FRAMEWORK_LAYER_GLOBS` export

```typescript
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
```

### `src/cli.ts` — add import and registration JSDoc

```typescript
// Register the update subcommand (refreshes framework-owned scaffold files).
program.addCommand(updateCommand());
```

---

## 3. BDD Specs (the WHAT layer)

### New file: `features/update.feature`

```gherkin
Feature: bdd-workflow update command

  As a developer using bdd-workflow in an existing project,
  I want to run `npx bdd-workflow update` to get the latest framework files,
  So that my agents, commands, skills, and templates stay current without losing my customizations.

  Background:
    Given a project directory initialized with bdd-workflow

  Scenario: Update refreshes an outdated framework file
    Given the file ".opencode/skills/bdd-workflow/SKILL.md" on disk differs from the current template
    When I run "bdd-workflow update"
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update skips a file that already matches the template
    Given the file ".opencode/commands/propose.md" on disk matches the current template
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/propose.md" is unchanged
    And the output reports "1 identical"

  Scenario: Update adds a new framework file that did not exist
    Given the file ".opencode/agents/reviewer.md" does not exist on disk
    When I run "bdd-workflow update"
    Then the file ".opencode/agents/reviewer.md" exists on disk
    And the output reports "1 added"

  Scenario: Update skips a user-modified framework file without --force
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" is unchanged
    And the output reports "1 modified by user (skipped)"
    And the output includes a hint to use "--force" to overwrite

  Scenario: Update overwrites a user-modified file when --force is given
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update --force"
    Then the file ".opencode/commands/apply.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update fails when run outside an initialized project
    Given a directory that has not been initialized with bdd-workflow
    When I run "bdd-workflow update"
    Then the command exits with a non-zero status
    And the output includes "not an initialized bdd-workflow project"
```

### New file: `features/support/steps/update.steps.ts`

Step definitions for `update.feature` — follows the same pattern as `init.steps.ts`: creates a temp directory, runs the CLI via `execSync`, asserts file existence and content, checks stdout.

---

## 4. Implementation Plan (the HOW layer)

### Files to create

| File | Purpose |
|------|---------|
| `src/commands/update.ts` | Commander subcommand; detects initialized project, calls `updateScaffold` |
| `src/scaffold/update.ts` | Core update logic: diff framework files, write updates, return `UpdateResult` |
| `features/update.feature` | BDD spec (above) |
| `features/support/steps/update.steps.ts` | Cucumber step definitions for update scenarios |

### Files to modify

| File | Change |
|------|--------|
| `src/cli.ts` | Import and register `updateCommand()` |
| `src/scaffold/index.ts` | Export `FRAMEWORK_LAYER_GLOBS` constant |

### Approach

**1. Defining the framework layer**

Export `FRAMEWORK_LAYER_GLOBS` from `src/scaffold/index.ts`. The update command only touches files matched by these globs within the templates directory. User-owned files (source, features, root config files) are completely out of scope — no glob will match them.

**2. Detecting an initialized project**

The canonical marker is the presence of `.opencode/skills/bdd-workflow/SKILL.md`. If this file does not exist, `updateCommand` prints an error and exits non-zero. This is the same marker a human would check — it's unambiguous and file-creation would have put it there.

**3. Diffing: IDENTICAL vs UPDATED vs MODIFIED_BY_USER**

For each framework-layer template file:

1. Read template content from the package's `dist/scaffold/templates/` directory (same path resolution as `init`).
2. Read the on-disk file (if it exists).
3. Compare:
   - **Absent on disk** → classify as `added`, write template.
   - **On disk matches template** → classify as `identical`, skip.
   - **On disk differs from template** → classify as `modifiedByUser` (skip unless `--force`).

Note: A "previous version hash" approach (storing checksums of what the package wrote) would enable a true three-way merge (upstream changed + user changed = conflict). That is desirable but is **deferred** to a follow-up proposal to keep scope manageable. For this phase, any disk content differing from the current template is conservatively treated as user-modified. Since framework files are not typically hand-edited by users, this is acceptable in practice.

**4. Writing updates**

Use `writeFileSync` (same as `scaffoldProject`). Parent directories are guaranteed to exist after `init`, but `mkdirSync({ recursive: true })` is used defensively.

**5. Output format**

```
✓ bdd-workflow update complete

  Updated:          3 files
  Added:            1 file
  Identical:        4 files
  Modified by user: 1 file (skipped — use --force to overwrite)

Modified by user (skipped):
  .opencode/commands/apply.md
```

**6. Registering the command in `src/cli.ts`**

Import `updateCommand` from `./commands/update.js` and call `program.addCommand(updateCommand())` alongside the existing `initCommand` registration.

**7. Build**

No changes to `scripts/copy-templates.js` or `tsconfig.json` are needed — the new files follow existing conventions and will be compiled and template-copied automatically.

---

## 5. Risks and Considerations

### No three-way merge (intentional deferral)
The most robust update strategy would store a manifest of what each package version wrote (e.g., hashes in `.opencode/.bdd-workflow-manifest.json`) so the tool can distinguish "user edited" from "package updated since install." Without this, any on-disk content that differs from the current template is called user-modified and skipped.

This is **conservative but safe**: it never silently overwrites user work. The `--force` escape hatch exists for when the user knows they want to overwrite.

A manifest-based approach is the natural Phase 6 / Polish addition and should be proposed separately.

### `opencode.json` is intentionally excluded from the framework layer
`opencode.json` at the project root sets the default model and lists `CONTEXT.md` as an instruction. Users routinely customize this (changing models, adding MCP servers). Updating it would be disruptive. It is excluded from `FRAMEWORK_LAYER_GLOBS`.

If a breaking change to `opencode.json` structure is ever needed, a separate migration command or a manual note in the changelog is the right approach.

### `src/scaffold/templates/.opencode/` vs user's `.opencode/`
The templates directory already contains the `.opencode/` subtree. The `FRAMEWORK_LAYER_GLOBS` patterns are applied to the templates directory to enumerate what to update; they are then mapped to corresponding on-disk paths in `targetDir`. This is the same mental model as `init` — the templates dir is the source of truth.

### Self-hosting this repo
After implementation, running `npx bdd-workflow update` in this repo will update `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/`, and `.opencode/templates/` from the package's own templates. This is the intended bootstrap loop.

### Breaking changes in commands/skills
If a command or skill file changes in a breaking way between package versions, users who have not customized those files will get the update automatically. Users who have customized them will be protected by the skip-on-diff behavior and will see a "modified by user" notice. Both outcomes are correct.

### Roadmap placement
This feature is not in any existing phase (1–6). It should be treated as a new **Phase 1.5** or as a patch to Phase 1 (`NPM Package Scaffold`), since it is a core CLI command that belongs alongside `init`. Alternatively it can be labeled as a standalone improvement. The ROADMAP.md should be updated to note it.

---

## Outcome

- Archived: 2026-04-04
- Verdict: APPROVE
- Commit: f1af5b7
