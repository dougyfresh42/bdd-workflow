# bdd-workflow — Architecture & Design

This document is the authoritative design reference. It contains the full architecture, rationale, and decisions made during the initial planning session. All phase documents derive from this.

---

## Core Philosophy

Every change in a project using `bdd-workflow` must produce three artifacts:

| Layer | Artifact | Question Answered |
|-------|----------|-------------------|
| **WHY** | JSDoc comments on modules and functions | Why does this exist? What problem does it solve? |
| **WHAT** | Gherkin `.feature` files | What should it do? What are the behavioral contracts? |
| **HOW** | Source code | How is it implemented? |

These three layers are enforced by the workflow. The proposal step must include all three before any code is written. The review step verifies all three are present and consistent.

**Why this matters for AI context**: Because every module has a JSDoc comment (the WHY) and every behavior has a `.feature` file (the WHAT), a simple script — not an agent — can generate a complete codebase summary (`CONTEXT.md`). This eliminates the common pattern of an AI agent starting every session with "let me explore the codebase" and burning context/tokens on exploration that could have been precomputed.

---

## The Workflow

```
explore (optional) → propose → apply → review → amend (optional) → learn (optional) → archive
```

### Step Definitions

#### Explore (optional)
- **When to use**: Unfamiliar codebase, or `CONTEXT.md` doesn't provide sufficient detail for the goal
- **Model**: Fast/cheap (e.g. `claude-haiku`) — this step should be quick
- **OpenCode implementation**: Uses the built-in `explore` subagent
- **Input**: User's goal or question
- **Output**: A summary of relevant code areas, which gets prepended to the proposal prompt
- **Skip condition**: If `CONTEXT.md` is up to date, exploration is usually unnecessary

#### Propose
- **Model**: Strong reasoning (e.g. `claude-sonnet` or `claude-opus`)
- **OpenCode implementation**: `/propose` command + `bdd-propose` skill
- **Input**: User's goal + `CONTEXT.md` + any explore output
- **Output**: A proposal document at `.opencode/proposals/YYYY-MM-DD-slug.md` containing:
  1. **Summary** — what and why in plain language
  2. **Doc updates** — exact JSDoc comments to add or modify (the WHY layer)
  3. **BDD specs** — new or modified `.feature` files with complete scenarios (the WHAT layer)
  4. **Implementation plan** — files to create/modify, approach, key decisions (the HOW layer)
  5. **Risks and considerations** — edge cases, breaking changes, dependencies
- **Constraint**: The proposal is complete specification before any code is written. The apply step must not make design decisions not present in the proposal.

#### Apply
- **Model**: Strong coding model (e.g. `claude-sonnet`)
- **OpenCode implementation**: `/apply` command
- **Mode**: Single agent run — reads the latest proposal, implements everything at once
- **Input**: The approved proposal document (latest by timestamp, or specified by argument)
- **Output**:
  - Source code with JSDoc comments matching the proposal's doc updates
  - `.feature` files matching the proposal's BDD specs
  - Step definitions for all new scenarios
  - TypeScript types passing `tsc --noEmit`
- **Constraint**: Apply is mechanical. All design decisions were made in Propose. If the proposal is ambiguous, Apply should fail and ask for clarification rather than invent behavior.

#### Review
- **Model**: Strong reasoning, low temperature (temp=0.1)
- **OpenCode implementation**: `review` subagent with restricted permissions
- **Permissions**: Read-only. Can run `git diff`, `git log`, `git show`, `npx cucumber-js`, `npx tsc --noEmit`. Cannot edit files or run arbitrary bash.
- **Input**: The proposal document + the diff of applied changes
- **Output**: A review document covering:
  1. **Completeness** — are all proposal items implemented?
  2. **Doc check** — do JSDoc comments match the proposal's WHY?
  3. **Spec check** — do `.feature` files match the proposal's WHAT?
  4. **Test check** — do `npx cucumber-js` tests pass?
  5. **Type check** — does `npx tsc --noEmit` pass?
  6. **Consistency** — does the implementation match the specs?
  7. **Verdict**: `APPROVE`, `AMEND` (with specific issues listed), or `REJECT`
