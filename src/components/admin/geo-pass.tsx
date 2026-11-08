"use client";

import { useEffect } from "react";

/** Refreshes the staff pass that lets the team view the site from blocked countries. */
export function GeoPass() {
  useEffect(() => {
    void fetch("/api/geo-pass", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }, []);
  return null;
}
