import { describe, expect, it } from "vitest";
import { geoBlock, isOpenPath, makePass, parseCountries, PASS_COOKIE, validPass } from "@/lib/geo-block";

const SECRET = "test-secret-123";
const req = (path: string, cookie?: string) => new Request(`https://mag.example${path}`, { headers: cookie ? { cookie } : {} });

describe("country blocking", () => {
  it("parses the country list", () => {
    expect(parseCountries("gb, US  xx1 ")).toEqual(["GB", "US"]);
    expect(parseCountries(undefined)).toEqual([]);
  });

  it("blocks public pages for blocked countries only", async () => {
    const r = await geoBlock(req("/reviews/velour-hours"), "GB", ["GB"], SECRET);
    expect(r?.status).toBe(451);
    expect(r?.headers.get("cache-control")).toContain("no-store");
    expect(await r?.text()).toContain("Not available in your country");
    expect(await geoBlock(req("/"), "GB", ["GB"], SECRET)).not.toBeNull();
    expect(await geoBlock(req("/"), "US", ["GB"], SECRET)).toBeNull();
    expect(await geoBlock(req("/"), undefined, ["GB"], SECRET)).toBeNull();
    expect(await geoBlock(req("/"), "GB", [], SECRET)).toBeNull();
  });

  it("keeps sign-in, admin and site plumbing reachable", async () => {
    for (const p of ["/login", "/admin", "/admin/content", "/api/auth/sign-in/email", "/_next/static/x.js", "/fonts/a.woff2", "/media/x/2026/01/a.jpg", "/robots.txt"]) {
      expect(isOpenPath(p)).toBe(true);
      expect(await geoBlock(req(p), "GB", ["GB"], SECRET)).toBeNull();
    }
    for (const p of ["/", "/register", "/features/x", "/administrator", "/apis", "/search"]) expect(isOpenPath(p)).toBe(false);
  });

  it("lets staff with a valid pass through, and rejects forged or expired passes", async () => {
    const pass = await makePass(SECRET);
    expect(await validPass(SECRET, pass.value)).toBe(true);
    expect(await geoBlock(req("/", `a=1; ${PASS_COOKIE}=${pass.value}`), "GB", ["GB"], SECRET)).toBeNull();

    const [exp] = pass.value.split(".");
    expect(await validPass(SECRET, `${exp}.${"0".repeat(64)}`)).toBe(false);
    expect(await validPass("other-secret", pass.value)).toBe(false);
    expect(await validPass(SECRET, `${Number(exp) + 999}.${pass.value.split(".")[1]}`)).toBe(false);
    const old = await makePass(SECRET, Date.now() - 31 * 86_400_000);
    expect(await validPass(SECRET, old.value)).toBe(false);
    expect(await geoBlock(req("/", `${PASS_COOKIE}=garbage`), "GB", ["GB"], SECRET)).not.toBeNull();
    // Without a secret configured nobody gets a pass.
    expect(await geoBlock(req("/", `${PASS_COOKIE}=${pass.value}`), "GB", ["GB"], undefined)).not.toBeNull();
  });
});
