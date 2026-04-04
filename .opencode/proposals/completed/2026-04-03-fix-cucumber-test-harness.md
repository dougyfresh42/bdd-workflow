---
date: 2026-04-03
slug: fix-cucumber-test-harness
status: approved
---

# Proposal: Fix Cucumber Test Harness (All Scenarios Currently Undefined)

## 1. Summary

The Cucumber test suite is entirely non-functional: every scenario across all three feature files
(`init.feature`, `scaffold-phase2.feature`, `update.feature`) reports as **Undefined** — step
definitions are never loaded. Root-cause analysis reveals two compounding bugs:

**Bug 1 — Wrong Cucumber config strategy for ESM projects.**
`cucumber.js` uses `requireModule: ['ts-node/register']`, which is the CommonJS `require()` hook.
The project is `"type": "module"` (ESM). The `require()` hook never fires for ESM `import` calls,
so step files are silently skipped. The correct Cucumber 11 approach for ESM + TypeScript is:
- `loader: ['tsx/esm/api']` — registers `tsx` via Node's `module.register()` so `.ts` files can
  be dynamically imported
- `import: [...]` — tells Cucumber to use ESM `import()` (not `require()`) to load step files

**Bug 2 — TypeScript type errors in `init.steps.ts` cause silent import failure.**
`spawnSync` returns `{ status: number | null }`, but `BddWorkflowWorld.lastExitCode` is typed as
`number | undefined`. Assigning `result.status` (which may be `null`) to `lastExitCode` is a
TypeScript error. When ts-node processes the file via the ESM loader, it throws on this type error
before any `Given/When/Then` registrations execute — but because the error is thrown from inside a
dynamic `import()`, Cucumber swallows it silently and all steps remain Undefined.

**User-visible impact:** After this fix, `npx cucumber-js` will load and execute all step
definitions. Scenarios that have correct implementations will pass; others will fail with
meaningful assertion errors rather than "Undefined".

**Additional dependency:** `tsx` must be added as a devDependency (it is already installed from
a prior `npm install` but is not declared in `package.json`).

---

## 2. Doc Updates (the WHY layer)

### `cucumber.js` — update inline comment

Replace the file with a comment block explaining the loader strategy:

```javascript
/**
 * Cucumber configuration for bdd-workflow's own BDD test suite.
 *
 * Uses `tsx/esm/api` as the Node.js ESM loader (registered via `module.register()`)
 * so that TypeScript step files can be dynamically imported without a build step.
 * The `import` key (not `require`) is used because this project is "type": "module".
 *
 * Why tsx over ts-node:
 * - ts-node/esm requires --import (not compatible with Cucumber's `loader` key, which
 *   internally uses `module.register()`).
 * - tsx/esm/api is the register-compatible hook export for tsx.
 */
export default { ... }
```

### `features/support/steps/init.steps.ts` — fix type annotations

The five assignments of `result.status` (which is `number | null`) to `this.lastExitCode`
(typed `number | undefined`) are type errors. Fix each by using the nullish coalescing operator:

```typescript
this.lastExitCode = result.status ?? undefined;
```

This converts `null` → `undefined`, satisfying the type constraint and preserving the semantics
(a `null` status from `spawnSync` means the process was killed by a signal, which the test
framework should treat as a failed run).

No changes needed to `scaffold-phase2.steps.ts` or `update.steps.ts` — they do not assign
`result.status` directly to `this.lastExitCode` (update.steps.ts uses a local `exitCode` field
on a plain object, which is already typed correctly).

### `package.json` — add `tsx` to devDependencies

```json
"tsx": "^4.0.0"
```

---

## 3. BDD Specs (the WHAT layer)

No new `.feature` files are needed. This is a fix to the test harness infrastructure, not a
behavioral change to the CLI. The existing scenarios in `init.feature`,
`scaffold-phase2.feature`, and `update.feature` are the acceptance criteria — the fix succeeds
when `npx cucumber-js` runs them and they either pass or fail with real assertion errors
(not "Undefined").

