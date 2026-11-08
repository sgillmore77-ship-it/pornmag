import { PageHead } from "@/components/admin/bits";
import { VideoImporter } from "@/components/admin/video-importer";
import { eq } from "drizzle-orm";
import { publications } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

export default async function ImportPage() {
  const a = await requireAdminPage("content.create");
  // Read fresh: the list changes every time a feed is loaded.
  const [pub] = await a.db.select({ settings: publications.settings }).from(publications).where(eq(publications.id, a.ctx.site.publicationId));
  return (
    <>
      <PageHead
        title="Import videos"
        sub="Bring videos in from a partner feed (such as TubeCorporate). Each one becomes a draft video story with its title, length, tags and a thumbnail copied to your own storage. Write something about it, then publish."
      />
      <VideoImporter canApprove={can(a.actor, "publication.manage")} recentFeeds={pub?.settings.recentFeeds ?? []} />
    </>
  );
}
