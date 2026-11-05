import { notFoundOrRedirect } from "@/lib/redirects";
import { getSiteContext } from "@/lib/site-context";

// Any path no other route matches: follow a redirect if one exists, else 404.
export const dynamic = "force-dynamic";

export default async function CatchAll({ params }: PageProps<"/[site]/[...rest]">) {
  const { site, rest } = await params;
  const ctx = await getSiteContext(site);
  return notFoundOrRedirect(ctx, `/${rest.map(decodeURIComponent).join("/")}`);
}
