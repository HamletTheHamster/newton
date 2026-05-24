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
Home (module authoring, section id `"modules"`), Submissions, Quizzes & Dates,
Roster, Announcements, Gradebook, Settings, Bug Reports. Instructor can author
per-module: text page, file upload, external link, plus the standard quiz.
Reading/Notes item types have been removed from the add-item UI; legacy items
of those types still render as files.

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
    index.js                     — COURSE_LABELS, COURSE_OPTIONS, quizzes/modulesForCourse(), defaultModulesForCourse()
    ids.js                       — newId(prefix) for modules/items/pages/uploads
    merge.js                     — buildModules(modulesArr, moduleConfig, pages, uploads)
    migrate.js                   — migrateLegacyModuleConfig(template, legacyConfig) — seed + legacy fold-in
    physics1.js                  — QUIZZES_PHYSICS1 + MODULES_PHYSICS1 (seed template) + (Phase 3) HOMEWORKS_PHYSICS1
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
    StudentCalendar.jsx          — month grid calendar; events from quizzes+dueDates
    StudentGrades.jsx            — student Grades view: overall grade banner + category breakdown
    CourseEvals.jsx              — student Course Evals: quick feedback (always open) + end-of-course survey (gated on last module release)
    Stub.jsx                     — generic "Coming Soon" placeholder (Syllabus only; Evals now has a real screen)
  screens/instructor/
    Modules.jsx                  — instructor Home tab: module authoring (module ⋮ menu: inline
                                   calendar, add-item, delete; item ⋮ menu: due date, visibility,
                                   delete; full-div drag/drop with correct gap targeting; animated
                                   drop gaps own their onDragOver so jitter is eliminated; release
                                   dates; file uploads)
    Gradebook.jsx                — instructor Gradebook: weighted categories, per-student score
                                   entry (EX support), manual assignments, CSV export, assignment
                                   title overrides, column drag/drop reordering, filter bar
                                   (student/category/assignment)
```

All screens currently live inline in `App.jsx`. Top-level state stays there;
each screen renders props/closures from that state. The split philosophy
matches today's: small reusable building blocks in their own files, screens
co-located with state.

## Module data shape

Modules live **per class** in RTDB at `classes/{classId}/modules` as an ordered
array. The code-defined `MODULES_PHYSICS1` is a seed template only — used by
`createClass` and the legacy-migration helper.

```
classes/{classId}/modules:
[
  {
    id: "m_<rand>",
    title: "Lecture 1 | Course Access & Logistics",
    items: [
      { id: "it_<rand>", type: "quiz",     refId: "q1" },
      { id: "it_<rand>", type: "reading",  title: "Ch. 1", url: "https://…" | null },
      { id: "it_<rand>", type: "notes",    title: "Notes 1", url: null },
      { id: "it_<rand>", type: "homework", refId: "hw1" },
      { id: "it_<rand>", type: "page",     pageId: "p_<rand>", title: "Lab Handout" },
      { id: "it_<rand>", type: "link",     url: "https://…", title: "Khan Academy" },
      { id: "it_<rand>", type: "file",     uploadId: "u_<rand>", title: "Slides" }
    ]
  },
  ...
]
```

Every item has a stable `id`. The renderer (`src/components/lms/ModuleItem.jsx`)
dispatches on `type`. `quiz` and `homework` reference data in the course code
by `refId`. `reading`, `notes`, `link`, `page`, `file` carry their own
title/URL/refs. Custom item edits (rename/reorder/delete) go through
`src/screens/instructor/Modules.jsx` and write the whole `modules` array via
`saveModules` in `App.jsx`.

The seed template lives in `src/courses/physics1.js` (and `physics2.js`).
On class creation, `createClass` clones the template and assigns fresh item
IDs via `newId("it")` from `src/courses/ids.js`. On first load of an existing
class with no `modules` array, `loadClassData` runs the migration helper
`migrateLegacyModuleConfig` in `src/courses/migrate.js`, which folds legacy
`itemOverrides` onto items, appends legacy `customItems`, and re-keys
`hiddenItems` from positional `course:<i>` keys to the new item IDs.

## Per-class RTDB subtrees

```
classes/{classId}/
  metadata/                 — { name, courseType, active, createdAt }
  roster/                   — array of student objects
  studentPws/               — { [studentId]: { hash, salt } }
  submissions/              — { [studentId]: [submission, …] }
  checkedSubs/              — { [submissionId]: true }
  dueDates/                 — { [quizId]: "YYYY-MM-DD HH:mm" }
  modules/                  — ordered array of { id, title, items: [...] }
  moduleConfig/             — { [moduleId]: { releaseDate?, hiddenItems: { [itemId]: true } } }
  pages/                    — { [pageId]: { title, body, createdAt } }
  uploads/                  — { [uploadId]: { name, size, mime, storagePath, downloadUrl, createdAt } }
  announcements/            — { [annId]: { id, title, body, createdAt } }
  announcementReads/        — { [studentId]: { [annId]: true } }  ← orphaned (notification feature removed in 6.9)
  gradeCategories/          — { [catId]: { id, name, weight, order } }
  gradeOverrides/           — { [studentId]: { [assignmentId]: { score?, excused? } } }
  manualAssignments/        — { [id]: { id, title, catId, maxPts, order } }  — seeded on first load with Midterm, Final, Lab 1a–14b
  assignmentNameOverrides/  — { [assignmentId]: overrideTitle }
  assignmentOrderOverrides/ — { [assignmentId]: number }  — set by column drag/drop; overrides natural sort order
  homeworks/                — (future) student homework submissions
  syllabus/                 — (future) visual syllabus content

