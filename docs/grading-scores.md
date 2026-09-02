# Score handling — instructor ↔ student parity

How a score travels from a submission, through instructor overrides, to what the
student sees. Goal of this doc: make explicit where the **instructor and student
sides compute the score independently**, so any override applied by the instructor
is guaranteed to show up on the student side (both the grades list and the
submission view) for **every** assignment type (quiz, homework, and the
hand-entered manual assignments — exams and labs).

## Data sources

- **Submission** — `classes/{classId}/submissions/{studentId}[]`, one per assignment
  (`quizId` = quiz/homework id). Carries `score` (out of 10). Homework also carries
  `rawScore`/`nativeTotal` and a `problems[]` per-part breakdown (each item has
  `earned`/`max`), plus `integrity`.
- **Override** — `gradeOverrides[studentId][assignmentId]`, written only by the
  instructor:
  `{ score?, excused?, previousScore?, dueDate?, partScores?, integrityReview?, attendanceWaived? }`.
  - `score` — whole-assignment manual score, `0`–`maxPts`. Applies to quizzes, homework
    **and** manual assignments (where it is the *only* source — there is no submission).
  - `partScores` — `{ [itemId]: earnedValue }`, homework only (per-part edits from the
    submission view).
  - `excused` — omit from grade calc.
  - `integrityReview` — `"cleared" | "upheld"` for flagged homework written-work.
  - `attendanceWaived` — `true` exempts this one cell from the lecture-absence policy below.
- **Attendance** — `classes/{classId}/attendance/{date}`
  (`{ date, labId, takenAt, marks: { [studentId]: "present"|"absent"|"excused" } }`), written
  by the instructor's Attendance tab. Not a score: the lab zero it causes is *derived*
  (see below), never stored.

## The canonical resolution order

The **effective base score** for a cell is:

1. `ov.excused` → excluded (EX)
2. **lecture absence** (course policy, labs) → hard `0`, unless `ov.attendanceWaived`
3. `ov.score` (whole-assignment override) — **wins over everything below**
4. `ov.partScores` (homework only) → recompute via `computeScoreFromPartOverrides`
5. otherwise `submission.score`

…then `integrityAdjustedScore(base, integrityState(sub, ov).penalized)` applies the
50% penalty **only if** a flag was *upheld*.

This order is implemented **once**, in `resolveScore` (`src/homework.js`), the single
source of truth shared by the instructor Gradebook, the student StudentGrades page, and
the shared `SubViewModal`. Its companion `scoreFromPartOverrides` does the homework
per-part recompute (step 3). That recompute **rounds each problem's earned subtotal to 2
decimals (its natural 1-point unit) before aggregating** — each part stores `earned`
rounded to 3 decimals, so a fractional part weight (1/3, 1/9, …) doesn't sum back to the
problem's full credit (3 × 0.333 = 0.999); rounding per problem stops those 0.001 errors
from compounding across the assignment and shaving (or gifting) a 0.01 on the final /10,
keeping a no-change part override exactly equal to the submitted `submission.score`.

```js
// homework.js (pure, no React)
resolveScore(submission, override, attendance)
//   attendance = { absent, date } | null   ← attendanceFor(buildAbsenceMap(node), sid, aid)
//   → { excused, base, penalized, flagged, absentZero, effective }
//   base       = /10 score before the integrity penalty (null = no score). Kept even when an
//                absence zeroes the cell, so the gradebook can show the entered score struck
//                through beside the enforced 0.
//   absentZero = the attendance policy produced `effective`
//   effective  = the /10 score to display & feed calcGrades (null = none/excused)
```

### The lecture-attendance policy (step 2)

Course policy: a student absent from lecture earns **no credit for that day's lab**. The
mechanics, and why they are what they are:

- **The zero is derived on every read, never written.** No `0` is ever put into
  `gradeOverrides`. Correcting the attendance record restores the entered score with nothing
  to undo, and the gradebook keeps the mark the instructor actually gave.
- **It outranks `ov.score`.** Lab marks are bulk-entered from a stack of paper, so a typed
  score winning would silently undo the policy for exactly the students it targets: the ones
  who handed in a lab they were absent for. The entered value survives as `base` and is shown
  struck through beside the `0`.
- **Only `absent` counts, and only from a taken session.** `excused` does not zero the lab.
  A session with `takenAt: null` (created but not yet rolled) zeroes nobody, and a student
  with no entry in `marks` (added to the roster after the roll) is never zeroed: an absence
  has to be affirmative, never inferred from missing data. `buildAbsenceMap`
  (`src/attendance.js`) enforces all three in one place.
- **The instructor's escape hatch is `ov.attendanceWaived`**, set from the "Waive attendance
  policy" button in the gradebook's `GradeDetailPanel`. It mirrors how `integrityReview`
  gates the integrity penalty: an explicit per-cell flag, not an edit.
- **The student is told why.** `StudentGrades` labels the row "absent for lecture Sep 8"
  and, unlike other manual assignments, shows it before any score is entered, since the
  policy has already settled the outcome. Students never see anyone else's attendance.

## How the three surfaces now stay in sync

