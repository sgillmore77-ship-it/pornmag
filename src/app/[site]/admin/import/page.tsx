import { PageHead } from "@/components/admin/bits";
import { VideoImporter } from "@/components/admin/video-importer";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

export default async function ImportPage() {
  const a = await requireAdminPage("content.create");
  return (
    <>
      <PageHead
        title="Import videos"
        sub="Bring videos in from a partner feed (such as TubeCorporate). Each one becomes a draft video story with its title, length, tags and a thumbnail copied to your own storage. Write something about it, then publish."
      />
      <VideoImporter canApprove={can(a.actor, "publication.manage")} />
    </>
  );
}
