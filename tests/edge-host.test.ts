import { describe, expect, it } from "vitest";
import { canonicalRedirect, isPreviewHost, parseHosts, withNoindex } from "../src/lib/edge-host";

const hosts = parseHosts(" asstomouth.net , Example.com ,");

describe("canonical host redirect", () => {
  it("parses the comma-separated list", () => {
    expect([...hosts]).toEqual(["asstomouth.net", "example.com"]);
    expect(parseHosts(undefined).size).toBe(0);
  });

  it("sends www to the bare domain, keeping path and query", () => {
    const res = canonicalRedirect(new Request("https://www.asstomouth.net/reviews/some-story?page=2"), hosts);
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://asstomouth.net/reviews/some-story?page=2");
  });

  it("ignores case and forces https", () => {
    const res = canonicalRedirect(new Request("http://WWW.Example.com/"), hosts);
    expect(res?.headers.get("location")).toBe("https://example.com/");
  });

  it("leaves other hosts alone", () => {
    for (const url of [
      "https://asstomouth.net/",
      "https://www.other.net/",
      "https://pornmag.sgillmore77.workers.dev/",
      "https://media.asstomouth.net/x.jpg",
    ]) {
      expect(canonicalRedirect(new Request(url), hosts)).toBeNull();
    }
  });

  it("does nothing when no canonical hosts are configured", () => {
    expect(canonicalRedirect(new Request("https://www.asstomouth.net/"), parseHosts(""))).toBeNull();
  });
});

describe("noindex on workers.dev", () => {
  it("detects the preview host", () => {
    expect(isPreviewHost(new Request("https://pornmag.sgillmore77.workers.dev/"))).toBe(true);
    expect(isPreviewHost(new Request("https://asstomouth.net/"))).toBe(false);
  });

  it("adds the header and keeps status, body and other headers", async () => {
    const res = withNoindex(new Response("hello", { status: 404, headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(await res.text()).toBe("hello");
  });
});
