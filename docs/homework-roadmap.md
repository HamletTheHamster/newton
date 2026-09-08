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

### ⚠️ `clearDraft()` races the draft saves, and the draft survives the submission
**Open. Found 2026-09-07, on HW1's deadline night. Costs no marks today; fix before it does.**

`clearDraft()` (`HomeworkRunner.jsx`) fires its three deletes — `hwDrafts/{sid}/{hwId}`,
`hwProgress/{sid}/{hwId}`, `hwTelemetry/{sid}/{hwId}` — as **fire-and-forget** `fbSet(…, null)`
calls with `.catch(() => {})`, and nothing awaits them. Meanwhile a `fbUpdate(draftPath, patch)`
from the debounced typed-answers save, the visibility/pagehide flush, or a **second session of
the same student** (a phone, or a laptop tab opened before they submitted, whose `submittedRef`
is a different component instance and therefore still `false`) can be in flight. RTDB has no
ordering guarantee across separate requests, so a PATCH that lands after the DELETE **recreates
the node** — and a PATCH creates the whole path, so the draft comes back complete.

Observed in production, both on the same night:

| student | submitted at | node re-written at | result |
|---|---|---|---|
| Nnenna Nnebe `0429154` | `02:48:43Z` | draft `savedAt` = `02:57:18Z` | draft resurrected (35/35 items `correct`), `hwProgress` and `hwAttempts` gone |
| Tony Vanco `0432369` | `2026-09-06T20:01:29Z` | `hwProgress.updatedAt` = `20:01:36Z` | progress record resurrected at 100%, draft intact |

Note the two land on **different** nodes each time — that is the signature of a race between
independent requests rather than a single bug in one write path.

**Why it costs nothing today.** `closesAssignment` reads the submission, not the draft, so the
module list still ticks, the To Do rail still drops the assignment, and re-opening still launches
in practice mode. The student sees a finished assignment and the correct grade.

**Why it must still be fixed.** A resurrected `hwProgress` record with `done > 0` is exactly the
prefilter `auto-submit-sweep.js` uses to pick sweep candidates, and a resurrected draft is what
`draftHasCompletedWork` then confirms. Both guards that stop a phantom `auto_*` record being
written for a student who already handed in — the `submitted` set in `pendingAutoSubmissions`, and
`sweptRef`'s once-per-session gating — depend on the sweeping session holding a **fresh**
submissions snapshot. That is the same staleness assumption that broke the Progress column (below),
so it should not be the only thing standing between a submitted student and a second submission
record worth `0` under `workPending`.

**Direction when it is picked up** (deliberately not done an hour before a deadline):
- `clearDraft` should **await** its deletes and run them **after** cancelling every pending save,
  so the last write on each node is the delete.
- `submittedRef` is per-component-instance and therefore cannot see another tab. The durable
  version of that fact is the submission itself: a save path should refuse to write a draft for an
  assignment that already has a submission which `closesAssignment`. That is a read per save, so
  more likely a one-shot check on mount plus a re-check in the flush.
- Consider whether `clearDraft` should null `hwProgress` at all, or write a **terminal** record
  (`{ done: total, total, pct: 100, submittedAt }`). That would make the Progress column
  self-sufficient — one small live node, no join against `submissions` at all — but it also makes
  `done > 0` true for a submitted student, so the sweep prefilter would need to exclude it
  explicitly. Weigh the two together, not separately.

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
- `classes/{classId}/hwProgress/{studentId}/{hwId}` — `{ done, total, pct, updatedAt }`, the
  instructor-facing completion summary. Written by the same `persistDraft()` chokepoint as the
  draft (so it can never drift from it) and cleared alongside it on final submission, after
  which the submission is the record. See § Instructor progress view below.

