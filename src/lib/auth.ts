import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { memberships } from "@/db/schema";
import type { Publication } from "@/data/publications";
import { sendEmail } from "./email";

function originFor(host: string): string {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/**
 * Builds the auth handler for one publication's host. Accounts are
 * platform-wide identities, but sessions are scoped to the host they were
 * created on (cookies are per-domain), and signing up on a publication makes
 * the user a "user" member of that publication only.
 */
export function createAuth(db: Db, publication: Publication, host: string) {
  const origin = originFor(host);
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }

  return betterAuth({
    appName: publication.name,
    baseURL: origin,
    secret: secret ?? "dev-only-secret-change-me-dev-only-secret",
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: `Reset your ${publication.name} password`,
          text: `Someone asked to reset the password for your ${publication.name} account.\n\nReset it here (link valid for 1 hour):\n${url}\n\nIf this wasn't you, ignore this email.`,
        });
      },
    },
    user: {
      additionalFields: {
        isSuperAdmin: { type: "boolean", defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/request-password-reset": { window: 60 * 10, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: origin.startsWith("https"),
      cookiePrefix: "pm",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db
              .insert(memberships)
              .values({ publicationId: publication.id, userId: user.id, role: "user" })
              .onConflictDoNothing();
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function getAuth(publication: Publication, host: string): Promise<Auth> {
  return createAuth(await getDb(), publication, host);
}
