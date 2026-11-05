import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { loadActor } from "@/lib/permissions";
import { makePublication, setupTestDb } from "./helpers/db";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));
const { sendEmail } = await import("@/lib/email");

let db: Db;
let close: () => Promise<void>;
let auth: ReturnType<typeof createAuth>;
let pubId: string;
const host = "localhost:3000";

function req(path: string, body: unknown, cookie?: string) {
  return new Request(`http://${host}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: `http://${host}`, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  const pub = await makePublication(db, "authpub");
  pubId = pub.id;
  auth = createAuth(db, { ...pub, primaryHost: null }, host);
});
afterAll(async () => close());

describe("authentication", () => {
  const email = "reader@example.com";
  const password = "correct horse battery";

  it("registers a reader and makes them a member of this publication only", async () => {
    const res = await auth.handler(req("/sign-up/email", { email, password, name: "Reader" }));
    expect(res.status).toBe(200);
    const [user] = await db.select().from(t.users).where(eq(t.users.email, email));
    expect(user.isSuperAdmin).toBe(false);
    const actor = await loadActor(db, user, pubId);
    expect(actor.role).toBe("user");
    const other = await makePublication(db, "elsewhere");
    expect((await loadActor(db, user, other.id)).role).toBeNull();
  });

  it("cannot make itself a super admin at sign-up", async () => {
    await auth.handler(req("/sign-up/email", { email: "sneaky@example.com", password, name: "S", isSuperAdmin: true }));
    const [user] = await db.select().from(t.users).where(eq(t.users.email, "sneaky@example.com"));
    expect(user?.isSuperAdmin ?? false).toBe(false);
  });

  it("rejects short passwords", async () => {
    const res = await auth.handler(req("/sign-up/email", { email: "short@example.com", password: "short", name: "S" }));
    expect(res.status).toBe(400);
  });

  it("signs in with the right password and returns a session cookie", async () => {
    const res = await auth.handler(req("/sign-in/email", { email, password }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/pm\.session_token=/);
  });

  it("refuses the wrong password", async () => {
    const res = await auth.handler(req("/sign-in/email", { email, password: "wrong password!!" }));
    expect(res.status).toBe(401);
  });

  it("emails a reset link and lets the user set a new password with it", async () => {
    const res = await auth.handler(req("/request-password-reset", { email, redirectTo: "/reset-password" }));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    const text = vi.mocked(sendEmail).mock.calls[0][0].text;
    const link = text.match(/https?:\/\/\S+/)![0];
    const token = new URL(link).pathname.split("/").pop()!;

    const reset = await auth.handler(req("/reset-password", { newPassword: "a brand new password", token }));
    expect(reset.status).toBe(200);
    expect((await auth.handler(req("/sign-in/email", { email, password: "a brand new password" }))).status).toBe(200);
    expect((await auth.handler(req("/sign-in/email", { email, password }))).status).toBe(401);
  });

  it("doesn't reveal whether an email has an account", async () => {
    const res = await auth.handler(req("/request-password-reset", { email: "nobody@example.com", redirectTo: "/reset-password" }));
    expect(res.status).toBe(200);
  });

  it("blocks repeated failed logins from one IP", async () => {
    const attempt = () =>
      auth.handler(
        new Request(`http://${host}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: `http://${host}`, "cf-connecting-ip": "203.0.113.9" },
          body: JSON.stringify({ email, password: "guessing password" }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("stores no plain-text passwords", async () => {
    const [user] = await db.select().from(t.users).where(eq(t.users.email, email));
    const [account] = await db
      .select()
      .from(t.accounts)
      .where(and(eq(t.accounts.userId, user.id), eq(t.accounts.providerId, "credential")));
    expect(account.password).not.toContain("brand new");
  });
});
