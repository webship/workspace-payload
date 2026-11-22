import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// The site script (scripts/payload-site.mts) run the way the builder runs its `config` verb: a copy in the
// folder of the app as webship-site.mts, `node webship-site.mts config <url>` there. Node.js runs the
// TypeScript file as it is. The other verbs need the app's Local API (`payload run`, a database).

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');

/** A folder of an app as create-payload-app's website template leaves it, as far as `config` reads it. */
function appFolder(): string {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-site-'));
  fs.writeFileSync(path.join(app, '.env'), [
    'DATABASE_URI=postgres://db:db@db:5432/db',
    'PAYLOAD_SECRET=the-installer-secret',
    'NEXT_PUBLIC_SERVER_URL=http://localhost:3000',
    'CRON_SECRET=YOUR_CRON_SECRET_HERE',
    'PREVIEW_SECRET=YOUR_SECRET_HERE',
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(app, 'src'));
  fs.writeFileSync(path.join(app, 'src', 'payload.config.ts'), [
    "import { postgresAdapter } from '@payloadcms/db-postgres'",
    "import { buildConfig } from 'payload'",
    '',
    'export default buildConfig({',
    '  collections: [],',
    '  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI || \'\' } }),',
    '})',
    '',
  ].join('\n'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'payload-site.mts'), path.join(app, 'webship-site.mts'));
  return app;
}

const run = (app: string, ...args: string[]) => spawnSync(process.execPath, ['webship-site.mts', ...args], { cwd: app, encoding: 'utf8' });

test('config gives the app its address, its own secrets where the installer left placeholders, and the roles', () => {
  const app = appFolder();
  const r = run(app, 'config', 'https://app1.ddev.site');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, 'The app answers at https://app1.ddev.site; the accounts have roles (src/webship-test-site.ts).\n');
  const env = fs.readFileSync(path.join(app, '.env'), 'utf8');
  assert.match(env, /^# Webship test site: the address of the site\.\nNEXT_PUBLIC_SERVER_URL=https:\/\/app1\.ddev\.site$/m);
  assert.match(env, /^PAYLOAD_SECRET=the-installer-secret$/m, 'the installer\'s secret is kept');
  assert.match(env, /^CRON_SECRET=[0-9a-f]{48}$/m);
  assert.match(env, /^PREVIEW_SECRET=[0-9a-f]{48}$/m);
  const plugin = fs.readFileSync(path.join(app, 'src', 'webship-test-site.ts'), 'utf8');
  assert.match(plugin, /^\/\/ Webship test site: the roles of the accounts\./);
  assert.match(plugin, /telemetry: false/);
  const config = fs.readFileSync(path.join(app, 'src', 'payload.config.ts'), 'utf8');
  assert.match(config, /^import \{ buildConfig \} from 'payload'\n\/\/ Webship test site: the roles of the accounts \(src\/webship-test-site\.ts\)\.\nimport \{ withWebshipTestSite \} from '\.\/webship-test-site'$/m);
  assert.match(config, /^export default buildConfig\(withWebshipTestSite\(\{$/m);
  assert.match(config, /^\}\)\)\n$/m);

  // Again: the same file, the secrets it made kept.
  const before = { env, config };
  const again = run(app, 'config', 'https://app1.ddev.site');
  assert.strictEqual(again.status, 0, again.stderr);
  assert.strictEqual(fs.readFileSync(path.join(app, '.env'), 'utf8'), before.env);
  assert.strictEqual(fs.readFileSync(path.join(app, 'src', 'payload.config.ts'), 'utf8'), before.config);
});

test('config refuses an address with a path, an app without .env, and a configuration it cannot wrap', () => {
  const withPath = run(appFolder(), 'config', 'https://app1.ddev.site/admin');
  assert.strictEqual(withPath.status, 1);
  assert.strictEqual(withPath.stderr.trim(), 'config needs the address of the site, with no path: config https://<name>.ddev.site');
  assert.strictEqual(run(appFolder(), 'config').status, 1, 'no address');

  const noEnv = appFolder();
  fs.rmSync(path.join(noEnv, '.env'));
  assert.strictEqual(run(noEnv, 'config', 'https://app1.ddev.site').stderr.trim(), 'The app has no .env: run create-payload-app first.');

  const other = appFolder();
  fs.appendFileSync(path.join(other, 'src', 'payload.config.ts'), 'export const more = 1\n');
  const r = run(other, 'config', 'https://app1.ddev.site');
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /^src\/payload\.config\.ts does not end with `export default buildConfig\(\{ \.\.\. \}\)`: the roles cannot be added to it\./);
});

test('the verbs that need the app stop at its Local API outside an app, and an unknown verb says the verbs', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-site-'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'payload-site.mts'), path.join(empty, 'webship-site.mts'));
  const outside = spawnSync(process.execPath, ['webship-site.mts', 'accounts', 'list'], { cwd: empty, encoding: 'utf8', env: { ...process.env, PAYLOAD_SECRET: '' } });
  assert.strictEqual(outside.status, 1);
  assert.strictEqual(outside.stderr.trim(), 'Run this in the folder of the app.');
  const unknown = run(appFolder(), 'migrate');
  assert.strictEqual(unknown.status, 1);
  assert.strictEqual(unknown.stderr.trim(), 'Verbs: config <url> | accounts add|cancel|list|installed | seed | sample (see the head of this file).');
});
