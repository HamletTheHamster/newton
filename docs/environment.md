# Environment & Configuration

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_FIREBASE_API_KEY` | `.env.local` locally; Netlify dashboard in prod | Firebase project access |
| `ANTHROPIC_API_KEY` | Netlify dashboard only (never client-side) | Claude API, used by `netlify/functions/claude.js` |
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
