---
name: bdd-propose
description: Instructions for writing a complete BDD workflow proposal
license: MIT
compatibility: opencode
---

# Writing a Proposal

A proposal is a complete specification of a change. It must be written BEFORE any code is changed.

## Required Sections

### 1. Summary
- One paragraph: what is being changed and why
- List the user-visible impact (even if internal: "no user-visible change")

### 2. Doc Updates (the WHY layer)
List every JSDoc comment that needs to be added or modified. Include the exact text.

For new modules, the file-level `@module` comment must describe:
- What the module is responsible for
- Why it exists (what problem it solves)
- What it does NOT do (scope boundaries)

For functions, include `@param`, `@returns`, and `@throws` tags as appropriate.

Example:
```typescript
/**
 * @module auth/session
 * @description Manages user session lifecycle. Responsible for creating sessions
 * on successful authentication, validating session tokens on each request, and
 * expiring sessions after the configured timeout. Does NOT handle password
 * verification — see auth/credentials.
 */
```

### 3. Acceptance Criteria
One or more concrete, human-verifiable statements describing the user-facing end goal.
Each criterion must be something a person can check by running or interacting with the
result — not a restatement of implementation details.

Examples:
- "Run `npm start`; visiting `http://localhost:3000` serves an HTML page."
- "Running `npx my-cli --help` prints usage text and exits 0."
- "Calling `processOrder({ id: 1 })` returns `{ status: 'ok' }` given a seeded DB."

If the change has no user-facing artifact (e.g. a pure refactor or internal tooling
fix), write: "No user-facing artifact — acceptance is automated test passage." The
agent will surface this during review and ask the author to confirm it is intentional.

**If this section is empty**, the agent will warn you and ask you to confirm that is
intentional before proceeding to archive.

### 4. BDD Specs (the WHAT layer)
List every `.feature` file to create or modify. Include the full Gherkin content.

Rules for good Gherkin:
- Feature name describes a capability, not a function name
- Scenario names are full sentences in present tense
- Steps describe observable behavior, not implementation details
- Use `Background:` for shared preconditions within a feature
- Use tags (`@smoke`, `@regression`) to categorize

A scenario should be implementable by reading it with no other context.

### 5. Implementation Plan (the HOW layer)
- List files to create and files to modify
- Describe the approach without writing the code
- Note any design decisions and why they were made
- Note any alternatives considered and why rejected

### 6. Risks and Considerations
- Breaking changes (API, behavior, database)
- Dependencies on other proposals or external systems
- Edge cases that need explicit handling
- Performance implications

## Proposal File Naming

`YYYY-MM-DD-short-slug.md` — use today's date and a 3-5 word slug.
Save to `.opencode/proposals/`.

## What Makes a Good Proposal

A good proposal is complete enough that a different agent could implement it correctly without asking questions. If the apply agent needs to make a design decision not covered in the proposal, the proposal is incomplete.
