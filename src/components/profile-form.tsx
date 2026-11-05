"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateProfileAction } from "@/app/[site]/(public)/community-actions";

export function ProfileForm({ initial }: { initial: { handle: string | null; displayName: string | null; bio: string | null } }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await updateProfileAction({
      handle: String(f.get("handle") ?? ""),
      displayName: String(f.get("displayName") ?? ""),
      bio: String(f.get("bio") ?? ""),
    });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }
  return (
    <form onSubmit={submit} className="cmt-form" style={{ gap: 18 }}>
      <label className="field">
        Public name (handle)
        <input name="handle" defaultValue={initial.handle ?? ""} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" autoComplete="nickname" />
      </label>
      <label className="field">
        Display name (optional)
        <input name="displayName" defaultValue={initial.displayName ?? ""} maxLength={50} />
      </label>
      <label className="field">
        About you (optional)
        <textarea name="bio" className="cmt-input" defaultValue={initial.bio ?? ""} maxLength={280} rows={3} />
      </label>
      <p className="meta" style={{ textTransform: "none", letterSpacing: 0 }}>
        Your handle and display name appear next to your comments. Your email and real name are never shown.
      </p>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "cmt-note" : "cmt-err"}>
          {msg.text}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
        Save profile
      </button>
    </form>
  );
}
