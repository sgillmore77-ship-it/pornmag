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

/** Turns a normal YouTube/Vimeo page URL into an approved embed URL. */
export function toEmbed(input: string): { provider: string; url: string } | null {
  try {
    const u = new URL(input.trim());
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
    for (const provider of ["youtube", "vimeo"]) if (embedSrc(provider, input)) return { provider, url: input };
  } catch {
    /* not a URL */
  }
  return null;
}

