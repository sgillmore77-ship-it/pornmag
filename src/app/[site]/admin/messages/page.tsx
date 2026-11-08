import Link from "next/link";
import { PageHead } from "@/components/admin/bits";
import { MessagesList } from "@/components/admin/messages-list";
import { listMessages } from "@/data/admin/pages";
import { requireAdminPage } from "@/lib/admin";

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const a = await requireAdminPage("publication.manage");
  const all = (await searchParams).all === "1";
  const rows = await listMessages(a.db, a.ctx.site, { handled: all });
  return (
    <>
      <PageHead
        title="Messages"
        sub="Sent through the contact form. Reply from your own email, then mark the message as done."
        actions={
          <Link href={all ? "/admin/messages" : "/admin/messages?all=1"} className="btn btn-sm">
            {all ? "Show open only" : "Show all, including done"}
          </Link>
        }
      />
      <MessagesList
        tz={a.ctx.publication.settings.timeZone}
        rows={rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), handledAt: m.handledAt?.toISOString() ?? null }))}
      />
    </>
  );
}
