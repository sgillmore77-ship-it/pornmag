import Link from "next/link";
import { Empty, PageHead, When } from "@/components/admin/bits";
import { listPagesAdmin } from "@/data/admin/pages";
import { requireAdminPage } from "@/lib/admin";

const GROUP_LABEL = { about: "About", legal: "Legal" } as const;

export default async function PagesAdmin() {
  const a = await requireAdminPage("publication.manage");
  const rows = await listPagesAdmin(a.db, a.ctx.site);
  const tz = a.ctx.publication.settings.timeZone;
  return (
    <>
      <PageHead
        title="Pages"
        sub="Standalone pages such as About, Contact, Terms and Privacy. Pages with a footer column are linked from every page's footer."
        actions={<Link href="/admin/pages/new" className="btn btn-primary btn-sm">New page</Link>}
      />
      {rows.length === 0 ? (
        <Empty action={{ href: "/admin/pages/new", label: "New page" }}>No pages yet.</Empty>
      ) : (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Title</th><th>Address</th><th>Footer</th><th>Status</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/pages/${p.id}`} style={{ fontWeight: 600 }}>{p.title}</Link></td>
                  <td><code style={{ fontFamily: "var(--fm)", fontSize: 13 }}>/{p.slug}</code></td>
                  <td>{p.footerGroup ? GROUP_LABEL[p.footerGroup] : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td><span className={`status status-${p.published ? "published" : "draft"}`}>{p.published ? "published" : "hidden"}</span></td>
                  <td><When d={p.updatedAt} tz={tz} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
