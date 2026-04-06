Feature: bdd-workflow learn command
  As a developer using the bdd-workflow framework
  I want to capture, list, and promote workflow learnings
  So that recurring friction points can be fed back as improvements to the framework

  Background:
    Given a clean temporary directory with bdd-workflow initialized
    And a learning entry "2026-04-01-missing-error-spec.md" with status "new"
    And a learning entry "2026-04-02-ambiguous-proposal.md" with status "new"
    And a learning entry "2026-04-03-already-done.md" with status "promoted" and github_issue 42

  Scenario: learn subcommand appears in CLI help
    When I run "npx bdd-workflow --help"
    Then the output contains "learn"

  Scenario: learn list prints all learning entries
    When I run "npx bdd-workflow learn list"
    Then the output contains "2026-04-01-missing-error-spec"
    And the output contains "2026-04-02-ambiguous-proposal"
    And the output contains "2026-04-03-already-done"

  Scenario: learn list shows status and issue reference
    When I run "npx bdd-workflow learn list"
    Then the output contains "new"
    And the output contains "promoted"
    And the output contains "#42"

  Scenario: learn promote --dry-run prints issue content without creating issues
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output contains "DRY RUN"
    And the output contains "missing-error-spec"
    And the output contains "ambiguous-proposal"
    And no GitHub issues are created

  Scenario: learn promote skips already-promoted learnings
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "already-done"

  Scenario: learn promote skips learnings with status closed
    Given a learning entry "2026-04-04-closed.md" with status "closed"
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "closed"

  Scenario: learn promote fails gracefully when gh is not available
    Given the "gh" CLI is not available in PATH
    When I run "npx bdd-workflow learn promote"
    Then the command exits with a non-zero status
    And the output contains "gh"

  Scenario: promoted learnings are not re-promoted on subsequent runs
    Given "2026-04-01-missing-error-spec.md" has been promoted to issue #99
    When I run "npx bdd-workflow learn promote --dry-run"
    Then the output does not contain "missing-error-spec"

  Scenario: learn list shows no entries gracefully when learnings directory is empty
    Given the learnings directory exists but contains no files
    When I run "npx bdd-workflow learn list"
    Then the command exits with status 0
    And the output does not contain "Error"

  Scenario: parseLearningFile correctly parses all frontmatter fields
    Given a valid learning entry file with all required frontmatter and sections
    When I parse the file with parseLearningFile
    Then the returned entry has the correct date, slug, status, promoted, and github_issue
    And the entry title matches the "# Learning:" heading
    And whatHappened, rootCause, and proposedChange are correctly extracted
