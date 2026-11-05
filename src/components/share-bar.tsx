/**
 * Share links. Plain links, no third-party scripts or trackers, so they cost
 * nothing on page speed. Sticky beside the article on wide screens.
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
    <div className="share">
      <p className="meta" style={{ fontSize: 10, letterSpacing: "0.12em" }}>
        Share
      </p>
      <ul>
        {links.map((l) => (
          <li key={l.name}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="chip share-link">
              {l.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
