/**
 * Cookie set in the browsers of signed-in staff when they open admin, so their
 * own visits, ad impressions and clicks aren't counted in analytics. It holds
 * nothing personal and grants nothing: it only switches counting off.
 */
export const STAFF_COOKIE = "pm_staff";

/** True when the request comes from a browser marked as staff. */
export function isStaffRequest(req: Request): boolean {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.split(";").some((c) => c.trim() === `${STAFF_COOKIE}=1`);
}
