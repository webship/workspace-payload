@edit-view
Feature: The editor writes a post
  Scenario: A post with a rich text, an image and a category, published
    Given there is no document "Skill test post" in "Posts"
    And I am a logged in user with the "editor" user
    When I create a new document in "Posts"
    And I set "Title" to "Skill test post"
    And I write "A paragraph of the post." in the rich text editor
    And I set "Hero Image" to "image-post1.webp"
    And I open the "Meta" tab
    And I set "Categories" to "News"
    Then the document should be saved automatically
    When I publish the document
    Then I should see the notification "Updated successfully."
    And the status of the document should be "Published"
