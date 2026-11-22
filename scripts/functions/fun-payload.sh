#!/usr/bin/env bash

# Payload for the Webship Workspace: build an app, run the Payload CLI on it, add its default accounts,
# and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install payload` in core/scripts/plugins/payload/functions/, where bootstrap
# sources it after the core's own functions. Everything runs in the project's container (DDEV by
# default), never on the host: the web image gets the Node.js the app runs on, the app is made by the
# official installer (create-payload-app) from an official template (website or blank) in the project's
# app/ folder, the web container runs its server in production as a daemon (next start), the router
# serves it at the project's address, and PostgreSQL is the container tool's database. No cloud account,
# no licence key, no paid service; telemetry off.
#
# Payload is a Node.js app (a Next.js app) and DDEV has no project type for it, so a Payload project is
# recognised by a file (.ddev/config.payload.yaml, written by the builder), and four names are the ones
# the core's tools look for:
#   set_payload_users          the default accounts                   (cmd-tools-add-users.sh <project> payload)
#   add_payload_users          create them through the app's Local API (the same tool, and --add-users of the builder)
#   cancel_payload_users       delete them                            (cmd-tools-cancel-users.sh <project> payload)
#   testing_configure_payload  the step pack in the testing stack     (cmd-tools-testing.sh <project>)

# The step pack a Payload project is tested with, and the release line it is required at.
readonly PAYLOAD_STEPS_PACKAGE='@webship-js/payload-steps';
readonly PAYLOAD_STEPS_VERSION='^2.0.0';

# Where the app lives in the web container, and the port its server listens on.
readonly PAYLOAD_ROOT='/var/www/html';
readonly PAYLOAD_APP='/var/www/html/app';
readonly PAYLOAD_PORT='3000';

# The default accounts, the ones a scenario logs in as: an administrator (every collection, the accounts
# and the redirects) and an editor (the content). The website and blank templates give their accounts no
# roles: the builder adds a "roles" field (Administrator, Editor) and the access that reads it. Accounts
# are configuration, created once on the app; a test suite never creates or deletes one. The admin logs
# in with the email address. The first account the builder creates with --install is the workspace
# account, an administrator, and is not in this list.
function set_payload_users() {
  users=(administrator editor);
  local user ;
  for user in "${users[@]}" ; do
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
  done
  user_administrator_role='administrator' ;
  user_editor_role='editor' ;
}

# Is this folder a Payload project of this plugin? The builder leaves .ddev/config.payload.yaml in it.
function payload_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.payload.yaml" ] ;
}

