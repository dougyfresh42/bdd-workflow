Feature: bdd-workflow check command

  As a developer using bdd-workflow,
  I want to run `bdd-workflow check` to verify my project before review,
  So that I have a single canonical pre-review gate that type-checks and runs tests.

  Scenario: check subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output includes "check"

  Scenario: check passes in a project with no type errors and no failing tests
    Given a minimal project with a passing Cucumber scenario
    When I run "bdd-workflow check" in that directory
    Then the command exits with status 0

  Scenario: check fails when tsc reports type errors
    Given a minimal project with a passing Cucumber scenario
    And the file "src/index.ts" contains a type error
    When I run "bdd-workflow check" in that directory
    Then the command exits with a non-zero status

  Scenario: check fails when cucumber tests fail
    Given a minimal project with a failing Cucumber scenario
    When I run "bdd-workflow check" in that directory
    Then the command exits with a non-zero status
