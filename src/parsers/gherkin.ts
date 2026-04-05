/**
 * @module parsers/gherkin
 * @description Parses Gherkin `.feature` files using the official
 * `@cucumber/gherkin` package and extracts Feature names and Scenario names
 * into a structured summary. Handles Rules, Scenario Outlines, and Examples
 * tables. Does NOT execute scenarios — parsing only.
 *
 * Extended in Phase 4 with `parseFeatureFilesDetailed` which additionally
 * extracts per-step keyword and text, feature descriptions, feature-level
 * tags, and scenario-level tags.
 */

import * as Gherkin from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import type { FeatureChild } from '@cucumber/messages';
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

/** A single step extracted from a scenario. */
export interface StepDetail {
  keyword: string;
  text: string;
}

/** A scenario with full step details, tags, and outline metadata. */
export interface ScenarioDetail {
  name: string;
  steps: StepDetail[];
  tags: string[];
  isOutline: boolean;
  /** Header row + data rows for Scenario Outlines. */
  examples?: string[][];
}

/** Detailed representation of a .feature file (superset of FeatureSummary). */
export interface FeatureDetail {
  filePath: string;
  featureName: string;
  description: string;
  scenarios: ScenarioDetail[];
  tags: string[];
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

/**
 * Parse all `.feature` files and return full step-level detail for each.
 *
 * Superset of `parseFeatureFiles` — returns the same files in the same order
 * but includes full step text, feature descriptions, feature-level tags, and
 * per-scenario tags. Scenario Outlines are flagged with `isOutline: true` and
 * include their Examples rows. Files that fail to parse are warned and skipped.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of FeatureDetail objects, one per .feature file, sorted by path
 */
export async function parseFeatureFilesDetailed(
  config: BddWorkflowConfig
): Promise<FeatureDetail[]> {
  const featuresDir = config.bdd.featuresDir;
  const pattern = join(featuresDir, '**', '*.feature').replace(/\\/g, '/');
  const files = await glob(pattern, { ignore: config.context.exclude });

  // Sort for deterministic output
  files.sort();

  const results: FeatureDetail[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');

      const uuidFn = IdGenerator.uuid();
      const builder = new Gherkin.AstBuilder(uuidFn);
      const matcher = new Gherkin.GherkinClassicTokenMatcher();
      const parser = new Gherkin.Parser(builder, matcher);

      const gherkinDocument = parser.parse(content);
      const feature = gherkinDocument.feature;

      const featureName = feature?.name ?? '(unnamed)';
      const description = feature?.description?.trim() ?? '';
      const tags = (feature?.tags ?? []).map((t) => t.name.replace(/^@/, ''));

      const scenarios: ScenarioDetail[] = [];

      function collectScenarios(children: readonly FeatureChild[]): void {
        for (const child of children ?? []) {
          if (child.scenario) {
            const scenario = child.scenario;
            const isOutline = scenario.keyword.includes('Outline');
            const scenarioTags = (scenario.tags ?? []).map((t) =>
              t.name.replace(/^@/, '')
            );
            const steps: StepDetail[] = (scenario.steps ?? []).map((s) => ({
              keyword: s.keyword.trim(),
              text: s.text,
            }));

            let examples: string[][] | undefined;
            if (isOutline && scenario.examples && scenario.examples.length > 0) {
              const ex = scenario.examples[0];
              const headerRow = (ex.tableHeader?.cells ?? []).map((c) => c.value);
              const dataRows = (ex.tableBody ?? []).map((row) =>
                (row.cells ?? []).map((c) => c.value)
              );
              examples = [headerRow, ...dataRows];
            }

            scenarios.push({
              name: scenario.name,
              steps,
              tags: scenarioTags,
              isOutline,
              examples,
            });
          } else if (child.rule) {
            collectScenarios(child.rule.children ?? []);
          }
        }
      }

      collectScenarios(feature?.children ?? []);

      results.push({ filePath, featureName, description, scenarios, tags });
    } catch (err) {
      console.warn(`[bdd-workflow] Warning: failed to parse ${filePath}: ${err}`);
    }
  }

  return results;
}
