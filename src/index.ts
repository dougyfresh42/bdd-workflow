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
