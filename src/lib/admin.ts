import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag, updateTag } from "next/cache";
import { getDb, type Db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { hostToSegment } from "./host-segment";
import { assertCan, can, type Actor, type Permission } from "./permissions";
import { getSiteContext, getViewer, siteTag, type SiteContext } from "./site-context";

export type AdminContext = {
  ctx: SiteContext;
  db: Db;
  actor: Actor;
  user: { id: string; name: string; email: string };
};

/** Permissions that grant access to the admin area at all. */
const ADMIN_ENTRY: Permission[] = ["content.create", "comments.moderate", "publication.manage", "taxonomy.manage"];

async function currentSiteContext(): Promise<SiteContext> {
  // Always derived from the request's Host header, never from client input,
  // so an action can't be pointed at another publication.
  const segment = hostToSegment((await headers()).get("host") ?? "");
  if (!segment) throw new Error("Bad Host header");
  return getSiteContext(segment);
}

/** For admin pages: redirects to sign-in, or 404s readers who lack access. */
export async function requireAdminPage(permission?: Permission): Promise<AdminContext> {
  const ctx = await currentSiteContext();
  const viewer = await getViewer(ctx);
  if (!viewer) redirect("/login?next=/admin");
  const allowed = permission ? can(viewer.actor, permission) : ADMIN_ENTRY.some((p) => can(viewer.actor, p));
  if (!allowed) redirect("/account?denied=1");
  return { ctx, db: await getDb(), actor: viewer.actor, user: viewer.user };
}

/** For server actions: throws if the signed-in user lacks the permission. */
export async function requireAdmin(permission: Permission): Promise<AdminContext> {
  const ctx = await currentSiteContext();
  const viewer = await getViewer(ctx);
  if (!viewer) throw new Error("Not signed in");
  assertCan(viewer.actor, permission);
  return { ctx, db: await getDb(), actor: viewer.actor, user: viewer.user };
}

export async function audit(
  a: AdminContext,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  await a.db.insert(auditLogs).values({
    publicationId: a.ctx.publication.id,
    actorId: a.user.id,
    action,
    entityType,
    entityId,
    metadata,
  });
}

/**
 * Refreshes every cached public page of one publication (every page carries
 * the publication's cache tag; see site-context.ts). For route handlers such
 * as the scheduler; admin actions use `purge`, which also lets the editor see
 * their change on the very next request.
 */
export function purgeSite(publicationId: string) {
  revalidateTag(siteTag(publicationId), { expire: 0 });
}

/** From a server action: the next request for any page of this site is fresh. */
export async function purge(a: AdminContext) {
  updateTag(siteTag(a.ctx.publication.id));
}

export type ActionResult<T = void> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Wraps an action body so permission and validation errors come back as messages. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    const err = e as Error & { issues?: { message: string; path: (string | number)[] }[] };
    if (err.issues?.length) {
      const i = err.issues[0];
      return { ok: false, error: `${i.path.join(".") || "Input"}: ${i.message}` };
    }
    if (err.name === "ForbiddenError") return { ok: false, error: "You don't have permission to do that." };
    if (/duplicate key/.test(String((err as { cause?: unknown }).cause ?? err.message))) {
      return { ok: false, error: "That slug is already used. Choose another." };
    }
    console.error(e);
    return { ok: false, error: err.message || "Something went wrong" };
  }
}
