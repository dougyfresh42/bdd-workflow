---
date: 2026-04-04
slug: bdd-workflow-agent
status: draft
---

# Proposal: BDD Workflow Agent with Human Approval Gates

## Summary

This proposal introduces a dedicated `bdd-workflow` agent that owns the full workflow orchestration loop, modifies `review` to always produce a review file alongside the proposal, and adds a mandatory human approval gate between `propose` and `apply` (and before `archive`). The current workflow is exposed as raw commands with no conversational wrapper — an agent who speaks naturally about *building* and *planning* feels awkward because those words don't map to the command names. A first-class workflow agent solves this by accepting natural-language goals and running the correct sequence of steps, pausing for human sign-off at the right moments. The ancillary changes (review file, archive gate) tighten safety: a rogue agent can no longer silently run propose → apply → review → amend → archive in one shot without the user ever seeing a diff.

All changes are made exclusively to the scaffold templates in `src/scaffold/templates/`. The live `.opencode/` files in this repository are **not modified directly** — they are updated by running `npx bdd-workflow update` after the scaffold changes are applied, which verifies the update machinery works correctly end-to-end.

**User-visible impact:**
- A new `/bdd-workflow` agent command accepts natural-language goals and orchestrates the workflow.
- `/propose` and `/apply` remain available standalone but are now more "default" in their phrasing.
- `/review` always writes a dated review file to `.opencode/proposals/` alongside the proposal.
- `/archive` requires an explicit `--approved` flag (or equivalent human confirmation) before committing.
- The `bdd-workflow` agent pauses after `propose` and waits for human approval before proceeding to `apply`; it also pauses before `archive`.

---

## Doc Updates (WHY)

All doc updates are in scaffold template files only. The live `.opencode/` files in this repo are updated via `npx bdd-workflow update` after the scaffold is changed.

### `src/scaffold/templates/.opencode/agents/bdd-workflow.md` (new file)

```markdown
---
description: Orchestrates the full BDD workflow — propose, apply, review, amend, archive
mode: subagent
model: github-copilot/claude-sonnet-4.6
temperature: 0.3
---

You are the bdd-workflow agent. You drive the full BDD development loop for this project.

You accept natural-language goals and translate them into the correct sequence of workflow
steps: propose → [human approval] → apply → review → amend? → [human approval] → archive.

Responsible for: sequencing steps, surfacing proposals and reviews to the human for
approval, and running multi-step chains when the user explicitly requests them
(e.g. "apply then review then amend if needed").

Does NOT: make design decisions without a proposal, skip human approval gates, or run
archive without explicit user confirmation.

## Workflow Rules

1. If given a new goal, load the `bdd-workflow` skill and run `/propose <goal>`.
   Then STOP — print the proposal path and ask the user to review and approve before continuing.

2. When the user approves, run `/apply`. After apply, always run `/review`.

3. If the review verdict is AMEND, run `/amend` then re-run `/review`. Repeat until APPROVE or REJECT.

4. After an APPROVE verdict, STOP — print the review file path and ask the user for explicit
   confirmation before archiving. Do not pass --approved without the user saying so.

5. When the user confirms, run `/archive --approved`.

## Multi-step Chains

If the user explicitly requests a chain (e.g. "apply, review, and amend if needed"), run
those steps in sequence. Always stop before archive regardless of what the user requested
in the chain — archive requires its own explicit confirmation.
```

### `src/scaffold/templates/.opencode/commands/bdd-workflow.md` (new file)

```markdown
---
description: Run the BDD workflow agent for a goal or continuation
agent: bdd-workflow
model: github-copilot/claude-sonnet-4.6
---

$ARGUMENTS
```

### `src/scaffold/templates/.opencode/commands/review.md` (updated)

The description frontmatter is updated to mention the review file output. The body gains one instruction: after producing the review, write it to `.opencode/proposals/<proposal-basename>-review.md` using the review template.

### `src/scaffold/templates/.opencode/commands/archive.md` (updated)

A guard is added at the top of the body: if `$ARGUMENTS` does not contain `--approved`, print the approval-required message and stop without committing.

### `src/scaffold/templates/.opencode/agents/review.md` (updated)

`permission.edit` is changed from `deny` to allow writes matching `.opencode/proposals/*-review.md`. All other permissions unchanged.

### `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md` (updated)

The "When to Use Each Step" section gains three bullets:
- The human approval gate between propose and apply.
- That review always produces a `*-review.md` file.
- That archive requires `--approved` or explicit agent confirmation.

---

## BDD Specs (WHAT)

Scaffold content is markdown — hardcoding "contains text" assertions against it is brittle and will fail every time the template is legitimately edited. The right thing to test is that the scaffold provisions the correct files. Content is human-readable and verified by inspection.

The existing `scaffold-phase2.feature` already asserts that the existing agent, command, and skill files exist after `init`. This proposal adds one new feature file to cover the new files introduced.

### `features/scaffold-bdd-workflow-agent.feature`

```gherkin
Feature: BDD workflow agent provisioned by scaffold

  Scenario: bdd-workflow agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/bdd-workflow.md" exists

  Scenario: bdd-workflow command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/bdd-workflow.md" exists
```

---

## Implementation Plan (HOW)

