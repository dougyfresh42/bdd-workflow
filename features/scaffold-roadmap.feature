Feature: Roadmap scaffold provisions

  Scenario: roadmap command file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/roadmap.md" exists

  Scenario: standalone roadmap agent does not exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap.md" does not exist

  Scenario: roadmap-runner agent does not exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/roadmap-runner.md" does not exist

  Scenario: scaffold .gitignore includes worktrees/ directory
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".gitignore" contains "worktrees/"
