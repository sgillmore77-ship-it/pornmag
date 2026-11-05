import "server-only";
import { headers } from "next/headers";
import { getDb, type Db } from "@/db/client";
import type { Reader } from "@/data/community";
import { hostToSegment } from "./host-segment";
import { getSiteContext, getViewer, type SiteContext } from "./site-context";

/** The site (from the Host header, never client input) and the signed-in reader, if any. */
export async function currentReader(): Promise<{ ctx: SiteContext; db: Db; reader: Reader | null }> {
  const segment = hostToSegment((await headers()).get("host") ?? "");
  if (!segment) throw new Error("Bad Host header");
  const ctx = await getSiteContext(segment);
  const viewer = await getViewer(ctx);
  return { ctx, db: await getDb(), reader: viewer ? { userId: viewer.user.id, actor: viewer.actor } : null };
}

/**
 * A keyed hash of the visitor's IP, for spam and flood checks. The raw IP is
 * never stored. Cloudflare sets cf-connecting-ip; elsewhere the first
 * x-forwarded-for hop is used.
 */
export async function ipHash(h?: Headers): Promise<string | null> {
  const hdrs = h ?? (await headers());
  const ip = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!ip) return null;
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`ip:${ip}`));
  return Array.from(new Uint8Array(sig).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}
