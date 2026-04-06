---
title: "Phase 6 — Polish: Production-readiness for bdd-workflow"
date: 2026-04-06
status: proposed
---

# Phase 6 — Polish: Production-readiness for bdd-workflow

## Summary

This proposal covers the Phase 6 deliverables for the `bdd-workflow` package: config validation, comprehensive error handling, updated `package.json` scripts, a README, full BDD test coverage, and npm publishing configuration.

The goal is to make `bdd-workflow` production-ready and self-hosting — meaning the framework itself is developed using the bdd-workflow. By end of this phase `npm run check:all` passes and the package is ready for `npm publish`.

The utility OpenCode commands (`/lint`, `/lint-docs`, `/test`, `/build`, `/build-all`) and the `general` subagent are **out of scope** — the commands are shell-runner wrappers that don't make sense as AI commands, and the subagent is an OpenCode configuration concern, not a scaffold concern.

**User-visible impact:**
- Config errors are reported clearly with actionable messages instead of silent fallback to defaults
- All CLI commands fail gracefully with human-readable errors (no unhandled rejections)
- The bdd-workflow scaffold `package.json` has a richer set of npm scripts
- A README.md documents the full package for new users
- `npx bdd-workflow --version` prints the correct version

---

## Doc Updates (WHY Layer)

### `src/config.ts` — update file-level JSDoc and add new exports

Update the file-level comment to mention `validateConfig`:

```typescript
/**
 * Configuration types, defineConfig function, loadConfig loader, and
 * validateConfig validator. validateConfig is called by all CLI commands
 * after loading to surface misconfiguration with actionable messages.
 * Does NOT read config from disk — that is loadConfig's responsibility.
 */
```

Add JSDoc for the new interface and function:

```typescript
/**
 * Represents a single configuration validation error.
 * @property field - Dot-path of the offending config field (e.g. 'bdd.featuresDir')
 * @property message - Human-readable description of the problem and how to fix it
 */
export interface ConfigError { ... }

/**
 * Validate a fully-resolved BddWorkflowConfig and return all errors found.
 *
 * Checks language, bdd.featuresDir, bdd.runCommand, docs.style, and
 * docs.format. Does NOT validate filesystem paths — only value constraints.
 *
 * @param config - The resolved configuration to validate
 * @returns Array of ConfigError objects (empty if valid)
 */
export function validateConfig(config: BddWorkflowConfig): ConfigError[] { ... }
```

### `src/commands/check.ts` — update JSDoc scope

```typescript
/**
 * @module commands/check
 * @description Implements the `bdd-workflow check` CLI subcommand. Runs the
 * project's full verification suite — type-check followed by the Cucumber test
 * suite — and exits non-zero if either step fails. Calls validateConfig and
 * exits 1 with a clear error message if the project config is invalid. Exits 1
 * with an actionable message if tsconfig.json is not found. Intended as the
 * canonical pre-review gate referenced by the bdd-workflow skill and command
 * files. Does NOT run the build — type-checking is performed via
 * `npx tsc --noEmit` only.
 */
```

### `src/commands/context.ts` — update JSDoc scope

```typescript
/**
 * @module commands/context
 * @description CLI command wiring for `bdd-workflow context`. Parses CLI
 * options, loads and validates the project configuration, and delegates to
 * `generateContext`. Handles empty feature set and empty source file set
 * gracefully with info messages (exits 0). Does NOT contain generation
 * logic — that lives in src/generators/context.ts.
 */
```

### `src/commands/docs.ts` — update JSDoc scope

```typescript
/**
 * @module commands/docs
 * @description CLI command wiring for `bdd-workflow docs`. Parses CLI options,
 * loads and validates the project configuration, and delegates to
 * `generateDocs`. Handles missing entry point and TypeDoc compilation failures
 * with clear error output and exit 1. Does NOT contain generation logic —
 * that lives in src/generators/docs.ts.
 */
```

### `src/commands/specs.ts` — update JSDoc scope

```typescript
/**
 * @module commands/specs
 * @description CLI command wiring for `bdd-workflow specs`. Parses CLI
 * options, loads and validates the project configuration, and delegates to
 * `generateSpecs`. Handles empty feature directories gracefully (exit 0, info
 * message). Does NOT contain generation logic — that lives in
 * src/generators/specs.ts.
 */
```

### `src/commands/learn.ts` — update JSDoc scope

```typescript
/**
 * @module commands/learn
 * @description CLI command wiring for `bdd-workflow learn`. Provides two
 * subcommands: `list` (prints a formatted table of all learning entries) and
 * `promote` (creates GitHub issues from unpromoted learnings via the `gh`
 * CLI). Handles missing `gh` CLI with a clear installation message and exit 1.
 * Does NOT contain parsing or promotion logic — that lives in
 * src/learn/index.ts and src/learn/promote.ts.
 */
```

