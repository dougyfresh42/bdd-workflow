---
description: 'Capture a workflow learning or feedback. Usage: /learn [feedback text]'
model: github-copilot/claude-sonnet-4.6
---

Load the `bdd-workflow` skill.

Capture a learning from the current or most recent workflow cycle.

Context:
- Original proposal: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -1`
- User feedback (if any): $ARGUMENTS

Analyze:
1. How did the final implementation differ from the proposal?
2. Did the workflow cause friction? Where?
3. What specific change to the `bdd-workflow` framework (skills, templates, workflow steps) would prevent this friction?

Write a learning entry to `.opencode/learnings/YYYY-MM-DD-slug.md` using today's date: !`date +%Y-%m-%d`

Use the template at `.opencode/templates/learning.md`.
