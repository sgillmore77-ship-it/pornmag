/**
 * Transactional email via Resend's HTTP API (no SDK needed, works on Workers).
 *
 * Requires RESEND_API_KEY and EMAIL_FROM. Without a key, emails are written
 * to the server log instead — that only exists for local development and is
 * refused in production so a missing key can't fail silently.
 */
export type Email = { to: string; subject: string; text: string; html?: string };

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured; cannot send email");
    }
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }
}
