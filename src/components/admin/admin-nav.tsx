"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { label: string; href: string; group?: string };

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items, variant }: { items: AdminNavItem[]; variant: "side" | "bar" }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((i, idx) => {
        const showGroup = variant === "side" && i.group && i.group !== items[idx - 1]?.group;
        return (
          <span key={i.href} style={{ display: "contents" }}>
            {showGroup && <span className="group">{i.group}</span>}
            <Link href={i.href} className={variant === "side" ? "nav" : undefined} aria-current={active(pathname, i.href) ? "page" : undefined}>
              {i.label}
            </Link>
          </span>
        );
      })}
    </>
  );
}
