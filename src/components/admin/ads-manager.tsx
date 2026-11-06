"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAdAction, saveAdAction, saveAdsSettingsAction } from "@/app/[site]/admin/actions";
import { AD_SIZES } from "@/lib/ad-sizes";
import { MediaPicker, MediaThumb, type PickedMedia } from "./media-picker";

type Slot = keyof typeof AD_SIZES;

export type AdRow = {
  id: string;
  slot: Slot;
  name: string;
  kind: "code" | "image";
  code: string;
  image: { id: string; storageKey: string } | null;
  clickUrl: string | null;
  altText: string | null;
  advertiser: string | null;
  enabled: boolean;
  devices: string[];
  weight: number;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
};

type Form = Omit<AdRow, "id" | "impressions" | "clicks"> & { id?: string };

const EMPTY: Form = { slot: "in_content", name: "", kind: "code", code: "", image: null, clickUrl: "", altText: "", advertiser: "", enabled: true, devices: ["mobile", "desktop"], weight: 1, startsAt: null, endsAt: null };

function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function status(r: AdRow) {
  const now = Date.now();
  if (!r.enabled) return { label: "off", cls: "status-draft" };
  if (r.startsAt && Date.parse(r.startsAt) > now) return { label: "scheduled", cls: "status-scheduled" };
  if (r.endsAt && Date.parse(r.endsAt) <= now) return { label: "ended", cls: "status-archived" };
  return { label: "running", cls: "status-published" };
}

