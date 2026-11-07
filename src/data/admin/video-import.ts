import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contentItems, publications, videoDetails } from "@/db/schema";
import type { Site } from "@/data/site";
import { HOSTNAME_RE, iframeSrc, toEmbed } from "@/lib/embeds";
import type { Actor } from "@/lib/permissions";
import { putObject } from "@/lib/storage";
import { ALLOWED_IMAGE_TYPES, createMediaRow, MAX_UPLOAD_BYTES, sniffImageType, storageKeyFor } from "./media";
import { saveContent, videoHostsFor } from "./content";

/**
 * Imports videos from a partner content feed (e.g. a TubeCorporate CSV
 * feed) as draft video stories: title, length, tags, embed player and a
 * thumbnail copied into our own storage (partners don't allow hotlinking).
 */

export type FeedVideo = {
  sourceId: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  embedUrl: string;
  embedHost: string;
  pageUrl: string | null;
  thumbUrl: string | null;
  categories: string[];
  tags: string[];
  models: string[];
  addedAt: string | null;
};

export type FeedPreview = {
  videos: (FeedVideo & { imported: boolean; approved: boolean })[];
  unapprovedHosts: string[];
  skippedRows: number;
};

export class ImportError extends Error {}

const COLUMN: Record<string, keyof FeedVideo | "mainThumb" | "thumbPrefix"> = {
  "embed code": "embedUrl",
  embed: "embedUrl",
  id: "sourceId",
  title: "title",
  description: "description",
  duration: "durationSeconds",
  "website link": "pageUrl",
  link: "pageUrl",
  "main thumbnail": "mainThumb",
  main_screenshot: "mainThumb",
  "thumbnail prefix": "thumbPrefix",
  screenshots_prefix: "thumbPrefix",
  categories: "categories",
  tags: "tags",
  models: "models",
  model: "models",
  "publish date, time": "addedAt",
  post_date: "addedAt",
};

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);

/** Parses a delimited feed with a header row. Separator is detected from the header. */
export function parseFeed(text: string): { videos: FeedVideo[]; skippedRows: number } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new ImportError("The feed is empty.");
  const header = lines[0];
  const sep = ["|", ";", "\t", ","].find((c) => header.includes(c)) ?? "|";
  const cols = header.split(sep).map((h) => COLUMN[h.trim().toLowerCase()]);
  if (!cols.includes("embedUrl") || !cols.includes("title")) {
    throw new ImportError('The feed needs at least the "Embed code" and "Title" columns. In TubeCorporate, add them under CSV options.');
  }

  const videos: FeedVideo[] = [];
  let skippedRows = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(sep);
    if (cells.length < cols.length) {
      skippedRows++;
      continue;
    }
    // Extra separators (e.g. a "|" inside a title) would shift columns; skip those rows.
    if (cells.length > cols.length) {
      skippedRows++;
      continue;
    }
    const raw: Record<string, string> = {};
    cols.forEach((c, i) => {
      if (c) raw[c] = cells[i].trim();
    });
    const embedUrl = iframeSrc(raw.embedUrl ?? "");
    let embedHost = "";
    try {
      const u = new URL(embedUrl);
      if (u.protocol !== "https:") throw new Error();
      embedHost = u.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      skippedRows++;
      continue;
    }
    const title = (raw.title ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!title) {
      skippedRows++;
      continue;
    }
    const prefix = raw.thumbPrefix ?? "";
    const main = raw.mainThumb ?? "";
    const thumb = /^https:\/\//.test(main) ? main : prefix && main ? `${prefix.replace(/\/?$/, "/")}${main}` : null;
    const dur = Number(raw.durationSeconds);
    videos.push({
      sourceId: (raw.sourceId ?? "").slice(0, 40) || embedUrl,
      title,
      description: raw.description?.slice(0, 600) || null,
      durationSeconds: Number.isFinite(dur) && dur > 0 && dur < 86_400 ? Math.round(dur) : null,
      embedUrl,
      embedHost,
      pageUrl: /^https:\/\//.test(raw.pageUrl ?? "") ? raw.pageUrl! : null,
      thumbUrl: thumb && /^https:\/\//.test(thumb) ? thumb : null,
      categories: list(raw.categories),
      tags: list(raw.tags),
      models: list(raw.models),
      addedAt: raw.addedAt || null,
    });
  }
  return { videos, skippedRows };
}

/** Only public https addresses: no IPs, no localhost, no credentials. */
export function checkFeedUrl(input: string): URL {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new ImportError("That isn't a valid web address.");
  }
  if (u.protocol !== "https:") throw new ImportError("The feed link must start with https://");
  if (u.username || u.password) throw new ImportError("The feed link can't contain a username or password.");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":") || !h.includes(".")) {
    throw new ImportError("The feed link must be a public website address.");
  }
  return u;
}

async function fetchCapped(url: string, maxBytes: number, timeoutMs: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; MagazineImporter/1.0)" } });
  if (!res.ok) throw new ImportError(`The partner's server answered ${res.status}.`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ImportError("That file is too large.");
  const reader = res.body?.getReader();
  if (!reader) throw new ImportError("Nothing came back.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ImportError("That file is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.byteLength;
  }
  return { bytes, contentType: res.headers.get("content-type") ?? "" };
}

