# Phase 1 — NPM Package Scaffold

**Prerequisite reading**: [docs/design.md](design.md)

**Goal**: Build the `bdd-workflow` npm package with a working `init` command that scaffolds a fully configured project. At the end of this phase, running `npx bdd-workflow init` should produce a complete, working project skeleton.

**Does NOT include**: OpenCode skills and commands (Phase 2), context generation logic (Phase 3), doc/spec generation (Phase 4).

---

## Deliverables

1. TypeScript npm package at the repo root with a working CLI
2. `npx bdd-workflow init [dir]` command that scaffolds a new project or adds the framework to an existing one
3. All scaffold template files (`.opencode/` structure, `features/` structure, config files)
4. `defineConfig()` function exported from the package
5. The package itself compiles and the `init` command runs end-to-end

---

## Package Setup

### `package.json`

```json
{
  "name": "bdd-workflow",
  "version": "0.1.0",
  "description": "Agentic BDD development workflow framework for TypeScript projects",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "bdd-workflow": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "npx cucumber-js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "glob": "^11.0.0",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@cucumber/cucumber": "^11.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Source Files to Create

### `src/index.ts`
The public API entry point. Exports `defineConfig` and all public types.

```typescript
/**
 * @module bdd-workflow
 * @description Public API for the bdd-workflow framework. Import defineConfig
 * to configure the framework for your project.
 */

export { defineConfig } from './config.js';
export type { BddWorkflowConfig, BddConfig, DocsConfig, ContextConfig, WorkflowConfig } from './config.js';
```

### `src/cli.ts`
Entry point for the CLI binary. Uses `commander` to register all subcommands.

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
// Later phases add: contextCommand, docsCommand, specsCommand, learnCommand

const program = new Command();

program
  .name('bdd-workflow')
  .description('Agentic BDD development workflow framework')
  .version('0.1.0');

program.addCommand(initCommand());

program.parse(process.argv);
```

### `src/config.ts`
The `defineConfig` function and all configuration types.

```typescript
export interface BddConfig {
  framework: 'cucumber';
  featuresDir: string;
  stepsDir: string;
  runCommand: string;
}

export interface DocsConfig {
  style: 'jsdoc' | 'tsdoc';
  generator: 'typedoc';
  outputDir: string;
  format: 'markdown' | 'html';
}

export interface ContextConfig {
  outputFile: string;
  include: string[];
  exclude: string[];
  sections: {
    structure: boolean;
    moduleSummaries: boolean;
    featureSummaries: boolean;
    exports: boolean;
  };
}

export interface WorkflowConfig {
  maxAmendIterations: number;
  autoReviewAfterApply: boolean;
  autoContextAfterArchive: boolean;
  proposalDir: string;
  learningsDir: string;
}

export interface BddWorkflowConfig {
  language: 'typescript' | 'javascript';
  bdd: BddConfig;
  docs: DocsConfig;
  context: ContextConfig;
  workflow: WorkflowConfig;
  models?: {
    explore?: string;
    propose?: string;
    apply?: string;
    review?: string;
    amend?: string;
    learn?: string;
    archive?: string;
  };
}

const defaults: BddWorkflowConfig = {
  language: 'typescript',
  bdd: {
    framework: 'cucumber',
    featuresDir: 'features',
    stepsDir: 'features/support/steps',
    runCommand: 'npx cucumber-js',
  },
  docs: {
    style: 'jsdoc',
    generator: 'typedoc',
    outputDir: 'docs',
    format: 'markdown',
  },
  context: {
    outputFile: 'CONTEXT.md',
    include: ['src/**/*', 'features/**/*.feature'],
    exclude: ['node_modules', 'dist', 'docs'],
    sections: {
      structure: true,
      moduleSummaries: true,
      featureSummaries: true,
      exports: true,
    },
  },
  workflow: {
    maxAmendIterations: 3,
    autoReviewAfterApply: true,
    autoContextAfterArchive: true,
    proposalDir: '.opencode/proposals',
    learningsDir: '.opencode/learnings',
  },
};

export function defineConfig(config: Partial<BddWorkflowConfig>): BddWorkflowConfig {
  return { ...defaults, ...config };
}
```

### `src/commands/init.ts`
The `init` subcommand. Scaffolds the project directory.

