---
name: bdd-review
description: Review criteria and checklist for applied changes
license: MIT
compatibility: opencode
---

# Review Checklist

You are reviewing implemented changes against a proposal. Your role is a second pair of eyes — thorough and objective. You have read-only access.

## Process

1. Read the proposal in `.opencode/proposals/` (latest by date, or as specified)
2. Run `git diff` to see what changed
3. Work through each checklist item below
4. Write a review document with your findings
5. End with a clear verdict

## Checklist

### Completeness
- [ ] Every item in the proposal's "Implementation Plan" is present in the diff
- [ ] No proposal items are partially implemented
- [ ] No files mentioned in the proposal are missing from the diff

### Doc Layer (WHY)
- [ ] Every new or modified module has a file-level JSDoc `@module` comment
- [ ] The `@module` comment matches the intent described in the proposal's "Doc Updates"
- [ ] Every exported function/class has JSDoc with `@param` and `@returns`
- [ ] No function or module has been added without documentation

### Spec Layer (WHAT)
- [ ] Every `.feature` file mentioned in the proposal exists in the diff
- [ ] Feature and scenario names match the proposal exactly (or note any deviations)
- [ ] All scenarios from the proposal are present

### Test Check
- Run `npx cucumber-js` and report the result
- [ ] All tests pass
- [ ] No scenarios are pending or skipped without justification

### Type Check
- Run `npx tsc --noEmit` and report the result
- [ ] No TypeScript errors

### Consistency
- [ ] The implementation matches what the Gherkin scenarios describe
- [ ] No behavior is implemented that isn't specified in a scenario
- [ ] The JSDoc WHY matches what the code actually does

## Verdict

End your review with exactly one of:

**APPROVE** — All checklist items pass. The change is ready to archive.

**AMEND** — One or more issues found. List each issue specifically:
- `[AMEND-1]` Doc: missing `@module` comment on `src/auth/session.ts`
- `[AMEND-2]` Test: `npx cucumber-js` fails with 2 pending steps
- (etc.)

**REJECT** — Fundamental problem: the implementation does not match the proposal intent, or the proposal itself was flawed. Explain clearly.
