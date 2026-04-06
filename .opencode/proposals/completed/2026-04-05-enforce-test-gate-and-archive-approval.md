# Proposal: Enforce Pre-Review Test Gate and Explicit Archive Approval

Date: 2026-04-05
Learning: `.opencode/learnings/2026-04-05-tests-must-pass-before-review-and-archive-requires-explicit-approval.md`

---

## Summary

Two process failures from the Phase 3 workflow cycle are codified as hard rules, and
two workflow meta-rules specific to this repo are captured in a permanent auto-loaded
reference file.

**Change 1 — Pre-review test gate (`npx bdd-workflow check`)**
A new `check` subcommand is added to the `bdd-workflow` CLI. It runs `tsc --noEmit`
followed by `npx cucumber-js`. Skill and command files reference `npx bdd-workflow
check` — a single, versioned, self-contained command that agents can invoke without
knowing the project's `package.json` scripts. Because the agent files are shipped by
`bdd-workflow`, using a `bdd-workflow` subcommand keeps the whole check gate
self-contained within the framework.

**Change 2 — Archive approval gate**
After an APPROVE verdict the bdd-workflow agent must stop, print the review file path,
and explicitly ask the user before archiving. The current wording says archive "requires
explicit confirmation" but does not say "stop and ask" — this proposal closes that gap.

**Change 3 — `AGENTS.md` at repo root**
Two rules are specific to _this_ repo and have had to be re-stated twice:
- Always edit scaffold templates first; run `bdd-workflow update` to propagate to live
  `.opencode/` files. Never edit live files directly.
- `npx bdd-workflow check` must pass before handing off to review.

An `AGENTS.md` at the repo root is loaded automatically by OpenCode each session,
making these rules ambient context.

User-visible impact: a new `bdd-workflow check` subcommand is available; agents use it
as the single pre-review gate; agents stop and ask before archiving; `AGENTS.md`
prevents future re-explanation of the template-first rule.

---

## Doc Updates (WHY layer)

### New module: `src/commands/check.ts`

```typescript
/**
 * @module commands/check
 * @description Implements the `bdd-workflow check` CLI subcommand. Runs the
 * project's full verification suite — type-check followed by the Cucumber test
 * suite — and exits non-zero if either step fails. Intended as the canonical
 * pre-review gate referenced by the bdd-workflow skill and command files.
 * Does NOT run the build — type-checking is performed via `tsc --noEmit` only.
 */
```

### Updated module: `src/cli.ts`

The existing file-level JSDoc is just `CLI entry point for bdd-workflow.` — no change
needed, but the `checkCommand` import and `addCommand` call must be added.

---

## BDD Specs (WHAT layer)

### New feature: `features/check.feature`

```gherkin
Feature: bdd-workflow check command

  As a developer using bdd-workflow,
  I want to run `bdd-workflow check` to verify my project before review,
  So that I have a single canonical pre-review gate that type-checks and runs tests.

  Scenario: check subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output includes "check"

  Scenario: check passes when type-check and tests both pass
    Given a project directory initialized with bdd-workflow
    When I run "bdd-workflow check" in that directory
    Then the command exits with status 0

  Scenario: check fails when tsc reports type errors
    Given a project directory initialized with bdd-workflow
    And the file "src/index.ts" contains a type error
    When I run "bdd-workflow check" in that directory
    Then the command exits with a non-zero status

  Scenario: check fails when cucumber tests fail
    Given a project directory initialized with bdd-workflow
    And a failing Cucumber scenario exists
    When I run "bdd-workflow check" in that directory
    Then the command exits with a non-zero status
```

### Modify: `features/scaffold-phase2.feature`

Add two new scenarios verifying that the updated wording appears in the scaffold output.
Both reuse existing step definitions (`contains text "..."`) — no new step definitions
needed.

```gherkin
  Scenario: bdd-workflow skill references npx bdd-workflow check for the pre-review gate
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" contains text "npx bdd-workflow check"

  Scenario: bdd-workflow skill enforces explicit archive approval gate
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" contains text "STOP after printing"
    And the file ".opencode/agents/bdd-workflow.md" contains text "STOP immediately"
```

---

## Implementation Plan (HOW layer)

### Editing convention

All Markdown file changes (Files 2–5 below) must be made to the scaffold templates
under `src/scaffold/templates/`. After saving, run `npm run build && npx bdd-workflow
update` to propagate changes to the live `.opencode/` files. Do not edit live files
directly. (`npm run build` is required because `update` reads compiled templates from
`dist/`, not from `src/scaffold/templates/` directly.)

`AGENTS.md` (File 6) and TypeScript source files (Files 1, 7) are edited directly —
they are not scaffold template files.

---

### File 1 — `src/commands/check.ts` (new file)

Implement the `check` subcommand. It should:

1. Spawn `tsc --noEmit` as a child process, inheriting stdio.
2. If it exits non-zero, print a clear error message and exit with the same code.
3. Spawn `npx cucumber-js` as a child process, inheriting stdio.
4. If it exits non-zero, exit with the same code.
5. On full success, print a brief "check passed" message and exit 0.

Use Node's `child_process.spawnSync` (synchronous, simple, no streaming complexity
needed for a check command). Both commands should run from `process.cwd()`.

Export a `checkCommand(): Command` function following the same pattern as the existing
`initCommand`, `updateCommand`, and `contextCommand`.

---

### File 2 — `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md`

In `## When to Use Each Step`, replace the `apply`, `amend`, and `archive` bullets.

**Current `apply`:**
> - **apply**: Only after a proposal exists and has been reviewed by the user

