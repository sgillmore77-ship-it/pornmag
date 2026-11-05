import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth-forms";
import { getSiteContext, getViewer } from "@/lib/site-context";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Your account" };
// Per-user page: never cached.
export const dynamic = "force-dynamic";

const ROLE_NAMES = { admin: "Administrator", editor: "Editor", author: "Author", moderator: "Moderator", user: "Reader" };

export default async function AccountPage({ params }: PageProps<"/[site]/account">) {
  const ctx = await getSiteContext((await params).site);
  const viewer = await getViewer(ctx);
  if (!viewer) redirect("/login?next=/account");

  const role = viewer.actor.isSuperAdmin ? "Platform owner" : viewer.actor.role ? ROLE_NAMES[viewer.actor.role] : "Reader";

  return (
    <AuthShell title="Your account">
      <dl className="space-y-4">
        <div>
          <dt className="meta">Name</dt>
          <dd style={{ fontSize: 18, margin: "4px 0 0" }}>{viewer.user.name}</dd>
        </div>
        <div>
          <dt className="meta">Email</dt>
          <dd style={{ fontSize: 18, margin: "4px 0 0" }}>{viewer.user.email}</dd>
        </div>
        <div>
          <dt className="meta">Role on {ctx.publication.name}</dt>
          <dd style={{ fontSize: 18, margin: "4px 0 0" }}>{role}</dd>
        </div>
      </dl>
      <p className="dek" style={{ marginTop: 32 }}>Comment history and saved stories arrive in a later update.</p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
