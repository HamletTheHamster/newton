# Instructor analytics

The Analytics tab (`instructorSection === "analytics"`, `src/screens/instructor/Analytics.jsx`)
answers questions about the class that the Gradebook can show but not summarize: which
assignments actually predict exam performance, which problems the class struggles with, and
how students are engaging with the work.

It is being built in phases. **Phase 1 (the correlation view) is shipped**; phases 2 and 3 are
planned and described at the bottom so the data design stays coherent.

## Why a separate tab

Two reasons, both structural rather than aesthetic:

- The Assignments hub is already at its column budget. Its `GRID_COLS` leaves ~7px of slack on
  the Type column and the title needs every pixel it has (see the `Assignments.jsx` row in
  CLAUDE.md). There is no room to bolt cross-assignment analysis onto it.
- The interesting questions are **cross-assignment by nature** ("does homework predict the
  midterm", "which problems are hardest across the set"). A per-assignment modal is the wrong
  shape for them.

## Phase 1 — the correlation view (shipped)

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

## Planned

### Phase 2 — `hwTelemetry`

Time-on-problem, visibility/blur, paste counts and a bounded attempt log, so engagement can be
measured rather than guessed at. The design:

```
classes/{classId}/hwTelemetry/{studentId}/{hwId}
  items: { [itemId]: {
    activeMs, hiddenMs, hiddenCount, unfocusedMs, unfocusedCount,
    pasteCount, firstSeenAt, firstSubmitAt, resolvedAt,
    attemptLog: [{ at, answer, correct, awayMsBefore, msSinceReturn }]
  }},
  sessions: [{ start, end }],
  updatedAt
}
```

Design constraints that matter:

- **Aggregates, not a raw event stream.** An append-only event log is O(seconds) and would
  balloon RTDB. Per-item accumulators are O(items), roughly 1-3 KB per student per assignment.
  The `attemptLog` is naturally bounded at `maxAttempts` (5).
- **Written through `persistDraft()`**, the same chokepoint that already writes `hwDrafts` and
  `hwProgress`, so the three cannot drift. Copied onto the submission at final submit, since the
  draft is cleared there.
- **Kept out of the App.jsx class cache**, like `hwDrafts`/`hwAttempts`/`hwProgress` — it is
  per-student and only the Analytics tab wants it. Add the node to `database.rules.json`.
- **`activeMs` must exclude hidden time**, or every number is meaningless: a student who opens a
  problem at 9pm, eats dinner, and submits at 11pm would read as 120 minutes on that problem.
  Tick only while `visibilityState === "visible"` and the window has focus, pausing after ~120s
  with no pointer or key event (reading a problem is legitimately idle). Ignore excursions under
  ~2s (notification flicker); treat anything over ~30 min as a session boundary.
- **`hiddenMs` and `unfocusedMs` are separate and must not be summed.** Tab-backgrounded
  (`visibilitychange`) is a reliable signal; window-unfocused (`window.blur`) also fires on OS
  notifications, screenshot tools, devtools and the app's own file picker.
- **Paste is logged, not blocked**, on homework inputs. Blocking a numeric field is user-hostile
  and trivially defeated; a count is free evidence. (The quiz textarea still blocks paste — that
  is a different surface with a different purpose.)

**How this must be presented.** Blur never appears as a standalone ranked column. Its uses are:
correcting `activeMs`; the shape of excursions relative to submits inside a single student's
profile; and per-problem class aggregates ("problem 7 has triple the away-time" usually means
the figure is unclear, not that anyone cheated). A raw away-time leaderboard invites a wrong
conclusion at a glance, and these signals all have innocent explanations — a shared computer, a
printed problem set, a reload on a bad connection, a student who reads on paper. Build for "who
should I talk to", never for a verdict, the same way the integrity flag defaults to full credit
until an instructor upholds it.

### Phase 3 — item analysis, student profile, class pulse

- **Item analysis** needs no instrumentation either: `submissions` already carries
  `problems[].parts[]` with `earned`, `max`, `attempts`, `status` and `studentAnswer`. Per-item
  difficulty, attempt distribution, reveal/hint rate, and **discrimination** (the correlation of
  item score with total score, which separates "hard problem" from "badly worded problem").
  Top wrong answers need phase 2's `attemptLog` and are the highest-value output of the three.
- **Student profile** — one student, everything: session timeline, per-problem time and attempts
  as a percentile against the class on that item, score trend, attendance, integrity flags.
- **Class pulse** — active students per day, a per-assignment funnel (not started → started →
  finished-but-not-submitted → submitted; that amber "stalled" state is already tracked in
  `Assignments.jsx` but surfaced nowhere an instructor would look), and an at-risk table.

A note for whoever builds the correlation half of phase 3: homework scores are heavily
ceiling-compressed by the 3-attempt/hint/reveal schedule, and restriction of range attenuates
correlation badly at class-sized n. Expect **attempts-to-correct** and **time-on-problem** to
predict exam performance better than homework score does, and design the correlation view to
accept several homework-derived features rather than score alone.
