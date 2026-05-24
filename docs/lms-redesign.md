# LMS-Style Redesign — Multi-Session Plan

> **Read this doc first when picking up redesign work.** It captures the full
> vision and per-phase scope so we don't re-derive context every session.

## Context

Newton was originally a quiz-only portal. The redesign expands it into a full
course site with a familiar LMS layout (left sidebar nav, collapsible weekly
modules in the middle, To Do rail on the right). The dark/teal aesthetic is
unchanged.

This is intentionally a multi-session project. Phase 1 (complete) laid down the
shell. Subsequent phases add real content under each sidebar section.

## Vision / end state

**Student portal** — LMS-style:
- **Left sidebar**: Home · Calendar · Syllabus · Announcements · Grades · Course Evals
- **Main pane**: topic-titled, collapsible modules (e.g. "Lecture 7 | Potential
  Energy"). Each module contains, in fixed order: Quiz → Assigned Reading →
  Lecture Notes → Homework. Plus a **Collapse All / Expand All** button.
- **Right rail**: "To Do" — uncompleted assignments due in the next 7 days.
- **Module gating**: each module has an instructor-set release date/time;
  students see modules locked until then.

**Instructor portal** — same shell pattern but with instructor sections:
Submissions, Quizzes & Dates, Roster, Modules (Phase 2), Announcements
(Phase 4), Grades (Phase 6), Settings, Bug Reports. Instructor can author
per-module: text page, file upload, external link, plus the standard
quiz/homework.

**Course content** (modules + their quizzes/homework) is **code-defined per
course** (`physics1`, `physics2`, …) under `src/courses/`. Per-class
instructor additions (custom pages, files, links, dates, grade overrides) live
in RTDB under `classes/{classId}/`.

## File layout (after Phase 2)

```
src/
  App.jsx                        — top-level: state, screen routing, FB load, all screens
  main.jsx                       — Vite entry (imports App.jsx)
  firebase.js                    — App Check, anon auth, fbGet/fbSet/fbConnectTest, classPath
  auth.js                        — hashPw/verifyPw/makeHash + TOTP helpers + device tokens
  theme.js                       — BG/CARD/TEAL/TEAL_DIM/MUTED/BORDER + `s` style object
  utils.js                       — dueToDate/isLate/fmtDate/ptsPer/fmtDueTime/detectParts/
                                   compressImage/checkImageReadability/evaluateAnswer/
                                   parseRoster/parseGradesCSV
  courses/
    index.js                     — COURSE_LABELS, COURSE_OPTIONS, quizzes/modulesForCourse()
    merge.js                     — buildModules(courseModules, moduleConfig, pages) merger
    physics1.js                  — QUIZZES_PHYSICS1 + MODULES_PHYSICS1 + (Phase 3) HOMEWORKS_PHYSICS1
    physics2.js                  — stubs
  components/
    SyncBadge.jsx                — instructor header sync indicator
    ChatMessages.jsx             — quiz chat message list
    DragDropQuestion.jsx         — drag-drop quiz question
    ManualAddStudent.jsx         — roster add form
    BugReportModal.jsx           — student bug report dialog
    Footer.jsx                   — student footer (© + octocat + bug button)
    lms/
      Shell.jsx                  — three-pane layout (header + sidebar + main + rightRail)
      Sidebar.jsx                — left vertical nav (generic items)
      TodoRail.jsx               — right rail To Do widget
      ModuleList.jsx             — collapsible module list + Collapse/Expand All + lock gate
      ModuleRow.jsx              — one module (header + items when expanded; hard-lock state)
      ModuleItem.jsx             — one item row (quiz/reading/notes/homework/page/file/link)
      PageEditor.jsx             — instructor modal: title + textarea for authoring pages
      PageViewer.jsx             — student modal: read-only page rendering (pre-wrap text)
  screens/student/
    Home.jsx                     — student Home landing (module list, dispatches by type)
    Stub.jsx                     — generic "Coming Soon" placeholder for Calendar/etc.
  screens/instructor/
    Modules.jsx                  — instructor module authoring screen (release dates,
                                   visibility, URL overrides, custom pages/links)
```

All screens currently live inline in `App.jsx`. Top-level state stays there;
each screen renders props/closures from that state. The split philosophy
matches today's: small reusable building blocks in their own files, screens
co-located with state.

## Module data shape

In `src/courses/physics1.js`:

```js
const M = (n, topic) => ({
  id: `m${n}`,
  title: `Lecture ${n} | ${topic}`,
  items: [
    { type: "quiz",    refId: `q${n}` },              // → QUIZZES_PHYSICS1
    { type: "reading", title: `Assigned Reading: Ch. ${n} — ${topic}`, url: null },
    { type: "notes",   title: `Lecture ${n} Notes — ${topic}`, url: null },
    { type: "homework",refId: `hw${n}` },             // (Phase 3) → HOMEWORKS_PHYSICS1
  ],
});
export const MODULES_PHYSICS1 = [ M(1, "Course Access & Logistics"), ... ];
```

Item types: `quiz` and (Phase 3) `homework` reference data in the course file
by `refId`. `reading`, `notes`, `page`, `file`, `link` carry their own
`title` and `url`/`content`. The renderer (`ModuleItem.jsx`) handles each
type. Currently only `quiz` is wired; the others render as "Coming soon".

## Future per-class subtrees (added in later phases)

```
classes/{classId}/
  moduleConfig/             — { [moduleId]: { releaseDate, customItems[], hiddenItems[] } }
  pages/                    — instructor-authored text pages
  uploads/                  — file refs (Firebase Storage path or external URL)
  announcements/            — broadcast posts
  announcementReads/        — { [studentId]: { [annId]: true } }
  homeworks/                — student homework submissions (mirrors submissions/)
  gradeCategories/          — { id: { name, weight, type:'auto'|'manual' } }
  gradeOverrides/           — { studentId: { assignmentId: { score, notes } } }
  syllabus/                 — visual syllabus content (markdown blocks)
```

`database.rules.json` will gain matching child entries as features land.

## Phases

| Phase | Status | Scope |
|---|---|---|
| **1** | ✅ done | File split + LMS shell + sidebar nav + collapsible modules + To Do + working quizzes inside modules. Other sidebar pages are stubs; non-quiz item types show "Coming soon". |
| **2** | ✅ done | **Instructor module authoring**. Per-module release dates with hard lock; instructor-authored text pages; external links; URL overrides on course-defined reading/notes; per-item visibility toggles; file uploads to Firebase Storage with progress bar and download access for students. RTDB subtrees: `moduleConfig/`, `pages/`, `uploads/`. Storage path: `classes/{classId}/uploads/{uploadId}/{filename}`. |
| **3** | — | **Homework engine**: define HW data shape per course (problems with parts, point values, attempt limits). Student submission UI mirroring the quiz chat. Claude 4.7 light-hint feedback on wrong answers via `evaluateAnswer` pattern. Score persistence under `homeworks/`. |
| **4** | — | **Announcements**: instructor compose UI; broadcast list page; unread popup modal on student login; per-student read tracking. Email broadcast deferred to Phase 9. |
| **5** | — | **Calendar**: month grid showing assignment due dates color-coded by category. |
| **6** | — | **Grades**: instructor-defined weighted categories; per-student gradebook with auto-pull from submissions; manual edit/override; weighted total. |
| **7** | — | **Syllabus** visual page (markdown-driven) + PDF link. |
| **8** | — | **Course Evals** (likely an external link initially). |
| **9** | — | **Email broadcast** for announcements once roster includes emails. |

## Notes for future sessions

- **Roster gap**: `parseRoster` doesn't capture student email. Phase 9 needs:
  (a) extend `parseRoster` to detect an email column, (b) update the MyMercer
  CSV upload UX, (c) decide on broadcast mechanism (server-side function vs
  Gmail link).
- **Firebase Storage (Phase 2, done)**: Files live in
  `gs://newton-93d05.firebasestorage.app` under
  `classes/{classId}/uploads/{uploadId}/{filename}`. Rules live in
  `storage.rules` at the repo root and are deployed manually via
  `firebase deploy --only storage`. The bucket name is hardcoded as
  `STORAGE_BUCKET` in `src/firebase.js`. Upload size cap is 25 MB,
  enforced both client-side (in `Modules.jsx`) and server-side (in the
  rules). REST helpers: `fbUpload(storagePath, file, onProgress)` and
  `fbDeleteStorage(storagePath)`. Deletes cascade — removing a `file`
  custom item from a module deletes both the `uploads/{id}` RTDB node
  and the underlying storage object.
- **Module availability**: when adding release-date gating, use existing
  `dueToDate` for timezone consistency (ET). Students see locked modules
  collapsed and dimmed with an "Unlocks {date}" badge.
- **Practice mode invariant**: `startQuiz(quiz, isPractice)` already supports
  practice runs for completed quizzes. Phase 1 preserves this by passing
  `completedQuizIds.has(q.id)` as the practice flag when starting from the
  module item.
- **Per-class state hydration**: `loadClassData(classId)` loads the existing
  per-class subtrees. Any new `classes/{classId}/...` subtree added in later
  phases should be loaded there too.
- **Inline styles only**: every new component continues to use `theme.js`
  constants and the `s` object. No CSS files, no Tailwind.
- **All screens live in `App.jsx`**: until that file becomes painful, leave it
  alone — screens need too much top-level state to extract cleanly without
  Context. Reusable building blocks (Shell, Sidebar, ModuleList, ChatMessages)
  are already in their own files.

## Verification (any phase)

End-to-end smoke test via `netlify dev`:
1. Log in as student → land on Home → modules expand/collapse, Collapse All
   toggles all, To Do shows expected quizzes.
2. Click a quiz in a module → completes the existing quiz flow → returns to
   the portal with the item marked done.
3. Log in as instructor → sidebar nav switches between Submissions / Quizzes &
   Dates / Roster / Settings / Bug Reports → all existing functionality works
   (subs list, due-date edit, roster upload, class switcher, danger zone).
4. Multi-class switch from instructor dropdown still hydrates per-class state.
