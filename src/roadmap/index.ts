/**
 * @module roadmap
 * @description Reads, writes, and validates the project roadmap at
 * `.opencode/roadmap.yaml` (or the path configured in
 * `workflow.roadmapFile`). Provides typed access to roadmap steps, their
 * dependency graph, status values, and proposal links. Exposes functions used
 * by the CLI commands and by the roadmap-runner agent's shell tooling.
 *
 * Does NOT execute steps, create worktrees, or interact with git. That is
 * the responsibility of src/roadmap/worktree.ts and the roadmap-runner agent.
 * Does NOT write proposals — that remains the responsibility of the
 * bdd-workflow agent via the /propose command.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { BddWorkflowConfig } from '../config.js';

export type StepStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface RoadmapStep {
  id: string;           // kebab-case identifier, unique within roadmap
  title: string;        // human-readable one-liner
  status: StepStatus;
  description?: string; // optional longer description
  depends_on?: string[];// ids of steps that must be 'done' before this starts
  proposal?: string;    // filename of linked proposal (basename only, no path)
  worktree?: string;    // git worktree branch name when in-progress
  notes?: string;       // free-form notes; not machine-read
}

export interface Roadmap {
  title: string;        // project/roadmap title
  description?: string;
  steps: RoadmapStep[];
}

export interface RoadmapValidationError {
  stepId?: string;      // which step has the error (undefined for roadmap-level errors)
  field: string;
  message: string;
}

/**
 * Resolve the path to the roadmap YAML file using the project config.
 *
 * @param config - The resolved BddWorkflowConfig
 * @returns Absolute path to the roadmap YAML file
 */
function getRoadmapPath(config: BddWorkflowConfig): string {
  return join(process.cwd(), config.workflow.roadmapFile ?? '.opencode/roadmap.yaml');
}

/**
 * Read and parse the roadmap YAML file.
 *
 * Returns `null` if the file does not exist. Throws on YAML parse errors.
 *
 * @param config - The resolved BddWorkflowConfig
 * @returns Parsed Roadmap object or null if file is absent
 */
export function readRoadmap(config: BddWorkflowConfig): Roadmap | null {
  const roadmapPath = getRoadmapPath(config);
  if (!existsSync(roadmapPath)) {
    return null;
  }
  const content = readFileSync(roadmapPath, 'utf-8');
  const parsed = yaml.load(content) as Roadmap;
  return parsed;
}

/**
 * Serialize and write the roadmap to the YAML file.
 *
 * Uses `sortKeys: false` to preserve authoring order.
 *
 * Note: YAML comments are stripped by js-yaml — users should not put
 * important information in YAML comments.
 *
 * @param config  - The resolved BddWorkflowConfig
 * @param roadmap - The Roadmap object to serialize
 */
export function writeRoadmap(config: BddWorkflowConfig, roadmap: Roadmap): void {
  const roadmapPath = getRoadmapPath(config);
  const content = yaml.dump(roadmap, { sortKeys: false, lineWidth: -1 });
  writeFileSync(roadmapPath, content, 'utf-8');
}

/**
 * Associate a proposal file with a roadmap step.
 *
 * Reads the roadmap, finds the step by id, sets the `proposal` field to the
 * given filename, and writes the roadmap back. Throws if the step is not found
 * or if the proposal file does not exist in the configured proposals directory.
 *
 * @param config           - The resolved BddWorkflowConfig
 * @param stepId           - The ID of the step to update
 * @param proposalFilename - Basename of the proposal file (no path prefix)
 */
export function linkProposal(
  config: BddWorkflowConfig,
  stepId: string,
  proposalFilename: string
): void {
  const roadmap = readRoadmap(config);
  if (!roadmap) {
    throw new Error('no roadmap file found');
  }

  const step = roadmap.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new Error(`step not found: ${stepId}`);
  }

  const proposalPath = join(process.cwd(), config.workflow.proposalDir, proposalFilename);
  if (!existsSync(proposalPath)) {
    throw new Error(`proposal file not found: ${proposalFilename}`);
  }

  step.proposal = proposalFilename;
  writeRoadmap(config, roadmap);
}

