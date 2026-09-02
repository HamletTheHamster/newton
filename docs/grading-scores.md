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

## Per-student deadline extensions

The Gradebook's "Extend Deadline" writes `gradeOverrides[studentId][assignmentId].dueDate`. That
was **display-only** until it was wired up: the panel said "Extended to …", and every late check
still read the assignment's own date, so an extended student was still scored at half credit and
still told their work was past due.

`effectiveDue(due, override)` (utils.js) is the resolver, and App.jsx applies it in **one place** —
where the `quizzes` and `homeworks` arrays are built — so the extension reaches the module list,
the To Do rail, the calendar, the quiz screen and `HomeworkRunner` at once, including the two
late checks that actually halve the score (`finishQuiz`, and the runner's `late`). It is gated on
`loggedInStudent`, which is null on the instructor side, so instructor screens keep showing the
class date.

`dueToDate` and `fmtDueTime` accept both `"YYYY-MM-DD HH:MM"` (how assignment due dates are
stored) and `"YYYY-MM-DDTHH:MM"` (what the extension picker emits). Without the `T` case the
extension fell through to `new Date(due)`, which reads it in the **viewer's** timezone while
every other due date is pinned to Eastern, so the same wall-clock time meant two different
instants.

Covered by `node src/due-dates.test.mjs`.

## Wiring reference (RTDB → UI)

- App.jsx loads `gradeOverrides` into state (3-place pattern, see CLAUDE.md) and
  passes it to both `Gradebook` (instructor) and `StudentGrades` (student, line ~1289).
- Instructor writes via `onSaveOverrideForStudent` → `fbSave(gradeOverrides/{studentId})`
  (App.jsx ~662). Because both portals read the same `gradeOverrides` node, a saved
  override is already available to the student on their next load; the only gap is the
  **client-side computation** divergence above, not the data plumbing.

## Exporting to Blackboard

The instructor is required to keep a detailed gradebook in Blackboard, so Newton's grades have to
land there without being retyped. `src/blackboard.js` is the whole interchange (pure and
env-agnostic, like `category-colors.js`), covered by `node src/blackboard.test.mjs`; the UI is
`BlackboardModal` in `Gradebook.jsx`, behind the header's **Blackboard** button.

### Why a "link" step exists at all

Blackboard's own advice is to download the current Grade Center and upload that same shape back,
because two facts in a downloaded file are load-bearing and **cannot be derived** from anything
Newton knows:

1. **Username.** Blackboard matches an uploaded row to a student by the `Username` column and
   nothing else. Newton's roster carries a name and a student ID, neither of which Blackboard
   matches on, and a username is not a function of a name — the Fall 26 PHY 215 roster alone
   contains `kunj.patel2`, which no rule would produce.
2. **Column ID.** A grade column downloads as `Quiz 1 [Total Pts: 10 Score] |1281892`. The
   `|1281892` routes values into the **existing** column. A header without one makes Blackboard
   *create* a column, at Blackboard's own default points total rather than yours — **verified
   against Ultra on 2026-09-02: 100 points**; Original creates a 0-point text column that cannot
   feed a calculated total at all.

Both facts live only in a Blackboard download, so the flow is: import the download once to learn
them, then export against that link as often as you like. The link is stored per class at
`classes/{classId}/blackboard` = `{ columns[], map: { [assignmentId]: bbId }, usernames:
{ [studentId]: username }, importedAt, sourceFile }`, wired through the standard three places in
App.jsx. It is **not** in `refreshClassContent` (no student reads it), and usernames are kept in
this node rather than on the roster **on purpose**: a roster CSV re-upload replaces the whole
array and would silently drop every username.

### Letting Blackboard create the columns

You do **not** have to hand-create a column per assignment. An unmatched assignment is uploaded
under its bare title and Blackboard creates the column for it — the modal's "Let Blackboard create
the columns it does not have yet" toggle, on by default (`createMissing`). Two documented
constraints shape how this is done:

1. **A created column arrives at Blackboard's default points total, not Newton's.** The upload
   format has no points field — the `[Total Pts: …]` part of a header is written on download and
   ignored on upload, which is why Blackboard's own docs say to "edit the column after it appears
   in the Gradebook to add the points total". Observed in Ultra: **100 points**. Original creates a
   0-point *text* column, which "can't be included in calculated columns, such as weighted, total,
   average". Either way it does not reflect Newton's marks until something is done about it — see
   *Points mismatches* below. The modal says this at the toggle and names every column the upload
   will create.
2. **Ultra creates a column only if at least one student has a grade in it** — "you must add at
   least one student's grade so the column is recognized and uploaded." An all-blank column is
   silently ignored. `buildBlackboardCsv` therefore holds back an unlinked assignment nobody has
   a score in (`skippedEmpty`) rather than exporting a column that would fail to appear while
   looking like it worked. Those go up on their own once the first grade exists.

The header for a new column is the **bare title** (`newColumnHeader`), with no `[Total Pts: …]`
suffix: Blackboard does not parse that on the way in, so including it would most likely name the
column `Quiz 2 [Total Pts: 10 Score]` verbatim. The bare title is also what makes the round trip
close — on the next import `normalizeTitle` matches Newton's title to the column Blackboard just
created from it, so `mergeImport` links it with no hand-pairing and every later upload routes by
column id.

The full cycle, verified end-to-end in the tests: upload → Blackboard creates the columns → set
their points → download → import → linked forever.

### Points mismatches, and `scaleToColumn`

Because a created column lands at Blackboard's default (100) while Newton's quizzes, homework and
labs are out of 10, a raw 8 would read as **8%** there. Two ways out, and the modal offers the
choice at the point where it reports the mismatch:

- **Fix the points in Blackboard** (Gradebook → Gradable Items → the item's ⋯ menu → Edit →
  points → Save). The raw marks then match Newton exactly. One edit per column, forever.
- **`scaleToColumn`** — upload 80 instead of 8 into a /100 column, so the percentage feeding the
  Overall Grade is right with no column editing at all. Off by default: silently rescaling grades
  is not something to do without being asked.

**The house route is the first one.** PHY 215 Fall 26 matches points possible by hand in
Blackboard as each column appears, so the raw marks read identically on both platforms and
`scaleToColumn` stays off. That makes the modal's mismatch panel a **punch list**: after every
upload-and-re-import it names exactly which Blackboard columns still have the wrong points total,
and it empties itself as they are fixed. Don't suggest turning scaling on to clear it — clearing
it is the point.

Three rules keep scaling honest. The factor is only ever taken from a points total **Blackboard
itself reported on a download** — a column being created this very upload has unknown points and
is sent raw, because assuming "it'll be 100" would multiply every grade by ten the day that
default changes. A column reporting 0 points is not treated as a scale (it would divide the grades
away). And scaling **stops on its own** once the two agree, so fixing a column in Blackboard and
re-importing quietly returns that assignment to raw marks.

### What the export deliberately leaves out

- **Unlinked assignments, when `createMissing` is off.** Skipped and reported, never invented.
- **Calculated columns** (Total, Weighted Total, Overall Grade). Blackboard states plainly that
  calculation formulas can be neither downloaded nor uploaded; the column recomputes itself from
  the ones we do upload. `isCalculatedColumn` keeps them out of the picker so a mapping can never
  be made in the first place.
- **`Last Access` and `Availability`.** Read-only status fields, not grade data, and Newton has no
  truthful value for them. Every uploaded column is a column Blackboard may act on, so the file
  carries only identity (`Last Name`, `First Name`, `Username`, `Student ID`) plus grades.
- **Students with no username** — they cannot be matched, so a row for them would be a silent
  no-op at best. They are dropped and named in the modal instead.

### Values

Scores come from the shared `buildScoreMatrix` (analytics.js), so an exported number is the same
effective score the gradebook cell and the student's grades list show — attendance zeros and
upheld integrity penalties included. One derivation, no third opinion. They are written as raw
points (rounded to 2dp, trailing zeros dropped), which is what a Blackboard `Score` column wants,
so the modal warns when a linked column's points differ from Newton's.

An **excused** assignment exports as an empty cell. Blackboard's exempt flag is a per-cell property
a grade upload cannot set, so the honest options are "blank" or "a number that isn't true"; blank
it is, and the modal says to mark those exempt in Blackboard by hand.

### Filenames

Both exports are stamped with the **local** date and time (`gradebookFilename`, e.g.
`phy215-blackboard-2026-09-02-1449.csv`) rather than ISO/UTC — the instructor reads the stamp
against the clock on the wall to tell which of several downloads in an afternoon is newest, and a
UTC stamp reads hours off. This matters most for the Blackboard file, where uploading a stale one
silently rolls grades back.

### Round trip

The file Newton writes is itself a valid Blackboard export (UTF-8 BOM, every field quoted, headers
reproduced byte-for-byte), which the tests assert by feeding it back through
`readBlackboardExport`.