---

## BDD Specs (WHAT Layer)

### `features/config-validation.feature` — NEW

```gherkin
Feature: Config validation
  As a developer using bdd-workflow
  I want invalid configuration to be caught and reported clearly
  So that I can fix misconfiguration without reading source code

  Scenario: validateConfig returns empty array for a valid config
    Given a valid bdd-workflow configuration
    When I call validateConfig
    Then the result is an empty array

  Scenario: validateConfig reports an unsupported language
    Given a bdd-workflow config with language set to "ruby"
    When I call validateConfig
    Then the result contains one error for field "language"
    And the error message mentions "typescript" and "javascript"

  Scenario: validateConfig reports missing bdd.featuresDir
    Given a bdd-workflow config with bdd.featuresDir set to ""
    When I call validateConfig
    Then the result contains one error for field "bdd.featuresDir"
    And the error message says "featuresDir is required"

  Scenario: validateConfig reports missing bdd.runCommand
    Given a bdd-workflow config with bdd.runCommand set to ""
    When I call validateConfig
    Then the result contains one error for field "bdd.runCommand"
    And the error message says "runCommand is required"

  Scenario: validateConfig reports unsupported docs.style
    Given a bdd-workflow config with docs.style set to "openapi"
    When I call validateConfig
    Then the result contains one error for field "docs.style"
    And the error message mentions "jsdoc" and "tsdoc"

  Scenario: validateConfig reports unsupported docs.format
    Given a bdd-workflow config with docs.format set to "pdf"
    When I call validateConfig
    Then the result contains one error for field "docs.format"
    And the error message mentions "markdown" and "html"

  Scenario: CLI commands exit 1 and print errors when config is invalid
    Given a project with an invalid bdd-workflow.config.ts (bad language value)
    When I run "npx bdd-workflow context"
    Then the command exits with status 1
    And the output contains "bdd-workflow configuration errors:"
    And the output contains "language:"
```

### `features/error-handling.feature` — NEW

```gherkin
Feature: CLI error handling
  As a developer using bdd-workflow
  I want clear, actionable error messages
  So that I can diagnose and fix problems quickly

  Scenario: context command prints info and exits 0 when no feature files exist
    Given a project with no .feature files in the features directory
    When I run "npx bdd-workflow context"
    Then the command exits with status 0
    And the output contains a message about no feature files

  Scenario: specs command prints info and exits 0 when no feature files exist
    Given a project with no .feature files in the features directory
    When I run "npx bdd-workflow specs"
    Then the command exits with status 0
    And the output contains a message about no feature files

  Scenario: context command prints info and exits 0 when no TypeScript source files exist
    Given a project with no TypeScript files in src/
    When I run "npx bdd-workflow context"
    Then the command exits with status 0
    And the output contains a message about no source files

  Scenario: learn promote exits 1 with a clear message when gh CLI is not found
    Given the "gh" CLI is not available in PATH
    When I run "npx bdd-workflow learn promote"
    Then the command exits with a non-zero status
    And the output contains "GitHub CLI not found"
    And the output contains "https://cli.github.com"

  Scenario: docs command surfaces TypeDoc errors clearly
    Given a project where the configured entry point does not exist
    When I run "npx bdd-workflow docs"
    Then the command exits with status 1
    And the output contains an error about the missing entry point

  Scenario: check command exits 1 when tsconfig.json is missing
    Given a project with no tsconfig.json
    When I run "npx bdd-workflow check"
    Then the command exits with status 1
    And the output contains "TypeScript config not found"
    And the output contains "npx tsc --init"
```

### `features/scaffold-phase6.feature` — NEW

```gherkin
Feature: Phase 6 scaffold additions
  As a developer initializing a new project
  I want the scaffold package.json to include a full set of npm scripts
  So that common development tasks are immediately available

  Scenario: scaffold package.json includes extended scripts
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file "package.json" contains "check:all"
    And the file "package.json" contains "test:watch"
    And the file "package.json" contains "docs"
    And the file "package.json" contains "context"
    And the file "package.json" contains "specs"

  Scenario: npx bdd-workflow --version prints a version string
    Given the bdd-workflow package is built
    When I run "npx bdd-workflow --version"
    Then the output contains a semver version string
```

---

## Implementation Plan (HOW Layer)

### 1. `src/config.ts` — add `validateConfig`

Add after the `loadConfig` function (and its private `loadConfigViaTsx` helper):

