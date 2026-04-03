Feature: Phase 2 OpenCode Skills and Commands
  As a developer
  I want the scaffolded project to include all Phase 2 OpenCode skills, commands, and agents
  So that I can use the BDD workflow (propose, apply, review, amend, learn, archive)

  Scenario: All 3 skill files exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the following skill files exist:
      | path |
      | .opencode/skills/bdd-workflow/SKILL.md |
      | .opencode/skills/bdd-propose/SKILL.md |
      | .opencode/skills/bdd-review/SKILL.md |

  Scenario: All 7 command files exist in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the following command files exist:
      | path |
      | .opencode/commands/propose.md |
      | .opencode/commands/apply.md |
      | .opencode/commands/review.md |
      | .opencode/commands/amend.md |
      | .opencode/commands/learn.md |
      | .opencode/commands/archive.md |
      | .opencode/commands/context.md |

  Scenario: Review agent file exists in scaffolded project
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/review.md" exists

  Scenario: All 3 template files have correct structure with frontmatter
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the template file ".opencode/templates/proposal.md" contains frontmatter
    And the template file ".opencode/templates/review.md" contains frontmatter
    And the template file ".opencode/templates/learning.md" contains frontmatter

  Scenario: Proposal template has all required sections
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the template file ".opencode/templates/proposal.md" contains section "## Summary"
    And the template file ".opencode/templates/proposal.md" contains section "## Doc Updates (WHY)"
    And the template file ".opencode/templates/proposal.md" contains section "## BDD Specs (WHAT)"
    And the template file ".opencode/templates/proposal.md" contains section "## Implementation Plan (HOW)"
    And the template file ".opencode/templates/proposal.md" contains section "## Risks and Considerations"

  Scenario: Review template has all required sections
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the template file ".opencode/templates/review.md" contains section "## Completeness"
    And the template file ".opencode/templates/review.md" contains section "## Doc Layer (WHY)"
    And the template file ".opencode/templates/review.md" contains section "## Spec Layer (WHAT)"
    And the template file ".opencode/templates/review.md" contains section "## Test Results"
    And the template file ".opencode/templates/review.md" contains section "## Type Check"
    And the template file ".opencode/templates/review.md" contains section "## Consistency"
    And the template file ".opencode/templates/review.md" contains section "## Verdict"

  Scenario: Learning template has all required sections
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the template file ".opencode/templates/learning.md" contains section "## What Happened"
    And the template file ".opencode/templates/learning.md" contains section "## Root Cause"
    And the template file ".opencode/templates/learning.md" contains section "## Proposed Framework Change"

  Scenario: Skills contain expected content
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" contains text "Three-Layer Model"
    And the file ".opencode/skills/bdd-propose/SKILL.md" contains text "Required Sections"
    And the file ".opencode/skills/bdd-review/SKILL.md" contains text "Review Checklist"

  Scenario: Commands contain expected structure
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/commands/propose.md" contains YAML frontmatter
    And the file ".opencode/commands/apply.md" contains YAML frontmatter
    And the file ".opencode/commands/review.md" contains YAML frontmatter
    And the file ".opencode/commands/amend.md" contains YAML frontmatter
    And the file ".opencode/commands/learn.md" contains YAML frontmatter
    And the file ".opencode/commands/archive.md" contains YAML frontmatter
    And the file ".opencode/commands/context.md" contains YAML frontmatter

  Scenario: Review agent has permission restrictions
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file ".opencode/agents/review.md" contains text "edit: deny"
    And the file ".opencode/agents/review.md" contains text "git diff"
    And the file ".opencode/agents/review.md" contains text "npx cucumber-js"
    And the file ".opencode/agents/review.md" contains text "npx tsc --noEmit"

  Scenario: opencode.json includes review agent config
    Given a clean temporary directory
    When I run "npx bdd-workflow init" in that directory
    Then the file "opencode.json" contains valid JSON
    And the file "opencode.json" contains "agent"
    And the file "opencode.json" contains "review"
