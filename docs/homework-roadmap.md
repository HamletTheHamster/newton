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
handwritten work. `checkWorkIntegrity` (`homework.js`) runs a lenient Claude sniff-check.
**A flag never withholds credit on its own** — a flagged submission counts at **full credit**
(the student sees their normal score) until the instructor reviews the uploaded work in the
shared `SubViewModal` (`src/components/SubmissionView.jsx`) and explicitly **upholds** the flag
(50% penalty); they may also **clear** it (an explicit full-credit record). There is no
"pending review" state. Work files ride on the submission (`workFiles[]`, Storage path
`hwWork/{studentId}/{hwId}/...`); the verdict is `submission.integrity`; the instructor's
decision is `gradeOverrides[...].integrityReview`. Shared logic: `integrityState`
(→ `{ flagged, review, penalized }`) / `integrityAdjustedScore` (homework.js), used by both
`Gradebook.jsx` and `StudentGrades.jsx`. The Gradebook flags such cells with a red `*` marker;
students never see the AI verdict (`SubViewModal` is passed `showIntegrity={false}`).

### ~~Students can view their own submissions~~ ✅ Done
`SubViewModal` + `HomeworkItemRow` were extracted from `Gradebook.jsx` into the shared
`src/components/SubmissionView.jsx`. In `StudentGrades.jsx`, each assignment row the student
has submitted is clickable ("View ›") and opens that modal read-only — no edit/review
callbacks and `showIntegrity={false}` — so students review their own submitted answers, sketches,
chat dialogue, and uploaded work the same way instructors do.

## Authoring — verify solutions first (REQUIRED)

Before any new homework is authored or an existing answer is changed, **independently
solve every problem and confirm each baked-in answer is correct AND complete.** Instructor
answer keys are known to contain errors and omissions, so the source key is a starting point,
not ground truth. The procedure:

1. **Solve from scratch.** Compute every numeric with a script (e.g. a quick `python3`
   heredoc), never by hand — last-digit arithmetic slips are the common failure. Keep the
   ±2% grading tolerance in mind, but author answers to full precision anyway (e.g. a
   direction of 250.3°, not 250°).
2. **Check figures.** For any problem with a `figure`, open the image and confirm the
   magnitudes/angles/quadrants you solved against actually match what the student sees —
   a wrong assumed angle invalidates the answer silently.
3. **Check graph keys.** For `answerType: "graph"`, confirm every `key.points` entry lies on
   the curve the physics implies (recompute each point) and that `shape` matches.
4. **Check completeness of prose.** A `text`/`math` answer is incomplete unless it states the
   full reasoning/expression a student is expected to give (e.g. a direction stated *and*
   justified, not just "out of the page").
5. **Set `sigFigs` on every numeric answer/part.** The revealed correct answer is formatted to
   the item's `sigFigs` (via `toSigFigString`); without it the reveal shows `String(answer)`,
   which silently drops significant trailing zeros (`9.00` → "9", `40.0` → "40", `3.30` → "3.3").
   Choose the count from the precision of the problem's given data. `sigFigs` is display-only
   and does not feed grading — but grading is **sig-fig-agnostic** regardless: `numericMatch`
   accepts a value within the ±2% band OR one equal to the true answer correctly rounded to the
   sig figs the student typed (≥2 sf), so an honest rounding like `17` for `16.603` is accepted
   even though it's 2.39% off — just outside the band.
6. **Log every key-vs-verified discrepancy** in
   [answer-key-discrepancies.md](answer-key-discrepancies.md). Any time your verified value
   differs from the instructor's source key — *even within the ±2% tolerance* — add a row
   (noting whether the gap exceeds ±2%). The app uses your verified value, so this log is the
   instructor's to-do list for fixing the printed key documents.
7. **Flag questions that a deterministic numeric doesn't serve well** (ill-conditioned numerics,
   diagram/sketch/direction questions, expression/reasoning answers) and choose a fitting
   `answerType` (`text`/`graph`/`vector`/`math`) — see the Workflow Rules in `CLAUDE.md`.