```typescript
export interface ConfigError {
  field: string;
  message: string;
}

export function validateConfig(config: BddWorkflowConfig): ConfigError[] {
  const errors: ConfigError[] = [];

  if (!['typescript', 'javascript'].includes(config.language)) {
    errors.push({
      field: 'language',
      message: `Unsupported language: "${config.language}". Supported: typescript, javascript`,
    });
  }

  if (!config.bdd.featuresDir) {
    errors.push({ field: 'bdd.featuresDir', message: 'featuresDir is required' });
  }

  if (!config.bdd.runCommand) {
    errors.push({ field: 'bdd.runCommand', message: 'runCommand is required' });
  }

  if (!['jsdoc', 'tsdoc'].includes(config.docs.style)) {
    errors.push({
      field: 'docs.style',
      message: `Unsupported doc style: "${config.docs.style}". Use jsdoc or tsdoc`,
    });
  }

  if (!['markdown', 'html'].includes(config.docs.format)) {
    errors.push({
      field: 'docs.format',
      message: `Unsupported format: "${config.docs.format}". Use 'markdown' or 'html'`,
    });
  }

  return errors;
}
```

Also export `assertValidConfig` as a named export (not just a private helper) so it can be shared across command files cleanly:

```typescript
export function assertValidConfig(config: BddWorkflowConfig): void {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error('bdd-workflow configuration errors:');
    for (const err of errors) {
      console.error(`  ${err.field}: ${err.message}`);
    }
    process.exit(1);
  }
}
```

### 2. `src/index.ts` — export new types

Export `ConfigError`, `validateConfig`, and `assertValidConfig` from `src/index.ts` so library consumers can use them.

### 3. Wire `assertValidConfig` into all command files

In each of `check.ts`, `context.ts`, `docs.ts`, `specs.ts`, `learn.ts`: call `assertValidConfig(config)` immediately after `loadConfig` returns.

### 4. Error handling additions per command

**`src/commands/check.ts`**
- Before running `tsc`, check `existsSync(join(process.cwd(), 'tsconfig.json'))`. If missing:
  `"bdd-workflow check: TypeScript config not found. Run \`npx tsc --init\` to create one."` → `process.exit(1)`.

**`src/commands/context.ts`**
- The generators already handle empty state by producing empty sections. Add explicit info log lines:
  - If no `.feature` files found: `"[bdd-workflow] No .feature files found — feature summaries section will be empty."`
  - If no TypeScript source files found: `"[bdd-workflow] No TypeScript source files found — modules section will be empty."`
- These are informational only; the command still exits 0 and writes CONTEXT.md.

**`src/commands/docs.ts`**
- The `generateDocs` call is already inside the `.action` handler without a try/catch. Wrap it:
  ```typescript
  try {
    await generateDocs(config);
  } catch (err) {
    console.error('bdd-workflow docs: failed to generate docs.');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  ```

**`src/commands/specs.ts`**
- After `generateSpecs` completes, or if it detects zero feature files, print:
  `"[bdd-workflow] No .feature files found. Nothing to write to SPECS.md."` and exit 0.
- Implementation: check the feature file count before calling `generateSpecs` (call `parseFeatureFilesDetailed` once and short-circuit if empty), OR let `generateSpecs` return a count and print the message in the command.
- Preferred: add a return value or check inside `specsCommand` using the config's featuresDir before calling the generator.

**`src/commands/learn.ts` (`promote` subcommand)**
- The existing `promoteLearnings` in `src/learn/promote.ts` already checks for `gh`. Verify it prints:
  `"GitHub CLI not found. Install from https://cli.github.com"` and calls `process.exit(1)`. If the message is different, update it there (not in the command wiring).

### 5. `src/scaffold/templates/package.json` — expand scripts

Replace the existing `scripts` block with:

```json
"scripts": {
  "build": "tsc",
  "build:watch": "tsc --watch",
  "test": "cucumber-js",
  "test:watch": "cucumber-js --watch",
  "docs": "bdd-workflow docs",
  "specs": "bdd-workflow specs",
  "context": "bdd-workflow context",
  "check": "tsc --noEmit",
  "check:all": "tsc --noEmit && cucumber-js"
}
```

Note: `lint` is intentionally excluded from the scaffold template's `package.json` since ESLint is not a required dependency and projects may not use it. The `check` script uses only `tsc --noEmit` (not `eslint`) for the same reason.

### 6. Main package `package.json` — add developer scripts

Add `check` and `check:all` scripts to the bdd-workflow package itself (not just the scaffold template):

```json
"scripts": {
  "build": "tsc && node scripts/copy-templates.js",
  "dev": "tsc --watch",
  "test": "npx cucumber-js",
  "check": "npx tsc --noEmit",
  "check:all": "npx tsc --noEmit && npx cucumber-js"
}
```

### 7. `README.md` — new file in project root

Write `README.md` covering:

