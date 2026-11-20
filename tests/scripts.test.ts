import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-payload.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/**
 * A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled.
 * A Payload project of this plugin has the builder's .ddev/config.payload.yaml.
 */
function project(kind: 'payload' | 'drupal') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-plugin-'));
  const dir = path.join(root, 'dev', 'site1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: site1\ntype: ${kind === 'payload' ? 'generic' : 'drupal11'}\n`);
  if (kind === 'payload') fs.writeFileSync(path.join(dir, '.ddev', 'config.payload.yaml'), 'web_extra_daemons: []\n');
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'site1', devDependencies: { 'webship-js': '^2.0.6' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'payload'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'payload', 'site.feature'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'payload-site.mjs'), path.join(scripts, 'plugins', 'payload', 'payload-site.mjs'));
  return { root, dir, scripts };
}

/**
 * Run bash with the plugin's functions sourced and `ddev` replaced by a recorder of its calls and of what it
 * reads on stdin: the first line whole (`stdin1:`), then the start of the rest (`stdin:`).
 */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; if [ ! -t 0 ] ; then IFS= read -r first ; echo "  stdin1: ${first}" >> "${DDEV_LOG:-/dev/null}" ; head -c 120 | sed "s/^/  stdin: /" >> "${DDEV_LOG:-/dev/null}" ; echo >> "${DDEV_LOG:-/dev/null}" ; fi ; return 0 ; }';
  return spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\n${script}`], { encoding: 'utf8', env: { ...process.env, ...env } });
}

/**
 * The accounts a recorded call of the site script carried: the base64 of their JSON object, on its standard
 * input, and never on its command line (a failed run prints that).
 */
function payloadOf(recorded: string, verb: string) {
  const lines = recorded.split('\n');
  const call = lines.findIndex((l) => l.startsWith('ddev exec -d /var/www/html/app') && l.includes(`payload run webship-site.mjs accounts ${verb}`));
  assert.ok(call >= 0, `a call of the site script's accounts ${verb}: ${recorded}`);
  assert.doesNotMatch(lines[call], /PAYLOAD_SITE_ACCOUNTS|dD\.123123ddd|Owner-pass/, 'no account on the command line');
  const m = (lines[call + 1] || '').match(/^  stdin1: ([A-Za-z0-9+/=]+)$/);
  assert.ok(m, `its input carries the accounts: ${lines[call + 1]}`);
  return JSON.parse(Buffer.from(m![1], 'base64').toString('utf8'));
}

test('the default accounts are an administrator and an editor, with example addresses and their roles', () => {
  const r = bash('set_payload_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; g="user_${u}_role" ; echo "${!n}|${!m}|${!p}|${!g}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'editor']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['administrator', 'editor']);
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.ok(password.length >= 8, 'a password the admin accepts');
  }
});

test('the accounts are written by the site script through the app\'s Local API, with the accounts on its input, never in a file', () => {
  const p = project('payload');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, account_name: 'owner1', account_mail: 'owner1@example.com', account_pass: 'Owner-pass-1' };
  const r = bash('set_payload_users ; add_payload_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const written = fs.readFileSync(log, 'utf8');
  assert.match(written, /^ddev exec cat > \/var\/www\/html\/app\/webship-site\.mjs$/m, 'the site script is put into the folder of the app');
  assert.match(written, /stdin1: \/\/ The test site of the step pack/, 'through the container, on its input');
  const call = written.split('\n').find((l) => l.includes('accounts add')) as string;
  assert.match(call, /^ddev exec -d \/var\/www\/html\/app NODE_ENV=production \.\/node_modules\/\.bin\/payload run webship-site\.mjs accounts add$/);
  const payload = payloadOf(written, 'add');
  assert.deepStrictEqual(payload.accounts.map((a: any) => [a.handle, a.email, a.roles]), [
    ['administrator', 'administrator@example.com', ['administrator']],
    ['editor', 'editor@example.com', ['editor']],
  ]);
  assert.deepStrictEqual(payload.accounts.map((a: any) => a.name), ['Administrator Webship', 'Editor Webship']);
  assert.strictEqual(payload.owner.email, 'owner1@example.com', 'the workspace account comes first: the first account of an app without one');
  assert.deepStrictEqual(fs.readdirSync(p.dir).filter((f) => !['.ddev', 'cucumber.js', 'package.json'].includes(f)), [], 'no file with a password is left in the project');
});

