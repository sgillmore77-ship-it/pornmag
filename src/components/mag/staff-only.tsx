"use client";

import { useEffect, useState, type ReactNode } from "react";
import { STAFF_COOKIE } from "@/lib/staff-marker";

/** True in browsers marked as staff (they've opened admin). Readers never see staff-only bits. */
export function useIsStaff() {
  const [staff, setStaff] = useState(false);
  useEffect(() => {
    // Read after mount: pages are cached and shared, so this can't be decided on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaff(document.cookie.split(";").some((c) => c.trim() === `${STAFF_COOKIE}=1`));
  }, []);
  return staff;
}

/** Renders its children only for staff. */
export function StaffOnly({ children }: { children: ReactNode }) {
  return useIsStaff() ? <>{children}</> : null;
}
