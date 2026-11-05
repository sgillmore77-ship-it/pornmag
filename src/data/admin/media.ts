import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { media } from "@/db/schema";
import type { Site } from "../site";

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function listMedia(db: Db, s: Site, opts: { q?: string; limit?: number; offset?: number } = {}) {
  const where = [eq(media.publicationId, s.publicationId)];
  const q = opts.q?.trim().replace(/[%_]/g, "\\$&");
  if (q) where.push(or(ilike(media.alt, `%${q}%`), ilike(media.caption, `%${q}%`))!);
  return db
    .select()
    .from(media)
    .where(and(...where))
    .orderBy(desc(media.createdAt))
    .limit(Math.min(opts.limit ?? 60, 200))
    .offset(opts.offset ?? 0);
}

export async function getMedia(db: Db, s: Site, id: string) {
  const [m] = await db.select().from(media).where(and(eq(media.id, id), eq(media.publicationId, s.publicationId)));
  return m ?? null;
}

/** Storage key: <publication>/<yyyy>/<mm>/<random>.<ext> — never derived from the uploaded file name. */
export function storageKeyFor(s: Site, mimeType: string, now = new Date()) {
  const ext = ALLOWED_IMAGE_TYPES[mimeType];
  if (!ext) throw new Error("Only JPEG, PNG, WebP, AVIF and GIF images can be uploaded");
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${s.publicationId}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
}

/** Checks the file's first bytes really are the image type it claims to be. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 12))) return "image/avif";
  return null;
}

export const mediaMetaInput = z.object({
  id: z.string().max(64),
  alt: z.string().trim().max(300),
  caption: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  credit: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function updateMediaMeta(db: Db, s: Site, raw: z.input<typeof mediaMetaInput>) {
  const i = mediaMetaInput.parse(raw);
  const r = await db
    .update(media)
    .set({ alt: i.alt, caption: i.caption, credit: i.credit })
    .where(and(eq(media.id, i.id), eq(media.publicationId, s.publicationId)))
    .returning({ id: media.id });
  if (!r.length) throw new Error("Not found");
}

export async function createMediaRow(
  db: Db,
  s: Site,
  v: { storageKey: string; mimeType: string; sizeBytes: number; width?: number | null; height?: number | null; alt: string; uploadedBy: string },
) {
  const [row] = await db
    .insert(media)
    .values({ publicationId: s.publicationId, ...v, width: v.width ?? null, height: v.height ?? null })
    .returning();
  return row;
}
