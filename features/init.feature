Feature: Init Command
  As a developer
  I want to initialize a new project with bdd-workflow
  So that I can start using the BDD workflow framework

  Scenario: Initialize a new project in an empty directory
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the project scaffolds successfully
    And .opencode directory structure is created
    And features directory structure is created
    And config files are present

  Scenario: Init creates working TypeScript project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then running "npm install" in the project succeeds
    And running "npx tsc --noEmit" in the project succeeds

  Scenario: Init sets up working Cucumber
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then running "npm install" in the project succeeds
    And running "npx cucumber-js" in the project runs with 0 scenarios

  Scenario: defineConfig is importable from bdd-workflow
    Given the bdd-workflow package is built
    When I import defineConfig from bdd-workflow
    Then it returns a valid configuration with defaults

  Scenario: Init on existing project skips existing files
    Given a temporary directory with a package.json
    When I run "npx bdd-workflow init" in that directory
    Then the existing package.json is not overwritten
    And new bdd-workflow files are added

  Scenario: CLI help is available
    Given the bdd-workflow package is built
    When I run "npx bdd-workflow --help"
    Then help text is displayed
    And init subcommand is listed

  Scenario: Init subcommand has help
    Given the bdd-workflow package is built
    When I run "npx bdd-workflow init --help"
    Then help text for init is displayed
