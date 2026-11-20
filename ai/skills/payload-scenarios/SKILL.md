---
name: payload-scenarios
description: Write webship-js scenarios for a Payload app of the Webship Workspace (its admin and the website template's front end) from phrases that exist — the Payload step pack's steps by area (the session and the refusals, a collection's list and its selection, the edit view and its fields, tabs, blocks and arrays, drafts, autosave, versions, the live preview, uploads, the account page, the website), the handles of the users registry, the test documents a scenario makes and the steps delete, the traps found on a real app, and three features that pass on an app built with the sample content. Use when writing or fixing a scenario for a Payload admin or its website, choosing a step for an admin screen, or turning a manual check into a feature.
---

# payload-scenarios

Scenarios for an app built with the Payload plugin (`bash cmd-payload-project.sh <site> --install
--add-users --sample-content`) in a container-based workspace (DDEV by default), tested with webship-js
and `@webship-js/payload-steps` once `bash cmd-tools-testing.sh <site>` set the project up. Every phrase
below exists in the pack or in webship-js; a scenario names no platform.

## Accounts and test documents

- `Given I am a logged in user with the "editor" user`: `administrator` (every collection, the accounts
  and the redirects), `editor` (the content; its own account only, never its roles; no redirects). The
  admin logs in with the email address the registry gives. `Given I am not logged in` for a visitor.
  `demo-author` is the template seed's author of the posts, with no role: the admin refuses it.
- `Given there is no document "…" in "Posts"`: for a document the scenario makes itself; it is deleted now
  when a stopped run left it, and again after the scenario.
- `Given there is a document "…" in "Posts"` (a draft), `Given there is a published document "…" in "Posts"`,
  and `… with:` and a table of `field` and `value` (`categories`, `heroImage`, `content`, `slug`,
  `meta.description`, `status`): a test document made through the REST API as the data administrator,
  deleted after the scenario. Every document, file and form submission a scenario makes on screen is
  deleted after it too.
- `Then there should be a document "…" in "Posts"` (or `no document`): a check as the data administrator.

## Phrases by area

| Area | Steps |
| --- | --- |
| Session | `I log in as "editor" with the login form`, `I log in with the email "…" and the password "…"`, `the login should be refused with "The email or password provided is incorrect."`, `I log out`, `I should be logged in as "editor"`, `I should not be logged in`, `I should be on the admin login page`, `the admin should not ask for its first user`, `the admin should refuse this account` |
| Access | `the navigation should list "Users"`, `the navigation should not list "Redirects"`, `the dashboard should list "Posts"`, `I should not be allowed to open "/admin/collections/redirects"`, `I should not be able to create a document in "Users"`, `I go to my account`, `the "Roles" field should be read only` |
| List | `I am on the "Posts" list`, `the list should count 17 documents`, `the list should show "…"`, `the list should not show "…"`, `the list should show the documents:`, `the list should have 10 rows`, `the "…" row should show "…" in the "Slug" column`, `I search the list for "…"`, `I clear the search of the list`, `I sort the list by "Title" in descending order`, `the first row of the list should be "…"`, `I filter the list where "Status" "equals" "Draft"`, `the list should be filtered where "Status" "equals" "Draft"`, `I remove the filters of the list`, `I show the "Status" column`, `I hide the "Slug" column`, `the list should have the column "Status"`, `I go to page 2 of the list`, `the list should be on page 2`, `the list should have 2 pages`, `I show 25 documents per page`, `the list should be empty`, `I open "…" from the list`, `I create a new document from the list` |
| Selection | `I select "…" in the list`, `I select all documents on the page`, `the selection should read "2 selected"`, `I edit the selected documents, setting "Categories" to "News"`, `I save the edit of the selected documents as drafts`, `I publish the edit of the selected documents`, `I publish the selected documents`, `I unpublish the selected documents`, `I delete the selected documents` |
| Edit view | `I create a new document in "Posts"`, `I open the document "…" in "Posts"`, `I open the "Header" global`, `I set "Title" to "…"`, `I set these fields:`, `"Title" should be set to "…"`, `I open the "Meta" tab`, `I write "…" in the rich text editor`, `the rich text editor should contain "…"`, `the "Categories" field should hold "Design"`, `I remove "Design" from the "Categories" field`, `I unlock the slug`, `the "Title" field should show the error "…"`, `I save the document`, `I should see the notification "…"`, `I delete the document`, `I duplicate the document`, `I go to "Posts" in the navigation`, `the admin should ask to leave without saving`, `I leave without saving`, `I stay on the page` |
| Blocks and arrays | `I add the "Content" block to "Layout"`, `I add a row to "Nav Items"`, `"Layout" should have 2 rows`, `the rows of "Layout" should be "Content" and "Call to Action"`, `I move row 3 of "Layout" up`, `I remove row 2 of "Layout"`, `I duplicate row 1 of "Layout"`, `I expand row 1 of "Nav Items"`, `row 1 of "Nav Items" should be expanded`, `I collapse all rows of "Layout"`, `I set "Label" to "News" in row 3 of "Nav Items"`, `"Label" should be set to "News" in row 3 of "Nav Items"` |
| Drafts and versions | `the document should be saved automatically`, `the status of the document should be "Changed"`, `I publish the document`, `I unpublish the document`, `I revert the document to its published version`, `I should not be able to publish the document`, `I open the versions of the document`, `the document should have 3 versions`, `a version should be marked "Currently Published"`, `I open the version marked "Current Draft"`, `the version should change "Title" from "…" to "…"`, `I restore this version`, `I restore this version as a draft` |
| Live preview | `the preview link should open "/posts/…"`, `I open the live preview`, `the live preview should show "…"`, `I close the live preview` |
| Uploads | `I create a new document in "Media"`, `I choose the file "test-lighthouse.png" to upload`, `I set "Alt" to "…"`, `I save the document`, `the file details should show "320x200"`, `I set "Hero Image" to "image-post2.webp"` |
| Website | `Given I am on "/posts"` (webship-js), `the site navigation should list "Posts", "Contact" and "Search"`, `the page should show posts 1 to 12`, `the page should list the post "…"`, `I go to the next page of posts`, `the title of the post should be "…"`, `the author of the post should be "Demo Author"`, `I search the site for "…"`, `the search should find "…"`, `the search should find nothing`, `I fill in the form with:`, `I send the form`, `the form should confirm "…"`, `the "Email" field of the form should show "This field is required"`, `I should see the page for an address the site does not have` |

Text, links, buttons and the accessibility checks are webship-js's own steps (`I should see "…"`,
`I press "Change Password"`, `the page should have a main landmark`).

## Traps found on a real app

- Opening the form of a new post or page makes the document at once (autosave): name it right away and
  let the steps delete it after the scenario.
- A collection with autosave has no "Save" button: every change is saved as a draft by itself
  (`the document should be saved automatically`), and published with `I publish the document`. Media,
  the accounts and the globals have "Save" (`I save the document`).
- The admin keeps a list's sort, page size and columns per account: `Given I am on the "Posts" list`
  opens it with its defaults; the steps give them back after a scenario that changed them.
- A publication the site refuses (a post without a title) says so in a notification ("The following
  fields are invalid (2): Title Slug") and marks no field.
- A field in another tab shows once its tab is open (`I open the "Meta" tab`); a field in a row once the
  row is expanded (`I expand row 1 of "Layout"`, or the steps of a row expand it).
- The website's list of posts is rendered ahead and renewed at most every ten minutes: a post just
  published or deleted may count there later; a post's own page and the search show it at once.
- A refused login, an address an account may not open and a missing page make the browser log the
  refused request: tag those scenarios `@js-off`.

## Examples

Three features that pass on an app built with `--sample-content`: `examples/list.feature`,
`examples/edit-view.feature` and `examples/access.feature`. Copy one into `tests/features/` and run it
with `bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature`.

A scenario of the drafts and the versions, from the same phrases:

```gherkin
Feature: A published post changed and restored
  Scenario: The change compared with the published version, then the published version restored
    Given there is a published document "Skill version post" in "Posts"
    And I am a logged in user with the "editor" user
    When I open the document "Skill version post" in "Posts"
    And I set "Title" to "Skill version post, changed"
    Then the document should be saved automatically
    And the status of the document should be "Changed"
    When I open the versions of the document
    And I open the version marked "Current Draft"
    Then the version should change "Title" from "Skill version post" to "Skill version post, changed"
    When I open the versions of the document
    And I open the version marked "Currently Published"
    And I restore this version
    Then "Title" should be set to "Skill version post"
```

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Payload.** Start with `ch27-testing-spa.md` (an admin that changes pages without reloading,
  and its waits), `ch09-table-list-testing.md` (the lists, their rows and columns),
  `ch06-form-testing-recipes.md` (the forms and their fields) and `ch10-authentication-authorization.md`
  (logins, sessions and refusals).
