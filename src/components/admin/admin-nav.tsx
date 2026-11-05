"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { label: string; href: string; group?: string };

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items, variant }: { items: AdminNavItem[]; variant: "side" | "bar" }) {
  const pathname = usePathname();
  let group: string | undefined;
  return (
    <>
      {items.map((i) => {
        const header = variant === "side" && i.group && i.group !== group ? ((group = i.group), <span key={`g-${i.group}`} className="group">{i.group}</span>) : null;
        return (
          <span key={i.href} style={{ display: "contents" }}>
            {header}
            <Link href={i.href} className={variant === "side" ? "nav" : undefined} aria-current={active(pathname, i.href) ? "page" : undefined}>
              {i.label}
            </Link>
          </span>
        );
      })}
    </>
  );
}
