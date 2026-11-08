import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/bits";
import { PageEditor } from "@/components/admin/page-editor";
import { getPageAdmin } from "@/data/admin/pages";
import { requireAdminPage } from "@/lib/admin";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminPage("publication.manage");
  const { id } = await params;
  const page = id === "new" ? null : await getPageAdmin(a.db, a.ctx.site, id);
  if (id !== "new" && !page) notFound();
  return (
    <>
      <PageHead title={page ? `Edit: ${page.title}` : "New page"} sub={page ? `Live at /${page.slug}` : undefined} />
      <PageEditor
        initial={
          page
            ? {
                id: page.id,
                title: page.title,
                slug: page.slug,
                standfirst: page.standfirst ?? "",
                body: page.body,
                published: page.published,
                footerGroup: page.footerGroup,
                position: page.position,
                contactTopic: page.contactTopic,
                seoTitle: page.seoTitle ?? "",
                metaDescription: page.metaDescription ?? "",
              }
            : null
        }
      />
    </>
  );
}
