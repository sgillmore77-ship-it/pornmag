import Link from "next/link";
import { contentPath, type ContentCard } from "@/data/content";
import { formatDuration } from "@/lib/format";
import { bylineOf, KickerDate } from "./bits";
import { Media } from "./media";
import { ScoreBlock, ScoreInline } from "./score";

/** One card for listings and "more to read": adapts to articles, reviews and videos. */
export function ListingCard({ item, tz, priority, headingLevel = 3 }: { item: ContentCard; tz?: string; priority?: boolean; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as const;
  const isReview = item.type === "review" && item.review;
  const isVideo = item.type === "video";
  return (
    <Link href={contentPath(item)} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Media
        image={item.heroImage}
        ratio={isReview ? "4/5" : isVideo ? "16/10" : "3/2"}
        sizes="(min-width: 1024px) 23vw, (min-width: 700px) 45vw, 100vw"
        priority={priority}
        label={isReview ? "top-right" : isVideo ? "top-left" : "bottom"}
        labelPrefix={isVideo ? "" : "IMG · "}
      >
        {isReview && <ScoreBlock score={item.review!.score} scoreMax={item.review!.scoreMax} />}
        {item.video && <span className="play" />}
        {item.video?.durationSeconds ? <span className="dur">{formatDuration(item.video.durationSeconds)}</span> : null}
      </Media>
      {isReview && item.review?.badge ? (
        <span className="kicker" style={{ marginTop: 4 }}>
          ● {item.review.badge}
        </span>
      ) : (
        <span style={{ marginTop: 4 }}>
          <KickerDate item={item} tz={tz} />
        </span>
      )}
      <H className="disp card-title" style={{ lineHeight: 1.08, fontSize: "calc(25px * var(--dsz))" }}>
        {item.title}
      </H>
      {isReview ? (
        <>
          <span className="meta">{[item.review?.studio, item.review?.releaseYear].filter(Boolean).join(" · ")}</span>
          {item.review?.verdict && <p style={{ fontSize: 16, lineHeight: 1.5 }}>{item.review.verdict}</p>}
        </>
      ) : isVideo ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <span className="meta">{item.video?.studio ?? ""}</span>
          {item.review && <ScoreInline score={item.review.score} scoreMax={item.review.scoreMax} />}
        </div>
      ) : (
        <>
          {item.standfirst && <p className="dek">{item.standfirst}</p>}
          <span className="meta">By {bylineOf(item)}</span>
        </>
      )}
    </Link>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(240px, calc((100% - 3 * 32px) / 4)), 1fr))", gap: "48px 32px" }}>
      {children}
    </div>
  );
}
