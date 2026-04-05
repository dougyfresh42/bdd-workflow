---
name: bdd-workflow
description: Guides the complete BDD development workflow for this project
license: MIT
compatibility: opencode
---

# BDD Workflow

This project uses the bdd-workflow framework. Every change must follow this sequence:

**explore (optional) → propose → apply → review → amend (optional) → learn (optional) → archive**

## Three-Layer Model

Every change produces three artifacts:
- **WHY**: JSDoc comments on every new/modified module and function
- **WHAT**: Gherkin `.feature` files describing behavior
- **HOW**: Implementation code

No change is complete unless all three layers are present and consistent.

## Key Files

- `CONTEXT.md` — Auto-generated codebase summary. Always read this before proposing. Do not explore the codebase manually if CONTEXT.md is sufficient.
- `.opencode/proposals/` — Active proposals (timestamped markdown files)
- `.opencode/proposals/completed/` — Archived proposals
- `.opencode/learnings/` — Meta-feedback entries for improving the framework

## When to Use Each Step

- **explore**: Only if CONTEXT.md doesn't give you enough to write a proposal
- **propose**: Always — never implement without a proposal. The bdd-workflow agent pauses after propose and waits for explicit human approval before running apply.
- **apply**: Only after a proposal exists and has been reviewed by the user
- **review**: Always after apply — never skip. Review always writes a `*-review.md` file alongside the proposal in `.opencode/proposals/`.
- **amend**: When review verdict is AMEND
- **learn**: When implementation diverged from proposal, or the workflow caused friction
- **archive**: When review verdict is APPROVE. Archive requires `--approved` flag or explicit confirmation via the bdd-workflow agent — it will not proceed without it.

## Model Guidance

Use fast/cheap models for explore and archive. Use strong models for propose, apply, and review.
See `bdd-workflow.config.ts` for configured model assignments.
