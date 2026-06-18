# Architecture

The application is organized around a single top-level component in `src/App.jsx` that holds all state and renders each screen as an `if(screen==="...")return(...)` block. Reusable infrastructure (Firebase REST, auth, theme/styles, utility functions, course content) lives in sibling modules. Layout primitives for the LMS-style portal (Shell, Sidebar, ModuleList, TodoRail) are extracted under `src/components/lms/`. There are no routes and no state management library — navigation is driven by `screen` state plus per-portal section state (`studentSection`, `instructorSection`).

**Screens:** `student-search` → `student-pw` → `student-portal` → `quiz` | `inst-login` → `instructor`. Instructors review submissions (quizzes and homework alike) only from the Gradebook — clicking a grade cell opens `SubViewModal`; there is no standalone submission-detail screen.

Within `student-portal`, the active sidebar section is `studentSection` (one of `home`/`calendar`/`syllabus`/`announcements`/`grades`/`evals`). Within `instructor`, `instructorSection` selects the active panel (`modules`/`assignments`/`gradebook`/`calendar`/`roster`/`announcements`/`syllabus`/`evals`/`settings`). The `modules` section is labeled "Home" in the UI. Module content for each course (titles, per-week items) is defined in `src/courses/{courseType}.js`. See [docs/lms-redesign.md](lms-redesign.md) for the multi-session redesign plan.

## Firebase (no SDK — REST only)

All Firebase access goes through hand-rolled REST helpers in `src/firebase.js`:

- **App Check** (`getAppCheckToken`): exchanges a reCAPTCHA v3 token (prod) or the env var `VITE_FIREBASE_DEBUG_TOKEN` from `.env.local` (dev) for a short-lived App Check token. Pre-warms at module load. The RTDB rules reject any request without a valid App Check token.
- **Anonymous Auth** (`getAuthToken`): signs in anonymously via the Identity Toolkit REST API and refreshes automatically. The `?auth=<idToken>` query param is required on every RTDB request.
- **`fbGet` / `fbSet`**: thin wrappers that attach both tokens. Every data write goes through `fbSave` (inside `App.jsx`), which additionally manages the `syncStatus` state shown in the instructor header.

Security rules: `database.rules.json`.

**RTDB layout:**
```
classes/
  {classId}/                       e.g., "phys1-spring26"
    metadata/                      {name, courseType, active, createdAt}
    roster/                        array of {studentId, firstName, lastName, fullName, email?, altName?}
    studentPws/                    {studentId: {hash, salt}}
    submissions/                   {studentId: [submission, ...]}  — quiz submissions carry `dialogue`; homework submissions carry `type:"homework"`, `rawScore`/`nativeTotal`, a `problems[]` per-problem/per-part breakdown, `workFiles[]` (uploaded written-work proof: `{storagePath, downloadUrl, mime, size, name}`), and `integrity` (`{flagged, reason, checkedAt, model, error?}` from the Claude sniff-check). Both use `quizId` (= quiz or homework id) and a `score` out of 10.
    checkedSubs/                   {submissionId: true}
    dueDates/                      {quizId: "YYYY-MM-DD HH:mm"}
    modules/                       ordered array of {id, title, items: [...]}
    moduleConfig/                  {[moduleId]: {releaseDate?, hiddenItems: {[itemId]: true}}}
    pages/                         {[pageId]: {title, body, createdAt}}
    uploads/                       {[uploadId]: {name, size, mime, storagePath, downloadUrl, createdAt}}
    announcements/                 {[annId]: {id, title, body, createdAt}}
    announcementReads/             {[studentId]: {[annId]: true}}  — orphaned; no longer read or written (notification feature removed in 6.9)
    customQuizzes/                 {[quizId]: {id, title, text, createdAt, updatedAt}}  — instructor-created text-prompt quizzes; merged into the quizzes array at runtime alongside hardcoded course quizzes; also auto-added to manualAssignments for gradebook column. Must be included in the startup class-cache restore (App.jsx startup block) and in the setClasses call at the end of loadClassData, otherwise students whose class matches currentClassId skip loadClassData and see "Not yet linked" for custom quiz items.
    gradeCategories/               {[catId]: {id, name, weight, dropLowest, order}}  — used by Gradebook; separate from syllabus.fields.gradingBreakdown (PDF-extracted). A mismatch warning appears on the instructor Syllabus page when they diverge. Comparison uses prefix-based name matching (e.g. "Quiz" matches "Quizzes") and numeric weight coercion to handle PDF extraction variations.
    gradeOverrides/                {[studentId]: {[assignmentId]: {score?, excused?, previousScore?, dueDate?, partScores?, integrityReview?}}}  — `excused:true` omits the assignment from grade calculation; `previousScore` stores the manual score that was active before excusing so unexcuse can restore it (null means revert to submission score); `dueDate` is an ISO string ("YYYY-MM-DDTHH:MM") for a per-student deadline extension set by the instructor; `partScores` are per-item homework overrides; `integrityReview` (`"cleared"|"upheld"`) is the instructor's resolution of a flagged homework written-work check (absent = pending)
    manualAssignments/             {[id]: {id, title, catId, maxPts, order}}  — seeded on first load (Midterm, Final, Lab 1a–14b)
    assignmentNameOverrides/       {[assignmentId]: overrideTitle}
    assignmentOrderOverrides/      {[assignmentId]: number}  — column drag/drop order; overrides natural sort
settings/                          {passwordHash, passwordSalt, totpSecret?, trustedDevices?}  — shared across classes
bugReports/                        {id: {id, message, timestamp, read}}                       — shared across classes
courseEvals/                       {id: {id, type, classId, message?, responses?, openEnded?, timestamp, read}}  — shared across classes, scoped by classId field
_test/                             scratch node for connectivity check on startup
```

