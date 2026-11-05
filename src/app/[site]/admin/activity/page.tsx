import { PageHead, When } from "@/components/admin/bits";
import { listActivity } from "@/data/admin/site";
import { requireAdminPage } from "@/lib/admin";

export default async function ActivityPage() {
  const a = await requireAdminPage("publication.manage");
  const rows = await listActivity(a.db, a.ctx.site, 200);
  return (
    <>
      <PageHead title="Activity" sub="Every change made in the admin, newest first." />
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <When d={e.createdAt} tz={a.ctx.publication.settings.timeZone} />
                </td>
                <td>{e.actor ?? "Deleted user"}</td>
                <td>
                  <code style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{e.action}</code>
                </td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>
                  {typeof e.metadata?.title === "string" ? e.metadata.title : typeof e.metadata?.name === "string" ? e.metadata.name : typeof e.metadata?.fromPath === "string" ? `${e.metadata.fromPath} → ${e.metadata.toPath}` : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
