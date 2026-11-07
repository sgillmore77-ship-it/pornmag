/**
 * Approved embed providers. An embed only renders if its URL is on a host
 * listed here, so editors (or a compromised account) can't drop arbitrary
 * iframes into pages. Add licensed adult video partners here as they're
 * signed, each with the embed URL pattern from their documentation.
 */
const PROVIDERS: Record<string, { hosts: string[] }> = {
  youtube: { hosts: ["www.youtube-nocookie.com", "www.youtube.com"] },
  vimeo: { hosts: ["player.vimeo.com"] },
};

/**
 * Partner players (e.g. TubeCorporate's videotxxx.com) are approved per
 * publication in Settings → Video players, and stored with provider
 * "partner". Their links keep their query string, which carries the
 * affiliate/promo ID.
 */
export const PARTNER = "partner";

/** A bare hostname such as "videotxxx.com" (no scheme, path or port). */
export const HOSTNAME_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function partnerHostOk(hostname: string, partnerHosts: readonly string[]) {
  const h = hostname.toLowerCase();
  return partnerHosts.some((p) => h === p || h === `www.${p}`);
}

export function embedSrc(provider: string | undefined, url: string | undefined, partnerHosts: readonly string[] = []): string | null {
  if (!provider || !url) return null;
  if (provider === PARTNER) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && !u.username && !u.password && partnerHostOk(u.hostname, partnerHosts) ? u.toString() : null;
    } catch {
      return null;
    }
  }
  const rules = PROVIDERS[provider];
  if (!rules) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !rules.hosts.includes(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const APPROVED_EMBED_PROVIDERS = Object.keys(PROVIDERS);

/** Pulls the src out of pasted embed code (<iframe src="…">), or returns the input. */
export function iframeSrc(input: string): string {
  const m = /<iframe\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/i.exec(input);
  return (m ? m[2] : input).trim().replace(/&amp;/g, "&");
}

/**
 * Turns a YouTube/Vimeo page URL, a partner player link, or pasted embed
 * code into an approved embed URL.
 */
export function toEmbed(input: string, partnerHosts: readonly string[] = []): { provider: string; url: string } | null {
  try {
    const raw = iframeSrc(input);
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (u.protocol === "https:" && partnerHostOk(u.hostname, partnerHosts)) {
      return embedSrc(PARTNER, u.toString(), partnerHosts) ? { provider: PARTNER, url: u.toString() } : null;
    }
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
      if (id && /^[\w-]{6,20}$/.test(id)) return { provider: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (/^[\w-]{6,20}$/.test(id)) return { provider: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return { provider: "vimeo", url: `https://player.vimeo.com/video/${id}` };
    }
    for (const provider of ["youtube", "vimeo"]) if (embedSrc(provider, u.toString())) return { provider, url: u.toString() };
  } catch {
    /* not a URL */
  }
  return null;
}

