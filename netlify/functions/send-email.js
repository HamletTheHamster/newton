export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad Request", { status: 400 }); }

  const { recipients, subject, body: text, secret } = body;

  if (!secret || secret !== process.env.EMAIL_SEND_SECRET)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  if (!recipients?.length || !subject)
    return new Response(JSON.stringify({ error: "Missing recipients or subject" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const to = recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email);
  const html = `<pre style="font-family:inherit;white-space:pre-wrap;word-wrap:break-word">${text || ""}</pre>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ sent: recipients.length }), { status: 200, headers: { "Content-Type": "application/json" } });
};

