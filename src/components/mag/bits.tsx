import Link from "next/link";
import { SECTION_FOR_TYPE, type ContentCard } from "@/data/content";
import { formatDuration, formatShortDate } from "@/lib/format";

export const TYPE_LABEL: Record<ContentCard["type"], string> = {
  article: "Feature",
  review: "Review",
  video: "Video",
  news: "News",
};

export function kickerOf(item: ContentCard): string {
  return item.category?.name ?? TYPE_LABEL[item.type];
}

export function bylineOf(item: ContentCard): string {
  return item.authors.map((a) => a.name).join(" & ");
}

export function KickerDate({ item, tz, sep = false }: { item: ContentCard; tz?: string; sep?: boolean }) {
  if (sep) {
    return (
      <span className="kicker">
        {kickerOf(item)} · {formatShortDate(item.publishedAt, tz)}
      </span>
    );
  }
  return (
    <div className="row-kicker label-mono" style={{ fontSize: 11 }}>
      <span className="kicker">{kickerOf(item)}</span>
      <span style={{ color: "var(--muted)" }}>{formatShortDate(item.publishedAt, tz)}</span>
    </div>
  );
}

/** "2:14" for videos, "Opinion · 9 min" for stories (trending rows). */
export function trendingMeta(item: ContentCard): string {
  if (item.type === "video") return formatDuration(item.video?.durationSeconds);
  return `${kickerOf(item)} · ${item.readMinutes} min`;
}

export function SectionHead({
  title,
  sub,
  link,
  ruled,
  as: As = "h2",
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
  ruled?: boolean;
  as?: "h2";
}) {
  return (
    <div className={`sh ${ruled ? "ruled" : ""}`}>
      <div>
        <As className="disp">{title}</As>
        {sub && <span className="sh-sub">{sub}</span>}
      </div>
      {link && (
        <Link href={link.href} className="sh-link">
          {link.label}
        </Link>
      )}
    </div>
  );
}

export const sectionHref = (type: ContentCard["type"]) => `/${SECTION_FOR_TYPE[type]}`;

export function countLabel(n: number) {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? "story" : "stories"}`;
}