test('cancelling the accounts deletes the default ones through the site script', () => {
  const p = project('payload');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('set_payload_users ; cancel_payload_users', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, account_name: 'owner1', account_mail: 'owner1@example.com', account_pass: 'x' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const recorded = fs.readFileSync(log, 'utf8');
  assert.deepStrictEqual(payloadOf(recorded, 'cancel').accounts.map((a: any) => a.handle), ['administrator', 'editor']);
});

test('the builder refuses a version, a template or a combination of flags it cannot build, before it changes anything', () => {
  const p = project('payload');
  const log = path.join(p.root, 'ddev.log');
  const base = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', DDEV_LOG: log };
  const stub = 'trim_project_name() { :; } ; drop_database() { echo dropped ; } ;';
  const cases: Array<[string, RegExp]> = [
    ['PAYLOAD_VERSION="beta"', /--payload-version takes a release \(3\.94\.0\), a major release \(3\) or latest, not beta\. Nothing was changed\./],
    ['TEMPLATE="ecommerce"', /--template takes website or blank, not ecommerce\. Nothing was changed\./],
    ['ADD_USERS=yes ; INSTALL=no', /--add-users needs --install/],
    ['SAMPLE_CONTENT=yes ; INSTALL=yes ; TEMPLATE=blank', /--sample-content needs --template website and --install/],
    ['SAMPLE_CONTENT=yes ; INSTALL=no', /--sample-content needs --template website and --install/],
  ];
  for (const [vars, message] of cases) {
    const r = bash(`PROJECT_NAME=site1 ; ${vars} ; ${stub} payload_build`, base);
    assert.strictEqual(r.status, 1, vars);
    assert.match(r.stdout, message, vars);
    assert.doesNotMatch(r.stdout, /dropped/, `${vars}: nothing was deleted`);
  }
  assert.ok(!fs.existsSync(log), 'the container tool was never called');
});

test('the builder writes the container\'s files: the server in production as a daemon behind the router, telemetry off, Node.js in the image', () => {
  const p = project('payload');
  const r = bash(`payload_write_ddev_config ${p.dir} 24`);
  assert.strictEqual(r.status, 0, r.stderr);
  const config = fs.readFileSync(path.join(p.dir, '.ddev', 'config.payload.yaml'), 'utf8');
  assert.match(config, /container_port: 3000\n\s+http_port: 80\n\s+https_port: 443/);
  assert.match(config, /export NODE_ENV=production && exec \.\/node_modules\/\.bin\/next start -H 0\.0\.0\.0 -p 3000/);
  assert.match(config, /NEXT_TELEMETRY_DISABLED=1/);
  const docker = fs.readFileSync(path.join(p.dir, '.ddev', 'web-build', 'Dockerfile.payload'), 'utf8');
  assert.match(docker, /N_PREFIX=\/usr\/local n install 24/);
});

test('the testing hook adds the step pack, the users registry, the admin\'s settings, the tags and a first feature, once', () => {
  const p = project('payload');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_payload ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, account_name: 'owner1', account_mail: 'owner1@example.com', account_pass: 'x' });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/payload-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/payload-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /administrator: \{ email: process\.env\.PAYLOAD_ADMINISTRATOR_EMAIL \|\| 'administrator@example\.com', password: process\.env\.PAYLOAD_ADMINISTRATOR_PASSWORD \|\| '[^']+' \},/);
  assert.match(cucumber, /'demo-author': \{ email: process\.env\.PAYLOAD_DEMO_AUTHOR_EMAIL \|\| 'demo-author@example\.com'/);
  assert.match(cucumber, /dataAdmin: process\.env\.DATA_ADMIN \|\| 'administrator',/);
  assert.match(cucumber, /adminPath: process\.env\.ADMIN_PATH \|\| '\/admin',/);
  assert.match(cucumber, /apiPath: process\.env\.API_PATH \|\| '\/api',/);
  assert.match(cucumber, /tags: process\.env\.CUCUMBER_TAGS \|\| 'not @wip and not @must-fail',/);
  // Still a module node can load, with the registry where webship-js reads it.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require, Object.keys(c.worldParameters.users), c.tags, c.worldParameters.dataAdmin, c.worldParameters.users.editor.email]))`], { encoding: 'utf8', env: { ...process.env, CUCUMBER_TAGS: '' } });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, handles, tags, admin, email] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(handles, ['administrator', 'editor', 'demo-author']);
  assert.match(tags, /not @must-fail/);
  assert.strictEqual(admin, 'administrator');
  assert.strictEqual(email, 'editor@example.com');
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  assert.match(fs.readFileSync(log, 'utf8'), /accounts add$/m, 'an app with its first account gets the default accounts');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook keeps a step pack the project takes already (a tarball or a folder of tests/step-packs/)', () => {
  const p = project('payload');
  const pkgFile = path.join(p.dir, 'package.json');
  fs.writeFileSync(pkgFile, JSON.stringify({ name: 'site1', devDependencies: { 'webship-js': '^2.0.6', '@webship-js/payload-steps': 'file:tests/step-packs/payload-steps' } }, null, 2));
  const r = bash(`cd ${p.dir} && testing_configure_payload ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', account_name: 'owner1', account_mail: 'owner1@example.com', account_pass: 'x' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(JSON.parse(fs.readFileSync(pkgFile, 'utf8')).devDependencies['@webship-js/payload-steps'], 'file:tests/step-packs/payload-steps');
});

test('the testing hook leaves a project of another platform alone', () => {
  const p = project('drupal');
  const r = bash(`cd ${p.dir} && testing_configure_payload ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

test('the CLI tool refuses a project that is not a Payload app of the plugin', () => {
  const p = project('drupal');
  const r = bash('PROJECT_NAME=site1 ; RUN="migrate:status" ; trim_project_name() { :; } ; payload_cli_tool', { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /is not a Payload project of this plugin/);
});

test('the CLI tool runs a Payload CLI command in the folder of the app, in production', () => {
  const p = project('payload');
  const log = path.join(p.root, 'ddev.log');
  const fake = `ddev() { case "$*" in describe*) echo '{"raw":{"status":"running"}}' ;; *) echo "ddev $*" >> "${log}" ;; esac ; }`;
  const r = bash(`${fake}\nPROJECT_NAME=site1 ; RUN="migrate:status" ; trim_project_name() { :; } ; payload_cli_tool`, { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/var\/www\/html\/app NODE_ENV=production \.\/node_modules\/\.bin\/payload migrate:status$/m);
});

test('the first feature names no platform in a step, and no password', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /payload|next\.?js|react/i, s);
  assert.doesNotMatch(feature, /dD\.123123ddd/);
  assert.doesNotMatch(feature, /create-first-user|accounts add/i, 'a suite never creates an account');
});
