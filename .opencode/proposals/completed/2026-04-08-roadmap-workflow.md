---
title: "Roadmap Workflow — Parallel Proposal Execution via Git Worktrees"
date: 2026-04-08
status: proposed
---

# Roadmap Workflow — Parallel Proposal Execution via Git Worktrees

## Summary

This proposal introduces a **roadmap workflow** as a first-class concept in the bdd-workflow
framework. A roadmap is a single YAML file (`.opencode/roadmap.yaml`) that describes a set of
goals, their dependencies, and their current status. Two new agents manage the roadmap lifecycle:

- **`roadmap` agent** — creates and edits the roadmap YAML, decomposes goals into steps, resolves
  dependencies between them, and validates the roadmap structure.
- **`roadmap-runner` agent** — semi-autonomously executes roadmap steps using a two-phase model:
  **Phase 1 (Proposal)** writes proposals for all requested steps on main, then surfaces them as a
  batch for human approval. **Phase 2 (Execution)** creates git worktrees for all approved
  independent steps in parallel, copies the approved proposals in, and dispatches sub-agents to run
  apply → review → amend in each worktree concurrently. After all worktrees reach APPROVE, they are
  rebased and squash-merged back to main. Human approval gates are never skipped.

A new `roadmap` CLI subcommand provides tooling for inspecting the roadmap, linking proposals to
steps, reporting status, validating the roadmap, and preparing worktrees.

**User-visible impact:**
- A `roadmap` agent and `roadmap-runner` agent are provisioned in every scaffolded project.
- `.opencode/roadmap.yaml` is the single source of truth for project goals.
- `npx bdd-workflow roadmap show` prints the current roadmap with step status.
- `npx bdd-workflow roadmap link <step-id> <proposal-file>` associates a proposal with a step.
- `npx bdd-workflow roadmap status` summarizes progress (pending / in-progress / done counts).
- `npx bdd-workflow roadmap validate` checks the roadmap for structural errors (missing fields,
  duplicate IDs, dangling `depends_on` references).
- `npx bdd-workflow roadmap worktree <step-id>` creates a git worktree for a step and copies its
  linked proposal into the worktree's `.opencode/proposals/` directory, returning the worktree path.
- Independent roadmap steps can be worked on in parallel via git worktrees.
- Worktrees live inside the project at `.worktrees/` (gitignored), so sub-agents inherit all
  project permissions and configuration.

---

## Resolved Design Decisions

The following questions were raised during initial drafting and resolved with the user:

### D1: Proposal-first (confirmed)

All proposals are written and approved on main first. Once approved, the runner creates worktrees
and executes them. This keeps proposals visible together so the human can review dependencies
before any code runs, and is consistent with the existing human-approval-gate model.

### D2: Rebase then squash merge (confirmed)

Each worktree branch is rebased onto main before merging to surface conflicts per-branch. Then a
squash merge produces a single clean commit on main. Merge conflicts during rebase are resolved by
the sub-agent that owns the worktree — the human is not expected to resolve conflicts manually.
The roadmap-runner retains each sub-agent's session ID so it can direct the sub-agent to resolve
conflicts. Only if the sub-agent cannot resolve (e.g. a semantic conflict requiring human judgment)
does the runner escalate to the human.

### D3: Two-phase batch model (confirmed)

The user is in one of two modes at a time:

- **Proposal mode:** The runner writes proposals for all requested ready steps on main, then
  presents them as a batch for approval. The user reviews and approves/rejects each. Only approved
  proposals proceed to execution.
- **Execution mode:** The runner creates worktrees for all approved independent steps, copies
  proposals in, and dispatches parallel apply/review/amend work. The user can approve a subset of
  proposals and work on only those, which naturally handles the case where some steps are sequential.

This avoids context-switching between proposal-writing and code-review. The user stays in one
cognitive mode at a time.

### D4: No cycle detection in v1 (confirmed)

The roadmap agent is responsible for authoring acyclic roadmaps. `getReadySteps` assumes the YAML
is a DAG. Cycle detection can be added later as a lint rule via `npx bdd-workflow roadmap validate`.

### D5: `.opencode/roadmap.yaml` (confirmed)

The roadmap lives at `.opencode/roadmap.yaml`, alongside proposals and learnings. Configurable via
`workflow.roadmapFile` in `bdd-workflow.config.ts`.

### D6: Worktrees inside project at `.worktrees/` (confirmed)

