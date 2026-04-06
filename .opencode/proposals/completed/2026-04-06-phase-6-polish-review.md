---
proposal: .opencode/proposals/2026-04-06-phase-6-polish.md
date: 2026-04-06
verdict: APPROVE
---

# Review: Phase 6 — Polish

## Pre-review gate

```
npx tsc --noEmit   → PASS (0 errors)
npx cucumber-js    → PASS (84 scenarios, 418 steps, 0 failures)
```

---

## Checklist

### Completeness

- [x] `src/config.ts` — `ConfigError`, `validateConfig`, `assertValidConfig` added
- [x] `src/index.ts` — all three new exports wired through
- [x] `src/commands/check.ts` — `assertValidConfig` + tsconfig existence check added
- [x] `src/commands/context.ts` — `assertValidConfig` + empty-state info messages added
- [x] `src/commands/docs.ts` — `assertValidConfig` + try/catch around `generateDocs` added
- [x] `src/commands/specs.ts` — `assertValidConfig` + zero-features early-exit added
- [x] `src/commands/learn.ts` — `assertValidConfig` added to both `list` and `promote` subcommands
- [x] `src/learn/promote.ts` — `gh` not-found message updated to `"GitHub CLI not found. Install from https://cli.github.com"`
- [x] `src/scaffold/templates/package.json` — expanded scripts (build:watch, test:watch, docs, specs, context, check, check:all)
- [x] Root `package.json` — `check` and `check:all` scripts added
- [x] `README.md` — created, covers all CLI commands, configuration, workflow, scripts, publishing
- [x] `features/config-validation.feature` — 7 scenarios as specified
- [x] `features/error-handling.feature` — 6 scenarios as specified
- [x] `features/scaffold-phase6.feature` — 2 scenarios as specified
- [x] `features/support/steps/config-validation.steps.ts` — all step definitions present and passing
- [x] `features/support/steps/error-handling.steps.ts` — all step definitions present and passing
- [x] `features/support/steps/scaffold-phase6.steps.ts` — all step definitions present and passing

No proposal items are missing.

### Doc Layer (WHY)

- [x] `src/config.ts` — file-level JSDoc updated; `ConfigError`, `validateConfig`, `assertValidConfig` all have JSDoc with `@param` and `@returns`
- [x] `src/commands/check.ts` — `@module` updated to mention validateConfig + tsconfig check
- [x] `src/commands/context.ts` — `@module` updated to mention empty-state handling
- [x] `src/commands/docs.ts` — `@module` updated to mention error wrapping
- [x] `src/commands/specs.ts` — `@module` updated to mention empty features handling
- [x] `src/commands/learn.ts` — `@module` mentions validateConfig
- [x] `src/learn/index.ts` — `formatDate` helper has JSDoc
- [x] Step definition files have file-level `@module` JSDoc comments

### Spec Layer (WHAT)

- [x] All three new feature files match the proposal scenarios exactly (with two accepted deviations noted below)
- [x] Scenario step text adjusted: `"no TypeScript files in src/"` → `"no TypeScript files in the src directory"` (Cucumber expression parser rejects unescaped `/` in alternation position — a necessary technical fix, not a semantic change)
- [x] Scenario step text for error-handling `learn promote` uses `"in the project"` suffix (consistent with other error-handling steps)
- [x] `features/specs.feature` Scenario: "specs runs gracefully when no feature files" updated — step changed from `"SPECS.md" contains the header and summary section with zero scenarios` to `the output contains "No .feature files found"` — this correctly reflects the new behavior where `specs` exits early without writing SPECS.md

### Test Check

```
84 scenarios (84 passed)
418 steps (418 passed)
7m34s
```
All tests pass. No pending or undefined steps.

### Type Check

```
npx tsc --noEmit → 0 errors
```

### Consistency

- [x] All new Given/When/Then steps correspond to real behavior in the implementation
- [x] `assertValidConfig` call order is: `loadConfig` → `assertValidConfig` → command logic, consistent in all 5 command files
- [x] `formatDate` fix in `src/learn/index.ts` — `gray-matter` parses bare YAML dates as JS Date objects; the fix correctly converts to ISO date string via `.toISOString().split('T')[0]` (UTC-safe)
- [x] Duplicate step definition conflict resolved: `the file {string} contains {string}` kept only in `scaffold-phase2.steps.ts`; `scaffold-phase6.steps.ts` relies on it implicitly

---

## Deviations from proposal

1. **`features/error-handling.feature` step wording**: `"no TypeScript files in src/"` was changed to `"no TypeScript files in the src directory"` to avoid a Cucumber expression parse error (unescaped `/` treated as alternation operator). The scenario intent is identical.

2. **`features/specs.feature` empty-state step**: Updated to match new behavior (early exit, no SPECS.md written). The proposal described the new behavior but the existing test was written for the old behavior — this correction aligns test with implementation.

3. **`src/learn/index.ts` date fix**: `gray-matter` parses bare YAML dates (e.g. `2026-03-15`) as JavaScript `Date` objects. The `formatDate` helper was added to convert these to `YYYY-MM-DD` strings. This is an incidental bug fix (pre-existing, unrelated to Phase 6 scope) that was discovered and fixed during the `check` run.

4. **`features/support/world.ts`**: `validateConfig?: any` was added to the world class (alongside the existing `defineConfig?: any`) to avoid a TypeScript module augmentation conflict that would have occurred if both were declared in separate `declare module` blocks.

---

## Verdict

**APPROVE**

All proposal items are implemented and passing. The type-check and full Cucumber suite both pass clean (84/84 scenarios). The three deviations above are minor technical adjustments that preserve the original intent. The implementation is production-ready for `npm publish`.
