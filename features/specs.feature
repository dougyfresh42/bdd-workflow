Feature: bdd-workflow specs command

  Scenario: specs subcommand appears in CLI help
    Given the bdd-workflow CLI is installed
    When I run "bdd-workflow --help"
    Then the output contains "specs"

  Scenario: specs generates SPECS.md with a section for each feature
    Given a temporary project directory with two ".feature" files
    When I run "bdd-workflow specs" in the project directory
    Then the command exits with code 0
    And "SPECS.md" exists in the project directory
    And it contains one H2 section per feature file

  Scenario: Each section lists all scenarios with full step text
    Given a temporary project directory with a feature file containing steps
    When I run "bdd-workflow specs"
    Then "SPECS.md" lists each scenario name as an H3 heading
    And each step is shown with its keyword in bold followed by the step text

  Scenario: Summary table is accurate
    Given a temporary project directory with three feature files
    When I run "bdd-workflow specs"
    Then "SPECS.md" contains a summary table
    And the total row reflects the correct sum of all scenarios

  Scenario: specs runs gracefully when there are no feature files
    Given a temporary project directory with no ".feature" files
    When I run "bdd-workflow specs"
    Then the command exits with code 0
    And "SPECS.md" contains the header and summary section with zero scenarios

  Scenario: Tags are included when present on scenarios
    Given a feature file with tagged scenarios
    When I run "bdd-workflow specs"
    Then "SPECS.md" shows the tags for those scenarios

  Scenario: Scenario Outlines are shown as outlines, not as expanded example rows
    Given a feature file with a Scenario Outline and an Examples table
    When I run "bdd-workflow specs"
    Then "SPECS.md" shows the outline template with "<parameter>" placeholders
    And does not list individual example rows as separate scenarios

  Scenario: specs respects the --output flag
    Given a temporary project directory with feature files
    When I run "bdd-workflow specs --output my-specs.md"
    Then the command exits with code 0
    And the file "my-specs.md" is created instead of "SPECS.md"