export function AdsManager({ rows, settings }: { rows: AdRow[]; settings: { previewPlaceholders: boolean; adsTxt: string; cloudflareToken: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Form | null>(null);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [s, setS] = useState(settings);

  const save = () =>
    editing &&
    start(async () => {
      const { image, ...rest } = editing;
      const r = await saveAdAction({ ...rest, devices: rest.devices as ("mobile" | "desktop")[], imageId: image?.id ?? null });
      setNotice(r.ok ? { ok: true, text: "Placement saved. Pages update within a minute." } : { ok: false, text: r.error });
      if (r.ok) {
        setEditing(null);
        router.refresh();
      }
    });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((f) => (f ? { ...f, [k]: v } : f));
  const size = editing ? AD_SIZES[editing.slot] : null;

  return (
    <div className="form-grid">
      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} role="status">{notice.text}</p>}

      {!editing && (
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => { setNotice(null); setEditing({ ...EMPTY }); }}>
            New placement
          </button>
        </div>
      )}

      {editing && size && (
        <section className="panel">
          <div className="panel-head"><h2>{editing.id ? "Edit placement" : "New placement"}</h2></div>
          <div className="panel-pad form-grid">
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label className="f"><span>Name</span><input type="text" value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. ExoClick in-article" /></label>
              <label className="f"><span>Where</span>
                <select value={editing.slot} onChange={(e) => set("slot", e.target.value as Slot)}>
                  {(Object.keys(AD_SIZES) as Slot[]).map((k) => <option key={k} value={k}>{AD_SIZES[k].name}</option>)}
                </select>
                <span className="hint">Desktop {size.d.join(" × ")}, mobile {size.m.join(" × ")}</span>
              </label>
              <label className="f"><span>Type</span>
                <select value={editing.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}>
                  <option value="code">Ad network code</option>
                  <option value="image">Banner image (sold directly)</option>
                </select>
              </label>
              <label className="f"><span>Advertiser (for reports)</span><input type="text" value={editing.advertiser ?? ""} onChange={(e) => set("advertiser", e.target.value)} /></label>
            </div>

            {editing.kind === "code" ? (
              <label className="f"><span>Ad code</span>
                <textarea value={editing.code} onChange={(e) => set("code", e.target.value)} rows={8} spellCheck={false} style={{ fontFamily: "var(--fm)", fontSize: 12 }} placeholder="Paste the zone/tag code from your ad network" />
                <span className="hint">Runs in a locked-down frame: it can show ads and open links in a new tab, but can&apos;t read the page, readers&apos; accounts or cookies, or redirect the page. Some networks need their &quot;iframe&quot; or &quot;async&quot; tag rather than pop-unders.</span>
              </label>
            ) : (
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(160px, 240px) 1fr" }}>
                <div className="f"><span>Banner</span>
                  {editing.image ? <MediaThumb m={{ storageKey: editing.image.storageKey, alt: "" }} ratio={`${size.d[0]}/${size.d[1]}`} /> : <div className="hint">No image yet. Upload one at {size.d.join(" × ")}{size.d.join() !== size.m.join() ? ` (shown at ${size.m.join(" × ")} on phones)` : ""}.</div>}
                  <div className="toolbar"><button type="button" className="btn btn-outline btn-sm" onClick={() => setPicker(true)}>{editing.image ? "Change" : "Choose image"}</button></div>
                </div>
                <div className="form-grid">
                  <label className="f"><span>Link</span><input type="url" value={editing.clickUrl ?? ""} onChange={(e) => set("clickUrl", e.target.value)} placeholder="https://" /><span className="hint">Opens in a new tab, marked as sponsored. Clicks are counted.</span></label>
                  <label className="f"><span>Alt text</span><input type="text" value={editing.altText ?? ""} onChange={(e) => set("altText", e.target.value)} placeholder="Describe the banner" /></label>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end" }}>
              <label className="f"><span>Starts (optional)</span><input type="datetime-local" value={toLocal(editing.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} /></label>
              <label className="f"><span>Ends (optional)</span><input type="datetime-local" value={toLocal(editing.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} /></label>
              <label className="f"><span>Share of rotation</span><input type="number" min={1} max={100} value={editing.weight} onChange={(e) => set("weight", Math.max(1, Number(e.target.value) || 1))} /><span className="hint">When several run in one spot</span></label>
            </div>
            <div className="toolbar" style={{ gap: 20 }}>
              {(["desktop", "mobile"] as const).map((d) => (
                <label key={d} className="check">
                  <input type="checkbox" checked={editing.devices.includes(d)} onChange={(e) => set("devices", e.target.checked ? [...editing.devices, d] : editing.devices.filter((x) => x !== d))} />
                  {d === "desktop" ? "Desktop" : "Phones"}
                </label>
              ))}
              <label className="check"><input type="checkbox" checked={editing.enabled} onChange={(e) => set("enabled", e.target.checked)} />Switched on</label>
            </div>
            <div className="toolbar">
              <button className="btn btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save placement"}</button>
              <button className="btn btn-outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
          <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m: PickedMedia) => { set("image", { id: m.id, storageKey: m.storageKey }); setPicker(false); }} />
        </section>
      )}

      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Placement</th><th>Where</th><th>Status</th><th style={{ textAlign: "right" }}>Impressions (30d)</th><th style={{ textAlign: "right" }}>Clicks</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = status(r);
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="sub">{[r.kind === "code" ? "Network code" : "Banner", r.advertiser, r.devices.length === 1 ? (r.devices[0] === "mobile" ? "phones only" : "desktop only") : null].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{AD_SIZES[r.slot].name}</td>
                  <td><span className={`status ${st.cls}`}>{st.label}</span></td>
                  <td style={{ textAlign: "right" }}>{r.impressions.toLocaleString("en-GB")}</td>
                  <td style={{ textAlign: "right" }}>{r.kind === "image" ? `${r.clicks.toLocaleString("en-GB")}${r.impressions ? ` (${((r.clicks / r.impressions) * 100).toFixed(1)}%)` : ""}` : "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm" onClick={() => { setNotice(null); setEditing({ ...r }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>{" "}
                    <button className="btn btn-sm" disabled={pending} onClick={() => window.confirm(`Delete "${r.name}" and its stats?`) && start(async () => { const x = await deleteAdAction(r.id); setNotice(x.ok ? { ok: true, text: "Deleted" } : { ok: false, text: x.error }); if (x.ok) router.refresh(); })}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No placements yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Ad settings</h2></div>
        <form
          className="panel-pad form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveAdsSettingsAction(s);
              setNotice(r.ok ? { ok: true, text: "Ad settings saved" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            });
          }}
        >
          <label className="check">
            <input type="checkbox" checked={s.previewPlaceholders} onChange={(e) => setS({ ...s, previewPlaceholders: e.target.checked })} />
            Show labelled empty boxes where ads can go <span className="hint" style={{ fontSize: 12, color: "#9b1c1c", fontWeight: 400 }}>turn off before launch</span>
          </label>
          <label className="f"><span>ads.txt</span>
            <textarea value={s.adsTxt} onChange={(e) => setS({ ...s, adsTxt: e.target.value })} rows={5} spellCheck={false} style={{ fontFamily: "var(--fm)", fontSize: 12 }} placeholder="Paste the lines your ad networks give you" />
            <span className="hint">Served at /ads.txt. Networks use it to confirm you&apos;re allowed to sell this site&apos;s ad space.</span>
          </label>
          <label className="f"><span>Cloudflare Web Analytics token (optional)</span>
            <input type="text" value={s.cloudflareToken} onChange={(e) => setS({ ...s, cloudflareToken: e.target.value })} spellCheck={false} />
            <span className="hint">Adds Cloudflare&apos;s free, cookie-free analytics (speed and visitor numbers) alongside the built-in counts.</span>
          </label>
          <div><button className="btn btn-primary" disabled={pending}>Save ad settings</button></div>
        </form>
      </section>
    </div>
  );
}
