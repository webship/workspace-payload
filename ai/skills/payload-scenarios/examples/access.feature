@access
Feature: What the editor may do
  Scenario: The editor manages the content, not the accounts or the redirects
    Given I am a logged in user with the "editor" user
    Then the navigation should list "Posts"
    And the navigation should not list "Redirects"
    And I should not be able to create a document in "Users"

  @js-off
  Scenario: The editor may not open the redirects
    Given I am a logged in user with the "editor" user
    Then I should not be allowed to open "/admin/collections/redirects"
