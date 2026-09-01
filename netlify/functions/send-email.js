// Announcement email template.
//
// The rendered announcement in the app is a card: title, body with real paragraph
// breaks, then the posted-at line. This mirrors that in email-safe HTML.
//
// Two things the old `<pre style="white-space:pre-wrap">` version got wrong, both
// visible in Outlook: its Word rendering engine ignores `white-space` (so every
// blank line between paragraphs collapsed and the text ran together) and it renders
// `<pre>` in a monospace-ish fallback that looks nothing like the app. So the body is
// converted to real block elements here instead of leaning on a CSS whitespace mode.

const esc = str => String(str)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Body text -> paragraphs. A blank line starts a new <p>; a single newline inside a
// paragraph becomes <br>, matching how `white-space: pre-wrap` renders it in the app.
const bodyHtml = (text, color) => {
  const paras = String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/)
    .map(p => p.trim()).filter(Boolean);
  if (!paras.length) return "";
  return paras.map((p, i) => (
    `<p style="margin:${i === 0 ? "0" : "16px"} 0 0;color:${color};font-size:15px;line-height:24px;">`
    + esc(p).replace(/\n/g, "<br>") + `</p>`
  )).join("");
};

const PAGE = "#F4F0EB";      // app light-mode page background
const CARD = "#ffffff";
const TEXT = "#1c1d1f";
const MUTED = "#6b6b6f";
const BORDER = "#e2ddd6";
const TEAL = "#00828c";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const renderEmail = ({ title, body, courseLabel, postedAt, url }) => {
  const stamp = postedAt ? new Date(postedAt).toLocaleString("en-US", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/New_York",
  }) : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title || "Announcement")}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">

  <tr><td style="padding:0 4px 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${TEAL};">
    ${esc(courseLabel || "Newton")}
  </td></tr>

  <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:24px 26px;font-family:${FONT};">
    ${title ? `<h1 style="margin:0 0 12px;color:${TEXT};font-size:19px;line-height:26px;font-weight:700;">${esc(title)}</h1>` : ""}
    ${bodyHtml(body, TEXT)}
    ${stamp ? `<p style="margin:20px 0 0;color:${MUTED};font-size:12px;line-height:18px;">Posted ${esc(stamp)}</p>` : ""}
  </td></tr>

  <tr><td align="center" style="padding:16px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
    ${url ? `<a href="${esc(url)}" style="color:${TEAL};text-decoration:none;font-weight:600;">Open Newton</a><br>` : ""}
    You are receiving this because you are enrolled in this course.
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
};

// Plain-text alternative, for clients that prefer it.
const renderText = ({ title, body, courseLabel, url }) => [
  courseLabel || null, title || null, title || courseLabel ? "" : null,
  String(body || "").replace(/\r\n/g, "\n").trim(),
  url ? `\nOpen Newton: ${url}` : null,
].filter(v => v !== null).join("\n");

// One message per student, never one message addressed to the whole class: a shared
// `to` array puts every classmate's address in the header of everyone's copy. Resend's
// /emails/batch takes up to 100 separate messages per request, so a normal class is
// still a single API call.
const BATCH_LIMIT = 100;

// `Name <addr>` needs the display name quoted if it carries anything the header
// grammar treats as a separator, or the address is misparsed.
const formatAddress = (name, email) => {
  const n = String(name || "").trim();
  if (!n) return email;
  return /[",;:<>@()\[\]\\]/.test(n)
    ? `"${n.replace(/(["\\])/g, "\\$1")}" <${email}>`
    : `${n} <${email}>`;
};

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad Request", { status: 400 }); }

  const { recipients, subject, body: text, secret, title, courseLabel, postedAt, url } = body;

  if (!secret || secret !== process.env.EMAIL_SEND_SECRET)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  if (!recipients?.length || !subject)
    return new Response(JSON.stringify({ error: "Missing recipients or subject" }), { status: 400, headers: { "Content-Type": "application/json" } });

  // Dedupe by address: with separate sends, a roster listing someone twice would
  // otherwise mail them twice.
  const seen = new Set();
  const addresses = [];
  for (const r of recipients) {
    const email = String(r?.email || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(formatAddress(r?.name, email));
  }
  if (!addresses.length)
    return new Response(JSON.stringify({ error: "No valid recipient addresses" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const opts = { title, body: text, courseLabel, postedAt, url };
  // Same rendered announcement for everyone; only the addressee differs.
  const html = renderEmail(opts), plain = renderText(opts);
  const message = to => ({ from: process.env.EMAIL_FROM_ADDRESS, to: [to], subject, html, text: plain });

  let sent = 0;
  const errors = [];
  for (let i = 0; i < addresses.length; i += BATCH_LIMIT) {
    const batch = addresses.slice(i, i + BATCH_LIMIT);
    let res;
    try {
      res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch.map(message)),
      });
    } catch (e) {
      errors.push(e?.message || String(e));
      continue;
    }
    if (res.ok) sent += batch.length;
    else errors.push(await res.text());
  }

  const failed = addresses.length - sent;
  if (sent === 0)
    return new Response(JSON.stringify({ error: errors[0] || "Send failed", sent, failed }), { status: 502, headers: { "Content-Type": "application/json" } });

  return new Response(JSON.stringify({ sent, ...(failed ? { failed, errors } : {}) }), {
    status: failed ? 207 : 200, headers: { "Content-Type": "application/json" },
  });
};
