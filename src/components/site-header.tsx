import Link from "next/link";

type NavItem = { name: string; href: string };

export function SiteHeader({ name, nav }: { name: string; nav: NavItem[] }) {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {name}
        </Link>
        <nav aria-label="Account" className="flex items-center gap-4 text-sm">
          <Link href="/account" className="hover:underline underline-offset-4">
            Account
          </Link>
        </nav>
      </div>
      {nav.length > 0 && (
        <nav aria-label="Sections" className="border-t border-neutral-200 dark:border-neutral-800">
          <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] sm:px-6">
            {nav.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link href={item.href} className="hover:text-[var(--brand)]">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({ name }: { name: string }) {
  return (
    <footer className="mt-24 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-10 text-sm text-neutral-500 sm:flex-row sm:justify-between sm:px-6">
        <p className="font-display text-lg text-neutral-900 dark:text-neutral-100">{name}</p>
        <p>For adults only. © {new Date().getFullYear()} {name}</p>
      </div>
    </footer>
  );
}
