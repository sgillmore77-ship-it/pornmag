import Link from "next/link";
import { contentPath, type ContentCard as Card } from "@/data/content";
import { formatDate } from "@/lib/format";
import { MediaImage } from "./media-image";
import { ScoreBadge } from "./score-badge";

type Variant = "lead" | "standard" | "compact" | "list";

const TYPE_LABEL: Record<Card["type"], string> = {
  article: "Feature",
  review: "Review",
  video: "Video",
  news: "News",
};

function Kicker({ item }: { item: Card }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
      {item.category?.name ?? TYPE_LABEL[item.type]}
    </p>
  );
}

function Byline({ item }: { item: Card }) {
  return (
    <p className="text-sm text-neutral-500 dark:text-neutral-400">
      {item.authors.length > 0 && <span>{item.authors.map((a) => a.name).join(" & ")} · </span>}
      <time dateTime={item.publishedAt.toISOString()}>{formatDate(item.publishedAt)}</time>
    </p>
  );
}

export function ContentCard({
  item,
  variant = "standard",
  headingLevel = 3,
  priority,
}: {
  item: Card;
  variant?: Variant;
  headingLevel?: 2 | 3;
  priority?: boolean;
}) {
  const Heading = `h${headingLevel}` as const;
  const href = contentPath(item);

  if (variant === "list") {
    return (
      <article className="group py-4">
        <Kicker item={item} />
        <Heading className="mt-1 font-display text-lg leading-snug">
          <Link href={href} className="group-hover:underline decoration-2 underline-offset-4">
            {item.title}
          </Link>
        </Heading>
        <Byline item={item} />
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="group grid grid-cols-[96px_1fr] gap-4 sm:grid-cols-[128px_1fr]">
        <Link href={href} tabIndex={-1} aria-hidden>
          <MediaImage image={item.heroImage} ratio={1} sizes="128px" />
        </Link>
        <div className="space-y-1">
          <Kicker item={item} />
          <Heading className="font-display text-base leading-snug sm:text-lg">
            <Link href={href} className="group-hover:underline decoration-2 underline-offset-4">
              {item.title}
            </Link>
          </Heading>
        </div>
      </article>
    );
  }

  const lead = variant === "lead";
  return (
    <article className="group">
      <Link href={href} tabIndex={-1} aria-hidden className="relative block">
        <MediaImage
          image={item.heroImage}
          ratio={lead ? 16 / 10 : 3 / 2}
          sizes={lead ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
          priority={priority}
        />
        {item.review && (
          <span className="absolute bottom-3 left-3">
            <ScoreBadge score={item.review.score} max={item.review.scoreMax} />
          </span>
        )}
      </Link>
      <div className={lead ? "mt-5 space-y-3" : "mt-3 space-y-2"}>
        <Kicker item={item} />
        <Heading
          className={
            lead
              ? "font-display text-3xl leading-[1.05] sm:text-5xl"
              : "font-display text-xl leading-snug"
          }
        >
          <Link href={href} className="group-hover:underline decoration-2 underline-offset-4">
            {item.title}
          </Link>
        </Heading>
        {item.standfirst && (lead || variant === "standard") && (
          <p className={lead ? "max-w-2xl text-lg text-neutral-600 dark:text-neutral-300" : "line-clamp-3 text-neutral-600 dark:text-neutral-300"}>
            {item.standfirst}
          </p>
        )}
        <Byline item={item} />
      </div>
    </article>
  );
}
