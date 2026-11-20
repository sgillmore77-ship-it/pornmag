"use client";

import { useEffect, useState } from "react";
import { frameUrls, largerSizes } from "@/lib/screenshots";

type Loaded = { url: string; width: number; height: number };

/** Loads an image in the browser; null if it's missing or too slow. */
function probe(url: string, ms = 5000): Promise<Loaded | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const t = setTimeout(() => {
      img.src = "";
      resolve(null);
    }, ms);
    img.onload = () => {
      clearTimeout(t);
      resolve(img.naturalWidth > 1 ? { url, width: img.naturalWidth, height: img.naturalHeight } : null);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = url;
  });
}

/** The sharpest copy of a screenshot the partner has: tries bigger sizes, falls back to the original. */
export async function sharpest(url: string): Promise<Loaded | null> {
  for (const u of largerSizes(url)) {
    const r = await probe(u, 4000);
    if (r) return r;
  }
  return probe(url);
}

/** Every screenshot of one video, to choose its picture without playing it. */
export function ScreenshotPicker({ thumbUrl, chosen, onChoose }: { thumbUrl: string | null; chosen: string | null; onChoose: (url: string) => void }) {
  const [frames, setFrames] = useState<string[]>(() => frameUrls(thumbUrl));
  const [current, setCurrent] = useState<string | null>(chosen ?? thumbUrl);
  const [best, setBest] = useState<Loaded | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!current) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while the sharper copy loads
    setChecking(true);
    setBest(null);
    sharpest(current).then((r) => {
      if (!live) return;
      setBest(r);
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [current]);

  if (!thumbUrl) return <p className="hint">This video has no screenshots in the feed.</p>;
  const isChosen = !!best && best.url === chosen;

  return (
    <div className="shots">
      <div className="shots-big">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview straight from the partner */}
        <img src={best?.url ?? current ?? thumbUrl} alt="" referrerPolicy="no-referrer" />
      </div>
      <div className="toolbar">
        <span className="hint" style={{ margin: 0 }}>
          {checking ? "Finding the sharpest copy…" : best ? `${best.width} × ${best.height} pixels` : "Couldn't load this screenshot"}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm btn-primary" disabled={!best || isChosen} onClick={() => best && onChoose(best.url)}>
          {isChosen ? "✓ This is the picture" : "Use as picture"}
        </button>
      </div>
      <ul className="shots-strip">
        {frames.map((f) => (
          <li key={f}>
            <button type="button" className={f === current || best?.url === f ? "is-on" : ""} onClick={() => setCurrent(f)} aria-label="Show this screenshot">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview straight from the partner */}
              <img src={f} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFrames((list) => list.filter((x) => x !== f))} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
