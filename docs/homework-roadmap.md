# Homework — Roadmap & Remaining Buildout

**Status:** Phase 1 shipped (commit `3075801`). The test assignment `hw1` (numeric /
word / math) works end-to-end: the MasteringPhysics-style runner, Claude grading
(`claude-opus-4-8`), gradebook auto-population with a per-problem submission breakdown,
and integration into modules, the assignments tab, the calendar, and the to-do rail.

See [architecture.md](architecture.md) § Homework for how the shipped pieces fit together.

**Scope of this doc:** the course-agnostic homework *process* and *engine* — the required
verify-first authoring procedure, what each `answerType` can do, and what's left to build. Content
notes for a specific course (which problems, which figures, why a given part isn't numeric) live in
the per-course docs: [courses/phy115.md](courses/phy115.md) · [courses/phy215.md](courses/phy215.md).

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

## UX principle — it should "just work"

The homework experience should need **as few instructions as possible**. When a student could
plausibly enter something a different way, make the app accept it rather than telling them the
one accepted form. Prefer, in order:

1. **Accept every reasonable input** (e.g. `normalizeSciNotation` takes `1.25e19`, `1.25x10^19`,
   `1.25×10¹⁹` and friends; `numericMatch` is sig-fig-agnostic; `angleMatch` accepts any
   coterminal angle, so `-19` grades the same as `341`; `gradeVectors` grades an arrow by its
   displacement so it can be drawn anywhere).
2. **Never charge an attempt for a convention slip.** Where an entry is malformed for what the
   question asks rather than physically wrong, return `{ correct:false, retry:true }` from
   `grade.js` — the runner shows a blue nudge and leaves the attempt counter alone. First use:
   `nonNegative: true` items, where a negative entry is nudged instead of marked wrong. Keep the
   nudge text independent of whether their value was right, so it leaks nothing.

   **Snapping a drawn answer** follows the same spirit but needs a reason. Two exist so far:
   `snapVectorMagnitudes` corrects an *ungraded* attribute the question withheld (the clock's
   $E_n \propto n$), and `snapFBDDirections` corrects the *graded* direction because an FBD
   displays the angle it was drawn at, so a within-tolerance arrow would otherwise label a wrong
   number. Both fire only on an already-correct piece. Neither touches length: FBD arrow length
   conventionally carries relative magnitude and is stored exactly as drawn.
3. **Show state rather than explain it** (a piece that turns green and locks; the `= 1.25 × 10¹⁹`
   echo; the attempt/credit indicator).
4. **Only then** write a sentence — and if you're about to, first check whether the behavior
   could just be made more forgiving instead.

### Angular tolerance: ±5°, and check the grid before you tighten

Every drawn direction (vector arrows, FBD forces, the acceleration arrow, symmetry axes) grades at
**±5°**, a 10°-wide window. This is the chosen alternative to snapping a correct arrow onto the key
direction: the diagram ends up clean because the student drew it right, not because the app
rewrote the very attribute being graded. Graphical parts grade live and consume no attempts, so a
tight tolerance costs a nudge of the mouse, never credit.

**A tolerance is only meaningful relative to what the input grid can hit.** Tips snap to a lattice
of step `xTick / snapDiv`, so the worst-case aiming error at radius `r` is
`atan(step / r) / 2`. Before tightening anything, check that against the *shortest arrow a student
would plausibly draw* — for the clock this forced `snapDiv` 4 → 20, since at step 0.5 an arrow of
length 0.75 has a 16.8° worst case and simply cannot be placed within 5° of the key. Cardinal
directions are always exactly reachable; tilted ones (an incline normal, a string tension) are the
ones to verify.

### Prose style for prompts and answers

`MathText` renders KaTeX (`$…$`, `\(…\)`, `\[…\]`) and nothing else — there is **no markdown
pass**. `**bold**` and `*italic*` therefore reach the student as literal asterisks, which is how a
batch of them shipped before being caught. House style:

- **No emphasis at all** — not `**`, not `*`, not `$\textit{…}$`. If a word needs stressing,
  restructure the sentence.
- **No em-dashes** (—). Use a comma, colon, semicolon, or a new sentence. En-dashes in compounds
  (`action–reaction`) are fine.
- Applies to homework prompts, `guide` labels and notes, quiz text/replies/`feedback` maps, the
  `answer` strings in `_answerKeys.js` (students see those on reveal), and all app UI copy on
  both sides of the app. Exempt: code comments and Claude-facing prompt
  text. The no-data glyph in empty cells is a plain hyphen `"-"`.
- **When auditing for this, walk nested objects.** A first pass that only checked top-level
  string fields missed a quiz's `feedback` map, which had both asterisks and em-dashes in it.

Do not add explanatory copy, tooltips, or help popovers to the numeric/answer flow. Help text
that exists (the collapsible grading-policy card) covers *scoring*, which a student genuinely
cannot infer, not *how to type*.

## Authoring — verify solutions first (REQUIRED)

Before any new homework is authored or an existing answer is changed, **independently
solve every problem and confirm each baked-in answer is correct AND complete.** Instructor
answer keys are known to contain errors and omissions, so the source key is a starting point,
not ground truth.

> **Where answers live (changed):** numeric / text / math answers are NO LONGER inline in
> `src/courses/<course>.js`. They are graded server-side, so the answer (plus its `sigFigs`,
> `unit`, optional `tolerance`) goes in **`netlify/functions/_answerKeys.js`** under
> `ANSWER_KEYS[courseType][hwId][itemId]`, while the prompt, `figure`, `answerType`, `unit`
> (for the input-field label), and any `graph`/`vector`/`fbd` config stay in the course file.
> The two are joined by item id, so **the id in `_answerKeys.js` must exactly match the id in the
> course file.** Graph/vector/fbd are still graded on the client and keep their full `key` in the
> course file (no `_answerKeys.js` entry). After authoring, sanity-check coverage by confirming
> every non-graphical item id has a key entry (a quick Node import of both modules, or just test
> the homework under `netlify dev` — a missing key returns a clear grader error).

The procedure:

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
5. **Set `nonNegative: true` on every numeric part whose quantity can't be negative** — a
   magnitude, speed, distance/height, elapsed time, mass, weight, density, count, or ratio — so
   a negative entry is nudged rather than penalized. Skip it wherever the sign is the physics:
   vector components, signed accelerations, and any item whose `answer` is negative. Test:
   *could a correct solution ever produce a negative number in this blank?* If yes, leave it off.
6. **Set `angle: true` on every degree-valued numeric part.** It grades with `angleMatch`, which
   accepts any coterminal spelling of the direction (`-19` ≡ `341` ≡ `701`), since those name the
   same direction the prompt asks for. Mutually exclusive with `nonNegative` — a negative angle
   is *correct*, not a slip.
7. **Set `sigFigs` on every numeric answer/part** (in its `_answerKeys.js` entry). The revealed
   correct answer is formatted to the item's `sigFigs` (via `toSigFigString`); without it the reveal shows `String(answer)`,
   which silently drops significant trailing zeros (`9.00` → "9", `40.0` → "40", `3.30` → "3.3").
   Choose the count from the precision of the problem's given data. `sigFigs` is display-only
   and does not feed grading — but grading is **sig-fig-agnostic** regardless: `numericMatch`
   accepts a value within the ±2% band OR one equal to the true answer correctly rounded to the
   sig figs the student typed (≥2 sf), so an honest rounding like `17` for `16.603` is accepted
   even though it's 2.39% off — just outside the band.
8. **Log every key-vs-verified discrepancy** in
   [answer-key-discrepancies.md](answer-key-discrepancies.md). Any time your verified value
   differs from the instructor's source key — *even within the ±2% tolerance* — add a row
   (noting whether the gap exceeds ±2%). The app uses your verified value, so this log is the
   instructor's to-do list for fixing the printed key documents.
9. **Flag questions that a deterministic numeric doesn't serve well** (ill-conditioned numerics,
   diagram/sketch/direction questions, expression/reasoning answers) and choose a fitting
   `answerType` (`text`/`graph`/`vector`/`math`) — see the Workflow Rules in `CLAUDE.md`.
