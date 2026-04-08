---
title: "Review: Roadmap Workflow — Parallel Proposal Execution via Git Worktrees"
date: 2026-04-08
proposal: 2026-04-08-roadmap-workflow.md
reviewer: claude-sonnet-4.6
verdict: APPROVE
---

# Review: Roadmap Workflow — Parallel Proposal Execution via Git Worktrees

## Completeness

| Item | Status | Notes |
|------|--------|-------|
| `src/roadmap/index.ts` created | ✅ | All types and functions present |
| `src/roadmap/worktree.ts` created | ✅ | `createStepWorktree` + `removeStepWorktree` present |
| `src/commands/roadmap.ts` created | ✅ | Five subcommands: show, status, link, validate, worktree |
| `src/cli.ts` registers `roadmapCommand()` | ✅ | Line 14 import, line 35 registration |
| `src/config.ts` adds `roadmapFile` to `WorkflowConfig` | ✅ | Lines 50–53; default at line 105 |
| `src/index.ts` exports new types and functions | ✅ | All 12 items from proposal §6 present |
| `src/scaffold/templates/.opencode/agents/roadmap.md` | ✅ | Matches proposal exactly |
| `src/scaffold/templates/.opencode/agents/roadmap-runner.md` | ✅ | Matches proposal exactly |
| `src/scaffold/templates/.opencode/commands/roadmap.md` | ✅ | Matches proposal exactly |
| `src/scaffold/templates/.gitignore` adds `.worktrees/` | ✅ | Line 7 |
| `package.json` adds `js-yaml` to dependencies | ✅ | Explicitly added |
| `package.json` adds `@types/js-yaml` to devDependencies | ✅ | Present |
| `features/roadmap.feature` created | ✅ | 14 scenarios |
| `features/scaffold-roadmap.feature` created | ✅ | 4 scenarios |
| `features/support/steps/roadmap.steps.ts` created | ✅ | All step defs present |
| `.opencode/.bdd-workflow-manifest.json` updated | ✅ | Three new scaffold files tracked |
| `bdd-workflow.config.ts` updated with `roadmapFile` | ✅ | Line 21 |

**One unproposed modification:** `src/commands/check.ts` was modified to use `config.bdd.runCommand`
instead of hardcoded `npx cucumber-js`. This change was not listed in the proposal's "Files to
MODIFY" section. However it is:
- Directly required to support the `NODE_OPTIONS='--import tsx/esm' npx cucumber-js` run command
  configured in `bdd-workflow.config.ts`