All file creation and modification is in `src/scaffold/templates/`. After implementation, run `npx bdd-workflow update` in this repo to propagate the new scaffold content into the live `.opencode/` files — this both updates the repo's own tooling and serves as the integration test that the scaffold and update machinery work correctly.

### Files to Create

- `src/scaffold/templates/.opencode/agents/bdd-workflow.md` — Agent persona file. Frontmatter: `description`, `mode: subagent`, `model: github-copilot/claude-sonnet-4.6`, `temperature: 0.3`. Body contains the full workflow orchestration instructions (see Doc Updates for exact content).

- `src/scaffold/templates/.opencode/commands/bdd-workflow.md` — Thin slash-command entry point. Frontmatter: `description`, `agent: bdd-workflow`, `model: github-copilot/claude-sonnet-4.6`. Body: `$ARGUMENTS` (passes user input straight to the agent).

- `features/scaffold-bdd-workflow-agent.feature` — File existence assertions for the two new scaffold files (agent and command). No content assertions.

### Files to Modify

- `src/scaffold/templates/.opencode/commands/review.md` — Update the body to instruct the review agent to write a review file after producing its verdict. The instruction should tell the agent to derive the output filename from the proposal filename: `<basename>-review.md` in `.opencode/proposals/`. The file uses `.opencode/templates/review.md` as its structure.

- `src/scaffold/templates/.opencode/commands/archive.md` — Add a guard block at the top of the body: if `$ARGUMENTS` does not contain `--approved`, print `"Archive requires explicit human approval. Re-run with --approved or confirm via the bdd-workflow agent."` and stop. If `--approved` is present, proceed. Also update step 4 to move both the proposal file and its paired `*-review.md` file (if one exists) to `completed/`.

- `src/scaffold/templates/.opencode/agents/review.md` — Change `permission.edit` from `deny` to allow writes matching the glob `.opencode/proposals/*-review.md`. This is the minimal permission needed for the review agent to write its output file. All bash permissions unchanged.

- `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md` — Add three bullets to the "When to Use Each Step" section:
  - Under `propose`: note that the bdd-workflow agent pauses here and waits for human approval before apply.
  - Under `review`: note that review always writes a `*-review.md` file alongside the proposal.
  - Under `archive`: note that archive requires `--approved` or explicit confirmation via the bdd-workflow agent.

### Approach

**Agent file body:**
The agent instruction body is written as imperative rules (numbered list), not as prose. This is important because the agent will read these instructions at runtime and must follow them precisely. The approval-gate logic is encoded as explicit STOPs in the numbered steps, not as conditional prose that could be misread.

**Review file naming:**
The review command already surfaces the proposal filename via `!ls -t .opencode/proposals/*.md 2>/dev/null | head -1`. The review agent can derive the output filename by stripping `.md` from the proposal basename and appending `-review.md`. This requires no new tooling.

**Archive `--approved` guard:**
The archive command body checks `$ARGUMENTS` for the literal string `--approved`. The bdd-workflow agent instruction explicitly states it must not pass `--approved` autonomously. This is an instructional/social control, not a technical one, which is appropriate for agent-facing commands.

**`npx bdd-workflow update` as verification:**
After applying this proposal, running `npx bdd-workflow update` in this repo should:
1. Add the new `agents/bdd-workflow.md` and `commands/bdd-workflow.md` (reported as "added").
2. Update `commands/review.md`, `commands/archive.md`, `agents/review.md`, `skills/bdd-workflow/SKILL.md` (reported as "updated" or "merged" if model was customised).

This output is the manual integration test confirming the scaffold changes are wired up correctly.

### Alternatives Considered

- **Modifying live `.opencode/` files directly:** Rejected. This repo uses its own scaffold as its source of truth. Editing live files directly would create a split-brain situation where the repo's own tooling diverges from what `init` provisions. The correct flow is scaffold-first, then update.
- **Gate apply with `--approved` instead of archive:** Apply modifies source files but is reversible with `git checkout`. Archive (commit) is the irreversible step that signals "done". The gate belongs at archive.
- **Separate `reviews/` directory for review files:** Rejected. Co-location in `.opencode/proposals/` makes the proposal/review pair obvious from filenames and ensures they archive together.

---

## Risks and Considerations

- **Existing projects:** Projects that have already run `init` will get the updated scaffold files on their next `npx bdd-workflow update` run. The `--approved` gate in `archive` is a breaking change in behaviour: any script or agent that calls `/archive` without `--approved` will now be refused. This should be noted in the changelog.

- **Review agent write permission:** Expanding the review agent's `permission.edit` from `deny` to allow writes matching `.opencode/proposals/*-review.md` is a deliberate, minimal change. The glob must be precise enough to prevent source-file writes. Bash permissions remain unchanged (read-only commands only).

- **`npx bdd-workflow update` output as verification:** After apply, running `update` should report the new/changed files. If it reports "identical" for files that should have changed, the manifest hash was not refreshed correctly. If it reports "modified by user (skipped)" for this repo's own `.opencode/` files, that means someone customised the body of those files locally — `--force` would be needed, or the file can be reset first.

- **Multi-step chains:** The agent instruction must be written carefully so that a user saying "apply and archive" is not treated as approval of archive. The instruction explicitly states archive requires its own confirmation step, separate from any chain request.

- **Step definitions for the new feature file:** The two existence scenarios use `the file "X" exists`, which is already defined in `scaffold-phase2.steps.ts`. No new step definitions are required.
