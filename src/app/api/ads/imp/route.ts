import { recordImpressions } from "@/data/ads";
import { beaconContext, noContent, readJson } from "@/lib/beacon";

/** Ad impression beacon: { ids: placementId[] }. Always 204. */
export async function POST(req: Request) {
  const c = await beaconContext(req);
  if (!c) return noContent();
  const body = (await readJson(req)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string" && x.length <= 64) : [];
  try {
    await recordImpressions(c.db, c.s, ids, c.day);
  } catch (e) {
    console.error(e);
  }
  return noContent();
}
