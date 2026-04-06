# bdd-workflow

**Agentic BDD development workflow framework for TypeScript projects.**

`bdd-workflow` scaffolds an AI-agent–driven development loop on top of your TypeScript project. Every change follows a structured sequence: **propose → apply → review → (amend) → archive**, with Gherkin feature files and JSDoc comments as first-class citizens of the workflow.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Workflow](#workflow)
- [npm Scripts](#npm-scripts)
- [Publishing](#publishing)

---

## Overview

`bdd-workflow` provides:

- **Scaffolding** (`init`) — creates `.opencode/` agents, skills and commands, `features/` support structure, config files, and starter templates.
- **Context generation** (`context`) — builds `CONTEXT.md` from JSDoc comments, Gherkin feature files, and TypeScript exports.
- **Spec generation** (`specs`) — builds `SPECS.md` from all `.feature` files as a human-readable behavioral specification.
- **Docs generation** (`docs`) — generates API documentation via TypeDoc (markdown or HTML).
- **Verification gate** (`check`) — runs `npx tsc --noEmit` then `npx cucumber-js`; intended as the canonical pre-review gate.
- **Learning management** (`learn`) — lists and promotes learning entries to GitHub issues.
- **Scaffold update** (`update`) — refreshes framework-owned scaffold files to the latest template version using a three-way diff.
- **Config validation** (`validateConfig`) — all CLI commands validate configuration on startup and report errors with actionable messages.

---

## Installation

```bash
npm install --save-dev bdd-workflow
```

Or initialize a new project in an empty directory:

```bash
npx bdd-workflow init <target-directory>
```

---

## Quick Start

```bash
# 1. Initialize a new project
npx bdd-workflow init my-project
cd my-project

# 2. Install dependencies
npm install

# 3. Verify the scaffold works
npm run check
```

---

## CLI Commands

### `bdd-workflow init <directory>`

Scaffolds a new project with all required files and directories. Skips existing files to avoid overwriting customizations.

```bash
npx bdd-workflow init ./my-project
```

### `bdd-workflow context`

Regenerates `CONTEXT.md` from TypeScript source files (JSDoc), Gherkin feature files, and public API exports. Run after making significant structural changes.

```bash
npx bdd-workflow context
```

### `bdd-workflow specs`

Generates `SPECS.md` — a human-readable behavioral specification derived from all `.feature` files.

```bash
npx bdd-workflow specs
# or write to a custom path:
npx bdd-workflow specs --output docs/SPECS.md
```

### `bdd-workflow docs`

Generates API documentation from JSDoc comments using TypeDoc.

```bash
# Markdown (default):
npx bdd-workflow docs

# HTML:
npx bdd-workflow docs --format html
```

### `bdd-workflow check`

Runs the full verification suite: `npx tsc --noEmit` then `npx cucumber-js`. Exits non-zero if either step fails. This is the canonical pre-review gate.

```bash
npx bdd-workflow check
```

### `bdd-workflow update`

Refreshes framework-owned scaffold files (agents, commands, skills, templates) to match the current version of the `bdd-workflow` package. User-modified files are preserved.

```bash
npx bdd-workflow update
# force-overwrite user-modified files:
npx bdd-workflow update --force
```

### `bdd-workflow learn list`

Lists all learning entries in `.opencode/learnings/`.

```bash
npx bdd-workflow learn list
```

### `bdd-workflow learn promote`

Promotes unpromoted learning entries (status: new) to GitHub issues using the `gh` CLI. Requires `gh` to be installed and authenticated.

```bash
# Dry run (no issues created):
npx bdd-workflow learn promote --dry-run

# Live:
npx bdd-workflow learn promote
```

---

## Configuration

Create `bdd-workflow.config.ts` in your project root:

```typescript
import { defineConfig } from 'bdd-workflow';

export default defineConfig({
  language: 'typescript',          // 'typescript' | 'javascript'
  bdd: {
    featuresDir: 'features',
    stepsDir: 'features/support/steps',
    runCommand: 'npx cucumber-js',
  },
  docs: {
    style: 'jsdoc',               // 'jsdoc' | 'tsdoc'
    format: 'markdown',           // 'markdown' | 'html'
    outputDir: 'docs',
  },
  context: {
    outputFile: 'CONTEXT.md',
    include: ['src/**/*.ts', 'features/**/*.feature'],
    exclude: ['node_modules', 'dist'],
    sections: {
      structure: true,
      moduleSummaries: true,
      featureSummaries: true,
      exports: true,
    },
  },
  workflow: {
    maxAmendIterations: 3,
    proposalDir: '.opencode/proposals',
    learningsDir: '.opencode/learnings',
    repository: 'owner/repo',     // for learn promote
  },
});
```

All fields are optional — defaults are applied for any omitted values.

### Config Validation

All CLI commands call `validateConfig` immediately after loading configuration. If any field value is unsupported, the command prints all errors and exits 1:

```
bdd-workflow configuration errors:
  language: Unsupported language: "ruby". Supported: typescript, javascript
```

You can also call `validateConfig` programmatically:

```typescript
import { defineConfig, validateConfig } from 'bdd-workflow';

const config = defineConfig({ language: 'ruby' as any });
const errors = validateConfig(config);
// errors = [{ field: 'language', message: 'Unsupported language: "ruby"...' }]
```

---

## Project Structure

After `bdd-workflow init`, your project will have:

```
.opencode/
  agents/           # AI agent definitions (bdd-workflow, review)
  commands/         # Slash command definitions (/propose, /apply, /review, …)
  skills/           # Skill definitions (bdd-workflow, bdd-propose, bdd-review)
  proposals/        # Active proposals (markdown)
    completed/      # Archived proposals
  learnings/        # Learning entries (markdown with frontmatter)
  templates/        # Proposal, review, and learning templates
features/
  support/
    hooks.ts        # Cucumber hooks
    world.ts        # Cucumber world
    steps/          # Step definition files (*.steps.ts)
src/
  index.ts          # Your project entry point
bdd-workflow.config.ts
cucumber.js
tsconfig.json
package.json
CONTEXT.md
SPECS.md
```

---

## Workflow

The agentic BDD workflow follows this sequence:

```
explore (optional) → propose → [human approval]
→ apply → review → amend (if needed) → [human approval]
→ archive
```

1. **Propose** — AI writes a proposal in `.opencode/proposals/` describing the change.
2. **Apply** — AI implements the proposal (feature files + implementation + JSDoc).
3. **Review** — AI runs `bdd-workflow check`, writes a review file, and gives a verdict.
4. **Amend** — AI fixes issues from the review. Repeats until APPROVE.
5. **Archive** — Proposal is moved to `.opencode/proposals/completed/` and `CONTEXT.md` is updated.

Each AI command is available as a slash command in your editor (e.g. `/propose <goal>`, `/apply`, `/review`, `/archive`).

---

## npm Scripts

The scaffolded `package.json` includes:

| Script | Command | Description |
|---|---|---|
| `build` | `tsc` | Compile TypeScript |
| `build:watch` | `tsc --watch` | Watch-mode compilation |
| `test` | `cucumber-js` | Run Cucumber tests |
| `test:watch` | `cucumber-js --watch` | Watch-mode tests |
| `docs` | `bdd-workflow docs` | Generate API docs |
| `specs` | `bdd-workflow specs` | Generate SPECS.md |
| `context` | `bdd-workflow context` | Regenerate CONTEXT.md |
| `check` | `bdd-workflow check` | Type-check + test (pre-review gate) |
| `check:all` | `tsc --noEmit && bdd-workflow check` | Full verification suite |

---

## Publishing

`bdd-workflow` is ready to publish to npm. The `files` field in `package.json` includes only the compiled `dist/` directory. Before publishing:

1. Run `npm run build` to compile TypeScript and copy template files.
2. Run `npm run check` to verify type-check and tests pass.
3. Update the `version` field in `package.json`.
4. Run `npm publish`.

```bash
npm run build && npm run check && npm publish
```