`metadata.courseType` (`"physics1"`, `"physics2"`, …) selects which course content is used at runtime via `quizzesForCourse(courseType)` and `modulesForCourse(courseType)` in `src/courses/index.js` (course files in the same directory). `metadata.active` controls whether students see the class in name search. The single instructor login (in `settings/`) accesses all classes through a switcher dropdown in the instructor header; each class's roster, submissions, due dates, and gradebook are isolated.

## Authentication

Auth helpers live in `src/auth.js` (`hashPw`, `makeHash`, `verifyPw`, TOTP helpers, device token helpers).

**Students:** password verified client-side against a SHA-256 hash+salt stored in `studentPws`. Legacy plain-text passwords are migrated to hashed on first correct login. Default password is the student's ID.

**Instructor:** single shared password verified against `settings.passwordHash/Salt`. Optionally protected by TOTP 2FA (RFC 6238, implemented with `crypto.subtle` HMAC-SHA1 — no library). Trusted devices are stored as SHA-256 hashes of a random token kept in `localStorage`; the raw token never goes to Firebase.

### 2FA Setup Flow

Enable in Settings tab → generates TOTP secret in browser → shows QR code (via `qrcode` npm package) → user confirms with a 6-digit code → secret saved to `settings.totpSecret` in Firebase. "Remember this device" writes the token hash to `settings.trustedDevices` and the raw token to `localStorage['newton_device_token']`. Disable/clear actions use the existing `confirmDanger` modal (requires password re-entry).

## Claude API

Calls proxied through `netlify/functions/claude.js` (which forwards to `api.anthropic.com/v1/messages` with the server-side API key):

1. **`checkImageReadability`** (`src/utils.js`) — validates that an uploaded drawing is legible before the student submits.
2. **`evaluateAnswer`** (`src/utils.js`) — grades a free-text quiz answer, returns a score and feedback. Maintains a per-question dialogue history (`apiHist`) so the model has context for follow-up exchanges within the same question.
3. **`evaluateHomeworkAnswer`** (`src/homework.js`) — grades a homework problem/part. Numeric answers are graded deterministically (±2%, sig-fig agnostic); word/math answers are graded by Claude (math judged for vector/algebraic equivalence). On a wrong answer at the hint stage, Claude diagnoses the likely mistake and returns a targeted hint; at the reveal stage it states the answer.
4. **`checkWorkIntegrity`** (`src/homework.js`) — at homework submit, a lenient academic-integrity sniff-check: Claude sees the problems, the student's submitted answers, and the uploaded written-work images/PDFs, and flags only when there is clearly no evidence of personal work. Never throws (grader errors return `{flagged:false, error}` so an outage never penalizes a student).

## Homework

Homework assignments are code-defined per course (`HOMEWORKS_PHYSICS1` in `src/courses/physics1.js`, read via `homeworksForCourse()`), and integrate through the same seams as quizzes:

- **Due dates / calendar / to-do / assignments tab:** keyed by `hw.id` in `classes/{classId}/dueDates`; merged into the derived `homeworks` array in `App.jsx` (`homeworks = homeworksForCourse(...).map(h => ({...h, dueDate: dueDates[h.id]}))`). Modules reference them via `{ type:"homework", refId:"hwN" }`.
- **Runner:** `HomeworkRunner.jsx` (screen `"homework"`, launched by `startHomework`). One problem per panel: figure + prompt + answer input by `answerType`. Grading defaults (`src/homework.js`): attempts 1–3 full credit, hint after the 3rd wrong attempt (correct on attempts 4–5 → 80%), answer revealed after the 5th wrong attempt (50%). Each problem = 1 point; multipart `parts` split it equally.
- **Submission / gradebook:** reuses the quiz `submissions` array/paths with `quizId: hw.id`, `type:"homework"`, a `problems[]` per-problem/per-part breakdown, and a `score` scaled to /10 so it flows through `buildGradebookAssignments` (which already treats `homework` items at `maxPts:10`, default category `cat_hw`), weighted-category math, CSV export, and whole-assignment overrides unchanged. The instructor reviews and edits the breakdown in `Gradebook.jsx`'s `SubViewModal` — per-part scores are editable inline; overrides stored at `gradeOverrides[studentId][hwId].partScores = { [itemId]: earnedValue }` and re-scored by `computeScoreFromPartOverrides` in the scoreMap build loop. Priority: `ov.score` (whole override) > `ov.partScores` > submission score.
- **Written-work integrity:** the final step before submitting a (non-practice) homework is a mandatory upload of images/PDFs of the student's handwritten work — proof of original effort, gated by a mandatory "I understand" acknowledgment shown before the problem flow unlocks (session-only, so it re-appears on every begin/resume) and restated in the collapsible grading-policy card. Files upload to Storage (`classes/{classId}/hwWork/{studentId}/{hwId}/{file}`, see `storage.rules`) and are recorded on the submission as `workFiles[]`; `checkWorkIntegrity` runs a lenient Claude sniff-check and writes `submission.integrity`. A flagged submission shows the student **no score, just "Pending review"** and is omitted from the overall grade (treated like an excused item in `calcGrades`) until the instructor opens the submission in `Gradebook.jsx`'s `SubViewModal`, reviews the work, and **clears** (full credit) or **upholds** (50% penalty) the flag via `gradeOverrides[studentId][hwId].integrityReview`. The shared `integrityState` / `integrityAdjustedScore` helpers (`src/homework.js`) compute pending/penalty identically in both the gradebook and the student grades page.
- **Math input/rendering:** `MathField` (MathLive `<math-field>`, LaTeX out) for entry; `MathText` (KaTeX) for prompts and answer reveals.

**Not yet implemented / remaining work** (see [homework-roadmap.md](homework-roadmap.md)): real `hw2…hwN` content and image-answer problems. Retake practice-gating is done: `startHomework(hw, isPractice)` mirrors the quiz pattern — `Home.jsx` passes `meta.completed`, `HomeworkRunner` skips `saveSubs` when `practice` is true. Instructor grading-settings UI is done: `classes/{classId}/homeworkSettings/{hwId}` stores per-assignment overrides; merged into `homework.grading` in the derived `homeworks` array; `HwGradingModal` on the Assignments tab edits all 6 defaults.

## Email (Resend)

Announcement email broadcast is handled by `netlify/functions/send-email.js`. When an instructor saves an announcement with the email checkbox on, the frontend calls this function with the recipient list, subject, and body. The function validates a shared secret (`EMAIL_SEND_SECRET`) then POSTs to the Resend API using `RESEND_API_KEY`. Emails are sent from `EMAIL_FROM_ADDRESS` (currently `Newton Physics <noreply@notifications.newtonphy.com>`). The subject is auto-prefixed with `{term} {courseNumber}:` from `syllabus.fields.course` if a syllabus has been uploaded. The send is fire-and-forget — a failed email does not block the announcement save. Student emails are stored as an optional `email` field on roster entries; `parseRoster` captures the "Preferred Email" column from MyMercer CSV exports. The sending domain `notifications.newtonphy.com` is verified with Resend; DNS is managed through Netlify DNS.