Worktrees are created at `.worktrees/<step-id>` inside the project root (not `../worktrees/`
outside it). This directory is added to `.gitignore`. The key benefit: sub-agents running inside
worktrees inherit the project's `.opencode/` configuration, permissions, and skills without any
special path resolution. The `npx bdd-workflow roadmap worktree <step-id>` command handles
creation and proposal copying.

---

## Doc Updates (WHY Layer)

### `src/commands/roadmap.ts` — new file

```typescript
/**
 * @module commands/roadmap
 * @description CLI command wiring for `bdd-workflow roadmap`. Provides five
 * subcommands: `show` (prints the current roadmap with step status as a
 * formatted table), `link` (associates a proposal file with a roadmap step),
 * `status` (prints a progress summary: pending / in-progress / done counts),
 * `validate` (checks the roadmap YAML for structural errors), and `worktree`
 * (creates a git worktree for a step and copies its linked proposal in).
 * Loads and validates the project configuration before all subcommands.
 * Does NOT contain roadmap parsing or mutation logic — that lives in
 * src/roadmap/index.ts. Does NOT contain worktree creation logic — that
 * lives in src/roadmap/worktree.ts.
 */
```

### `src/roadmap/index.ts` — new file

```typescript
/**
 * @module roadmap
 * @description Reads, writes, and validates the project roadmap at
 * `.opencode/roadmap.yaml` (or the path configured in
 * `workflow.roadmapFile`). Provides typed access to roadmap steps, their
 * dependency graph, status values, and proposal links. Exposes functions used
 * by the CLI commands and by the roadmap-runner agent's shell tooling.
 *
 * Does NOT execute steps, create worktrees, or interact with git. That is
 * the responsibility of src/roadmap/worktree.ts and the roadmap-runner agent.
 * Does NOT write proposals — that remains the responsibility of the
 * bdd-workflow agent via the /propose command.
 */
```

### `src/roadmap/worktree.ts` — new file

```typescript
/**
 * @module roadmap/worktree
 * @description Creates and manages git worktrees for roadmap step execution.
 * Provides `createStepWorktree` which creates a git worktree at
 * `.worktrees/<step-id>`, checks out a `roadmap/<step-id>` branch, and copies
 * the step's linked proposal file from `.opencode/proposals/` into the
 * worktree's `.opencode/proposals/` directory. Returns the absolute path to
 * the worktree so the caller (CLI or agent) can hand off to a sub-agent.
 *
 * Does NOT run the BDD workflow (propose/apply/review) — that is the
 * responsibility of the sub-agent dispatched by the roadmap-runner.
 * Does NOT modify the roadmap YAML — the caller is responsible for updating
 * step status after worktree operations complete.
 */
```

### `src/config.ts` — update `WorkflowConfig` and `validateConfig`

Add `roadmapFile` to `WorkflowConfig`:

```typescript
/**
 * @property roadmapFile - Path (relative to project root) of the roadmap YAML
 *   file. Defaults to `.opencode/roadmap.yaml`.
 */
roadmapFile?: string;
```

Update `validateConfig` JSDoc to mention roadmap path validation.

### Scaffold template: `src/scaffold/templates/.opencode/agents/roadmap.md`

```markdown
/**
 * Roadmap agent. Creates and maintains the project roadmap YAML, decomposes
 * high-level goals into ordered steps with explicit depends_on relationships,
 * and validates the roadmap structure via `npx bdd-workflow roadmap validate`.
 *
 * Does NOT execute steps, create worktrees, or run the BDD workflow.
 * That is the responsibility of the roadmap-runner agent.
 */
```

### Scaffold template: `src/scaffold/templates/.opencode/agents/roadmap-runner.md`

```markdown
/**
 * Roadmap runner agent. Semi-autonomously executes roadmap steps using a
 * two-phase model:
 *
 * Phase 1 (Proposal): Writes proposals for all requested ready steps on main,
 * then surfaces them as a batch for human approval.
 *
 * Phase 2 (Execution): Creates worktrees for all approved independent steps
 * via `npx bdd-workflow roadmap worktree <step-id>`, dispatches sub-agents to
 * run apply/review/amend in each worktree in parallel, then rebases and
 * squash-merges each back to main after APPROVE.
 *
 * Still stops at ALL human approval gates. Does NOT skip proposal batch
 * approval, does NOT skip merge confirmation. Merge conflicts during rebase
 * are resolved by the sub-agent that owns the worktree — the runner retains
 * each sub-agent's session ID for this purpose. Only escalates to the human
 * if the sub-agent cannot resolve a conflict.
 */
```

---

