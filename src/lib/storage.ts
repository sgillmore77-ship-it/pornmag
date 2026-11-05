import "server-only";

/**
 * Media storage. On Cloudflare, files go to the R2 bucket bound as
 * MEDIA_BUCKET and are served from NEXT_PUBLIC_MEDIA_BASE_URL (the bucket's
 * public domain). In local development they're written to public/media so
 * `next dev` serves them at /media/…
 */
type R2Like = { put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown> };

const isWorker = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (!/^[a-z0-9-]+\/\d{4}\/\d{2}\/[a-f0-9-]+\.[a-z0-9]+$/i.test(key)) throw new Error("Invalid storage key");

  if (isWorker) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as { MEDIA_BUCKET?: R2Like }).MEDIA_BUCKET;
    if (!bucket) throw new Error("MEDIA_BUCKET (R2) is not configured");
    // Keys are unique per upload, so files can be cached for a year.
    await bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
    return;
  }

  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_MEDIA) {
    throw new Error("No media storage configured for this server");
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const target = path.join(process.cwd(), "public", "media", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
