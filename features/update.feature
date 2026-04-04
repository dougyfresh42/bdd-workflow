Feature: bdd-workflow update command

  As a developer using bdd-workflow in an existing project,
  I want to run `npx bdd-workflow update` to get the latest framework files,
  So that my agents, commands, skills, and templates stay current without losing my customizations.

  Background:
    Given a project directory initialized with bdd-workflow

  Scenario: Update refreshes an outdated framework file that the user has not modified
    Given the file ".opencode/skills/bdd-workflow/SKILL.md" on disk is outdated but unmodified
    When I run "bdd-workflow update"
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update skips a file that already matches the template
    Given the file ".opencode/skills/bdd-workflow/SKILL.md" on disk matches the current template
    When I run "bdd-workflow update"
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" is unchanged
    And the output reports "1 identical"

  Scenario: Update adds a new framework file that did not exist
    Given the file ".opencode/agents/review.md" does not exist on disk
    When I run "bdd-workflow update"
    Then the file ".opencode/agents/review.md" exists on disk
    And the output reports "1 added"

  Scenario: Update merges a file where the user has only changed the model
    Given the file ".opencode/commands/apply.md" has a user-customized model
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" body matches the current template body
    And the file ".opencode/commands/apply.md" retains the user-customized model
    And the output reports "1 merged"

  Scenario: Update merges an outdated file preserving the user's model choice
    Given the file ".opencode/commands/apply.md" on disk is outdated but unmodified except for model
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" body matches the current template body
    And the file ".opencode/commands/apply.md" retains the user-customized model
    And the output reports "1 merged"

  Scenario: Update skips a user-modified framework file without --force
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" is unchanged
    And the output reports "1 modified by user (skipped)"
    And the output includes a hint to use "--force" to overwrite

  Scenario: Update overwrites a user-modified file when --force is given
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update --force"
    Then the file ".opencode/commands/apply.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update fails when run outside an initialized project
    Given a directory that has not been initialized with bdd-workflow
    When I run "bdd-workflow update"
    Then the command exits with a non-zero status
    And the output includes "not an initialized bdd-workflow project"
