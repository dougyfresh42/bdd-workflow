Feature: Phase 6 scaffold additions
  As a developer initializing a new project
  I want the scaffold package.json to include a full set of npm scripts
  So that common development tasks are immediately available

  Scenario: scaffold package.json includes extended scripts
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file "package.json" contains "check:all"
    And the file "package.json" contains "test:watch"
    And the file "package.json" contains "docs"
    And the file "package.json" contains "context"
    And the file "package.json" contains "specs"

  Scenario: npx bdd-workflow --version prints a version string
    Given the bdd-workflow package is built
    When I run "npx bdd-workflow --version"
    Then the output contains a semver version string
