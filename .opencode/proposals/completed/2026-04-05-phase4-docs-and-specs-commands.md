# Proposal: Phase 4 — `bdd-workflow docs` and `bdd-workflow specs` Commands

**Date**: 2026-04-05
**Goal**: Implement `npx bdd-workflow docs` (TypeDoc-based API doc generation) and `npx bdd-workflow specs` (human-readable SPECS.md from Gherkin feature files). These are the "publish" commands that transform the WHY and WHAT layers into standalone human-readable documents.

---

## 1. Summary

Phase 4 adds two new CLI subcommands to `bdd-workflow`:

- **`bdd-workflow docs`** — generates API documentation from JSDoc comments using TypeDoc's programmatic Node API. Outputs markdown (or HTML) files to the project's configured `docs/` directory. Uses TypeDoc's `Application.bootstrapWithPlugins` so no separate shell invocation of `typedoc` is needed.

- **`bdd-workflow specs`** — generates `SPECS.md`, a human-readable behavioral specification document derived from all `.feature` files. Unlike the terse `CONTEXT.md` (AI-optimized), `SPECS.md` is formatted for human readers and includes full step text, tags, and a summary table.

Both commands are registered in `src/cli.ts`. The gherkin parser in `src/parsers/gherkin.ts` is extended with a new `parseFeatureFilesDetailed` function that extracts full step details (keyword, text), feature descriptions, and per-scenario tags in addition to the names already extracted by `parseFeatureFiles`.

The `archive` command template is updated to also run `npx bdd-workflow specs` (alongside the existing `npx bdd-workflow context` regeneration step) so `SPECS.md` stays current alongside `CONTEXT.md`.

`typedoc` and `typedoc-plugin-markdown` are added as runtime `dependencies` (not devDependencies) because the docs command runs TypeDoc programmatically against the user's project at runtime.

