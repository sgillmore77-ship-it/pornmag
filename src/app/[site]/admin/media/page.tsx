import { PageHead } from "@/components/admin/bits";
import { MediaLibrary } from "@/components/admin/media-library";
import { listMedia } from "@/data/admin/media";
import { requireAdminPage } from "@/lib/admin";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const a = await requireAdminPage("media.upload");
  const { q } = await searchParams;
  const rows = await listMedia(a.db, a.ctx.site, { q, limit: 200 });
  return (
    <>
      <PageHead title="Media" sub="Images for stories, covers and categories." />
      <form className="toolbar" style={{ marginBottom: 16 }} action="/admin/media">
        <input className="inp" type="search" name="q" defaultValue={q} placeholder="Search alt text and captions" style={{ maxWidth: 360 }} aria-label="Search media" />
        <button className="btn btn-outline btn-sm">Search</button>
      </form>
      <MediaLibrary
        items={rows.map((m) => ({
          id: m.id,
          storageKey: m.storageKey,
          alt: m.alt,
          caption: m.caption,
          credit: m.credit,
          width: m.width,
          height: m.height,
          blurColor: m.blurColor,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
