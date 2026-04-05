---
description: Commit, archive the proposal, and regenerate context
model: anthropic/claude-haiku-4-5
---

Load the `bdd-workflow` skill.

**Guard:** If `$ARGUMENTS` does not contain `--approved`, print the following message and stop — do not proceed further:

> Archive requires explicit human approval. Re-run with --approved or confirm via the bdd-workflow agent.

If `--approved` is present, proceed:

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

5. Print a summary of what was done.

Additional message (if any): $ARGUMENTS
