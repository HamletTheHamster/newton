# Environment & Configuration

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_FIREBASE_API_KEY` | `.env` locally; Netlify dashboard in prod | Firebase project access |
| `ANTHROPIC_API_KEY` | Netlify dashboard only (never client-side) | Claude API, used by `netlify/functions/claude.js` |

## Dev Servers

- `npm run dev` — Vite only (port 5173); use when not touching Netlify Functions
- `netlify dev` — Vite + Netlify Functions; required when testing the Claude API proxy at `/.netlify/functions/claude`

See `package.json` for all npm scripts and `netlify.toml` for Netlify build config.

## Deploy

Push to `main` → Netlify CI builds and deploys automatically. No manual deploy step needed.
