import Image from "next/image";
import type { CSSProperties } from "react";
import type { MediaRef } from "@/data/content";
import { mediaUrl } from "@/lib/media";

export function isPlaceholder(m: Pick<MediaRef, "storageKey"> | null | undefined): boolean {
  return !!m?.storageKey.startsWith("placeholder:");
}

type Props = {
  image: MediaRef | null;
  /** CSS aspect-ratio, e.g. "3/2". Omit when the parent sets the size. */
  ratio?: string;
  sizes: string;
  priority?: boolean;
  /** Where the art-direction caption sits on placeholder images. */
  label?: "bottom" | "top-right" | "top-left" | "none";
  labelPrefix?: string;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
};

/**
 * An image in a fixed-ratio box (no layout shift). Seeded placeholder media
 * render as the design's striped tone block with an art-direction caption.
 */
export function Media({ image, ratio, sizes, priority, label = "bottom", labelPrefix = "IMG · ", className = "", style, children }: Props) {
  const ph = !image || isPlaceholder(image);
  const tone = image?.blurColor ?? (ph && image ? image.storageKey.slice("placeholder:".length) : undefined);
  return (
    <div
      className={`media ${ph ? "is-ph" : ""} ${className}`}
      style={{ aspectRatio: ratio, backgroundColor: tone, ...style }}
    >
      {!ph && image && (
        <Image src={mediaUrl(image.storageKey)} alt={image.alt} fill sizes={sizes} priority={priority} />
      )}
      {ph && image?.caption && label !== "none" && (
        <span aria-hidden className={`ph-label ${label === "bottom" ? "" : label}`}>
          {labelPrefix}
          {image.caption}
        </span>
      )}
      {ph && image && <span className="sr-only">{image.alt}</span>}
      {children}
    </div>
  );
}
