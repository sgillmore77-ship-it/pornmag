import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getDb } from "@/db/client";
import { adPlacements } from "@/db/schema";
import { activeAds, type AdCreative } from "@/data/ads";
import { listFooterPages, type FooterPageLink } from "@/data/pages";
import { getPublicationByHost, type Publication } from "@/data/publications";
import { site, type Site } from "@/data/site";
import { getAuth } from "./auth";
import { segmentToHost } from "./host-segment";
import { loadActor, type Actor } from "./permissions";

export type AdSlot = (typeof adPlacements.$inferSelect)["slot"];

export type SiteContext = {
  host: string;
  /** Ad slots that render: enabled placements, or all when previewing. */
  ads: { slots: AdSlot[]; preview: boolean; creatives: Partial<Record<AdSlot, AdCreative[]>> };
  publication: Publication;
  /** Published pages listed in the footer (About, Contact, Terms…). */
  footerPages: FooterPageLink[];
  site: Site;
  /** Absolute origin for canonical URLs, sitemaps and structured data. */
  origin: string;
};

/** Cache tag carried by every cached page of one publication. */
export const siteTag = (publicationId: string) => `site:${publicationId}`;

/**
 * A tiny tagged cache read. Its only purpose is to attach the publication's
 * tag to the page being rendered, so one `updateTag`/`revalidateTag` call
 * refreshes every cached page of that site (and no other site).
 */
function tagPageWithSite(publicationId: string) {
  return unstable_cache(async () => publicationId, ["site-tag", publicationId], { tags: [siteTag(publicationId)], revalidate: false })();
}

/** Resolves the publication for a `[site]` route segment, or 404s. */
export const getSiteContext = cache(async (siteParam: string): Promise<SiteContext> => {
  const host = segmentToHost(siteParam);
  const publication = await getPublicationByHost(host);
  if (!publication) notFound();
  await tagPageWithSite(publication.id);
  // Local dev and preview hosts link to themselves; real domains always
  // canonicalise to the publication's primary domain.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const preview = host.endsWith(".workers.dev");
  const canonicalHost = local || preview ? host : (publication.primaryHost ?? host);
  const db = await getDb();
  const [creatives, footerPages] = await Promise.all([activeAds(db, site(publication.id)), listFooterPages(db, site(publication.id))]);
  const previewAds = !!publication.settings.ads?.previewPlaceholders;
  const live = Object.keys(creatives) as AdSlot[];
  return {
    host,
    ads: {
      preview: previewAds,
      slots: previewAds ? [...new Set<AdSlot>(["header_leaderboard", "in_content", "sidebar", "between_grid", "footer", ...live])] : live,
      creatives,
    },
    publication,
    footerPages,
    site: site(publication.id),
    origin: `${local ? "http" : "https"}://${canonicalHost}`,
  };
});

/**
 * The signed-in user and their role in this publication. Reads cookies, so
 * only call it from dynamic routes (account pages, admin), never from
 * cached public pages.
 */
export const getViewer = cache(async (ctx: SiteContext): Promise<{
  user: { id: string; name: string; email: string };
  actor: Actor;
} | null> => {
  const auth = await getAuth(ctx.publication, ctx.host);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const actor = await loadActor(await getDb(), session.user, ctx.publication.id);
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email }, actor };
});
