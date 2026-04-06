---
description: "Capture a workflow learning or feedback. Usage: /learn [feedback text]"
model: anthropic/claude-sonnet-4-5
---

Load the `bdd-workflow` skill.

Capture a learning from the current or most recent workflow cycle.

Context:
- Proposals directory: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -3`
- Existing learnings: !`ls .opencode/learnings/*.md 2>/dev/null | wc -l` existing entries

User feedback (if provided): $ARGUMENTS

Analyze the workflow cycle:
1. How did the final implementation differ from the proposal?
2. Did the review require multiple amendment rounds? If so, why?
3. What was unclear, missing, or wrong in the framework that caused friction?
4. What specific change to which skill, command, or template would prevent this?

Create a learning entry at `.opencode/learnings/YYYY-MM-DD-slug.md` where today's date is: !`date +%Y-%m-%d`

Use the template at `.opencode/templates/learning.md`. The entry must include all required sections:
- What Happened
- Root Cause
- Proposed Framework Change (with Target File and Proposed Change subsections)
- Impact

After saving, print the file path and the one-sentence summary of the proposed change.
