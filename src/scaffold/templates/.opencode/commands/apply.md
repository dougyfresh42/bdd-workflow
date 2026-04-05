---
description: "Implement the latest proposal (or specify: /apply 2026-04-02-slug)"
model: anthropic/claude-sonnet-4-5
---

Load the `bdd-workflow` skill.

Find the proposal to apply:
- If $ARGUMENTS is given, look for `.opencode/proposals/$ARGUMENTS.md` or the closest match
- Otherwise, use the most recently created file in `.opencode/proposals/` (excluding `completed/`)

Current proposals: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -5`

Read the proposal completely. Then implement it:
1. Create or modify all files listed in the Implementation Plan
2. Add all JSDoc comments from the Doc Updates section exactly as specified
3. Create or modify all `.feature` files from the BDD Specs section
4. Create step definitions for any new Gherkin steps
5. Run `npx bdd-workflow check`. If it fails, fix the failures now — do not hand off
   to review with a failing check. Failures at this stage are still part of apply, not
   amend.

Do not make design decisions not covered in the proposal. If you encounter an ambiguity, note it in a comment and choose the most conservative interpretation.
