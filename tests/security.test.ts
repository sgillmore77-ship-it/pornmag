import { describe, expect, it } from "vitest";
import { safeHref } from "@/components/rich-text";
import { embedSrc } from "@/lib/embeds";
import { can } from "@/lib/permissions";
import { themeStyle } from "@/lib/theme";

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
  it("rejects anything that isn't a plain hex colour", () => {
    const style = themeStyle({ primaryColor: "red;} body{display:none", fontPairing: "nope" }) as Record<string, string>;
    expect(style["--brand"]).toBe("#e4002b");
    expect(style["--pub-display"]).toContain("Georgia");
  });
  it("picks readable text on the brand colour", () => {
    expect((themeStyle({ primaryColor: "#ffff00", fontPairing: "editorial" }) as Record<string, string>)["--brand-contrast"]).toBe("#0a0a0a");
    expect((themeStyle({ primaryColor: "#000080", fontPairing: "editorial" }) as Record<string, string>)["--brand-contrast"]).toBe("#ffffff");
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
