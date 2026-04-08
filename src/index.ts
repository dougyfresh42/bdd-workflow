/**
 * @module bdd-workflow
 * Public API for the bdd-workflow framework. Import defineConfig
 * to configure the framework for your project.
 */

export { defineConfig, validateConfig, assertValidConfig } from './config.js';
export type {
  BddWorkflowConfig,
  BddConfig,
  DocsConfig,
  ContextConfig,
  WorkflowConfig,
  ConfigError,
} from './config.js';

export {
  readRoadmap,
  writeRoadmap,
  linkProposal,
  getReadySteps,
  validateRoadmap,
} from './roadmap/index.js';
export type {
  RoadmapStep,
  Roadmap,
  StepStatus,
  RoadmapValidationError,
} from './roadmap/index.js';

export { createStepWorktree, removeStepWorktree } from './roadmap/worktree.js';
export type { WorktreeResult } from './roadmap/worktree.js';
