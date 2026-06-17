# Homework — Roadmap & Remaining Buildout

**Status:** Phase 1 shipped (commit `3075801`). The test assignment `hw1` (numeric /
word / math) works end-to-end: the MasteringPhysics-style runner, Claude grading
(`claude-opus-4-8`), gradebook auto-population with a per-problem submission breakdown,
and integration into modules, the assignments tab, the calendar, and the to-do rail.

See [architecture.md](architecture.md) § Homework for how the shipped pieces fit together.

## Intended behavior NOT yet implemented

### ⚠️ Retakes must be practice-only (no re-grade)
A student who has already completed a homework may reopen it **to practice**, but a
retake must **not** create a new graded submission or change their recorded score —
exactly like quizzes. **Current state:** homework has no practice mode, so reopening a
completed homework re-runs it and saves another graded submission via `saveSubs`. This
needs to be fixed before real assignments go out.

Implement by mirroring the quiz pattern:
- `startHomework(hw, isPractice)` — add the flag. Quizzes do this already:
  `onStartQuiz={q => startQuiz(q, completedQuizIds.has(q.id))}` in `App.jsx`.
- `src/screens/student/Home.jsx` — `onItemClick` for homework passes completion:
  `onStartHomework(meta.homework, meta.completed)`.
- `src/screens/student/HomeworkRunner.jsx` — accept a `practice` prop; in `finish()`,
  when `practice` is true, show the result screen but **skip** `onFinish(...)`/`saveSubs`.
  (Quiz analog: `finishQuiz` guards persistence on `practiceMode`.) Badge the runner
  top bar "Practice" like the quiz screen does.
- The to-do rail already excludes completed items, so no change needed there.

## Remaining buildout steps
1. **Real content** — author `hw2…hwN` for Physics 1 / Physics 2 in
   `src/courses/physics{1,2}.js` (`HOMEWORKS_PHYSICS*`): real end-of-chapter problems,
   figures under `public/homeworkFigures/HWn/`, multipart `parts`, and per-problem
   `unit` / `sigFigs` / `tolerance`. `hw1` is only a smoke test.
2. **Instructor grading-settings UI** — make `HW_GRADING_DEFAULTS` editable per assignment
   (free attempts, hint/reveal penalties, ±tolerance). The engine already accepts a
   `grading` argument; wire a per-assignment override store (e.g.
   `classes/{classId}/homeworkSettings/{hwId}`) and a small editor on the Assignments tab.
3. **Per-part score override in the gradebook** — today only a whole-assignment override
   exists; `SubViewModal` shows the per-part breakdown read-only. Add per-part editing
   (new override shape, e.g. `gradeOverrides[studentId][hwId].partScores`).
4. **Instructor `inst-sub-detail` homework view** — the `inst-sub-detail` screen in
   `App.jsx` shows "No dialogue saved" for homework (only `Gradebook.jsx`'s `SubViewModal`
   renders the breakdown). Reuse `HomeworkItemRow` there.
5. **Image-answer problems** — homework supports `numeric` / `text` / `math`. Add an
   `image` `answerType` reusing `compressImage` / `checkImageReadability` (`utils.js`) and
   the quiz upload UI.
6. **Polish** — MathLive virtual-keyboard / mobile behavior in `MathField`;
   `formatNumericAnswer` sig-fig inference when `sigFigs` is omitted; optional unit-aware
   numeric parsing.

## Reference (current code)
- Engine: `src/homework.js` — `HW_GRADING_DEFAULTS`, `creditForAttempt`, `phaseForAttempt`,
  `numericMatch` / `parseNumber` / `formatNumericAnswer`, `evaluateHomeworkAnswer`.
- Runner: `src/screens/student/HomeworkRunner.jsx`; math I/O: `MathField` (MathLive),
  `MathText` (KaTeX).
- Content: `HOMEWORKS_PHYSICS1` in `src/courses/physics1.js`; `homeworksForCourse()` in
  `src/courses/index.js`.
- Grading proxy: `netlify/functions/claude.js` reads `CLAUDE_API_KEY` (see
  [environment.md](environment.md) for why not `ANTHROPIC_API_KEY`).
