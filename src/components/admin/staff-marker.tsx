"use client";

import { useEffect } from "react";
import { STAFF_COOKIE } from "@/lib/staff-marker";

/** Marks this browser as staff (for a year) so its visits aren't counted. */
export function StaffMarker() {
  useEffect(() => {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${STAFF_COOKIE}=1; path=/; max-age=31536000; samesite=lax${secure}`;
  }, []);
  return null;
}
