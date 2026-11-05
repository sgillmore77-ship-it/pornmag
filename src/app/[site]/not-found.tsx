import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-display text-7xl font-bold text-[var(--brand)]">404</p>
      <h1 className="mt-4 font-display text-3xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-neutral-500">It may have moved or been taken down.</p>
      <Link href="/" className="mt-8 inline-block bg-[var(--brand)] px-5 py-3 font-semibold text-[var(--brand-contrast)]">
        Back to the homepage
      </Link>
    </div>
  );
}
