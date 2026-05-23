# CLAUDE.md

## Quick Reference

- **Dev & deploy:** see [docs/environment.md](docs/environment.md)
- **System design, Firebase, auth, Claude API:** see [docs/architecture.md](docs/architecture.md)
- **Inline styles and theme constants:** see [docs/styling.md](docs/styling.md)
- **End-to-end testing, local-dev gotchas:** see [docs/testing.md](docs/testing.md)

## Key Files

| File | Purpose |
|------|---------|
| `src/newton.jsx` | Entire application (~1250 lines, single component) |
| `netlify/functions/claude.js` | Claude API proxy |
| `database.rules.json` | Firebase RTDB security rules |
| `netlify.toml` | Netlify build config |

## Commands

```bash
npm run dev      # Vite dev server (port 5173)
netlify dev      # Vite + Netlify Functions (use when testing Claude API proxy)
npm run build    # production build → dist/
```

No tests or linters. Deploy on `git push` via Netlify CI. For manual verification of changes, see [docs/testing.md](docs/testing.md).
