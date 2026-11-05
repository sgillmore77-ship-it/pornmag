"use client";

import { useState } from "react";

/**
 * Click-to-play: shows the poster until the reader presses play, so the
 * provider's player (and its scripts) only loads for people who watch.
 */
export function VideoPlayer({ src, title, children }: { src: string; title: string; children: React.ReactNode }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <div className="media" style={{ aspectRatio: "16/9", background: "#000" }}>
        <iframe
          src={`${src}${src.includes("?") ? "&" : "?"}autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title}`} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "pointer" }}>
      {children}
    </button>
  );
}
