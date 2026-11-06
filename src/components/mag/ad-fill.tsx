"use client";

import { useEffect, useRef, useState } from "react";
import type { AdCreative } from "@/data/ads";

/**
 * Fills a reserved ad box in the browser. The box's size is fixed by the
 * server, so nothing shifts when an ad arrives. Ad network code runs in a
 * sandboxed iframe with no access to the page, the reader's session or
 * cookies, and can't navigate the page away; it may only open new tabs.
 */

const SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

function frameDoc(code: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:transparent}body{display:flex;align-items:center;justify-content:center}</style></head><body>${code}</body></html>`;
}

function pick(list: AdCreative[], mobile: boolean): AdCreative | null {
  const now = Date.now();
  const ok = list.filter(
    (c) =>
      c.devices.includes(mobile ? "mobile" : "desktop") &&
      (!c.startsAt || Date.parse(c.startsAt) <= now) &&
      (!c.endsAt || Date.parse(c.endsAt) > now),
  );
  if (!ok.length) return null;
  let r = Math.random() * ok.reduce((a, c) => a + c.weight, 0);
  for (const c of ok) if ((r -= c.weight) < 0) return c;
  return ok[0];
}

// Impressions are batched and sent with sendBeacon.
const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ ids: queue.splice(0, queue.length) });
  if (!navigator.sendBeacon?.("/api/ads/imp", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/ads/imp", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  }
}
function countImpression(id: string) {
  queue.push(id);
  if (!timer) timer = setTimeout(flush, 3000);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

/** Waits until the age screen (if any) has been accepted. */
function ageOk() {
  const html = document.documentElement;
  return !document.querySelector(".agegate") || html.hasAttribute("data-age-ok");
}

export function AdFill({ creatives, width, height, mobileWidth, mobileHeight }: { creatives: AdCreative[]; width: number; height: number; mobileWidth: number; mobileHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ad, setAd] = useState<{ c: AdCreative; w: number; h: number } | null>(null);

  // Load when the box is near the screen and the reader is past the age screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let seen = false;
    let cancelled = false;
    const start = () => {
      if (cancelled || !seen || !ageOk()) return;
      cancelled = true;
      const mobile = window.matchMedia("(max-width: 700px)").matches;
      const c = pick(creatives, mobile);
      if (c) setAd({ c, w: mobile ? mobileWidth : width, h: mobile ? mobileHeight : height });
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen = true;
          io.disconnect();
          start();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    const mo = new MutationObserver(start);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-age-ok"] });
    return () => {
      cancelled = true;
      io.disconnect();
      mo.disconnect();
    };
  }, [creatives, width, height, mobileWidth, mobileHeight]);

  // An impression is half the ad on screen for a second.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ad) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          t = setTimeout(() => {
            countImpression(ad.c.id);
            io.disconnect();
          }, 1000);
        } else if (t) clearTimeout(t);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (t) clearTimeout(t);
    };
  }, [ad]);

  return (
    <div ref={ref} className="ad-fill">
      {ad?.c.kind === "image" && ad.c.image && (
        <a href={`/api/ads/click/${ad.c.id}`} target="_blank" rel="sponsored noopener">
          {/* eslint-disable-next-line @next/next/no-img-element -- ad creatives are served as uploaded, sized to the slot */}
          <img src={ad.c.image.src} alt={ad.c.alt ?? "Advertisement"} width={ad.w} height={ad.h} decoding="async" />
        </a>
      )}
      {ad?.c.kind === "code" && ad.c.code && (
        <iframe title="Advertisement" sandbox={SANDBOX} srcDoc={frameDoc(ad.c.code)} width={ad.w} height={ad.h} scrolling="no" referrerPolicy="strict-origin-when-cross-origin" style={{ border: 0, display: "block" }} />
      )}
    </div>
  );
}