**Anti-gaming:** on mount the runner seeds local `attempts` from `hwAttempts` **unconditionally**
(not just when the resume modal shows), so a student who made wrong-but-unresolved attempts can't
reset the counter by logging out — their next submit would otherwise overwrite the saved count.
The resume modal appears whenever there is any saved progress (resolved items, in-progress
attempts, or attempt counts). There is **no "Start fresh"** for graded homework: used attempts
can't be reset and resolved items are locked, so a true do-over only exists via practice retakes.
Practice mode never touches either node.

### Deadline auto-submission ✅ Done

A student who resolved problems and never pressed **Finish & Submit** was recorded as *missing* —
indistinguishable, in the gradebook, from a student who did nothing. That is the funnel's
"Finished, not handed in" bucket (see [docs/analytics.md](analytics.md)), and it was invisible
until the grade was already a zero. So when a deadline passes over a draft holding real work,
that work is written down as a record of its own.

**What that record is: a receipt, not a grade.** Handing in the written work is what makes a
homework count. That rule does not bend for a late submission and it must not bend for one the
app made on the student's behalf, since nobody uploaded anything and the integrity check never
ran — it would simply become the way around the requirement. So the record is **worth 0 in the
gradebook until the work arrives**. What it does instead is preserve two things that would
otherwise be lost at midnight:

