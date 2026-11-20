Feature: The Payload plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Payload builder, each
  AI folder lists the items of its kind the plugin ships, and the Plugins page lists the plugin
  with its steps.

  # Settings lists every plugin that was added; the package and what the plugin ships are on its own page.
  Scenario: Settings lists the plugin, and its own page names its package and what it ships
    Given I am on "/settings"
     Then I should see "Payload"
     When I go to "/settings/plugin/payload"
     Then I should see "@webship.co/workspace-payload"
      And I should see "cmd-payload-project.sh"
      And I should see "payload-site-builder"

  Scenario: A sites folder offers the Payload builder
    Given I am on "/dev"
     Then "option[value='cmd-payload-project.sh']" should be attached

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents?q=payload-"
     Then I should see "payload-site-builder"
      And I should see "payload-tester"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=payload-scenarios"
     Then I should see "payload-scenarios"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=payload-test"
     Then I should see "payload-test"

  Scenario: The AI Prompts folder lists the prompts the plugin ships
    Given I am on "/ai-prompts?q=payload-"
     Then I should see "payload-build-and-test"
      And I should see "payload-scenarios-for-an-area"
