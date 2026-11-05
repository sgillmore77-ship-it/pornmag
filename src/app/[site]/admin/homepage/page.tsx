import { and, desc, eq } from "drizzle-orm";
import { PageHead } from "@/components/admin/bits";
import { HomepageManager } from "@/components/admin/homepage-manager";
import { getHomepageAdmin } from "@/data/admin/site";
import { listCategoriesAdmin } from "@/data/admin/taxonomy";
import { contentItems } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin";
import { layoutOf } from "@/lib/theme";

export default async function HomepageAdmin() {
  const a = await requireAdminPage("homepage.manage");
  const [sections, cats, content] = await Promise.all([
    getHomepageAdmin(a.db, a.ctx.site),
    listCategoriesAdmin(a.db, a.ctx.site),
    a.db
      .select({ id: contentItems.id, name: contentItems.title, type: contentItems.type })
      .from(contentItems)
      .where(and(eq(contentItems.publicationId, a.ctx.publication.id), eq(contentItems.status, "published")))
      .orderBy(desc(contentItems.publishedAt))
      .limit(300),
  ]);
  return (
    <>
      <PageHead title="Homepage" sub="Choose the layout, then order, hide and fill the sections." />
      <HomepageManager
        layout={layoutOf(a.ctx.publication.theme)}
        content={content}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        initial={sections.map((s) => ({
          id: s.id,
          kind: s.kind,
          enabled: s.enabled,
          title: s.title ?? "",
          limit: s.config.limit ?? "",
          picks: s.items
            .map((i) => (i.contentId ? { id: i.contentId, name: i.title ?? "" } : i.categoryId ? { id: i.categoryId, name: i.categoryName ?? "" } : null))
            .filter((x): x is { id: string; name: string } => !!x),
        }))}
      />
    </>
  );
}
