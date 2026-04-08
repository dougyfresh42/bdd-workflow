Feature: Roadmap workflow

  Background:
    Given an initialized bdd-workflow project

  Scenario: roadmap subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output contains "roadmap"

  Scenario: roadmap show prints an empty roadmap gracefully
    Given no roadmap file exists
    When I run "npx bdd-workflow roadmap show"
    Then the command exits with status 0
    And the output contains "No roadmap found"

  Scenario: roadmap show prints step table with statuses
    Given a roadmap file with two steps: "setup" (pending) and "auth" (done)
    When I run "npx bdd-workflow roadmap show"
    Then the output contains "setup" and "pending"
    And the output contains "auth" and "done"

  Scenario: roadmap status prints progress summary
    Given a roadmap file with 3 pending steps and 1 done step
    When I run "npx bdd-workflow roadmap status"
    Then the output contains "1 done"
    And the output contains "3 pending"
    And the output contains "0 in-progress"

  Scenario: roadmap link associates a proposal with a step
    Given a roadmap file with a step "setup" (pending)
    And a proposal file ".opencode/proposals/2026-04-08-setup.md" exists
    When I run "npx bdd-workflow roadmap link setup 2026-04-08-setup.md"
    Then the command exits with status 0
    And the roadmap file contains proposal "2026-04-08-setup.md" under step "setup"

  Scenario: roadmap link fails when step does not exist
    Given a roadmap file with no step named "nonexistent"
    When I run "npx bdd-workflow roadmap link nonexistent some-proposal.md"
    Then the command exits with status 1
    And the output contains "step not found: nonexistent"

  Scenario: roadmap link fails when proposal file does not exist
    Given a roadmap file with a step "setup"
    When I run "npx bdd-workflow roadmap link setup missing-proposal.md"
    Then the command exits with status 1
    And the output contains "proposal file not found"

  Scenario: roadmap validate passes for a valid roadmap
    Given a roadmap file with valid steps and no structural errors
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 0
    And the output contains "roadmap is valid"

  Scenario: roadmap validate reports missing required fields
    Given a roadmap file with a step missing the "title" field
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "missing required field"

  Scenario: roadmap validate reports duplicate step IDs
    Given a roadmap file with two steps sharing the id "setup"
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "duplicate step id"

  Scenario: roadmap validate reports dangling depends_on references
    Given a roadmap file where step "auth" depends_on "nonexistent"
    When I run "npx bdd-workflow roadmap validate"
    Then the command exits with status 1
    And the output contains "unknown dependency"

  Scenario: roadmap worktree creates a worktree and copies the proposal
    Given a roadmap file with a step "setup" linked to proposal "2026-04-08-setup.md"
    And a proposal file ".opencode/proposals/2026-04-08-setup.md" exists
    When I run "npx bdd-workflow roadmap worktree setup"
    Then the command exits with status 0
    And the directory ".worktrees/setup" exists
    And the file ".worktrees/setup/.opencode/proposals/2026-04-08-setup.md" exists
    And the output contains the worktree path

  Scenario: roadmap worktree fails when step has no linked proposal
    Given a roadmap file with a step "setup" and no linked proposal
    When I run "npx bdd-workflow roadmap worktree setup"
    Then the command exits with status 1
    And the output contains "no proposal linked"

  Scenario: roadmap YAML is valid and parseable after roadmap agent creates it
    Given a roadmap YAML file conforming to the RoadmapStep schema
    When I parse the roadmap file
    Then all steps have required fields: id, title, status
    And status values are one of: pending, in-progress, done, skipped
