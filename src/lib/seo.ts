import type { Metadata } from "next";
import type { ContentPage } from "@/data/content";
import { contentPath } from "@/data/content";
import { mediaUrl } from "./media";
import type { SiteContext } from "./site-context";

export function absoluteUrl(ctx: SiteContext, path: string): string {
  return new URL(path, ctx.origin).toString();
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
  const image = item.ogImage ?? item.heroImage;
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

/**
 * Article structured data. Reviews get Review markup only in Phase 1C, once
 * the reviewed item's details exist, so we never emit half-true schema.
 */
export function articleJsonLd(ctx: SiteContext, item: ContentPage): JsonLd {
  const image = item.heroImage ?? item.ogImage;
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
