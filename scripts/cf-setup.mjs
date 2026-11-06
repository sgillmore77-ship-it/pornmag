// Creates (or finds) the Cloudflare resources the site needs and writes their
// ids into wrangler.jsonc. Safe to run on every deploy.
//
// Needs: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, HYPERDRIVE_DATABASE_URL
// (the Supabase *direct* connection string).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const dbUrl = process.env.HYPERDRIVE_DATABASE_URL;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, HYPERDRIVE_DATABASE_URL: dbUrl })) {
  if (!v) fail(`Missing ${k}. Add it under GitHub → Settings → Secrets and variables → Actions.`);
}

const NAMES = { cache: "pornmag-cache", media: "pornmag-media", d1: "pornmag-tag-cache", hyperdrive: "pornmag-db", worker: "pornmag" };

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  summary(`### Deploy stopped\n\n${msg}\n`);
  process.exit(1);
}
function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, status: res.status, json };
}
const why = (r) => (r.json.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${r.status}`;

// 0. The token works for this account.
{
  const r = await cf("GET", "/workers/scripts");
  if (r.status === 401 || r.status === 403 || r.json.errors?.some((e) => e.code === 10000)) {
    fail(`The Cloudflare API token can't access account ${account} (${why(r)}). Check the token's permissions and the account ID.`);
  }
}

// 1. A workers.dev subdomain exists (Cloudflare creates it the first time you open Workers & Pages).
const sub = await cf("GET", "/workers/subdomain");
const subdomain = sub.json.result?.subdomain;
if (!subdomain) fail("Your account has no workers.dev subdomain yet. In the Cloudflare dashboard open Workers & Pages once (it asks you to pick a subdomain), then re-run this deploy.");

// 2. R2 buckets.
for (const name of [NAMES.cache, NAMES.media]) {
  const list = await cf("GET", `/r2/buckets?name_contains=${name}`);
  if (!list.ok) {
    if (list.json.errors?.some((e) => e.code === 10042)) fail("R2 isn't switched on for this account. In the dashboard go to R2 Object Storage and click to enable it (the free allowance is plenty), then re-run.");
    fail(`Couldn't list R2 buckets: ${why(list)}. Does the token have "Workers R2 Storage: Edit"?`);
  }
  if (!(list.json.result?.buckets ?? []).some((b) => b.name === name)) {
    const r = await cf("POST", "/r2/buckets", { name });
    if (!r.ok) fail(`Couldn't create R2 bucket ${name}: ${why(r)}`);
    console.log(`Created R2 bucket ${name}`);
  } else console.log(`R2 bucket ${name} exists`);
}

// 3. D1 database for cache tags.
let d1 = (await cf("GET", `/d1/database?name=${NAMES.d1}`)).json.result?.find((d) => d.name === NAMES.d1);
if (!d1) {
  const r = await cf("POST", "/d1/database", { name: NAMES.d1 });
  if (!r.ok) fail(`Couldn't create D1 database: ${why(r)}. Does the token have "D1: Edit"?`);
  d1 = r.json.result;
  console.log(`Created D1 database ${NAMES.d1}`);
} else console.log(`D1 database ${NAMES.d1} exists`);

// 4. Hyperdrive (database connection pooling), kept in sync with the secret.
function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
let u;
try {
  u = new URL(dbUrl);
} catch {
  fail("HYPERDRIVE_DATABASE_URL isn't a valid postgres:// connection string.");
}
const origin = {
  scheme: "postgres",
  host: u.hostname,
  port: Number(u.port || 5432),
  database: decodeURIComponent(u.pathname.slice(1) || "postgres"),
  user: safeDecode(u.username),
  password: safeDecode(u.password),
};
if (!origin.password) fail("HYPERDRIVE_DATABASE_URL has no password in it. Copy the Supabase string again and replace [YOUR-PASSWORD] with your database password.");
const configs = await cf("GET", "/hyperdrive/configs");
if (!configs.ok) fail(`Couldn't list Hyperdrive configs: ${why(configs)}. Does the token have "Hyperdrive: Edit"?`);
let hd = configs.json.result?.find((c) => c.name === NAMES.hyperdrive);
const r = hd ? await cf("PUT", `/hyperdrive/configs/${hd.id}`, { name: NAMES.hyperdrive, origin }) : await cf("POST", "/hyperdrive/configs", { name: NAMES.hyperdrive, origin });
if (!r.ok) fail(`Couldn't ${hd ? "update" : "create"} Hyperdrive: ${why(r)}. Cloudflare tests the database connection here, so check the Supabase connection string and password.`);
hd = r.json.result;
console.log(`Hyperdrive ${NAMES.hyperdrive} ready`);

// 5. Write the ids into wrangler.jsonc for this build.
let w = readFileSync("wrangler.jsonc", "utf8");
w = w.replace("REPLACE_WITH_HYPERDRIVE_ID", hd.id).replace("REPLACE_WITH_D1_ID", d1.uuid);
writeFileSync("wrangler.jsonc", w);

const url = `https://${NAMES.worker}.${subdomain}.workers.dev`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
console.log(`Site URL: ${url}`);