- **Key design**: The reviewer is a different agent with different permissions from the implementer. It acts as a second pair of eyes.

#### Amend (optional, triggered by review)
- **Model**: Same as Apply
- **OpenCode implementation**: `/amend` command
- **Trigger**: Review verdict is `AMEND`
- **Input**: Review feedback + original proposal + current code state
- **Output**: Corrected code changes addressing each review issue
- **Loop**: After amend completes, review runs again automatically. Maximum iterations: 3 (configurable). If max reached without APPROVE, the workflow halts and prompts the user.

#### Learn (optional)
- **Model**: Strong reasoning
- **OpenCode implementation**: `/learn` command
- **Trigger**: User explicitly invokes it, OR the review required more than 1 amendment, OR the implementation diverged significantly from the proposal
- **Input**: Original proposal + final implementation + full review/amend history + optional user feedback
- **Output**: A learning entry at `.opencode/learnings/YYYY-MM-DD-slug.md` containing:
  1. What diverged from the proposal and why
  2. What friction points occurred during the workflow
  3. Specific proposed modification to skills, templates, or workflow steps
- **Storage**: Local-first in `.opencode/learnings/`
- **Promotion**: `/learn promote` creates a GitHub issue on the `bdd-workflow` repository with accumulated learnings, then marks them as promoted
- **Key design**: This is a meta-feedback loop. The framework improves itself based on real usage friction. The learn step produces proposals to modify `bdd-workflow` itself.

#### Archive
- **Model**: Fast/cheap (e.g. `claude-haiku`)
- **OpenCode implementation**: `/archive` command
- **Trigger**: Review verdict is `APPROVE`
- **Input**: Completed proposal + implementation
- **Output**:
  1. Git commit with conventional commit message derived from the proposal summary
  2. Optional git tag if the proposal indicated a release
  3. Proposal file moved from `.opencode/proposals/` to `.opencode/proposals/completed/` with outcome metadata appended
  4. `CONTEXT.md` regenerated to reflect new code state
- **Key design**: Archive is the "done" gate. Nothing is considered complete until archived.

---

## Project Directory Structure

After `npx bdd-workflow init`, a project looks like:

```
my-project/
├── .opencode/
│   ├── agents/
│   │   └── review.md               # Review subagent (restricted permissions)
│   ├── commands/
│   │   ├── propose.md              # /propose
│   │   ├── apply.md                # /apply [proposal-date-slug]
│   │   ├── review.md               # /review
│   │   ├── amend.md                # /amend
│   │   ├── learn.md                # /learn [feedback]
│   │   ├── archive.md              # /archive [message]
│   │   └── context.md              # /context - regenerate CONTEXT.md
│   ├── skills/
│   │   ├── bdd-workflow/
│   │   │   └── SKILL.md            # Master workflow skill
│   │   ├── bdd-propose/
│   │   │   └── SKILL.md            # Proposal-writing skill
│   │   └── bdd-review/
│   │       └── SKILL.md            # Review criteria skill
│   ├── proposals/
│   │   └── completed/              # Archived proposals
│   ├── learnings/                  # Meta-feedback entries
│   └── templates/
│       ├── proposal.md             # Proposal template
│       ├── review.md               # Review template
│       └── learning.md             # Learning entry template
├── features/
│   ├── support/
│   │   ├── steps/                  # Step definitions (*.steps.ts)
│   │   ├── hooks.ts
│   │   └── world.ts
│   └── .gitkeep
├── src/
│   └── index.ts                    # Entry point with @module JSDoc
├── docs/                           # Generated (typedoc output)
├── CONTEXT.md                      # Auto-generated codebase context (tracked in git)
├── SPECS.md                        # Auto-generated spec summary (tracked in git)
├── opencode.json                   # OpenCode configuration
├── cucumber.js                     # Cucumber configuration
├── typedoc.json                    # TypeDoc configuration
├── bdd-workflow.config.ts          # Framework configuration
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## Configuration (`bdd-workflow.config.ts`)

```typescript
import { defineConfig } from 'bdd-workflow';

