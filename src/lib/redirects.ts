import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { redirects } from "@/db/schema";
import { findRedirect } from "@/data/admin/site";
import type { SiteContext } from "./site-context";

/**
 * Call instead of notFound() on public pages: follows a matching redirect
 * set up in the admin, otherwise shows the 404 page.
 */
export async function notFoundOrRedirect(ctx: SiteContext, path: string): Promise<never> {
  const db = await getDb();
  const r = await findRedirect(db, ctx.site, path);
  if (r) {
    // Counting is best-effort; never block the redirect on it.
    db.update(redirects).set({ hits: sql`${redirects.hits} + 1` }).where(eq(redirects.id, r.id)).catch(() => {});
    if (r.statusCode === 301 || r.statusCode === 308) permanentRedirect(r.toPath);
    redirect(r.toPath);
  }
  notFound();
}