export async function previewFeed(db: Db, s: Site, feedUrl: string, limit = 100): Promise<FeedPreview> {
  const u = checkFeedUrl(feedUrl);
  let text: string;
  try {
    const { bytes } = await fetchCapped(u.toString(), 8 * 1024 * 1024, 20_000);
    text = new TextDecoder().decode(bytes);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError("Couldn't download the feed. Check the link opens in your browser.");
  }
  const { videos, skippedRows } = parseFeed(text);
  const shown = videos.slice(0, Math.min(500, Math.max(1, limit)));
  const hosts = await videoHostsFor(db, s);
  const existing = shown.length
    ? await db
        .select({ url: videoDetails.embedUrl })
        .from(videoDetails)
        .innerJoin(contentItems, eq(contentItems.id, videoDetails.contentId))
        .where(and(eq(contentItems.publicationId, s.publicationId), inArray(videoDetails.embedUrl, shown.map((v) => v.embedUrl))))
    : [];
  const done = new Set(existing.map((e) => e.url));
  return {
    videos: shown.map((v) => ({ ...v, imported: done.has(v.embedUrl), approved: !!toEmbed(v.embedUrl, hosts) })),
    unapprovedHosts: [...new Set(shown.filter((v) => !toEmbed(v.embedUrl, hosts)).map((v) => v.embedHost))],
    skippedRows,
  };
}

/** Width and height from the image header (JPEG, PNG, GIF, WebP), or nulls. */
export function imageSize(b: Uint8Array): { width: number | null; height: number | null } {
  const none = { width: null, height: null };
  if (b[0] === 0x89 && b[1] === 0x50) return { width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (b[0] === 0x47 && b[1] === 0x49) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  if (b[0] === 0x52 && b[8] === 0x57) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8 ") return { width: ((b[27] << 8) | b[26]) & 0x3fff, height: ((b[29] << 8) | b[28]) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    return none;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return none;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return none;
}

export type ImportResult = { imported: { id: string; title: string }[]; skipped: { title: string; reason: string }[] };

/**
 * Creates one draft video story per selected video. Duplicates (same
 * player link already on this site) and unapproved players are skipped.
 */
export async function importVideos(
  db: Db,
  s: Site,
  actor: Actor,
  videos: FeedVideo[],
  opts: { categoriesAsTags: boolean; tagsAsTags: boolean },
): Promise<ImportResult> {
  const out: ImportResult = { imported: [], skipped: [] };
  const hosts = await videoHostsFor(db, s);
  for (const v of videos.slice(0, 25)) {
    const embed = toEmbed(v.embedUrl, hosts);
    if (!embed) {
      out.skipped.push({ title: v.title, reason: `${v.embedHost} isn't an approved video player` });
      continue;
    }
    const [dupe] = await db
      .select({ id: videoDetails.contentId })
      .from(videoDetails)
      .innerJoin(contentItems, eq(contentItems.id, videoDetails.contentId))
      .where(and(eq(contentItems.publicationId, s.publicationId), eq(videoDetails.embedUrl, embed.url)));
    if (dupe) {
      out.skipped.push({ title: v.title, reason: "already imported" });
      continue;
    }

    let heroImageId: string | null = null;
    if (v.thumbUrl) {
      try {
        checkFeedUrl(v.thumbUrl);
        const { bytes } = await fetchCapped(v.thumbUrl, MAX_UPLOAD_BYTES, 15_000);
        const type = sniffImageType(bytes);
        if (type && ALLOWED_IMAGE_TYPES[type]) {
          const key = storageKeyFor(s, type);
          await putObject(key, bytes, type);
          const { width, height } = imageSize(bytes);
          const row = await createMediaRow(db, s, { storageKey: key, mimeType: type, sizeBytes: bytes.byteLength, width, height, alt: v.title.slice(0, 300), uploadedBy: actor.userId });
          heroImageId = row.id;
        }
      } catch {
        // A missing thumbnail shouldn't stop the import; the editor can add one.
      }
    }

    const tagNames = [...new Set([...(opts.categoriesAsTags ? v.categories : []), ...(opts.tagsAsTags ? v.tags : [])].map((t) => t.slice(0, 60)))].slice(0, 30);
    try {
      const saved = await saveContent(db, s, actor, {
        type: "video",
        title: v.title,
        standfirst: v.description ?? undefined,
        body: { type: "doc", content: [] },
        status: "draft",
        heroImageId: heroImageId ?? undefined,
        tagNames,
        video: { url: embed.url, durationSeconds: v.durationSeconds },
      });
      out.imported.push({ id: saved.id, title: v.title });
    } catch (e) {
      out.skipped.push({ title: v.title, reason: e instanceof Error ? e.message : "couldn't be saved" });
    }
  }
  return out;
}

/** Adds a partner player to Settings → Video players. Returns the cleaned hostname. */
export async function approveVideoHost(db: Db, s: Site, host: string): Promise<string> {
  const h = host.trim().toLowerCase().replace(/^www\./, "");
  if (!HOSTNAME_RE.test(h)) throw new Error("That isn't a website name");
  const [p] = await db.select({ settings: publications.settings }).from(publications).where(eq(publications.id, s.publicationId));
  const hosts = [...new Set([...(p.settings.videoHosts ?? []), h])].slice(0, 30);
  await db.update(publications).set({ settings: { ...p.settings, videoHosts: hosts } }).where(eq(publications.id, s.publicationId));
  return h;
}
