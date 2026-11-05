import Link from "next/link";
import { Empty, PageHead, StatusBadge, When } from "@/components/admin/bits";
import { CONTENT_STATUSES, CONTENT_TYPES, listContentAdmin } from "@/data/admin/content";
import { contentPath } from "@/data/content";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

const TYPE_LABEL = { article: "Feature", review: "Review", video: "Video", news: "News" } as const;

export default async function ContentList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdminPage("content.create");
  const sp = await searchParams;
  const type = CONTENT_TYPES.find((t) => t === sp.type);
  const status = CONTENT_STATUSES.find((t) => t === sp.status);
  const page = Math.max(1, Number(sp.page) || 1);
  const tz = a.ctx.publication.settings.timeZone;
  const mine = !can(a.actor, "content.edit.any");
  const { items, hasNext } = await listContentAdmin(a.db, a.ctx.site, { type, status, q: sp.q, page, onlyUserId: mine ? a.user.id : undefined });

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { type, status, q: sp.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/content${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHead
        title="Content"
        sub={mine ? "Your stories. An editor publishes them." : "Every story, review, video and news item."}
        actions={
          <Link href="/admin/content/new" className="btn btn-primary">
            New story
          </Link>
        }
      />
      {sp.deleted && <p className="notice notice-ok" style={{ marginBottom: 16 }}>Deleted.</p>}
      <div className="tabs">
        <Link href={qs({ status: undefined, page: undefined })} aria-current={!status ? "page" : undefined}>
          All
        </Link>
        {CONTENT_STATUSES.map((s) => (
          <Link key={s} href={qs({ status: s, page: undefined })} aria-current={status === s ? "page" : undefined} style={{ textTransform: "capitalize" }}>
            {s}
          </Link>
        ))}
      </div>
      <form className="toolbar" style={{ marginBottom: 16 }} action="/admin/content">
        {status && <input type="hidden" name="status" value={status} />}
        <input className="inp" type="search" name="q" defaultValue={sp.q} placeholder="Search titles" style={{ maxWidth: 320 }} aria-label="Search titles" />
        <select className="inp" name="type" defaultValue={type ?? ""} style={{ maxWidth: 180 }} aria-label="Type">
          <option value="">All types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button className="btn btn-outline btn-sm">Filter</button>
      </form>

      {items.length === 0 ? (
        <Empty action={{ href: "/admin/content/new", label: "Write something" }}>No content matches.</Empty>
      ) : (
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Published / scheduled</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/content/${i.id}`} className="t">
                      {i.title}
                    </Link>
                    <div className="sub">
                      {[i.category, i.authors.join(" & ")].filter(Boolean).join(" · ")}
                      {i.isFeatured && " · Featured"}
                    </div>
                  </td>
                  <td>{TYPE_LABEL[i.type]}</td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                  <td>
                    <When d={i.status === "scheduled" ? i.scheduledFor : i.publishedAt} tz={tz} />
                  </td>
                  <td>
                    <When d={i.updatedAt} tz={tz} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {i.status === "published" && (
                      <Link href={contentPath(i)} target="_blank" className="label-mono" style={{ fontSize: 10 }}>
                        View ↗
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(page > 1 || hasNext) && (
        <nav className="toolbar label-mono" style={{ justifyContent: "space-between", marginTop: 16 }}>
          {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {hasNext ? <Link href={qs({ page: String(page + 1) })}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