courseEvals/              — root-level (not per-class); anonymous submissions
  {id}/                   — { id, type: "quick"|"survey", classId, timestamp, read: bool,
                             message? (quick), responses?: {q1–q7: "SA"|"A"|"D"|"SD"},
                             openEnded?: {suggestions, assignment, best} }
```

## Phases

| Phase | Status | Scope |
|---|---|---|
| **1** | ✅ done | File split + LMS shell + sidebar nav + collapsible modules + To Do + working quizzes inside modules. Other sidebar pages are stubs; non-quiz item types show "Coming soon". |
| **2** | ✅ done | **Instructor module authoring**. Per-module release dates with hard lock; instructor-authored text pages; external links; URL overrides on course-defined reading/notes; per-item visibility toggles; file uploads to Firebase Storage with progress bar and download access for students. RTDB subtrees: `moduleConfig/`, `pages/`, `uploads/`. Storage path: `classes/{classId}/uploads/{uploadId}/{filename}`. |
| **2.5** | ✅ done | **Module CRUD**. Modules move from code-defined `MODULES_PHYSICS1` to per-class `classes/{classId}/modules` (ordered array). Instructors can create, rename, reorder, and delete modules; per-item CRUD now applies to every item (not just custom). Items get stable IDs; `moduleConfig` slims to `{releaseDate, hiddenItems}`. Auto-migrates legacy `moduleConfig.itemOverrides` and `customItems` on first load. `MODULES_PHYSICS1` is now a seed template used only by `createClass` and the migration helper. |
| **3** | — | **Homework engine**: define HW data shape per course (problems with parts, point values, attempt limits). Student submission UI mirroring the quiz chat. Claude 4.7 light-hint feedback on wrong answers via `evaluateAnswer` pattern. Score persistence under `homeworks/`. |
| **4** | ✅ done | **Announcements**: instructor compose UI; broadcast list page. Note: the unread popup modal and sidebar badge (per-student read tracking via `announcementReads/`) were added here and removed in Phase 6.9 — the feature bugged out on class-switch and didn't serve a real purpose. `announcementReads/` data remains in RTDB but is no longer read or written. |
| **5** | ✅ done | **Calendar**: month grid showing assignment due dates color-coded by item type (quiz=lime, homework=blue). Month navigation, today highlight, completed-quiz dimming. |
| **6** | ✅ done | **Grades**: instructor-defined weighted categories (`gradeCategories/`); per-student gradebook auto-populated from quiz submissions; manual score entry with EX (excused) support; weighted overall grade calc; Grade Settings modal; student Grades view with overall banner and category breakdown. CSV export. Add manual assignments (`manualAssignments/`) and rename any assignment (`assignmentNameOverrides/`). `buildGradebookAssignments` in `utils.js` accepts all these. New screens: `Gradebook.jsx`, `StudentGrades.jsx`. |
| **6.7** | ✅ done | **UI/UX refinements I** (11 changes): type-representative SVG icons for module items; remove Reading/Notes from add-item UI (seed uses `file`); fix module drag/drop (draggable on ⠿ handle); item-level drag/drop reordering (↑↓ buttons removed); release-date calendar dropdown (Eastern TZ, month grid); sidebar active-tab: teal text only, no highlight bar; bug icon hover animation; class picker style restore; module/item title font normalization to 14 px. |
| **6.8** | ✅ done | **UI/UX refinements II** (10 changes): three-dot (⋮) module action menu with inline calendar, add-item buttons, and delete; full-div draggable module headers and item rows (no ⠿ handles); animated teal-dashed drop gaps between drag targets; student portal TodoRail border removed; instructor tab "Modules" relabeled "Home"; gradebook CSV export button; calendar right-alignment fix (inside ⋮ menu); student login deduplication by `studentId`; gradebook add-assignment form; inline assignment title editing. |
| **6.9** | ✅ done | **Pre-phase tweaks** (9 changes): global font-family reset so form elements match body text (fixes TodoRail); remove filename/size from student file items; move student Logout from header into Settings modal; `StudentGrades` now receives `assignmentNameOverrides` so student and instructor see the same names; instructor gradebook column headers show full title (no Q1/HW1 abbreviation); fix item drag/drop off-by-one (gap position → correct insert index); fix module ⋮ menu clipping (`overflow: visible` on card); per-item ⋮ menu with due date, visibility toggle, and delete (replaces inline due field and eye icon); remove announcement notification badge and unread modal (`announcementReads/` RTDB subtree now orphaned). |
| **6.10** | ✅ done | **Gradebook & drag/drop polish**: gradebook column headers auto-size to content (removed 72 px cap); module-level drag/drop off-by-one fixed (same `from < to ? to-1 : to` logic already applied to items); drag/drop jitter eliminated — gap divs now own their own `onDragOver` handler so hovering the gap keeps state alive without layout shift; default manual assignments seeded on first class load for any course type: Midterm Exam (order 650, after HW 7), Final Exam (order 1350, after HW 14), Lab 1a–Lab 14b (orders 2000–2027); `buildGradebookAssignments` assigns numeric `order` to module items (`modIdx*100+itemIdx`) and accepts a sixth param `assignmentOrderOverrides` — both natural and override orders are used to sort all assignments together; gradebook column drag/drop (drag `<th>` headers, teal left-edge drop indicator, persists to `assignmentOrderOverrides/` in RTDB); gradebook filter bar — student name search, category toggle chips, assignment name search, live `N/M` count in header. |
| **7** | ✅ done | **Syllabus**: instructor uploads a PDF → Claude (via existing Netlify proxy) auto-extracts fields as JSON (course info, instructor, materials, grading breakdown, grading scale, policies) → saved to RTDB at `classes/{classId}/syllabus/` → student Syllabus page renders cards from extracted JSON + "Open PDF ↗" button. Instructor sidebar gains a "Syllabus" tab with upload/replace/remove UI and extracted-fields summary. New screens: `StudentSyllabus.jsx`, `InstructorSyllabus.jsx`. Proxy updated with `anthropic-beta: "pdfs-2024-09-25"` header. |
| **8** | ✅ done | **Course Evals**: two-tier anonymous feedback channel. *Quick Feedback* — open textarea available any time (multiple submissions OK). *End-of-Course Survey* — 7 Likert-scale questions (SA/A/D/SD; 4 course + 3 instructor) plus 3 open-ended prompts, gated behind last module release date. Both tiers share the same gate: neither the sidebar nudge badge nor the survey appear until the final lecture module unlocks. Submissions stored at root `courseEvals/{id}` with no student ID. `localStorage` tracks per-class submission state for the nudge and one-time survey guard without linking identity. Instructor gains an **Evals** sidebar section with All/Quick/Survey filter tabs and mark-as-read (mirrors bug reports UX). New screen: `CourseEvals.jsx`. |
| **9** | — | **Email broadcast** for announcements once roster includes emails. |

## Notes for future sessions

- **Gradebook architecture**: `buildGradebookAssignments(mergedModules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, assignmentOrderOverrides)` in `utils.js` returns a flat sorted assignment list. Module items get `order = modIdx*100 + itemIdx`; manual assignments use their stored `order` field (defaults 9999 if absent). `assignmentOrderOverrides` (sixth param, `{[id]: number}`) overrides any natural order — set when the instructor drag/drops columns in `Gradebook.jsx` and persisted to `assignmentOrderOverrides/` in RTDB. The combined list is sorted by `order` so exams and labs interleave correctly with quiz/HW columns. Default assignments (Midterm, Final, 28 labs) are seeded into `manualAssignments/` on first class load when the key is empty — applies to all course types. `calcGrades({assignments, categories, scores, excused})` computes weighted totals. The gradebook pre-filters to "active" assignments (submitted OR past dueDate) before passing to `calcGrades` to avoid inflating the denominator. Grade data flows: `gradeOverrides/{studentId}/{assignmentId}` → `{score?, excused?}`; `gradeCategories/{catId}` → `{id, name, weight, order}`; `manualAssignments/{id}`, `assignmentNameOverrides/{id}`, and `assignmentOrderOverrides/{id}` are all class-level. Both `Gradebook.jsx` and `StudentGrades.jsx` receive `assignmentNameOverrides` from `App.jsx` so names stay consistent.
- **Module item types**: `reading` and `notes` types were removed from the add-item UI and converted to `file` in the seed template (`physics1.js`). Existing items of those types in RTDB still render correctly — `ModuleItem.jsx` and `ItemRow` in `Modules.jsx` fall back to `<FileIcon />` for unknown types. Do not re-add reading/notes unless intentionally restoring them.
- **Course Evals anonymity model**: `courseEvals/{id}` records carry `classId` and `timestamp` but no `studentId`. The nudge badge (sidebar "1") and one-time survey guard use `localStorage` keys `newton_eval_quick_{classId}` / `newton_eval_survey_{classId}` — purely device-local, no identity in RTDB. Quick feedback can be submitted multiple times. Survey can only be submitted once per device; the sidebar badge clears only when the survey is submitted. Both features are gated: neither appears until `surveyIsAvailable(mergedModules)` returns true (last module's `releaseDate` has passed; if no modules have release dates, the gate is open immediately).
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
