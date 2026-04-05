# Phase 6 — Polish

**Prerequisite reading**: [docs/design.md](design.md)
**Depends on**: Phases 1–5 complete

**Goal**: Make `bdd-workflow` production-ready. This phase covers configuration validation, error handling, developer experience, the README, and the full suite of utility commands identified during design. It also adds a fast subagent for mechanical subtasks to avoid burning expensive model budget.

**This phase should be implemented using the bdd-workflow itself**.

---

## Deliverables

1. Config validation with clear error messages
2. Full error handling across all CLI commands (no unhandled rejections)
3. Utility OpenCode commands: `/lint`, `/lint-docs`, `/test`, `/build`, `/build-all`
4. Fast subagent configuration for mechanical tasks
5. A `general` subagent definition (cheap model) for non-creative subtasks
6. README.md for the package
7. Full BDD test coverage for all CLI commands
8. `package.json` scripts for all common operations
9. Publishing configuration (`npm publish` ready)

---

## Config Validation

### `src/config.ts` additions

Add a `validateConfig` function that runs after loading:

```typescript
export interface ConfigError {
  field: string;
  message: string;
}

export function validateConfig(config: BddWorkflowConfig): ConfigError[] {
  const errors: ConfigError[] = [];

  if (!['typescript', 'javascript'].includes(config.language)) {
    errors.push({ field: 'language', message: `Unsupported language: ${config.language}. Supported: typescript, javascript` });
  }

  if (!config.bdd.featuresDir) {
    errors.push({ field: 'bdd.featuresDir', message: 'featuresDir is required' });
  }

  if (!config.bdd.runCommand) {
    errors.push({ field: 'bdd.runCommand', message: 'runCommand is required' });
  }

  if (!['jsdoc', 'tsdoc'].includes(config.docs.style)) {
    errors.push({ field: 'docs.style', message: `Unsupported doc style: ${config.docs.style}` });
  }

  if (!['markdown', 'html'].includes(config.docs.format)) {
    errors.push({ field: 'docs.format', message: `Unsupported format: ${config.docs.format}. Use 'markdown' or 'html'` });
  }

  return errors;
}
```

All CLI commands should call `validateConfig` after loading and print errors clearly:

```typescript
const errors = validateConfig(config);
if (errors.length > 0) {
  console.error('bdd-workflow configuration errors:');
  for (const err of errors) {
    console.error(`  ${err.field}: ${err.message}`);
  }
  process.exit(1);
}
```

---

## Error Handling

Each CLI command should handle these error classes explicitly:

| Error | Behavior |
|-------|---------|
| Missing `bdd-workflow.config.ts` | Warn and use defaults (already handled in Phase 3) |
| Missing `tsconfig.json` | Clear error: "TypeScript config not found. Run `npx tsc --init`." |
| No `.feature` files found | Print info message and exit 0 (not an error) |
| No TypeScript source files | Print info message and exit 0 |
| `gh` CLI not found (Phase 5) | Clear error: "GitHub CLI not found. Install from https://cli.github.com" |
| TypeDoc compilation failure | Print TypeDoc error output and exit 1 |
| `@cucumber/gherkin` parse failure | Print file path and line number of parse error |
| Git not initialized | For `/archive`: clear error with instructions |

---

## Utility OpenCode Commands

These commands from `notes.txt` should be added as OpenCode commands in the scaffold template. They are intentionally simple — they run shell commands and report results.

### `.opencode/commands/lint.md`

```markdown
---
description: Run the linter and report issues
---

Run the linter: !`npx eslint src/ --ext .ts 2>&1`

If there are errors, summarize them by file. If clean, confirm.
```

### `.opencode/commands/lint-docs.md`

```markdown
---
description: Check that all exported symbols have JSDoc comments
---

Run: !`npx bdd-workflow docs 2>&1`

Then check for any warnings about missing documentation. Also run:
!`npx tsc --noEmit 2>&1`

Report any files with missing JSDoc on exported symbols.
```

### `.opencode/commands/test.md`

```markdown
---
description: Run BDD tests and report results
---

Run: !`npx cucumber-js 2>&1`

Summarize the results: scenarios passing, failing, pending. If any fail, show the failing scenario names and error messages.
```

### `.opencode/commands/build.md`

```markdown
---
description: Compile TypeScript and check for errors
---

Run: !`npx tsc --noEmit 2>&1`

Report type errors if any. If clean, confirm.
```

### `.opencode/commands/build-all.md`

