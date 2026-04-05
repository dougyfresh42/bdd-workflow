Feature: BDD workflow agent provisioned by scaffold

  Scenario: bdd-workflow agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/bdd-workflow.md" exists

  Scenario: bdd-workflow command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/bdd-workflow.md" exists
