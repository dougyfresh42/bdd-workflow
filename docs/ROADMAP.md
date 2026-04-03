# bdd-workflow Roadmap

## What This Is

`bdd-workflow` is an agentic development workflow framework built on OpenCode. It enforces a three-layer code quality model:

| Layer | Artifact | Purpose |
|-------|----------|---------|
| **WHY** | JSDoc comments | Module/function purpose and design intent |
| **WHAT** | Gherkin `.feature` files | Behavioral specifications |
| **HOW** | Source code | Implementation |

Every change goes through: `explore (optional) → propose → apply → review → amend (optional) → learn (optional) → archive`

The framework installs into any TypeScript/Node project via `npx bdd-workflow init`. Because every change requires doc comments and BDD specs as first-class deliverables, the codebase stays self-documenting — enabling a programmatic context file (`CONTEXT.md`) that gives AI agents full project understanding without exploration.

## Design Reference

Full architecture, decisions, and rationale: **[docs/design.md](docs/design.md)**

## Phases

| Phase | Title | Status | File |
|-------|-------|--------|------|
| 1 | NPM Package Scaffold | pending | [docs/phase-1.md](docs/phase-1.md) |
| 2 | OpenCode Skills + Commands | pending | [docs/phase-2.md](docs/phase-2.md) |
| 3 | Context Generation | pending | [docs/phase-3.md](docs/phase-3.md) |
| 4 | Doc + Spec Generation | pending | [docs/phase-4.md](docs/phase-4.md) |
| 5 | Learn System | pending | [docs/phase-5.md](docs/phase-5.md) |
| 6 | Polish | pending | [docs/phase-6.md](docs/phase-6.md) |

## Bootstrap Point

> **After Phase 2 is complete, this repository can use `bdd-workflow` for its own development.**
>
> At that point: run `npx bdd-workflow init` in this repo (or apply the scaffold manually since Phase 1 will have built it), and all subsequent phases (3–6) should be implemented using the `/propose → /apply → /review → /archive` workflow defined in Phase 2.
>
> This is the intended self-hosting milestone. See [docs/phase-2.md](docs/phase-2.md) for the handoff checklist.

## Key Decisions

- **Language**: TypeScript first; config parameterized for future Go/Python support
- **BDD**: Cucumber.js with Gherkin `.feature` files
- **Docs**: JSDoc + TypeDoc + `typedoc-plugin-markdown`
- **Proposals**: Timestamped filenames (`2026-04-02-slug.md`)
- **Context file**: `CONTEXT.md` at project root, listed in `opencode.json` instructions
- **Apply step**: Single agent run (reads proposal, implements all at once)
- **Learn storage**: Local `.opencode/learnings/`, promotable to GitHub issues via `/learn promote`
- **Archive**: Git commit + move proposal to `completed/` + regenerate context

## Notes (from initial design session)

From `notes.txt` — incorporated into the relevant phases:

- Add a fast/cheap "general" subagent for subtasks (avoid burning expensive models on mechanical work) — see Phase 2
- Useful commands to expose as OpenCode slash commands: `!lint-docs`, `!lint`, `!test`, `!test-lint-all`, `!archive`, `!doc-build`, `!test-build`, `!build`, `!build-all` — see Phase 2 and Phase 6
