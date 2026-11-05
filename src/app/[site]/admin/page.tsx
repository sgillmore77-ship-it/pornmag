import Link from "next/link";
import { PageHead, StatusBadge, When } from "@/components/admin/bits";
import { contentCounts, listContentAdmin, upcomingScheduled } from "@/data/admin/content";
import { listActivity } from "@/data/admin/site";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

export default async function Dashboard() {
  const a = await requireAdminPage();
  const tz = a.ctx.publication.settings.timeZone;
  const mine = !can(a.actor, "content.edit.any");
  const [counts, recent, scheduled, activity] = await Promise.all([
    contentCounts(a.db, a.ctx.site),
    listContentAdmin(a.db, a.ctx.site, { onlyUserId: mine ? a.user.id : undefined }),
    upcomingScheduled(a.db, a.ctx.site),
    can(a.actor, "publication.manage") ? listActivity(a.db, a.ctx.site, 8) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHead
        title={`Hello, ${a.user.name.split(" ")[0]}`}
        sub={a.ctx.publication.name}
        actions={
          can(a.actor, "content.create") && (
            <Link href="/admin/content/new" className="btn btn-primary">
              New story
            </Link>
          )
        }
      />
      <div className="stats" style={{ marginBottom: 24 }}>
        {(["published", "scheduled", "draft", "archived"] as const).map((k) => (
          <Link key={k} href={`/admin/content?status=${k}`} className="stat">
            <div className="n">{counts[k]}</div>
            <div className="l">{k}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>{mine ? "Your recent work" : "Recently edited"}</h2>
            <Link href="/admin/content" className="label-mono" style={{ fontSize: 10 }}>
              All →
            </Link>
          </div>
          <table className="tbl">
            <tbody>
              {recent.items.slice(0, 8).map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/content/${i.id}`} className="t">
                      {i.title}
                    </Link>
                    <div className="sub">
                      Edited <When d={i.updatedAt} tz={tz} />
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
              {recent.items.length === 0 && (
                <tr>
                  <td style={{ color: "var(--muted)" }}>Nothing yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Scheduled</h2>
          </div>
          <table className="tbl">
            <tbody>
              {scheduled.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/content/${i.id}`} className="t">
                      {i.title}
                    </Link>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <When d={i.scheduledFor} tz={tz} />
                  </td>
                </tr>
              ))}
              {scheduled.length === 0 && (
                <tr>
                  <td style={{ color: "var(--muted)" }}>Nothing scheduled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {activity.length > 0 && (
          <section className="panel">
            <div className="panel-head">
              <h2>Activity</h2>
              <Link href="/admin/activity" className="label-mono" style={{ fontSize: 10 }}>
                All →
              </Link>
            </div>
            <table className="tbl">
              <tbody>
                {activity.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="t">{e.actor ?? "Someone"}</span> <span style={{ color: "var(--muted)" }}>{e.action.replace(".", " ")}</span>
                      {typeof e.metadata?.title === "string" && <div className="sub">{e.metadata.title}</div>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                      <When d={e.createdAt} tz={tz} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
