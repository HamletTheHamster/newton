# CLAUDE.md

## Quick Reference

- **Dev & deploy:** see [docs/environment.md](docs/environment.md)
- **System design, Firebase, auth, Claude API:** see [docs/architecture.md](docs/architecture.md)
- **Inline styles and theme constants:** see [docs/styling.md](docs/styling.md)
- **End-to-end testing, local-dev gotchas:** see [docs/testing.md](docs/testing.md)
- **LMS-style redesign (multi-session plan):** see [docs/lms-redesign.md](docs/lms-redesign.md)

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Top-level component — all state and screens |
| `src/firebase.js` · `auth.js` · `theme.js` · `utils.js` | Extracted helpers (REST, hashing/TOTP, theme + `s` object, dates/parsers/Claude API) |
| `src/courses/` | Per-course content (`physics1.js`, `physics2.js`) — quizzes + modules |
| `src/components/lms/` | LMS layout building blocks (Shell, Sidebar, TodoRail, ModuleList) |
| `src/screens/student/` | Student section pages (Home, StudentCalendar, StudentGrades, Stub) |
| `src/screens/instructor/Gradebook.jsx` | Instructor gradebook — weighted categories, per-student scores, CSV export, manual assignments |
| `netlify/functions/claude.js` | Claude API proxy |
| `database.rules.json` | Firebase RTDB security rules |
| `storage.rules` · `firebase.json` | Firebase Storage rules and CLI config (deploy with `firebase deploy --only storage` / `--only database`) |
| `netlify.toml` | Netlify build config |

## Commands

```bash
npm run dev      # Vite dev server (port 5173)
netlify dev      # Vite + Netlify Functions (use when testing Claude API proxy)
npm run build    # production build → dist/
```

No tests or linters. Deploy on `git push` via Netlify CI. For manual verification of changes, see [docs/testing.md](docs/testing.md).
