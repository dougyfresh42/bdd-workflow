/**
 * Configuration types and defineConfig function.
 */

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

/**
 * Define configuration for bdd-workflow.
 * @param config - Partial configuration (defaults are merged)
 * @returns Complete configuration with defaults applied
 */
export function defineConfig(config: Partial<BddWorkflowConfig>): BddWorkflowConfig {
  return { ...defaults, ...config };
}
