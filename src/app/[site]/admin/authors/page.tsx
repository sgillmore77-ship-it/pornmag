import { PageHead } from "@/components/admin/bits";
import { RecordManager } from "@/components/admin/record-manager";
import { listAuthorsAdmin } from "@/data/admin/taxonomy";
import { requireAdminPage } from "@/lib/admin";
import { deleteAuthorAction, saveAuthorAction } from "../actions";

export default async function AuthorsPage() {
  const a = await requireAdminPage("taxonomy.manage");
  const rows = await listAuthorsAdmin(a.db, a.ctx.site);
  return (
    <>
      <PageHead title="Authors" sub="Bylines. Writers who sign in get one automatically on their first story." />
      <RecordManager
        noun="author"
        records={rows.map((r) => ({ ...r, role: r.role ?? "", bio: r.bio ?? "", account: r.userId ? "Linked" : "" }))}
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "used", label: "Pieces" },
          { key: "account", label: "Account" },
        ]}
        fields={[
          { key: "name", label: "Name", kind: "text", max: 80 },
          { key: "role", label: "Role", kind: "text", max: 80, placeholder: "Features Editor" },
          { key: "bio", label: "Bio", kind: "textarea", max: 2000 },
        ]}
        empty={{ name: "", role: "", bio: "" }}
        save={saveAuthorAction}
        remove={deleteAuthorAction}
      />
    </>
  );
}