1. the fact that there is finished work waiting to be claimed, told to the student in the one
   place they look at grades (`StudentGrades` badge: *"6.4/10 saved at the deadline: hand in your
   written work to claim it"*), and
2. **exactly which parts were finished on time** — which is what lets those parts keep full
   credit when the student does hand in.

**Where the logic lives.** `src/auto-submit.js` is pure and covered by `src/auto-submit.test.mjs`
(`node src/auto-submit.test.mjs`); `src/auto-submit-sweep.js` is the impure half that does the
reads. The four rules are written out at the top of the pure module — read them there — but in
short:

1. **It is not an ending.** The draft is deliberately **not** cleared and the assignment stays
   open; the student comes back, finishes what they like, uploads their work and submits
   normally. That single path is also how the record is redeemed, so there is no second upload
   UI. This is why `closesAssignment(sub)` exists and why every place that reads "has this
   student handed in" uses it: `completedQuizIds` (App.jsx and `Home.jsx`), the Assignments hub's
   `ProgressCell`, and `buildFunnel`. Miss one and the homework re-opens in **practice mode**,
   where nothing can be submitted at all — the feature would look like it worked and quietly do
   the opposite.
2. **The parts done on time keep full credit.** Every part in the record is stamped
   `onTime: true`; `markOnTimeParts` carries the stamps onto the real submission and
   `scoreFromPartOverrides` applies the late penalty to the un-stamped half only. 3 of 10 on time
   + 7 late = **6.5/10**, not the 5.0 a whole-assignment halving gives. See
   [docs/grading-scores.md](grading-scores.md) § Deadline auto-submissions for why the penalty
   stays on a subtotal rather than moving onto each part (existing grades must not move).
3. **It counts for nothing until the work is in** — `workPending: true`, `effective: 0`, `base`
   kept so the held score can be shown struck through. `workReview: "accepted"` is the
   instructor's release.
4. **It only ever looks forward** — `AUTO_SUBMIT_SINCE` stops the first sweep after the deploy
   from manufacturing records for every past-due draft left over from the whole term.

**Why it is a lazy sweep and not a cron.** Every RTDB write in this app is made by a signed-in
browser: the Netlify functions never touch Firebase, and App Check is enforced with reCAPTCHA v3,
which a server cannot mint. A scheduled function would need anonymous auth plus an App Check
debug token in Netlify env — a credential path that does not exist today, and one that fails
silently. So the sweep runs when a session that would care opens the class: the **student's own
portal** over their own drafts (so their grades page tells them there is work to claim), and the
**instructor's portal** over the whole class, which is the pass that matters because it is
guaranteed to have run before anyone looks at a grade. Both write the same deterministic key
(`auto_{hwId}`), so whichever runs second finds the record already there and does nothing.

**Two guards worth keeping.** The instructor's pass must not read `hwDrafts` wholesale — that
node carries every typed answer, every feedback string and the whole Claude history for every
student × assignment, and the rest of the instructor side goes out of its way never to load it.
Candidates come from the tiny `hwProgress` node instead, and only the surviving drafts are read.
And the sweep is gated on `classDataLoading` being false: `dueDates` and `gradeOverrides` arrive
in the same `loadClassData` batch as the roster, and a sweep run against empty due dates would
find nothing, mark itself done for the session, and never run again once the data landed.

**Per-student extensions are honored.** The selection resolves each student's deadline through
`effectiveDue`, so an extended student is not auto-submitted at the class date — which would
silently take the extension away.

### Instructor progress view (Assignments hub)
`Assignments.jsx` reads `classes/{classId}/hwProgress` **and `submissions` together**, on a 60s
visible-only refresh (see the note on the join below), and renders a
**Progress column** between Due Date and Actions: a 44px bar plus the class `N%` average, and
nothing else. Clicking it opens a per-student breakdown sorted least-progress first; the
started count and last-worked time live on the cell's `title` tooltip and in that modal, since
printing them in the cell cost three lines of row height and the column width the title needs
more.

**The two nodes are read together because `progressRows` joins them.** A student's `hwProgress`
record is deleted the moment they hand in, so "no progress record" means "finished and submitted"
only if that submission is visible. App.jsx loads `submissions` once per class and never re-polls
it (instructor writes there are optimistic), while this component re-read `hwProgress` on every
mount — so on 2026-09-07, HW1's deadline night, an already-open instructor tab showed every student
who submitted flip to **0% and "not started"**, indistinguishable from a student who did nothing,
and dropped them from the started count and the class average. A join between a fresh source and a
frozen one is always wrong. The copy read here is view-local and never written back, which is what
makes fixing it in this component safe; a failed read keeps what is on screen rather than emptying
the submission side of the join.

That breakdown is a list, and stops there. Watching how ONE student worked the set, problem by
problem, is `StudentWorkDetail.jsx` on the **Analytics** page (Students → a student → a homework
row); it used to be a second modal opened from this one, which is three clicks deep and 560px
wide for what is a reading view. See [docs/analytics.md](analytics.md) § Where it surfaces.

Fitting the column inside the Shell's 960px content width meant right-sizing everything else
to its widest real content, **measured in-browser rather than estimated** — `GRID_COLS` =
`"1fr 104px 56px 312px 88px 124px"` with a shared `GRID_GAP = 6` (header and rows read the same
constant or the columns fall out of alignment). Three hard constraints bind that budget:

- **Due ≥ 310px**, or `DueDateField`'s row layout wraps its "Past due" badge to a second line.
- **Actions ≥ 124px**, to hold an `Edit` + `Delete` pair. Only custom quizzes have both, which
  is why that column reads as empty space on every other row — it is reserved, not free.
- **Title ≥ 212px**, the width at which the longest real title ("Homework 5: Current,
  Resistance, & Electromotive Force") wraps to two lines instead of three. It gets 216.

The widest Type badge is 97px ("Midterm Exam") in a 104px column, so that one has ~7px of
slack: re-measure before shrinking it, and remember category names are instructor-authored.

Verified with a headless audit at 1280px that measures every cell's contents against its
column box (zero overflow), confirms each Due cell is a single 31px control row (no badge
wrap), and computes the minimum title width for a two-line wrap; plus the mobile card layout
at 390px, in both themes.

It reads the summary node and **not** `hwDrafts` on purpose. A draft carries every typed
answer, every feedback string and the whole Claude history per item — megabytes across a
class, and none of it needed to compute a percentage. The summary keeps that out of the
instructor's browser entirely, and stays one cheap read as the class grows.

Definitions, which are deliberate:
- **Percent** is weighted by **problem**, not by item, so 50% means half the assignment the
  same way the /10 score does. A `revealed` item counts as done: this measures how far through
  the student is, not what credit they earned.
- **Started** means a progress record exists (written on the first submitted attempt, or on
  leaving with something typed) or a submission does. Opening the set and walking away does not
  count.
- **Average** is over the **whole roster**, unstarted students included — the class-readiness
  number, not the average among the keen.
- A submitted student is 100% (their draft and progress record are cleared on submit); the
  submission's `timestamp` stands in as their last-worked time.
- 100% **without** a submission is drawn in amber: every problem finished but never handed in,
  which is the row worth chasing.

Students already mid-assignment when this shipped have no progress record until their next
save, so they read as not started until then. There is deliberately no fallback read of their
draft to backfill it: that would be a permanent extra read pattern to paper over a one-time
transitional gap.

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

**Uploads are compressed before they leave the browser** (`src/work-files.js`, added after a real
failed submission). A student's four phone photos run through iOS "Create PDF" arrive as a 145 MB
file whose pages are uncompressed 3024×4032 bitmaps; the `hwWork` Storage rule refuses anything
over 25 MB, and that refusal used to surface as an unexplained "your submission couldn't be sent"
after a multi-minute upload, with no retry that could ever succeed. `normalizeWorkFile` now runs at
attach time: pages are rasterized (lazy-loaded pdf.js) and reassembled as a JPEG-per-page PDF,
oversized images take the same downscale. That file compresses to **1.0 MB, 134x smaller, in about
1.7 s, with the handwriting fully legible**. Files already under `WORK_TARGET_BYTES` (2.5 MB) are
passed through untouched so vector PDFs keep their quality; the target is set by the integrity
check, whose base64 POST has to stay under a Netlify function's ~6 MB body cap (large PDFs were
previously uploading fine and silently never being checked). Anything that still will not fit is
refused at attach time, naming the file and its size.

### ~~Prompts are not copyable~~ ✅ Done
Every problem statement in the runner (the shared multipart stem and each part's prompt)
renders through `HomeworkRunner`'s local `Prompt` component, which wraps `MathText` in the
`.hw-no-copy` class (`index.css`: `user-select: none` + `-webkit-user-select` for Safari
< 16.4 + `-webkit-touch-callout: none` to kill the iOS long-press Copy callout) plus
`onCopy`/`onCut` blockers. This is the homework counterpart to the quiz question's inline
`userSelect: "none"` in `ChatMessages.jsx`, and it applies to every homework assignment at
once — nothing is configured per assignment. Browsers exclude unselectable text from a
Select All range, so that route is covered too; the handlers are belt-and-braces for one
that doesn't. **It is a speed bump, not a boundary** — the text is still in the DOM for
anyone who opens dev tools, and a phone camera defeats any version of this. The goal is
only to make pasting a problem into a chatbot deliberate rather than reflexive. Deliberately
**not** applied to `SubmissionView.jsx`, which renders prompts for instructors grading and
for students reviewing already-submitted work; nor to the `guide` step labels inside
`GraphField`/`VectorField`/`FBDField`, which are drawing instructions rather than the problem.

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

**The one exception: an angle the problem has not yet fixed.** Widen the tolerance when the
drawn angle is the problem's *unknown* rather than something the given data determine. PHY 215's
22.43 is the case — the FBD comes first and the thread's angle is exactly what parts (b) asks for,
so a ±5° window would grade an answer the student is not yet in a position to have. Its tension is
keyed at the figure's schematic 25° from vertical with **±22°**, which grades the qualitative fact
the FBD does establish (the tension leans back along the thread, so a straight-up arrow — the real
misconception, since nothing would then balance the electric force — is still rejected) and nothing
more. Pair the wide tolerance with **`angleSymbol`** on that force so the annotation reads `θ`
instead of a measured number, and so `snapFBDDirections` leaves the arrow where it was drawn.
Contrast 21.73, which asks the same physics but *states* the angle: there the tension is keyed at
±5° and annotated with its number. **The distinguishing test is not how hard the angle is to aim at,
it is whether the problem has given the student what they need to know it.**

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
11. **Use the source problem's wording VERBATIM** — see below.

### Wording — transcribe the problem, don't rewrite it

**A problem's prompt is the textbook's sentence, copied.** Do not paraphrase it, do not
"improve" it, do not add a formula or a structural hint to the stem, do not append unit
instructions, and **do not invent parts the source does not ask** — even when an added part
would be pedagogically nice. The instructor chose these problems as they are printed; a
reworded prompt silently changes the assignment, and a scaffolded one hands over the method
the problem exists to test. PHY 215's `hw4` is the reference set for this.

Only four adaptations are legitimate, and each is forced by the app rather than chosen:

- **Figure references.** "Fig. E24.16" becomes "the figure" — the served crops carry no caption
  and the runner has no figure numbering, so a figure number names something the student can't see.
- **One blank per value.** A part the source asks once about "each capacitor" becomes one item per
  capacitor, since a numeric item holds one value. Name the blank using the source's own label
  ($C_1$) or the value printed in its figure (the $150\text{-nF}$ capacitor), and add nothing else.
  Give near-identical quantities **separate** blanks rather than one blank plus a note that they
  agree, when *that* they agree is what the problem tests.
- **Units.** Never write "give your answer in nC" — `HomeworkRunner` renders the item's `unit`
  immediately to the right of the input box, so the prompt would duplicate what is already on
  screen. Choose the `unit` (usually the one the instructor key boxes) and let the field say it.
- **House style.** Plain text plus `$…$` math, no markdown, no em-dashes (see `CLAUDE.md`).

This does not weaken step 9: when a numeric genuinely doesn't serve a part, still choose the
fitting `answerType` — but grade *the question the source asks*, in its own words, rather than
rewriting it into a different question. Anything you think genuinely *should* be added — a missing
interpretation step, an unnoticed trap, a part worth splitting — goes in your summary to the user
and in the course doc as a **recommendation**, not into the assignment.

Two further things that look like wording but are not, and must also stay out of a prompt:

- **Stated physical constants** ("Use $e = 1.602\times10^{-19}\text{ C}$", "Use $g = 9.81\text{ m/s}^2$").
  The textbook prints these on its inside cover and does not restate them per problem, and the ±2%
  band absorbs every plausible rounding — checked across PHY 215 `hw1`–`hw3`, where 2-sig-fig
  constants and full CODATA values moved twelve constant-dependent answers by at most **0.14%**.
  If you ever doubt it for a new set, recompute rather than restating the constant.
- **Method hints appended to a `text` part** ("Explain, using the sign of the charge and what
  happens to $U = qV$", "Address both the enclosed charge and what happens to $E$…"). These name
  the method the part is meant to elicit. If the source says "Explain.", the prompt says "Explain."

PHY 215 `hw1`–`hw3` were authored before this rule and were revised to comply on 2026-08-17; see
[courses/phy215.md](courses/phy215.md) § Wording revision for the full list of what was reverted
and what was deliberately kept.

#### When a hint really is needed, use `freeHint` — never the prompt

Occasionally a problem turns on a single reading that is **not what it is assessing**, and without
that reading it tests noticing rather than physics. The fix is never to scaffold the stem. Put it
in the problem's **`freeHint`** field instead (added 2026-08-25 for PHY 215 `hw5`):

```js
freeHint: "The capacitor and $R_1$ are connected in parallel, so the voltage across $R_1$ is the same as the voltage across the capacitor. …",
```

It renders as an amber callout **under** the statement, is visible from the start, and **costs
nothing** — it is not the grader's `hintAfterAttempt` hint and not the graphical **Hint** button,
both of which cap the item's credit. Keeping it out of the prompt is the point: the textbook's
sentence stays verbatim and the hint is visibly the instructor's addition, not Y&F's.

Set it on the **problem** (for a multipart it renders once under the shared stem, above
`Part 1 of N`; for a single-part problem `itemsOf` copies it onto the lone item). A `part` can
carry its own if only one part needs it.

Use it sparingly, and only for a prerequisite reading. It is **not** for method hints of the kind
banned above ("use $U = qV$"), and not for anything the problem exists to test. The first two uses
are PHY 215 `hw5`'s 25.83 and 25.84, where "a fully charged capacitor branch carries no current"
and "parallel elements share a voltage" are prerequisites to a circuit problem about neither.
Adding one is an instructor decision: propose it in your summary rather than adding it yourself.

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

**When the textbook's figure is wrong, draw your own.** Step 2 of the procedure (check the figure
against what you solved) exists to catch a figure that contradicts the problem, and it does happen:
Y&F's Fig. P22.43 draws a positive ball deflected *toward* a positively charged sheet, i.e.
attracted, when the problem's own $\sigma > 0$ requires repulsion. Do not ship a figure that
teaches the wrong physics, and do not silently drop it either if the problem reads better with one.
Author a replacement: write it as an inline SVG in a small HTML file, render with headless Chrome
(`--headless --screenshot --force-device-scale-factor=2 --window-size=W,H`) for a 2x PNG, and keep
the HTML source **beside the PNG** in `public/homeworkFigures/<courseType>/HWn/` as
`<name>.source.html` so the figure can be edited later. Keep it on a white background so it sits
consistently beside the textbook screenshots, and keep any *drawn* angle schematic rather than
equal to the answer. Then log the correction in
[answer-key-discrepancies.md](answer-key-discrepancies.md) — a bad figure is worth reporting to the
publisher, not just to the instructor. First instance: `figP22-43.png` (PHY 215 hw2).

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
   - **PHY 215 (`physics2`)** — `hw1` (Ch. 21), `hw2` (Ch. 22, Gauss's law), `hw3` (Ch. 23,
     electric potential) and `hw4` (Ch. 24, capacitance and dielectrics) are authored and
     verified; later weeks are added as each is prepped.
     Per-assignment notes: [courses/phy215.md](courses/phy215.md). `hw4` is the first set in
     either course that is **entirely numeric** and has **no** graphical part — Ch. 24 has no field
     direction to draw and no free body to isolate, and no `answerType` can grade a network
     reduction, which is the real skill in its circuit problems. It is also the reference set for
     **verbatim problem wording** (see below).
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
   (4.27, 4.34, 4.57 — two boxes on a vertical rope, one FBD per box, no normal force). Off-axis
   forces arrived with PHY 215's 21.73 (tension along a string at a *given* 17.4°, graded ±5° and
   annotated with its number).
   - **Symbolic angles (2026-08-11):** `angleSymbol` on the `fbd` config labels every off-axis arc
     with a name (`θ`, or `θ_1`/`θ_2` when several forces are off-axis) instead of a measured
     number, and step 3's note tells the student to carry the symbol through their equations. On a
     *force* it also excludes that arrow from `matchedDir`, so `snapFBDDirections` leaves it as
     drawn. This is what makes an FBD askable **before** the angle is known — the ordering the
     lecture method actually teaches (diagram → equations → solve). First used in PHY 215's 22.43,
     which without it could not have had an FBD part at all: the annotation would have printed the
     answer. See § Angular tolerance for the tolerance that goes with it.
   - **Future:** richer per-force angle inputs, optional required equilibrium/Newton's-second-law
     check, label text per force.
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
- The runner's top bar carries the app's **light/dark toggle** (`lightMode` / `onToggleTheme` props,
  wired to App.jsx's `setLightMode`). It is a full-screen takeover with no portal header around it,
  so this is the only way to switch theme without leaving the assignment — and homework is where a
  student is most likely to want to: the figures are white-background textbook screenshots and the
  drawing fields are the finest-detail UI in the app. The **quiz** screen has the same toggle for
  the same reason (inline in App.jsx, since it is not a separate component). Keep the two in sync:
  if one gains a control here, ask whether the other needs it.
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
