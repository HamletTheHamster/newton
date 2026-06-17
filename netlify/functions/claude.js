export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.text();

  // Use CLAUDE_API_KEY (set in .env.local for local dev and in the Netlify dashboard for
  // production). We deliberately do NOT use ANTHROPIC_API_KEY because the Netlify Anthropic
  // extension overrides that name with a rotating gateway JWT that isn't a valid x-api-key.
  const key = process.env.CLAUDE_API_KEY || "";

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body,
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
};
