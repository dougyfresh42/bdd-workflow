---
description: Show, status, validate, link, or worktree roadmap steps via CLI
model: anthropic/claude-haiku-4-5
---

Load the `bdd-workflow` skill.

Run the following roadmap CLI command based on $ARGUMENTS:

- If $ARGUMENTS is empty or "show": run `npx bdd-workflow roadmap show`
- If $ARGUMENTS is "status": run `npx bdd-workflow roadmap status`
- If $ARGUMENTS is "validate": run `npx bdd-workflow roadmap validate`
- If $ARGUMENTS starts with "link": run `npx bdd-workflow roadmap link $ARGUMENTS`
- If $ARGUMENTS starts with "worktree": run `npx bdd-workflow roadmap worktree $ARGUMENTS`

Print the output. If the command fails, print the error and suggest corrective action.
