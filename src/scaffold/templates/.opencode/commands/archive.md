---
description: Commit, archive the proposal, and regenerate context
model: anthropic/claude-haiku-4-5
---

Load the `bdd-workflow` skill.

**Guard:** If this skill was not explicitly run and approved by a human stop and print the following message.

> Archive requires explicit human approval. Confirm via the bdd-workflow agent.

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
   Also move the paired `*-review.md` file (if one exists alongside the proposal) to `.opencode/proposals/completed/`.

5. Regenerate project artifacts:
   - Run `npx bdd-workflow context` to update `CONTEXT.md`
   - Run `npx bdd-workflow specs` to update `SPECS.md`

6. Print a summary of what was done.

Additional message (if any): $ARGUMENTS
