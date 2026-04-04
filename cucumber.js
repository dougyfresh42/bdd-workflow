/**
 * Cucumber configuration for bdd-workflow's own BDD test suite.
 *
 * Uses `tsx/esm/api` as the Node.js ESM loader (registered via `module.register()`)
 * so that TypeScript step files can be dynamically imported without a build step.
 * The `import` key (not `require`) is used because this project is "type": "module".
 *
 * Why tsx over ts-node:
 * - ts-node's strict type-checking causes silent import failures when step files
 *   contain type errors; tsx runs in transpile-only mode so type errors are ignored
 *   at runtime (type checking is handled separately by `npx tsc --noEmit`).
 * - tsx/esm/api is the `module.register()`-compatible hook export for tsx.
 *
 * Note: step files import world.ts using a `.ts` extension (not `.js`) because
 * tsx/esm/api loaded via module.register() does not remap `.js` -> `.ts` the way
 * that `--import tsx/esm` does.
 *
 * ESM note: Cucumber reads this file via `import()`, so the module object becomes
 * the profiles map. The `default` export IS the "default" profile — no extra nesting.
 */
const defaultProfile = {
  loader: ['tsx/esm/api'],
  import: ['features/support/steps/**/*.ts', 'features/support/hooks.ts'],
  format: ['progress-bar'],
  formatOptions: { snippetInterface: 'async-await' },
};

export { defaultProfile as default };
