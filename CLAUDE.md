# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

- **After completing any planned task:** update `CLAUDE.md` (Key Files table, Commands, etc.) and any relevant `docs/` files to reflect new files, components, or behavioral changes introduced by the task.

## Quick Reference

- **Dev & deploy:** see [docs/environment.md](docs/environment.md)
- **System design, Firebase, auth, Claude API:** see [docs/architecture.md](docs/architecture.md)
- **Inline styles and theme constants:** see [docs/styling.md](docs/styling.md)
- **End-to-end testing, local-dev gotchas:** see [docs/testing.md](docs/testing.md)
- **LMS-style redesign (multi-session plan):** see [docs/lms-redesign.md](docs/lms-redesign.md)
- **Homework — remaining buildout:** see [docs/homework-roadmap.md](docs/homework-roadmap.md)

## Key Patterns

### Theme — `useTheme()` in every component
All components must call `useTheme()` — never import the static `s`, `BG`, `CARD`, etc. constants directly in components (those are App.jsx-only legacy usage):
```js
const { s, text, muted, border, teal, card, bg, isLight } = useTheme();
```
Every screen branch in `App.jsx` is wrapped in `<ThemeContext.Provider value={appTh}>` so all descendants pick up the correct light/dark state.

**Modal inner cards** must override `card`'s semi-transparent light-mode value with:
```js
const solidBg = isLight ? "#fff" : "#252627";
// <div style={{ ...s.card, background: solidBg, ... }}>
```

### Navigation — `screen` state, no router
The entire app is one component (`App.jsx`). Navigation is `setScreen("...")` state. There are no URL routes. Within portals, `studentSection` / `instructorSection` selects the active panel. Selectors in tests must use visible text, not URLs.

### Adding new Firebase per-class state
Every new Firebase node under `classes/{classId}/` requires changes in **three places** in `App.jsx`:
1. **Startup cache restore** (~line 300): `if (c.newThing && ...) setNewThing(c.newThing);`
2. **`loadClassData` Promise.all** (~line 344): add `fbGet(classPath(classId, 'newThing')).catch(() => null),` and destructure + normalize the result
3. **`setClasses` cache call** (~line 436): add `newThing: newThingObj` to keep the in-memory class cache in sync for fast class-switching

Also add the new node name to `database.rules.json` under `$classId`.

**Exception — `hwDrafts` / `hwAttempts`:** student homework drafts (`classes/{classId}/hwDrafts/{studentId}/{hwId}`) and authoritative per-item attempt counts (`classes/{classId}/hwAttempts/{studentId}/{hwId}`) are written and read directly by `HomeworkRunner.jsx` on demand (not loaded into the App.jsx class cache), since they are per-student. `hwAttempts` is the anti-gaming source of truth: written on every submit, seeded into local state unconditionally on mount, and cleared only on final submission (never by leaving/resuming).

