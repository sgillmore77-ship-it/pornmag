// Database passwords often contain characters (% # / @ : ?) that aren't valid
// inside a postgres:// link unless encoded. This rewrites a connection string
// with the user and password properly encoded, whatever the password holds.
// Usage: node scripts/normalize-db-url.mjs "<connection string>"  → prints it.
export function normalizeDbUrl(raw) {
  const s = raw.trim();
  const m = /^(postgres(?:ql)?:\/\/)(.*)@([^@]+)$/.exec(s);
  if (!m) return s; // no credentials, or not a postgres URL: leave it alone
  const [, scheme, userinfo, rest] = m;
  const i = userinfo.indexOf(":");
  const user = i === -1 ? userinfo : userinfo.slice(0, i);
  const pass = i === -1 ? "" : userinfo.slice(i + 1);
  const dec = (v) => {
    try {
      // Already-encoded values (e.g. %40) decode cleanly; raw ones are kept.
      return /%[0-9a-f]{2}/i.test(v) ? decodeURIComponent(v) : v;
    } catch {
      return v;
    }
  };
  const enc = (v) => encodeURIComponent(dec(v));
  return `${scheme}${enc(user)}${i === -1 ? "" : `:${enc(pass)}`}@${rest}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(normalizeDbUrl(process.argv[2] ?? ""));
}
