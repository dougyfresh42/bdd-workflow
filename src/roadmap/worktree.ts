/**
 * @module roadmap/worktree
 * @description Creates and manages git worktrees for roadmap step execution.
 * Provides `createStepWorktree` which creates a git worktree at
 * `worktrees/<step-id>/` (visible, gitignored directory at project root),
 * checks out a `roadmap/<step-id>` branch, and copies the step's linked
 * proposal file from `.opencode/proposals/` into the worktree's
 * `.opencode/proposals/` directory. Returns the absolute path to the
 * worktree so the caller can hand off to a sub-agent.
 *
 * Does NOT run the BDD workflow — that is the sub-agent's responsibility.
 * Does NOT modify the roadmap YAML — the caller updates step status.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { readRoadmap } from './index.js';
import type { BddWorkflowConfig } from '../config.js';

export interface WorktreeResult {
  path: string;         // absolute path to the created worktree
  branch: string;       // git branch name (roadmap/<step-id>)
  proposalPath: string; // path to the copied proposal inside the worktree
}

/**
 * Create a git worktree for a roadmap step and copy its linked proposal in.
 *
 * Steps performed:
 * 1. Reads the roadmap, finds the step by ID. Throws if step not found.
 * 2. Checks that the step has a `proposal` field. Throws "no proposal linked to step <id>" if not.
 * 3. Checks that the proposal file exists at `.opencode/proposals/<proposal>`. Throws if not.
 * 4. Creates `worktrees/` directory if it does not exist.
 * 5. Runs `git worktree add worktrees/<step-id> -b roadmap/<step-id>`.
 * 6. Copies `.opencode/proposals/<proposal>` into `worktrees/<step-id>/.opencode/proposals/`.
 * 7. Returns the WorktreeResult with absolute paths.
 *
 * Note: The worktree is a git checkout and will NOT have `node_modules/` unless
 * `npm install` is run inside it. The runner agent should run `npm install`
 * as the first step after worktree creation.
 *
 * @param config - The resolved BddWorkflowConfig
 * @param stepId - The ID of the roadmap step to create a worktree for
 * @returns WorktreeResult with absolute worktree path, branch name, and proposal path
 */
export function createStepWorktree(
  config: BddWorkflowConfig,
  stepId: string
): WorktreeResult {
  const roadmap = readRoadmap(config);
  if (!roadmap) {
    throw new Error('no roadmap file found');
  }

  const step = roadmap.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new Error(`step not found: ${stepId}`);
  }

  if (!step.proposal) {
    throw new Error(`no proposal linked to step ${stepId}`);
  }

  const proposalSrcPath = join(
    process.cwd(),
    config.workflow.proposalDir,
    step.proposal
  );
  if (!existsSync(proposalSrcPath)) {
    throw new Error(
      `proposal file not found: ${step.proposal} (expected at ${proposalSrcPath})`
    );
  }

  const worktreeDir = join(process.cwd(), 'worktrees');
  if (!existsSync(worktreeDir)) {
    mkdirSync(worktreeDir, { recursive: true });
  }

  const worktreePath = join(worktreeDir, stepId);
  const branchName = `roadmap/${stepId}`;

  execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  const destProposalsDir = join(worktreePath, config.workflow.proposalDir);
  mkdirSync(destProposalsDir, { recursive: true });

  const proposalDestPath = join(destProposalsDir, step.proposal);
  copyFileSync(proposalSrcPath, proposalDestPath);

  return {
    path: resolve(worktreePath),
    branch: branchName,
    proposalPath: resolve(proposalDestPath),
  };
}

/**
 * Remove a git worktree for a roadmap step and delete its branch.
 *
 * Tolerates "not found" errors gracefully — if the worktree or branch does
 * not exist, the function completes without throwing.
 *
 * @param stepId - The ID of the roadmap step whose worktree should be removed
 */
export function removeStepWorktree(stepId: string): void {
  const worktreePath = join(process.cwd(), 'worktrees', stepId);
  const branchName = `roadmap/${stepId}`;

  try {
    execSync(`git worktree remove "${worktreePath}"`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  } catch {
    // Tolerate: worktree not found or already removed
  }

  try {
    execSync(`git branch -d "${branchName}"`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  } catch {
    // Tolerate: branch not found or already deleted
  }
}
