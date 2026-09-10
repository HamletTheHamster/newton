// Emailed instructor password reset.
//
// WHY THIS IS STATELESS. Netlify Functions here have no Firebase credential: every RTDB write
// in this app comes from a signed-in browser (App Check attestation is a browser thing), which
// is the same reason the deadline sweep is lazy rather than a cron. So there is nowhere on the
// server to park a pending reset, and parking it in RTDB would put the pending code in the one
// place the person resetting can already read.
//
// Instead the code is never stored anywhere. `request` mints a random code, emails it to the
// instructor, and hands the browser a CHALLENGE: the expiry plus an HMAC of the code and that
// expiry under a server-only secret. `verify` recomputes the HMAC over the code the instructor
// typed. A challenge is therefore self-describing and tamper-evident, and the server remembers
// nothing between the two calls. The code is 8 characters of a 31-character alphabet (~8.5e11
// combinations) precisely because a stateless endpoint cannot count failed attempts: guessing
// has to be hopeless rather than merely rate-limited.
//
// ── FLAG: what this is NOT ────────────────────────────────────────────────────────────────────
// `verify` is ADVISORY. It tells the browser the code was right; the browser then writes the new
// password hash itself, because `database.rules.json` lets any App Check'd anonymous client
// write `settings`. Anyone who can reach the app can already write that node directly, so this
// endpoint adds a real gate for a person who forgot the password and adds nothing against an
// attacker who reads the bundle. It is honest protection at exactly the strength the rest of the
// app has, and no more.
//
// BEFORE A SECOND INSTRUCTOR EXISTS, this has to become: rules that deny client writes to
// `settings`, a service-account (or database-secret) credential in Netlify env, and this
// function performing the password write itself after verifying the code. That change also
// makes `INSTRUCTOR_EMAIL` below per-instructor rather than a constant, and gives the endpoint
// somewhere to record attempts so the code can be short and rate-limited instead of long.
// See docs/architecture.md § Instructor password recovery.

import crypto from "node:crypto";

// The single instructor. Server-side ON PURPOSE: the client never says where the code goes, so
// nobody standing at the public login can redirect a reset to their own inbox. Env var wins so
// the address is not hard-wired into a deploy.
const INSTRUCTOR_EMAIL = process.env.INSTRUCTOR_EMAIL || "joel.johnson675@gmail.com";

const CODE_TTL_MS = 15 * 60 * 1000;
// No 0/O/1/I/L: the code gets copied off a phone screen by hand.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

const mintCode = () => {
  // rejection-free: 31 does not divide 256, so draw a byte per character and retry the tail
  // values that would bias the alphabet.
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.randomBytes(CODE_LENGTH)) {
      if (b >= 248) continue; // 248 = 31 * 8, the largest unbiased multiple
      out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
};

// What the instructor types is compared against what was minted, so both sides normalize the
// same way: case and the display hyphen carry no meaning.
const normalizeCode = raw => String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

const sign = (secret, code, expires) => crypto
  .createHmac("sha256", secret).update(`${code}.${expires}`).digest("hex");

const sameMac = (a, b) => {
  const ba = Buffer.from(String(a), "utf8"), bb = Buffer.from(String(b), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// "joel.johnson675@gmail.com" -> "jo…75@gmail.com". Enough for the instructor to recognize
// their own address, not enough to hand a stranger at the login a new one to go phishing.
const maskEmail = addr => {
  const [user, domain] = String(addr).split("@");
  if (!domain) return "the instructor address";
  const head = user.slice(0, 2), tail = user.length > 4 ? user.slice(-2) : "";
  return `${head}…${tail}@${domain}`;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const PAGE = "#F4F0EB", CARD = "#ffffff", TEXT = "#1c1d1f", MUTED = "#6b6b6f", BORDER = "#e2ddd6", TEAL = "#00828c";

const renderEmail = (code, minutes) => `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Instructor password reset</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">

  <tr><td style="padding:0 4px 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${TEAL};">
    Newton
  </td></tr>

  <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:24px 26px;font-family:${FONT};">
    <h1 style="margin:0 0 12px;color:${TEXT};font-size:19px;line-height:26px;font-weight:700;">Instructor password reset</h1>
    <p style="margin:0;color:${TEXT};font-size:15px;line-height:24px;">Enter this code in the browser tab where you asked to reset the instructor password:</p>
    <p style="margin:18px 0;text-align:center;">
      <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:.14em;font-weight:700;color:${TEXT};background:${PAGE};border:1px solid ${BORDER};border-radius:12px;padding:14px 22px;">${code}</span>
    </p>
    <p style="margin:0;color:${MUTED};font-size:13px;line-height:20px;">The code works once, in that tab, for ${minutes} minutes. If you did not ask for this, ignore this email: nothing has changed, and the code alone cannot open the portal if two-factor authentication is on.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

const renderText = (code, minutes) => [
  "Newton: instructor password reset",
  "",
  `Code: ${code}`,
  "",
  `Enter it in the browser tab where you asked to reset the password. It works once, in that tab, for ${minutes} minutes.`,
  "If you did not ask for this, ignore this email. Nothing has changed.",
].join("\n");

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const { action, secret, code, challenge } = body;

  // The same shared secret the announcement mailer uses. It ships in the client bundle, so it
  // stops a scanner finding the endpoint and mailing the instructor in a loop; it is not, and is
  // not treated as, authentication.
  if (!secret || secret !== process.env.EMAIL_SEND_SECRET) return json({ error: "Unauthorized" }, 401);

  // Fails CLOSED, and deliberately has no default: a fallback secret committed here would be a
  // published signing key, which is the same mistake as a published password.
  const signingSecret = process.env.INSTRUCTOR_RESET_SECRET;
  if (!signingSecret) return json({ error: "Password reset is not configured on this deploy (INSTRUCTOR_RESET_SECRET is unset)." }, 500);

  if (action === "request") {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_ADDRESS)
      return json({ error: "Email is not configured on this deploy." }, 500);

    const newCode = mintCode();
    const expires = Date.now() + CODE_TTL_MS;
    const minutes = Math.round(CODE_TTL_MS / 60000);

    let res;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM_ADDRESS,
          to: [INSTRUCTOR_EMAIL],
          subject: "Newton instructor password reset code",
          html: renderEmail(newCode, minutes),
          text: renderText(newCode, minutes),
        }),
      });
    } catch (e) {
      return json({ error: `Could not send the email: ${e?.message || String(e)}` }, 502);
    }
    // The challenge is only handed back once the mail is away, so a browser can never sit on a
    // challenge for a code that was never delivered.
    if (!res.ok) return json({ error: `Could not send the email: ${await res.text()}` }, 502);

    return json({
      challenge: `${expires}.${sign(signingSecret, newCode, expires)}`,
      sentTo: maskEmail(INSTRUCTOR_EMAIL),
      expiresAt: expires,
      minutes,
    });
  }

  if (action === "verify") {
    const typed = normalizeCode(code);
    if (typed.length !== CODE_LENGTH) return json({ error: "That code is not the right length." }, 400);

    const [expiresRaw, mac] = String(challenge || "").split(".");
    const expires = Number(expiresRaw);
    if (!Number.isFinite(expires) || !mac) return json({ error: "Start the reset again: this browser has no pending code." }, 400);
    if (Date.now() > expires) return json({ error: "That code has expired. Send a new one." }, 400);

    if (!sameMac(mac, sign(signingSecret, typed, expires))) return json({ error: "That code is not right." }, 401);

    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};
