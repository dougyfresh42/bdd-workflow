---
name: bdd-workflow
description: Guides the complete BDD development workflow for this project
license: MIT
compatibility: opencode
---

# BDD Workflow

This project uses the bdd-workflow framework. Every change must follow this sequence:

**explore (optional) → propose → apply → review → amend (optional) → [acceptance criteria gate] → archive**

## Sub-skills

- **`bdd-workflow-cycle`** — Full cycle detail: three-layer model, propose/apply/check/review/amend
  sequence, acceptance criteria gate, single-change and parallel roadmap execution, WORKTREE RULE.
- **`bdd-workflow-roadmap`** — Roadmap YAML schema, CRUD operations, dependency management.

Load the relevant sub-skill when you need the detailed instructions for that area.

## Key Files

- `CONTEXT.md` — Auto-generated codebase summary. Always read this before proposing. Do not explore the codebase manually if CONTEXT.md is sufficient.
- `.opencode/proposals/` — Active proposals (timestamped markdown files)
- `.opencode/proposals/completed/` — Archived proposals
- `.opencode/learnings/` — Meta-feedback entries for improving the framework

## When to Use Each Step

- **explore**: Only if CONTEXT.md doesn't give you enough to write a proposal
- **propose**: Always — never implement without a proposal. The bdd-workflow agent pauses after propose and waits for explicit human approval before running apply.
- **apply**: Only after a proposal exists and has been reviewed by the user. Before handing off to review, **run `npx bdd-workflow check` and confirm it passes.** Do not proceed to review if it fails — fix the failures first (that is still part of apply, not amend).
- **review**: Always after apply — never skip. Review always writes a `*-review.md` file alongside the proposal in `.opencode/proposals/`.
- **amend**: When review verdict is AMEND. After making fixes, **run `npx bdd-workflow check` and confirm it passes before re-running review.** A failing check after amend means the amend is not complete — do not hand off to review until green.
- **learn**: When implementation diverged from proposal, or the workflow caused friction
- **archive**: When review verdict is APPROVE. **STOP after printing the APPROVE verdict and the review file path.** Run the Acceptance Criteria Gate (see `bdd-workflow-cycle`). Only after explicit user confirmation: run `/archive --approved`. An APPROVE verdict is permission, not a request.

## Model Guidance

Use fast/cheap models for explore and archive. Use strong models for propose, apply, and review.
See `bdd-workflow.config.ts` for configured model assignments.