**Responsibilities**:
1. Determine target directory (argument or cwd)
2. Detect if a project already exists (check for `package.json`, `opencode.json`)
3. In "new project" mode: create full directory structure + all config files
4. In "add to existing" mode: only create `.opencode/` structure + bdd-workflow config files, skip files that already exist
5. Run `npm install` for the newly added dev dependencies if a `package.json` exists
6. Print a summary of what was created

**Logic**:

```typescript
import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scaffoldProject } from '../scaffold/index.js';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a project with bdd-workflow')
    .argument('[dir]', 'Target directory (defaults to current directory)')
    .option('--existing', 'Add to an existing project without creating package.json etc.')
    .action(async (dir: string | undefined, opts) => {
      const targetDir = resolve(dir ?? '.');
      const isExisting = opts.existing || existsSync(join(targetDir, 'package.json'));
      await scaffoldProject(targetDir, { existing: isExisting });
    });
}
```

### `src/scaffold/index.ts`
Orchestrates scaffolding — reads templates and writes them to the target directory.

**Responsibilities**:
- Walk the `src/scaffold/templates/` directory
- For each template file, determine its output path relative to `targetDir`
- Apply any variable substitutions (e.g. `{{projectName}}`)
- Skip files that already exist (unless `--force` flag given)
- Create all necessary parent directories

### `src/scaffold/templates/`
The actual template files. These are the source of truth for what a scaffolded project looks like. They are embedded in the package at build time.

---

## Template Files to Create

All paths are relative to what will be written into the target project.

### `.opencode/` structure (stubs — content filled in Phase 2)

- `.opencode/agents/.gitkeep`
- `.opencode/commands/.gitkeep`
- `.opencode/skills/.gitkeep`
- `.opencode/proposals/completed/.gitkeep`
- `.opencode/learnings/.gitkeep`
- `.opencode/templates/proposal.md` — Proposal template (stub with TODOs for Phase 2)
- `.opencode/templates/review.md` — Review template (stub)
- `.opencode/templates/learning.md` — Learning template (stub)

### `features/` structure

- `features/support/steps/.gitkeep`
- `features/support/hooks.ts` — Empty Cucumber hooks file with JSDoc
- `features/support/world.ts` — Custom world definition with JSDoc
- `features/.gitkeep`

### `src/`

- `src/index.ts` — Starter entry point with `@module` JSDoc comment

### Config files

- `opencode.json` — OpenCode configuration (stub, commands filled in Phase 2)
- `cucumber.js` — Cucumber configuration for TypeScript
- `typedoc.json` — TypeDoc configuration (used in Phase 4)
- `bdd-workflow.config.ts` — Framework configuration using `defineConfig()`
- `tsconfig.json` — TypeScript configuration
- `package.json` — With all required dev dependencies listed
- `.gitignore` — Ignoring `node_modules`, `dist`, `docs/` (but tracking `CONTEXT.md`)

### Root files

- `CONTEXT.md` — Empty stub with a note that it will be generated by `npx bdd-workflow context`
- `SPECS.md` — Empty stub with a note that it will be generated by `npx bdd-workflow specs`

---

## `cucumber.js` Template

```javascript
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/support/**/*.ts'],
    format: ['progress-bar'],
    formatOptions: { snippetInterface: 'async-await' },
  }
};
```

---

## Acceptance Criteria

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npx bdd-workflow --help` prints usage information
- [ ] `npx bdd-workflow init /tmp/test-project` creates a complete directory structure
- [ ] Running `npm install` in the scaffolded project succeeds
- [ ] Running `npx tsc --noEmit` in the scaffolded project succeeds
- [ ] Running `npx cucumber-js` in the scaffolded project runs (0 scenarios, 0 steps — no failures)
- [ ] Running `npx bdd-workflow init` on an existing project skips existing files and only adds missing ones
- [ ] `defineConfig()` is importable from `bdd-workflow` and returns correct defaults

---

## Notes

- Template files can be embedded using Node's `fs` to copy from `src/scaffold/templates/` relative to the package. For npm distribution, use `"files"` in `package.json` to include the `dist/scaffold/templates/` directory.
- The `opencode.json` generated here is intentionally sparse. Phase 2 will fill in the agent and command definitions.
- Phase 2 depends on this phase's scaffold structure being correct. Do not change directory paths after Phase 1 without updating Phase 2 templates accordingly.
