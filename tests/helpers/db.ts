import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createNodeDb, type Db } from "@/db/client";
import * as t from "@/db/schema";

/**
 * A clean, migrated test database. Uses TEST_DATABASE_URL — never point
 * this at a real database, every table is truncated.
 */
export async function setupTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  if (!/test/.test(url)) throw new Error("TEST_DATABASE_URL must point at a database with 'test' in its name");
  const conn = createNodeDb(url);
  await migrate(conn.db, { migrationsFolder: "./drizzle" });
  await conn.db.execute(sql`truncate table publications, users, rate_limits, verifications restart identity cascade`);
  return conn;
}

let n = 0;
export async function makePublication(db: Db, slug: string, hostname?: string) {
  const [pub] = await db
    .insert(t.publications)
    .values({
      slug,
      name: `Pub ${slug}`,
      theme: { primaryColor: "#000000", fontPairing: "editorial" },
      settings: { commentsEnabled: true, ageGate: { enabled: false, provider: null }, locale: "en-GB" },
    })
    .returning();
  if (hostname) {
    await db.insert(t.publicationDomains).values({ publicationId: pub.id, hostname, isPrimary: true });
  }
  return pub;
}

export async function makeContent(
  db: Db,
  publicationId: string,
  overrides: Partial<typeof t.contentItems.$inferInsert> = {},
) {
  n += 1;
  const [row] = await db
    .insert(t.contentItems)
    .values({
      publicationId,
      type: "article",
      status: "published",
      title: `Story ${n}`,
      slug: `story-${n}`,
      publishedAt: new Date(Date.now() - n * 60_000),
      ...overrides,
    })
    .returning();
  return row;
}