10. **Size every figure** — see below.

### Figures — always scale to the page

A `figure` with no `figureWidth` renders at its **natural pixel size** (capped only by the
960px problem column). Source images are textbook screenshots at whatever zoom they were
captured, so natural size is almost never the right size on the page — a 2x-captured figure
dwarfs the prompt text next to it.

**For every problem with a `figure`, set `figureWidth`** (rendered width in CSS px, on the
problem object beside `figure`). Procedure:

```bash
sips -g pixelWidth -g pixelHeight public/homeworkFigures/<courseType>/HWn/<fig>.png
```

Then pick a width appropriate for the page and note the natural size in a trailing comment:

```js
figure: "/homeworkFigures/physics2/HW1/figE21-30.png", figureWidth: 400,  // natural 518×522
```

Rules of thumb — **~360–440px** for a typical square-ish or landscape diagram, **~160–200px**
for a tall/narrow one (a hanging-ball or vertical-plate figure at full width becomes a column
of image the student has to scroll past), and up to ~560px only when fine detail (dense
labels, a multi-panel figure) genuinely needs it. Scale to the figure's *content*, not its
pixel count. The image keeps `maxWidth: 100%` and `height: auto`, so an explicit width never
breaks the mobile layout or distorts the aspect ratio.

Per-course verification history — which sets have been verified, on what date, and what was
corrected — lives in the course docs: [courses/phy115.md](courses/phy115.md) and
[courses/phy215.md](courses/phy215.md). When you verify a set, do it the same way and record the
date there.