export default defineConfig({
  // Language/ecosystem (parameterized for future Go/Python support)
  language: 'typescript',

  // BDD testing
  bdd: {
    framework: 'cucumber',          // 'cucumber' | future: 'godog' | 'behave'
    featuresDir: 'features',
    stepsDir: 'features/support/steps',
    runCommand: 'npx cucumber-js',
  },

  // Documentation
  docs: {
    style: 'jsdoc',                 // 'jsdoc' | 'tsdoc' | future: 'godoc' | 'pydoc'
    generator: 'typedoc',           // 'typedoc' | future: 'godoc' | 'sphinx'
    outputDir: 'docs',
    format: 'markdown',             // 'markdown' | 'html'
  },

  // Context generation (CONTEXT.md)
  context: {
    outputFile: 'CONTEXT.md',
    include: ['src/**/*', 'features/**/*.feature'],
    exclude: ['node_modules', 'dist', 'docs'],
    sections: {
      structure: true,              // Directory tree
      moduleSummaries: true,        // JSDoc @module / file-level comments
      featureSummaries: true,       // Gherkin Feature + Scenario names
      exports: true,                // Public API signatures
    },
  },

  // Workflow behavior
  workflow: {
    maxAmendIterations: 3,
    autoReviewAfterApply: true,
    autoContextAfterArchive: true,
    proposalDir: '.opencode/proposals',
    learningsDir: '.opencode/learnings',
  },

  // Model assignments (overridden per-step in opencode.json if desired)
  models: {
    explore:  'anthropic/claude-haiku-4-5',
    propose:  'anthropic/claude-sonnet-4-5',
    apply:    'anthropic/claude-sonnet-4-5',
    review:   'anthropic/claude-sonnet-4-5',
    amend:    'anthropic/claude-sonnet-4-5',
    learn:    'anthropic/claude-sonnet-4-5',
    archive:  'anthropic/claude-haiku-4-5',
  },
});
```

---

## `opencode.json` (generated by init)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "instructions": ["CONTEXT.md"],
  "agent": {
    "review": {
      "model": "anthropic/claude-sonnet-4-5",
      "temperature": 0.1
    }
  },
  "command": {
    "propose":  { "description": "Draft a proposal for a new change" },
    "apply":    { "description": "Implement the latest proposal" },
    "review":   { "description": "Review applied changes against the proposal", "agent": "review" },
    "amend":    { "description": "Revise implementation based on review feedback" },
    "learn":    { "description": "Capture a learning or feedback about the workflow" },
    "archive":  { "description": "Commit, archive proposal, regenerate context" },
    "context":  { "description": "Regenerate CONTEXT.md" }
  }
}
```

---

## CONTEXT.md Structure

Generated by `npx bdd-workflow context` (a script, not an agent). Sections:

### 1. Project Overview
Extracted from `package.json` description + root-level `@module` JSDoc in `src/index.ts`.

### 2. Directory Structure
File tree of `src/` and `features/`, excluding generated/vendor files.

### 3. Module Summaries
For each source file, the file-level JSDoc comment (the WHY):
```markdown
## Modules
- `src/auth/session.ts` — Manages user session lifecycle, including creation, validation, and expiry.
- `src/auth/tokens.ts` — JWT token generation and verification for stateless authentication.
```

### 4. Feature Summaries
Parsed from `.feature` files via `@cucumber/gherkin`:
```markdown
## Features
### Authentication (features/auth.feature)
- Scenario: User logs in with valid credentials
- Scenario: User is rejected with invalid password
- Scenario: Session expires after timeout
```

### 5. Public API
Exported function/class signatures extracted via TypeScript compiler API:
```markdown
## Public API
### src/auth/session.ts
- `createSession(userId: string, opts?: SessionOpts): Promise<Session>`
- `validateSession(token: string): Promise<SessionInfo | null>`
```

The context file is tracked in git. Because every change in the workflow produces JSDoc comments and `.feature` files, running `/context` after each archive keeps it accurate. It is listed in `opencode.json` under `instructions` so it is automatically loaded into every session.

---

## Language Parameterization

The `language` field in `bdd-workflow.config.ts` controls ecosystem-specific behavior:

