import { PageHead } from "@/components/admin/bits";
import { RecordManager } from "@/components/admin/record-manager";
import { listTagsAdmin } from "@/data/admin/taxonomy";
import { requireAdminPage } from "@/lib/admin";
import { deleteTagAction, saveTagAction } from "../actions";

export default async function TagsPage() {
  const a = await requireAdminPage("taxonomy.manage");
  const rows = await listTagsAdmin(a.db, a.ctx.site);
  return (
    <>
      <PageHead title="Tags" sub="Tag pages (/tag/<slug>) are hidden from search engines until you give them a description and switch indexing on." />
      <RecordManager
        noun="tag"
        records={rows.map((r) => ({ ...r, description: r.description ?? "", seoTitle: r.seoTitle ?? "", metaDescription: r.metaDescription ?? "" }))}
        columns={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "used", label: "Items" },
          { key: "indexable", label: "Indexed", render: "bool" },
        ]}
        fields={[
          { key: "name", label: "Name", kind: "text", max: 60 },
          { key: "slug", label: "Slug", kind: "text", max: 60, hint: "leave blank to generate" },
          { key: "description", label: "Description", kind: "textarea", max: 2000, hint: "unique text for the tag page" },
          { key: "indexable", label: "Let search engines index this tag page", kind: "checkbox", hint: "Only for tags with a description and plenty of content." },
          { key: "seoTitle", label: "SEO title", kind: "text", max: 120, counter: 60 },
          { key: "metaDescription", label: "Meta description", kind: "textarea", max: 320, counter: 160 },
        ]}
        empty={{ name: "", slug: "", description: "", indexable: false, seoTitle: "", metaDescription: "" }}
        save={saveTagAction}
        remove={deleteTagAction}
        viewBase="/tag/"
      />
    </>
  );
}