# Go to the project a tool was asked about, or say why not.
function payload_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! payload_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not a Payload project of this plugin (it has no .ddev/config.payload.yaml)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# What the container tool is told about the app: the router sends the project's address to the app's
# port, the server runs in production as a daemon of the web container once the build has finished,
# telemetry is off, and Node.js is in the web image itself. The container tool installs the Node.js of
# the project when the container starts, after the daemons have started and within a short time limit:
# baked into the image, the Node.js the app was built with is there before anything starts.
function payload_write_ddev_config() {
  local project_path="$1" nodejs_version="$2";
  mkdir -p "${project_path}/.ddev/web-build" || return 1 ;
  cat > "${project_path}/.ddev/config.payload.yaml" <<YAMLEOF
# Payload in this project. Written by the Payload builder of the workspace; build again rather than
# editing by hand. The web container serves no files of its own: the router sends ports 80 and 443
# of the project's address to the app's server, which the web container runs as a daemon, in
# production, once the app is built (app/.ready).
web_extra_exposed_ports:
  - name: payload
    container_port: ${PAYLOAD_PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: payload
    command: "bash -c 'while [ ! -f ${PAYLOAD_APP}/.ready ]; do sleep 2; done; cd ${PAYLOAD_APP} && export NODE_ENV=production && exec ./node_modules/.bin/next start -H 0.0.0.0 -p ${PAYLOAD_PORT}'"
    directory: ${PAYLOAD_ROOT}
web_environment:
  - NEXT_TELEMETRY_DISABLED=1
YAMLEOF
  cat > "${project_path}/.ddev/web-build/Dockerfile.payload" <<DOCKEREOF
# Node.js ${nodejs_version} in the web image, so the app's server has it before the container's daemons
# start. Written by the Payload builder of the workspace.
RUN N_PREFIX=/usr/local n install ${nodejs_version} && node --version
DOCKEREOF
}

# The Payload CLI in the container, in the folder of the app, in production (the schema comes from the
# migrations, never from a push).
function payload_cli() {
  ddev exec -d "${PAYLOAD_APP}" "NODE_ENV=production ./node_modules/.bin/payload $*" < /dev/null ;
}

# The release of Payload the app has installed.
function payload_version() {
  ddev exec "node -p \"require('${PAYLOAD_APP}/node_modules/payload/package.json').version\"" < /dev/null 2>/dev/null | tr -d '\r' ;
}

# Wait until the app's server answers its admin on its own port.
function payload_wait() {
  local attempt code ;
  for attempt in $(seq 1 90) ; do
    code="$(ddev exec "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${PAYLOAD_PORT}/admin/login" < /dev/null 2>/dev/null | tr -d '\r')" ;
    [ "${code}" == '200' ] && return 0 ;
    sleep 2 ;
  done
  echo "The Payload server did not start; the end of its log:" ;
  ddev logs -s web --tail 60 < /dev/null 2>/dev/null ;
  return 1 ;
}

# Serve the build: the daemon stopped, the port free (next start finishes its requests before it lets
# the port go), the daemon started again, and wait for it.
function payload_restart() {
  ddev exec "touch ${PAYLOAD_APP}/.ready" < /dev/null ;
  ddev exec "supervisorctl stop webextradaemons:payload" < /dev/null > /dev/null 2>&1 ;
  ddev exec "for i in \$(seq 1 20); do fuser ${PAYLOAD_PORT}/tcp >/dev/null 2>&1 || exit 0; sleep 1; done; fuser -k -TERM ${PAYLOAD_PORT}/tcp >/dev/null 2>&1; sleep 2; fuser -k -KILL ${PAYLOAD_PORT}/tcp >/dev/null 2>&1; exit 0" < /dev/null ;
  ddev exec "supervisorctl start webextradaemons:payload" < /dev/null || return 1 ;
  payload_wait ;
}

# Build the app for production (next build), and serve the new build.
function payload_production_build() {
  echo "Building the app for production (next build)." ;
  ddev exec -d "${PAYLOAD_APP}" "NODE_ENV=production npm run build" < /dev/null || { echo "The build of the app failed." ; return 1 ; } ;
  payload_restart ;
}

# Put payload-site.mts into the folder of the app as webship-site.mts (the Payload CLI runs scripts of the
# app's own folder), through the container, so it works wherever the workspace runs.
function payload_place_site_script() {
  local script="${WORKSPACE_SCRIPTS}/plugins/payload/payload-site.mts" ;
  if [ ! -f "${script}" ] ; then
    echo "payload-site.mts is not in ${WORKSPACE_SCRIPTS}/plugins/payload: install the plugin (plugins.sh --install payload)." ;
    return 1 ;
  fi
  # An app of an older release of the plugin has the JavaScript copy: it goes.
  ddev exec "rm -f ${PAYLOAD_APP}/webship-site.mjs && cat > ${PAYLOAD_APP}/webship-site.mts" < "${script}" ;
}

# The accounts the site script verbs carry, as base64 of a JSON object: the owner (the workspace account)
# and the default accounts loaded by set_payload_users. It travels on the standard input of the script,
# so no password is written into a file of the project or onto a command line.
function payload_accounts_payload() {
  local rows="" user name mail password role ;
  for user in "${users[@]}" ; do
    name="user_${user}_name"; mail="user_${user}_mail"; password="user_${user}_password"; role="user_${user}_role";
    rows="${rows}${!name}"$'\x1f'"${!mail}"$'\x1f'"${!password}"$'\x1f'"${!role}"$'\x1e' ;
  done
  PAYLOAD_OWNER_NAME="${account_name}" PAYLOAD_OWNER_MAIL="${account_mail}" PAYLOAD_OWNER_PASS="${account_pass}" \
    PAYLOAD_ROWS="${rows}" python3 -c '
import base64, json, os
def account(row):
    handle, email, password, role = row.split("\x1f")
    return {"handle": handle, "name": handle.capitalize() + " Webship", "email": email, "password": password, "roles": [role]}
accounts = [account(row) for row in os.environ["PAYLOAD_ROWS"].split("\x1e") if row]
owner = {"handle": "owner", "name": os.environ["PAYLOAD_OWNER_NAME"], "email": os.environ["PAYLOAD_OWNER_MAIL"], "password": os.environ["PAYLOAD_OWNER_PASS"]}
print(base64.b64encode(json.dumps({"owner": owner, "accounts": accounts}).encode()).decode())' ;
}

# Run a verb of the site script through the app's Local API (payload run), in production; the accounts
# verbs get the accounts on the standard input.
function payload_site() {
  local verb="$1" ; shift ;
  if [ "${verb}" == 'accounts' ] ; then
    local payload ;
    payload="$(payload_accounts_payload)" || return 1 ;
    printf '%s' "${payload}" | ddev exec -d "${PAYLOAD_APP}" "NODE_ENV=production ./node_modules/.bin/payload run webship-site.mts accounts $*" ;
  else
    ddev exec -d "${PAYLOAD_APP}" "NODE_ENV=production ./node_modules/.bin/payload run webship-site.mts ${verb} $*" < /dev/null ;
  fi
}

# Build a Payload app from nothing: the container, the installer and its template, the address and the
# roles of the accounts, the schema from a migration; with --install its first account (the workspace
# account) and with --add-users the default accounts; with --sample-content the website template's own
# seed and the sample posts; the production build.
function payload_build() {
  trim_project_name ;
  local base_url="https://${PROJECT_NAME}.ddev.site" ;
  local wanted="${PAYLOAD_VERSION:-${site_payload_version:-latest}}" ;
  local template="${TEMPLATE:-website}" ;
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;

  if ! [[ "${wanted}" =~ ^(latest|[0-9]+(\.[0-9]+){0,2})$ ]] ; then
    echo "--payload-version takes a release (3.94.0), a major release (3) or latest, not ${wanted}. Nothing was changed." ;
    exit 1 ;
  fi
  if [[ ! "${template}" =~ ^(website|blank)$ ]] ; then
    echo "--template takes website or blank, not ${template}. Nothing was changed." ;
    exit 1 ;
  fi
  if [ "${ADD_USERS}" == 'yes' ] && [ "${INSTALL}" != 'yes' ] ; then
    echo "--add-users needs --install: the default accounts are added once the app has its first account, the workspace account." ;
    exit 1 ;
  fi
  if [ "${SAMPLE_CONTENT}" == 'yes' ] && { [ "${template}" != 'website' ] || [ "${INSTALL}" != 'yes' ] ; } ; then
    echo "--sample-content needs --template website and --install: it is the website template's own seed, made as the app's administrator." ;
    exit 1 ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server: no nginx and no PHP are started. The database is PostgreSQL.
  ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
    --database=postgres:17 --nodejs-version=$(ddev_nodejs_version) < /dev/null || exit 1 ;
  payload_write_ddev_config "${project_path}" "$(ddev_nodejs_version)" || exit 1 ;
  ddev_up start -y || exit 1 ;

  # The release: latest is read from the registry, so the template comes from the tag of the release the
  # installer installs.
  local version ;
  version="$(ddev exec "npm view create-payload-app@${wanted} version" < /dev/null 2>/dev/null | tr -d '\r' | tail -1)" ;
  if ! [[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ; then
    echo "No release ${wanted} of create-payload-app (the registry answered: ${version:-nothing})." ;
    exit 1 ;
  fi

  # The installer: the template of the release, npm, PostgreSQL of the container (db / db / db), no
  # coding-agent skill and no git repository. It takes a few minutes.
  echo "Making the app with create-payload-app@${version}, the ${template} template (a few minutes)." ;
  ddev exec "rm -rf ${PAYLOAD_APP} && cd ${PAYLOAD_ROOT} && npx -y create-payload-app@${version} --name app --template ${template} --branch v${version} --version ${version} --db postgres --db-connection-string postgres://db:db@db:5432/db --use-npm --no-agent --no-git" < /dev/null \
    || { echo "create-payload-app failed." ; exit 1 ; } ;

  # The address of the app, a secret of its own for the preview and the scheduled jobs, the roles of the
  # accounts; then the schema of the database from a migration.
  payload_place_site_script || exit 1 ;
  ddev exec -d "${PAYLOAD_APP}" "node webship-site.mts config ${base_url}" < /dev/null || exit 1 ;
  ddev exec -d "${PAYLOAD_APP}" "rm -rf src/migrations && NODE_ENV=production ./node_modules/.bin/payload migrate:create initial && NODE_ENV=production ./node_modules/.bin/payload migrate" < /dev/null \
    || { echo "The migration of the database failed." ; exit 1 ; } ;

  users=() ;
  if [ "${INSTALL}" == 'yes' ] ; then
    echo "Making the workspace account the app's first account, an administrator." ;
    [ "${ADD_USERS}" == 'yes' ] && set_payload_users ;
    payload_site accounts add || { echo "The accounts could not be made." ; exit 1 ; } ;
    users=() ;
    if [ "${SAMPLE_CONTENT}" == 'yes' ] ; then
      echo "Seeding the website template's own content, then the sample posts." ;
      payload_site seed || exit 1 ;
      payload_site sample || exit 1 ;
    fi
  fi
  payload_cli "generate:types" > /dev/null || echo "The types of the app could not be generated (the build goes on)." ;
  payload_production_build || exit 1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    echo "${doc_name} ${PROJECT_NAME} has been installed: Payload $(payload_version), the ${template} template.";
    echo "Go to ${base_url}/admin and log in as ${account_mail}";
  else
    echo "${doc_name} ${PROJECT_NAME} is ready, without an account: Payload $(payload_version), the ${template} template.";
    echo "Its admin asks for the first account at ${base_url}/admin (it becomes an administrator), or: bash cmd-tools-payload-cli.sh ${PROJECT_NAME} --add-users";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch /admin ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Create the default accounts through the app's Local API; the workspace account comes first (the app's
# first account when it has none). An account that is already there gets its name, password and roles
# back, and is unlocked. The list is loaded by the caller (set_payload_users): the core's add_users, the
# builder, the CLI tool.
function add_payload_users() {
  payload_enter_project || return 1 ;
  local user user_name user_mail user_password user_role ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo " ================================================================= ";
  done
  payload_place_site_script || return 1 ;
  payload_site accounts add ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# Delete the default accounts (never the workspace account).
function cancel_payload_users() {
  payload_enter_project || return 1 ;
  local user user_name ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo " ================================================================= ";
  done
  payload_place_site_script || return 1 ;
  payload_site accounts cancel ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# What cmd-tools-payload-cli.sh does: the first of --run, --migrate, --build, --restart, --add-users,
# --cancel-users that was asked for; with none of them, what the app is.
function payload_cli_tool() {
  trim_project_name ;
  payload_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y < /dev/null || exit 1 ;
  fi

  if [ ! "${RUN}" == '_none_' ] ; then
    # Unquoted on purpose: --run "migrate:status" is a command and its arguments.
    payload_cli ${RUN} ;
    exit $? ;
  fi

  if [ "${MIGRATE}" == 'yes' ] ; then
    # A migration of what changed in the app's configuration, applied, and the types of the app again.
    # --skip-empty: with nothing changed, migrate:create would ask whether to make a blank migration, and
    # a question no one can answer here stops it ("unsettled top-level await", status 13).
    local made_before made_after ;
    made_before="$(ls app/src/migrations 2>/dev/null | grep -c '\.json$')" ;
    echo "Making a migration of what changed in the configuration, and running it." ;
    payload_cli "migrate:create --skip-empty" || exit 1 ;
    made_after="$(ls app/src/migrations 2>/dev/null | grep -c '\.json$')" ;
    payload_cli "migrate" || exit 1 ;
    if [ "${made_after}" == "${made_before}" ] ; then
      echo "No collection or field changed since the last migration: no migration was made." ;
    else
      payload_cli "generate:types" > /dev/null ;
      echo "Build the app again to serve the change: bash cmd-tools-payload-cli.sh ${PROJECT_NAME} --build" ;
    fi
  elif [ "${BUILD}" == 'yes' ] ; then
    payload_production_build || exit 1 ;
    echo "Payload $(payload_version): the new build is served at https://${PROJECT_NAME}.ddev.site/admin" ;
  elif [ "${RESTART}" == 'yes' ] ; then
    payload_restart || exit 1 ;
    echo "Payload $(payload_version) is running." ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_payload_users ;
    add_payload_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_payload_users ;
    cancel_payload_users ;
  else
    echo "${doc_name}/${PROJECT_NAME}: Payload $(payload_version) at https://${PROJECT_NAME}.ddev.site/admin" ;
    echo "" ;
    if [ -f app/.ready ] && ddev exec "curl -fsS -o /dev/null http://127.0.0.1:${PAYLOAD_PORT}/admin/login" < /dev/null > /dev/null 2>&1 ; then
      echo "Server: running (next start, production)" ;
    else
      echo "Server: not answering; start it again with --restart (or build with --build)" ;
    fi
    echo "" ; echo "Migrations:" ;
    payload_cli "migrate:status" 2>/dev/null | grep -E "^\s*[│|]|Name|Batch|Ran" | sed 's/^/   /' ;
    echo "" ; echo "Accounts:" ;
    users=() ;
    payload_place_site_script > /dev/null 2>&1 ;
    payload_site accounts list 2>/dev/null | grep -v -E 'WARN|email adapter' ;
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of a Payload project. The core's testing_configure calls this in the
# project folder once webship-js is scaffolded and before the dependencies are installed; for a project
# that is not one of this plugin's it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's own,
# gives cucumber.js the tags that keep the pack's assertions that must fail out of a normal run, the paths
# of the admin and of the REST API, the handle the test-data steps work as (dataAdmin), and the users
# registry of the default accounts (a handle a scenario reads, mapped to an account; never the workspace
# account), and writes a first feature when the project has none of its own. Every part is skipped when
# it is already there, so a second run adds what the first missed and never resets a suite.
function testing_configure_payload() {
  local project_path="$1";
  payload_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Payload: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Payload step pack (${PAYLOAD_STEPS_PACKAGE} ${PAYLOAD_STEPS_VERSION}).";
  set_payload_users ;
  local registry="" user user_mail user_password ;
  for user in "${users[@]}" ; do
    user_mail="user_${user}_mail"; user_password="user_${user}_password";
    registry="${registry}${user}|${!user_mail}|${!user_password}"$'\n' ;
  done

  python3 - "${project_path}" "${PAYLOAD_STEPS_PACKAGE}" "${PAYLOAD_STEPS_VERSION}" 'PAYLOAD' "${registry}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry = sys.argv[1:6]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on (a pack the
# project already takes, from npm or from a folder of tests/step-packs/, is kept).
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=4) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, the tags of the pack's lane, and in
# worldParameters the admin's and the API's paths, the test-data account and the users registry.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if not re.search(r"^[ \t]*tags:", src, re.M):
    default = re.search(r"^([ \t]*)default:[ \t]*\{[ \t]*$", src, re.M)
    if default:
        pad = default.group(1) + '  '
        block = [
            pad + "// The pack's assertions that must fail are no part of a normal run.",
            pad + "tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',",
        ]
        src = src[:default.end()] + '\n' + '\n'.join(block) + src[default.end():]
        print('  cucumber.js: the tags that keep the assertions that must fail out of a normal run')

world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
if not world:
    sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
pad = world.group(1) + '  '
additions = []
if not re.search(r"^[ \t]*adminPath:", src, re.M):
    additions += [
        pad + "// Where the admin and the REST API are on the site ('/admin' and '/api', the app's defaults).",
        pad + "adminPath: process.env.ADMIN_PATH || '/admin',",
        pad + "apiPath: process.env.API_PATH || '/api',",
    ]
if not re.search(r"^[ \t]*dataAdmin:", src, re.M):
    additions += [
        pad + "// The account the test-data steps make and delete the test documents as: an administrator of `users`.",
        pad + "dataAdmin: process.env.DATA_ADMIN || 'administrator',",
    ]
if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    additions += [
        pad + "// The users registry: a handle a scenario reads, mapped to an account of this app (the default",
        pad + "// accounts: cmd-tools-payload-cli.sh --add-users). The admin logs in with the email address. Override",
        pad + "// one with %s_<HANDLE>_EMAIL and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
        pad + "users: {",
    ]
    for handle, email, password in rows:
        env = '%s_%s' % (prefix, handle.upper())
        additions.append(pad + "  %s: { email: process.env.%s_EMAIL || '%s', password: process.env.%s_PASSWORD || '%s' }," % (handle, env, email, env, password))
    additions += [
        pad + "  // The website template's seed (--sample-content) makes the author of its posts with the password",
        pad + "  // \"password\" and no role: the admin refuses it.",
        pad + "  'demo-author': { email: process.env.%s_DEMO_AUTHOR_EMAIL || 'demo-author@example.com', password: process.env.%s_DEMO_AUTHOR_PASSWORD || 'password' }," % (prefix, prefix),
        pad + "},",
    ]
    print('  cucumber.js: the users registry (%s, demo-author)' % ', '.join(r[0] for r in rows))
if additions:
    src = src[:world.end()] + '\n' + '\n'.join(additions) + src[world.end():]

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the app yet: the login page, each default account,
  # a refused login, and what the editor may not open.
  local feature="${WORKSPACE_SCRIPTS}/plugins/payload/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the app" ;
  fi

  # The scenarios log in as the default accounts: make sure an app that has its first account has them.
  if ( cd "${project_path}" && payload_place_site_script > /dev/null 2>&1 && users=() && payload_site accounts installed ) > /dev/null 2>&1 ; then
    if ( add_payload_users > /dev/null 2>&1 ) ; then
      echo "  the default accounts are in the app (${users[*]})" ;
    else
      echo "  The default accounts could not be written: is the app running (ddev start in ${project_path})?" ;
    fi
  else
    echo "  The app has no account yet: the scenarios that log in need an app built with --install." ;
  fi
}
