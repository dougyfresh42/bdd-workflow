---
name: bdd-workflow-cycle
description: The full BDD development cycle — propose, apply, review, acceptance criteria gate, archive
license: MIT
compatibility: opencode
---

# BDD Workflow Cycle

This skill covers the end-to-end development loop for a single change or a parallel batch of
roadmap steps.

## Three-Layer Model

Every change produces three artifacts that must be written together:

- **WHY**: JSDoc comments on every new/modified module and function
- **WHAT**: Gherkin `.feature` files describing observable behavior
- **HOW**: Implementation code

No change is complete unless all three layers are present and consistent.

## Full Cycle Sequence

```
propose → [human approval] → apply → check → review → amend? → [acceptance criteria gate] → archive/merge
```

### 1. Propose

Run `/propose <goal>`. The proposal is written to `.opencode/proposals/`.

**STOP after propose.** Print the proposal path and ask the user to review and approve.
Do not proceed until the user responds affirmatively.

### 2. Apply

After human approval, run `/apply`. Implement all three layers (WHY/WHAT/HOW) as specified
in the proposal. Do not make design decisions not covered in the proposal.

### 3. Check

After apply, run `npx bdd-workflow check`. This runs type-check and Cucumber tests.

If check fails, fix the failures — this is still part of the apply phase, not amend.
Do not hand off to review until check is green.

### 4. Review

Run `/review`. The review agent writes a `*-review.md` file alongside the proposal.

### 5. Amend (if needed)

If the review verdict is **AMEND**, run `/amend` to address the review's findings.
After amend, run `npx bdd-workflow check` again before re-running `/review`.
Repeat until the verdict is **APPROVE** or **REJECT**.

### 6. Acceptance Criteria Gate

After the review verdict is **APPROVE**:

1. Read the `## Acceptance Criteria` section from the proposal.
2. Print the criteria verbatim.
3. If the section is **empty** or says "no user-facing artifact":
   - Print a warning: "⚠️ This proposal has no Acceptance Criteria. Confirm this is intentional before archiving."
   - STOP and wait for explicit user confirmation.
4. Otherwise:
   - Say: "Please verify these criteria manually on branch `<branch>`, then reply to proceed."
   - STOP and wait for explicit user confirmation.
5. Only after the user confirms: proceed to archive or merge.

**Never skip this gate.** An APPROVE verdict is permission to ask, not an instruction to archive.

### 7. Archive / Merge

- **Single-change cycle**: run `/archive --approved` after user confirmation.
- **Roadmap parallel cycle**: merge via `git merge --squash roadmap/<step-id>` after user confirmation.

---

## Parallel Roadmap Cycle

When executing multiple roadmap steps concurrently, the same sequence applies to each step,
but steps run in separate worktrees under `worktrees/<step-id>/`.

### Phase 1 — Proposals (on main)

1. Read the roadmap: `npx bdd-workflow roadmap show`
2. Identify ready steps (status `pending`, all `depends_on` are `done`).
3. For each ready step, run `/propose <step title + description>` on main.
4. Link each proposal: `npx bdd-workflow roadmap link <step-id> <proposal-file>`
5. Present all proposals as a numbered list.
6. **STOP.** Ask the user: "Which proposals do you approve? (all / list of numbers / none)"

### Phase 2 — Execution (in worktrees, parallel)

1. For each approved step, create a worktree:
   `npx bdd-workflow roadmap worktree <step-id>`
   This creates `worktrees/<step-id>/` and copies the proposal in.
2. Update each step's status to `in-progress`.
3. For each worktree (in parallel where steps are independent):
   - Work in `worktrees/<step-id>/`
   - Run `/apply`, then `npx bdd-workflow check`, then `/review`.
   - If AMEND, run `/amend` and re-review.
   - After APPROVE: run the Acceptance Criteria Gate above.
4. After all worktrees reach APPROVE and criteria are confirmed by the user:
   - For each confirmed step:
     - `git rebase main` from within the worktree
     - If conflicts: resolve them (the sub-agent has full context; only escalate to human if irresolvable)
     - `git checkout main && git merge --squash roadmap/<step-id>`
     - `git commit -m "feat(<step-id>): <step title>"`
     - Update step status to `done`
     - `git worktree remove worktrees/<step-id>`
5. Print updated roadmap: `npx bdd-workflow roadmap show`
6. Check if new steps are now ready. If so: "N new steps are now ready. Run another cycle?"

---

## WORKTREE RULE

> **When running inside a worktree (`worktrees/<step-id>/`), ALL file reads and writes
> MUST be confined to that worktree directory. NEVER modify the main working tree.**

This rule applies to every sub-agent session dispatched into a worktree.
