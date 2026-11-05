import Link from "next/link";
import { Empty, PageHead } from "@/components/admin/bits";
import { ContentReports } from "@/components/admin/moderation";
import { CONTENT_REPORT_REASONS } from "@/data/community";
import { listContentReports } from "@/data/admin/moderation";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdminPage("comments.moderate");
  const resolved = (await searchParams).view === "resolved";
  const rows = await listContentReports(a.db, a.ctx.site, !resolved);
  return (
    <>
      <PageHead
        title="Reports"
        sub="Reports readers send from the “Report this page” link: consent, age, copyright and legal concerns. Consent and age reports are listed first. Take a page offline while you check it if there's any doubt."
      />
      <div className="tabs">
        <Link href="/admin/reports" aria-current={!resolved ? "page" : undefined}>Open</Link>
        <Link href="/admin/reports?view=resolved" aria-current={resolved ? "page" : undefined}>Resolved</Link>
      </div>
      {rows.length === 0 ? (
        <Empty>{resolved ? "No resolved reports." : "No open reports."}</Empty>
      ) : (
        <ContentReports
          canUnpublish={can(a.actor, "content.publish")}
          rows={rows.map((r) => ({
            id: r.id,
            reason: r.reason,
            reasonLabel: CONTENT_REPORT_REASONS[r.reason as keyof typeof CONTENT_REPORT_REASONS] ?? r.reason,
            details: r.details,
            email: r.email,
            createdAt: r.createdAt.toISOString(),
            resolved: !!r.resolvedAt,
            contentId: r.contentId,
            title: r.title,
            path: r.path,
            live: r.status === "published",
          }))}
        />
      )}
    </>
  );
}
