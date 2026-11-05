import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPublicProfile } from "@/data/community";
import { formatDate } from "@/lib/format";
import { getSiteContext } from "@/lib/site-context";

// Reader profiles change with every comment and aren't worth indexing.
export const dynamic = "force-dynamic";

async function load(params: PageProps<"/[site]/u/[handle]">["params"]) {
  const { site, handle } = await params;
  const ctx = await getSiteContext(site);
  const profile = await getPublicProfile(await getDb(), ctx.site, decodeURIComponent(handle));
  if (!profile) notFound();
  return { ctx, profile };
}

export async function generateMetadata({ params }: PageProps<"/[site]/u/[handle]">) {
  const { profile } = await load(params);
  return { title: `${profile.name} (@${profile.handle})`, robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: PageProps<"/[site]/u/[handle]">) {
  const { ctx, profile } = await load(params);
  const tz = ctx.publication.settings.timeZone;
  return (
    <div className="wrap" style={{ maxWidth: 820, marginInline: "auto", paddingBlock: "clamp(40px, 6cqw, 96px)" }}>
      <header style={{ borderTop: "2px solid var(--ink)", paddingTop: 16 }}>
        <p className="meta">
          @{profile.handle} {profile.staff && <span className="chip cmt-staff">Staff</span>}
        </p>
        <h1 className="disp" style={{ fontSize: "calc(clamp(40px, 4.4cqw, 64px) * var(--dsz))", marginTop: 8 }}>
          {profile.name}
        </h1>
        {profile.bio && <p style={{ marginTop: 16, fontSize: 18, lineHeight: 1.55, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{profile.bio}</p>}
        <p className="meta" style={{ marginTop: 16 }}>
          Joined {formatDate(profile.joinedAt, tz)} · {profile.commentCount} {profile.commentCount === 1 ? "comment" : "comments"}
        </p>
      </header>
      <section aria-labelledby="recent" style={{ marginTop: 48 }}>
        <h2 id="recent" className="disp cmt-h">
          Recent comments
        </h2>
        {profile.recent.length === 0 ? (
          <p className="cmt-note">Nothing yet.</p>
        ) : (
          <ol className="cmt-list" style={{ marginTop: 0 }}>
            {profile.recent.map((c) => (
              <li key={c.id} className="cmt-item">
                <div className="cmt-meta">
                  <span>On</span>
                  <Link href={c.path} className="cmt-author">
                    {c.title}
                  </Link>
                  <time dateTime={c.createdAt.toISOString()}>{formatDate(c.createdAt, tz)}</time>
                </div>
                <p className="cmt-body">{c.body.length > 400 ? `${c.body.slice(0, 400)}…` : c.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
