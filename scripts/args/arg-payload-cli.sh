#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The Payload project in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A Payload CLI command to run in the app, with its arguments. Example: --run "migrate:status"')
parser.add_argument('-m', '--migrate',
                    action='store_true',
                    default=False,
                    help='Make a migration of what changed in the configuration of the app, run it, and generate the types again.')
parser.add_argument('-b', '--build',
                    action='store_true',
                    default=False,
                    help='Build the app again for production, and restart the server.')
parser.add_argument('--restart',
                    action='store_true',
                    default=False,
                    help='Start the server again, and wait for it.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts. An account that is already there gets its name, password and roles back, and is unlocked.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default accounts (never the workspace account).')
ARGEOF
