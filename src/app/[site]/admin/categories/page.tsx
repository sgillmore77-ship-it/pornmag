import { PageHead } from "@/components/admin/bits";
import { RecordManager } from "@/components/admin/record-manager";
import { listCategoriesAdmin } from "@/data/admin/taxonomy";
import { requireAdminPage } from "@/lib/admin";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export default async function CategoriesPage() {
  const a = await requireAdminPage("taxonomy.manage");
  const rows = await listCategoriesAdmin(a.db, a.ctx.site);
  return (
    <>
      <PageHead title="Categories" sub="Each content item has one category. Category pages live at /category/<slug>." />
      <RecordManager
        noun="category"
        records={rows.map((r) => ({ ...r, intro: r.intro ?? "", seoTitle: r.seoTitle ?? "", metaDescription: r.metaDescription ?? "" }))}
        columns={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "used", label: "Items" },
          { key: "indexable", label: "Indexed", render: "bool" },
          { key: "position", label: "Order" },
        ]}
        fields={[
          { key: "name", label: "Name", kind: "text", max: 80 },
          { key: "slug", label: "Slug", kind: "text", max: 80, hint: "leave blank to generate" },
          { key: "intro", label: "Introduction", kind: "textarea", max: 2000, hint: "shown at the top of the category page" },
          { key: "position", label: "Order", kind: "number", hint: "lower comes first" },
          { key: "indexable", label: "Let search engines index this page", kind: "checkbox", hint: "Turn off for thin categories with little content." },
          { key: "seoTitle", label: "SEO title", kind: "text", max: 120, counter: 60 },
          { key: "metaDescription", label: "Meta description", kind: "textarea", max: 320, counter: 160 },
        ]}
        empty={{ name: "", slug: "", intro: "", position: rows.length, indexable: true, seoTitle: "", metaDescription: "" }}
        save={saveCategoryAction}
        remove={deleteCategoryAction}
        viewBase="/category/"
      />
    </>
  );
}
