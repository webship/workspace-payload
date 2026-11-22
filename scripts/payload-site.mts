// The test site of the step pack: what the build adds to an app the official
// installer (create-payload-app, the website template) made. The build copies
// this file into the folder of the app as webship-site.mts and runs it with the
// Node.js of the web container, in that folder (.github/scripts/build-ddev-site.sh,
// and the Webship Workspace's Payload plugin):
//
//   node webship-site.mts config <url>                 the address of the site, the secrets the installer left
//                                                      as placeholders, and the roles of the accounts (below)
//   npx payload run webship-site.mts accounts add      the accounts (an account already there gets its name,
//                                                      password and roles back, and is unlocked)
//   npx payload run webship-site.mts accounts cancel | list | installed
//   npx payload run webship-site.mts seed              the template's own seed: what its dashboard's
//                                                      "Seed your database" makes (pages, posts, media,
//                                                      categories, the contact form, the header and footer)
//   npx payload run webship-site.mts sample            the sample content of the suite: twelve more posts
//
// The verbs after `config` work through the app's own Local API, so they need
// no running server: `payload run` loads the app's configuration and its
// database, in production (NODE_ENV=production: the schema comes from the
// migrations the build made, never from a schema push). The build runs them
// before the production build, so the pages the front end renders at build
// time already show the content.
//
// The accounts arrive on the standard input, as base64 of a JSON object
// ({ owner: {name, email, password}, accounts: [{handle, name, email,
// password, roles}] }), so no password is on a command line or in a file of
// the project. The owner is the first account (an administrator): the one the
// seed works as.
//
// What this adds to the template is marked "Webship test site" in each file it
// writes. No cloud account, no licence key, no paid service.

// TypeScript, with erasable syntax only, so nothing is built: Node.js runs `config` as it is (type
// stripping, from Node.js 22.18), and `payload run` loads the file with the app's own tsx. It is an
// .mts so the app's own type check (its tsconfig takes **/*.ts) leaves it alone. `npm run lint` of the
// plugin type-checks it (tsconfig.scripts.json, with types/payload-site-modules.d.ts for what it uses
// of the app's packages).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** An account as the functions of the plugin hand it over. */
interface Account {
  handle?: string;
  name?: string;
  email: string;
  password?: string;
  roles?: string[];
}

/** What arrives on the standard input, decoded. */
interface AccountsInput {
  owner: Account | null;
  accounts: Account[];
}

/** A document of the app, as the Local API answers it (depth 0). */
interface Doc {
  id: string | number;
  [field: string]: unknown;
}

interface AccountDoc extends Doc {
  email: string;
  name?: string;
  roles?: string[];
}

interface CategoryDoc extends Doc {
  title?: string;
}

interface FindResult<D extends Doc> {
  docs: D[];
}

/** The options of a Local API call, as far as this script sets them. */
interface CallOptions {
  collection?: string;
  context?: Record<string, unknown>;
  [option: string]: unknown;
}

type Write = (options: CallOptions) => Promise<unknown>;

/** What the script uses of the app's Local API (the object getPayload answers). */
interface Payload {
  find<D extends Doc = Doc>(options: CallOptions): Promise<FindResult<D>>;
  create: Write;
  update: Write;
  updateGlobal: Write;
  delete: Write;
  unlock: Write;
  destroy(): Promise<void>;
}

/** The template's own seed (src/endpoints/seed/index.ts of the app). */
interface TemplateSeed {
  seed(args: { payload: Payload; req: unknown }): Promise<void>;
}

/** A post of the sample content: its title, its category and its summary. */
type SamplePost = readonly [title: string, category: string, summary: string];

const APP: string = process.cwd();
const [verb, ...args] = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), 'utf8');
}