## BDD Specs (WHAT Layer)

### `features/roadmap.feature` — NEW

```gherkin
Feature: Roadmap workflow

  Background:
    Given an initialized bdd-workflow project

  Scenario: roadmap subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output contains "roadmap"

  Scenario: roadmap show prints an empty roadmap gracefully
    Given no roadmap file exists
    When I run "npx bdd-workflow roadmap show"
    Then the command exits with status 0
    And the output contains "No roadmap found"

  Scenario: roadmap show prints step table with statuses
    Given a roadmap file with two steps: "setup" (pending) and "auth" (done)
    When I run "npx bdd-workflow roadmap show"
    Then the output contains "setup" and "pending"
    And the output contains "auth" and "done"

  Scenario: roadmap status prints progress summary
    Given a roadmap file with 3 pending steps and 1 done step
    When I run "npx bdd-workflow roadmap status"
    Then the output contains "1 done"
    And the output contains "3 pending"
    And the output contains "0 in-progress"

  Scenario: roadmap link associates a proposal with a step
    Given a roadmap file with a step "setup" (pending)
    And a proposal file ".opencode/proposals/2026-04-08-setup.md" exists
    When I run "npx bdd-workflow roadmap link setup 2026-04-08-setup.md"
    Then the command exits with status 0
    And the roadmap file contains proposal "2026-04-08-setup.md" under step "setup"

  Scenario: roadmap link fails when step does not exist
    Given a roadmap file with no step named "nonexistent"
    When I run "npx bdd-workflow roadmap link nonexistent some-proposal.md"
    Then the command exits with status 1
    And the output contains "step not found: nonexistent"

  Scenario: roadmap link fails when proposal file does not exist
    Given a roadmap file with a step "setup"
    When I run "npx bdd-workflow roadmap link setup missing-proposal.md"
    Then the command exits with status 1
    And the output contains "proposal file not found"

  Scenario: roadmap validate passes for a valid roadmap
    Given a roadmap file with valid steps and no structural errors
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 0
    And the output contains "roadmap is valid"

  Scenario: roadmap validate reports missing required fields
    Given a roadmap file with a step missing the "title" field
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "missing required field"

  Scenario: roadmap validate reports duplicate step IDs
    Given a roadmap file with two steps sharing the id "setup"
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "duplicate step id"

  Scenario: roadmap validate reports dangling depends_on references
    Given a roadmap file where step "auth" depends_on "nonexistent"
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "unknown dependency"

  Scenario: roadmap worktree creates a worktree and copies the proposal
    Given a roadmap file with a step "setup" linked to proposal "2026-04-08-setup.md"
    And a proposal file ".opencode/proposals/2026-04-08-setup.md" exists
    When I run "npx bdd-workflow roadmap worktree setup"
    Then the command exits with status 0
    And the directory ".worktrees/setup" exists
    And the file ".worktrees/setup/.opencode/proposals/2026-04-08-setup.md" exists
    And the output contains the worktree path

  Scenario: roadmap worktree fails when step has no linked proposal
    Given a roadmap file with a step "setup" and no linked proposal
    When I run "npx bdd-workflow roadmap worktree setup"
    Then the command exits with status 1
    And the output contains "no proposal linked"

  Scenario: roadmap YAML is valid and parseable after roadmap agent creates it
    Given a roadmap YAML file conforming to the RoadmapStep schema
    When I parse the roadmap file
    Then all steps have required fields: id, title, status
    And status values are one of: pending, in-progress, done, skipped
```

### `features/scaffold-roadmap.feature` — NEW

```gherkin
Feature: Roadmap agents provisioned by scaffold

  Scenario: roadmap agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap.md" exists

  Scenario: roadmap-runner agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap-runner.md" exists

  Scenario: roadmap command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/roadmap.md" exists

  Scenario: scaffold .gitignore includes .worktrees directory
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".gitignore" contains ".worktrees/"
```

---

## Implementation Plan (HOW Layer)

### Phase breakdown

This is a large feature. Implementation should proceed in three sub-phases:

**Sub-phase A — Data layer (roadmap types, YAML I/O, validation, worktree helper, CLI commands)**
**Sub-phase B — Scaffold: agents, commands, .gitignore update**
**Sub-phase C — Feature files and step definitions**

This proposal covers all three sub-phases in a single apply, but they are called out to clarify
ordering of work within the apply step.

---

### Sub-phase A: Data layer

#### 1. `src/roadmap/index.ts` — new file

Implement the `RoadmapStep` type and `Roadmap` type:

```typescript
export type StepStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface RoadmapStep {
  id: string;               // kebab-case identifier, unique within roadmap
  title: string;            // human-readable one-liner
  status: StepStatus;
  description?: string;     // optional longer description
  depends_on?: string[];    // ids of steps that must be 'done' before this starts
  proposal?: string;        // filename of linked proposal (basename only, no path)
  worktree?: string;        // git worktree branch name when in-progress
  notes?: string;           // free-form notes; not machine-read
}

export interface Roadmap {
  title: string;            // project/roadmap title
  description?: string;
  steps: RoadmapStep[];
}

export interface RoadmapValidationError {
  stepId?: string;          // which step has the error (undefined for roadmap-level errors)
  field: string;
  message: string;
}
```

Implement functions:

- `readRoadmap(config: BddWorkflowConfig): Roadmap | null` — reads and parses the YAML file. Returns
  `null` if the file does not exist. Throws on parse errors.
- `writeRoadmap(config: BddWorkflowConfig, roadmap: Roadmap): void` — serializes and writes the
  YAML file. Uses `sortKeys: false` to preserve authoring order.
- `linkProposal(config: BddWorkflowConfig, stepId: string, proposalFilename: string): void` —
  reads the roadmap, finds the step by id, sets `proposal`, writes back. Throws if step not found
  or proposal file does not exist.
- `getReadySteps(roadmap: Roadmap): RoadmapStep[]` — returns steps with `status: pending` where
  all `depends_on` steps are `done`. Warning comment: assumes acyclic graph.
