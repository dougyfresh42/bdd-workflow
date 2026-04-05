---
title: "Phase 3 — Context Generation"
date: 2026-04-05
status: pending
goal: "Implement `npx bdd-workflow context`, which generates CONTEXT.md — a programmatic codebase summary that gives AI agents full project understanding without manual exploration."
---

# Proposal: Phase 3 — Context Generation

## 1. Summary

This proposal implements `npx bdd-workflow context`, the CLI command that generates `CONTEXT.md` from source files and feature specs. `CONTEXT.md` is the payoff of the three-layer model: because every module has a JSDoc comment and every behavior has a `.feature` file, a deterministic script can build a complete codebase summary without agent exploration.

`CONTEXT.md` is listed in `opencode.json` under `instructions`, so OpenCode loads it automatically into every session. When it is accurate and up-to-date, agents skip the "explore the codebase" phase entirely.

**User-visible impact**: After this phase, running `npx bdd-workflow context` in any project configured with `bdd-workflow.config.ts` will produce or refresh a `CONTEXT.md` file with five sections: overview, directory structure, module summaries, feature summaries, and public API signatures.

**Files to create:**
- `src/commands/context.ts`
- `src/generators/context.ts`
- `src/generators/structure.ts`
- `src/parsers/gherkin.ts`
- `src/parsers/jsdoc.ts`
- `src/parsers/typescript.ts`

