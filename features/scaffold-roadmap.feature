Feature: Roadmap agents provisioned by scaffold

  Scenario: roadmap agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap.md" exists

  Scenario: roadmap-runner agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap-runner.md" exists

  Scenario: roadmap command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/roadmap.md" exists

  Scenario: scaffold .gitignore includes .worktrees directory
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".gitignore" contains ".worktrees/"
