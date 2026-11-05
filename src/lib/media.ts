/**
 * Media URLs are derived from storage keys, never stored, so moving the
 * bucket or putting a CDN in front only means changing MEDIA_BASE_URL.
 * Production: the public URL of the Cloudflare R2 bucket (or its custom domain).
 */
export function mediaUrl(storageKey: string): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "/media").replace(/\/$/, "");
  return `${base}/${storageKey.replace(/^\//, "")}`;
}
