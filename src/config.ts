/**
 * Configuration types, defineConfig function, loadConfig loader, and
 * validateConfig validator. validateConfig is called by all CLI commands
 * after loading to surface misconfiguration with actionable messages.
 * Does NOT read config from disk — that is loadConfig's responsibility.
 */

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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
  /**
   * GitHub repository (owner/name) for `bdd-workflow learn promote`.
   * Defaults to `'douglasdollars/bdd-workflow'`. Users can override in bdd-workflow.config.ts.
   */
  repository: string;
  /**
   * @property roadmapFile - Path (relative to project root) of the roadmap YAML
   *   file. Defaults to `.opencode/roadmap.yaml`.
   */
  roadmapFile: string;
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
    repository: 'douglasdollars/bdd-workflow',
    roadmapFile: '.opencode/roadmap.yaml',
  },
};

/**
 * Define configuration for bdd-workflow.
 * @param config - Partial configuration (defaults are merged)
 * @returns Complete configuration with defaults applied
 */
export function defineConfig(config: Partial<BddWorkflowConfig>): BddWorkflowConfig {
  return { ...defaults, ...config };
}

/**
 * Load and resolve bdd-workflow configuration from the user's project.
 *
 * Looks for `bdd-workflow.config.ts` in `process.cwd()` (or the path
 * provided via --config). If the file is not found, returns the default
 * configuration with a warning. Dynamic import is used so the config file
 * can be a TypeScript module (requires the CLI to run under `tsx`).
 *
 * For compiled dist builds, the config file is evaluated via a `tsx`
 * subprocess since the dist JS cannot natively import `.ts` files.
 *
 * @param configPath - Optional explicit path to the config file
 * @returns Resolved BddWorkflowConfig with defaults merged
 */
export async function loadConfig(configPath?: string): Promise<BddWorkflowConfig> {
  const resolved = configPath
    ? resolve(configPath)
    : join(process.cwd(), 'bdd-workflow.config.ts');

  if (!existsSync(resolved)) {
    console.warn('[bdd-workflow] No bdd-workflow.config.ts found, using defaults.');
    return defineConfig({});
  }

  try {
    // First, try a direct dynamic import (works when running under tsx/ts-node)
    const mod = await import(resolved);
    return mod.default ?? defineConfig({});
  } catch {
    // Fallback: spawn tsx to evaluate the config file and return JSON
    // This handles the case where the CLI runs as compiled JS (dist/cli.js)
    // and cannot natively import .ts files.
    return loadConfigViaTsx(resolved);
  }
}

/**
 * Load config by spawning a tsx subprocess to evaluate the .ts config file.
 *
 * @param resolvedPath - Absolute path to the config file
 * @returns Parsed BddWorkflowConfig
 */
function loadConfigViaTsx(resolvedPath: string): BddWorkflowConfig {
  const script = `
import config from '${resolvedPath.replace(/\\/g, '/')}';
process.stdout.write(JSON.stringify(config));
`;
  const result = spawnSync(
    'npx',
    ['tsx', '--eval', script],
    {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    }
  );

  if (result.status !== 0 || !result.stdout) {
    console.warn(
      `[bdd-workflow] Failed to load config via tsx: ${result.stderr}. Using defaults.`
    );
    return defineConfig({});
  }

  try {
    const parsed = JSON.parse(result.stdout) as Partial<BddWorkflowConfig>;
    return defineConfig(parsed);
  } catch {
    console.warn('[bdd-workflow] Failed to parse config JSON. Using defaults.');
    return defineConfig({});
  }
}

/**
 * Represents a single configuration validation error.
 * @property field - Dot-path of the offending config field (e.g. 'bdd.featuresDir')
 * @property message - Human-readable description of the problem and how to fix it
 */
export interface ConfigError {
  field: string;
  message: string;
}

/**
 * Validate a fully-resolved BddWorkflowConfig and return all errors found.
 *
 * Checks language, bdd.featuresDir, bdd.runCommand, docs.style, and
 * docs.format. Does NOT validate filesystem paths — only value constraints.
 *
 * @param config - The resolved configuration to validate
 * @returns Array of ConfigError objects (empty if valid)
 */
export function validateConfig(config: BddWorkflowConfig): ConfigError[] {
  const errors: ConfigError[] = [];

  if (!['typescript', 'javascript'].includes(config.language)) {
    errors.push({
      field: 'language',
      message: `Unsupported language: "${config.language}". Supported: typescript, javascript`,
    });
  }

  if (!config.bdd.featuresDir) {
    errors.push({ field: 'bdd.featuresDir', message: 'featuresDir is required' });
  }

  if (!config.bdd.runCommand) {
    errors.push({ field: 'bdd.runCommand', message: 'runCommand is required' });
  }

  if (!['jsdoc', 'tsdoc'].includes(config.docs.style)) {
    errors.push({
      field: 'docs.style',
      message: `Unsupported doc style: "${config.docs.style}". Use jsdoc or tsdoc`,
    });
  }

  if (!['markdown', 'html'].includes(config.docs.format)) {
    errors.push({
      field: 'docs.format',
      message: `Unsupported format: "${config.docs.format}". Use 'markdown' or 'html'`,
    });
  }

  return errors;
}

/**
 * Assert that a fully-resolved BddWorkflowConfig is valid, exiting the process
 * with a human-readable error summary if any validation errors are found.
 *
 * Intended to be called by every CLI command immediately after loadConfig.
 * Prints all errors to stderr before exiting so the user can fix them all in
 * one pass rather than discovering them one at a time.
 *
 * @param config - The resolved configuration to validate
 */
export function assertValidConfig(config: BddWorkflowConfig): void {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error('bdd-workflow configuration errors:');
    for (const err of errors) {
      console.error(`  ${err.field}: ${err.message}`);
    }
    process.exit(1);
  }
}
