import { defineConfig } from './src/index.ts';

export default defineConfig({
  language: 'typescript',
  bdd: {
    framework: 'cucumber',
    featuresDir: 'features',
    stepsDir: 'features/support/steps',
    // Node 20 + Cucumber 11: the loader: key in cucumber.js does not propagate
    // tsx to worker threads. Pass NODE_OPTIONS so the ESM hook is available in
    // every thread that loads .ts step files.
    runCommand: "NODE_OPTIONS='--import tsx/esm' npx cucumber-js",
  },
  workflow: {
    maxAmendIterations: 3,
    autoReviewAfterApply: true,
    autoContextAfterArchive: true,
    proposalDir: '.opencode/proposals',
    learningsDir: '.opencode/learnings',
    repository: 'douglasdollars/bdd-workflow',
    roadmapFile: '.opencode/roadmap.yaml',
  },
});
