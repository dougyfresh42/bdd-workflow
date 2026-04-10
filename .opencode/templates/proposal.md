---
date: YYYY-MM-DD
slug: short-description
status: draft
---

# Proposal: [Title]

## Summary

[One paragraph: what is being changed and why. Include the user-visible impact.]

## Acceptance Criteria

<!-- One or more concrete, human-verifiable statements. Examples:
  - Run `npm start`; visiting http://localhost:3000 serves an HTML page.
  - `npx my-cli --help` prints usage and exits 0.
  - No user-facing artifact — acceptance is automated test passage.
-->

## Doc Updates (WHY)

[List every JSDoc comment to add or modify. Include exact text.]

### `src/path/to/file.ts`

```typescript
/**
 * @module path/to/file
 * @description [Module purpose and scope]
 */
```

[Repeat for each file]

## BDD Specs (WHAT)

[List every .feature file to create or modify. Include full Gherkin content.]

### `features/name.feature`

```gherkin
Feature: [Capability name]

  Background:
    Given [shared precondition]

  Scenario: [Behavior description]
    Given [context]
    When [action]
    Then [observable outcome]
```

## Implementation Plan (HOW)

### Files to Create
- `src/path/new-file.ts` — [Purpose]

### Files to Modify
- `src/path/existing.ts` — [What changes and why]

### Approach
[Describe the implementation approach. Note key design decisions and why they were made.]

### Alternatives Considered
[Optional: what else was considered and why it was rejected]

## Risks and Considerations

- [Breaking changes, dependencies, edge cases, performance implications]