```markdown
---
description: Full build: typecheck, lint, test, generate docs and context
---

Run all quality checks in sequence:

1. TypeScript: !`npx tsc --noEmit 2>&1`
2. Lint: !`npx eslint src/ --ext .ts 2>&1`
3. Tests: !`npx cucumber-js 2>&1`
4. Context: !`npx bdd-workflow context 2>&1`
5. Specs: !`npx bdd-workflow specs 2>&1`
6. Docs: !`npx bdd-workflow docs 2>&1`

Report a summary for each step. Stop and report if any step fails.
```

---

## Fast `general` Subagent

From `notes.txt`: "add a general agent for subtasks so we don't use claude for that sh*t"

Add `.opencode/agents/general.md` to the scaffold template:

```markdown
---
description: Fast subagent for mechanical subtasks that don't require creative reasoning
mode: subagent
model: anthropic/claude-haiku-4-5
---

You are a fast, efficient assistant for mechanical tasks. You:
- Execute clearly specified tasks without embellishment
- Do not explain your reasoning unless asked
- Do not add features or improvements beyond what was asked
- Respond concisely

Use this agent for: file renaming, formatting fixes, simple search/replace,
generating boilerplate, running commands and reporting output.
```

Update the `bdd-workflow` master skill to reference the general agent:

```markdown
## Model Guidance

Use the `@general` subagent for mechanical tasks that don't require reasoning:
- Renaming files or variables
- Formatting and style fixes
- Simple boilerplate generation
- Running commands and summarizing output

Reserve the main agent for design, proposal writing, and complex implementation.
```

---

## `package.json` Scripts

The scaffold template's `package.json` should include:

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "cucumber-js",
    "test:watch": "cucumber-js --watch",
    "lint": "eslint src/ --ext .ts",
    "docs": "bdd-workflow docs",
    "specs": "bdd-workflow specs",
    "context": "bdd-workflow context",
    "check": "tsc --noEmit && eslint src/ --ext .ts",
    "check:all": "tsc --noEmit && eslint src/ --ext .ts && cucumber-js"
  }
}
```

---

## README

Write `README.md` for the `bdd-workflow` package covering:

1. **What it is** — one paragraph
2. **The three-layer model** — WHY/WHAT/HOW table
3. **Quick start** — `npx bdd-workflow init`, then how to use in OpenCode
4. **The workflow** — visual diagram of the step sequence
5. **Commands reference** — all CLI commands with options
6. **OpenCode commands reference** — all slash commands
7. **Configuration** — `bdd-workflow.config.ts` with all options documented
8. **Context generation** — what CONTEXT.md is and how to keep it current
9. **Contributing learnings** — how to use `/learn` and `learn promote`
10. **Language support** — current: TypeScript; planned: Go, Python

---

## Full BDD Test Coverage

By end of Phase 6, the `bdd-workflow` package itself should have BDD scenarios covering:

| Feature | Key Scenarios |
|---------|---------------|
| `init` command | New project scaffold, add to existing, skip existing files |
| `context` command | Full generation, empty project, no features, no JSDoc |
| `docs` command | Markdown output, HTML output, no entry point |
| `specs` command | Full output, empty features dir, Scenario Outlines |
| `learn list` | Lists entries, shows status and issue numbers |
| `learn promote` | Creates issues, idempotent, dry run |
| Config validation | Valid config, invalid language, missing fields |

---

## Acceptance Criteria

- [ ] `npm run check:all` passes in the `bdd-workflow` package itself
- [ ] All 5 utility commands exist in a scaffolded project's `.opencode/commands/`
- [ ] `general` subagent exists in a scaffolded project's `.opencode/agents/`
- [ ] Config validation catches and reports all invalid configurations
- [ ] No unhandled promise rejections in any CLI command path
- [ ] README.md covers all commands and configuration options
- [ ] BDD test coverage for all deliverable items above
- [ ] `npm pack` produces a package that works when installed globally
- [ ] `npx bdd-workflow --version` prints the correct version
- [ ] All error messages include actionable guidance (not just error codes)

---

## Notes

- ESLint is listed in the utility commands but is not a required dependency of `bdd-workflow` — it is an optional devDependency in the scaffolded project. The `/lint` command should handle the case where ESLint is not installed.
- The README should include a `## Status` section noting that this is pre-1.0 and the API is unstable.
- Publishing to npm (`npm publish`) should be done manually by the maintainer, not automated in this phase. A `CHANGELOG.md` and version bump procedure should be documented in the README.
- After Phase 6 is complete, open issues on this repo for Go language support and Python language support (using the `/learn promote` mechanism as a test of the system).
