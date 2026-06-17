# CLAUDE.md

## Workflow Rules

- **After completing any planned task:** update `CLAUDE.md` (Key Files table, Commands, etc.) and any relevant `docs/` files to reflect new files, components, or behavioral changes introduced by the task.

## Quick Reference

- **Dev & deploy:** see [docs/environment.md](docs/environment.md)
- **System design, Firebase, auth, Claude API:** see [docs/architecture.md](docs/architecture.md)
- **Inline styles and theme constants:** see [docs/styling.md](docs/styling.md)
- **End-to-end testing, local-dev gotchas:** see [docs/testing.md](docs/testing.md)
- **LMS-style redesign (multi-session plan):** see [docs/lms-redesign.md](docs/lms-redesign.md)
- **Homework — remaining buildout (incl. practice-only retakes):** see [docs/homework-roadmap.md](docs/homework-roadmap.md)

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Top-level component — all state and screens |
| `src/firebase.js` · `auth.js` · `theme.js` · `utils.js` | Extracted helpers (REST, hashing/TOTP, theme + `s` object + `useTheme`/`buildTheme`/`ThemeContext`, dates/parsers/Claude API/`useIsMobile`) |
| `src/courses/` | Per-course content (`physics1.js`, `physics2.js`) — quizzes + modules + homeworks; `homeworksForCourse()` in `index.js`; `HOMEWORKS_PHYSICS1` defines problems (`{ id, prompt, figure?, answerType: numeric\|text\|math, answer, parts? }`) |
| `src/components/lms/` | LMS layout building blocks (Shell, Sidebar, TodoRail, ModuleList) — Shell is fully responsive (hamburger drawer + horizontal todo strip on mobile ≤768px); all use `useTheme()` for dark/light support |
| `src/components/ChatMessages.jsx` | Quiz chat message renderer — uses `useTheme()` for dark/light support; rendered in quiz screen, SubViewModal, and inst-sub-detail |
| `src/components/DragDropQuestion.jsx` | Drag-and-drop fill-in-the-blank quiz widget — uses `useTheme()` for dark/light support |
| `src/screens/student/` | Student section pages (Home, StudentCalendar, StudentGrades, CourseEvals, Stub) — all use `useTheme()` for dark/light support |
| `src/screens/student/StudentSyllabus.jsx` | Student syllabus display — renders `syllabus.fields` as cards; `showHeader` prop used by instructor view |
| `src/screens/instructor/Modules.jsx` | Instructor module editor — add/reorder/hide items, custom quiz creation, three-dot menus for page/quiz edit; quiz **and homework** items (`type:"homework"`, `refId:"hwN"`) resolve titles and support due-date editing; uses `useTheme()` for dark/light support |
| `src/screens/instructor/Assignments.jsx` | Instructor assignments hub — view/filter/sort all quizzes **and homeworks**, set due dates, create/edit/delete custom quizzes; filter bar matches Gradebook aesthetic (`s.badge`, color-coded type buttons incl. Homework, `{ numeric: true }` natural sort); baked-in quizzes and code-defined homeworks support due-date edits only |
| `src/screens/instructor/Gradebook.jsx` | Instructor gradebook — weighted categories, per-student scores, CSV export, manual assignments, excuse/unexcuse (restores prior manual score via `previousScore`), per-student deadline extensions; clicking a grade cell opens a 220px right panel (`GradeDetailPanel`) with view-submission, excuse, and deadline-extension actions; `SubViewModal` renders the quiz chat dialogue OR (for `submission.type === "homework"`) a per-problem/per-part breakdown via `HomeworkItemRow`; custom horizontal scrollbar (hidden native, custom thumb scoped to assignment columns only, fades in/out); uses `useTheme()` for dark/light support |
| `src/homework.js` | Homework grading engine — `HW_GRADING_DEFAULTS` (3 free attempts, hint+80% after 3rd wrong, reveal+50% after 5th wrong, ±2% numeric tolerance), `creditForAttempt`, `phaseForAttempt`, `numericMatch`/`parseNumber`/`formatNumericAnswer`, `evaluateHomeworkAnswer` (deterministic numeric + Claude word/math eval via `claude-opus-4-8` + targeted diagnostic hints; reuses the `netlify/functions/claude.js` proxy; throws on grader/empty-response errors so the runner surfaces them without consuming an attempt) |
| `src/screens/student/HomeworkRunner.jsx` | MasteringPhysics-style homework runner (`screen === "homework"`) — figure + prompt (`MathText`) + typed input by `answerType` (numeric field, text area, `MathField` for math), attempts-left, hint/reveal, running score; builds a `{ type:"homework", quizId: hw.id, rawScore, nativeTotal, score(/10), problems:[…] }` submission and persists via `saveSubs` |
| `src/components/MathField.jsx` · `MathText.jsx` | `MathField` = controlled MathLive `<math-field>` LaTeX editor (lazy-loaded); `MathText` = KaTeX renderer for `$…$`/`\(…\)`/`\[…\]` in prompts and answer reveals |
| `src/screens/instructor/InstructorSyllabus.jsx` | Instructor syllabus — upload/replace/remove PDF, mismatch warning, full content via `StudentSyllabus`; uses `useTheme()` for dark/light support |
| `netlify/functions/claude.js` | Claude API proxy — reads `CLAUDE_API_KEY` (NOT `ANTHROPIC_API_KEY`, which the Netlify Anthropic extension overrides with a rotating gateway JWT); see [docs/environment.md](docs/environment.md) |
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

Runtime deps beyond React: `qrcode`, `mathlive` (homework math/LaTeX input, lazy-loaded), `katex` (math rendering — its CSS is imported in `src/main.jsx`).