| Aspect | TypeScript (Phase 1) | Go (future) | Python (future) |
|--------|---------------------|-------------|-----------------|
| BDD framework | `@cucumber/cucumber` | `godog` | `behave` |
| Doc comment style | JSDoc / TSDoc | godoc `//` comments | docstrings |
| Doc generator | TypeDoc | `go doc` | Sphinx |
| Test runner | `npx cucumber-js` | `go test ./...` | `behave` |
| Package config | `package.json` | `go.mod` | `pyproject.toml` |
| Context parser | TypeScript compiler API | `go/ast` | `ast` module |

Gherkin `.feature` files and scenario syntax are identical across all languages — this is intentional. The behavioral specification layer is language-agnostic.

The CLI scaffolding for TypeScript is built in Phase 1. Adding Go or Python later means: adding a new `language` option to the config, new scaffold templates, and new context/doc generation adapters for that language.

---

## NPM Package Structure

```
bdd-workflow/                       # This repository
├── src/
│   ├── cli.ts                      # CLI entry point (commander)
│   ├── commands/
│   │   ├── init.ts                 # Project scaffolding
│   │   ├── context.ts              # CONTEXT.md generation
│   │   ├── docs.ts                 # Doc generation (wraps typedoc)
│   │   └── specs.ts                # SPECS.md generation
│   ├── generators/
│   │   ├── context.ts              # CONTEXT.md assembly logic
│   │   ├── specs.ts                # SPECS.md assembly logic
│   │   └── structure.ts            # Directory tree generation
│   ├── parsers/
│   │   ├── gherkin.ts              # .feature file parser (@cucumber/gherkin)
│   │   ├── jsdoc.ts                # JSDoc comment extractor
│   │   └── typescript.ts           # TS export signature extractor (compiler API)
│   ├── scaffold/                   # Templates for `init` command
│   │   ├── opencode/               # .opencode/ directory templates
│   │   │   ├── agents/
│   │   │   ├── commands/
│   │   │   ├── skills/
│   │   │   └── templates/
│   │   ├── features/               # features/ directory template
│   │   └── config/                 # Config file templates
│   └── config.ts                   # Config loader (defineConfig)
├── docs/                           # This framework's own design docs (you are here)
├── ROADMAP.md
├── package.json
└── tsconfig.json
```

### CLI Commands

```bash
npx bdd-workflow init [dir]         # Scaffold into dir (or cwd if omitted)
npx bdd-workflow context            # Regenerate CONTEXT.md
npx bdd-workflow docs               # Generate documentation (typedoc)
npx bdd-workflow specs              # Generate SPECS.md from .feature files
npx bdd-workflow learn promote      # Create GitHub issues from .opencode/learnings/
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@cucumber/cucumber` | BDD test runner |
| `@cucumber/gherkin` | `.feature` file parser (for context/spec generation) |
| `@cucumber/messages` | Gherkin message types |
| `typedoc` | API documentation generator |
| `typedoc-plugin-markdown` | TypeDoc markdown output |
| `typescript` | Compiler API for signature extraction |
| `commander` | CLI argument parsing |
| `glob` | File pattern matching |
| `gray-matter` | YAML frontmatter parsing (proposal files) |

---

## OpenCode Skill Format Reference

Skills live at `.opencode/skills/<name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: bdd-workflow
description: Guides the BDD workflow for this project
license: MIT
compatibility: opencode
---
```

Skills are loaded lazily by the agent when needed via the `skill` tool.

## OpenCode Command Format Reference

Commands live at `.opencode/commands/<name>.md`:

```yaml
---
description: Draft a proposal for a new change
model: anthropic/claude-sonnet-4-5
---

Load the `bdd-propose` skill and create a proposal for: $ARGUMENTS
```

Commands support `$ARGUMENTS`, `$1`, `$2` for arguments, and `` !`shell command` `` for injecting shell output into the prompt.

## OpenCode Agent Format Reference

Agents live at `.opencode/agents/<name>.md`:

```yaml
---
description: Reviews applied changes against the proposal
mode: subagent
model: anthropic/claude-sonnet-4-5
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": deny
    "git diff*": allow
    "git log*": allow
    "npx cucumber-js*": allow
    "npx tsc --noEmit*": allow
---
```
