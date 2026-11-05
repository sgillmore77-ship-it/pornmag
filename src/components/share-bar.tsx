/**
 * Share links. Plain links, no third-party scripts or trackers, so they cost
 * nothing on page speed. Sticky beside the article on desktop.
 */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { name: "Bluesky", href: `https://bsky.app/intent/compose?text=${t}%20${u}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "Email", href: `mailto:?subject=${t}&body=${u}` },
  ];
  return (
    <div className="flex items-center gap-3 lg:flex-col lg:items-start">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Share</p>
      <ul className="flex flex-wrap gap-2 lg:flex-col">
        {links.map((l) => (
          <li key={l.name}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-[var(--rule)] px-3 py-1.5 text-sm hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              {l.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
