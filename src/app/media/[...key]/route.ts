/**
 * Serves uploaded media from the R2 bucket when no separate media domain is
 * set (NEXT_PUBLIC_MEDIA_BASE_URL). Keys are unique per upload, so responses
 * can be cached for a year. In local development `next dev` serves the same
 * paths from public/media instead.
 */
type R2Object = { body: ReadableStream; httpEtag: string; httpMetadata?: { contentType?: string } };
type R2Bucket = { get(key: string): Promise<R2Object | null> };

const KEY = /^[a-z0-9-]+\/\d{4}\/\d{2}\/[a-f0-9-]+\.(jpg|jpeg|png|webp|avif|gif)$/i;

export async function GET(req: Request, { params }: RouteContext<"/media/[...key]">) {
  const key = (await params).key.join("/");
  if (!KEY.test(key)) return new Response("Not found", { status: 404 });
  let bucket: R2Bucket | undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    bucket = ((await getCloudflareContext({ async: true })).env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET;
  } catch {
    bucket = undefined;
  }
  if (!bucket) return new Response("Not found", { status: 404 });
  const obj = await bucket.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  if (req.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: obj.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
