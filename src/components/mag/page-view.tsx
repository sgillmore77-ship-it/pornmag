"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Counts one view per page per browser session. No cookies, no identifiers:
 * just the path and where the reader came from.
 */
export function PageView() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const internal = !first.current;
    first.current = false;
    try {
      const key = `pv:${path}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: count anyway.
    }
    const body = JSON.stringify({ p: path, r: internal ? null : document.referrer || null, i: internal });
    if (!navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
    }
  }, [path]);
  return null;
}
