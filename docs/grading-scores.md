# Score handling — instructor ↔ student parity

How a score travels from a submission, through instructor overrides, to what the
student sees. Goal of this doc: make explicit where the **instructor and student
sides compute the score independently**, so any override applied by the instructor
is guaranteed to show up on the student side (both the grades list and the
submission view) for **every** assignment type (quiz and homework).

## Data sources

- **Submission** — `classes/{classId}/submissions/{studentId}[]`, one per assignment
  (`quizId` = quiz/homework id). Carries `score` (out of 10). Homework also carries
  `rawScore`/`nativeTotal` and a `problems[]` per-part breakdown (each item has
  `earned`/`max`), plus `integrity`.
- **Override** — `gradeOverrides[studentId][assignmentId]`, written only by the
  instructor:
  `{ score?, excused?, previousScore?, dueDate?, partScores?, integrityReview? }`.
  - `score` — whole-assignment manual score (0–10). Applies to quizzes **and** homework.
  - `partScores` — `{ [itemId]: earnedValue }`, homework only (per-part edits from the
    submission view).
  - `excused` — omit from grade calc.
  - `integrityReview` — `"cleared" | "upheld"` for flagged homework written-work.

## The canonical resolution order

The **effective base score** for a cell is:

1. `ov.excused` → excluded (EX)
2. `ov.score` (whole-assignment override) — **wins over everything below**
3. `ov.partScores` (homework only) → recompute via `computeScoreFromPartOverrides`
4. otherwise `submission.score`

…then `integrityAdjustedScore(base, integrityState(sub, ov).penalized)` applies the
50% penalty **only if** a flag was *upheld*.

This order is implemented **once**, in `resolveScore` (`src/homework.js`), the single
source of truth shared by the instructor Gradebook, the student StudentGrades page, and
the shared `SubViewModal`. Its companion `scoreFromPartOverrides` does the homework
per-part recompute (step 3).

```js
// homework.js (pure, no React)
resolveScore(submission, override)
//   → { excused, base, penalized, flagged, effective }
//   base      = /10 score before integrity penalty (null = no score)
//   effective = integrity-adjusted /10 score to display & feed calcGrades (null = none/excused)
```

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

## Wiring reference (RTDB → UI)

- App.jsx loads `gradeOverrides` into state (3-place pattern, see CLAUDE.md) and
  passes it to both `Gradebook` (instructor) and `StudentGrades` (student, line ~1289).
- Instructor writes via `onSaveOverrideForStudent` → `fbSave(gradeOverrides/{studentId})`
  (App.jsx ~662). Because both portals read the same `gradeOverrides` node, a saved
  override is already available to the student on their next load; the only gap is the
  **client-side computation** divergence above, not the data plumbing.
