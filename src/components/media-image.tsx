import Image from "next/image";
import type { MediaRef } from "@/data/content";
import { mediaUrl } from "@/lib/media";

type Props = {
  image: MediaRef | null;
  /** Width / height, e.g. 16 / 9. The box keeps this shape before load. */
  ratio?: number;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** A responsive, lazy-loaded image in a fixed-ratio box (no layout shift). */
export function MediaImage({ image, ratio = 3 / 2, sizes, priority, className = "" }: Props) {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${className}`}
      style={{ aspectRatio: ratio, backgroundColor: image?.blurColor ?? undefined }}
    >
      {image && (
        <Image
          src={mediaUrl(image.storageKey)}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      )}
    </div>
  );
}
