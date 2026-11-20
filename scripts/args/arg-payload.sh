#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Give the app its first account, an administrator: the workspace account.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts (administrator, editor): the ones the test scenarios log in as.')
parser.add_argument('-s', '--sample-content',
                    action='store_true',
                    default=False,
                    help='With --install and the website template: its own seed (the home and contact pages, the contact form, 3 posts, 6 categories, 4 images, the header and footer links) and 12 more posts and 2 drafts.')
parser.add_argument('-t', '--template',
                    default="website",
                    help='The official template the app is made from: website (pages, posts, media, categories, forms, search, redirects, SEO, live preview, drafts) or blank (accounts and media). Example: --template blank')
parser.add_argument('-v', '--payload-version',
                    default="",
                    help='A release (3.94.0), a major release (3); empty means latest. The release of the installer, create-payload-app, and of the template the build runs. Example: --payload-version 3.94.0')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the admin in a browser when it is ready.')
ARGEOF
