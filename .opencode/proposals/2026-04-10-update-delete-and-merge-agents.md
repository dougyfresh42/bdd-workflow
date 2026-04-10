---
title: "consolidate agents, add acceptance criteria, prune update, worktrees/ dir"
date: 2026-04-10
status: draft
---

## Summary

Four tightly-coupled improvements that together make the scaffolded developer experience
coherent and product-correct:

1. **One conversational agent.** The current `bdd-workflow.md`, `roadmap.md`, and
   `roadmap-runner.md` are merged into a single `bdd-workflow.md` agent backed by two
   skills: `bdd-workflow-cycle` (the propose → apply → review → amend → archive loop,
   single or multi) and `bdd-workflow-roadmap` (roadmap YAML editing). `review.md` is
   retained as a locked-permission sub-agent used internally. `/build` and `/plan`
   commands are explicitly out of scope — they remain one-shot and workflow-unaware.

2. **Acceptance Criteria added to proposals.** The proposal template and `bdd-propose`
   skill gain an **Acceptance Criteria** section. This is the user-facing end goal stated
   in concrete, runnable terms ("run `npm start`, visit `localhost:3000`, see an HTML
   page"). The cycle skill surfaces these criteria after automated review passes APPROVE
   and blocks on explicit human confirmation before merge/archive. The agent warns if the
   section is empty so the author can decide whether to fill it in or explicitly waive it.

3. **`bdd-workflow update` prunes removed framework files.** If the package removes a
   framework file (like `roadmap.md` after this change), running `update` now deletes the
   stale on-disk copy — provided the user hasn't modified it. Modified stale files are
   reported as `modifiedByUser (skipped)` as usual.

4. **Worktrees live in `worktrees/` (not `.worktrees/`), gitignored.** The worktree
   directory is renamed from `.worktrees/` to `worktrees/` so it is visible and
   navigable in file explorers and terminal listings. The `.gitignore` template is updated
   accordingly, and all agent instructions, CLI code, and feature specs are updated to
   match.

User-visible impact:
- Users talk to one agent for everything. No more "which agent do I use?"
- Proposals require an Acceptance Criteria section; the cycle always asks the user to
  manually verify before merging.
- `bdd-workflow update` removes stale framework files automatically.
- Worktrees appear as `worktrees/<step-id>/` in the project root.

---

## Doc Updates (WHY)

### `src/scaffold/update.ts` — module JSDoc + `UpdateResult`

```typescript
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
```

`UpdateResult` gains a `pruned` field:

```typescript
export interface UpdateResult {
  added: string[];
  identical: string[];
  updated: string[];
  merged: string[];
  modifiedByUser: string[];
  /** Files deleted from disk because the template no longer includes them
   *  and the on-disk content was unmodified (or --force was passed). */
  pruned: string[];
}
```

### `src/roadmap/worktree.ts` — update all path references

```typescript
/**
 * @module roadmap/worktree
 * @description Creates and manages git worktrees for roadmap step execution.
 * Provides `createStepWorktree` which creates a git worktree at
 * `worktrees/<step-id>/` (visible, gitignored directory at project root),
 * checks out a `roadmap/<step-id>` branch, and copies the step's linked
 * proposal file from `.opencode/proposals/` into the worktree's
 * `.opencode/proposals/` directory. Returns the absolute path to the
 * worktree so the caller can hand off to a sub-agent.
 * Does NOT run the BDD workflow — that is the sub-agent's responsibility.
 * Does NOT modify the roadmap YAML — the caller updates step status.
 */
```

### `src/scaffold/templates/.opencode/agents/bdd-workflow.md` — full replacement

New frontmatter description:
```
description: >
  The one agent for everything: propose→apply→review→archive for single
  changes, parallel roadmap execution via worktrees, and roadmap YAML
  maintenance. Backed by bdd-workflow-cycle and bdd-workflow-roadmap skills.
```

Full body content described in Implementation Plan §4.

### `src/scaffold/templates/.opencode/agents/roadmap.md` — DELETED

Absorbed into `bdd-workflow.md`. Prune logic removes it from user projects on update.

### `src/scaffold/templates/.opencode/agents/roadmap-runner.md` — DELETED

Absorbed into `bdd-workflow.md`. Prune logic removes it from user projects on update.

### `src/scaffold/templates/.opencode/skills/bdd-workflow-cycle/SKILL.md` — NEW

New skill covering the full cycle including acceptance criteria gate. See §4.

### `src/scaffold/templates/.opencode/skills/bdd-workflow-roadmap/SKILL.md` — NEW

New skill covering roadmap YAML schema and maintenance operations. See §4.

### `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md` — keep, update

Existing `bdd-workflow` skill is retained as the top-level orientation skill. Update it
to reference the two new sub-skills and document the acceptance criteria gate.

### `src/scaffold/templates/.opencode/skills/bdd-propose/SKILL.md` — update

Add **Acceptance Criteria** as required section §3 (shifting current §3–§5 to §4–§6):

```
### 3. Acceptance Criteria
One or more concrete, human-verifiable statements describing the user-facing end goal.
Each criterion must be something a person can check by running or interacting with the
result — not a restatement of implementation details.

Examples:
- "Run `npm start`; visiting `http://localhost:3000` serves an HTML page."
- "Running `npx my-cli --help` prints usage text and exits 0."
- "Calling `processOrder({ id: 1 })` returns `{ status: 'ok' }` given a seeded DB."

If the change has no user-facing artifact (e.g. a pure refactor or internal tooling
fix), write: "No user-facing artifact — acceptance is automated test passage." The
agent will surface this during review and ask the author to confirm it is intentional.
```

### `src/scaffold/templates/.opencode/templates/proposal.md` — update

Add Acceptance Criteria section between Summary and Doc Updates:

```markdown
## Acceptance Criteria

<!-- One or more concrete, human-verifiable statements. Examples:
  - Run `npm start`; visiting http://localhost:3000 serves an HTML page.
  - `npx my-cli --help` prints usage and exits 0.
  - No user-facing artifact — acceptance is automated test passage.
-->
```

---

## BDD Specs (WHAT)

### `features/update.feature` — add prune scenarios

```gherkin
  Scenario: Update prunes an unmodified framework file that no longer exists in templates
    Given the file ".opencode/agents/old-agent.md" was written by the framework and is unmodified
    And that file no longer exists in the current template set
    When I run "bdd-workflow update"
    Then the file ".opencode/agents/old-agent.md" no longer exists on disk
    And the output reports "1 pruned"

  Scenario: Update does not prune a framework file that the user has modified
    Given the file ".opencode/agents/old-agent.md" was written by the framework but modified by the user
    And that file no longer exists in the current template set
    When I run "bdd-workflow update"
    Then the file ".opencode/agents/old-agent.md" still exists on disk
    And the output reports "1 modified by user (skipped)"

  Scenario: Update force-prunes a user-modified stale framework file when --force is given
    Given the file ".opencode/agents/old-agent.md" was written by the framework but modified by the user
    And that file no longer exists in the current template set
    When I run "bdd-workflow update --force"
    Then the file ".opencode/agents/old-agent.md" no longer exists on disk
    And the output reports "1 pruned"
```

### `features/scaffold-roadmap.feature` — rewrite

```gherkin
Feature: Roadmap scaffold provisions

  Scenario: roadmap command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/roadmap.md" exists

  Scenario: standalone roadmap agent does not exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap.md" does not exist

  Scenario: roadmap-runner agent does not exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap-runner.md" does not exist

  Scenario: scaffold .gitignore includes worktrees/ directory
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".gitignore" contains "worktrees/"
```

### `features/scaffold-phase2.feature` — add scenarios, update agent count

Add after existing scenarios:

```gherkin
  Scenario: Only two agent files exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/bdd-workflow.md" exists
    And the file ".opencode/agents/review.md" exists
    And the file ".opencode/agents/roadmap.md" does not exist
    And the file ".opencode/agents/roadmap-runner.md" does not exist

  Scenario: bdd-workflow-cycle skill exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/skills/bdd-workflow-cycle/SKILL.md" exists

  Scenario: bdd-workflow-roadmap skill exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/skills/bdd-workflow-roadmap/SKILL.md" exists

  Scenario: proposal template contains Acceptance Criteria section
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the template file ".opencode/templates/proposal.md" contains section "## Acceptance Criteria"
```

### `features/roadmap.feature` — update worktree path

Update the worktree scenario to reference `worktrees/` not `.worktrees/`:

```gherkin
  Scenario: roadmap worktree creates a worktree at worktrees/<step-id>
    Given a project directory initialized with bdd-workflow
    And a roadmap with a step "my-step" linked to a proposal file
    When I run "npx bdd-workflow roadmap worktree my-step"
    Then the directory "worktrees/my-step" exists
    And the proposal file is present in "worktrees/my-step/.opencode/proposals/"
```

---

## Implementation Plan (HOW)

### 1. Rename `.worktrees/` → `worktrees/` everywhere

Files to update:
- `src/roadmap/worktree.ts` — change `WORKTREE_ROOT` constant from `.worktrees` to `worktrees`
- `src/scaffold/templates/.gitignore` — change `.worktrees/` to `worktrees/`
- `src/scaffold/templates/.opencode/agents/bdd-workflow.md` (new file) — use `worktrees/`
- All feature files referencing `.worktrees` — update path assertions
- `AGENTS.md` in this repo (if it references `.worktrees`) — update

### 2. Prune pass in `src/scaffold/update.ts`

After the existing per-file loop, add:

```
// Prune pass: delete manifest entries with no corresponding template file
for each relPath of Object.keys(manifest):
  if relPath is in frameworkFiles set: continue  // handled above
  diskPath = join(targetDir, relPath)
  if not existsSync(diskPath):
    delete manifest[relPath]   // already gone; clean up manifest entry
    continue
  diskContent = readFileSync(diskPath, 'utf-8')
  diskHash = hashContent(diskContent)
  if diskHash === manifest[relPath] || opts.force:
    unlinkSync(diskPath)
    delete manifest[relPath]
    result.pruned.push(relPath)
    if opts.verbose: console.log(`  [pruned]   ${relPath}`)
  else:
    result.modifiedByUser.push(relPath)
    if opts.verbose: console.log(`  [skipped]  ${relPath} (modified by user, stale)`)
```

Initialize `result.pruned = []` in the result object.

Update `printUpdateSummary` to include `${result.pruned.length} pruned` in the summary line,
between `identical` and `modified by user`:

```
N updated  N merged  N added  N identical  N pruned  N modified by user (skipped)
```

### 3. Delete template files

- `src/scaffold/templates/.opencode/agents/roadmap.md` — delete
- `src/scaffold/templates/.opencode/agents/roadmap-runner.md` — delete

### 4. New and updated skill files

#### `src/scaffold/templates/.opencode/skills/bdd-workflow-cycle/SKILL.md` (NEW)

Content covers:
- The three-layer model (WHY / WHAT / HOW) — moved here from the top-level skill
- The full cycle sequence: propose → [human approval] → apply → check → review → amend? → **Acceptance Criteria gate** → merge/archive
- **Acceptance Criteria gate**: after automated review hits APPROVE, the agent:
  1. Prints the Acceptance Criteria verbatim from the proposal
  2. If the section is empty or says "no user-facing artifact", prints a warning and asks the user to confirm this is intentional before proceeding
  3. Otherwise says: "Please verify these criteria on branch `<branch>` (or in worktree `worktrees/<step-id>/`), then reply to proceed."
  4. STOPS and waits for explicit user confirmation
  5. Only after confirmation: runs `/archive --approved` (single) or merges (roadmap)
- Single-step vs multi-step are the same cycle; multi-step runs N parallel cycles in
  separate worktrees under `worktrees/<step-id>/`
- **WORKTREE RULE** (prominent callout): when a cycle runs inside a worktree, the
  sub-agent MUST confine ALL file reads and writes to that worktree directory. It MUST
  NOT modify the main working tree.

#### `src/scaffold/templates/.opencode/skills/bdd-workflow-roadmap/SKILL.md` (NEW)

Content covers:
- Roadmap YAML location: `.opencode/roadmap.yaml`
- Full schema: `id`, `title`, `status`, `description`, `depends_on`, `proposal`, `notes`, `acceptance_criteria`
- `acceptance_criteria` is an optional list of strings on the roadmap step, mirroring the
  proposal section — filled in when the roadmap step is created, surfaced at the same
  acceptance gate during execution
- CRUD operations: create, edit steps, validate via `npx bdd-workflow roadmap validate`,
  show via `npx bdd-workflow roadmap show`
- Dependency management: `depends_on` values, `getReadySteps` semantics
- What this skill does NOT cover: executing steps (that is the cycle skill)

#### `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md` — update

- Remove the three-layer model section (now in `bdd-workflow-cycle`)
- Add references to the two new sub-skills
- Update the archive approval gate language to reference the new Acceptance Criteria gate
- Keep the "when to use each step" guidance

#### `src/scaffold/templates/.opencode/skills/bdd-propose/SKILL.md` — update

- Insert Acceptance Criteria as §3 (renumber §3–§5 to §4–§6)
- Warn: "If empty, the agent will ask you to confirm this is intentional during review"

### 5. Rewrite `src/scaffold/templates/.opencode/agents/bdd-workflow.md`

Structure:

```
---
description: >
  The one agent for everything: propose→apply→review→archive cycles (single
  or parallel roadmap steps), roadmap YAML creation and maintenance.
mode: primary
model: github-copilot/claude-sonnet-4.6
temperature: 0.3
---

You are the bdd-workflow agent. I handle everything in this project.

| What you want | What I'll do |
|---|---|
| Build a new feature or fix | Single-change cycle (propose → verify → archive) |
| Run pending roadmap steps | Parallel cycle (propose N → worktrees → verify each → merge) |
| Create or edit the roadmap | Roadmap YAML maintenance |

## How I work

Load `bdd-workflow-cycle` for any cycle work.
Load `bdd-workflow-roadmap` for roadmap YAML work.

## Single-change cycle

[Rules from current bdd-workflow.md: propose, stop, apply, check, review, acceptance
criteria gate, stop before archive, archive only on confirmation]

## Parallel roadmap cycle

[Phase 1 + Phase 2 from current roadmap-runner.md, updated to use worktrees/ not
.worktrees/, with WORKTREE RULE callout]

## Roadmap maintenance

[Rules from current roadmap.md: create/edit roadmap.yaml, validate, show]

## What I do NOT do

- Make design decisions without a proposal
- Skip human approval gates (proposal approval, acceptance criteria, archive)
- Run /build or /plan — those are separate one-shot commands, not part of this workflow
- Modify the main working tree from within a worktree sub-agent session
```

### 6. Add `acceptance_criteria` to roadmap YAML schema

In `src/roadmap/index.ts`, add optional `acceptance_criteria?: string[]` to the
`RoadmapStep` interface. The CLI tooling does not need to validate or display this field —
it is surfaced by the agent skill. No breaking change (optional field).

### 7. Update feature steps for "does not exist" and updated paths

Add a step definition `Then the file {string} does not exist` to
`features/support/steps/` if it does not already exist. Implementation:
`assert(!existsSync(join(projectDir, path)))`.

Update any existing step that asserts `".worktrees/"` in `.gitignore` to assert
`"worktrees/"` instead.

### 8. Build and self-update

```
npm run build
npx bdd-workflow update
```

The prune pass will remove `roadmap.md` and `roadmap-runner.md` from this repo's live
`.opencode/agents/` directory. The new `bdd-workflow.md`, `bdd-workflow-cycle` skill, and
`bdd-workflow-roadmap` skill will be written (or merged if user-modified).

---

## Risks and Considerations

### `roadmap.md` and `roadmap-runner.md` deleted on update

Users who customized either file will see `modifiedByUser (skipped)` — their customized
file is kept. All others have the files deleted and replaced by the merged `bdd-workflow.md`.
The summary output names every pruned file so users see exactly what happened.

### `.worktrees/` → `worktrees/` is a path rename

Any existing worktrees at `.worktrees/` will not be automatically moved. If a user has
active worktrees when they update, they need to move them manually. The prune logic only
touches `.opencode/` framework files — it does not touch `.worktrees/`. Risk is low
because worktrees are transient by design.

### `acceptance_criteria` field on roadmap steps is additive

Optional field on `RoadmapStep`. No existing roadmap YAML breaks. Validation does not
require it. The cycle skill surfaces it if present; falls back to the proposal's
Acceptance Criteria section otherwise.

### Merged agent file length

The combined `bdd-workflow.md` will be long. Mitigated by the routing table at the top
and by the two sub-skills handling most of the detailed instructions. The agent body
itself stays navigational rather than encyclopedic.

### bdd-propose skill section renumbering

The §3 insertion shifts existing §3–§5 to §4–§6. No tests assert on section numbers —
they assert on section headings — so no test breakage expected.

### `/build` and `/plan` are explicitly untouched

These commands are not modified. They remain one-shot and workflow-unaware. The merged
agent explicitly lists them in its "What I do NOT do" section to make the boundary clear.
