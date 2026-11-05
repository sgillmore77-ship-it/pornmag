import type { Db } from "@/db/client";
import type { ContentCard, ContentType } from "@/data/content";
import type { Site } from "@/data/site";
import { postgresSearch } from "./postgres";

export type SearchQuery = { q: string; types?: ContentType[]; limit?: number; offset?: number };
export type SearchResult = {
  items: ContentCard[];
  /** Total matching items (for "N results"). */
  total: number;
  categories: { name: string; slug: string }[];
};

/**
 * Site search, behind one small interface. Postgres full-text search today;
 * a Meilisearch or Algolia provider can implement the same shape later
 * without touching the search page.
 */
export interface SearchProvider {
  search(db: Db, site: Site, query: SearchQuery): Promise<SearchResult>;
}

export const search: SearchProvider = postgresSearch;

/** Splits user input into safe, prefix-matchable terms (letters and digits only). */
export function searchTerms(q: string): string[] {
  return [...new Set((q.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 0))].slice(0, 8);
}
