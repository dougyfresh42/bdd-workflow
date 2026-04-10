---
name: bdd-workflow-roadmap
description: Roadmap YAML schema, maintenance operations, and dependency management
license: MIT
compatibility: opencode
---

# BDD Workflow Roadmap

This skill covers creating, editing, and maintaining the project roadmap stored at
`.opencode/roadmap.yaml`.

## Roadmap File Location

`.opencode/roadmap.yaml` (or the path configured in `workflow.roadmapFile`).

## YAML Schema

### Top-level fields

```yaml
title: My Project Roadmap   # required — human-readable roadmap name
description: Optional overview of the roadmap
steps:
  - ...
```

### Per-step fields

```yaml
id: kebab-case-id           # required — unique within roadmap
title: One-line description # required — human-readable
status: pending             # required — one of: pending, in-progress, done, skipped
description: |              # optional — longer description
  More detail about this step.
depends_on:                 # optional — list of step IDs that must be done first
  - another-step-id
proposal: 2026-04-10-slug.md  # optional — basename of linked proposal file
notes: |                    # optional — free-form notes; not machine-read
  Implementation notes or decisions.
acceptance_criteria:        # optional — mirrors the proposal's Acceptance Criteria section
  - "Run npm start; visiting http://localhost:3000 serves an HTML page."
  - "npx my-cli --help prints usage and exits 0."
```

### `acceptance_criteria` field

An optional list of strings mirroring the `## Acceptance Criteria` section in the linked
proposal. Filled in when the roadmap step is created or linked. The cycle skill surfaces
these criteria at the acceptance gate during execution. If absent, the agent falls back to
the proposal file's `## Acceptance Criteria` section.

## CRUD Operations

### Create a new roadmap

1. Ask the user for:
   - A roadmap title
   - A list of steps (id, title, optional description)
   - Dependencies between steps (`depends_on`)
   - Optional `acceptance_criteria` per step
2. Write `.opencode/roadmap.yaml`
3. Validate: `npx bdd-workflow roadmap validate`
4. Show: `npx bdd-workflow roadmap show`

### Edit an existing step

1. Read `.opencode/roadmap.yaml`
2. Make the requested changes (title, description, status, notes, etc.)
3. Validate: `npx bdd-workflow roadmap validate`

### Link a proposal to a step

```
npx bdd-workflow roadmap link <step-id> <proposal-basename>
```

The proposal file must exist in `.opencode/proposals/`.

### Show the roadmap

```
npx bdd-workflow roadmap show      # table of all steps with status
npx bdd-workflow roadmap status    # summary: N pending / N in-progress / N done
npx bdd-workflow roadmap validate  # structural validation
```

## Dependency Management

- `depends_on` lists step IDs that must have `status: done` before this step can start.
- A step is "ready" when its status is `pending` and all `depends_on` steps are `done`.
- The `getReadySteps` function in the CLI uses this logic for the roadmap cycle.
- Circular dependencies are not explicitly detected by the CLI — avoid them by design.

## What This Skill Does NOT Cover

- **Executing steps** — that is the cycle skill (`bdd-workflow-cycle`).
- **Writing proposals** — that is the `/propose` command and `bdd-propose` skill.
- **Creating worktrees** — that is the CLI command `npx bdd-workflow roadmap worktree <step-id>`.