**Homework written-work integrity check:** before final submit, students must upload images/PDFs of their handwritten work (proof of original effort). These upload to Storage at `classes/{classId}/hwWork/{studentId}/{hwId}/{file}` and are recorded on the submission as `workFiles[]`; `checkWorkIntegrity` (homework.js) runs a lenient Claude sniff-check and writes `submission.integrity = { flagged, reason, checkedAt, model, error? }`. A flagged submission shows the student **no score — "Pending review"** and is omitted from the overall grade until the instructor opens the submission in the Gradebook and either **clears** the flag (full credit) or **upholds** it (50% penalty). The instructor's decision is stored at `gradeOverrides[studentId][hwId].integrityReview = "cleared"|"upheld"`. Pending/penalty logic flows through the shared `integrityState` / `integrityAdjustedScore` helpers (homework.js), used by both `Gradebook.jsx` and `StudentGrades.jsx`. No new RTDB node — it rides on `submissions` + `gradeOverrides`; only `storage.rules` gains the `hwWork` path.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Top-level component — all state and screens |
| `src/firebase.js` · `auth.js` · `theme.js` · `utils.js` | Extracted helpers (REST, hashing/TOTP, theme + `s` object + `useTheme`/`buildTheme`/`ThemeContext`, dates/parsers/Claude API/`useIsMobile`) |
| `src/courses/` | Per-course content (`physics1.js`, `physics2.js`) — quizzes + modules + homeworks; `homeworksForCourse()` in `index.js`; `HOMEWORKS_PHYSICS1` defines problems (`{ id, prompt, figure?, answerType: numeric\|text\|math, answer, parts? }`) |
| `src/components/lms/` | LMS layout building blocks (Shell, Sidebar, TodoRail, ModuleList) — Shell is fully responsive (hamburger drawer + horizontal todo strip on mobile ≤768px); all use `useTheme()` for dark/light support |
| `src/components/ChatMessages.jsx` | Quiz chat message renderer — uses `useTheme()` for dark/light support; rendered in the quiz screen and Gradebook's `SubViewModal` |
| `src/components/DragDropQuestion.jsx` | Drag-and-drop fill-in-the-blank quiz widget — uses `useTheme()` for dark/light support |
| `src/screens/student/` | Student section pages (Home, StudentCalendar, StudentGrades, CourseEvals, Stub) — all use `useTheme()` for dark/light support |
| `src/screens/student/StudentSyllabus.jsx` | Student syllabus display — renders `syllabus.fields` as cards; `showHeader` prop used by instructor view |
| `src/screens/instructor/Modules.jsx` | Instructor module editor — add/reorder/hide items, custom quiz creation, three-dot menus for page/quiz edit; quiz **and homework** items (`type:"homework"`, `refId:"hwN"`) resolve titles and support due-date editing; uses `useTheme()` for dark/light support |
| `src/screens/instructor/Assignments.jsx` | Instructor assignments hub — view/filter/sort all quizzes **and homeworks**, set due dates, create/edit/delete custom quizzes; homework rows get a "⚙ Settings"/"⚙ Custom" button that opens `HwGradingModal` (6 grading fields stored at `classes/{classId}/homeworkSettings/{hwId}`); uses `useTheme()` for dark/light support |
| `src/screens/instructor/Gradebook.jsx` | Instructor gradebook — weighted categories, per-student scores, CSV export, manual assignments, excuse/unexcuse (restores prior manual score via `previousScore`), per-student deadline extensions; clicking a grade cell opens a 220px right panel (`GradeDetailPanel`) with view-submission, excuse, deadline-extension, and **Clear Submission** (deletes that student's quiz/homework submission to allow a retake — gated by App.jsx's password `confirmDanger` "verification of intent" modal via the `onClearSubmission` prop) actions; `SubViewModal` renders the quiz chat dialogue OR (for `submission.type === "homework"`) a per-problem/per-part breakdown via `HomeworkItemRow` plus a "Submitted written work" section (work-file thumbnails/PDF links, Claude's integrity verdict, and Clear/Uphold flag buttons via `saveIntegrityReview`); flagged-pending homework cells show "Pending" (omitted from overall), resolved-flag cells a red `*` marker, and `GradeDetailPanel` surfaces the flag reason; custom horizontal scrollbar (hidden native, custom thumb scoped to assignment columns only, fades in/out); uses `useTheme()` for dark/light support |
| `src/homework.js` | Homework grading engine — `HW_GRADING_DEFAULTS` (3 free attempts, hint+80% after 3rd wrong, reveal+0% after 5th wrong, ±2% numeric tolerance), `creditForAttempt`, `phaseForAttempt`, `numericMatch`/`parseNumber`/`formatNumericAnswer`, `evaluateHomeworkAnswer` (deterministic numeric + Claude word/math eval via `claude-opus-4-8` + targeted diagnostic hints; reuses the `netlify/functions/claude.js` proxy; throws on grader/empty-response errors so the runner surfaces them without consuming an attempt). Every grade/hint call sends Claude the FULL problem (shared multipart stem + part prompt via `fullPromptFor`) and the figure as an image block (`figureToImageBlock` fetches the same-origin asset → base64, best-effort). Hints obey `HINT_RULES`: the correct answer is passed as CONFIDENTIAL and must never be revealed/stated/contrasted/hand-computed, but method numbers (factors, constants, exponents) are allowed. All engine functions accept a `grading` arg so per-assignment overrides flow through without touching the engine. **Written-work integrity:** `checkWorkIntegrity` (lenient Claude sniff-check of uploaded images/PDFs vs. the problems + answers; returns `{ flagged, reason }`, never throws — grader errors yield `{ flagged:false, error }`), `workFileToBlock` (image→base64 image block via `compressImage`, PDF→document block), and the pure shared helpers `integrityState(sub, ov)` / `integrityAdjustedScore(base, penalized)` + `WORK_INTEGRITY_PENALTY` |
| `src/screens/student/HomeworkRunner.jsx` | MasteringPhysics-style homework runner (`screen === "homework"`) — figure + prompt (`MathText`) + typed input by `answerType` (numeric field, text area, `MathField` for math), hint/reveal, running score; **multipart problems reveal their parts sequentially on the same page** — a part is rendered only once every earlier part is resolved (`status` is `correct`/`revealed`), so the next part surfaces in place without a "Next" click, and each part is headed `Part X of N` (the shared stem + figure render once above the parts); after every submission the deepest visible item is auto-scrolled into view (`revealRef` tags it; a `submitNonce`-keyed effect calls `scrollIntoView` — `submitItem` bumps the nonce once per submit) — this is the newly revealed part when a correct answer unlocks the next one, and otherwise the just-submitted item, so its feedback (correct answer + credit earned) is seen even for a problem's final part, single-part problems, and wrong attempts, none of which reveal a new part and would otherwise leave the result below the footer; a collapsible "How this homework is graded" card (`gradingPolicyLines(G)`, derived from the assignment's grading config so it matches actual scoring) plus a per-item indicator showing the current attempt number, what a correct answer earns now, and attempts left; builds a `{ type:"homework", quizId: hw.id, rawScore, nativeTotal, score(/10), problems:[…], workFiles:[…], integrity }` submission and persists via `saveSubs`; "Finish & Submit" opens a mandatory work-upload step (photos/PDF of handwritten work, `accept="image/*,application/pdf"`) that uploads to `hwWork/...` and runs `checkWorkIntegrity` before saving — flagged results show "Pending instructor review" on the result screen; the grading-policy card carries an upfront notice about this step; accepts `practice` prop — when true, skips the work step + `onFinish`/`saveSubs` and labels the session "Practice"; saves in-progress drafts to `classes/{classId}/hwDrafts/{studentId}/{hwId}` (auto-saves on every submit, saves on leave, clears on final submission, offers a resume modal on re-entry — no "Start fresh") and authoritative attempt counts to `classes/{classId}/hwAttempts/{studentId}/{hwId}` (seeded into local state unconditionally on mount so attempts can't be reset by logging out). **No-lost-work guarantee:** every exit is an intentional app-flow path that preserves the draft — the leave modal saves first (`handleLeaveConfirm`, guard includes typed-but-unsubmitted `answers`), and if the final submit fails the result screen reassures "your work is saved" and offers a "Leave — my work is saved" button (the draft is only cleared on submit success, so the student can return and retry). Shared `draftSnapshot()`/`persistDraft()` helpers back all three save paths. Practice mode intentionally persists nothing (no graded stakes); its leave modal says so plainly. The active-runner root is a fixed `height: 100dvh` flex column (overriding `s.page`'s `minHeight: 100vh`) so the footer nav (Prev/Next/Finish) stays pinned and the body scrolls internally — without this, post-submit feedback pushed the nav below the fold |
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
