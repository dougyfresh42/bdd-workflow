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

  constructor(options: any) {
    super(options);
  }
}
