"use client";

import { useState } from "react";
import { sendContactAction } from "@/app/[site]/(public)/community-actions";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/contact-topics";

/** Contact form. Messages land in Admin → Messages. */
export function ContactForm({ defaultTopic }: { defaultTopic: ContactTopic }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <p role="status" className="cmt-note" style={{ marginTop: 16 }}>
        Thanks, your message has been sent. We&apos;ll reply by email.
      </p>
    );
  }

  return (
    <form
      className="contact-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await sendContactAction({
          name: String(f.get("name") ?? ""),
          email: String(f.get("email") ?? ""),
          topic: String(f.get("topic") ?? defaultTopic),
          message: String(f.get("message") ?? ""),
          website: String(f.get("website") ?? ""),
        });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        setSent(true);
      }}
    >
      <label className="field">
        Your name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label className="field">
        Your email
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label className="field">
        What&apos;s it about?
        <select name="topic" defaultValue={defaultTopic} className="cmt-input">
          {Object.entries(CONTACT_TOPICS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Message
        <textarea name="message" required minLength={10} maxLength={5000} rows={6} className="cmt-input" />
      </label>
      {/* Hidden from people; bots tend to fill it in. */}
      <label className="hp" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && (
        <p role="alert" className="cmt-err">
          {error}
        </p>
      )}
      <button className="btn btn-ink" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
