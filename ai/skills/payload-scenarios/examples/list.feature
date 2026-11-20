@list
Feature: The posts list
  Background:
    Given I am a logged in user with the "editor" user
    And I am on the "Posts" list

  Scenario: The list counts the posts and pages them
    Then the list should count 17 documents
    And the list should have 2 pages
    When I go to page 2 of the list
    Then the list should be on page 2

  Scenario: A search and a filter narrow the list
    When I search the list for "harbour"
    Then the list should count 2 documents
    When I clear the search of the list
    And I filter the list where "Status" "equals" "Draft"
    Then the list should count 2 documents
    And the list should show "A draft about the winter fair"

  Scenario: Posts published and deleted together
    Given there is a document "Skill bulk post one" in "Posts"
    And there is a document "Skill bulk post two" in "Posts"
    When I search the list for "Skill bulk post"
    And I select all documents on the page
    Then the selection should read "2 selected"
    When I publish the selected documents
    And I show the "Status" column
    Then the "Skill bulk post one" row should show "Published" in the "Status" column
    When I select all documents on the page
    And I delete the selected documents
    Then the list should be empty