---

## 4. Implementation Plan (the HOW layer)

### Files to modify

| File | Change |
|------|--------|
| `cucumber.js` | Replace `requireModule` + `require` with `loader` + `import`; add explanatory comment |
| `features/support/steps/init.steps.ts` | Fix 5 assignments of `result.status` to use `?? undefined` |
| `package.json` | Add `tsx` to `devDependencies` |

### Approach

**1. `cucumber.js` rewrite**

Replace:
```javascript
export default {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/support/steps/**/*.ts', 'features/support/hooks.ts'],
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
  }
};
```

With:
```javascript
export default {
  default: {
    loader: ['tsx/esm/api'],
    import: ['features/support/steps/**/*.ts', 'features/support/hooks.ts'],
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
  }
};
```

How it works: Cucumber 11 processes `loader` entries by calling `module.register(specifier,
pathToFileURL('./'))` for each. `tsx/esm/api` is tsx's register-compatible ESM hook — it
intercepts `import()` calls for `.ts` files and transpiles them on-the-fly. After registration,
Cucumber uses ESM `import()` for each path in the `import` array, which tsx intercepts and
transpiles.

**Why tsx and not ts-node/esm?**
`tsx/esm` (the main ESM hook) explicitly throws when loaded via `module.register()` — it requires
`--import tsx` instead. `tsx/esm/api` is the register-compatible variant. `ts-node/esm` can be
registered via `module.register()` but ts-node's strict type-checking causes silent import
failures (Bug 2). tsx runs in transpile-only mode by default, which is appropriate for a test
runner (type checking is handled by `npx tsc --noEmit` separately).

**2. Fix `null` type errors in `init.steps.ts`**

The five locations (lines 69, 85, 99, 128, 141) all follow the same pattern:
```typescript
// Before (type error: null not assignable to number | undefined)
this.lastExitCode = result.status;

// After
this.lastExitCode = result.status ?? undefined;
```

**3. `package.json` devDependency**

tsx is already `node_modules/tsx` (installed as a transitive or manual dep) but is not declared
in `package.json`. Add it explicitly so `npm ci` in fresh environments picks it up.

### Verification

After applying:
```
npx tsc --noEmit        # must pass cleanly
npx cucumber-js         # must show real pass/fail results, not all-Undefined
```

The specific count of passing vs failing scenarios is not the target of this proposal — the
target is that step definitions are loaded and scenarios execute. Some scenarios (e.g. those
requiring a built `dist/cli.js`) may still fail if the package has not been built; that is
expected and acceptable.

---

## 5. Risks and Considerations

### tsx transpile-only mode skips type checking
tsx does not type-check; it strips types without verifying them. This means a step file with
type errors will load and run. This is intentional — type errors should be caught by `tsc`, not
the test runner. The two roles are separate.

### ts-node strict mode was previously hiding all errors
With `requireModule: ['ts-node/register']` the config was broken from the start (no steps loaded
because `require()` doesn't fire for ESM files). The type errors in `init.steps.ts` would have
surfaced if ts-node had ever successfully loaded the file; they are a secondary bug exposed by
fixing the primary one.

### `tsconfig.json` excludes `features/**`
`tsconfig.json` has `"include": ["src/**/*"]`. This means `tsc` does not check step files. The
step file type errors therefore do not show up in `npx tsc --noEmit`. They only manifest when
ts-node tries to compile them at runtime. After this fix (tsx transpile-only), they will be
silently ignored at runtime too — which is acceptable, but the annotations should still be
correct. Fixing them as part of this proposal is the right thing to do.

Consider adding `"features/**/*"` to `tsconfig.json`'s `include` array as a follow-up so that
`npx tsc --noEmit` catches step-file type errors. That is out of scope here to keep the change
minimal.

### No change to `hooks.ts` or `world.ts`
These files have no type issues and don't use `spawnSync`.
