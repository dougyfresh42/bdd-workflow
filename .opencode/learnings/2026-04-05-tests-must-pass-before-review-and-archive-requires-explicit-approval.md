---
date: 2026-04-05
proposal: .opencode/proposals/completed/2026-04-05-phase-3-context-generation.md
promoted: false
---

# Learning: Tests Must Pass Before Review; Archive Requires Explicit Human Approval

## What Happened

Two process failures occurred during the Phase 3 context-generation workflow cycle:

**1. Archive without explicit human approval.**
After the review returned an APPROVE verdict, the bdd-workflow agent proceeded to run
`/archive` in the same turn — moving proposal files, regenerating CONTEXT.md, and
committing — without pausing to ask the user for confirmation. The bdd-workflow skill
says "Archive requires `--approved` flag or explicit confirmation via the bdd-workflow
agent", but the agent treated the APPROVE verdict as implicit permission and continued
without stopping.

**2. Three review rounds, caused by test failures at review time.**
The review cycle ran three times (AMEND → AMEND → APPROVE). The first two AMENDs were
caused by bugs that a passing test suite would have caught:
- Round 1: Duplicate `Given`/`When` step registration — ambiguous match on 9 scenarios
- Round 2: `parseJsDocDescription` silently dropped `@description` values; Cucumber
  Expression parentheses made a `Then` step undefined

Both bugs were test failures, not logic errors that tests couldn't catch. The apply
step sent code to review before confirming the tests passed. The amend step had the
same problem — it made fixes and immediately handed off to review without re-running
the suite.

## Root Cause

**For archive without approval:** The bdd-workflow skill states that archive requires
explicit confirmation, but it does not explicitly say "stop and ask the user" after an
APPROVE verdict. The agent interpreted "APPROVE verdict → archive is permitted" as
"APPROVE verdict → proceed to archive immediately." The distinction between _permitted_
and _requested_ was not enforced by the skill's wording.

**For premature review:** The apply and amend steps had no explicit gate requiring
`npx tsc --noEmit` and `npx cucumber-js` to pass before handing off to review. The
skill says "review: Always after apply — never skip" but says nothing about a
pre-review test-pass requirement. The apply agent treated "run tests" as optional
hygiene rather than a hard prerequisite.

## Proposed Framework Change

### Change 1 — Archive gate: make the stop-and-ask rule explicit

**Target File:** `.opencode/skills/bdd-workflow/SKILL.md`

**Proposed Change:** In the "When to Use Each Step" section, replace:

> - **archive**: When review verdict is APPROVE. Archive requires `--approved` flag or
>   explicit confirmation via the bdd-workflow agent — it will not proceed without it.

With:

> - **archive**: When review verdict is APPROVE. **STOP after printing the APPROVE
>   verdict and the review file path. Do NOT proceed to archive.** Wait for the user to
>   explicitly say to archive (e.g. "archive", "yes, archive it", "go ahead"). Only
>   then run `/archive --approved`. An APPROVE verdict is permission, not a request.

Also update the bdd-workflow agent system prompt (the "Workflow Rules" block) to
re-state rule 4 more forcefully:

> 4. After an APPROVE verdict, **STOP immediately** — print the review file path and
>    explicitly ask the user: "The review is APPROVE. Shall I archive?" Do not run
>    `/archive` until the user responds affirmatively. An APPROVE verdict is permission,
>    not an instruction.

---

### Change 2 — Pre-review test gate: apply and amend must verify tests pass

**Target File:** `.opencode/skills/bdd-workflow/SKILL.md`

**Proposed Change:** In the "When to Use Each Step" section, add a required sub-step
to the `apply` and `amend` entries:

> - **apply**: Only after a proposal exists and has been reviewed by the user. Before
>   handing off to review, **run `npx tsc --noEmit` and `npx cucumber-js` (or the
>   project's configured test command) and confirm both pass.** Do not proceed to review
>   if either fails — fix the failures first (that is still part of apply, not amend).

> - **amend**: When review verdict is AMEND. After making fixes, **run `npx tsc
>   --noEmit` and `npx cucumber-js` and confirm both pass before re-running review.**
>   A failed test suite after amend means the amend is not complete — do not hand off
>   to review until green.

This makes the test gate a first-class workflow step, not an implied courtesy.

## Impact

**Change 1** prevents the agent from silently archiving work that the human has not yet
explicitly approved. It protects against accidental commits and irreversible file moves
when the user may still want to inspect or discuss the outcome.

**Change 2** eliminates redundant review rounds caused by test failures. If tests must
pass before review, any bug the test suite can catch is caught during apply/amend rather
than discovered by the reviewer. Review rounds are reserved for genuine correctness,
completeness, or design issues — not mechanical test failures. This makes the review
step more meaningful and reduces total cycle time.

Both changes benefit any workflow cycle, not just large feature implementations. They
are especially valuable for cycles with integration-level BDD tests (slow to run),
where catching failures early avoids the overhead of a full review pass followed by an
amend pass.
