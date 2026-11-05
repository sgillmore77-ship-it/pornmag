import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { cache } from "react";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const isCloudflareWorker =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

let nodeDb: Db | undefined;

function createDb(connectionString: string, maxUses?: number): Db {
  const pool = new Pool({ connectionString, max: isCloudflareWorker ? 1 : 10, maxUses });
  // On Workers the runtime closes sockets when a request ends; an idle
  // client noticing that is expected, not an application error.
  pool.on("error", (err) => {
    if (!isCloudflareWorker) console.error("Postgres pool error", err);
  });
  return drizzle(pool, { schema, casing: "snake_case" });
}

/**
 * On Cloudflare Workers a connection can't be shared between requests, so a
 * fresh pool is made per request through Hyperdrive (which does the real
 * pooling). In Node (dev, tests, scripts) one pool is shared.
 */
const getWorkerDb = cache(async (): Promise<Db> => {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  const hyperdrive = (env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
  const url = hyperdrive?.connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No database configured: set HYPERDRIVE binding or DATABASE_URL");
  return createDb(url, 1);
});

export async function getDb(): Promise<Db> {
  if (isCloudflareWorker) return getWorkerDb();
  if (!nodeDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    nodeDb = createDb(url);
  }
  return nodeDb;
}

/** For scripts and tests that manage their own connection. */
export function createNodeDb(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema, casing: "snake_case" }), close: () => pool.end() };
}
