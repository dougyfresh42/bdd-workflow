Feature: Context Generation
  As a developer using bdd-workflow
  I want to run `npx bdd-workflow context`
  So that CONTEXT.md is automatically generated from my source files and feature specs

  Background:
    Given the bdd-workflow package is built
    And a temporary project directory with TypeScript source files and feature specs

  Scenario: Happy path — generates CONTEXT.md with all five sections
    Given the project has TypeScript source files with JSDoc comments
    And the project has Gherkin feature files with scenarios
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md is created at the project root
    And CONTEXT.md contains a "## Overview" section
    And CONTEXT.md contains a "## Directory Structure" section
    And CONTEXT.md contains a "## Modules" section
    And CONTEXT.md contains a "## Features" section
    And CONTEXT.md contains a "## Public API" section

  Scenario: Module summaries include JSDoc descriptions
    Given the project has a TypeScript file with a file-level JSDoc comment "Manages user session lifecycle"
    When I run "npx bdd-workflow context" in the project
    Then the "## Modules" section includes the file path
    And the "## Modules" section includes the text "Manages user session lifecycle"

  Scenario: Files without JSDoc comments are omitted from modules section
    Given the project has a TypeScript file with no file-level JSDoc comment
    When I run "npx bdd-workflow context" in the project
    Then the "## Modules" section does not include that file

  Scenario: Feature summaries include feature name and scenario names
    Given the project has a feature file with feature name "Authentication"
    And that feature file has a scenario named "User logs in with valid credentials"
    When I run "npx bdd-workflow context" in the project
    Then the "## Features" section includes "Authentication"
    And the "## Features" section includes "User logs in with valid credentials"

  Scenario: Public API section lists exported function signatures
    Given the project has a TypeScript file exporting a function "createSession(userId: string): Promise<Session>"
    When I run "npx bdd-workflow context" in the project
    Then the "## Public API" section includes the function signature

  Scenario: Deterministic output — running twice produces identical content
    Given I run "npx bdd-workflow context" in the project
    When I run "npx bdd-workflow context" again in the project
    Then both CONTEXT.md files are byte-for-byte identical (excluding the timestamp line)

  Scenario: Graceful empty state — no feature files
    Given the project has TypeScript source files but no Gherkin feature files
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md is created without errors
    And the "## Features" section is omitted or shows "No feature files found"

  Scenario: Config sections flag — featureSummaries disabled
    Given bdd-workflow.config.ts has "featureSummaries: false"
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md does not contain a "## Features" section

  Scenario: Config sections flag — exports disabled
    Given bdd-workflow.config.ts has "exports: false"
    When I run "npx bdd-workflow context" in the project
    Then CONTEXT.md does not contain a "## Public API" section

  Scenario: context subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output includes "context"
