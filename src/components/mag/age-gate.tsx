"use client";

import { useState } from "react";
import { Wordmark } from "./wordmark";

export const AGE_COOKIE = "pm_age_ok";

/**
 * First-visit "Adults only" interstitial. This is self-declaration, NOT age
 * verification: where the law requires verified age assurance, a provider is
 * plugged in via publication.settings.ageGate.provider before launch.
 *
 * The overlay is in the server HTML (so there's no flash of content), and a
 * tiny inline script hides it before paint for readers who've already entered.
 * Page content stays in the HTML underneath for search engines.
 */
export function AgeGate({ name }: { name: string }) {
  const [open, setOpen] = useState(true);
  const [remember, setRemember] = useState(true);

  if (!open) return null;

  function enter() {
    const maxAge = remember ? `; max-age=${60 * 60 * 24 * 30}` : "";
    document.cookie = `${AGE_COOKIE}=1; path=/; samesite=lax${maxAge}${location.protocol === "https:" ? "; secure" : ""}`;
    document.documentElement.dataset.ageOk = "1";
    setOpen(false);
  }

  // data-nosnippet keeps this notice out of search result snippets.
  return (
    <div className="agegate" role="dialog" aria-modal="true" aria-labelledby="agegate-title" data-nosnippet="">
      <div className="agegate-panel">
        <Wordmark name={name} style={{ fontSize: "calc(34px * var(--dsz))" }} />
        <div style={{ height: 1, background: "var(--line)" }} />
        <h2 id="agegate-title" className="disp">
          Adults only.
        </h2>
        <p>This magazine covers adult entertainment. You must be 18 or older, or the age of majority where you live, to enter.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={enter} autoFocus>
            I&apos;m 18 or older · Enter
          </button>
          <a href="https://www.google.com" className="btn btn-outline btn-lg" rel="noopener noreferrer">
            Leave
          </a>
        </div>
        <label className="agegate-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device for 30 days
        </label>
        <span style={{ fontFamily: "var(--fm)", fontSize: 11, letterSpacing: "0.06em", lineHeight: 1.5, color: "var(--muted)" }}>
          By entering you confirm you are of legal age where you live.
        </span>
      </div>
    </div>
  );
}

/** Runs before paint: hides the gate for readers who already entered. */
export const AGE_GATE_BOOT = `try{if(document.cookie.indexOf("${AGE_COOKIE}=1")>-1){document.documentElement.dataset.ageOk="1"}}catch(e){}`;
