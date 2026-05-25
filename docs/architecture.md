# Architecture

The application is organized around a single top-level component in `src/App.jsx` that holds all state and renders each screen as an `if(screen==="...")return(...)` block. Reusable infrastructure (Firebase REST, auth, theme/styles, utility functions, course content) lives in sibling modules. Layout primitives for the LMS-style portal (Shell, Sidebar, ModuleList, TodoRail) are extracted under `src/components/lms/`. There are no routes and no state management library — navigation is driven by `screen` state plus per-portal section state (`studentSection`, `instructorSection`).

**Screens:** `student-search` → `student-pw` → `student-portal` → `quiz` | `inst-login` → `instructor` → `inst-sub-detail`

Within `student-portal`, the active sidebar section is `studentSection` (one of `home`/`calendar`/`syllabus`/`announcements`/`grades`/`evals`). Within `instructor`, `instructorSection` selects the active panel (`modules`/`submissions`/`quizzes`/`roster`/`announcements`/`gradebook`/`settings`/`bugs`). The `modules` section is labeled "Home" in the UI. Module content for each course (titles, per-week items) is defined in `src/courses/{courseType}.js`. See [docs/lms-redesign.md](lms-redesign.md) for the multi-session redesign plan.

## Firebase (no SDK — REST only)

All Firebase access goes through hand-rolled REST helpers in `src/firebase.js`:

- **App Check** (`getAppCheckToken`): exchanges a reCAPTCHA v3 token (prod) or a hardcoded debug UUID (dev) for a short-lived App Check token. Pre-warms at module load. The RTDB rules reject any request without a valid App Check token.
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
    submissions/                   {studentId: [submission, ...]}
    checkedSubs/                   {submissionId: true}
    dueDates/                      {quizId: "YYYY-MM-DD HH:mm"}
    modules/                       ordered array of {id, title, items: [...]}
    moduleConfig/                  {[moduleId]: {releaseDate?, hiddenItems: {[itemId]: true}}}
    pages/                         {[pageId]: {title, body, createdAt}}
    uploads/                       {[uploadId]: {name, size, mime, storagePath, downloadUrl, createdAt}}
    announcements/                 {[annId]: {id, title, body, createdAt}}
    announcementReads/             {[studentId]: {[annId]: true}}  — orphaned; no longer read or written (notification feature removed in 6.9)
    customQuizzes/                 {[quizId]: {id, title, text, createdAt, updatedAt}}  — instructor-created text-prompt quizzes; merged into the quizzes array at runtime alongside hardcoded course quizzes; also auto-added to manualAssignments for gradebook column. Must be included in the startup class-cache restore (App.jsx startup block) and in the setClasses call at the end of loadClassData, otherwise students whose class matches currentClassId skip loadClassData and see "Not yet linked" for custom quiz items.
    gradeCategories/               {[catId]: {id, name, weight, dropLowest, order}}  — used by Gradebook; separate from syllabus.fields.gradingBreakdown (PDF-extracted). A mismatch warning appears on the instructor Syllabus page when they diverge.
    gradeOverrides/                {[studentId]: {[assignmentId]: {score?, excused?}}}  — deleting the assignmentId key entirely restores the original submission score (undo excuse)
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

Two calls (defined in `src/utils.js`), both proxied through `netlify/functions/claude.js` (which forwards to `api.anthropic.com/v1/messages` with the server-side API key):

1. **`checkImageReadability`** — validates that an uploaded drawing is legible before the student submits.
2. **`evaluateAnswer`** — grades a free-text quiz answer, returns a score and feedback. Maintains a per-question dialogue history (`apiHist`) so the model has context for follow-up exchanges within the same question.

## Email (Resend)

Announcement email broadcast is handled by `netlify/functions/send-email.js`. When an instructor saves an announcement with the email checkbox on, the frontend calls this function with the recipient list, subject, and body. The function validates a shared secret (`EMAIL_SEND_SECRET`) then POSTs to the Resend API using `RESEND_API_KEY`. Emails are sent from `EMAIL_FROM_ADDRESS` (currently `Newton Physics <noreply@notifications.newtonphy.com>`). The subject is auto-prefixed with `{term} {courseNumber}:` from `syllabus.fields.course` if a syllabus has been uploaded. The send is fire-and-forget — a failed email does not block the announcement save. Student emails are stored as an optional `email` field on roster entries; `parseRoster` captures the "Preferred Email" column from MyMercer CSV exports. The sending domain `notifications.newtonphy.com` is verified with Resend; DNS is managed through Netlify DNS.
