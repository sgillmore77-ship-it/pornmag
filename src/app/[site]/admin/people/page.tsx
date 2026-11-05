import Link from "next/link";
import { PageHead } from "@/components/admin/bits";
import { PeopleTable } from "@/components/admin/moderation";
import { listPeople, ROLES } from "@/data/admin/moderation";
import { requireAdminPage } from "@/lib/admin";
import { can, type Role } from "@/lib/permissions";

const FILTERS = [
  { v: "", label: "Everyone" },
  { v: "team", label: "Team" },
  { v: "blocked", label: "Blocked" },
];

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdminPage("comments.moderate");
  const sp = await searchParams;
  const role = (["team", "blocked", ...ROLES] as string[]).includes(sp.role ?? "") ? (sp.role as Role | "team" | "blocked") : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listPeople(a.db, a.ctx.site, { q: sp.q?.slice(0, 100), role, page });
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ role, q: sp.q, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/people${s ? `?${s}` : ""}`;
  };
  const manage = can(a.actor, "publication.manage");

  return (
    <>
      <PageHead
        title="People"
        sub={manage ? "Readers and the team. Change roles here: moderators handle comments, authors write, editors publish, administrators run the site." : "Readers and the team on this site."}
      />
      <div className="tabs">
        {FILTERS.map((f) => (
          <Link key={f.v} href={qs({ role: f.v || undefined, page: undefined })} aria-current={(role ?? "") === f.v ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </div>
      <form className="toolbar" style={{ marginBottom: 16 }} action="/admin/people">
        {role && <input type="hidden" name="role" value={role} />}
        <input className="inp" type="search" name="q" defaultValue={sp.q} placeholder="Name, email or handle" style={{ maxWidth: 320 }} aria-label="Search people" />
        <button className="btn btn-outline btn-sm">Search</button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{total} {total === 1 ? "person" : "people"}</span>
      </form>
      <PeopleTable
        canManageRoles={manage}
        isAdmin={a.actor.isSuperAdmin || a.actor.role === "admin"}
        rows={rows.map((r) => ({
          userId: r.userId,
          name: r.name,
          email: r.email,
          handle: r.handle,
          role: r.role,
          blocked: !!r.blockedAt,
          blockedReason: r.blockedReason,
          joinedAt: r.joinedAt.toISOString(),
          comments: r.comments,
          self: r.userId === a.user.id,
        }))}
      />
      {(page > 1 || page * 50 < total) && (
        <nav className="toolbar label-mono" style={{ justifyContent: "space-between", marginTop: 16 }}>
          {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Previous</Link> : <span />}
          {page * 50 < total ? <Link href={qs({ page: String(page + 1) })}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
