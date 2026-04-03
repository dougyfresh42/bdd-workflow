---
description: Draft a proposal for a new change
model: anthropic/claude-sonnet-4-5
---

Load the `bdd-workflow` skill, then load the `bdd-propose` skill.

Read `CONTEXT.md` to understand the current state of the project.

Draft a proposal for the following goal: $ARGUMENTS

Save the proposal to `.opencode/proposals/` using the naming format `YYYY-MM-DD-short-slug.md` where today's date is: !`date +%Y-%m-%d`

After saving, print the proposal file path and a brief summary.
