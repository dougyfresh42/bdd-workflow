Feature: Config validation
  As a developer using bdd-workflow
  I want invalid configuration to be caught and reported clearly
  So that I can fix misconfiguration without reading source code

  Scenario: validateConfig returns empty array for a valid config
    Given a valid bdd-workflow configuration
    When I call validateConfig
    Then the result is an empty array

  Scenario: validateConfig reports an unsupported language
    Given a bdd-workflow config with language set to "ruby"
    When I call validateConfig
    Then the result contains one error for field "language"
    And the error message mentions "typescript" and "javascript"

  Scenario: validateConfig reports missing bdd.featuresDir
    Given a bdd-workflow config with bdd.featuresDir set to ""
    When I call validateConfig
    Then the result contains one error for field "bdd.featuresDir"
    And the error message says "featuresDir is required"

  Scenario: validateConfig reports missing bdd.runCommand
    Given a bdd-workflow config with bdd.runCommand set to ""
    When I call validateConfig
    Then the result contains one error for field "bdd.runCommand"
    And the error message says "runCommand is required"

  Scenario: validateConfig reports unsupported docs.style
    Given a bdd-workflow config with docs.style set to "openapi"
    When I call validateConfig
    Then the result contains one error for field "docs.style"
    And the error message mentions "jsdoc" and "tsdoc"

  Scenario: validateConfig reports unsupported docs.format
    Given a bdd-workflow config with docs.format set to "pdf"
    When I call validateConfig
    Then the result contains one error for field "docs.format"
    And the error message mentions "markdown" and "html"

  Scenario: CLI commands exit 1 and print errors when config is invalid
    Given a project with an invalid bdd-workflow.config.ts
    When I run "npx bdd-workflow context" in the project
    Then the command exits with status 1
    And the output contains "bdd-workflow configuration errors:"
    And the output contains "language:"
