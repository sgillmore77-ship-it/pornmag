/**
 * Country blocking, applied by the Worker before any page (or cached page)
 * is served. Visitors from a blocked country see a short notice instead of
 * the site, except on the pages staff need to sign in and work. Signed-in
 * staff get a signed "pass" cookie (see /api/geo-pass) that lets them view
 * the whole site from a blocked country.
 *
 * No Next.js imports here: worker.ts uses this file directly.
 */

export const PASS_COOKIE = "geo_pass";
const PASS_DAYS = 30;

/** Paths blocked visitors can still reach: sign-in, admin, and the site's own plumbing. */
const OPEN_PATHS = /^\/(admin|login|forgot-password|reset-password|account|api|_next|fonts|media|favicon\.ico|robots\.txt|ads\.txt)(\/|$)/;

export function parseCountries(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.test(pathname);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`geo-pass:${data}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A cookie value "expiry.signature", valid for 30 days. */
export async function makePass(secret: string, now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(now / 1000) + PASS_DAYS * 86_400;
  return { value: `${exp}.${await hmac(secret, String(exp))}`, maxAge: PASS_DAYS * 86_400 };
}

export async function validPass(secret: string, value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value || !secret) return false;
  const [exp, sig] = value.split(".");
  if (!/^\d{9,11}$/.test(exp ?? "") || !sig || Number(exp) * 1000 < now) return false;
  const want = await hmac(secret, exp);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function cookieValue(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

const NOTICE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not available in your country</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:460px;text-align:center}h1{font-size:26px;margin:0 0 12px}p{color:#aaa;margin:0 0 10px}a{color:#eee}</style></head>
<body><main><h1>Not available in your country</h1><p>This site isn't currently available where you are.</p><p style="font-size:13px">Staff: <a href="/login">sign in</a>.</p></main></body></html>`;

/**
 * Returns a response to send instead of the site, or null to carry on.
 * `country` is Cloudflare's two-letter code for the visitor (request.cf.country).
 */
export async function geoBlock(request: Request, country: string | undefined, blocked: string[], secret: string | undefined): Promise<Response | null> {
  if (!country || !blocked.includes(country.toUpperCase())) return null;
  const { pathname } = new URL(request.url);
  if (isOpenPath(pathname)) return null;
  if (secret && (await validPass(secret, cookieValue(request.headers.get("cookie"), PASS_COOKIE)))) return null;
  return new Response(NOTICE, {
    status: 451,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
