import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listPublished, TYPE_FOR_SECTION } from "@/data/content";
import { getSiteContext } from "@/lib/site-context";
import { ContentCard } from "./content-card";

export const PAGE_SIZE = 24;

const TITLES: Record<string, string> = { features: "Features", reviews: "Reviews", videos: "Videos", news: "News" };

function pageHref(section: string, page: number) {
  return page <= 1 ? `/${section}` : `/${section}/page/${page}`;
}

export async function sectionIndexMetadata(site: string, section: string, page: number): Promise<Metadata> {
  if (!TYPE_FOR_SECTION[section]) notFound();
  await getSiteContext(site);
  const title = page > 1 ? `${TITLES[section]} — page ${page}` : TITLES[section];
  return { title, alternates: { canonical: pageHref(section, page) } };
}

/** Paginated list of one content type, e.g. /reviews and /reviews/page/2. */
export async function SectionIndex({ site, section, page }: { site: string; section: string; page: number }) {
  const type = TYPE_FOR_SECTION[section];
  if (!type || !Number.isInteger(page) || page < 1) notFound();
  const ctx = await getSiteContext(site);

  // Fetch one extra item to know whether a next page exists.
  const items = await listPublished(await getDb(), ctx.site, {
    types: [type],
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  if (page > 1 && items.length === 0) notFound();
  const hasNext = items.length > PAGE_SIZE;
  const shown = items.slice(0, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-display text-5xl font-bold sm:text-7xl">{TITLES[section]}</h1>
      {shown.length === 0 ? (
        <p className="mt-10 text-neutral-500">Nothing here yet.</p>
      ) : (
        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((item, i) => (
            <ContentCard key={item.id} item={item} headingLevel={2} priority={page === 1 && i < 2} />
          ))}
        </div>
      )}
      {(page > 1 || hasNext) && (
        <nav aria-label="Pagination" className="mt-16 flex justify-between border-t border-[var(--rule)] pt-6 font-semibold">
          {page > 1 ? <Link href={pageHref(section, page - 1)} rel="prev">← Newer</Link> : <span />}
          {hasNext ? <Link href={pageHref(section, page + 1)} rel="next">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