function write(rel: string, content: string): void {
  const file = path.join(APP, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ---------------------------------------------------------------------------
// config: the address, the secrets, the roles
// ---------------------------------------------------------------------------

/** The roles of the accounts, as a plugin of the app's own configuration. */
const ROLES_PLUGIN = `// Webship test site: the roles of the accounts.
//
// The website template's accounts have no roles: every account that logs in may
// do everything. This adds a "roles" field to the accounts (Administrator,
// Editor) and the access that reads it, as a plugin at the end of the
// configuration's plugins (so it sees the collections the other plugins add):
//
//   - the admin: an account with a role logs in to it; an account without one
//     (the template's seed makes its "Demo Author" so) is refused;
//   - the accounts: an administrator makes, changes and deletes every account;
//     an editor reads and changes its own account only, and never its roles;
//     the first account the app gets (its first-user screen) is an administrator;
//   - the redirects: the administrators' only;
//   - everything else (pages, posts, media, categories, forms, the header and
//     the footer) stays as the template has it: open to every account.
//
// Telemetry is off.
import type { Access, CollectionConfig, CollectionSlug, Config, FieldAccess, FieldHook, Plugin } from 'payload'

export const ROLES = ['administrator', 'editor'] as const

/** Whether an account has one of the roles. */
export const hasRole = (user: unknown, ...roles: string[]): boolean => {
  const own = (user as { roles?: unknown } | null | undefined)?.roles
  return Array.isArray(own) && own.some((role) => roles.includes(String(role)))
}

const administrators: Access = ({ req: { user } }) => hasRole(user, 'administrator')

const administratorsOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (hasRole(user, 'administrator')) return true
  return { id: { equals: user.id } }
}

const administratorsField: FieldAccess = ({ req: { user } }) => hasRole(user, 'administrator')

/** The first account of the app is an administrator, whoever makes it. */
const firstAccountIsAdministrator: FieldHook = async ({ collection, operation, req, value }) => {
  if (operation !== 'create' || !collection) return value
  const { totalDocs } = await req.payload.count({ collection: collection.slug as CollectionSlug, overrideAccess: true, req })
  const roles = Array.isArray(value) ? value : []
  return totalDocs === 0 && !roles.includes('administrator') ? [...roles, 'administrator'] : value
}

const withRoles = (accounts: CollectionConfig): CollectionConfig => ({
  ...accounts,
  access: {
    ...accounts.access,
    admin: ({ req: { user } }) => hasRole(user, ...ROLES),
    create: administrators,
    delete: administrators,
    read: administratorsOrSelf,
    unlock: administrators,
    update: administratorsOrSelf,
  },
  admin: {
    ...accounts.admin,
    defaultColumns: [...new Set([...(accounts.admin?.defaultColumns || ['email']), 'roles'])],
  },
  fields: [
    ...accounts.fields,
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      saveToJWT: true,
      options: [
        { label: 'Administrator', value: 'administrator' },
        { label: 'Editor', value: 'editor' },
      ],
      access: { create: administratorsField, update: administratorsField },
      hooks: { beforeChange: [firstAccountIsAdministrator] },
      admin: {
        description: 'An administrator also manages the accounts and the redirects; an editor manages the content.',
      },
    },
  ],
})

const administratorsOnly = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  access: { ...collection.access, create: administrators, delete: administrators, read: administrators, update: administrators },
})

export const webshipTestSite = (): Plugin => (config: Config): Config => {
  const accounts = config.admin?.user || 'users'
  return {
    ...config,
    telemetry: false,
    collections: (config.collections || []).map((collection) => {
      if (collection.slug === accounts) return withRoles(collection)
      if (collection.slug === 'redirects') return administratorsOnly(collection)
      return collection
    }),
  }
}

/** The configuration with the plugin above at the end of its plugins. */
export const withWebshipTestSite = (config: Config): Config => ({
  ...config,
  plugins: [...(config.plugins || []), webshipTestSite()],
})
`;

const PLACEHOLDER = /^(YOUR_[A-Z_]*HERE|)$/;

function config(url: string | undefined): void {
  if (!url || !/^https?:\/\/[^/]+$/.test(url)) fail('config needs the address of the site, with no path: config https://<name>.ddev.site');

  // .env: the address of the site (links, live preview, CORS), and a secret of
  // its own for the preview and the scheduled jobs where the installer left
  // its placeholder. The database and the app's secret are the installer's.
  const envFile = path.join(APP, '.env');
  if (!fs.existsSync(envFile)) fail('The app has no .env: run create-payload-app first.');
  let env = fs.readFileSync(envFile, 'utf8');
  const set = (name: string, value: string, onlyIfPlaceholder = false): void => {
    const line = new RegExp(`^${name}=(.*)$`, 'm');
    const found = env.match(line);
    if (found && onlyIfPlaceholder && !PLACEHOLDER.test((found[1] ?? '').trim())) return;
    if (found) env = env.replace(line, `${name}=${value}`);
    else env += `${env.endsWith('\n') ? '' : '\n'}${name}=${value}\n`;
  };
  set('NEXT_PUBLIC_SERVER_URL', url);
  set('PREVIEW_SECRET', crypto.randomBytes(24).toString('hex'), true);
  set('CRON_SECRET', crypto.randomBytes(24).toString('hex'), true);
  if (!/^PAYLOAD_SECRET=\S+/m.test(env)) set('PAYLOAD_SECRET', crypto.randomBytes(24).toString('hex'));
  if (!/^# Webship test site/m.test(env)) env = env.replace(/^(NEXT_PUBLIC_SERVER_URL=)/m, '# Webship test site: the address of the site.\n$1');
  fs.writeFileSync(envFile, env);

  // The roles: the plugin file, and the configuration wrapped with it.
  write('src/webship-test-site.ts', ROLES_PLUGIN);
  const configFile = ['src/payload.config.ts', 'payload.config.ts'].find((f) => fs.existsSync(path.join(APP, f)));
  if (!configFile) fail('No payload.config.ts in the app.');
  let source = read(configFile);
  if (!source.includes('withWebshipTestSite(')) {
    const start = source.indexOf('export default buildConfig({');
    const end = source.lastIndexOf('})');
    if (start < 0 || end < start || source.slice(end + 2).trim() !== '') {
      fail(`${configFile} does not end with \`export default buildConfig({ ... })\`: the roles cannot be added to it.`);
    }
    const from = configFile.startsWith('src/') ? './webship-test-site' : './src/webship-test-site';
    source = source.slice(0, end) + '}))' + source.slice(end + 2);
    source = source.replace('export default buildConfig({', 'export default buildConfig(withWebshipTestSite({');
    const imports = [...source.matchAll(/^import [^\n]*\n/gm)];
    const last = imports[imports.length - 1];
    const line = `// Webship test site: the roles of the accounts (src/webship-test-site.ts).\nimport { withWebshipTestSite } from '${from}'\n`;
    source = last ? source.slice(0, last.index + last[0].length) + line + source.slice(last.index + last[0].length) : line + source;
    write(configFile, source);
  }
  console.log(`The app answers at ${url}; the accounts have roles (src/webship-test-site.ts).`);
}

// ---------------------------------------------------------------------------
// The app's Local API (payload run)
// ---------------------------------------------------------------------------

async function app(): Promise<Payload> {
  if (!process.env.PAYLOAD_SECRET && !fs.existsSync(path.join(APP, '.env'))) fail('Run this in the folder of the app.');
  const { getPayload } = await import('payload');
  const config = (await import('@payload-config')).default;
  const payload = await getPayload({ config }) as Payload;
  // Outside the server the front end's cache cannot be told about a change (the
  // template's hooks would fail): every write of these verbs says so, as the
  // template's own seed does for its posts. The production build that follows
  // renders the pages afresh.
  for (const method of ['create', 'update', 'updateGlobal', 'delete'] as const) {
    const original: Write = payload[method].bind(payload);
    payload[method] = (options) => original({ ...options, context: { disableRevalidate: true, ...(options && options.context) } });
  }
  return payload;
}

async function standardInput(): Promise<string> {
  if (process.stdin.isTTY) return '';
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  return text.trim();
}

async function accountsPayload(): Promise<AccountsInput> {
  const raw = (await standardInput()) || process.env.PAYLOAD_SITE_ACCOUNTS || '';
  if (!raw) return { owner: null, accounts: [] };
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as AccountsInput;
  } catch {
    fail('The accounts on the standard input are not base64 of a JSON object.');
  }
}

const ACCOUNTS = (): string => 'users';

async function findAccount(payload: Payload, email: string): Promise<AccountDoc | null> {
  const found = await payload.find<AccountDoc>({ collection: ACCOUNTS(), where: { email: { equals: String(email).toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true });
  return found.docs[0] || null;
}

/** Make an account, or give an account that is there its name, password and roles back, and unlock it. */
async function putAccount(payload: Payload, account: Account): Promise<string> {
  const data = { name: account.name, email: account.email, password: account.password, roles: account.roles || [] };
  const existing = await findAccount(payload, account.email);
  if (existing) {
    await payload.update({ collection: ACCOUNTS(), id: existing.id, data, overrideAccess: true, depth: 0 });
    await payload.unlock({ collection: ACCOUNTS(), data: { email: account.email }, overrideAccess: true }).catch(() => {});
    return `kept ${account.email} (${data.roles.join(', ') || 'no role'})`;
  }
  await payload.create({ collection: ACCOUNTS(), data, overrideAccess: true, depth: 0 });
  return `made ${account.email} (${data.roles.join(', ') || 'no role'})`;
}

async function accounts(payload: Payload, action: string | undefined): Promise<void> {
  const { owner, accounts: list } = await accountsPayload();
  switch (action) {
    case 'add': {
      // The owner first: on an app with no account yet it becomes the first one, an administrator.
      if (owner && owner.email) console.log(`  ${await putAccount(payload, { ...owner, roles: ['administrator'] })}`);
      for (const account of list || []) {
        if (owner && account.email === owner.email) continue;
        console.log(`  ${await putAccount(payload, account)}`);
      }
      return;
    }
    case 'cancel': {
      for (const account of list || []) {
        if (owner && account.email === owner.email) continue;
        const existing = await findAccount(payload, account.email);
        if (!existing) { console.log(`  no ${account.email}`); continue; }
        await payload.delete({ collection: ACCOUNTS(), id: existing.id, overrideAccess: true });
        console.log(`  deleted ${account.email}`);
      }
      return;
    }
    case 'list': {
      const found = await payload.find<AccountDoc>({ collection: ACCOUNTS(), limit: 100, depth: 0, sort: 'email', overrideAccess: true });
      for (const doc of found.docs) console.log(`   ${doc.email}  ${doc.name || ''}  ${(doc.roles || []).join(', ') || 'no role'}`);
      if (!found.docs.length) console.log('   (none: the admin asks for its first account)');
      return;
    }
    case 'installed': {
      // Says so on its output too: `payload run` ends with 0 whatever a script sets, so the exit status is
      // the one of process.exit (after the database is let go).
      const found = await payload.find<AccountDoc>({ collection: ACCOUNTS(), where: { roles: { contains: 'administrator' } }, limit: 1, depth: 0, overrideAccess: true });
      console.log(`installed: ${found.docs.length ? 'yes' : 'no'}`);
      await payload.destroy().catch(() => {});
      process.exit(found.docs.length ? 0 : 1);
    }
    default:
      fail(`accounts takes add, cancel, list or installed, not ${action || 'nothing'}.`);
  }
}

/** The first administrator of the app: the account the seed and the sample content are made as. */
async function administrator(payload: Payload): Promise<AccountDoc> {
  const found = await payload.find<AccountDoc>({ collection: ACCOUNTS(), where: { roles: { contains: 'administrator' } }, sort: 'createdAt', limit: 1, depth: 0, overrideAccess: true });
  const first = found.docs[0];
  if (!first) fail('The app has no administrator yet: add the accounts first (accounts add).');
  return first;
}

/** The template's own seed, as its dashboard's "Seed your database" runs it. */
async function seed(payload: Payload): Promise<void> {
  const file = path.join(APP, 'src/endpoints/seed/index.ts');
  if (!fs.existsSync(file)) fail('This app has no seed of its own (src/endpoints/seed): the website template has one.');
  const { createLocalReq } = await import('payload');
  const user = await administrator(payload);
  const req = await createLocalReq({ user }, payload);
  const { seed: templateSeed } = await import(file) as TemplateSeed;
  await templateSeed({ payload, req });
  console.log('  the template\'s seed: the home and contact pages, the contact form, 3 posts, 6 categories, 4 images, the header and footer links');
}

/** A rich-text value of one paragraph per line. */
function richText(...lines: string[]): object {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
      children: lines.map((text) => ({
        type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '',
        children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
      })),
    },
  };
}

/**
 * The sample content of the suite: twelve published posts and two drafts, so
 * the posts' list in the admin has two pages of ten and the front end's posts
 * list two pages of twelve. Each is made again when it is there already.
 */
const SAMPLE_POSTS: readonly SamplePost[] = [
  ['Morning light over the harbour', 'News', 'A slow walk along the water before the town wakes up.'],
  ['A field guide to city gardens', 'Design', 'Small green corners, and the people who keep them.'],
  ['Notes from a quiet river', 'News', 'What a week beside the water teaches about patience.'],
  ['Building a garden shed by hand', 'Engineering', 'Timber, a saw and a free weekend.'],
  ['The market on a rainy Saturday', 'Finance', 'Prices, umbrellas and the best apples in town.'],
  ['Seven bridges in one afternoon', 'Engineering', 'A route through the old town, bridge by bridge.'],
  ['How the old mill was saved', 'Technology', 'A village, a grant and a wheel that turns again.'],
  ['Lanterns along the river path', 'Design', 'The autumn festival, from the first lantern to the last.'],
  ['A short history of the town clock', 'Technology', 'Two hundred years of keeping the town on time.'],
  ['Recipes from the harbour kitchen', 'Software', 'Fish soup, bread and a cake that travels well.'],
  ['The long walk to the lighthouse', 'News', 'Eleven kilometres of coast and one tall white tower.'],
  ['Counting birds on the marsh', 'Software', 'A morning with the volunteers and their notebooks.'],
];
const SAMPLE_DRAFTS: readonly SamplePost[] = [
  ['A draft about the winter fair', 'News', 'Stalls, music and the first snow of the year.'],
  ['A draft about the new library', 'Design', 'Shelves, light and a room for every age.'],
];

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function sample(payload: Payload): Promise<void> {
  const user = await administrator(payload);
  const categories = await payload.find<CategoryDoc>({ collection: 'categories', limit: 100, depth: 0, overrideAccess: true });
  const category = (title: string): Doc['id'] | undefined => categories.docs.find((c) => c.title === title)?.id;
  const put = async ([title, categoryTitle, summary]: SamplePost, status: 'published' | 'draft', day: number): Promise<void> => {
    const slug = slugOf(title);
    const data = {
      title,
      slug,
      content: richText(summary, `${title} is a sample post of the Webship test site.`),
      categories: [category(categoryTitle)].filter(Boolean),
      authors: [user.id],
      meta: { title, description: summary },
      publishedAt: new Date(Date.UTC(2026, 0, day, 9, 0, 0)).toISOString(),
      _status: status,
    };
    const existing = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true });
    const old = existing.docs[0];
    if (old) await payload.delete({ collection: 'posts', id: old.id, overrideAccess: true });
    await payload.create({ collection: 'posts', data, depth: 0, draft: status === 'draft', overrideAccess: true, user });
  };
  let day = 1;
  for (const post of SAMPLE_POSTS) await put(post, 'published', day++);
  for (const post of SAMPLE_DRAFTS) await put(post, 'draft', day++);
  console.log(`  the sample content: ${SAMPLE_POSTS.length} published posts and ${SAMPLE_DRAFTS.length} drafts`);
}

// ---------------------------------------------------------------------------

if (verb === 'config') {
  config(args[0]);
} else if (verb === 'accounts' || verb === 'seed' || verb === 'sample') {
  const payload = await app();
  try {
    if (verb === 'accounts') await accounts(payload, args[0]);
    if (verb === 'seed') await seed(payload);
    if (verb === 'sample') await sample(payload);
  } finally {
    await payload.destroy().catch(() => {});
  }
} else {
  fail('Verbs: config <url> | accounts add|cancel|list|installed | seed | sample (see the head of this file).');
}
