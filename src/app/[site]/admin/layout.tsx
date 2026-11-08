import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { Wordmark } from "@/components/mag/wordmark";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";
import { moderationCounts } from "@/data/admin/moderation";
import { GeoPass } from "@/components/admin/geo-pass";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
// Per-user and always fresh.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await requireAdminPage();
  const counts = can(a.actor, "comments.moderate") ? await moderationCounts(a.db, a.ctx.site) : { pending: 0, contentReports: 0 };
  const items: AdminNavItem[] = [
    { label: "Dashboard", href: "/admin" },
    ...(can(a.actor, "content.create") ? [{ label: "Content", href: "/admin/content", group: "Publish" }, { label: "Media", href: "/admin/media", group: "Publish" }, { label: "Import videos", href: "/admin/import", group: "Publish" }] : []),
    ...(can(a.actor, "taxonomy.manage")
      ? [
          { label: "Categories", href: "/admin/categories", group: "Organise" },
          { label: "Tags", href: "/admin/tags", group: "Organise" },
          { label: "Authors", href: "/admin/authors", group: "Organise" },
          { label: "Studios & creators", href: "/admin/studios", group: "Organise" },
        ]
      : []),
    ...(can(a.actor, "comments.moderate")
      ? [
          { label: `Comments${counts.pending ? ` (${counts.pending})` : ""}`, href: "/admin/comments", group: "Community" },
          { label: `Reports${counts.contentReports ? ` (${counts.contentReports})` : ""}`, href: "/admin/reports", group: "Community" },
          { label: "People", href: "/admin/people", group: "Community" },
        ]
      : []),
    ...(can(a.actor, "analytics.view") ? [{ label: "Analytics", href: "/admin/analytics", group: "Site" }] : []),
    ...(can(a.actor, "homepage.manage") ? [{ label: "Homepage", href: "/admin/homepage", group: "Site" }] : []),
    ...(can(a.actor, "publication.manage")
      ? [
          { label: "Ads", href: "/admin/ads", group: "Site" },
          { label: "Settings", href: "/admin/settings", group: "Site" },
          { label: "Redirects", href: "/admin/redirects", group: "Site" },
          { label: "Activity", href: "/admin/activity", group: "Site" },
        ]
      : []),
  ];

  return (
    <div className="adm">
      <GeoPass />
      <aside className="adm-side" aria-label="Admin">
        <Link href="/admin">
          <Wordmark name={a.ctx.publication.name} />
        </Link>
        <AdminNav items={items} variant="side" />
        <div className="foot">
          <span>{a.user.name}</span>
          <Link href="/" target="_blank">
            View site ↗
          </Link>
          <Link href="/account">Account</Link>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <nav className="adm-mobilebar" aria-label="Admin">
          <AdminNav items={items} variant="bar" />
          <Link href="/">Site ↗</Link>
        </nav>
        <main className="adm-main">{children}</main>
      </div>
    </div>
  );
}
