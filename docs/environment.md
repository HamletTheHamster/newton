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

**Firebase rules are NOT part of that.** `database.rules.json` and `storage.rules` ship only via
`firebase deploy --only database` / `--only storage`. A push that depends on a rules change is
half a deploy until the rules go up separately.

**Pick the day.** Homework is due Monday nights, so students have tabs open and are mid-assignment
then. Avoid deploying Mondays, and prefer a morning earlier in the week. From the commit that added
`StaleBuildNotice` onward this matters more than it used to: a deploy now ends with every open
session blocked on a reload prompt the next time it is focused (nothing is lost, drafts autosave,
but it interrupts). The notice only exists in bundles built after it landed, so the first deploy
carrying it cannot interrupt anyone; every deploy after it can.

### Pending: stale-client protection (committed 2026-10-05, NOT deployed)

Three layers that stop a stale bundle destroying submission records, written up in
[architecture.md](architecture.md) § *Stale clients*. Held back deliberately to avoid an active
homework day. To finish the deploy:

1. `firebase deploy --only database` — ships the `submissions` key rule. **This is the layer that
   actually does the work**, and it is the one a git push does not carry.
2. `node scripts/verify-submissions-rule.mjs` — verifies the rule before students rely on it,
   since it was never testable locally (the RTDB emulator needs Java, which is not installed). It
   writes only to `submissions/_ruletest`, a studentId no roster entry matches, and deletes it
   afterwards: it confirms id-keyed writes are allowed, the whole-array PUT is refused, records
   survive the refusal, and deletion still works. A failure here blocks hand-ins outright, so
   revert the rules rather than leaving it.
3. `git push` — ships the version gate and the cache headers.

Order is safe either way: a tab running current code writes id-keyed already, so the rule does not
reject anything a present-day session does.
