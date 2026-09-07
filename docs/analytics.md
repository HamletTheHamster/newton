# Instructor analytics

The Analytics tab (`instructorSection === "analytics"`, `src/screens/instructor/Analytics.jsx`)
answers questions about the class that the Gradebook can show but not summarize: which
assignments actually predict exam performance, which problems the class struggles with, and
how students are engaging with the work.

All three phases are shipped. The tab has four views, switched by tabs across the top, ordered
from the most immediate question to the most reflective: **Pulse**, **Students**, **Items**,
**Correlation**. The first tab is also the landing view.

## The panels explain themselves, or they are not finished

**No explainer chrome anywhere on this tab: no `subtitle` under a panel heading, no blurb under
the Analytics heading, and no circled-i popovers on Pulse.** An element that needs a sentence of
prose to say what it shows is not designed well enough yet, and the sentence hides the fact that
it isn't.

What a reader genuinely needs in order to read a chart goes into the chart's own furniture, where
it is met without knowing to look for it: the panel **title** (which is why it reads "When the
class works (last 90 days, your local time)", "Quiet students (over a week with no activity)",
"Per student, fewest opened first"), the **axis and legend labels**, and the **unit named in the
tooltip**. `Panel` in `analytics-ui.jsx` therefore has no `subtitle` prop at all - re-adding it is
how the prose creeps back one panel at a time.

The distinction that keeps this from deleting things that matter: **a description of the panel is
chrome, a finding about the data is content.** Findings stay, in the panel body, as body text:
AnalyticsItems' "with few submissions that is usually the sample rather than the problems" (the
one thing standing between that list and an instructor rewriting six good problems), and
AnalyticsMaterials' tracking-start note and "worth a question, not a conclusion" note. What only
a maintainer needs - that the heatmap is built from discrete events rather than session spans,
say - lives in this file and in code comments, not on screen.

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
| **Course materials opened** | share of a module's posted readings, notes and links the student clicked. Modules, not assignments. | positive |

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
- **Course materials rank MODULES, not assignments.** A single file is one click — far too
  coarse to correlate on its own — while a module's *share* opened is a per-student number with
  real spread, and the pooled "All course materials" row over the whole term is the headline.
- **A student with no records at all is a zero, not missing data.** This is the one place the
  predictors differ in kind: absence of an attempts or time figure means "not measured", but a
  material was posted to everyone, so a student with no record genuinely opened none of it. Drop
  them and the chart is built only from the students who clicked, which is the population the
  question is about.
- The x axis is a percentage for scores **and for materials opened**. Attempts and minutes get a
  domain fitted to the data and rounded outward to a nice step, so ticks read 0/100/200 rather
  than 0/111.3/222.5.

### Two rules the tab must not break

Both were real bugs found against a live class, and both are the kind that produce a confident
wrong answer rather than an error.

