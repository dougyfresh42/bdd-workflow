/**
 * Cucumber world for bdd-workflow's own tests.
 */

import { World } from '@cucumber/cucumber';

/**
 * World for testing the bdd-workflow framework itself.
 */
export class BddWorkflowWorld extends World {
  tempDir?: string;
  lastOutput?: string;
  lastError?: string;
  lastExitCode?: number;
  defineConfig?: any;
  validateConfig?: any;
  /** The model value set by test setup, used to assert preservation after update. */
  customModel?: string;

  constructor(options: any) {
    super(options);
  }
}
