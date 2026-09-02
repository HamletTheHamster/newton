# Instructor analytics

The Analytics tab (`instructorSection === "analytics"`, `src/screens/instructor/Analytics.jsx`)
answers questions about the class that the Gradebook can show but not summarize: which
assignments actually predict exam performance, which problems the class struggles with, and
how students are engaging with the work.

All three phases are shipped. The tab has four views, switched by tabs across the top:
**Correlation**, **Items**, **Students** and **Pulse**.

## Why a separate tab

Two reasons, both structural rather than aesthetic:

- The Assignments hub is already at its column budget. Its `GRID_COLS` leaves ~7px of slack on
  the Type column and the title needs every pixel it has (see the `Assignments.jsx` row in
  CLAUDE.md). There is no room to bolt cross-assignment analysis onto it.
- The interesting questions are **cross-assignment by nature** ("does homework predict the
  midterm", "which problems are hardest across the set"). A per-assignment modal is the wrong
  shape for them.

## Correlation (phase 1)

Pick an outcome, normally the midterm or the final, and see which assignments predict scores on
it. Every number is derived from data the app already stores: `submissions` plus
`gradeOverrides`, resolved through the shared score matrix. **No new Firebase node and no new
instrumentation.**

### Layout

| Panel | What it is |
|---|---|
| Controls | Outcome selector, the missing-work toggle, CSV export. One row above the charts. |
| Strength of relationship | Ranked **diverging bars**, one per assignment, `r` on a fixed -1..+1 scale. Click a row to plot it. |
| Scatter | The selected assignment vs. the outcome, one dot per student, with a least-squares trend line and a stat row (`r`, `r²`, n, 95% interval). |
| All assignments | The same numbers as a table, which is also what makes the charts accessible. |

### The statistics (`src/analytics.js`)

- `pearson(pairs)` returns `null` rather than `0` when there are fewer than 3 pairs **or** when
  either variable has no variance. "Everyone scored 10/10" is a real and common outcome on an
  easy assignment, and reporting it as "no relationship" would be wrong.
- `correlationCI(r, n)` gives a 95% interval via the Fisher z-transform. This is the honest
  counterweight to a headline `r`: a class of 25 is a small sample, and `r = 0.45` there carries
  an interval of roughly `[0.07, 0.72]`. The UI shows the interval beside every coefficient and
  says outright when it spans zero.
- `linearFit(pairs)` is the trend line only. It is presentation, never grading.

There is deliberately **no p-value**. The confidence interval answers the same question more
usefully and cannot be read as a pass/fail gate the way `p < 0.05` invites.

### The missing-work toggle

This is a genuine analytical fork, not a cosmetic filter.

- **On (default)** — a past-due, unsubmitted quiz or homework counts as 0, exactly as the
  gradebook grades it. This is the truth about the student's term, which is why it is the default.
- **Off** — only work a student actually turned in is paired.

Turning it off asks whether the relationship holds *among the students who did the work*. If a
strong correlation collapses, much of it was coming from who submitted rather than how well they
did. Excused work is excluded either way, and an exam with no marks entered is never treated as
a zero (see `countsTowardGrade`).

### Chart choices

Per the house data-viz rules:

- The ranked bars are a **diverging** form, because correlation has polarity. Two hues either
  side of a neutral zero rule, never a single ramp, and the scale is pinned to -1..+1 rather
  than auto-fitted so a bar means the same thing after switching outcomes.
- Selection changes **opacity only**. The hue always follows the sign, so a reader who learned
  "teal means it predicts the exam" never sees that bar in another color.
- The scatter is a single series, so it carries no legend; the panel title names it. Its plot
  area is **square** and both axes are pinned 0-100: equal px-per-percent is what lets the eye
  read the trend line's slope honestly, and a fixed domain keeps two assignments comparable.
- The diverging pair was run through the colorblind/contrast validator for light **and** dark
  (lightness band, chroma floor, protan/deutan separation, contrast vs. the card surface)
  rather than picked by eye. `CORR_POS = #0e9e90` passes in both modes; only the negative pole
  needs a per-mode step (`#c25d10` light, `#dd7024` dark). **Re-validate before changing either.**
- Below 768px the six-column table drops to three columns with the plain-language reading folded
  under the title. Letting it scroll sideways instead left a truncated "R SQUARED" header
  reading as a second "R".

### Predictors: what an assignment is measured by

The **Measured by** selector switches what the correlation is computed on. This exists because
homework scores are **ceiling-compressed** by the 3-attempt/hint/reveal schedule: most students
finish near full credit, and restriction of range attenuates correlation badly at class-sized n.
A homework can genuinely teach the exam while its *score* correlates weakly, simply because the
score has almost no variance left to correlate with.

| Measure | What it is | Expected direction |
|---|---|---|
| **Assignment score** | percentage earned. Every assignment, the phase 1 behaviour. | positive |
| **Attempts to correct** | mean tries on the problems the student eventually got right. Homework only. | **negative** — fewer tries should go with a higher exam score |
| **Time on task** | minutes actually spent, excluding hidden and idle time. Homework only. | **either** — and which way it points is the finding |

Details that matter:

- **Only items the student got right contribute an attempts figure.** A revealed item's five
  failed tries are the cost of giving up, not of succeeding, and counting them would make giving
  up look like diligence. A student needs at least three resolved items before a mean is
  reported at all; below that it swings on one lucky problem.
- **Attempts come from the submission where there is one** (it stores the exact per-item count
  and is the completed record), falling back to the telemetry attempt log for a student still
  working. The two are never mixed *for the same student*, so one student's figure is never half
  exact and half approximate.
- **The effort measures add a pooled "All homework combined" row**, pinned to the top. Pooling
  every problem across the term is the most statistically powerful row available at class-sized
  n, and is usually the one worth reading first.
- **The expected direction is displayed, never baked into the sign.** Flipping a coefficient so
  every bar points right would hide exactly the surprises worth seeing.
- **The missing-work toggle is hidden for the effort measures.** It is a question about scores;
  there is no "zero attempts" for a student who never opened the assignment.
- The x axis is a percentage only for scores. Attempts and minutes get a domain fitted to the
  data and rounded outward to a nice step, so ticks read 0/100/200 rather than 0/111.3/222.5.

### Two rules the tab must not break

Both were real bugs found against a live class, and both are the kind that produce a confident
wrong answer rather than an error.

**Submissions are scoped to the roster.** App.jsx flattens the whole `submissions` node without
checking the roster, so a removed or never-enrolled student's work survives in it. The Gradebook
never sees them because it iterates the roster; the analytics did, and reported a homework
submission the gradebook said did not exist. The Analytics shell filters once
(`rosterSubmissions`) and every view below it reads that.

**Coincident scatter points are drawn as one marker with its count on it.** Course grades are
heavily discretized: a quiz where the whole class scored 10/10 puts every student on a single
pixel. Plain markers silently drew ten students as two dots, and the natural thing to do with a
scatter is count the dots. Stacks are sized by how many students share the coordinate, labelled
with the count, and the tooltip names them. The regression is still fitted to the raw points, so
every student weighs the same however many share a position.

A related wording rule: `readingFor` distinguishes **"not enough data"** (fewer than three pairs)
from **"no variation to measure"** (plenty of students, all with the same result). Calling the
second one missing data is wrong, and with mastery-style grading it is the common case: an
assignment everyone aces genuinely cannot predict anything, and that is a finding about the
assignment rather than a gap in the data.

## The shared score matrix

`buildScoreMatrix` (`src/analytics.js`) builds the student × assignment grid of **effective**
scores, and `Gradebook.jsx` now uses it too. That is the point of the extraction: a gradebook
cell, a student's Overall, and every correlation on this tab are computed from one derivation
and cannot drift.

It returns `scoreMap`, `excusedMap`, `flaggedMap`, `absentMap` and `subsByStudent`, each keyed
`[studentId][assignmentId]`, all resolved through `resolveScore` — so the whole priority chain
(override > lecture absence > part overrides > submission, then the upheld-integrity penalty)
applies identically everywhere. See [grading-scores.md](grading-scores.md).

`countsTowardGrade(assignment, {...})` is the companion rule: a past-due quiz or homework with
no submission is a real zero, an unmarked exam is not. It was previously written out twice (in
`Gradebook`'s `activeAssignments` and again in `StudentGrades`), so the analytics view would
have been a third copy.

> **`StudentGrades.jsx` still has its own copy of that rule.** It was left alone in this pass to
> keep a grading refactor out of a feature change. Fold it into `countsTowardGrade` next time
> that file is touched.

## Engagement telemetry (phase 2)

`src/hw-telemetry.js` is the accumulator; `HomeworkRunner` feeds it browser events and writes it
to `classes/{classId}/hwTelemetry/{studentId}/{hwId}`:

```
items: { [itemId]: {
  activeMs, hiddenMs, hiddenCount, unfocusedMs, unfocusedCount,
  pasteCount, firstSeenAt, firstSubmitAt, resolvedAt,
  attemptLog: [{ at, answer, correct, awayMsBefore, msSinceReturn }]
}},
sessions: [{ start, end }],
updatedAt
```

Roughly 1-3 KB per student per assignment.

### Why it is built this way

- **Aggregates, not a raw event stream.** An append-only event log is O(seconds) and would
  balloon RTDB. Per-item accumulators are O(items), and `attemptLog` is bounded by `maxAttempts`.
- **Written through `persistDraft()`**, the same chokepoint that already writes `hwDrafts` and
  `hwProgress`, so the three cannot drift. Cleared by `clearDraft()` on final submit and copied
  onto the submission by `buildSubmission`, which is then the only record.
- **Kept out of the App.jsx class cache**, like `hwDrafts`/`hwAttempts`/`hwProgress` — it is
  per-student and only the instructor's drill-down wants it. Only `database.rules.json` changed.
- **Never written in practice or preview mode**, like every other per-student path in the runner.
- **Restored on mount** from the saved node, so a student working across several sittings
  accumulates time rather than restarting the clock each visit.
- **Cannot break homework.** Every call goes through a `tele()` guard that swallows throws, and
  the snapshot is wrapped separately so a malformed accumulator cannot stop the draft saving.

### The accounting rules

These are what make the numbers mean anything, and they are the reason the module is separate
and tested rather than inline in the runner.

1. **Active time excludes time away.** Accrual runs only while the tab is visible, the window is
   focused, and the student has done something in the last `IDLE_MS` (120s, generous because
   reading a problem and working it on paper are both legitimately input-free). A segment that
   runs through an idle stretch banks only the part before the student went quiet — **this was
   a real bug caught by the tests**, where the whole stretch was credited as time on task.
2. **`hiddenMs` and `unfocusedMs` are different things and are never summed.** Hidden comes from
   the Page Visibility API and is reliable. Unfocused means the window lost OS focus while the
   tab was still on screen, and is noisy (OS notifications, screenshot tools, devtools, the
   app's own file picker). They are kept **disjoint** — unfocused only accrues while the
   document is visible — so a tab switch is never counted twice. The UI shows a trip *count*,
   never a summed duration, with the two broken out in the tooltip.
3. **Excursion shape beats excursion total.** Each attempt records `awayMsBefore` and
   `msSinceReturn`, so "left for 90s, came back, submitted a correct answer 4s later, on every
   problem" is distinguishable from one long gap mid-set.

Excursions under 2s are ignored (notification flicker); a gap over 30 minutes opens a new
session rather than counting as an excursion; a single segment is capped at 10 minutes so a
sleeping laptop that never fired a visibility event cannot dump hours onto one problem.

**Paste is logged, not blocked**, on the numeric and text inputs. Blocking a numeric field is
user-hostile and trivially defeated; a count is free evidence and costs the honest student
nothing. (The quiz textarea still blocks paste — a different surface with a different purpose.)
MathLive's `math-field` is a web component and is not covered.

### Where it surfaces

The Assignments hub's progress modal: click the Progress cell for a homework, then click any
student. The panel shows time on task, sittings, problems opened and paste count, then a
per-problem table of time, time-to-first-attempt, tries and trips away. Reading it back is
`totalActiveMs` / `formatDuration` / `timeToFirstAttemptMs` from the same module.

### Limits, and what follows from them

It does not see a phone next to the laptop, and it cannot tell a textbook tab from a chatbot tab
— no browser API exposes other tabs, and none should. Leaving the tab is also completely normal:
the syllabus, a unit converter and Desmos all live elsewhere. So:

- **Away time never appears as a standalone ranked column.** Its legitimate uses are correcting
  `activeMs`, the shape of excursions inside one student's own timeline, and per-problem class
  aggregates ("problem 7 has triple the away-time" usually means the figure is unclear).
- **`timeToFirstAttemptMs` is the sharpest single number** but must be read as a percentile
  against the class on the *same* item, never against a fixed threshold, and never alone.
- Build for "who might be worth a conversation", never for a verdict — the way the integrity
  flag defaults to full credit until an instructor upholds it.

### Tests

`src/hw-telemetry.test.mjs`, run with `node src/hw-telemetry.test.mjs`. Plain node, no framework,
in keeping with the repo having no test runner. It exists because every figure this module
produces is silently plausible when wrong, and an instructor may make a judgement about a student
from it.

## Items (phase 3)

Per-problem statistics for one homework, derived from the `problems[].parts[]` breakdown every
submission already carries, plus telemetry for timing and wrong answers.

The two columns that carry the argument are **mean** and **discrimination**, and they are only
useful together:

| | high discrimination | low / negative discrimination |
|---|---|---|
| **low mean** | a hard problem doing its job. Reteach it, keep it. | the strong students are missing it too. Almost always the wording, the figure or the key. |
| **high mean** | an easy problem that still sorts the class. Fine. | an easy problem that tells you nothing. Cheap to keep, cheap to cut. |

Discrimination is the **corrected** item-total correlation: this item's score against the sum of
the *other* items. Correlating against a total that includes the item inflates every coefficient,
which would make a useless item look discriminating simply because it is part of its own total.

**Common wrong answers** is the most directly actionable output in the tab. A cluster on one
value is usually a single shared misconception (a dropped factor of 2, degrees for radians) and
makes a lecture slide on its own. Two guards keep it honest: a value is only listed if **two or
more students** gave it, so a single student is never singled out and a one-off typo is never
mistaken for a pattern; and one student contributes each distinct wrong value **once**, so
retyping the same wrong answer five times cannot manufacture a class-wide pattern.

The "problems worth a second look" panel is capped at the three weakest. When more than half the
set discriminates weakly it reframes instead: that is usually the sample (few submissions, or a
uniformly easy or hard set) rather than six separately badly-worded problems.

## Students (phase 3)

The class across the term, and a per-student drill-down.

There is deliberately **no risk score**. A composite would rank students by a formula nobody can
see, and every column has an innocent reading on its own: a student with little time on task may
work on paper; one quiet for a week may have been ill. The table shows the components, sorts by
the one ordering that needs no interpretation (overall grade, lowest first), and lets the
instructor sort by any of the others. Badges state only plain facts ("4 missing", "quiet 21d"),
never an inference about why.

Overall goes through the same `calcGrades` the Gradebook uses, on the same `countsTowardGrade`
filter, so this column can never disagree with the gradebook's Overall.

## Pulse (phase 3)

Students active per day (single-series area, from telemetry sessions and submission times, one
count per student per day however long they worked), a completion funnel per recently-due or
upcoming assignment, and a list of students nobody has seen in over a week.

The funnel's third bucket is why this view exists: **finished, not handed in**. A student who
completed every problem and never pressed Finish and Submit reads as *missing* in the gradebook,
exactly like a student who did nothing, so without this they are invisible until the grade is
already a zero. It is the one bucket usually worth an email, because the work is done.

## Implementation notes

- **`mergeTelemetry` is not optional.** Telemetry lives in two places: the live `hwTelemetry`
  node for students still working, and a copy on the submission for everyone who has handed in
  (the node is cleared at final submit). A view that reads only the node reports every student
  who *finished* as having spent no time, which is backwards. The shell merges once and passes
  the merged map to every view.
- **The engagement reads are lazy.** `hwProgress` and `hwTelemetry` are fetched as two whole-node
  GETs the first time an engagement view is opened, so a visit that only wants the exam scatter
  never pays for them. They reset when the class changes.
- **Chart forms** follow the same rules as phase 1. The attempt spread and the funnel are ordered
  categories, so they use the validated **ordinal ramp** (one hue, monotone lightness, visible
  step gaps) and never a categorical set; both ship a legend, since identity is never carried by
  color alone. The activity chart is one series, so it has no legend. Palette and shared marks
  live in `analytics-ui.jsx` with the validator command in a comment at the top.
- **Tests:** `node src/analytics.test.mjs` covers the item statistics, the discrimination
  direction (checked against hand arithmetic, not pinned to whatever the code returned), the
  wrong-answer guards, the funnel and the activity window.

## Possible next steps

Nothing here is committed to. Candidates, roughly in order of value:

- **Item analysis across a whole course**, not one homework at a time, so a topic that never
  lands is visible as a run of weak items rather than one bad problem.
- **Quiz item analysis.** Quizzes store a chat transcript rather than a per-item breakdown, so
  this needs a different derivation than `buildItemAnalysis`.
- **Fold `StudentGrades.jsx`'s copy of the counting rule into `countsTowardGrade`** (see above).
