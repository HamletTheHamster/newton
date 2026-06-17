# Homework — Roadmap & Remaining Buildout

**Status:** Phase 1 shipped (commit `3075801`). The test assignment `hw1` (numeric /
word / math) works end-to-end: the MasteringPhysics-style runner, Claude grading
(`claude-opus-4-8`), gradebook auto-population with a per-problem submission breakdown,
and integration into modules, the assignments tab, the calendar, and the to-do rail.

See [architecture.md](architecture.md) § Homework for how the shipped pieces fit together.

## Intended behavior NOT yet implemented

### ~~⚠️ Retakes must be practice-only (no re-grade)~~ ✅ Done
Implemented in commit after `dd07c4c`. `startHomework(hw, isPractice)` now mirrors the
quiz pattern: `Home.jsx` passes `meta.completed`; `App.jsx` calls `setPracticeMode`;
`HomeworkRunner` accepts `practice` prop, skips `onFinish`/`saveSubs` when true, shows
a "Practice" badge, and labels the result screen "Practice complete — not submitted for
a grade". The to-do rail already excluded completed items.

## Remaining buildout steps
1. **Real content** — author `hw2…hwN` for Physics 1 / Physics 2 in
   `src/courses/physics{1,2}.js` (`HOMEWORKS_PHYSICS*`): real end-of-chapter problems,
   figures under `public/homeworkFigures/HWn/`, multipart `parts`, and per-problem
   `unit` / `sigFigs` / `tolerance`. `hw1` is only a smoke test.
2. ~~**Instructor grading-settings UI**~~ ✅ Done — "⚙ Settings" / "⚙ Custom" button on
   homework rows in the Assignments tab opens `HwGradingModal` (6 editable fields).
   Overrides stored at `classes/{classId}/homeworkSettings/{hwId}`, merged into
   `homework.grading` in `App.jsx`'s derived `homeworks` array, threaded through
   `HomeworkRunner` and `evaluateHomeworkAnswer`.
3. ~~**Per-part score override in the gradebook**~~ ✅ Done — `SubViewModal` is now
   edit-capable for homework: each part shows a number input (blue border when overridden);
   "Save part scores" / "Reset scores" buttons in the header. Override stored at
   `gradeOverrides[studentId][hwId].partScores = { [itemId]: earnedValue }`.
   `GradeDetailPanel` button relabeled "View / Edit Submission" with a "✎ Part scores
   overridden" indicator; `computeScoreFromPartOverrides` re-derives the /10 score in the
   `scoreMap` build loop (priority: `ov.score` > `ov.partScores` > submission score).
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