| Surface | Uses |
|---------|------|
| Instructor grades list (`Gradebook.jsx` scoreMap loop) | `resolveScore` → `r.effective` / `r.excused` / `r.flagged` |
| Student grades list (`StudentGrades.jsx` score loop) | `resolveScore` → `r.effective` / `r.excused` — **now honors `partScores`** |
| `SubViewModal` header "Score: X/10" | `resolveScore(submission, override).effective` (shows "· adjusted by instructor" when it differs from the raw submission score; "Excused" when excused) |
| `SubViewModal` part rows | instructor: editable draft inputs (init from `partScores`); student/read-only: `earnedFor(row)` = override value if present, else `row.earned`. Problem-level earned sums the same. |

Both `Gradebook.jsx` and `StudentGrades.jsx` pass the **whole override object** into
`SubViewModal` as the `override` prop; the modal derives `partOverrides`
(`override.partScores`) and `integrityReview` (`override.integrityReview`) from it. This
guarantees a quiz score override (`ov.score`) **and** homework per-part overrides
(`ov.partScores`) both reach the student's grades list and submission view identically —
the requirement that drove this work.

### Earlier divergence (fixed)

Before the shared resolver, the student grades list ignored `ov.partScores`, the student
submission view received no overrides at all, and the `SubViewModal` header hard-coded
`submission.score` on both sides. Those three gaps are closed by routing every surface
through `resolveScore` + the single `override` prop.

## Manual assignments — exams and labs

Assignments with no submission of any kind: they happen in the room and the instructor
types the marks. They live in `classes/{classId}/manualAssignments`
(`{ id, title, catId, maxPts, maxPtsSet?, order }`), are dated through the **same
`dueDates` node** keyed by assignment id, and surface as `type: "manual"` out of
`buildGradebookAssignments`. `resolveScore` needs no special case — with no submission it
falls straight through to `ov.score`.

Three things differ from quiz/homework and every reader must respect them:

- **Points vary.** Exams are `maxPts: 100`, labs and everything else `10`. Nothing may
  assume 10: the score clamp (`commitEdit`, `saveBulkScores`), the cell/row coloring
  (percentage, not raw points), the `/N` display, and the CSV header all read `a.maxPts`.
  `calcGrades` already weighted by `maxPts`, and its **drop-lowest now ranks by percentage**
  — raw points would have called a 40/100 worse than a 3/10.
- **No score ≠ zero.** A past-due quiz with no submission is a real zero. An ungraded exam
  just means the instructor hasn't marked it yet, which is normal for the days between
  sitting it and grading it. So a manual assignment enters the grade calc **only once it is
  scored or excused** — applied identically in `Gradebook`'s `activeAssignments` and
  `StudentGrades`' `assignments` filter, which is what keeps the two Overall figures equal.
  It is also why the student's grades list shows no row until the score exists.
- **Nothing to open.** They appear on the student calendar and in the To Do rail (upcoming
  only, never past-due) but are never clickable and never module-gated.
- **Labs can be zeroed by attendance.** A lab (`catId: "cat_lab"`) linked to an attendance
  session is subject to the lecture-absence policy above, which is the one case where a
  manual row appears in the student's grades list with no score entered.

Scores are entered either cell-by-cell or, for a whole column at once, through
`BulkScoreModal` (the "enter scores" link in a manual column's header). Bulk save goes
through `onSaveBulkOverrides` → App.jsx's `saveOverridesForStudents`, which writes the whole
`gradeOverrides` node once. It deliberately does **not** loop `saveOverrideForStudent`: each
of those calls rebuilds its `updated` object from the same stale `gradeOverrides` closure, so
only the last student's edit would survive in local state.

## One shared derivation (`buildScoreMatrix`)

The student × assignment grid of effective scores is built once, in
[`src/analytics.js`](../src/analytics.js), and consumed by both `Gradebook.jsx` and the
Analytics tab. It returns `scoreMap`, `excusedMap`, `flaggedMap`, `absentMap` and
`subsByStudent`, each keyed `[studentId][assignmentId]`, with every cell resolved through
`resolveScore` — so the priority chain documented above applies identically wherever a score is
shown, and a new consumer cannot reintroduce a private copy of it.

`countsTowardGrade(assignment, { hasScore, isExcused, hasSubmission, now })` lives beside it and
is the "No score ≠ zero" rule from the previous section, extracted for the same reason. The
Gradebook's `activeAssignments` filter now calls it. **`StudentGrades.jsx` still carries its own
copy** — it was left alone to keep a grading refactor out of a feature change, and should be
folded in next time that file is touched.

## Wiring reference (RTDB → UI)

- App.jsx loads `gradeOverrides` into state (3-place pattern, see CLAUDE.md) and
  passes it to both `Gradebook` (instructor) and `StudentGrades` (student, line ~1289).
- Instructor writes via `onSaveOverrideForStudent` → `fbSave(gradeOverrides/{studentId})`
  (App.jsx ~662). Because both portals read the same `gradeOverrides` node, a saved
  override is already available to the student on their next load; the only gap is the
  **client-side computation** divergence above, not the data plumbing.
