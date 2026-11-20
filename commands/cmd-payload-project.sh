#!/usr/bin/env bash

# workspace-name: Payload (create-payload-app, PostgreSQL)

# Installed by the Payload plugin (plugins.sh --install payload); __WORKSPACE__ is the workspace it was installed into.
#
# Build a Payload app in a container: an app made with the official installer (create-payload-app) from
# an official template (website, the default, or blank), on PostgreSQL, at https://<name>.ddev.site/admin.
# The accounts get roles (Administrator, Editor): the templates give them none. With --install the
# workspace account becomes its first account, an administrator; with --add-users it also gets the
# default accounts; with --sample-content the website template's own seed and the sample posts.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="payload";
distribution_title="Payload";
distribution_webroot="";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/payload/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/payload/args/arg-payload.sh || exit 1 ;

shift $#;

payload_build ;
