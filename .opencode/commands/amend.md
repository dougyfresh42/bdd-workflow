---
description: Revise implementation based on review feedback
model: github-copilot/claude-sonnet-4.6
---

Load the `bdd-workflow` skill.

The review has requested amendments. The review feedback is in the most recent review output.
The original proposal is: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -1`

Address each AMEND item from the review. After fixing, verify:
- `npx tsc --noEmit` passes
- `npx cucumber-js` passes

Note what you changed for each AMEND item.
