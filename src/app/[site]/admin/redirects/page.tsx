import { PageHead } from "@/components/admin/bits";
import { RedirectsManager } from "@/components/admin/redirects-manager";
import { listRedirects } from "@/data/admin/site";
import { requireAdminPage } from "@/lib/admin";

export default async function RedirectsPage() {
  const a = await requireAdminPage("publication.manage");
  const rows = await listRedirects(a.db, a.ctx.site);
  return (
    <>
      <PageHead title="Redirects" sub="Send old URLs to new ones, so links and search rankings survive changes." />
      <RedirectsManager rows={rows.map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, hits: r.hits }))} />
    </>
  );
}
