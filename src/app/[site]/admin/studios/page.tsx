import { PageHead } from "@/components/admin/bits";
import { RecordManager } from "@/components/admin/record-manager";
import { listEntitiesAdmin } from "@/data/admin/taxonomy";
import { requireAdminPage } from "@/lib/admin";
import { deleteEntityAction, saveEntityAction } from "../actions";

const KINDS = [
  { value: "studio", label: "Studio" },
  { value: "creator", label: "Creator" },
  { value: "website", label: "Website / platform" },
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
];

export default async function StudiosPage() {
  const a = await requireAdminPage("taxonomy.manage");
  const rows = await listEntitiesAdmin(a.db, a.ctx.site);
  return (
    <>
      <PageHead title="Studios & creators" sub="Who and what your reviews and videos cover. Shared studios link related stories together." />
      <RecordManager
        noun="entry"
        records={rows.map((r) => ({ ...r, kindLabel: KINDS.find((k) => k.value === r.kind)?.label ?? r.kind, description: r.description ?? "", websiteUrl: r.websiteUrl ?? "" }))}
        columns={[
          { key: "name", label: "Name" },
          { key: "kindLabel", label: "Type" },
          { key: "used", label: "Linked items" },
        ]}
        fields={[
          { key: "kind", label: "Type", kind: "select", options: KINDS },
          { key: "name", label: "Name", kind: "text", max: 120 },
          { key: "websiteUrl", label: "Website", kind: "text", max: 500, placeholder: "https://…" },
          { key: "description", label: "Description", kind: "textarea", max: 2000 },
        ]}
        empty={{ kind: "studio", name: "", websiteUrl: "", description: "" }}
        save={saveEntityAction}
        remove={deleteEntityAction}
      />
    </>
  );
}