HW1 and HW2 were fully re-verified on 2026-06-18 (every numeric, graph key point, and text
answer confirmed correct/complete). HW3 was authored and verified from scratch on 2026-06-18
(every numeric recomputed by script against the figures; two instructor-key values corrected —
3.22(c) → 15.9 m, 3.6(b) direction → 4.58°). HW4 was authored and verified from scratch on
2026-06-19 (every numeric recomputed by script against the figures and the source key, using
$g = 9.80\text{ m/s}^2$; five key values differ — see answer-key-discrepancies.md — of which only
4.37(a) 16.6 N vs. the key's 17 N exceeds ±2%). When verifying a set, do it the same way and
record the date here.

## Remaining buildout steps
1. **Real content** — author `hw2…hwN` for Physics 1 / Physics 2 in
   `src/courses/physics{1,2}.js` (`HOMEWORKS_PHYSICS*`): real end-of-chapter problems,
   figures under `public/homeworkFigures/HWn/`, multipart `parts`, and per-problem
   `unit` / `sigFigs` / `tolerance`. **Verify all solutions first — see § Authoring above.**
   - ✅ **`hw1` (Physics 1) is now real content** — "Homework 1: Units & Vectors", 10
     Young & Freedman Ch. 1 problems (1.10, 1.33, 1.35, 1.36, 1.37, 1.51, 1.53, 1.73,
     1.87, 1.89). Figures `figE1-28.png` / `figE1-43.png` / `figP1-73.png` in
     `public/homeworkFigures/HW1/` (textbook "Figure …" labels cropped off). "Magnitude
     and direction" questions are split into two numeric blanks each (direction = degrees
     CCW from +x, stated in the stem); answers are hardcoded numerics graded
     deterministically, with Claude reserved for the few text/math parts (1.51b direction,
     1.53b expression, 1.53c explanation) and hints.
   - ✅ **`hw2` (Physics 1) is now real content** — "Homework 2: Motion Along a Straight
     Line", 10 Young & Freedman Ch. 2 problems (2.3, 2.16, 2.21, 2.34, 2.35, 2.64, 2.66,
     2.69, 2.80, 2.81). Single figure `figP2-80.png` (egg-drop building) in
     `public/homeworkFigures/HW2/`. All answers are deterministic numerics (g = 9.80 m/s²)
     with Claude reserved only for the 2.16 direction text parts and hints; 2.16 average
     accelerations are entered as **signed** values (+x = right, so a negative value = left)
     plus a text direction. 2.34 (c)/(d) are **`answerType: "graph"` sketch parts** —
     students draw the $x$-$t$ and $v_x$-$t$ curves for both vehicles in `GraphField`,
     graded deterministically by `gradeGraph`. 2.81 answers are entered as numerical
     factors (×H, ×T).
   - ✅ **`hw3` (Physics 1) is now real content** — "Homework 3: Motion in Two Dimensions",
     10 Young & Freedman Ch. 3 problems (3.1, 3.6, 3.11, 3.15, 3.16, 3.22, 3.29, 3.51, 3.54,
     3.63). Figures `figE3-29.png` (Ferris wheel) / `figP3-63.png` (grasshopper cliff) in
     `public/homeworkFigures/HW3/` (copied straight from the screenshots — no textbook caption
     to crop). Mostly deterministic numerics (g = 9.80 m/s²): vector/velocity questions split
     into component + magnitude + direction blanks (direction = degrees CCW from +x, stated in
     the stem). **3.6(c)** is an `answerType: "vector"` part — the student draws the two velocity
     arrows $\vec v_1$, $\vec v_2$ (graded on direction + magnitude) **and the average-acceleration
     arrow** $\vec a$ (graded on direction only — it must point along $\Delta\vec v$ at 31°, the
     misconception being to draw it along $\vec v_2$) from the origin in the new `VectorField`
     widget, graded deterministically by `gradeVectors`. Claude is reserved for the
     remaining text parts and hints: **3.29(a)/(b)** acceleration directions (toward the center —
     up at the bottom, down at the top) and **3.54(b)** (see next paragraph). Note two
     instructor-key values were corrected during verification: 3.22(c)
     strike height is **15.9 m** (key said 15.8 — key rounded $\sin 53.1°$) and 3.6(b) direction
     is **4.58°** (key said 4.8°); both differences are inside the ±2% grading tolerance.
   - ⚠️ **`hw3` 3.54(b) is intentionally a `text` answer (ill-conditioned numerically).** With
     the *minimum* muzzle velocity from 3.54(a), the trajectory's apex (~25.3 m) barely exceeds
     the 25.0-m cliff and is reached *before* the edge (at x ≈ 54 m), so the shell is descending
     as it grazes the corner and lands **essentially at the edge (~0 m beyond)**. The "distance
     past the edge" is hypersensitive to how `v0` is rounded — it swings from negative (doesn't
     clear) to +2.6 m over v0 = 32.6 → 32.8 m/s — and the true value ≈ 0 has no meaningful ±2%
     tolerance band. So 3.54(b) is graded as a conceptual `text` explanation rather than a fixed
     numeric. (3.6(c) is `text` for a different reason: the sketch can't be captured by the
     curve-on-axes `GraphField`.)
   - ✅ **`hw4` (Physics 1) is now real content** — "Homework 4: Newton's Laws of Motion",
     10 Young & Freedman Ch. 4 problems (4.4, 4.12, 4.19, 4.23, 4.27, 4.34, 4.37, 4.38, 4.40,
     4.57). Figures `figE4-4.png` (ramp) / `figE4-23.png` (boxes A,B) / `figP4-37.png` (cart
     forces) / `figP4-38.png` (oil tanker) / `figP4-57.png` (boxes on a rope) in
     `public/homeworkFigures/HW4/` (copied straight from the screenshots — figure-only, no
     caption to crop). Deterministic numerics use $g = 9.80\text{ m/s}^2$ (the source key used
     9.81 — five small discrepancies logged, only 4.37(a) exceeds ±2%). **This set is the first
     use of the new `FBDField` free-body-diagram builder** (`answerType: "fbd"` — see § FBD
     builder below): **4.27** has two fbd parts (one per crate) — the student draws forces from a
     bank ($F$/$T$/$N$/$w$), so the contact force shows up as a second normal ($N_1$ ground, $N_2$
     contact) — plus `text` parts for the action–reaction pair and part (b). **The written action–reaction / FBD-description parts are graded with `diagramContext`** — the runner feeds Claude a `describeFBDDiagram` summary of the FBD(s) the student actually drew (their own `N_1`/`N_2` labels and directions), so a student who labels the box-box contact force `N_1` in their diagram and answers "N_1" is graded against their own labeling, not a conventional default. **4.34** has **two fbd
     parts** — (a) the box, where the **friction arrow is prefilled** (drawn & locked forward,
     $+x$, since friction is a HW5 topic) and the student adds $N$ and $w$; and (b) the truck,
     where **both friction forces are prefilled** (road traction forward $+x$, box's drag backward
     $-x$) and the student adds the truck's weight, the road's normal (up), and the box's normal
     pressing down on the bed — then a (c) `text` part asks the student to identify the box↔bed
     action–reaction pairs across their two diagrams (graded with `diagramContext`, which now spans
     both FBDs so the student's own labels on either diagram are honored). Other text parts: 4.37(a) direction,
     4.38(c) "will it hit / is the oil safe". 4.37 "magnitude and direction" is split into a
     numeric magnitude + a `text` direction (the established pattern). 4.40(b) and 4.38(a) reveal
     in plain decimal (`toSigFigString` never uses sci-notation: "3700000 N", "0.0022 m/s²");
     students may type `3.7e6` (parseNumber accepts it). 4.57 is scaffolded: (a) find the
     downward acceleration first, then **two `fbd` parts** — (b) box $A$ (applied force $\vec F$
     up, rope tension $T$ down, weight $w$ down; acceleration down) and (c) box $B$ (tension $T$
     up, weight $w$ down; acceleration down), both with no normal force since the boxes hang on
     the rope — then (d) $m_B$, (e) $m_A$.
   - ⚠️ **`hw4` 4.38(b) is a mildly rounding-sensitive numeric (kept numeric).** The impact speed
     $0.17\text{ m/s}$ comes from $v^2 = 2.25 - 2.222 = 0.028$, a small difference of larger
     numbers. Carrying full precision keeps the canonical 0.17 inside the ±2% band, so it stays a
     numeric (unlike 3.54(b), whose value $\approx 0$ had no meaningful tolerance band).
   The remaining `hw5…hw14` are still stubs to author.
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
5. ~~**Graph / sketch problems**~~ ✅ Done — `answerType: "graph"` lets students draw curves
   (e.g. $x$-$t$ / $v$-$t$ graphs) in `GraphField` (`src/components/GraphField.jsx`): click
   to add points, drag to move, click to remove, and pick each curve's shape (line / concave
   up / concave down). Graded deterministically by `gradeGraph` (`homework.js`) against a
   per-curve `key` (key points within `yTolFrac` + matching shape flag) — no Claude call.
   Reveal renders the read-only "correct sketch" (`keyToValue`); the gradebook re-renders the
   student's sketch + expected side-by-side. First used in `hw2_p4` (2.34 c/d).
   - **No-Submit live-lock UX (2026-06-18):** graph/vector items have **no Submit button**.
     Because grading is deterministic and local (free/instant), the runner grades on **every
     placement** (`onGraphicalChange`): each piece (curve / arrow) that lands in tolerance turns
     **green and freezes in place**, and when all pieces pass the part resolves at **full credit**
     (no attempt schedule). A stuck student uses a **Show answer** button (confirm → reveal at
     `revealCredit`); a free **Hint** button is always available. The guide checklist is
     three-state (empty → drawn (neutral blue) → green ✓ + locked), verbose tool mechanics and
     long guide notes are tucked behind an `InfoDot` (circled-i popover), SVG/guide fonts are
     enlarged, the plot column is 540px, and the runner body matches the 960px module width.
     Next/Finish still warns on a started-but-unfinished diagram. Same treatment for vectors below.
   - **Future extensions:** the current grader treats each curve as a single `shape` flag
     (sufficient for monotonic single-concavity curves). Piecewise sketches (e.g. the subway
     train's ramp-up / flat / ramp-down $v$-$t$) would need per-segment shapes. Could also add
     a region/inequality answer mode and richer concavity inference from anchors.
6b. ~~**Vector / arrow-diagram problems**~~ ✅ Done — `answerType: "vector"` lets students draw
   arrows from a common origin (e.g. velocity/acceleration vectors, or free-body diagrams) in
   `VectorField` (`src/components/VectorField.jsx`): click to place an arrow tip, drag to move,
   click the tip to remove, and use chips to switch which vector is active. A vector flagged
   `freeTail` is instead placed in **two clicks (tail, then tip)** so it can run from one arrow's
   tip to another's (a graphical subtraction like $\vec v_2-\vec v_1$); either end can then be
   dragged. Graded deterministically by `gradeVectors` (`homework.js`) against a per-vector
   `key` (`{ tip:[x,y], tail?:[x,y], angleTol?, magTol? }`) by the arrow's displacement
   $(\text{tip}-\text{tail})$ — so an arrow grades the same drawn from the origin or anywhere
   else — with **direction always graded; magnitude only when the key supplies `magTol`.** This makes it reusable for scale-free **free-body diagrams** (set
   `hideTicks` and omit `magTol` → graded on directions alone) as well as scaled component
   vectors. Helpers mirror the graph ones: `parseVectorValue`, `vectorHasInput`,
   `keyToVectorValue` (config `key` → renderable "correct diagram"), `vectorHint`. Reveal renders
   the read-only correct diagram; the gradebook shows the student's diagram + expected
   side-by-side (`SubmissionView`). First used in `hw3_p2c` (3.6c — two velocity vectors graded
   on direction+magnitude, plus a `freeTail` $\Delta\vec v$ vector — placed in two clicks
   (tail then tip) — that the student may draw either as the subtraction from $\vec v_1$'s tip to
   $\vec v_2$'s tip OR from the origin, graded on direction+magnitude of the arrow itself). Once
   that part resolves it auto-plays a `VectorBuildup` (`src/components/VectorBuildup.jsx`)
   illustration: ten $\bar a\,(1\text{ s})$ steps (each $\Delta\vec v/10$) march tip-to-tail from
   $\vec v_1$'s tip to $\vec v_2$'s tip while a running velocity vector sweeps $\vec v_1\to\vec v_2$,
   driving home $\vec v_2=\vec v_1+\bar a\,\Delta t$ — the graphical link between acceleration and
   velocity. Config is `vector.buildup` ({ vectorId, count, base, … }); reusable for impulse /
   net-force-over-time.
   - **Future extensions for FBDs:** optional per-vector fixed length (qualitative arrows),
     required labels/equilibrium checks, and endpoint magnetism (snap a free tail onto another
     arrow's tip automatically).
6c. ~~**Dedicated free-body-diagram builder**~~ ✅ Done — `answerType: "fbd"` +
   `FBDField` (`src/components/FBDField.jsx`) supersedes the ad-hoc `VectorField`-FBD approach for
   real FBD problems. It teaches the full lecture method without giving away the answer: the
   student draws forces from a **bank** of the basic types (generic $F$, tension $T$, normal $N$,
   weight $w$, friction $f$) — **any number of each** — so they must decide which forces act;
   repeats auto-number with true subscripts ($N_1, N_2$); all forces share one color (blue) with
   the label disambiguating. The other process steps are built in: a separate **acceleration**
   arrow placed off to the side (or a "no acceleration" equilibrium toggle) and a rotatable
   **positive-axes** gizmo. Graded deterministically by `gradeFBD` (`homework.js`) — forces matched
   as a **multiset by type+direction** (missing/extra flagged without naming them), acceleration by
   direction; **axes orientation is a required step but ungraded** (per the instructor's choice). A
   `prefill` config draws & locks forces the student shouldn't supply yet (friction in 4.34, before
   friction is taught in HW5). Wired through the runner exactly like graph/vector (in the
   `GRAPHICAL` set: no Submit, live-grade-and-freeze, free Hint via `fbdHint`, Show-answer reveal
   via `keyToFBDValue`) and re-rendered read-only in `SubmissionView`. First used in `hw4`
   (4.27, 4.34, 4.57 — two boxes on a vertical rope, one FBD per box, no normal force). **Angle grading** (a force off the axes, with a required numeric angle) is
   speced in `gradeFBD` but not yet exercised by content — HW4's FBD forces are all axis-aligned;
   first real use will be an incline problem (e.g. HW5). **Future:** richer per-force angle inputs,
   optional required equilibrium/Newton's-second-law check, label text per force.
6. **Image-answer problems** — homework supports `numeric` / `text` / `math` / `graph`. Add an
   `image` `answerType` reusing `compressImage` / `checkImageReadability` (`utils.js`) and
   the quiz upload UI.
7. **Polish** — MathLive virtual-keyboard / mobile behavior in `MathField`;
   `formatNumericAnswer` sig-fig inference when `sigFigs` is omitted; optional unit-aware
   numeric parsing.

## Reference (current code)
- Engine: `src/homework.js` — `HW_GRADING_DEFAULTS`, `creditForAttempt`, `phaseForAttempt`,
  `numericMatch` / `parseNumber` / `formatNumericAnswer`, `evaluateHomeworkAnswer`,
  `gradeGraph` / `parseGraphValue` / `graphHasInput` / `keyToValue` / `graphHint` (graph).
- Runner: `src/screens/student/HomeworkRunner.jsx`; math I/O: `MathField` (MathLive),
  `MathText` (KaTeX); graph I/O: `GraphField` (`src/components/GraphField.jsx`).
- Content: `HOMEWORKS_PHYSICS1` in `src/courses/physics1.js`; `homeworksForCourse()` in
  `src/courses/index.js`.
- Grading proxy: `netlify/functions/claude.js` reads `CLAUDE_API_KEY` (see
  [environment.md](environment.md) for why not `ANTHROPIC_API_KEY`).
