Feature: CLI error handling
  As a developer using bdd-workflow
  I want clear, actionable error messages
  So that I can diagnose and fix problems quickly

  Scenario: context command prints info and exits 0 when no feature files exist
    Given a project with no .feature files in the features directory
    When I run "npx bdd-workflow context" in the project
    Then the command exits with status 0
    And the output contains a message about no feature files

  Scenario: specs command prints info and exits 0 when no feature files exist
    Given a project with no .feature files in the features directory
    When I run "npx bdd-workflow specs" in the project
    Then the command exits with status 0
    And the output contains a message about no feature files

  Scenario: context command prints info and exits 0 when no TypeScript source files exist
    Given a project with no TypeScript files in the src directory
    When I run "npx bdd-workflow context" in the project
    Then the command exits with status 0
    And the output contains a message about no source files

  Scenario: learn promote exits 1 with a clear message when gh CLI is not found
    Given the "gh" CLI is not available in PATH
    When I run "npx bdd-workflow learn promote" in the project
    Then the command exits with a non-zero status
    And the output contains "GitHub CLI not found"
    And the output contains "https://cli.github.com"

  Scenario: docs command surfaces TypeDoc errors clearly
    Given a project where the configured entry point does not exist
    When I run "npx bdd-workflow docs" in the project
    Then the command exits with status 1
    And the output contains an error about the missing entry point

  Scenario: check command exits 1 when tsconfig.json is missing
    Given a project with no tsconfig.json
    When I run "npx bdd-workflow check" in the project
    Then the command exits with status 1
    And the output contains "TypeScript config not found"
    And the output contains "npx tsc --init"