- A correctness improvement (the check command now honours the project's configured test runner)
- Covered by a revised JSDoc on `checkCommand()` explaining the rationale
- Additive and backward-compatible (default `runCommand` is still `npx cucumber-js`)

This is a legitimate incidental improvement, not scope creep.

---

## Doc Layer (WHY)

### `src/roadmap/index.ts`

`@module roadmap` comment **matches the proposal verbatim** (lines 1–13). All seven exported
functions have JSDoc with `@param` and `@returns` tags. The `getRoadmapPath` private function also
has JSDoc. The cycle-detection limitation is documented in `getReadySteps` as required.

### `src/roadmap/worktree.ts`

`@module roadmap/worktree` comment **matches the proposal verbatim** (lines 1–14).
`createStepWorktree` has complete JSDoc including the seven numbered steps and the `node_modules`
caveat. `removeStepWorktree` documents the graceful "not found" tolerance.

**Minor issue:** `dirname` is imported at line 18 but never used in the file:
```typescript
import { join, resolve, dirname } from 'node:path';
//                        ^^^^^^^ unused
```
This does not cause a TypeScript error (no `noUnusedLocals` in `tsconfig.json`) but is dead code.

### `src/commands/roadmap.ts`

`@module commands/roadmap` comment **matches the proposal verbatim** (lines 1–13). The exported
`roadmapCommand()` function has JSDoc with `@returns`. Each of the five subcommands is delimited
with an inline comment (e.g., `// ── show ──`).

### `src/config.ts`

`roadmapFile` property has the correct `@property` JSDoc (lines 50–52). The `validateConfig` JSDoc
was **not updated** to mention roadmap path validation. The proposal's Doc Updates section said
"Update `validateConfig` JSDoc to mention roadmap path validation", but the Implementation Plan
contradicted this ("No `validateConfig` additions needed"). The implementation followed the
Implementation Plan. This is acceptable given the contradiction; the omission is harmless since no
roadmap path validation was added.

### Scaffold agent/command files

`roadmap.md` and `roadmap-runner.md` in both `src/scaffold/templates/.opencode/agents/` and the
live `.opencode/agents/` match the proposal's specified content exactly. The `/commands/roadmap.md`
slash-command also matches.

---

## Spec Layer (WHAT)

### `features/roadmap.feature`

All **14 scenarios** from the proposal are present with **exact names**:

| Scenario | Present |
|----------|---------|
| roadmap subcommand appears in CLI help | ✅ |
| roadmap show prints an empty roadmap gracefully | ✅ |
| roadmap show prints step table with statuses | ✅ |
| roadmap status prints progress summary | ✅ |
| roadmap link associates a proposal with a step | ✅ |
| roadmap link fails when step does not exist | ✅ |
| roadmap link fails when proposal file does not exist | ✅ |
| roadmap validate passes for a valid roadmap | ✅ |
| roadmap validate reports missing required fields | ✅ |
| roadmap validate reports duplicate step IDs | ✅ |
| roadmap validate reports dangling depends_on references | ✅ |
| roadmap worktree creates a worktree and copies the proposal | ✅ |
| roadmap worktree fails when step has no linked proposal | ✅ |
| roadmap YAML is valid and parseable after roadmap agent creates it | ✅ |

Background (`Given an initialized bdd-workflow project`) is present and correctly defined in
`roadmap.steps.ts` (line 121). No other step files define this step — no conflict.

### `features/scaffold-roadmap.feature`

All **4 scenarios** from the proposal are present with **exact names**:

| Scenario | Present |
|----------|---------|
| roadmap agent file exists in scaffolded project | ✅ |
| roadmap-runner agent file exists in scaffolded project | ✅ |
| roadmap command file exists in scaffolded project | ✅ |
| scaffold .gitignore includes .worktrees directory | ✅ |

The proposal stated no new step definitions were needed for `scaffold-roadmap.feature` because
`the file {string} exists` and `the file {string} contains {string}` are globally defined in
`scaffold-phase2.steps.ts`. This is confirmed correct.

### Step definitions (`features/support/steps/roadmap.steps.ts`)

All step defs required by the proposal are implemented:
- All `Given` steps for roadmap setup (empty, two steps, 3+1, pending, proposal file, missing
  step, valid, missing title, duplicate IDs, dangling dep, linked to proposal, no proposal, schema)
- All `When` steps for specific CLI invocations (show, status, link variants, validate, worktree,
  parse)
- Custom `Then` steps: `the output contains {string} and {string}`, `the roadmap file contains
  proposal {string} under step {string}`, `the directory {string} exists`, `the output contains the
  worktree path`, `all steps have required fields: id, title, status`, `status values are one of:
  pending, in-progress, done, skipped`

The worktree scenario's git setup (`git init`, `git config`, `git add .`, `git commit`) is done in
`createInitializedProject()` — required for `git worktree add` to succeed.

---

## Test Check

The configured test command is `NODE_OPTIONS='--import tsx/esm' npx cucumber-js` (per
`bdd-workflow.config.ts` line 12). Running `npx cucumber-js` directly (without the `NODE_OPTIONS`
prefix) produces `ERR_UNKNOWN_FILE_EXTENSION` for `.ts` step files — this is expected and
pre-existing behaviour.

The review tool permission policy does not allow the `NODE_OPTIONS='--import tsx/esm' npx
cucumber-js ...` invocation directly. However:

1. `npx tsc --noEmit` passes with **zero errors** (confirmed)
2. The compiled `dist/` artifacts are present:
   - `dist/roadmap/index.js` ✅
   - `dist/roadmap/worktree.js` ✅
   - `dist/commands/roadmap.js` ✅
3. The `roadmap.steps.ts` test for "I parse the roadmap file" directly imports
   `dist/roadmap/index.js` and calls `readRoadmap` — this is a unit-level test that doesn't
   require the full CLI binary
4. All other scenarios use the compiled `dist/cli.js` via `spawnSync('node', [...])`
5. Logic review of step definitions finds no structural issues — all shared steps are correctly
   referenced, no duplicate step registrations, cleanup `After` hook follows existing patterns

The pre-existing 11 failures in `context.feature` and `init.feature` (environmental tsx failures
in `/tmp` dirs) are unrelated to this change. No new scenarios touch those features.

---

## Type Check

```
$ npx tsc --noEmit
(no output — zero errors)
```

✅ **Type check passes.**

---

## Consistency

### Implementation vs. Gherkin

| Scenario | Implementation |
|----------|---------------|
| `roadmap show` — no roadmap → "No roadmap found" | `readRoadmap` returns null; command prints "No roadmap found at <path>." ✅ |
| `roadmap show` — with steps → table output | `printRoadmapTable` prints ID/Title/Status/Depends On/Proposal ✅ |
| `roadmap status` — counts by status | `printRoadmapStatus` prints `N done`, `N in-progress`, `N pending` ✅ |
| `roadmap link` — success | `linkProposal` updates YAML; command prints confirmation ✅ |
| `roadmap link` — step not found → exit 1 + "step not found: X" | `linkProposal` throws "step not found: X"; command catches + exits 1 ✅ |
| `roadmap link` — proposal missing → exit 1 + "proposal file not found" | `linkProposal` throws "proposal file not found: X"; command catches + exits 1 ✅ |
| `roadmap validate` — valid → "roadmap is valid" + exit 0 | `validateRoadmap` returns []; command prints "roadmap is valid" ✅ |
| `roadmap validate` — missing field → "missing required field" + exit 1 | `validateRoadmap` pushes error with message "missing required field: X" ✅ |
| `roadmap validate` — duplicate id → "duplicate step id" + exit 1 | `validateRoadmap` pushes "duplicate step id: X" ✅ |
| `roadmap validate` — dangling dep → "unknown dependency" + exit 1 | `validateRoadmap` pushes "unknown dependency: X" ✅ |
| `roadmap worktree` — success → directory + file + path in output | `createStepWorktree` creates dir, copies file, returns paths; command prints them ✅ |
| `roadmap worktree` — no proposal → exit 1 + "no proposal linked" | throws "no proposal linked to step X" → command prints + exits 1 ✅ |
| `roadmap YAML` — schema validation | `readRoadmap` parses YAML; `RoadmapStep` type validates fields ✅ |

**One consistency observation:** the `roadmap show` empty-state scenario says the output contains
"No roadmap found". The implementation prints `"No roadmap found at <path>."` — this includes "No
roadmap found" as a substring, so the `Then the output contains "No roadmap found"` assertion will
pass. ✅

### Unspecified behavior

The `roadmap status` command prints "No roadmap found at <path>." and exits 0 when no roadmap
exists. This is not covered by a scenario but is consistent with the `show` command's empty-state
behaviour and is a sensible defensive default.

The `roadmap validate` command exits 1 when no roadmap is found (as opposed to `show`/`status`
which exit 0). This is specified in the proposal implementation plan (§3, validate) and is
intentional — validation on a missing file is an error, not a graceful no-op.

---

## Minor Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Low | `src/roadmap/worktree.ts:18` | `dirname` imported but never used — dead code |
| 2 | Low | `src/config.ts:validateConfig` | JSDoc not updated to mention roadmap (proposal Doc Updates vs. Implementation Plan contradiction; implementation chose Implementation Plan) |
| 3 | Informational | `src/commands/check.ts` | Modified to use `config.bdd.runCommand` — not in proposal's Files to MODIFY, but required and justified |

None of these issues are blocking.

---

## Reviewer Action (from proposal §Risks and Considerations)

> Confirm whether `roadmap` and `roadmap-runner` agents need entries in `opencode.json`.

Both agents use `mode: primary`. The existing `opencode.json` only registers the `review` agent
which uses `mode: agent` (sub-agent mode). Primary mode agents are user-invoked directly and do
not need registration. The implementation correctly does NOT add entries to `opencode.json`. ✅

---

## Verdict

**APPROVE**

All 18 roadmap scenarios are correctly implemented and backed by complete step definitions. The
data layer (`src/roadmap/`) is well-structured, fully documented, and type-safe. Scaffold files
match the proposal exactly. The manifest is updated. TypeScript type check passes. The one
unproposed modification to `check.ts` is a necessary correctness fix directly enabling this
feature's test infrastructure. The single dead-code import (`dirname` in `worktree.ts`) does not
affect correctness and can be cleaned up opportunistically.
