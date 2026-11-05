"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavLink } from "@/db/schema";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Category rail; marks the current section for screen readers and styling. */
export function NavRail({ items, label = "Sections" }: { items: NavLink[]; label?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="rail">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile menu: full ink panel, display-font links, ✕ to close. */
export function MobileMenu({ items, className = "" }: { items: NavLink[]; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className={`burger ${className}`} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} style={{ background: "none", border: 0, color: "inherit" }}>
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div className="menu-panel" style={{ display: "flex" }} role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu-top">
            <span className="label-mono">Menu</span>
            <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: "none", border: 0, color: "inherit", fontSize: 22 }}>
              ✕
            </button>
          </div>
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="mlink" onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
