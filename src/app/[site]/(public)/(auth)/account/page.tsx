import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth-forms";
import { ProfileForm } from "@/components/profile-form";
import { getDb } from "@/db/client";
import { ensureMembership, listFavourites, listOwnComments } from "@/data/community";
import { contentPath } from "@/data/content";
import { formatDate } from "@/lib/format";
import { getSiteContext, getViewer } from "@/lib/site-context";

export const metadata = { title: "Your account", robots: { index: false } };
// Per-user page: never cached.
export const dynamic = "force-dynamic";

const ROLE_NAMES = { admin: "Administrator", editor: "Editor", author: "Author", moderator: "Moderator", user: "Reader" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ marginTop: 56 }}>
      <h2 id={id} className="disp cmt-h" style={{ borderTop: "2px solid var(--ink)", paddingTop: 14 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AccountPage({ params, searchParams }: PageProps<"/[site]/account">) {
  const ctx = await getSiteContext((await params).site);
  const viewer = await getViewer(ctx);
  if (!viewer) redirect("/login?next=/account");
  const db = await getDb();
  const tz = ctx.publication.settings.timeZone;
  const [profile, saved, mine] = await Promise.all([
    ensureMembership(db, ctx.site, viewer.user.id),
    listFavourites(db, ctx.site, viewer.user.id),
    listOwnComments(db, ctx.site, viewer.user.id),
  ]);
  const denied = (await searchParams).denied;
  const role = viewer.actor.isSuperAdmin ? "Platform owner" : viewer.actor.role ? ROLE_NAMES[viewer.actor.role] : "Reader";
  const staff = viewer.actor.isSuperAdmin || (viewer.actor.role && viewer.actor.role !== "user");

  return (
    <div className="wrap" style={{ maxWidth: 820, marginInline: "auto", paddingBlock: "clamp(40px, 6cqw, 96px)" }}>
      <h1 className="disp" style={{ fontSize: "calc(clamp(40px, 4.4cqw, 56px) * var(--dsz))", borderTop: "2px solid var(--ink)", paddingTop: 16 }}>
        Your account
      </h1>
      {denied && (
        <p role="alert" className="cmt-note" style={{ marginTop: 16 }}>
          Your account doesn&apos;t have access to that page.
        </p>
      )}
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginTop: 28 }}>
        <div>
          <dt className="meta">Email</dt>
          <dd style={{ fontSize: 17, margin: "4px 0 0", overflowWrap: "anywhere" }}>{viewer.user.email}</dd>
        </div>
        <div>
          <dt className="meta">Role on {ctx.publication.name}</dt>
          <dd style={{ fontSize: 17, margin: "4px 0 0" }}>{role}</dd>
        </div>
        {profile.handle && (
          <div>
            <dt className="meta">Public profile</dt>
            <dd style={{ fontSize: 17, margin: "4px 0 0" }}>
              <Link href={`/u/${profile.handle}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                @{profile.handle}
              </Link>
            </dd>
          </div>
        )}
      </dl>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
        {staff && (
          <Link href="/admin" className="btn btn-ink">
            Open admin
          </Link>
        )}
        <SignOutButton />
      </div>
      {profile.commentsBlocked && (
        <p className="cmt-note" style={{ marginTop: 20 }}>
          Commenting is switched off for your account on this site.
        </p>
      )}

      <Section id="profile" title="Profile">
        <ProfileForm initial={profile} />
      </Section>

      <Section id="saved" title="Saved stories">
        {saved.length === 0 ? (
          <p className="cmt-note">Nothing saved yet. Use the Save button on any story to keep it here.</p>
        ) : (
          <ol className="cmt-list" style={{ marginTop: 0 }}>
            {saved.map((s) => (
              <li key={s.id} className="cmt-item" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
                <Link href={contentPath(s)} style={{ fontSize: 18, fontWeight: 600 }}>
                  {s.title}
                </Link>
                <span className="meta" style={{ whiteSpace: "nowrap" }}>
                  {s.publishedAt ? formatDate(s.publishedAt, tz) : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section id="your-comments" title="Your comments">
        {mine.length === 0 ? (
          <p className="cmt-note">You haven&apos;t commented yet.</p>
        ) : (
          <ol className="cmt-list" style={{ marginTop: 0 }}>
            {mine.map((c) => (
              <li key={c.id} className="cmt-item">
                <div className="cmt-meta">
                  <span>On</span>
                  <Link href={c.path} className="cmt-author">
                    {c.title}
                  </Link>
                  <time dateTime={c.createdAt.toISOString()}>{formatDate(c.createdAt, tz)}</time>
                  {c.status === "pending" && <span className="cmt-pending">Awaiting approval</span>}
                </div>
                <p className="cmt-body">{c.body.length > 300 ? `${c.body.slice(0, 300)}…` : c.body}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
