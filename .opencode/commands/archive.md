---
description: Commit, archive the proposal, and regenerate context
model: github-copilot/claude-haiku-4.5
---

Load the `bdd-workflow` skill.

Archive the completed change:

1. Determine the commit message from the proposal summary (conventional commit format: `feat:`, `fix:`, `refactor:`, etc.)
   Proposal: !`ls -t .opencode/proposals/*.md 2>/dev/null | head -1`

2. Stage all changes: `git add -A`

3. Commit with the derived message

4. Move the proposal file to `.opencode/proposals/completed/` and append outcome metadata:
   ```
   ## Outcome
   - Archived: [today's date]
   - Verdict: APPROVE
   - Commit: [commit hash]
   ```

5. Print a summary of what was done.

Additional message (if any): $ARGUMENTS
