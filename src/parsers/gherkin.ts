/**
 * @module parsers/gherkin
 * @description Parses Gherkin `.feature` files using the official
 * `@cucumber/gherkin` package and extracts Feature names and Scenario names
 * into a structured summary. Handles Rules, Scenario Outlines, and Examples
 * tables. Does NOT execute scenarios — parsing only.
 */

import * as Gherkin from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { join } from 'node:path';
import { BddWorkflowConfig } from '../config.js';

/** Summary of a single .feature file. */
export interface FeatureSummary {
  filePath: string;
  featureName: string;
  scenarios: string[];
}

/**
 * Parse all `.feature` files in the configured features directory.
 *
 * For each file, extracts the Feature name and the names of all Scenarios
 * (including Scenario Outlines). Files that fail to parse are logged as
 * warnings and skipped.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of FeatureSummary objects, one per .feature file
 */
export async function parseFeatureFiles(config: BddWorkflowConfig): Promise<FeatureSummary[]> {
  const featuresDir = config.bdd.featuresDir;
  const pattern = join(featuresDir, '**', '*.feature').replace(/\\/g, '/');
  const files = await glob(pattern, { ignore: config.context.exclude });

  // Sort for deterministic output
  files.sort();

  const results: FeatureSummary[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');

      const uuidFn = IdGenerator.uuid();
      const builder = new Gherkin.AstBuilder(uuidFn);
      const matcher = new Gherkin.GherkinClassicTokenMatcher();
      const parser = new Gherkin.Parser(builder, matcher);

      const gherkinDocument = parser.parse(content);

      const featureName = gherkinDocument.feature?.name ?? '(unnamed)';

      // Collect scenario names from top-level children and from Rule children
      const scenarios: string[] = [];
      for (const child of gherkinDocument.feature?.children ?? []) {
        if (child.scenario?.name) {
          scenarios.push(child.scenario.name);
        } else if (child.rule) {
          // Rule children can also contain scenarios
          for (const ruleChild of child.rule.children ?? []) {
            if (ruleChild.scenario?.name) {
              scenarios.push(ruleChild.scenario.name);
            }
          }
        }
      }

      results.push({ filePath, featureName, scenarios });
    } catch (err) {
      console.warn(`[bdd-workflow] Warning: failed to parse ${filePath}: ${err}`);
    }
  }

  return results;
}
