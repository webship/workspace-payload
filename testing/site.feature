Feature: The admin answers and its accounts work
  As the owner of the app
  I want the admin's login, each default account and the refusals to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-payload-cli.sh --add-users); a scenario logs in by a
  # handle of the users registry in cucumber.js, so no password is written here. It passes on an app
  # built with --install --add-users, with or without --sample-content.

  @critical
  Scenario: The admin login page is served, and the first-user screen is gone
    Given I am not logged in
    Then I should be on the admin login page
    And the admin should not ask for its first user

  Scenario Outline: The <account> account logs in
    Given I am not logged in
    When I log in as "<account>" with the login form
    Then I should be logged in as "<account>"

    Examples:
      | account       |
      | administrator |
      | editor        |

  # The browser logs the refused login request (401): no error of the app.
  @js-off
  Scenario: A wrong password is refused
    Given I am not logged in
    When I log in with the email "nobody@example.com" and the password "Wrong-password-1"
    Then the login should be refused with "The email or password provided is incorrect."
    And I should not be logged in

  Scenario: The administrator manages the accounts and their roles
    Given I am a logged in user with the "administrator" user
    And I am on the "Users" list
    Then the "Editor Webship" row should show "Editor" in the "Roles" column
    And the "Administrator Webship" row should show "Administrator" in the "Roles" column

  Scenario: The editor manages the content and its own account only
    Given I am a logged in user with the "editor" user
    Then the navigation should list "Media"
    And I should not be able to create a document in "Users"
    When I go to my account
    Then the "Roles" field should be read only
