import { describe, expect, it } from "vitest";
import { safeHref } from "@/components/rich-text";
import { embedSrc } from "@/lib/embeds";
import { can } from "@/lib/permissions";
import { layoutOf, themeStyle } from "@/lib/theme";

describe("rich text links", () => {
  it("allows http(s), mailto and same-site links", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("/reviews/x")).toBe("/reviews/x");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
  });
  it("blocks script and protocol-relative links", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(" JavaScript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
  });
});

describe("embeds", () => {
  it("only renders approved providers over https", () => {
    expect(embedSrc("youtube", "https://www.youtube-nocookie.com/embed/abc")).toBeTruthy();
    expect(embedSrc("youtube", "https://evil.example/embed/abc")).toBeNull();
    expect(embedSrc("youtube", "http://www.youtube.com/embed/abc")).toBeNull();
    expect(embedSrc("unknown", "https://player.vimeo.com/video/1")).toBeNull();
  });
});

describe("permissions", () => {
  const actor = (role: Parameters<typeof can>[0] extends infer A ? A extends { role: infer R } ? R : never : never) => ({
    userId: "u",
    isSuperAdmin: false,
    role,
  });
  it("matches the role table", () => {
    expect(can(actor("user"), "comment.write")).toBe(true);
    expect(can(actor("user"), "content.create")).toBe(false);
    expect(can(actor("author"), "content.create")).toBe(true);
    expect(can(actor("author"), "content.publish")).toBe(false);
    expect(can(actor("editor"), "content.publish")).toBe(true);
    expect(can(actor("editor"), "publication.manage")).toBe(false);
    expect(can(actor("moderator"), "comments.moderate")).toBe(true);
    expect(can(actor("admin"), "publication.manage")).toBe(true);
  });
  it("denies non-members and anonymous visitors, allows the platform owner", () => {
    expect(can(null, "comment.write")).toBe(false);
    expect(can(actor(null), "comment.write")).toBe(false);
    expect(can({ userId: "u", isSuperAdmin: true, role: null }, "publication.manage")).toBe(true);
  });
});

describe("theme", () => {
  it("rejects anything that isn't a plain hex colour or a known pairing", () => {
    const style = themeStyle({ primaryColor: "red;} body{display:none", fontPairing: "nope" }) as Record<string, string>;
    expect(style["--brand"]).toBe("#7A1F3D");
    expect(style["--fd"]).toContain("Bodoni Moda");
  });
  it("picks black or white text on the brand colour (threshold 0.36)", () => {
    expect((themeStyle({ primaryColor: "#E8571F", fontPairing: "couture" }) as Record<string, string>)["--on-brand"]).toBe("#FFFFFF");
    expect((themeStyle({ primaryColor: "#FFD60A", fontPairing: "couture" }) as Record<string, string>)["--on-brand"]).toBe("#121110");
  });
  it("applies the chosen type pairing", () => {
    const poster = themeStyle({ primaryColor: "#1F3FD6", fontPairing: "poster" }) as Record<string, string>;
    expect(poster["--fd"]).toContain("Anton");
    expect(poster["--dt"]).toBe("uppercase");
    expect(poster["--dsz"]).toBe("0.9");
  });
  it("defaults to the Issue layout", () => {
    expect(layoutOf({ primaryColor: "#000000", fontPairing: "couture" })).toBe("issue");
    expect(layoutOf({ primaryColor: "#000000", fontPairing: "couture", layout: "feed" })).toBe("feed");
  });
});

describe("date formats", () => {
  const now = new Date("2026-11-05T21:00:00Z");
  it("shows clock time today, 'Yesterday', then a short date", async () => {
    const { formatNewsTime, formatShortDate, formatDuration } = await import("@/lib/format");
    expect(formatNewsTime(new Date("2026-11-05T09:42:00Z"), "Europe/London", now)).toBe("09:42");
    expect(formatNewsTime(new Date("2026-11-04T09:42:00Z"), "Europe/London", now)).toBe("Yesterday");
    expect(formatNewsTime(new Date("2026-11-02T09:42:00Z"), "Europe/London", now)).toBe("2 Nov");
    expect(formatShortDate(new Date("2025-11-02T09:42:00Z"), "Europe/London", now)).toBe("2 Nov 2025");
    expect(formatDuration(134)).toBe("2:14");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("host segment", () => {
  it("round-trips hosts with ports and rejects anything path-like", async () => {
    const { hostToSegment, segmentToHost } = await import("@/lib/host-segment");
    expect(hostToSegment("Mag.Example.com")).toBe("mag~example~com");
    expect(segmentToHost("mag~example~com")).toBe("mag.example.com");
    expect(segmentToHost(hostToSegment("localhost:3000")!)).toBe("localhost:3000");
    expect(hostToSegment("evil/../x")).toBeNull();
    expect(hostToSegment("a.com%2f")).toBeNull();
    expect(hostToSegment("a_b.com")).toBeNull();
  });
});
