---
description: Review applied changes against the proposal
agent: review
---

Load the `bdd-workflow` skill, then load the `bdd-review` skill.

Review the most recently applied proposal. The proposal is: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -1`

Follow the review checklist from the `bdd-review` skill. Run the tests and type checker. Produce a thorough review document and end with a clear verdict (APPROVE, AMEND, or REJECT).
