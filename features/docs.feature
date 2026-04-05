Feature: bdd-workflow docs command

  Scenario: docs subcommand appears in CLI help
    Given the bdd-workflow CLI is installed
    When I run "bdd-workflow --help"
    Then the output contains "docs"

  Scenario: docs generates markdown output in a TypeScript project
    Given a temporary project directory with TypeScript source files and JSDoc comments
    And the project has a valid "src/index.ts" entry point
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with code 0
    And the "docs/" directory is created
    And it contains at least one markdown file

  Scenario: docs command respects the --format html flag
    Given a temporary project directory with TypeScript source files
    When I run "bdd-workflow docs --format html" in the project directory
    Then the command exits with code 0
    And the "docs/" directory contains HTML files

  Scenario: docs fails gracefully when no entry point exists
    Given a temporary project directory with no "src/index.ts"
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with a non-zero code
    And the output contains a helpful error message

  Scenario: TypeDoc errors are surfaced clearly
    Given a temporary project directory with a malformed TypeScript file
    When I run "bdd-workflow docs" in the project directory
    Then the command exits with a non-zero code
    And the error output is not swallowed