- `validateRoadmap(roadmap: Roadmap): RoadmapValidationError[]` — checks for: missing required
  fields (`id`, `title`, `status`), invalid `status` values, duplicate step IDs, dangling
  `depends_on` references (referencing a step ID that doesn't exist). Returns empty array if valid.
- `printRoadmapTable(roadmap: Roadmap): void` — prints a human-readable table to stdout. Columns:
  `ID`, `Title`, `Status`, `Depends On`, `Proposal`.
- `printRoadmapStatus(roadmap: Roadmap): void` — prints counts by status.

Use `js-yaml` for YAML parsing/serialization. It is already a transitive dependency of
`@cucumber/gherkin` — check whether it needs to be added to `dependencies` explicitly.

> **Note for apply agent:** Verify `js-yaml` is available via `npm list js-yaml`. If it is only a
> transitive dep (not in package.json `dependencies`), add it explicitly.

#### 2. `src/roadmap/worktree.ts` — new file

Implement worktree creation and proposal copying:

```typescript
export interface WorktreeResult {
  path: string;             // absolute path to the created worktree
  branch: string;           // git branch name (roadmap/<step-id>)
  proposalPath: string;     // path to the copied proposal inside the worktree
}
```

Implement functions:

- `createStepWorktree(config: BddWorkflowConfig, stepId: string): WorktreeResult` — performs:
  1. Reads the roadmap, finds the step by ID. Throws if step not found.
  2. Checks that the step has a `proposal` field. Throws `"no proposal linked to step <id>"` if not.
  3. Checks that the proposal file exists at `.opencode/proposals/<proposal>`. Throws if not.
  4. Creates `.worktrees/` directory if it doesn't exist.
  5. Runs `git worktree add .worktrees/<step-id> -b roadmap/<step-id>`.
  6. Copies `.opencode/proposals/<proposal>` into `.worktrees/<step-id>/.opencode/proposals/`.
  7. Returns the `WorktreeResult` with absolute paths.

- `removeStepWorktree(stepId: string): void` — runs `git worktree remove .worktrees/<step-id>`
  and `git branch -d roadmap/<step-id>`. Tolerates "not found" errors gracefully.

Uses `child_process.execSync` for git commands (same pattern as `src/commands/check.ts`).

#### 3. `src/commands/roadmap.ts` — new file

Wire up the Commander subcommand:

```
bdd-workflow roadmap
  show                    Print roadmap table with step statuses
  status                  Print counts (pending/in-progress/done)
  link <step-id> <file>   Associate a proposal file with a step
  validate                Check roadmap YAML for structural errors
  worktree <step-id>      Create a worktree for a step and copy its proposal in
```

All subcommands: `loadConfig` → `assertValidConfig` → delegate to `src/roadmap/index.ts` or
`src/roadmap/worktree.ts`.

`show` — call `readRoadmap`; if null, print "No roadmap found at <path>." and exit 0; else call
`printRoadmapTable`.

`status` — call `readRoadmap`; if null, print message and exit 0; else call `printRoadmapStatus`.

`link` — call `linkProposal`; catch errors and print them with exit 1.

`validate` — call `readRoadmap`; if null, print "No roadmap found" and exit 1; else call
`validateRoadmap`. If errors, print each with step context and exit 1. If valid, print
"roadmap is valid" and exit 0.

`worktree` — call `createStepWorktree`; print the returned path. Catch errors and print with
exit 1.

#### 4. `src/cli.ts` — register roadmapCommand

Add `.addCommand(roadmapCommand())` alongside the existing commands.

#### 5. `src/config.ts` — add `roadmapFile` to `WorkflowConfig`

```typescript
export interface WorkflowConfig {
  roadmapFile: string;    // default: '.opencode/roadmap.yaml'
}
```

Update `defineConfig` defaults to include `roadmapFile: '.opencode/roadmap.yaml'`.

No `validateConfig` additions needed — path is not validated (file is allowed to be absent).

#### 6. `src/index.ts` — export new types

Export `RoadmapStep`, `Roadmap`, `StepStatus`, `RoadmapValidationError`, `readRoadmap`,
`writeRoadmap`, `linkProposal`, `getReadySteps`, `validateRoadmap`, `createStepWorktree`,
`removeStepWorktree`, `WorktreeResult` from `src/index.ts`.

---

### Sub-phase B: Scaffold agents and commands

All files below go into `src/scaffold/templates/`. After apply, run:
`npm run build && npx bdd-workflow update`

#### 7. `src/scaffold/templates/.opencode/agents/roadmap.md` — new file

```markdown
---
description: Creates and maintains the project roadmap YAML
mode: primary
model: github-copilot/claude-sonnet-4.6
temperature: 0.3
---

You are the roadmap agent. You help the user design and maintain the project roadmap stored
at `.opencode/roadmap.yaml`.

## Responsibilities

1. **Create** the roadmap file when it does not exist. Ask the user for:
   - A roadmap title
   - A list of goals/steps (one per line is fine)
   - For each step: a short id (kebab-case), a title, an optional description
   - Dependencies between steps (`depends_on`)

2. **Edit** existing steps: update titles, descriptions, statuses, notes.

3. **Validate** the roadmap after every edit by running `npx bdd-workflow roadmap validate`.
   Fix any errors before saving.

4. **Show** the roadmap in a readable format using `npx bdd-workflow roadmap show`.

## YAML Schema

Each step must have:
- `id`: unique kebab-case identifier
- `title`: one-line human description
- `status`: one of `pending`, `in-progress`, `done`, `skipped`

Optional fields: `description`, `depends_on`, `proposal`, `worktree`, `notes`.

## What This Agent Does NOT Do

- Does NOT execute steps or create worktrees — that is the roadmap-runner agent.
- Does NOT write proposals — that is the bdd-workflow agent.
- Does NOT modify source code, feature files, or any file outside `.opencode/roadmap.yaml`.
```

#### 8. `src/scaffold/templates/.opencode/agents/roadmap-runner.md` — new file

```markdown
---
description: Semi-autonomously executes roadmap steps via git worktrees
mode: primary
model: github-copilot/claude-sonnet-4.6
temperature: 0.3
---

You are the roadmap-runner agent. You execute roadmap steps using a two-phase model:
proposals are written and approved on main first, then worktrees are created for parallel
execution.

## Phase 1 — Proposal (on main)

When the user asks you to execute roadmap steps (or "run the roadmap"):

1. Read the roadmap: `npx bdd-workflow roadmap show`
2. Identify ready steps using `getReadySteps` logic: steps with `status: pending` where all
   `depends_on` are `done`. If the user specified particular step IDs, use those instead.
3. For EACH ready step, run `/propose <step title + description>` on main. This writes a
   proposal to `.opencode/proposals/`.
4. After writing the proposal, link it: `npx bdd-workflow roadmap link <step-id> <proposal-file>`
5. After ALL proposals for the batch are written, present them as a numbered list:

   ```
   Proposals ready for review:
   1. [step-id] — .opencode/proposals/YYYY-MM-DD-slug.md
   2. [step-id] — .opencode/proposals/YYYY-MM-DD-slug.md
   ...
   ```

6. **STOP.** Ask the user: "Which proposals do you approve? (all / list of numbers / none)"
   - Do NOT proceed to Phase 2 until the user responds.
   - The user may approve all, a subset, or none.
   - Rejected proposals stay on main but the step remains `pending`.

## Phase 2 — Execution (in worktrees, parallel)

After the user approves one or more proposals:

1. For EACH approved step, create a worktree:
   `npx bdd-workflow roadmap worktree <step-id>`
   This creates `.worktrees/<step-id>/` and copies the proposal in.

2. Update each step's status to `in-progress` in `.opencode/roadmap.yaml`.

3. For EACH worktree, dispatch work (in parallel where steps are independent):
   - Change working directory to `.worktrees/<step-id>/`
   - Run `/apply` (the proposal is already in the worktree's `.opencode/proposals/`)
   - Run `npx bdd-workflow check`. If it fails, fix failures (still apply phase).
   - Run `/review`. If verdict is AMEND, run `/amend` and re-review.
   - After APPROVE: print the review path and the step ID.

4. After ALL worktrees reach APPROVE (or if running one at a time), present merge summary:

   ```
   Steps ready to merge:
   1. [step-id] — .worktrees/step-id/ (branch: roadmap/step-id)
   ...
   ```

5. **STOP.** Ask the user: "Merge these steps back to main? (all / list of numbers / none)"

6. For each confirmed merge, on main:
   - `git rebase main` from within the worktree (to surface conflicts per-branch)
   - If conflicts: direct the sub-agent (whose session you retained from Phase 2 step 3) to
     resolve the conflicts in the worktree. The sub-agent wrote the code and has full context.
     Only escalate to the human if the sub-agent cannot resolve (e.g. a semantic conflict
     requiring human judgment about which approach wins).
   - After clean rebase: `git checkout main && git merge --squash roadmap/<step-id>`
   - `git commit -m "feat(<step-id>): <step title>"`
   - `npx bdd-workflow roadmap link <step-id> <proposal-basename>` (if not already linked)
   - Update step status to `done` in `.opencode/roadmap.yaml`
   - Remove worktree: `git worktree remove .worktrees/<step-id>`

7. After all merges complete, print updated roadmap: `npx bdd-workflow roadmap show`
8. Check if new steps are now ready (their dependencies just became `done`). If so, inform
   the user: "N new steps are now ready. Run another cycle?"

## Sub-agent Session Management

For each worktree, retain the sub-agent's session ID throughout Phase 2. This allows you to:
- Direct the same sub-agent to resolve merge conflicts during rebase (it wrote the code and has
  full context of the changes).
- Ask the sub-agent clarifying questions without losing conversation history.
- Only escalate to the human if the sub-agent cannot resolve a conflict (e.g. a semantic conflict
  where two proposals made incompatible design choices that require human judgment).

## Human Approval Gates (NEVER SKIP)

- After proposal batch: wait for explicit approval of which proposals to proceed with.
- After all worktrees reach APPROVE: wait for explicit merge confirmation.

## What This Agent Does NOT Do

- Does NOT auto-approve proposals.
- Does NOT force-push or amend commits without explicit user instruction.
- Does NOT run archive — the squash merge commit IS the archive for roadmap steps.
- Does NOT modify `.opencode/roadmap.yaml` outside of status/link updates.
- Does NOT skip the rebase step before merge.
- Does NOT ask the human to resolve merge conflicts — that is the sub-agent's job.
```

#### 9. `src/scaffold/templates/.opencode/commands/roadmap.md` — new file

```markdown
---
description: Show, status, validate, link, or worktree roadmap steps via CLI
model: anthropic/claude-haiku-4-5
---

Load the `bdd-workflow` skill.

Run the following roadmap CLI command based on $ARGUMENTS:

- If $ARGUMENTS is empty or "show": run `npx bdd-workflow roadmap show`
- If $ARGUMENTS is "status": run `npx bdd-workflow roadmap status`
- If $ARGUMENTS is "validate": run `npx bdd-workflow roadmap validate`
- If $ARGUMENTS starts with "link": run `npx bdd-workflow roadmap link $ARGUMENTS`
- If $ARGUMENTS starts with "worktree": run `npx bdd-workflow roadmap worktree $ARGUMENTS`

Print the output. If the command fails, print the error and suggest corrective action.
```

#### 10. `src/scaffold/templates/.gitignore` — update

Add `.worktrees/` to the scaffold template's `.gitignore` so that new projects automatically
ignore the worktree directory:

```
.worktrees/
```

---

### Sub-phase C: Feature files and step definitions

#### 11. `features/roadmap.feature` — new file (full Gherkin in BDD Specs section above)

#### 12. `features/scaffold-roadmap.feature` — new file (full Gherkin in BDD Specs section above)

#### 13. Step definitions

**`features/support/steps/roadmap.steps.ts`** — new file

Implement steps for `roadmap.feature`:

- `Given no roadmap file exists` — create a temp initialized project without `.opencode/roadmap.yaml`
- `Given a roadmap file with two steps: "X" (pending) and "Y" (done)` — write a minimal YAML to
  `.opencode/roadmap.yaml` inside the temp project
- `Given a roadmap file with valid steps and no structural errors` — write a well-formed YAML
- `Given a roadmap file with a step missing the "title" field` — write YAML with missing title
- `Given a roadmap file with two steps sharing the id "setup"` — write YAML with duplicate IDs
- `Given a roadmap file where step "auth" depends_on "nonexistent"` — write YAML with dangling ref
- `Given a roadmap file with a step "setup" linked to proposal "..."` — write YAML with proposal field
- `Given a roadmap YAML file conforming to the RoadmapStep schema` — write a minimal valid YAML
- `When I parse the roadmap file` — call `readRoadmap` directly (unit-level)
- `Then all steps have required fields: id, title, status` — assert on parsed object
- `Then status values are one of: pending, in-progress, done, skipped` — assert on parsed object
- `And the directory ".worktrees/setup" exists` — check directory existence in temp project
- `And the output contains the worktree path` — regex match on CLI output

For the `worktree` scenario: the step definition needs to set up a git repo in the temp directory
(since `git worktree add` requires a git repo). Use `git init` in the temp project setup.

Integration steps (spawn CLI in temp project):
- Reuse the `When I run "npx bdd-workflow ..."` step from existing step definitions.
- Reuse the temp project helpers from `init.steps.ts`.

**`features/support/steps/scaffold-roadmap.steps.ts`** — new file (or add to existing scaffold
step file)

The `the file "X" exists` and `the file "X" contains "Y"` steps are already globally defined.
No new step definitions needed for `scaffold-roadmap.feature`.

---

## Risks and Considerations

### Breaking changes

- Adding `roadmapFile` to `WorkflowConfig` / `defineConfig` defaults is backward-compatible.
- No existing CLI commands are modified.
- `src/index.ts` gains new exports — additive, not breaking.
- Adding `.worktrees/` to the scaffold `.gitignore` is additive.

### Dependencies

- `js-yaml` may need to be added as an explicit `dependency` (not just transitive). Verify during
  apply. If adding it, also add `@types/js-yaml` to `devDependencies`.
- No other new runtime dependencies.

### Worktree path convention

The runner agent uses `.worktrees/<step-id>` inside the project root. This directory is gitignored.
Benefits:
- Sub-agents inherit `.opencode/` configuration, permissions, and skills from the parent project.
- No need for special path resolution or symlinks.
- The worktree is a full git checkout — it has its own `node_modules/` (via the parent's if using
  workspaces, or the agent can run `npm install` in the worktree).

> **Edge case:** If `.worktrees/` already exists as a user directory (unlikely), the gitignore
> entry could mask user files. The `validate` command could warn about this.

> **Edge case:** `node_modules` in worktrees — the worktree is a git checkout, not a copy. It
> will NOT have `node_modules/` unless `npm install` is run. The runner agent instructions should
> include `npm install` as the first step after worktree creation. Add this to the
> `createStepWorktree` function or document it as a runner responsibility.

### Merge conflict responsibility

Merge conflicts are the responsibility of the sub-agent that owns the worktree, not the human.
Each worktree branch is rebased onto main before the squash merge. If a conflict occurs during
rebase, the roadmap-runner directs the sub-agent (whose session it retained) to resolve the
conflicts — the sub-agent wrote the code and has full context of the changes. The human is only
escalated to if the sub-agent cannot resolve a conflict (e.g. two proposals made incompatible
design choices that require human judgment about which approach wins). This keeps the human in a
supervisory role rather than a manual-labor role.

### Rebase before squash merge

The two-step merge process (rebase then squash) ensures:
1. Conflicts are surfaced per-branch (during rebase), not as a tangled mess on main.
2. The final merge is always a clean fast-forward squash — no merge commits.
3. If two worktrees both modified the same file, the second one to merge will hit the conflict
   during its rebase (since main has already moved forward from the first merge).

### Cycle detection

Cycle detection in the roadmap DAG is out of scope for v1. The `validateRoadmap` function checks
for dangling `depends_on` references but does NOT check for cycles. The roadmap agent is
responsible for authoring acyclic roadmaps. `getReadySteps` assumes the YAML is a DAG. A warning
comment in `getReadySteps` should flag this limitation. Cycle detection can be added to
`validateRoadmap` in a future proposal.

### YAML serialization fidelity

`js-yaml` dump/load round-trips may reorder keys or strip trailing whitespace. The `writeRoadmap`
function should use a consistent `sortKeys: false` option and preserve comment blocks if possible.
In practice, YAML comments are stripped by `js-yaml` — document this limitation: users should not
put important information in YAML comments.

### `bdd-workflow update` compatibility

The new scaffold files (two agents, one command) will be added to the framework layer in
`src/scaffold/manifest.ts` via the `FRAMEWORK_LAYER_GLOBS` constant. Running `npx bdd-workflow
update` in an existing project after upgrading the package will add the new files.

Existing projects will NOT have `.opencode/agents/roadmap.md`, `.opencode/agents/roadmap-runner.md`,
or `.opencode/commands/roadmap.md` until they run `update`. This is the expected behavior.

### `opencode.json` update

The existing `opencode.json` in the scaffold template registers the `review` agent. The `roadmap`
and `roadmap-runner` agents do NOT need to be registered in `opencode.json` because they use
`mode: primary` (they are invoked directly by the user, not as sub-agents). Confirm this is
correct for the OpenCode agent model — if `mode: primary` agents do not need registration, no
change to `opencode.json` is needed.

> **Reviewer action:** Confirm whether `roadmap` and `roadmap-runner` agents need entries in
> `opencode.json`.

### CLI help discoverability

Users need to know the `roadmap` subcommand exists. `npx bdd-workflow --help` will list it
automatically once `roadmapCommand()` is registered. No extra docs step required for the CLI help.

### Proposal template unused for runner

The runner agent uses the existing `/propose` and `/review` commands inside each worktree. There
is no "roadmap-proposal template" — the standard proposal format is reused. This is intentional.

### Parallel execution model

The runner agent instructions say "dispatch work in parallel where steps are independent." In
practice, this means the agent should use parallel tool calls (multiple Bash invocations) or
describe the parallel intent to the user. The actual parallelism depends on the agent runtime's
capabilities. If the runtime only supports sequential tool calls, the runner will execute
worktrees one at a time — this is still correct, just slower. The batch approval gates still
apply regardless of actual parallelism.

### This project's own `.gitignore`

The `.worktrees/` entry needs to be added to both:
1. `src/scaffold/templates/.gitignore` (for new projects)
2. This project's own `.gitignore` (for development of this feature)

Per AGENTS.md, only the template is edited during apply. This project's `.gitignore` is updated
via `npx bdd-workflow update` or manually.

---

## File Change Summary

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/roadmap/index.ts` | Roadmap data model, YAML I/O, validation, and helper functions |
| `src/roadmap/worktree.ts` | Git worktree creation, proposal copying, and cleanup |
| `src/commands/roadmap.ts` | CLI command wiring for `bdd-workflow roadmap` (5 subcommands) |
| `src/scaffold/templates/.opencode/agents/roadmap.md` | Roadmap author agent |
| `src/scaffold/templates/.opencode/agents/roadmap-runner.md` | Roadmap execution agent (two-phase) |
| `src/scaffold/templates/.opencode/commands/roadmap.md` | Thin slash-command entry point |
| `features/roadmap.feature` | BDD specs for roadmap CLI commands (including validate + worktree) |
| `features/scaffold-roadmap.feature` | BDD specs for scaffold file existence + .gitignore |
| `features/support/steps/roadmap.steps.ts` | Step definitions for roadmap.feature |

### Files to MODIFY

| File | Change |
|------|--------|
| `src/cli.ts` | Register `roadmapCommand()` |
| `src/config.ts` | Add `roadmapFile` to `WorkflowConfig` and `defineConfig` defaults |
| `src/index.ts` | Export new roadmap types and functions |
| `src/scaffold/templates/.gitignore` | Add `.worktrees/` entry |
| `package.json` | Add `js-yaml` to dependencies if not already present; add `@types/js-yaml` to devDependencies |

### Files to VERIFY (no change expected)

| File | Verification |
|------|-------------|
| `src/scaffold/index.ts` | Confirm `FRAMEWORK_LAYER_GLOBS` will pick up new agent/command files |
| `src/scaffold/templates/.opencode/opencode.json` | Confirm `roadmap` / `roadmap-runner` do not need registration |

## Outcome

- Archived: 2026-04-08
- Verdict: APPROVE
- Commit: 6071e47
