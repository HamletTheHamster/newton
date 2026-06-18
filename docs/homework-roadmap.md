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

### ~~⚠️ Draft / resume state for unsubmitted homework~~ ✅ Done
`HomeworkRunner` saves in-progress work to **two** RTDB nodes (non-practice only):
- `classes/{classId}/hwDrafts/{studentId}/{hwId}` — full UI snapshot (answers, status,
  earned, feedback, revealed, history, idx). Auto-saved via a `useEffect` on `[attempts, status]`
  (fires after **every** submit, not just on resolve, so open-item hints/answers survive),
  saved again on confirmed leave, and cleared on successful final submission.
- `classes/{classId}/hwAttempts/{studentId}/{hwId}` — authoritative per-item attempt counts,
  written on **every** submit and cleared only on final submission. This is the anti-gaming
  source of truth.

**Anti-gaming:** on mount the runner seeds local `attempts` from `hwAttempts` **unconditionally**
(not just when the resume modal shows), so a student who made wrong-but-unresolved attempts can't
reset the counter by logging out — their next submit would otherwise overwrite the saved count.
The resume modal appears whenever there is any saved progress (resolved items, in-progress
attempts, or attempt counts). There is **no "Start fresh"** for graded homework: used attempts
can't be reset and resolved items are locked, so a true do-over only exists via practice retakes.
Practice mode never touches either node.

**No-lost-work guarantee on exit.** Every way out of a live graded session is an intentional
app-flow path that preserves the draft (never browser refresh/quit):
- The runner's leave modal calls `handleLeaveConfirm`, which writes the draft first. Its guard
  includes a non-empty `answers` map, so even a typed-but-not-yet-submitted answer is saved.
- If the **final submission fails** (`submitWork` catch), the result screen no longer traps the
  student with only a Retry button. It reassures "your work is saved" and adds a
  **"Leave — my work is saved"** button. The draft is only cleared on submit *success*
  (`clearDraft()` runs after `onFinish` resolves), so on a failure the full draft remains and the
  student can leave, return, and finish submitting (re-uploading work) via the resume flow.
- All three save paths (auto-save effect, leave-confirm, save-failure exit) share
  `draftSnapshot()` / `persistDraft()` for an identical snapshot shape.

Practice mode persists nothing by design; its leave modal states plainly that practice progress
isn't saved and can be restarted anytime.

### ~~⚠️ Written-work integrity check~~ ✅ Done
Before submitting a (non-practice) homework, students must upload images/PDFs of their
handwritten work. `checkWorkIntegrity` (`homework.js`) runs a lenient Claude sniff-check;
flagged submissions show the student **no score — "Pending review"** and are omitted from
the overall until the instructor reviews the uploaded work in the Gradebook's `SubViewModal`
and **clears** (full credit) or **upholds** (50% penalty) the flag. Work files ride on the
submission (`workFiles[]`, Storage path `hwWork/{studentId}/{hwId}/...`); the verdict is
`submission.integrity`; the instructor's decision is `gradeOverrides[...].integrityReview`.
Shared logic: `integrityState` / `integrityAdjustedScore` (homework.js), used by both
`Gradebook.jsx` and `StudentGrades.jsx`.

## Remaining buildout steps
1. **Real content** — author `hw2…hwN` for Physics 1 / Physics 2 in
   `src/courses/physics{1,2}.js` (`HOMEWORKS_PHYSICS*`): real end-of-chapter problems,
   figures under `public/homeworkFigures/HWn/`, multipart `parts`, and per-problem
   `unit` / `sigFigs` / `tolerance`.
   - ✅ **`hw1` (Physics 1) is now real content** — "Homework 1: Units & Vectors", 10
     Young & Freedman Ch. 1 problems (1.10, 1.33, 1.35, 1.36, 1.37, 1.51, 1.53, 1.73,
     1.87, 1.89). Figures `figE1-28.png` / `figE1-43.png` / `figP1-73.png` in
     `public/homeworkFigures/HW1/` (textbook "Figure …" labels cropped off). "Magnitude
     and direction" questions are split into two numeric blanks each (direction = degrees
     CCW from +x, stated in the stem); answers are hardcoded numerics graded
     deterministically, with Claude reserved for the few text/math parts (1.51b direction,
     1.53b expression, 1.53c explanation) and hints. The remaining `hw2…hw14` are still
     stubs to author.
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
4. ~~**Instructor `inst-sub-detail` homework view**~~ ✅ N/A — the `inst-sub-detail` screen
   was dead code (unreachable; there is no longer a submissions tab) and has been removed.
   Instructors review all submissions — quizzes and homework alike — only from the Gradebook,
   where `SubViewModal` renders the chat dialogue (quizzes) or the per-part `HomeworkItemRow`
   breakdown (homework).
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
