Write and run the webship-js scenarios of one area of a Payload app (the posts list, the edit view, the versions, the website) from the step pack's own phrases.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Write the webship-js scenarios of the <area> of the Payload app <name>, and run them until they are green
# ~/workspace/<dev|test|sandboxes|demos> · https://<name>.ddev.site/admin · container-based (DDEV by default)
# the app: built with cmd-payload-project.sh <name> --install --add-users --sample-content
# the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

1. bash cmd-tools-testing.sh <name>
   (the testing stack, when it is missing)
2. Open each screen of the <area> in the Playwright MCP browser first, in a tab of your own, as the account
   a scenario will use (editor or administrator), and note the labels, headings and messages a person sees.
3. Write tests/features/<area>.feature with the phrases of the step pack (its README, or the skill
   payload-scenarios) and of webship-js only: no new step, no platform name in a phrase, no password,
   no account created; the documents a scenario needs come from "Given there is a document ... in ...".
4. bash cmd-tools-testing.sh <name> --dry-run --path tests/features/<area>.feature
5. bash cmd-tools-testing.sh <name> --run --path tests/features/<area>.feature
   A failure: look at the screen again in the browser before changing the scenario.

When it is green twice in a row: the scenarios, what each proves, and the run's counts.
"""
```
