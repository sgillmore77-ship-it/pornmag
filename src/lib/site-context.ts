import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getPublicationByHost, type Publication } from "@/data/publications";
import { site, type Site } from "@/data/site";
import { getAuth } from "./auth";
import { segmentToHost } from "./host-segment";
import { loadActor, type Actor } from "./permissions";

export type SiteContext = {
  host: string;
  publication: Publication;
  site: Site;
  /** Absolute origin for canonical URLs, sitemaps and structured data. */
  origin: string;
};

/** Resolves the publication for a `[site]` route segment, or 404s. */
export const getSiteContext = cache(async (siteParam: string): Promise<SiteContext> => {
  const host = segmentToHost(siteParam);
  const publication = await getPublicationByHost(host);
  if (!publication) notFound();
  // Local dev and preview hosts link to themselves; real domains always
  // canonicalise to the publication's primary domain.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const preview = host.endsWith(".workers.dev");
  const canonicalHost = local || preview ? host : (publication.primaryHost ?? host);
  return {
    host,
    publication,
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
