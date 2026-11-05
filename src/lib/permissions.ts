import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { memberships } from "@/db/schema";

export type Role = (typeof memberships.$inferSelect)["role"];

export type Permission =
  | "publication.manage" // branding, settings, ads, members
  | "content.create"
  | "content.edit.own"
  | "content.edit.any"
  | "content.publish"
  | "taxonomy.manage"
  | "homepage.manage"
  | "media.upload"
  | "comments.moderate"
  | "analytics.view"
  | "comment.write"
  | "favourite.write";

const READER: Permission[] = ["comment.write", "favourite.write"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: READER,
  moderator: [...READER, "comments.moderate"],
  author: [...READER, "content.create", "content.edit.own", "media.upload"],
  editor: [
    ...READER,
    "content.create",
    "content.edit.own",
    "content.edit.any",
    "content.publish",
    "taxonomy.manage",
    "homepage.manage",
    "media.upload",
    "comments.moderate",
    "analytics.view",
  ],
  admin: [
    ...READER,
    "publication.manage",
    "content.create",
    "content.edit.own",
    "content.edit.any",
    "content.publish",
    "taxonomy.manage",
    "homepage.manage",
    "media.upload",
    "comments.moderate",
    "analytics.view",
  ],
};

export type Actor = { userId: string; isSuperAdmin: boolean; role: Role | null };

export function can(actor: Actor | null, permission: Permission): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin) return true;
  if (!actor.role) return false;
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(actor: Actor | null, permission: Permission): asserts actor is Actor {
  if (!can(actor, permission)) throw new ForbiddenError(permission);
}

/** Looks up what a user is allowed to do in one publication. */
export async function loadActor(
  db: Db,
  user: { id: string; isSuperAdmin?: boolean | null },
  publicationId: string,
): Promise<Actor> {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.publicationId, publicationId)))
    .limit(1);
  return { userId: user.id, isSuperAdmin: !!user.isSuperAdmin, role: m?.role ?? null };
}
