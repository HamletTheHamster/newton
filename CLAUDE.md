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
| `src/firebase.js` · `auth.js` · `theme.js` · `utils.js` | Extracted helpers (REST, hashing/TOTP, theme + `s` object + `useTheme`/`buildTheme`/`ThemeContext`, dates/parsers/Claude API/`useIsMobile`) |
| `src/courses/` | Per-course content (`physics1.js`, `physics2.js`) — quizzes + modules |
| `src/components/lms/` | LMS layout building blocks (Shell, Sidebar, TodoRail, ModuleList) — Shell is fully responsive (hamburger drawer + horizontal todo strip on mobile ≤768px); all use `useTheme()` for dark/light support |
| `src/components/ChatMessages.jsx` | Quiz chat message renderer — uses `useTheme()` for dark/light support; rendered in quiz screen, SubViewModal, and inst-sub-detail |
| `src/components/DragDropQuestion.jsx` | Drag-and-drop fill-in-the-blank quiz widget — uses `useTheme()` for dark/light support |
| `src/screens/student/` | Student section pages (Home, StudentCalendar, StudentGrades, CourseEvals, Stub) — all use `useTheme()` for dark/light support |
| `src/screens/student/StudentSyllabus.jsx` | Student syllabus display — renders `syllabus.fields` as cards; `showHeader` prop used by instructor view |
| `src/screens/instructor/Modules.jsx` | Instructor module editor — add/reorder/hide items, custom quiz creation, three-dot menus for page/quiz edit; uses `useTheme()` for dark/light support |
| `src/screens/instructor/Gradebook.jsx` | Instructor gradebook — weighted categories, per-student scores, CSV export, manual assignments, excuse/unexcuse (restores prior manual score via `previousScore`), per-student deadline extensions; clicking a grade cell opens a 220px right panel (`GradeDetailPanel`) with view-submission, excuse, and deadline-extension actions; uses `useTheme()` for dark/light support |
| `src/screens/instructor/InstructorSyllabus.jsx` | Instructor syllabus — upload/replace/remove PDF, mismatch warning, full content via `StudentSyllabus`; uses `useTheme()` for dark/light support |
| `netlify/functions/claude.js` | Claude API proxy |
| `netlify/functions/send-email.js` | Email broadcast proxy — validates shared secret, calls Resend API |
| `src/components/lms/PageEditor.jsx` | Modal for creating/editing pages and custom quizzes — shared via `editorLabel`/`contentLabel` props |
| `src/components/ManualAddStudent.jsx` | Instructor roster manual-add form (name, ID, email) |
| `src/components/lms/AnnouncementEditor.jsx` | Announcement compose modal — title, body, email checkbox |
| `src/components/BugReportModal.jsx` | Bug report submit modal — uses `useTheme()` for dark/light support, `solidBg` card pattern; rendered on login screens, student portal, and student settings |
| `src/components/Footer.jsx` | Fixed bottom footer (copyright, GitHub link, bug report button) — `zIndex: 30` to stay above Shell; rendered on all pre-portal screens and student portal |
| `database.rules.json` | Firebase RTDB security rules |
| `storage.rules` · `firebase.json` | Firebase Storage rules and CLI config (deploy with `firebase deploy --only storage` / `--only database`) |
| `netlify.toml` | Netlify build config |
| `public/favicon.svg` | Browser tab icon — hand-crafted SVG apple (red body, green leaf, brown stem) |

## Commands

```bash
npm run dev      # Vite dev server (port 5173)
netlify dev      # Vite + Netlify Functions (use when testing Claude API proxy)
npm run build    # production build → dist/
```

No tests or linters. Deploy on `git push` via Netlify CI. For manual verification of changes, see [docs/testing.md](docs/testing.md).