**Every input is scoped to the analytics roster.** App.jsx flattens the whole `submissions` node
without checking the roster, so a removed or never-enrolled student's work survives in it. The
Gradebook never sees them because it iterates the roster; the analytics did, and reported a
homework submission the gradebook said did not exist. The Analytics shell scopes once, at the top,
and every view below it reads the scoped values. See [Who counts](#who-counts) for the second
entry that scoping drops.

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

## Who counts

An instructor normally sits on their own roster. It is the only way to walk an assignment the way
a student walks it: the homework runner reads `loggedInStudent` for drafts, attempt counts, the
work upload and the submission, so there is no way to exercise those paths from the instructor
side. That entry then behaves like a student in every respect. It submits, it accumulates
telemetry, it opens materials, it can be marked absent, and none of that is coursework. In a class
of two dozen it is not noise either: one extra entry moves an r, a class average, an open rate and
a grade distribution, and it adds a row to the gradebook, a name to the attendance roll and a line
to the Blackboard export that no registrar has heard of.

So exactly one roster entry per class may carry **`instructorAccount: true`**. It is one more
optional roster field beside `altName` and `nicknameLocked`, so there is no new RTDB node, no
rules change, and it survives backup and restore. `src/roster-scope.js` holds the rule and the
scoping helpers; `src/roster-scope.test.mjs` covers them.

**One picker, not a switch per row.** The fact being recorded is "which of these entries is me" —
one answer per roster — and not a property each student has. It is a single "My own account"
select above the roster table; the marked row then shows a read-only "your account" badge, since
the difference is invisible from that table and shows up two tabs away. Setting it clears the
previous holder first, so the at-most-one invariant lives at the only place that can write it.

**Where it applies.** App.jsx derives `classStudents` once and passes it as the `roster` prop to
the four views where the roster means "the students I am assessing": the Gradebook (so no row, and
nothing in the CSV or Blackboard export), this tab, the Assignments hub's progress column, and the
attendance roll. It deliberately does **not** apply where the roster means something else: the
student login picker still lists the account, and an announcement broadcast still emails it.

Three decisions are worth keeping:

**Absent means student.** An explicit `false` means student too, and only picking a name can mark
an entry. Both directions of failure are silent, but they are not symmetric: an uncounted test
account is a mildly wrong number, while an accidentally uncounted *student* disappears from the
class the instructor is reading about, with no error and no empty row to notice.

**It is read-side only.** The marked account still writes telemetry, drafts, submissions and views
exactly like a student, because exercising those write paths is the entire point of having it.
Nothing is deleted and nothing is hidden from the account itself: it still sits its own homework
and still sees its own grades.

**It is not a grading policy in disguise.** The account is left out of the gradebook because it is
not a student, not because its work is being discounted. A real student's marks never depend on
this field, and the flag cannot be set on one by any path except naming them in the picker.

The per-student nodes are scoped by the same id set, not just by the roster: `buildActivityByDay`,
`lastActiveMap` and `timeOnTaskMap` walk `hwTelemetry`'s own keys rather than iterating the roster,
so filtering the roster alone would leave the account in the activity chart and the time-on-task
figures.

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

**Analytics → Students → a student → any homework row** (`src/screens/instructor/StudentWorkDetail.jsx`).
The panel shows time on task, sittings, problems opened and paste count, then a per-problem table
of time, time-to-first-attempt, tries and trips away; clicking a problem opens the attempts behind
it, with what the student actually typed each time. Reading it back is `totalActiveMs` /
`formatDuration` / `timeToFirstAttemptMs` from the same module.

It used to live in the Assignments hub, three clicks deep and inside a modal opened from another
modal, at ~560px wide. It is a reading view, not a control, so it now sits on the Analytics page
at full width; the Assignments hub keeps its class-progress list and points here. Only a homework
row with something recorded is clickable, so the click never opens an empty panel.

The attempt trail is the part the small window could not carry, and it is the teaching payoff of
the whole node: "4.9, then 9.81" is a dropped factor of two that the student found on their own,
and it is invisible in a score. It reads `attemptLog`, which is capped at the last few attempts
per item, and it is behind a click so the table above stays a table.

The component takes its telemetry as a **prop** and does no reading of its own: the Analytics tab
already holds the merged whole-class map, so a per-student read here would re-fetch a node the
caller has and would go out again on every back-and-forth.

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

The drill-down has a third level: a homework row with recorded engagement opens
`StudentWorkDetail`, the per-problem "how they worked through it" panel described under
[Where it surfaces](#where-it-surfaces). That is the one place in the app to watch a student work
a set, and it is a click from the row it belongs to rather than three modals deep.

## Pulse (phase 3)

How many students are working right now (a header tile), students active per day (single-series
area, from telemetry sessions and submission times, one count per student per day however long they
worked), a day-by-hour grid of when the class works, a completion funnel per recently-due or
upcoming assignment, and a list of students nobody has seen in over a week.

This view carries no popovers and no panel subtitles; see
[The panels explain themselves](#the-panels-explain-themselves-or-they-are-not-finished). Three
popovers were removed from here (what counts as "right now", what a heatmap cell counts, what the
third funnel bucket means) and so were four subtitles. The unit that mattered most, the
**student-hour**, is named in the heatmap's scale and in every cell tooltip, and the funnel's
third bucket is named by its own legend label, "Finished, not handed in", which is why that label
has to state the bucket rather than abbreviate it.

### Working now (header tile)

`activeNow` (analytics.js): every student whose telemetry carries a write in the last
`WORKING_WINDOW_MS` (15 minutes), grouped by the assignment they are on. It works only because
telemetry is written continuously - `persistDraft()` snapshots on every graded attempt and on a
1.2s typing debounce - so a recent `updatedAt` means the student was doing something then.

It is **a count and its window, and nothing more**: the "Working now" tile shows how many students
and how many assignments they are spread across, with the window named in the hint. There used to
be a panel below listing them by name with a paragraph of caveats; the count is what gets acted on
during a homework night, and the panel spent most of its height explaining itself.

Two things about the figure still constrain how it may be read, and one is enforced in code:

- **It is "recorded active", never "online".** There is no presence node and no heartbeat. A
  student reading the problem on paper writes nothing, so a `0` is not evidence that nobody is
  working. Do not reintroduce wording anywhere that treats it as a presence count.
- **A student who has submitted is excluded**, however recent their stamp. `mergeTelemetry` copies
  the telemetry carried on a submission over the live node, so the moment someone hands in, their
  last write looks exactly like fresh activity - which would report the one student who just
  finished as the class still working.

**The reading is only as fresh as the last node read**, so the view re-reads while it is on screen:
`AnalyticsPulse` polls `onRefresh` (the shell's `readEngagement`) every 60s, matching App.jsx's
`refreshClassContent` cadence, gated on `document.visibilityState` so a tab left open all evening
does not re-read the largest node in the class for nobody. The poll is deliberately **quiet**: it
neither clears `engagement` nor raises the loading flag once there is data, or every view would
blank or flash once a minute.

This tile replaced "Finished, not handed in" in the header. That number is still on the funnel,
where the bar names the students in it; as a headline it was the least immediate of the three.

### When the class works

`buildActivityByHour` (analytics.js): a day-of-week × hour-of-day grid over the last 90 days,
answering the scheduling question no other view can - whether a deadline lands on the night the
class is actually free, whether anyone starts before the day it is due, whether the work happens
at 2am.

It is built from **discrete events, never from session spans**, and that is the whole design. A
session is a sitting from open to last write, so a tab left open overnight would smear eight hours
of "activity" across the small hours - exactly the fiction hw-telemetry.js's first accounting rule
exists to prevent. Each mark is instead a moment the app recorded something: a sitting opening or
being saved, a graded attempt, a submission.

A cell counts **distinct (student, date, hour) buckets**, so a student who fires twenty answers
between 9 and 10pm adds 1, the same as one who worked quietly through the hour. No single student
can shape the grid, and the number reads as "student-hours in which someone was working".

Chart rules: this is a **magnitude**, so it takes the one-hue sequential `ramp` in analytics-ui.jsx
(generated in OKLCH along `CORR_POS`'s own hue and validated as an ordinal ramp in both modes),
never a categorical set. A cell with no activity takes the neutral `rampEmpty` rather than the
ramp's bottom step, so "nothing happened here" never reads as "a little happened here". All 24
hours are drawn even though most are empty for most classes: the empty half is the finding as
often as the busy half, and cropping would quietly rescale the picture every time one student
worked at 3am. Hover changes the cell's **outline**, never its fill, since the fill is the
encoding. The scale is always present with the counts each band stands for, and row totals are
printed beside the grid because the day-of-week answer is the one that gets acted on and reading
it off shaded cells is guesswork.

Only work students can **actually open** is listed. "Open" means released, not un-expired: late
work is always accepted at half credit (`isLate` in utils.js, and the `late` handling in
`HomeworkRunner` and `finishQuiz`), so a past-due assignment is still open and still worth
chasing. What is excluded is anything a student cannot reach - an unreleased module or a hidden
item - which used to appear with the whole class in "not started", which is true and useless.
The filter is App.jsx's own `assignmentLocks`, the same map that gates the student calendar and
To Do rail, so the three cannot disagree.

The funnel's third bucket is why this view exists: **finished, not handed in**. A student who
completed every problem and never pressed Finish and Submit reads as *missing* in the gradebook,
exactly like a student who did nothing, so without this they are invisible until the grade is
already a zero. It is the one bucket usually worth an email, because the work is done.

## Materials (phase 4)

Which students have clicked to open the readings, lecture notes, links and pages posted in the
modules. Two panels: open rate per material, grouped by module in the order students see them
(click a row for the names on both sides of it), and a per-student list ordered fewest opened
first. Derivations are in `src/material-views.js`, covered by `node src/material-views.test.mjs`.

**An open is not a read, and the view must never let anyone believe otherwise.** A record means
the browser was handed the file; it says nothing about whether a word of it was read, and a
student working from the paper textbook or a classmate's printout can learn the material without
generating a record at all. So every figure is worded as an *open*, the caveat sits under the
panel rather than behind a tooltip, and there is deliberately **no "engagement score"** collapsing
these counts into a number that looks like a judgment. The per-student panel says outright that
the top of the list is worth a question, not a conclusion.

What the data can honestly support:

- **An unopened handout is a fact.** "Nobody in the class opened the week 6 notes" is usually
  about the posting — wrong file, buried in a module, never mentioned in lecture — rather than
  about the students, and it is invisible without this.
- **Whether opening tracks with performance at all**, via the correlation predictor. That is a
  statement about the students, never about cause: the plausible mechanism runs both ways, since
  students who are keeping up are also the ones clicking.

Three rules keep the counts meaningful:

- **A placeholder is not material.** A seeded item with no file or URL behind it (`{ type:
  "file", uploadId: null }`) renders with no click target, so counting it would report the whole
  class as having ignored a file that was never posted, and every unfinished module would drag
  the class average down. `isMaterialItem` requires an actual target.
- **A hidden item is not material either** — a student cannot open what they cannot see. Records
  it collected before being hidden simply stop being listed.
- **Tracking has a start date.** `MATERIAL_TRACKING_SINCE` is stated in the panel, because
  material posted before it shows as never opened, and the reason is that nothing was watching,
  not that nobody looked. It stops mattering once every posted material postdates it.

Storage is `classes/{classId}/materialViews/{studentId}/{itemId} = { first, last, count }`, keyed
by the module item's stable `id`, so a record survives a rename, a reorder and a file replacement.
The student's own portal writes one leaf per item (a PATCH addressing that one item, so a second
tab's click on a different item cannot be erased); the instructor's tab reads the whole node
lazily, in its own GET separate from the telemetry one, so a visit to Materials never pays for
telemetry and a visit to Pulse never pays for this. `count` is read-modify-write from local
state, so two tabs opening the *same* file in the same moment can lose one increment — accepted,
because what is read here is *whether* a student opened the material, and the record's existence
carries that whatever happens to the tally.

## Implementation notes

- **`mergeTelemetry` is not optional.** Telemetry lives in two places: the live `hwTelemetry`
  node for students still working, and a copy on the submission for everyone who has handed in
  (the node is cleared at final submit). A view that reads only the node reports every student
  who *finished* as having spent no time, which is backwards. The shell merges once and passes
  the merged map to every view.
- **The engagement reads are lazy.** `hwProgress` and `hwTelemetry` are fetched as two whole-node
  GETs the first time an engagement view is opened, so a visit that only wants the exam scatter
  never pays for them. They reset when the class changes.
- **Chart forms** follow the same rules as phase 1. The activity chart is one series, so it has
  no legend. Palette and shared marks live in `analytics-ui.jsx` with the validator command in a
  comment at the top.
- **The stacked bars use a four-slot categorical series, not an ordinal ramp.** They started as
  a single-hue ramp, which is the textbook choice for ordered buckets, and it was replaced
  because it did not work for the person reading it: four steps of one hue in a 10px bar are
  genuinely hard to tell apart. Legibility for the actual reader beats the orthodoxy, and these
  buckets are better described as distinct states than as points on a magnitude scale. The hues
  and **their order** are the validated reference palette's first four slots (blue, orange,
  aqua, yellow); a stacked bar only puts *adjacent* segments side by side, and that sequence is
  what clears the colorblind and normal-vision floors on the adjacent pairlist in both modes.
  **Re-run the validator rather than shuffling the slots.** Light mode leaves two slots under
  the 3:1 contrast target, which obliges visible relief: both charts ship a legend, per-segment
  tooltips, and the numbers in text beside or below the bar.
- **Tests:** `node src/analytics.test.mjs` covers the item statistics, the discrimination
  direction (checked against hand arithmetic, not pinned to whatever the code returned), the
  wrong-answer guards, the funnel, the activity window, and the materials predictor end to end
  (including that a student who opened nothing reaches the correlation as a zero).
  `node src/material-views.test.mjs` covers the material derivations themselves.

## Possible next steps

Nothing here is committed to. Candidates, roughly in order of value:

- **Item analysis across a whole course**, not one homework at a time, so a topic that never
  lands is visible as a run of weak items rather than one bad problem.
- **Quiz item analysis.** Quizzes store a chat transcript rather than a per-item breakdown, so
  this needs a different derivation than `buildItemAnalysis`.
- **Fold `StudentGrades.jsx`'s copy of the counting rule into `countsTowardGrade`** (see above).