/**
 * Return steps that are ready to be worked on.
 *
 * A step is ready if its status is `pending` and all `depends_on` steps have
 * status `done`.
 *
 * WARNING: This function assumes the roadmap is a DAG (acyclic). Cycle
 * detection is out of scope for v1 — the roadmap agent is responsible for
 * authoring acyclic roadmaps. If the roadmap contains cycles, this function
 * may return incorrect results or loop indefinitely in future extensions.
 *
 * @param roadmap - The Roadmap to inspect
 * @returns Steps that are pending and whose dependencies are all done
 */
export function getReadySteps(roadmap: Roadmap): RoadmapStep[] {
  const doneIds = new Set(
    roadmap.steps.filter((s) => s.status === 'done').map((s) => s.id)
  );

  return roadmap.steps.filter((step) => {
    if (step.status !== 'pending') return false;
    const deps = step.depends_on ?? [];
    return deps.every((dep) => doneIds.has(dep));
  });
}

const VALID_STATUSES: StepStatus[] = ['pending', 'in-progress', 'done', 'skipped'];

/**
 * Validate a Roadmap object and return all structural errors found.
 *
 * Checks for:
 * - Missing required fields (`id`, `title`, `status`) on each step
 * - Invalid `status` values (not one of the four allowed values)
 * - Duplicate step IDs
 * - Dangling `depends_on` references (referencing a step ID that does not exist)
 *
 * Does NOT check for dependency cycles (out of scope for v1).
 *
 * @param roadmap - The Roadmap to validate
 * @returns Array of RoadmapValidationError objects (empty if valid)
 */
export function validateRoadmap(roadmap: Roadmap): RoadmapValidationError[] {
  const errors: RoadmapValidationError[] = [];
  const seenIds = new Set<string>();
  const allIds = new Set(roadmap.steps.map((s) => s.id).filter(Boolean));

  for (const step of roadmap.steps) {
    const stepId = step.id;

    // Required field: id
    if (!step.id) {
      errors.push({ field: 'id', message: 'missing required field: id' });
    }

    // Required field: title
    if (!step.title) {
      errors.push({ stepId, field: 'title', message: 'missing required field: title' });
    }

    // Required field: status
    if (!step.status) {
      errors.push({ stepId, field: 'status', message: 'missing required field: status' });
    } else if (!VALID_STATUSES.includes(step.status)) {
      errors.push({
        stepId,
        field: 'status',
        message: `invalid status value: "${step.status}". Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Duplicate IDs
    if (step.id) {
      if (seenIds.has(step.id)) {
        errors.push({
          stepId,
          field: 'id',
          message: `duplicate step id: "${step.id}"`,
        });
      } else {
        seenIds.add(step.id);
      }
    }

    // Dangling depends_on references
    for (const dep of step.depends_on ?? []) {
      if (!allIds.has(dep)) {
        errors.push({
          stepId,
          field: 'depends_on',
          message: `unknown dependency: "${dep}" referenced by step "${stepId}"`,
        });
      }
    }
  }

  return errors;
}

/**
 * Print a human-readable table of roadmap steps to stdout.
 *
 * Columns: ID, Title, Status, Depends On, Proposal.
 *
 * @param roadmap - The Roadmap to display
 */
export function printRoadmapTable(roadmap: Roadmap): void {
  console.log(`\nRoadmap: ${roadmap.title}`);
  if (roadmap.description) {
    console.log(roadmap.description);
  }
  console.log('');

  const headers = ['ID', 'Title', 'Status', 'Depends On', 'Proposal'];
  const rows = roadmap.steps.map((step) => [
    step.id,
    step.title,
    step.status,
    (step.depends_on ?? []).join(', '),
    step.proposal ?? '',
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');

  console.log(headerRow);
  console.log(separator);
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | '));
  }
  console.log('');
}

/**
 * Print a progress summary of roadmap steps grouped by status to stdout.
 *
 * Output format: "<N> done, <N> in-progress, <N> pending, <N> skipped"
 *
 * @param roadmap - The Roadmap to summarize
 */
export function printRoadmapStatus(roadmap: Roadmap): void {
  const counts: Record<StepStatus, number> = {
    done: 0,
    'in-progress': 0,
    pending: 0,
    skipped: 0,
  };

  for (const step of roadmap.steps) {
    if (step.status in counts) {
      counts[step.status]++;
    }
  }

  console.log(`Roadmap status: ${roadmap.title}`);
  console.log(`  ${counts.done} done`);
  console.log(`  ${counts['in-progress']} in-progress`);
  console.log(`  ${counts.pending} pending`);
  console.log(`  ${counts.skipped} skipped`);
}
