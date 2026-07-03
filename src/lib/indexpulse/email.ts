/**
 * IndexPulse email delivery via Resend's REST API (free tier: 3k/mo).
 * We hit the HTTP endpoint directly with fetch rather than adding the
 * `resend` SDK — one less dependency for a single call.
 *
 * No-ops (returns false) when RESEND_API_KEY is unset so the cron keeps
 * working in environments where email isn't configured.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type AlertEmail = {
  to: string;
  subject: string;
  /** Plain-text body. We also wrap it in minimal HTML. */
  text: string;
  html?: string;
};

export async function sendAlertEmail(msg: AlertEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from =
    process.env.INDEXPULSE_EMAIL_FROM ?? "IndexPulse <alerts@easysplits.in>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html:
          msg.html ??
          `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${msg.text.replace(
            /\n/g,
            "<br/>",
          )}</div>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send threw", err);
    return false;
  }
}
