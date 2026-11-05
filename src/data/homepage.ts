import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { homepageSectionItems, homepageSections } from "@/db/schema";
import {
  getCardsByIds,
  listCategories,
  listPublished,
  listTrending,
  type ContentCard,
} from "./content";
import type { Site } from "./site";

type SectionKind = (typeof homepageSections.$inferSelect)["kind"];

export type ResolvedSection =
  | { id: string; kind: Exclude<SectionKind, "categories" | "newsletter">; title: string; items: ContentCard[] }
  | { id: string; kind: "categories"; title: string; categories: Awaited<ReturnType<typeof listCategories>> }
  | { id: string; kind: "newsletter"; title: string };

const DEFAULT_TITLES: Record<SectionKind, string> = {
  hero: "Cover story",
  latest: "Latest",
  featured_reviews: "Reviews",
  trending: "Trending",
  featured_videos: "Watch",
  editors_picks: "Editor's picks",
  categories: "Explore",
  latest_news: "News",
  newsletter: "Newsletter",
};

/**
 * Builds the homepage from the publication's configured sections, in order.
 * Hand-picked items win; automatic fills avoid repeating anything already
 * shown higher up the page. Sections with nothing to show are dropped.
 */
export async function getHomepage(db: Db, s: Site): Promise<ResolvedSection[]> {
  const sections = await db
    .select()
    .from(homepageSections)
    .where(and(eq(homepageSections.publicationId, s.publicationId), eq(homepageSections.enabled, true)))
    .orderBy(asc(homepageSections.position));
  if (!sections.length) return [];

  const picks = await db
    .select()
    .from(homepageSectionItems)
    .where(inArray(homepageSectionItems.sectionId, sections.map((x) => x.id)))
    .orderBy(asc(homepageSectionItems.position));

  const shown = new Set<string>();
  const out: ResolvedSection[] = [];

  for (const section of sections) {
    const title = section.title ?? DEFAULT_TITLES[section.kind];
    const limit = section.config.limit ?? defaultLimit(section.kind);
    const pickedIds = picks
      .filter((p) => p.sectionId === section.id && p.contentId)
      .map((p) => p.contentId!);
    const exclude = [...shown];

    if (section.kind === "newsletter") {
      // Not built yet: the section exists so it can be switched on later.
      continue;
    }

    if (section.kind === "categories") {
      const all = await listCategories(db, s);
      const chosen = picks.filter((p) => p.sectionId === section.id && p.categoryId).map((p) => p.categoryId!);
      const cats = chosen.length
        ? chosen.map((id) => all.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
        : all.filter((c) => c.count > 0);
      if (cats.length) out.push({ id: section.id, kind: "categories", title, categories: cats.slice(0, limit) });
      continue;
    }

    let items = await getCardsByIds(db, s, pickedIds);
    const remaining = limit - items.length;

    if (remaining > 0 && section.kind !== "editors_picks") {
      const notThese = [...exclude, ...items.map((i) => i.id)];
      const types = section.config.contentTypes;
      const fill =
        section.kind === "hero"
          ? await listPublished(db, s, { featuredOnly: true, excludeIds: notThese, limit: remaining, types })
          : section.kind === "trending"
            ? (await listTrending(db, s, remaining + notThese.length)).filter((c) => !notThese.includes(c.id)).slice(0, remaining)
            : section.kind === "featured_reviews"
              ? await listPublished(db, s, { types: ["review"], excludeIds: notThese, limit: remaining })
              : section.kind === "featured_videos"
                ? await listPublished(db, s, { types: ["video"], excludeIds: notThese, limit: remaining })
                : section.kind === "latest_news"
                  ? await listPublished(db, s, { types: ["news"], excludeIds: notThese, limit: remaining })
                  : await listPublished(db, s, {
                      types: types ?? ["article", "review", "video"],
                      categoryId: section.config.categoryId,
                      excludeIds: notThese,
                      limit: remaining,
                    });
      items = [...items, ...fill];
      if (section.kind === "hero" && !items.length) {
        items = await listPublished(db, s, { excludeIds: notThese, limit: 1 });
      }
    }

    if (!items.length) continue;
    // Trending and news are compact lists; they can repeat stories from the grids.
    if (section.kind !== "trending" && section.kind !== "latest_news") items.forEach((i) => shown.add(i.id));
    out.push({ id: section.id, kind: section.kind, title, items });
  }

  return out;
}

function defaultLimit(kind: SectionKind): number {
  switch (kind) {
    case "hero":
      return 1;
    case "latest":
      return 7;
    case "trending":
    case "latest_news":
      return 5;
    case "categories":
      return 6;
    default:
      return 4;
  }
}
