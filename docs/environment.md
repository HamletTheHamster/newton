# Environment & Configuration

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_FIREBASE_API_KEY` | `.env.local` locally; Netlify dashboard in prod | Firebase project access |
| `VITE_FIREBASE_DEBUG_TOKEN` | `.env.local` only (never Netlify) | Firebase App Check debug token for local dev — must also be registered in the Firebase console under App Check → your web app → Manage debug tokens; without it the app shows "Cannot Reach Database" and will not load |
| `CLAUDE_API_KEY` | `.env.local` locally; Netlify dashboard in prod | Anthropic `sk-ant-…` key used by `netlify/functions/claude.js` (quiz + homework grading). **Do not name it `ANTHROPIC_API_KEY`** — the Netlify Anthropic extension hijacks that name with a rotating gateway JWT that 401s against `api.anthropic.com`. The proxy intentionally reads `CLAUDE_API_KEY` to avoid the collision. |
| `RESEND_API_KEY` | `.env.local` locally; Netlify dashboard in prod | Resend email API key, used by `netlify/functions/send-email.js` |
| `EMAIL_FROM_ADDRESS` | `.env.local` locally; Netlify dashboard in prod | Sender address, e.g. `Newton Physics <noreply@notifications.newtonphy.com>` |
| `EMAIL_SEND_SECRET` | `.env.local` locally; Netlify dashboard in prod | Shared secret gating the send-email function (server-side) |
| `VITE_EMAIL_SEND_SECRET` | `.env.local` locally; Netlify dashboard in prod | Same value as `EMAIL_SEND_SECRET` — embedded in client bundle at build time |

## Dev Servers

- `npm run dev` — Vite only (port 5173); use when not touching Netlify Functions
- `netlify dev` — Vite + Netlify Functions; required when testing `/.netlify/functions/claude` (Claude API proxy) or `/.netlify/functions/send-email` (email broadcast)

See `package.json` for all npm scripts and `netlify.toml` for Netlify build config.

## Deploy

Push to `main` → Netlify CI builds and deploys automatically. No manual deploy step needed.
