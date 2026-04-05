# Review: Enforce Pre-Review Test Gate and Explicit Archive Approval

Date: 2026-04-05
Proposal: `.opencode/proposals/2026-04-05-enforce-test-gate-and-archive-approval.md`

---

## Checklist

### Completeness

- [x] **File 1 — `src/commands/check.ts`** — New file present. Implements `checkCommand()` using `spawnSync` for `npx tsc --noEmit` then `npx cucumber-js`, exits with the failing code on error, prints success message on full pass.
- [x] **File 2 — `src/scaffold/templates/.opencode/skills/bdd-workflow/SKILL.md`** — `apply`, `amend`, and `archive` bullets updated exactly as specified.
- [x] **File 3 — `src/scaffold/templates/.opencode/agents/bdd-workflow.md`** — Rules 2 and 4 updated exactly as specified.
- [x] **File 4 — `src/scaffold/templates/.opencode/commands/apply.md`** — Step 5 replaced with `npx bdd-workflow check` gate.
- [x] **File 5 — `src/scaffold/templates/.opencode/commands/amend.md`** — Verification block replaced with `npx bdd-workflow check` gate.
- [x] **File 6 — `AGENTS.md`** — New file at repo root; all three sections (template-first editing rule, pre-review check gate, archive gate) present verbatim as specified.
- [x] **File 7 — `src/cli.ts`** — `checkCommand` imported and registered with `addCommand`, following existing pattern with comment.
- [x] **File 8 — `features/scaffold-phase2.feature`** — Two new scenarios appended exactly as specified.
- [x] **`features/check.feature`** — New feature file present (required by the spec layer).
- [x] **`features/support/steps/check.steps.ts`** — Step definitions present for all new Gherkin steps.
- [x] **Live `.opencode/` files** — All live files match their templates (confirmed via `git diff`). Template propagation was done correctly via `npm run build && npx bdd-workflow update`.
- [x] **`.opencode/.bdd-workflow-manifest.json`** — Hashes updated for `apply.md`, `amend.md`, `bdd-workflow.md` (agent), and a new entry added for `skills/bdd-workflow/SKILL.md`.
- [x] No proposal items partially implemented.
- [x] No files mentioned in the proposal missing from the diff.

---

### Doc Layer (WHY)

- [x] `src/commands/check.ts` has a file-level `@module` / `@description` JSDoc block that exactly matches the proposal's specified text (line 1–8).
- [x] The `checkCommand()` export has a JSDoc comment with `@returns` (line 13–21).
- [x] `features/support/steps/check.steps.ts` has a file-level JSDoc comment and per-function JSDoc on every exported/registered step and helper.
- [x] No new function or module added without documentation.

One minor observation: the `@module` tag in `check.ts` uses `/** @module commands/check @description ... */` as a combined block, which is consistent with how the proposal wrote it and how the project's jsdoc parser works.

---

### Spec Layer (WHAT)

**`features/check.feature`** — All four scenarios from the proposal are present. One scenario name differs slightly:

| Proposal | Implemented |
|---|---|
| `check passes when type-check and tests both pass` | `check passes in a project with no type errors and no failing tests` |

The meaning is identical; the implementation's wording is more descriptive. This is a minor deviation — acceptable but noted.

All other scenario names match exactly:
- `check subcommand appears in CLI help` ✓
- `check fails when tsc reports type errors` ✓
- `check fails when cucumber tests fail` ✓

**`features/scaffold-phase2.feature`** — Both new scenarios match the proposal exactly:
- `bdd-workflow skill references npx bdd-workflow check for the pre-review gate` ✓
- `bdd-workflow skill enforces explicit archive approval gate` ✓

---

### Test Check

Ran each feature file individually (full suite exceeds reviewer environment timeout):

| Feature file | Result |
|---|---|
| `features/check.feature` | **4 scenarios, 12 steps — all passed** (1m15s) |
| `features/scaffold-phase2.feature` | **13 scenarios, 68 steps — all passed** (20s) |
| `features/init.feature` | **8 scenarios, 33 steps — all passed** (1m03s) |
| `features/scaffold-bdd-workflow-agent.feature` + `features/update.feature` | **10 scenarios, 49 steps — all passed** (28s) |
| `features/context.feature` | **10 scenarios, 59 steps — all passed** (2m04s) |

- [x] All tests pass.
- [x] No scenarios pending or skipped.

---

### Type Check

```
npx tsc --noEmit
```

No output — exits cleanly.

- [x] No TypeScript errors.

---

### Consistency

- [x] `checkCommand()` in `src/commands/check.ts` correctly implements what the four `check.feature` scenarios describe: spawns `tsc --noEmit`, fails fast if non-zero, then spawns `cucumber-js`, fails fast if non-zero, prints success at the end.
- [x] The `check.steps.ts` uses a symlinked `node_modules` approach for fast scaffolding — correctly handles the "project with type error" case by overwriting `src/index.ts` with a deliberate type mismatch (`number` assigned to `string`).
- [x] SKILL.md and agent wording matches the exact text the scaffold-phase2 scenarios test for (`"npx bdd-workflow check"`, `"STOP after printing"`, `"STOP immediately"`).
- [x] No behavior implemented that isn't covered by a scenario.
- [x] JSDoc WHY (`"Intended as the canonical pre-review gate referenced by the bdd-workflow skill and command files"`) matches what the code actually does.

---

## Verdict

**APPROVE** — All checklist items pass. Every file listed in the proposal is present, all wording changes match the specification exactly (one cosmetic scenario-name deviation noted but acceptable), live files correctly propagated from templates, manifest updated, type check clean, all 45 scenarios across all feature files pass.
