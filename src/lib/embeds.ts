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

export function embedSrc(provider: string | undefined, url: string | undefined): string | null {
  if (!provider || !url) return null;
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