**Files to modify:**
- `src/cli.ts` — register the `context` command
- `src/config.ts` — add `loadConfig` function (dynamic import of user's `bdd-workflow.config.ts`)
- `package.json` — add `@cucumber/gherkin`, `@cucumber/messages` to `dependencies`; move `typescript` from `devDependencies` to `dependencies`

**New feature file:**
- `features/context.feature`

---

## 2. Doc Updates (the WHY layer)

### `src/commands/context.ts` — file-level comment

```typescript
/**
 * @module commands/context
 * @description CLI command wiring for `bdd-workflow context`. Parses CLI
 * options, loads the project configuration, and delegates to
 * `generateContext`. Does NOT contain generation logic — that lives in
 * src/generators/context.ts.
 */
```

### `src/generators/context.ts` — file-level comment

```typescript
/**
 * @module generators/context
 * @description Orchestrates assembly of CONTEXT.md by collecting output from
 * the structure, jsdoc, gherkin, and typescript parsers and writing the
 * result to the configured output file. Sections are conditionally included
 * based on config.context.sections flags. Does NOT perform any parsing
 * itself — delegates to the parsers/ modules.
 */
```

### `src/generators/context.ts` — `generateContext` function

```typescript
/**
 * Generate CONTEXT.md for the given configuration.
 *
 * Assembles up to five sections in order:
 * 1. Header (always)
 * 2. Overview (always — derived from package.json + src/index.ts @module)
 * 3. Directory Structure (when config.context.sections.structure is true)
 * 4. Module Summaries (when config.context.sections.moduleSummaries is true)
 * 5. Feature Summaries (when config.context.sections.featureSummaries is true)
 * 6. Public API (when config.context.sections.exports is true)
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Promise that resolves when CONTEXT.md has been written
 */
```

### `src/generators/structure.ts` — file-level comment

```typescript
/**
 * @module generators/structure
 * @description Generates an indented directory tree string from the file
 * paths matched by the configured include/exclude patterns. Uses `glob` for
 * file collection. Does NOT depend on the system `tree` binary — the tree is
 * rendered in-process.
 */
```

### `src/generators/structure.ts` — `generateDirectoryTree` function

```typescript
/**
 * Generate a human-readable indented directory tree string.
 *
 * Collects all files matching config.context.include patterns (excluding
 * config.context.exclude), builds a nested tree object, and renders it as
 * 2-space-indented text.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Indented tree string (no trailing newline)
 */
```

### `src/parsers/gherkin.ts` — file-level comment

```typescript
/**
 * @module parsers/gherkin
 * @description Parses Gherkin `.feature` files using the official
 * `@cucumber/gherkin` package and extracts Feature names and Scenario names
 * into a structured summary. Handles Rules, Scenario Outlines, and Examples
 * tables. Does NOT execute scenarios — parsing only.
 */
```

### `src/parsers/gherkin.ts` — `parseFeatureFiles` function

```typescript
/**
 * Parse all `.feature` files in the configured features directory.
 *
 * For each file, extracts the Feature name and the names of all Scenarios
 * (including Scenario Outlines). Files that fail to parse are logged as
 * warnings and skipped.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of FeatureSummary objects, one per .feature file
 */
```

### `src/parsers/jsdoc.ts` — file-level comment

```typescript
/**
 * @module parsers/jsdoc
 * @description Extracts file-level JSDoc comments from TypeScript source
 * files using the TypeScript compiler API. Targets the leading `/** ... *\\/`
 * block comment of each file (the `@module` description). Does NOT use
 * regex — the TS compiler handles edge cases correctly. Files without a
 * file-level JSDoc comment are silently skipped.
 */
```

### `src/parsers/jsdoc.ts` — `extractModuleSummaries` function

```typescript
/**
 * Extract file-level JSDoc descriptions from all TypeScript source files
 * matching the configured include patterns.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of ModuleSummary objects; files without a file-level JSDoc
 *   comment are omitted
 */
```

### `src/parsers/typescript.ts` — file-level comment

```typescript
/**
 * @module parsers/typescript
 * @description Extracts exported function and class signatures from
 * TypeScript source files using the TypeScript compiler API (ts.Program +
 * TypeChecker). Returns human-readable signature strings suitable for the
 * Public API section of CONTEXT.md. Does NOT produce HTML or markdown links —
 * plain text signatures only.
 */
```

### `src/parsers/typescript.ts` — `extractPublicApi` function

```typescript
/**
 * Extract exported symbol signatures from TypeScript source files.
 *
 * Loads tsconfig.json from `process.cwd()`, creates a ts.Program, and for
 * each source file matching the configured include patterns extracts all
 * exported declarations and formats them as signature strings.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of ApiEntry objects; files with no exports are omitted
 */
```

### `src/config.ts` — `loadConfig` function

```typescript
/**
 * Load and resolve bdd-workflow configuration from the user's project.
 *
 * Looks for `bdd-workflow.config.ts` in `process.cwd()` (or the path
 * provided via --config). If the file is not found, returns the default
 * configuration with a warning. Dynamic import is used so the config file
 * can be a TypeScript module (requires the CLI to run under `tsx`).
 *
 * @param configPath - Optional explicit path to the config file
 * @returns Resolved BddWorkflowConfig with defaults merged
 */
```

---

## 3. BDD Specs (the WHAT layer)

### New file: `features/context.feature`

```gherkin
Feature: Context Generation
  As a developer using bdd-workflow
  I want to run `npx bdd-workflow context`
  So that CONTEXT.md is automatically generated from my source files and feature specs

  Background:
    Given the bdd-workflow package is built
    And a temporary project directory with TypeScript source files and feature specs

  Scenario: Happy path — generates CONTEXT.md with all five sections
    Given the project has TypeScript source files with JSDoc comments
    And the project has Gherkin feature files with scenarios
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md is created at the project root
    And CONTEXT.md contains a "## Overview" section
    And CONTEXT.md contains a "## Directory Structure" section
    And CONTEXT.md contains a "## Modules" section
    And CONTEXT.md contains a "## Features" section
    And CONTEXT.md contains a "## Public API" section

  Scenario: Module summaries include JSDoc descriptions
    Given the project has a TypeScript file with a file-level JSDoc comment "Manages user session lifecycle"
    When I run "npx bdd-workflow context" in the project
    Then the "## Modules" section includes the file path
    And the "## Modules" section includes the text "Manages user session lifecycle"

  Scenario: Files without JSDoc comments are omitted from modules section
    Given the project has a TypeScript file with no file-level JSDoc comment
    When I run "npx bdd-workflow context" in the project
    Then the "## Modules" section does not include that file

  Scenario: Feature summaries include feature name and scenario names
    Given the project has a feature file with feature name "Authentication"
    And that feature file has a scenario named "User logs in with valid credentials"
    When I run "npx bdd-workflow context" in the project
    Then the "## Features" section includes "Authentication"
    And the "## Features" section includes "User logs in with valid credentials"

  Scenario: Public API section lists exported function signatures
    Given the project has a TypeScript file exporting a function "createSession(userId: string): Promise<Session>"
    When I run "npx bdd-workflow context" in the project
    Then the "## Public API" section includes the function signature

  Scenario: Deterministic output — running twice produces identical content
    Given I run "npx bdd-workflow context" in the project
    When I run "npx bdd-workflow context" again in the project
    Then both CONTEXT.md files are byte-for-byte identical (excluding the timestamp line)

  Scenario: Graceful empty state — no feature files
    Given the project has TypeScript source files but no Gherkin feature files
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md is created without errors
    And the "## Features" section is omitted or shows "No feature files found"

  Scenario: Config sections flag — featureSummaries disabled
    Given bdd-workflow.config.ts has "featureSummaries: false"
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md does not contain a "## Features" section

  Scenario: Config sections flag — exports disabled
    Given bdd-workflow.config.ts has "exports: false"
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md does not contain a "## Public API" section

  Scenario: context subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output includes "context"
```

---

## 4. Implementation Plan (the HOW layer)

### Files to Create

#### `src/commands/context.ts`
Wire the `context` subcommand using Commander. Accept `--config <path>` option. Call `loadConfig` then `generateContext`. Log `CONTEXT.md updated.` on success. Matches the design in `docs/phase-3.md` exactly.

#### `src/generators/context.ts`
Orchestrate section assembly:
1. Header block (always written): title + auto-generation notice + timestamp
2. Overview: read `package.json` description; extract `@module` description from `src/index.ts` via the jsdoc parser
3. Directory structure: call `generateDirectoryTree`
4. Module summaries: call `extractModuleSummaries`, format as markdown table
5. Feature summaries: call `parseFeatureFiles`, format as subsections with bullet-list scenarios
6. Public API: call `extractPublicApi`, format as subsections with bullet-list signatures
7. Write result to `config.context.outputFile`

Each section is skipped when its corresponding `config.context.sections` flag is `false`. Section separator is `\n\n`.

**Key decision**: The timestamp line (`> Last updated: ...`) uses `new Date().toISOString()`. To support determinism tests, the determinism scenario strips the timestamp line before comparing; the generator itself always writes a fresh timestamp. This avoids a config option purely for test convenience.

#### `src/generators/structure.ts`
1. Use `glob` with `config.context.include` patterns and `ignore: config.context.exclude`
2. Sort paths alphabetically
3. Build a tree object: `{ [segment: string]: TreeNode }` recursively from split paths
4. Render to string with 2-space indentation, directories before files (sort: dirs first, then files, alpha within each group)

**Key decision**: No dependency on the system `tree` binary. Pure Node.js implementation.

#### `src/parsers/gherkin.ts`
1. Glob for `**/*.feature` files under `config.bdd.featuresDir`
2. For each file, use `@cucumber/gherkin` Parser: `AstBuilder`, `GherkinClassicTokenMatcher`, `Parser`
3. Extract `feature.name` and all child scenario names (including `scenario.name` from `Rule` children)
4. Return `FeatureSummary[]`

**Key decision**: Use `@cucumber/gherkin` (the official parser) rather than regex. It handles all edge cases: Rules, Scenario Outlines, Examples tables, docstrings, data tables.

#### `src/parsers/jsdoc.ts`
1. Glob for `**/*.ts` files matching `config.context.include` (excluding `.d.ts`)
2. For each file, call `ts.createSourceFile` (no type-checking needed — parse only)
3. Call `ts.getLeadingCommentRanges` on `sourceFile.statements[0].pos`
4. Find the first `/** ... */` block and extract its description text
5. Strip `/**`, `*/`, and leading ` * ` prefixes from each line; extract the first non-tag paragraph as the description
6. Return `ModuleSummary[]`, skipping files with no file-level JSDoc block

**Key decision**: Use `ts.createSourceFile` with `ScriptTarget.ESNext` and `ScriptKind.TS` — no need to create a full `Program` since we only need the text ranges for JSDoc, not type information.

#### `src/parsers/typescript.ts`
1. Read `tsconfig.json` from `process.cwd()` using `ts.readConfigFile` + `ts.parseJsonConfigFileContent`
2. Create `ts.createProgram` from the resolved file list
3. For each source file matching `config.context.include` patterns:
   - Get the module symbol via `checker.getSymbolAtLocation(sourceFile)`
   - Get exports via `checker.getExportsOfModule(moduleSymbol)`
   - For each export: format signature using `checker.signatureToString` (functions/methods) or `checker.typeToString` (variables/types)
4. Return `ApiEntry[]`, omitting files with no exports

**Key decision**: A full `ts.Program` with type checker is needed here (unlike jsdoc.ts) because accurate type signatures require type resolution (e.g., resolving `Promise<Session>` requires the type checker to know what `Session` is).

### Files to Modify

#### `src/cli.ts`
Import `contextCommand` from `./commands/context.js` and add `program.addCommand(contextCommand())`.

#### `src/config.ts`
Add `loadConfig(configPath?: string): Promise<BddWorkflowConfig>`:
- Resolve path: use `configPath` if provided, else `join(process.cwd(), 'bdd-workflow.config.ts')`
- If file does not exist: `console.warn(...)` and return `defineConfig({})`
- Otherwise: `const mod = await import(resolvedPath)` and return `mod.default ?? defineConfig({})`
- Note: dynamic import of `.ts` requires the CLI to be run under `tsx` (already the case in dev; dist build also runs under tsx via the shebang / package.json bin)

#### `package.json`
- Add to `dependencies`: `"@cucumber/gherkin": "^29.0.0"`, `"@cucumber/messages": "^26.0.0"`
- Move `"typescript": "^5.0.0"` from `devDependencies` to `dependencies`

### Feature Step Definitions
New step definition file: `features/support/steps/context.steps.ts`

Steps needed:
- `Given a temporary project directory with TypeScript source files and feature specs` — create a temp dir with a minimal TS project + feature file
- `Given the project has a TypeScript file with a file-level JSDoc comment {string}` — write a TS file with the given comment
- `Given the project has a TypeScript file with no file-level JSDoc comment` — write a TS file without a JSDoc comment
- `Given the project has a feature file with feature name {string}` — write a `.feature` file
- `And that feature file has a scenario named {string}` — add a scenario to the feature file
- `Given the project has a TypeScript file exporting a function {string}` — write a TS file with the given export
- `Given bdd-workflow.config.ts has {string}` — write a config file with the given section option set to the given value
- `When I run "npx bdd-workflow context" in the project` — execute the CLI in the temp project dir
- `When I run "npx bdd-workflow context" again in the project` — execute a second time and capture both outputs
- `Then CONTEXT.md is created at the project root` — assert the file exists
- `Then CONTEXT.md contains a {string} section` — assert the section heading is present
- `Then the {string} section includes {string}` — assert text is present in the section
- `Then the {string} section does not include that file` — assert file path is absent from section
- `Then both CONTEXT.md files are byte-for-byte identical (excluding the timestamp line)` — strip timestamp lines and compare
- `Then CONTEXT.md is created without errors` — assert exit code 0 and file exists
- `Then the {string} section is omitted or shows "No feature files found"` — assert section absent or contains the fallback message
- `Then CONTEXT.md does not contain a {string} section` — assert section heading absent
- `Then the output includes {string}` — assert CLI stdout contains the string

---

## 5. Risks and Considerations

### Dynamic import of `.ts` config files
`loadConfig` uses `await import(resolvedPath)` which requires the runtime to support TypeScript imports natively. In dev this works because `tsx` is the runtime. In the dist build, the shebang `#!/usr/bin/env node` would not handle `.ts` imports unless the bin is invoked via `tsx`. The current `package.json` bin points to `./dist/cli.js` which is compiled JavaScript — it cannot dynamically import a `.ts` file unless it spawns a `tsx` child process for that purpose.

**Decision**: For Phase 3, `loadConfig` will use the same pattern as the rest of the CLI — it runs under `tsx` in development (via `npx tsx src/cli.ts`). For the dist build, document in the README that `bdd-workflow.config.ts` is loaded via a `tsx` subprocess call (spawning `tsx --eval "import('./path/to/config.ts').then(m => process.stdout.write(JSON.stringify(m.default)))"` and parsing stdout). This avoids requiring users to pre-compile their config. Implement this in `loadConfig` using `child_process.execSync` or `spawnSync`.

**Alternative considered**: Require users to also provide a `bdd-workflow.config.js` (compiled). Rejected — friction goes against the framework's goal of zero-config experience.

### TypeScript compiler API in dist build
`typescript` must be in `dependencies` (not `devDependencies`) so it is available at runtime for users who install `bdd-workflow` as a package. This is called out explicitly in `docs/phase-3.md`.

### Determinism
The `> Last updated: ...` line will differ between runs. The BDD scenario for determinism strips this line before comparing. No special handling is needed in the generator itself.

### Graceful empty state
If no `.feature` files exist, `parseFeatureFiles` returns `[]`. The generator should check for empty results and either omit the section or render a `_No feature files found._` placeholder. The BDD scenario allows either behavior.

### `glob` patterns and Windows path separators
`glob` returns POSIX-style paths on all platforms. The directory tree renderer must normalize paths using `/` as the separator regardless of OS.

### Large projects
The TypeScript `Program` creation (for `extractPublicApi`) loads all source files transitively. For large projects this could be slow. Phase 3 does not address performance optimizations — that is a Phase 6 concern.

### Step definition reuse
The context step definitions share some steps with `init.feature` (e.g., `Given the bdd-workflow package is built`, `When I run "npx bdd-workflow ..." in that directory`). Review existing step definitions in `features/support/steps/` before writing new ones to avoid duplication. Shared setup helpers should be extracted to a `features/support/helpers/` module if needed.

---

## Acceptance Criteria

Mirrors `docs/phase-3.md` exactly:

- [ ] `npx bdd-workflow context` runs without errors in a project with TypeScript source files and `.feature` files
- [ ] Generated `CONTEXT.md` includes all 5 sections (overview, structure, modules, features, API)
- [ ] Module summaries are correctly extracted from file-level JSDoc `/** ... */` comments
- [ ] Feature summaries include Feature name and all Scenario names from each `.feature` file
- [ ] Public API section lists exported function signatures with correct TypeScript types
- [ ] Files without JSDoc comments are omitted from the modules section (no empty entries)
- [ ] Running the command twice produces identical output (deterministic, excluding timestamp line)
- [ ] Config `sections` flags work: setting `featureSummaries: false` omits that section
- [ ] The command works on a project with no `.feature` files yet (graceful empty state)
- [ ] BDD test: a Cucumber scenario covers the happy-path end-to-end generation
- [ ] `context` subcommand appears in `npx bdd-workflow --help`
- [ ] All new modules have file-level JSDoc `@module` comments
- [ ] `npx tsc --noEmit` passes after the changes
