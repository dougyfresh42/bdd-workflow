# Agent Rules for the bdd-workflow Repo

These rules apply to agents working in THIS repository only. They supplement the
bdd-workflow skill.

## Template-first editing rule

Every framework Markdown file exists in two places:

- **Template** (source of truth): `src/scaffold/templates/.opencode/...`
- **Live** (in use by this project): `.opencode/...`

**Always edit the template file. Never edit the live `.opencode/` file directly.**

After editing templates, run:

    npm run build && npx bdd-workflow update

The build step is required because `bdd-workflow update` reads compiled templates from
`dist/`, not from `src/scaffold/templates/` directly.

`bdd-workflow update` performs a three-way diff and safely overwrites unmodified live
files while preserving any local customisations.
