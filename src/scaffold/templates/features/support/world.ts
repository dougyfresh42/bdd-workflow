/**
 * Cucumber world for bdd-workflow projects.
 * Extend this class to add custom properties or methods available in step definitions.
 */

import { World } from '@cucumber/cucumber';

export class BddWorkflowWorld extends World {
  /**
   * Initialize the world.
   */
  constructor(options: any) {
    super(options);
  }
}
