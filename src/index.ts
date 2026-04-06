/**
 * @module bdd-workflow
 * Public API for the bdd-workflow framework. Import defineConfig
 * to configure the framework for your project.
 */

export { defineConfig } from './config.js';
export type {
  BddWorkflowConfig,
  BddConfig,
  DocsConfig,
  ContextConfig,
  WorkflowConfig,
} from './config.js';
