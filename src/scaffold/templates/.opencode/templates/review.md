---
date: YYYY-MM-DD
proposal: path/to/proposal.md
verdict: APPROVE | AMEND | REJECT
---

# Review: [Proposal Title]

## Completeness
[Were all proposal items implemented?]

## Doc Layer (WHY)
[Are JSDoc comments present and matching the proposal?]

## Spec Layer (WHAT)
[Are .feature files present and matching the proposal?]

## Test Results
```
[paste npx cucumber-js output]
```

## Type Check
```
[paste npx tsc --noEmit output]
```

## Consistency
[Does the implementation match the specs? Are there any behaviors not covered by scenarios?]

## Issues

[If AMEND: list each issue with an AMEND tag]
- `[AMEND-1]` ...
- `[AMEND-2]` ...

## Verdict

**[APPROVE | AMEND | REJECT]**

[Explanation]
