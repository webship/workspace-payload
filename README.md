# @webship.co/workspace-payload

Payload for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder that
makes a real Payload app in a container (made with the official installer, `create-payload-app`, from
the official website template or the blank one, on PostgreSQL, with roles for its accounts and the
website template's own seed on request), a Payload CLI tool for the apps it built, the default
accounts, the [Payload step pack](https://github.com/webship/payload-steps) wired into the workspace's
testing setup, and its AI items — two agents, a skill, a command and two prompts — each listed in the
workspace folder of its kind.

The workspace is container-based (DDEV by default): a Payload app is a row like any other, so the row
menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged, but
for its accounts: a Payload app's row has no Users menu, and the test users items of its Tests menu
are not for it. See [The default accounts](#the-default-accounts).

It is made from the reference platform plugin, `@webship.co/workspace-wordpress`, and runs its apps
the way the Next.js and Strapi plugins run theirs: a generic project, Node.js in the web image, the
server as a daemon.

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require @webship.co/workspace-payload --with-needs   # npm install into the dashboard
bash core/scripts/plugins.sh --activate payload --with-needs                         # plugins.payload in settings.yml
bash core/scripts/plugins.sh --install payload                                       # commands, functions, args, AI items
bash core/scripts/plugins.sh --configure payload                                     # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-payload-project.sh`, `cmd-tools-payload-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `payload-site-builder`, `payload-tester` | `ai-agents/` |
| The skill `payload-scenarios` | `ai-skills/` |
| The command `/payload-test` | `ai-commands/` |
| The prompts `payload-build-and-test`, `payload-scenarios-for-an-area` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder and the tool: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompts are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate payload --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install payload
```

Everything the builder runs for an app runs in the app's own container, through the container tool the workspace already needs: Node.js, npm, the installer and the Payload CLI are the web container's. The plugin asks for no command of its own on the machine.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-payload-project.sh` | The builder, in the Build list as **Payload (create-payload-app, PostgreSQL)**, installed into every sites folder |
| `commands/cmd-tools-payload-cli.sh` | The Payload CLI for one app: what the app is, a command, a migration, a new build, a restart, the default accounts |
| `scripts/functions/fun-payload.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_payload_users`, `add_payload_users`, `cancel_payload_users`, `testing_configure_payload`) |
| `scripts/args/arg-payload.sh`, `arg-payload-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `scripts/payload-site.mts` | Run in the project's container with the app's Node.js (through the Payload CLI's `payload run` for the verbs that need the database): the address of the app, the roles of the accounts, the accounts, the website template's own seed and the sample posts (the same script the step pack's test site is built with) |
| `testing/site.feature` | The first feature a Payload app gets when testing is set up |
| `ai/agents/payload-site-builder.md` | The agent that builds and maintains Payload apps with these commands |
| `ai/agents/payload-tester.md` | The agent that writes and runs scenarios with the Payload step pack |
| `ai/skills/payload-scenarios/` | The skill: the step pack's phrases by area, the traps found on a real app, three example features |
| `ai/commands/payload-test.md` | The slash command `/payload-test <site>`: set up, match every step, run, report |
| `ai/prompts/payload-build-and-test.md`, `payload-scenarios-for-an-area.md` | Two prompts: whole launch commands for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about Payload here |
| `features/payload.feature` | Scenarios for the dashboard's own browser suite |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## What is different from a PHP platform

Payload is a Node.js app (a Next.js app with its admin) and DDEV has no project type for it. The
plugin keeps the shape of the reference and changes only this:

| | WordPress (the reference) | Payload |
| --- | --- | --- |
| Project | `--project-type=wordpress`, nginx and PHP | `--project-type=generic --webserver-type=generic`: no web server of the container tool's own; the router sends the project's address to the app's port (3000), and the web container runs the server as a daemon, in production (`.ddev/config.payload.yaml`) |
| Recognised by | The DDEV project type | The file `.ddev/config.payload.yaml` |
| The language | PHP, in the web image | Node.js 24 (the workspace's line, which Payload supports), baked into the web image (`.ddev/web-build/Dockerfile.payload`) |
| Database | The container tool's default, settings written by the tool | PostgreSQL 17 from the container tool; the installer writes the container's own `db` / `db` / `db` into `app/.env` |
| Getting the code | `wp core download` | `npx create-payload-app@<release> --template website --branch v<release> --db postgres`: the official installer and the template of its release, npm, no coding-agent skill, no git repository |
| Install | `wp core install` | The schema from a migration (`payload migrate:create`, `payload migrate`); with `--install` the workspace account is the app's first account, an administrator; `next build` for production |
| Accounts | WP-CLI | `scripts/payload-site.mts`, through the app's Local API (`payload run`) |
| Users menu of the row | Reads the project type | None (the type is `generic`; the Tests menu's test users items hand it the Webship list): the Payload CLI tool's `--add-users`, or `cmd-tools-add-users.sh <name> payload` |

No cloud account, no paid service and no licence key: the installer runs with no coding-agent skill
and no git repository, and nothing of the vendor's hosting is used. Telemetry is off (`telemetry: false`
in the app, `NEXT_TELEMETRY_DISABLED=1` in the container).

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build an app

```bash
cd ~/workspace/dev
bash cmd-payload-project.sh mysite --install --add-users --sample-content
```

| Flag | What it does |
| --- | --- |
| `--install` | Give the app its first account, an administrator: the workspace account (its password must have 8 characters or more) |
| `--add-users` | With `--install`: add the default accounts |
| `--sample-content` | With `--install` and the website template: the template's own seed (what its dashboard's "Seed your database" makes: the home and contact pages, the contact form, 3 posts, 6 categories, 4 images, the header and footer links, the posts' author) and 12 more posts and 2 drafts |
| `--template <name>` | `website` (the default: pages, posts, media, categories, forms, search, redirects, SEO, live preview, drafts) or `blank` (accounts and media) |
| `--payload-version <x>` | The release of the installer and of the template: a release (`3.94.0`), a major release (`3`) or `latest`, the default |
| `--launch` | Open the admin when it is ready |

The app answers at `https://mysite.ddev.site`, its admin at `/admin`. It is what `create-payload-app`
makes, in the project's `app/` folder; what the builder adds is marked "Webship test site" in each
file it writes: the address of the app and a secret of its own for the preview in `app/.env`, and the
roles of the accounts in `app/src/webship-test-site.ts`, wrapped around the configuration in
`app/src/payload.config.ts`:

- a `roles` field on the accounts: Administrator or Editor; only an administrator changes it, and the
  first account of the app is an administrator. The templates give their accounts no roles;
- an account with a role may use the admin, an account without one is refused (the website template's
  seed makes the author of its posts so);
- an administrator makes, changes and deletes every account; an editor reads and changes its own only;
- the redirects are the administrators'; everything else stays as the template has it.

The schema of the database comes from a migration (`app/src/migrations`), the server is `next start`
in production. A project of the same name is deleted first. The first build takes a few minutes (the
installer's packages, the migration, the production build).

### Work on an app

```bash
bash cmd-tools-payload-cli.sh mysite                                  # version, server, migrations, accounts
bash cmd-tools-payload-cli.sh mysite --run "migrate:status"           # any Payload CLI command
bash cmd-tools-payload-cli.sh mysite --run "generate:types"
bash cmd-tools-payload-cli.sh mysite --migrate                        # a migration of a change of app/src, run
bash cmd-tools-payload-cli.sh mysite --build                          # build again for production, restart
bash cmd-tools-payload-cli.sh mysite --restart                        # start the server again and wait for it
bash cmd-tools-payload-cli.sh mysite --add-users                      # the default accounts
bash cmd-tools-payload-cli.sh mysite --cancel-users                   # delete them
```

A change of a collection or a field in `app/src` is `--migrate`, then `--build`. With nothing changed,
`--migrate` says so and makes no migration.

On a start or a restart the container tool may print "Unable to start web_extra_daemons" with
"supervisor.sock no such file": it asked before the web container was ready, and the container starts
the server by itself a moment later. `--restart` starts it again and waits until it answers.

npm 11 (the npm of Node.js 24) does not run the install scripts of packages it was not told to trust;
the installer's packages build and run without them (sharp brings its prebuilt binary).

### The default accounts

| Account | Address | Role | Handle in the tests |
| --- | --- | --- | --- |
| `administrator` | `administrator@example.com` | Administrator: every collection, the accounts and the redirects | `administrator` |
| `editor` | `editor@example.com` | Editor: the content, its own account, no redirects | `editor` |

The admin logs in with the email address. Each account has the password of the workspace's other
default lists. They are for local apps and for tests; the app's first account from `--install` is the
workspace account and is never written into a test.

**Manage them with the Payload CLI tool, not the dashboard's menus.** The dashboard picks a project's
account list by its type, and a Payload app's type is `generic`: its row has no Users menu, and the
"Add the test users" and "Cancel the test users" items of its Tests menu hand it the list of the
Webship distribution, which starts by adding Drush to the project with Composer. Leave those two
items alone on a Payload app until the base asks the plugins which list a project takes
(webship/workspace#490). Use:

```bash
bash cmd-tools-payload-cli.sh mysite --add-users      # add them, or give them back their name, password and roles, unlocked
bash cmd-tools-payload-cli.sh mysite --cancel-users   # delete them
bash cmd-tools-add-users.sh mysite payload            # the core's tool: the same list
bash cmd-tools-cancel-users.sh mysite payload
```

The accounts are written through the app's Local API: the tools need no running server, and the
admin's lock (ten minutes after five wrong passwords) is lifted when they are added again.

### Test an app

```bash
bash cmd-tools-testing.sh mysite                 # webship-js, the step pack, the users registry, a first feature
bash cmd-tools-testing.sh mysite --run           # run the suite in the container
bash cmd-tools-testing.sh mysite --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For a Payload app it also adds
`@webship-js/payload-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the users registry (the handles above, by their email addresses, overridable
with `PAYLOAD_<HANDLE>_EMAIL` and `PAYLOAD_<HANDLE>_PASSWORD`, and the template seed's `demo-author`),
`adminPath` (`/admin`), `apiPath` (`/api`), `dataAdmin` (the handle the step pack makes and deletes its
test documents as) and the tags that keep the pack's assertions that must fail out of a normal run,
places `tests/features/site.feature` when the project has none, and makes sure the default accounts are
in the app. Run it again and it adds what is missing and keeps what you changed.

The suite runs in the project's container, where the network changes of the host (another container
starting) do not cut the browser's requests.

A scenario of your own reads like this one, from the step pack's phrases (the skill
`payload-scenarios` lists them by area); the documents it makes are deleted after it:

```gherkin
Feature: The editor writes a post
  Scenario: A post in a category
    Given there is no document "Readme test post" in "Posts"
    And I am a logged in user with the "editor" user
    When I create a new document in "Posts"
    And I set "Title" to "Readme test post"
    And I write "A paragraph of the post." in the rich text editor
    And I open the "Meta" tab
    And I set "Categories" to "News"
    Then the document should be saved automatically
    And the status of the document should be "Draft"
```

`tests/features/site.feature` passes on an app built with `--install --add-users`, from either
template. The features of the step pack, and the scenario above, pass on an app built with
`--install --add-users --sample-content` (the website template).

## The AI items

`ai/` in the package holds one folder per kind, the manifest's `ai` block names each item, and
`--install` places it in the workspace folder of that kind.

| Kind | Item | Use it to |
| --- | --- | --- |
| Agent | `payload-site-builder` | Build, migrate, rebuild, restart, maintain or remove a Payload app with the commands above, in containers only |
| Agent | `payload-tester` | Set the testing stack up, look at the admin in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |
| Skill | `payload-scenarios` | Write a scenario from phrases that exist: the pack's steps by area, the handles of the users registry, the test documents, the traps found on a real app, and three features that pass on an app with the sample content |
| Command | `/payload-test <site> [feature or @tag]` | Run the suite of an app from inside a session: set up when missing, match every step, run, report what failed and why |
| Prompt | `payload-build-and-test` | Start a session that builds an app, says what it is, sets the testing stack up and runs the first feature |
| Prompt | `payload-scenarios-for-an-area` | Start a session that writes and runs the scenarios of one area of the app |

After `--install` each is in its folder on the dashboard. **Install** there puts an agent, a skill
or a command into Claude Code (`~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands`), or
from the command line:

```bash
cd ~/workspace/ai-agents   && bash cmd-tools-ai-items.sh payload-tester --install
cd ~/workspace/ai-skills   && bash cmd-tools-ai-items.sh payload-scenarios --install
cd ~/workspace/ai-commands && bash cmd-tools-ai-items.sh payload-test --install
```

A prompt is not installed: it is the whole `claude …` launch command of a new session, and the
dashboard's **New screen** form lists it as a template. By hand, fill the placeholders in and run
the command of the file from the folder it names.

The items are written for any AI CLI, with Claude Code as the default shape: the frontmatter and
the file layout are Claude Code's, the body of each item is plain Markdown that names no tool or
feature of one CLI, a command says in words what its arguments are, and the text between the
triple quotes of a prompt can be given to another AI CLI as it is.

Every step phrase the items show is checked against the definitions of the step pack and of
webship-js (`tests/fixtures/step-definitions.txt`), and every command and flag against the
plugin's own.

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint    # tsc over src/ and tests/, and over the site script (tsconfig.scripts.json)
npm test        # the manifest, the commands, the AI items, the functions against a scaffolded project, the site script's config verb on an app folder
```

The plugin is TypeScript throughout. `scripts/payload-site.mts` is not compiled: the builder puts it into the
folder of the app as `webship-site.mts`, Node.js runs its `config` verb as it is (type stripping, from
Node.js 22.18, the lowest the Workspace accepts), and `payload run` loads it for the other verbs with the
app's own tsx. It is an ES module with erasable syntax only, and an `.mts` so the app's own type check
(`**/*.ts`) leaves it alone. `types/payload-site-modules.d.ts` says what it uses of the app's `payload`.

CI runs the same on Node.js 22 and 26, parses every shell script, and runs the plugin's
`features/payload.feature` against a dashboard with this plugin installed
(`webship/workspace/.github/workflows/plugin-browser-suite.yml`).