1. **What it is** — one paragraph
2. **The three-layer model** — WHY/WHAT/HOW table
3. **Quick start** — `npx bdd-workflow init`, then how to use in OpenCode
4. **The workflow** — visual step sequence diagram
5. **CLI commands reference** — all subcommands with options
6. **OpenCode slash commands reference** — all workflow commands
7. **Configuration** — `bdd-workflow.config.ts` with all options documented
8. **Context generation** — what CONTEXT.md is and how to keep it current
9. **Contributing learnings** — how to use `/learn` and `learn promote`
10. **Language support** — current: TypeScript; planned: Go, Python
11. **Status** — pre-1.0, API is unstable
12. **Publishing** — manual `npm publish` procedure, version bump, CHANGELOG note

### 8. New and updated feature files

**Create:**
- `features/config-validation.feature`
- `features/error-handling.feature`
- `features/scaffold-phase6.feature`

**No changes** to `features/scaffold-phase2.feature` — the "All 7 command files" scenario remains accurate as the utility commands are not being added.

### 9. Step definitions

Add step definitions in `features/support/steps/` for:
- `config-validation.feature` — unit-level steps (import `validateConfig` directly from the built package; no temp dir required)
- `error-handling.feature` — integration-level steps (spawn `npx bdd-workflow <cmd>` in a temporary initialized project; reuse temp dir helpers from `init.feature` steps)
- `scaffold-phase6.feature` — reuse existing `init` step helpers for the `package.json` script checks; reuse built-package helper for the `--version` check

### 10. Build and sync live files

After all template changes:
```
npm run build && npx bdd-workflow update
```

Per AGENTS.md: always edit template files (`src/scaffold/templates/...`), never the live `.opencode/` files directly.

---

## Risks and Considerations

### Breaking changes
- `validateConfig` + `assertValidConfig` are additive. Existing code does not call them.
- Adding `assertValidConfig` calls in commands will cause commands to fail hard on previously-tolerated bad config. This is intentional — surfacing silent misconfigurations is a goal.

### Dependencies
- No new runtime dependencies are added.
- `gh` CLI is an external binary; the `learn promote` path already checks for it. Phase 6 formalizes the error message text.

### Edge cases
- `validateConfig` can assume all config fields exist — `loadConfig` always calls `defineConfig` which applies defaults before returning. No need to guard against `undefined`.
- The `check` tsconfig detection uses `existsSync(join(process.cwd(), 'tsconfig.json'))` — the same pattern already used in `loadConfigViaTsx`.
- The `context` command info messages should NOT cause a non-zero exit. Empty state is valid for a freshly initialized project.

### Test coverage ordering
- `config-validation.feature` tests are unit-level (fast — directly import `validateConfig`).
- `error-handling.feature` and `scaffold-phase6.feature` are integration tests (slower — spawn CLI in temp dirs), following the existing pattern in `init.feature`.

### README scope
- The README covers the published package only. No internal implementation details.
- The `## Status` section must note pre-1.0 and API instability.
- The `## Publishing` section must document the manual `npm publish` process and link to a CHANGELOG procedure.

---

## Acceptance Criteria (from roadmap, scoped to this proposal)

- [ ] `npm run check:all` passes in the `bdd-workflow` package itself
- [ ] Config validation catches and reports all invalid configurations
- [ ] No unhandled promise rejections in any CLI command path
- [ ] README.md covers all commands and configuration options
- [ ] BDD test coverage for all deliverable items above
- [ ] `npm pack` produces a package that works when installed globally
- [ ] `npx bdd-workflow --version` prints the correct version
- [ ] All error messages include actionable guidance (not just error codes)

---

## File Change Summary

### Files to CREATE
| File | Purpose |
|------|---------|
| `features/config-validation.feature` | BDD specs for `validateConfig` |
| `features/error-handling.feature` | BDD specs for CLI error handling |
| `features/scaffold-phase6.feature` | BDD specs for Phase 6 scaffold additions |
| `README.md` | Package documentation |
| Step definitions for new feature files (in `features/support/steps/`) | Test implementation |

### Files to MODIFY
| File | Change |
|------|--------|
| `src/config.ts` | Add `ConfigError` interface, `validateConfig`, and `assertValidConfig` |
| `src/index.ts` | Export `ConfigError`, `validateConfig`, and `assertValidConfig` |
| `src/commands/check.ts` | Add `assertValidConfig` call; add tsconfig missing check |
| `src/commands/context.ts` | Add `assertValidConfig` call; add info messages for empty state |
| `src/commands/docs.ts` | Add `assertValidConfig` call; wrap `generateDocs` in try/catch |
| `src/commands/specs.ts` | Add `assertValidConfig` call; handle zero feature files gracefully |
| `src/commands/learn.ts` | Add `assertValidConfig` call; verify/fix `gh` not found error message |
| `src/scaffold/templates/package.json` | Expand scripts block (add `build:watch`, `test:watch`, `docs`, `specs`, `context`, `check`, `check:all`) |
| Main `package.json` | Add `check` and `check:all` scripts |
