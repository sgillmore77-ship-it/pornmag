import { cookies, headers } from "next/headers";
import { PASS_COOKIE, makePass } from "@/lib/geo-block";
import { hostToSegment } from "@/lib/host-segment";
import { getSiteContext, getViewer } from "@/lib/site-context";

/**
 * Gives signed-in staff a cookie that lets them view the site from a
 * blocked country (see src/lib/geo-block.ts). Called by the admin area.
 */
export async function POST() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const segment = hostToSegment((await headers()).get("host") ?? "");
  if (!secret || !segment) return new Response(null, { status: 204 });
  const viewer = await getViewer(await getSiteContext(segment));
  const staff = viewer && (viewer.actor.isSuperAdmin || (viewer.actor.role && viewer.actor.role !== "user"));
  if (!staff) return new Response(null, { status: 403 });
  const pass = await makePass(secret);
  (await cookies()).set(PASS_COOKIE, pass.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: pass.maxAge });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
