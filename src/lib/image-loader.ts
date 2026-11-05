"use client";

type LoaderArgs = { src: string; width: number; quality?: number };

/**
 * next/image loader. With NEXT_PUBLIC_IMAGE_TRANSFORMS=cloudflare, images are
 * resized and converted to AVIF/WebP by Cloudflare Image Transformations
 * (must be enabled on the zone). Otherwise the original file is served.
 */
export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  if (src.endsWith(".svg")) return src;
  if (process.env.NEXT_PUBLIC_IMAGE_TRANSFORMS === "cloudflare") {
    const opts = `width=${width},quality=${quality ?? 75},format=auto,fit=scale-down`;
    return `/cdn-cgi/image/${opts}/${src.replace(/^\//, "")}`;
  }
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
