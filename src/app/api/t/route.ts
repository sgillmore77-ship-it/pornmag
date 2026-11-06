import { classifySource, recordView } from "@/data/analytics";
import { beaconContext, noContent, readJson } from "@/lib/beacon";

/** Page view beacon: { p: path, r: referrer, i: internal navigation }. Always 204. */
export async function POST(req: Request) {
  const c = await beaconContext(req);
  if (!c) return noContent();
  const body = (await readJson(req)) as { p?: unknown; r?: unknown; i?: unknown } | null;
  if (!body || typeof body.p !== "string") return noContent();
  const source = classifySource(typeof body.r === "string" ? body.r : null, c.host, body.i === true);
  try {
    await recordView(c.db, c.s, { path: body.p.split(/[?#]/)[0], source, day: c.day });
  } catch (e) {
    console.error(e);
  }
  return noContent();
}
