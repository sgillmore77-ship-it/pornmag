import type { Metadata } from "next";
import type { ContentPage } from "@/data/content";
import { contentPath } from "@/data/content";
import { mediaUrl } from "./media";
import type { SiteContext } from "./site-context";

export function absoluteUrl(ctx: SiteContext, path: string): string {
  return new URL(path, ctx.origin).toString();
}

/** Placeholder media (seed data) has no real file to share. */
function shareable<T extends { storageKey: string } | null>(m: T): T | null {
  return m && !m.storageKey.startsWith("placeholder:") ? m : null;
}

function absoluteMedia(ctx: SiteContext, storageKey: string): string {
  const url = mediaUrl(storageKey);
  return url.startsWith("http") ? url : absoluteUrl(ctx, url);
}

/** Metadata for an article/review/video/news page. */
export function contentMetadata(ctx: SiteContext, item: ContentPage): Metadata {
  const url = absoluteUrl(ctx, contentPath(item));
  const title = item.seoTitle ?? item.title;
  const description = item.metaDescription ?? item.standfirst ?? undefined;
  const image = shareable(item.ogImage) ?? shareable(item.heroImage);
  return {
    title,
    description,
    alternates: { canonical: item.canonicalUrl ?? url },
    robots: item.robotsIndex ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: ctx.publication.name,
      publishedTime: item.publishedAt.toISOString(),
      modifiedTime: item.updatedAt.toISOString(),
      section: item.category?.name,
      tags: item.tags.map((t) => t.name),
      images: image
        ? [{ url: absoluteMedia(ctx, image.storageKey), width: image.width ?? undefined, height: image.height ?? undefined, alt: image.alt }]
        : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(ctx: SiteContext): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${ctx.origin}/#organization`,
    name: ctx.publication.name,
    url: ctx.origin,
  };
}

export function websiteJsonLd(ctx: SiteContext): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${ctx.origin}/#website`,
    name: ctx.publication.name,
    url: ctx.origin,
    publisher: { "@id": `${ctx.origin}/#organization` },
  };
}

/** Article structured data (features and news; reviews and videos add their own types). */
export function articleJsonLd(ctx: SiteContext, item: ContentPage): JsonLd {
  const image = shareable(item.heroImage) ?? shareable(item.ogImage);
  return {
    "@context": "https://schema.org",
    "@type": item.type === "news" ? "NewsArticle" : "Article",
    headline: item.title,
    description: item.standfirst ?? undefined,
    datePublished: item.publishedAt.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    mainEntityOfPage: absoluteUrl(ctx, contentPath(item)),
    image: image ? [absoluteMedia(ctx, image.storageKey)] : undefined,
    author: item.authorDetails.map((a) => ({
      "@type": "Person",
      name: a.name,
    })),
    publisher: { "@id": `${ctx.origin}/#organization` },
    articleSection: item.category?.name,
    keywords: item.tags.length ? item.tags.map((t) => t.name).join(", ") : undefined,
  };
}

export function breadcrumbJsonLd(ctx: SiteContext, crumbs: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(ctx, c.path),
    })),
  };
}

const ENTITY_TYPE: Record<string, string> = { website: "WebSite", product: "Product", service: "Service" };

/**
 * Review markup for reviews with a score. What's reviewed is described
 * honestly: a website, product or service when the review's subject is one;
 * otherwise the release itself, credited to its studio or creator.
 */
export function reviewJsonLd(ctx: SiteContext, item: ContentPage): JsonLd | null {
  if (item.type !== "review" || !item.review) return null;
  const subject = item.reviewFull?.subject ?? null;
  const itemReviewed =
    subject && ENTITY_TYPE[subject.kind]
      ? { "@type": ENTITY_TYPE[subject.kind], name: subject.name, url: subject.websiteUrl ?? undefined }
      : {
          "@type": "CreativeWork",
          name: item.title,
          dateCreated: item.review.releaseYear ? String(item.review.releaseYear) : undefined,
          creator: subject ? { "@type": subject.kind === "creator" ? "Person" : "Organization", name: subject.name } : undefined,
        };
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: item.title,
    url: absoluteUrl(ctx, contentPath(item)),
    datePublished: item.publishedAt.toISOString(),
    author: item.authorDetails.map((a) => ({ "@type": "Person", name: a.name })),
    publisher: { "@id": `${ctx.origin}/#organization` },
    reviewBody: item.review.verdict ?? undefined,
    reviewRating: { "@type": "Rating", ratingValue: item.review.score, bestRating: item.review.scoreMax, worstRating: 0 },
    itemReviewed,
  };
}

function isoDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

/** VideoObject only when there is a real thumbnail and an embed: both are required. */
export function videoJsonLd(ctx: SiteContext, item: ContentPage): JsonLd | null {
  const thumb = shareable(item.heroImage) ?? shareable(item.ogImage);
  if (item.type !== "video" || !item.videoFull?.embedUrl || !thumb) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: item.title,
    description: item.standfirst ?? item.title,
    thumbnailUrl: [absoluteMedia(ctx, thumb.storageKey)],
    uploadDate: item.publishedAt.toISOString(),
    duration: item.videoFull.durationSeconds ? isoDuration(item.videoFull.durationSeconds) : undefined,
    embedUrl: item.videoFull.embedUrl,
    publisher: { "@id": `${ctx.origin}/#organization` },
  };
}