User-visible impact:
- `npx bdd-workflow --help` gains two new subcommands: `docs` and `specs`
- `SPECS.md` is auto-generated and tracked in git
- `docs/` directory is populated with TypeDoc output (whether committed to git is the user's choice)

---

## 2. Doc Updates (the WHY layer)

### `src/commands/docs.ts` (new file)

```typescript
/**
 * @module commands/docs
 * @description CLI command wiring for `bdd-workflow docs`. Parses CLI options,
 * loads the project configuration, and delegates to `generateDocs`. Supports
 * an optional `--format` flag to switch between markdown (default) and HTML
 * output. Does NOT contain generation logic — that lives in
 * src/generators/docs.ts.
 */
```

Function JSDoc:
```typescript
/**
 * Create and return the `docs` Commander subcommand.
 *
 * @returns Configured Commander Command object for the `docs` subcommand
 */
export function docsCommand(): Command
```

### `src/generators/docs.ts` (new file)

```typescript
/**
 * @module generators/docs
 * @description Generates API documentation from JSDoc comments using TypeDoc's
 * programmatic Node API. Reads optional `typedoc.json` from the project root
 * and merges sensible defaults from `bdd-workflow.config.ts`. Outputs markdown
 * files (via typedoc-plugin-markdown) or HTML to the configured output
 * directory. Does NOT invoke TypeDoc as a shell command — uses
 * Application.bootstrapWithPlugins so output can be tested and errors surfaced
 * clearly.
 */
```

Function JSDoc:
```typescript
/**
 * Generate API documentation for the user's project using TypeDoc.
 *
 * Bootstraps a TypeDoc Application with plugins, converts the project, and
 * writes documentation to `config.docs.outputDir`. Throws if TypeDoc fails
 * to parse the project (e.g., missing entry point).
 *
 * @param config - Resolved bdd-workflow configuration
 * @throws {Error} If TypeDoc fails to parse the project (e.g., no entry point)
 */
export async function generateDocs(config: BddWorkflowConfig): Promise<void>
```

### `src/commands/specs.ts` (new file)

```typescript
/**
 * @module commands/specs
 * @description CLI command wiring for `bdd-workflow specs`. Parses CLI
 * options, loads the project configuration, and delegates to `generateSpecs`.
 * Supports an optional `--output` flag to override the default SPECS.md path.
 * Does NOT contain generation logic — that lives in src/generators/specs.ts.
 */
```

Function JSDoc:
```typescript
/**
 * Create and return the `specs` Commander subcommand.
 *
 * @returns Configured Commander Command object for the `specs` subcommand
 */
export function specsCommand(): Command
```

### `src/generators/specs.ts` (new file)

```typescript
/**
 * @module generators/specs
 * @description Assembles SPECS.md — a human-readable behavioral specification
 * document derived from all Gherkin `.feature` files in the project.
 * Reuses the `parseFeatureFilesDetailed` parser from src/parsers/gherkin.ts,
 * formats full step text (keyword + text), feature descriptions, and scenario
 * tags, and appends a summary table. Does NOT abbreviate scenario outlines to
 * individual example rows — shows the outline template with `<placeholder>`
 * syntax instead. Does NOT write CONTEXT.md — that is handled by
 * src/generators/context.ts.
 */
```

Interfaces and function JSDoc:
```typescript
/** A single step in a scenario. */
export interface StepDetail {
  keyword: string;   // 'Given' | 'When' | 'Then' | 'And' | 'But'
  text: string;
}

/** A scenario or scenario outline with its full step details. */
export interface ScenarioDetail {
  name: string;
  steps: StepDetail[];
  tags: string[];
  isOutline: boolean;
  examples?: string[][];  // Header row + data rows for Scenario Outlines
}

/** Detailed representation of a single .feature file. */
export interface FeatureDetail {
  filePath: string;
  featureName: string;
  description: string;
  scenarios: ScenarioDetail[];
  tags: string[];
}

/**
 * Generate SPECS.md from all `.feature` files in the configured directory.
 *
 * Writes a formatted markdown document to `outputPath`. Each Feature becomes
 * an H2 section; each Scenario becomes an H3 with its full step text. A
 * summary table is appended at the end. Runs gracefully when no feature files
 * exist (writes an empty summary).
 *
 * @param config - Resolved bdd-workflow configuration
 * @param outputPath - Path to write SPECS.md (default: 'SPECS.md')
 */
export async function generateSpecs(config: BddWorkflowConfig, outputPath: string): Promise<void>
```

### `src/parsers/gherkin.ts` (extend existing)

Add to existing module JSDoc (after the existing description):
> Extended in Phase 4 with `parseFeatureFilesDetailed` which additionally extracts per-step keyword and text, feature descriptions, feature-level tags, and scenario-level tags.

New interface and function JSDoc:
```typescript
/** A single step extracted from a scenario. */
export interface StepDetail {
  keyword: string;
  text: string;
}

/** A scenario with full step details, tags, and outline metadata. */
export interface ScenarioDetail {
  name: string;
  steps: StepDetail[];
  tags: string[];
  isOutline: boolean;
  examples?: string[][];
}

/** Detailed representation of a .feature file (superset of FeatureSummary). */
export interface FeatureDetail {
  filePath: string;
  featureName: string;
  description: string;
  scenarios: ScenarioDetail[];
  tags: string[];
}

/**
 * Parse all `.feature` files and return full step-level detail for each.
 *
 * Superset of `parseFeatureFiles` — returns the same files in the same order
 * but includes full step text, feature descriptions, feature-level tags, and
 * per-scenario tags. Scenario Outlines are flagged with `isOutline: true` and
 * include their Examples rows. Files that fail to parse are warned and skipped.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of FeatureDetail objects, one per .feature file, sorted by path
 */
export async function parseFeatureFilesDetailed(config: BddWorkflowConfig): Promise<FeatureDetail[]>
```

---

## 3. BDD Specs (the WHAT layer)

### New file: `features/docs.feature`

```gherkin
Feature: bdd-workflow docs command

  Scenario: docs subcommand appears in CLI help
    Given the bdd-workflow CLI is installed
    When I run "bdd-workflow --help"
    Then the output contains "docs"

  Scenario: docs generates markdown output in a TypeScript project
    Given a temporary project directory with TypeScript source files and JSDoc comments
    And the project has a valid "src/index.ts" entry point
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with code 0
    And the "docs/" directory is created
    And it contains at least one markdown file

  Scenario: docs command respects the --format html flag
    Given a temporary project directory with TypeScript source files
    When I run "bdd-workflow docs --format html" in the project directory
    Then the command exits with code 0
    And the "docs/" directory contains HTML files

  Scenario: docs fails gracefully when no entry point exists
    Given a temporary project directory with no "src/index.ts"
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with a non-zero code
    And the output contains a helpful error message

  Scenario: TypeDoc errors are surfaced clearly
    Given a temporary project directory with a malformed TypeScript file
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with a non-zero code
    And the error output is not swallowed
```

### New file: `features/specs.feature`

```gherkin
Feature: bdd-workflow specs command

  Scenario: specs subcommand appears in CLI help
    Given the bdd-workflow CLI is installed
    When I run "bdd-workflow --help"
    Then the output contains "specs"

  Scenario: specs generates SPECS.md with a section for each feature
    Given a temporary project directory with two ".feature" files
    When I run "bdd-workflow specs" in the project directory
    Then the command exits with code 0
    And "SPECS.md" exists in the project directory
    And it contains one H2 section per feature file

  Scenario: Each section lists all scenarios with full step text
    Given a temporary project directory with a feature file containing steps
    When I run "bdd-workflow specs"
    Then "SPECS.md" lists each scenario name as an H3 heading
    And each step is shown with its keyword in bold followed by the step text

  Scenario: Summary table is accurate
    Given a temporary project directory with three feature files
    When I run "bdd-workflow specs"
    Then "SPECS.md" contains a summary table
    And the total row reflects the correct sum of all scenarios

  Scenario: specs runs gracefully when there are no feature files
    Given a temporary project directory with no ".feature" files
    When I run "bdd-workflow specs"
    Then the command exits with code 0
    And "SPECS.md" contains the header and summary section with zero scenarios

  Scenario: Tags are included when present on scenarios
    Given a feature file with tagged scenarios
    When I run "bdd-workflow specs"
    Then "SPECS.md" shows the tags for those scenarios

  Scenario: Scenario Outlines are shown as outlines, not as expanded example rows
    Given a feature file with a Scenario Outline and an Examples table
    When I run "bdd-workflow specs"
    Then "SPECS.md" shows the outline template with "<parameter>" placeholders
    And does not list individual example rows as separate scenarios

  Scenario: specs respects the --output flag
    Given a temporary project directory with feature files
    When I run "bdd-workflow specs --output my-specs.md"
    Then the command exits with code 0
    And the file "my-specs.md" is created instead of "SPECS.md"
```

---

## 4. Implementation Plan (the HOW layer)

### Files to create

1. **`src/commands/docs.ts`** — Commander `docsCommand()` factory. Options: `--config <path>`, `--format <format>` (default `markdown`). Loads config, mutates `config.docs.format` if `--format` is provided, calls `generateDocs(config)`, logs output path.

2. **`src/generators/docs.ts`** — `generateDocs(config)` async function. Uses `Application.bootstrapWithPlugins` from `typedoc` with these options:
   - `entryPoints`: `[config.docs.entryPoint ?? 'src/index.ts']`
   - `tsconfig`: `'tsconfig.json'`
   - `out`: `config.docs.outputDir`
   - `plugin`: `['typedoc-plugin-markdown']` if format is markdown, else `[]`
   - `readme`: `'none'`
   - `excludePrivate`, `excludeInternal`: `true`
   - Readers: `[new TSConfigReader(), new TypeDocReader()]`
   - Calls `app.convert()` — throws `Error('TypeDoc failed to parse the project')` if `null` returned
   - Calls `app.generateDocs(project, config.docs.outputDir)`

3. **`src/commands/specs.ts`** — Commander `specsCommand()` factory. Options: `--config <path>`, `--output <path>` (default `SPECS.md`). Loads config, calls `generateSpecs(config, outputPath)`, logs output path.

4. **`src/generators/specs.ts`** — `generateSpecs(config, outputPath)` async function. Calls `parseFeatureFilesDetailed(config)`. Builds the SPECS.md document line by line:
   - Header block with auto-generated timestamp and `featuresDir` reference
   - Per-feature H2 with `**File**: \`path\`` and optional description
   - Per-scenario H3 with optional `*Tags: ...*` line and `**Keyword** text` step lines
   - For Scenario Outlines: show the template steps (with `<param>` placeholders) and note `*(Scenario Outline)*`
   - Summary table
   - Writes file via `fs/promises.writeFile`

5. **`features/docs.feature`** — 5 scenarios as listed above

6. **`features/specs.feature`** — 8 scenarios as listed above

### Files to modify

7. **`src/parsers/gherkin.ts`** — Add `StepDetail`, `ScenarioDetail`, `FeatureDetail` interfaces and `parseFeatureFilesDetailed(config)` function. Reuses the same Gherkin AST walk as `parseFeatureFiles` but extracts:
   - `feature.description` (trimmed)
   - `feature.tags[].name` (strip leading `@`)
   - Per scenario: `scenario.steps[].keyword.trim()` and `scenario.steps[].text`
   - Per scenario: `scenario.tags[].name`
   - `isOutline`: `true` if `scenario.keyword` includes `"Outline"`
   - `examples`: for outlines, extract `scenario.examples[0].tableHeader.cells[].value` as first row plus `scenario.examples[0].tableBody[].cells[].value` rows

8. **`src/cli.ts`** — Add two new imports and `program.addCommand` calls:
   ```typescript
   import { docsCommand } from './commands/docs.js';
   import { specsCommand } from './commands/specs.js';
   // ...
   program.addCommand(docsCommand());
   program.addCommand(specsCommand());
   ```

9. **`package.json`** — Add to `"dependencies"`:
   ```json
   "typedoc": "^0.27.0",
   "typedoc-plugin-markdown": "^4.0.0"
   ```

10. **`src/scaffold/templates/.opencode/commands/archive.md`** (template — per AGENTS.md rule, edit the template, not the live file; then `npm run build && npx bdd-workflow update`) — Add `npx bdd-workflow specs` regeneration step after the existing context/archive steps. The updated step 5 should read:

    > 5. Regenerate project artifacts:
    >    - Run `npx bdd-workflow context` to update `CONTEXT.md`
    >    - Run `npx bdd-workflow specs` to update `SPECS.md`

### Design decisions

- **`parseFeatureFilesDetailed` vs extending `parseFeatureFiles`**: A separate function is cleaner than adding optional parameters. The `CONTEXT.md` generator only needs names (fast); the `SPECS.md` generator needs full step detail. Keeping them separate avoids over-fetching in the common case.

- **`StepDetail`/`ScenarioDetail`/`FeatureDetail` defined in `gherkin.ts` not `generators/specs.ts`**: These interfaces describe parsed data, not presentation. They belong in the parser module. `generators/specs.ts` imports them from `gherkin.ts`.

- **TypeDoc as a runtime dependency**: `generateDocs` runs TypeDoc programmatically against the user's project. If it were a devDependency, the installed `bdd-workflow` package would not include it and the command would fail at runtime.

- **No `config.docs.entryPoint` field added yet**: The `DocsConfig` interface already has `outputDir` and `format`. The entry point will default to `'src/index.ts'`. A configurable `entryPoint` field can be added in a follow-on phase if needed.

- **Scenario Outline display**: Show the template row only (with `<param>` placeholders from Examples header), not every expanded row. This matches the phase-4 spec note: "the goal is readable specifications, not test case enumeration."

---

## 5. Risks and Considerations

- **TypeDoc version compatibility**: TypeDoc's `Application.bootstrapWithPlugins` API is available from v0.25+. The proposal targets `^0.27.0`. If a user's project pins an older version, there could be conflicts. This is an acceptable known limitation for Phase 4.

- **`typedoc-plugin-markdown` v4 breaking changes**: The plugin had significant breaking changes between v3 and v4. The proposal pins `^4.0.0` to match the design doc. Integration tests must exercise the full output pipeline.

- **Missing `src/index.ts` entry point**: `generateDocs` must check for entry point existence before calling TypeDoc and throw a clear, user-friendly error rather than letting TypeDoc emit cryptic output.

- **`parseFeatureFilesDetailed` — Gherkin AST keyword whitespace**: The `keyword` field in the Gherkin AST includes trailing whitespace (e.g., `"Given "`, `"When "`). The implementation must `.trim()` keywords before storing them.

- **Archive template edit requires build step**: Per AGENTS.md, the `archive.md` template lives in `src/scaffold/templates/`. After editing it, the apply agent must run `npm run build && npx bdd-workflow update` to propagate changes to the live `.opencode/commands/archive.md`. This must be included explicitly in the apply steps.

- **Step definition stubs**: The new feature scenarios will require new step definition files (or extensions of existing ones) in `features/support/steps/`. The apply agent must create these alongside the feature files.

- **Breaking change surface**: No breaking changes to existing public API. The `parseFeatureFiles` function signature is unchanged. New exports are purely additive.

## Outcome
- Archived: 2026-04-05
- Verdict: APPROVE
- Commit: eaa1547
