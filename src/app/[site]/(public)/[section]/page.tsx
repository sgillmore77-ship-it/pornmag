import { Listing, listingMetadata } from "@/components/section-index";
import { SitePageView, sitePageMetadata } from "@/components/site-page";
import { getDb } from "@/db/client";
import { TYPE_FOR_SECTION } from "@/data/content";
import { getPublishedPage } from "@/data/pages";
import { getSiteContext } from "@/lib/site-context";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

/** A one-segment path is a section listing (/reviews) or a standalone page (/about). */
async function standalonePage(site: string, section: string) {
  if (TYPE_FOR_SECTION[section]) return null;
  const ctx = await getSiteContext(site);
  const page = await getPublishedPage(await getDb(), ctx.site, decodeURIComponent(section));
  return page ? { ctx, page } : null;
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  const p = await standalonePage(site, section);
  if (p) return sitePageMetadata(p.page);
  return listingMetadata(site, { kind: "section", section }, 1);
}

export default async function SectionPage({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  const p = await standalonePage(site, section);
  if (p) return <SitePageView ctx={p.ctx} page={p.page} />;
  // Unknown sections 404 (or follow a redirect) inside Listing.
  return <Listing site={site} listing={{ kind: "section", section }} page={1} />;
}