**Replace with:**
> - **apply**: Only after a proposal exists and has been reviewed by the user. Before
>   handing off to review, **run `npx bdd-workflow check` and confirm it passes.** Do
>   not proceed to review if it fails — fix the failures first (that is still part of
>   apply, not amend).

**Current `amend`:**
> - **amend**: When review verdict is AMEND

**Replace with:**
> - **amend**: When review verdict is AMEND. After making fixes, **run `npx bdd-workflow
>   check` and confirm it passes before re-running review.** A failing check after amend
>   means the amend is not complete — do not hand off to review until green.

**Current `archive`:**
> - **archive**: When review verdict is APPROVE. Archive requires `--approved` flag or
>   explicit confirmation via the bdd-workflow agent — it will not proceed without it.

**Replace with:**
> - **archive**: When review verdict is APPROVE. **STOP after printing the APPROVE
>   verdict and the review file path. Do NOT proceed to archive.** Wait for the user to
>   explicitly say to archive (e.g. "archive", "yes, archive it", "go ahead"). Only then
>   run `/archive --approved`. An APPROVE verdict is permission, not a request.

---

### File 3 — `src/scaffold/templates/.opencode/agents/bdd-workflow.md`

In `## Workflow Rules`, replace rules 2 and 4.

**Current rule 2:**
> 2. When the user approves, run `/apply`. After apply, always run `/review`.

**Replace with:**
> 2. When the user approves, run `/apply`. After apply, run `npx bdd-workflow check`.
>    Only run `/review` once the check passes.

**Current rule 4:**
> 4. After an APPROVE verdict, STOP — print the review file path and ask the user for
>    explicit confirmation before archiving. Do not pass --approved without the user
>    saying so.

**Replace with:**
> 4. After an APPROVE verdict, **STOP immediately** — print the review file path and
>    explicitly ask the user: "The review is APPROVE. Shall I archive?" Do not run
>    `/archive` until the user responds affirmatively. An APPROVE verdict is permission,
>    not an instruction.

---

### File 4 — `src/scaffold/templates/.opencode/commands/apply.md`

The current file ends at step 5:
> 5. Ensure `npx tsc --noEmit` passes before finishing

Replace that step with:
> 5. Run `npx bdd-workflow check`. If it fails, fix the failures now — do not hand off
>    to review with a failing check. Failures at this stage are still part of apply, not
>    amend.

---

### File 5 — `src/scaffold/templates/.opencode/commands/amend.md`

The current file ends with:
> After fixing, verify:
> - `npx tsc --noEmit` passes
> - `npx cucumber-js` passes

Replace that block with:
> After fixing, run `npx bdd-workflow check`. If it fails, fix the failures before
> finishing — do not hand off to review with a failing check.

---

### File 6 — `AGENTS.md` (new file, repo root — direct creation)

Create `AGENTS.md` at the repository root. OpenCode loads this file automatically at
the start of every agent session. This is repo-specific and is **not** added to the
scaffold templates.

```markdown
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

## Pre-review check gate

Before handing off to review (after apply or amend), run:

    npx bdd-workflow check

Both `tsc --noEmit` and `npx cucumber-js` must pass. Do not call `/review` with a
failing check — fix first.

## Archive gate

After an APPROVE verdict, stop. Print the review file path and ask the user explicitly
before running `/archive --approved`. Do not archive without an explicit affirmative
response.
```

---

### File 7 — `src/cli.ts` (direct edit)

Import `checkCommand` and register it with Commander, following the same pattern as the
existing `initCommand`, `updateCommand`, and `contextCommand`.

---

### File 8 — `features/scaffold-phase2.feature`

Append the two new scenarios from the BDD Specs section at the end of the file.

---

### Design decisions

- **`npx bdd-workflow check` over `npm run check`.** A `bdd-workflow` subcommand is
  self-contained: it doesn't require the user to have a specific `package.json` script,
  and it travels with the scaffolded agent files that reference it. `npm run check`
  requires a `package.json` edit that `bdd-workflow update` can never propagate
  (user-owned file).
- **`spawnSync` over streaming spawn.** The `check` command just needs pass/fail exit
  status with stdio passed through. `spawnSync` is simpler and sufficient; async
  streaming would add complexity with no benefit.
- **`AGENTS.md` not in scaffold templates.** The template-first editing rule only applies
  to repos that ship scaffold templates. It would be wrong to put it in a file that gets
  copied to ordinary user projects.
- **New `check.feature` for the new command.** The `check` command is a first-class CLI
  subcommand and needs its own feature file, consistent with how `init`, `update`, and
  `context` each have their own feature.

---

## Risks and Considerations

- **New TypeScript module required.** Unlike the previous drafts, this proposal adds
  real source code (`src/commands/check.ts`). The implementation is straightforward
  (`spawnSync` wrapper) but it must be compiled and included in the dist before the
  `bdd-workflow check` command is available.
- **`npm run build` required before `update`.** The post-edit step calls `npm run build`
  first to ensure `dist/` has the compiled templates. If skipped, `update` will
  propagate stale template content.
- **Step definitions for `check.feature`.** The new feature file introduces scenarios
  with steps like "the file `src/index.ts` contains a type error" and "a failing
  Cucumber scenario exists" which may not have existing step definitions. The apply
  agent must check `features/support/steps/` and write new step definitions if needed.
- **No breaking changes.** The `check` command is purely additive. Existing CLI usage
  is unaffected.
- **`npx bdd-workflow check` in pre-manifest projects.** If a user has an old project
  without `bdd-workflow` in their `devDependencies`, `npx bdd-workflow check` may fetch
  from the registry. This is acceptable — `npx` handles it transparently.