## Remaining buildout steps
1. **Real content** — author the remaining homework sets in `src/courses/physics{1,2}.js`
   (`HOMEWORKS_PHYSICS*`): real end-of-chapter problems, figures under
   `public/homeworkFigures/<courseType>/HWn/`, multipart `parts`, and per-problem `unit` (the
   answer + `sigFigs` / `tolerance` go in `netlify/functions/_answerKeys.js` — see § Authoring).
   **Verify all solutions first — see § Authoring above.**
   - **PHY 115 (`physics1`)** — `hw1`–`hw4` are authored and verified; `hw5…hw14` are stubs.
     Per-assignment notes (problem numbers, figures, which parts are text/graph/vector/fbd and
     why): [courses/phy115.md](courses/phy115.md).
   - **PHY 215 (`physics2`)** — scaffolded, nothing authored yet:
     [courses/phy215.md](courses/phy215.md).
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
- FBD method steps: forces and acceleration are graded from the drawing; the positive-axis
  choice must be **committed** ("Use these axes"), which greens steps 2 and 3 together and
  leaves the acceleration as the last open step. Orientation itself is never graded.
- Runner: `src/screens/student/HomeworkRunner.jsx`; math I/O: `MathField` (MathLive),
  `MathText` (KaTeX); graph I/O: `GraphField` (`src/components/GraphField.jsx`).
  MathLive's virtual keyboard never closes itself — `hideMathKeyboard()` is wired to focusout,
  disable, unmount, and submit so it can't sit over the page (see CLAUDE.md's `MathField` row).
- Content: `HOMEWORKS_PHYSICS1` / `HOMEWORKS_PHYSICS2` in `src/courses/physics{1,2}.js`;
  `homeworksForCourse()` in `src/courses/index.js`; course identity (labels) in
  `src/course-meta.js`.
- Answers: `netlify/functions/_answerKeys.js` (`ANSWER_KEYS[courseType][hwId][itemId]`),
  graded by `netlify/functions/grade.js`.
- Figures: `public/homeworkFigures/<courseType>/HWn/`; instructor source material (gitignored)
  in `source/<courseCode>/{quizzes,hw/HWn,lectures}/`. Set `figureWidth` on every one (§ Authoring
  → Figures).
- **`math` answers are re-braced before grading.** MathLive serializes single-token arguments
  compactly, so `\frac{3}{5}` round-trips as `\frac35` and a student's "(4/5)(1.08×10⁴)" becomes
  `\frac451.08\times10^4`. It renders correctly but reads as ambiguous text, and the grader
  marked a correct unit-vector answer wrong because of it (0/4 runs correct; 8/8 after
  re-bracing). `normalizeLatexForGrading` (`src/grading-core.js`) is applied in `grade.js` to the
  copy sent to Claude only — the raw LaTeX stays on the draft/submission for KaTeX to render.
  **When debugging a "why was this marked wrong?" report, always look at the stored draft LaTeX
  (`hwDrafts/{studentId}/{hwId}`) rather than the rendered field** — they can differ in ways that
  matter, and `history[itemId]` holds the exact text the grader saw.
- **The grader's JSON reply is parsed defensively.** Two bugs used to convert a *correct* verdict
  into "incorrect" silently: a message quoting LaTeX (`\left(`, `\hat{}`) is an invalid JSON
  escape so `JSON.parse` threw on the whole reply, and reasoning prose containing `\frac{4}{5}`
  had its `{4}` picked up as "the object". `parseJsonReply` now repairs illegal escapes and scans
  every balanced candidate, preferring one with a `status` key. Keep it that way — the failure is
  invisible from the outside, it just looks like the model being wrong.
- **Numeric entry accepts scientific notation.** `normalizeSciNotation` (`src/grading-core.js`)
  rewrites `1.25e19`, `1.25 e 19`, `1.25x10^19`, `1.25*10^19`, `1.25×10^19`, `1.25·10^19`,
  `1.25×10¹⁹`, and bare `10^19` / `×10⁻¹⁹` into JS exponential form before `parseNumber` and
  `sigFigsOf` see them — so an answer like "how many electrons?" (~1.25×10¹⁹) is actually
  enterable. It runs in the shared core, so the server grader and the client agree. There are
  **no instructions for this in the UI** — it just works; the only affordance is a quiet
  `= 1.25 × 10¹⁹` echo under the box whenever the entry contains an exponent form (see § UX
  principle). **Authoring implication:** never reword a problem to dodge a large
  or tiny answer, and pair any such answer with `sci: true` in `_answerKeys.js` so the *reveal*
  is exponential too.
- Grading proxy: `netlify/functions/claude.js` reads `CLAUDE_API_KEY` (see
  [environment.md](environment.md) for why not `ANTHROPIC_API_KEY`).
