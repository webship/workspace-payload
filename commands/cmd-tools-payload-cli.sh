#!/usr/bin/env bash

# Installed by the Payload plugin (plugins.sh --install payload); __WORKSPACE__ is the workspace it was installed into.
#
# The Payload CLI of one Payload app of this workspace, with the app's Node.js, in its container: say what
# the app is, run a command (migrate:status, generate:types, ...), migrate the database after a change of
# the configuration, build the app again, restart the server, add or cancel the default accounts. Nothing
# here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="payload";

ARGPARSE_DESCRIPTION="Run the Payload CLI of a Payload app of __WORKSPACE__: status, a command, a migration, a build, a restart, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/payload/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/payload/args/arg-payload-cli.sh || exit 1 ;

shift $#;

payload_cli_tool ;
