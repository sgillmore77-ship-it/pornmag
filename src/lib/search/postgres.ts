import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { categories, contentItems } from "@/db/schema";
import { cardColumns, hydrateCards, isLive } from "@/data/content";
import type { SearchProvider } from "./index";
import { searchTerms } from "./index";

/**
 * Postgres full-text search over the weighted `search_vector` column
 * (title > standfirst > body, GIN-indexed). Every term must match, and the
 * last-typed term matches as a prefix ("velo" finds "velour").
 */
export const postgresSearch: SearchProvider = {
  async search(db, s, { q, types, limit = 24, offset = 0 }) {
    const terms = searchTerms(q);
    if (!terms.length) return { items: [], total: 0, categories: [] };
    // Terms are letters/digits only, so this tsquery text is safe; it is
    // still passed as a bound parameter, never spliced into SQL.
    const tsq = terms.map((t) => `${t}:*`).join(" & ");
    const query = sql`to_tsquery('simple', ${tsq})`;
    const where = and(isLive(s), sql`${contentItems.searchVector} @@ ${query}`, types?.length ? inArray(contentItems.type, types) : undefined);
    const rank = sql<number>`ts_rank(${contentItems.searchVector}, ${query})`;

    const [rows, [{ n }], cats] = await Promise.all([
      db
        .select(cardColumns)
        .from(contentItems)
        .where(where)
        .orderBy(desc(rank), desc(contentItems.publishedAt))
        .limit(Math.min(limit, 50))
        .offset(offset),
      db.select({ n: count() }).from(contentItems).where(where),
      db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.publicationId, s.publicationId), ilike(categories.name, `%${terms.join(" ")}%`)))
        .limit(6),
    ]);
    return { items: await hydrateCards(db, s, rows), total: n, categories: cats };
  },
};
