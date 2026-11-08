"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/app/[site]/admin/actions";
import { MediaPicker, MediaThumb, type PickedMedia } from "./media-picker";

type Nav = { label: string; href: string };
export type SettingsState = {
  name: string;
  tagline: string;
  description: string;
  primaryColor: string;
  fontPairing: string;
  layout: "issue" | "feed";
  mode: "system" | "light" | "dark";
  issueLabel: string;
  footerBlurb: string;
  ageGateEnabled: boolean;
  commentsEnabled: boolean;
  commentModeration: "all" | "first" | "none" | "off";
  timeZone: string;
  videoHosts: string;
  nav: Nav[];
  homeBanner: Pick<PickedMedia, "id" | "storageKey" | "alt" | "width" | "height"> | null;
  homeBannerAlt: string;
  homeBannerHref: string;
};

const SWATCHES = ["#7A1F3D", "#1F3FD6", "#0E7C66", "#E8571F", "#101216"];

export function SettingsForm({ initial, pairings }: { initial: SettingsState; pairings: { key: string; label: string; sample: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState(false);
  const set = <K extends keyof SettingsState>(k: K, val: SettingsState[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <form
      className="form-grid"
      style={{ maxWidth: 820 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { homeBanner, ...rest } = v;
          const r = await saveSettingsAction({ ...rest, homeBannerMediaId: homeBanner?.id ?? null, fontPairing: v.fontPairing as "couture", nav: v.nav.filter((n) => n.label.trim() && n.href.trim()), videoHosts: v.videoHosts.split(/[\s,]+/).filter(Boolean) });
          setNotice(r.ok ? { ok: true, text: "Saved. The site is updated." } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <section className="panel">
        <div className="panel-head"><h2>Publication</h2></div>
        <div className="panel-pad form-grid">
          <div className="form-2">
            <label className="f"><span>Name</span><input type="text" value={v.name} maxLength={60} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="f"><span>Tagline</span><input type="text" value={v.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} /></label>
          </div>
          <label className="f"><span>Description <span className="hint">used for search results and sharing</span></span><textarea value={v.description} maxLength={300} onChange={(e) => set("description", e.target.value)} /></label>
          <div className="form-2">
            <label className="f"><span>Issue line <span className="hint">“The Issue” layout dateline</span></span><input type="text" value={v.issueLabel} maxLength={80} onChange={(e) => set("issueLabel", e.target.value)} /></label>
            <label className="f"><span>Time zone</span><input type="text" value={v.timeZone} onChange={(e) => set("timeZone", e.target.value)} placeholder="Europe/London" /></label>
          </div>
          <label className="f"><span>Footer blurb</span><input type="text" value={v.footerBlurb} maxLength={240} onChange={(e) => set("footerBlurb", e.target.value)} /></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Look</h2></div>
        <div className="panel-pad form-grid">
          <div className="f">
            <span>Brand colour</span>
            <div className="toolbar">
              <input type="color" value={v.primaryColor} onChange={(e) => set("primaryColor", e.target.value.toUpperCase())} aria-label="Brand colour" />
              <input type="text" className="inp" value={v.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} style={{ maxWidth: 120, fontFamily: "var(--fm)" }} aria-label="Brand colour hex" />
              {SWATCHES.map((c) => (
                <button key={c} type="button" title={c} aria-label={`Use ${c}`} onClick={() => set("primaryColor", c)} style={{ width: 32, height: 32, background: c, border: v.primaryColor === c ? "3px solid var(--ink)" : "1px solid var(--line)", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <fieldset className="f" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Type pairing</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {pairings.map((p) => (
                <label key={p.key} className="panel panel-pad" style={{ cursor: "pointer", borderWidth: 2, borderColor: v.fontPairing === p.key ? "var(--brand)" : "var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <input type="radio" name="pairing" value={p.key} checked={v.fontPairing === p.key} onChange={() => set("fontPairing", p.key)} className="sr-only" />
                  <span style={{ fontFamily: p.sample, fontSize: 30, lineHeight: 1, textTransform: p.key === "poster" ? "uppercase" : "none" }}>Velour</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-2">
            <label className="f"><span>Homepage layout</span>
              <select value={v.layout} onChange={(e) => set("layout", e.target.value as SettingsState["layout"])}>
                <option value="issue">The Issue (cover-led)</option>
                <option value="feed">The Feed (grid-led)</option>
              </select>
            </label>
            <label className="f"><span>Colour mode</span>
              <select value={v.mode} onChange={(e) => set("mode", e.target.value as SettingsState["mode"])}>
                <option value="system">Follow the reader&apos;s device</option>
                <option value="light">Always light</option>
                <option value="dark">Always dark</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Homepage banner</h2><span style={{ fontSize: 12, color: "var(--muted)" }}>A graphic across the top of the homepage</span></div>
        <div className="panel-pad form-grid">
          <div className="f">
            <span>Banner image <span className="hint">Upload it in the picker. Wide works best, e.g. 2400 × 1040 pixels. It shows at its own shape, full width.</span></span>
            {v.homeBanner && (
              <div style={{ maxWidth: 560 }}>
                <MediaThumb m={{ storageKey: v.homeBanner.storageKey, alt: v.homeBanner.alt }} ratio={v.homeBanner.width && v.homeBanner.height ? `${v.homeBanner.width}/${v.homeBanner.height}` : "12/5"} />
              </div>
            )}
            <div className="toolbar">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPicker(true)}>{v.homeBanner ? "Change image" : "Choose image"}</button>
              {v.homeBanner && <button type="button" className="btn btn-sm" onClick={() => set("homeBanner", null)}>Remove banner</button>}
            </div>
          </div>
          {v.homeBanner && (
            <div className="form-2">
              <label className="f"><span>Alt text <span className="hint">What the graphic says, for screen readers</span></span><input type="text" value={v.homeBannerAlt} maxLength={160} placeholder={v.homeBanner.alt || v.name} onChange={(e) => set("homeBannerAlt", e.target.value)} /></label>
              <label className="f"><span>Link (optional) <span className="hint">/about, or https://…</span></span><input type="text" value={v.homeBannerHref} maxLength={200} onChange={(e) => set("homeBannerHref", e.target.value)} /></label>
            </div>
          )}
          <p className="hint" style={{ margin: 0 }}>Remember to press <strong>Save settings</strong> at the bottom. It can take a few minutes to appear.</p>
        </div>
        <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m: PickedMedia) => { set("homeBanner", { id: m.id, storageKey: m.storageKey, alt: m.alt, width: m.width, height: m.height }); setPicker(false); }} />
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Navigation</h2><span style={{ fontSize: 12, color: "var(--muted)" }}>Links in the category bar, in order</span></div>
        <div className="panel-pad form-grid">
          {v.nav.map((n, i) => (
            <div key={i} className="toolbar">
              <input className="inp" type="text" value={n.label} placeholder="Label" maxLength={40} style={{ maxWidth: 200 }} aria-label={`Link ${i + 1} label`} onChange={(e) => set("nav", v.nav.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <input className="inp" type="text" value={n.href} placeholder="/category/…" maxLength={200} style={{ maxWidth: 280 }} aria-label={`Link ${i + 1} address`} onChange={(e) => set("nav", v.nav.map((x, k) => (k === i ? { ...x, href: e.target.value } : x)))} />
              <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => { const c = v.nav.slice(); [c[i - 1], c[i]] = [c[i], c[i - 1]]; set("nav", c); }} aria-label="Move up">↑</button>
              <button type="button" className="btn btn-sm" onClick={() => set("nav", v.nav.filter((_, k) => k !== i))}>Remove</button>
            </div>
          ))}
          {v.nav.length < 12 && <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("nav", [...v.nav, { label: "", href: "" }])}>Add link</button>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Behaviour</h2></div>
        <div className="panel-pad form-grid">
          <label className="check"><input type="checkbox" checked={v.ageGateEnabled} onChange={(e) => set("ageGateEnabled", e.target.checked)} />Show the “Adults only” screen on first visit <span className="hint" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>(self-declaration, not verified age checks)</span></label>
          <label className="f"><span>Comments</span>
            <select value={v.commentModeration} onChange={(e) => set("commentModeration", e.target.value as SettingsState["commentModeration"])}>
              <option value="first">Check each reader&apos;s first comment, then trust them (recommended)</option>
              <option value="all">Check every comment before it appears</option>
              <option value="none">Publish straight away; review reports afterwards</option>
              <option value="off">Switch comments off everywhere</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={v.commentsEnabled} onChange={(e) => set("commentsEnabled", e.target.checked)} />Allow comments on new stories by default</label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Video players</h2></div>
        <div className="panel-pad form-grid">
          <label className="f"><span>Approved partner players</span>
            <textarea value={v.videoHosts} onChange={(e) => set("videoHosts", e.target.value)} rows={3} spellCheck={false} placeholder="videotxxx.com" style={{ fontFamily: "var(--fm)", fontSize: 13 }} />
            <span className="hint">One website per line. Video stories can embed players from these sites (as well as YouTube and Vimeo). Only add partners you have an agreement with.</span>
          </label>
        </div>
      </section>

      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} role="status">{notice.text}</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}
