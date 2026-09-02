// Instructor analytics — the derivations behind the Analytics tab.
//
// No React and no DOM here (like `category-colors.js` and `attendance.js`), so the whole thing
// is plain data-in/data-out and can be reasoned about without rendering anything. Two groups:
//
//   1. `buildScoreMatrix` — the student × assignment grid of EFFECTIVE scores. This is the same
//      derivation the Gradebook runs on, extracted so the two cannot drift: a gradebook cell, a
//      student's Overall, and every correlation on the Analytics tab now read one matrix, all
//      resolved through `resolveScore` (override > lecture absence > part overrides >
//      submission, then the upheld-integrity penalty).
//   2. The statistics — Pearson r, a least-squares fit, a Fisher-z confidence interval, and the
//      ranked predictor list the correlation view renders.
//
// Why correlation at all: it answers "which of my assignments actually predicts exam
// performance", which is the question that tells the instructor what to keep, cut or reweight.
import { resolveScore, itemsOf } from "./homework.js";
import { buildAbsenceMap, attendanceFor } from "./attendance.js";
import { dueToDate } from "./utils.js";

// ── The score matrix ──────────────────────────────────────────────────────────

// Build the per-student maps the gradebook grid and the analytics views share.
//
//   scoreMap[studentId][assignmentId]   → effective score in the assignment's own points, or
//                                          undefined when the student has nothing there
//   excusedMap[studentId][assignmentId] → true when excused (never a score, never a zero)
//   flaggedMap[studentId][assignmentId] → true when an integrity flag is awaiting review
//   absentMap[studentId][assignmentId]  → { date, base } for a cell the lecture-absence policy
//                                          zeroed. `base` is the score the instructor actually
//                                          entered, kept so the cell can show it struck through
//                                          beside the enforced 0 rather than discarding it.
//
// A flag never withholds credit on its own: the submission counts at full credit until the
// instructor upholds the flag, at which point `resolveScore` applies the 50% penalty.
export function buildScoreMatrix({ roster, assignments, submissions, gradeOverrides, attendance }) {
  const scoreMap = {}, excusedMap = {}, flaggedMap = {}, absentMap = {};
  const absenceMap = buildAbsenceMap(attendance);
  const overrides = gradeOverrides || {};

  // Index submissions by student so the assignment loop isn't a linear scan per cell — with a
  // full roster × a semester of assignments the naive .find() is thousands of passes.
  const subsByStudent = {};
  for (const sub of (submissions || [])) {
    (subsByStudent[sub.studentId] ||= {})[sub.quizId] = sub;
  }

  for (const stu of (roster || [])) {
    const sid = stu.studentId;
    scoreMap[sid] = {}; excusedMap[sid] = {}; flaggedMap[sid] = {}; absentMap[sid] = {};
    for (const a of (assignments || [])) {
      const ov = (overrides[sid] || {})[a.id];
      const sub = subsByStudent[sid]?.[a.id];
      const r = resolveScore(sub, ov, attendanceFor(absenceMap, sid, a.id));
      if (r.excused) { excusedMap[sid][a.id] = true; continue; }
      if (r.flagged) flaggedMap[sid][a.id] = true;
      if (r.absentZero) absentMap[sid][a.id] = { date: absenceMap[sid][a.id], base: r.base };
      scoreMap[sid][a.id] = r.effective;
    }
  }
  return { scoreMap, excusedMap, flaggedMap, absentMap, subsByStudent };
}

// Does this assignment count toward the student's grade yet?
//
// A past-due quiz or homework with no submission is a real zero — the student didn't do it. A
// manual assignment (exam, lab) with no score is NOT: it means the instructor hasn't entered
// marks yet, which is normal for the days between sitting an exam and grading it. Extracted
// here because the Gradebook's Overall and the student's own grades list both have to apply the
// identical rule or the two figures disagree.
export function countsTowardGrade(assignment, { hasScore, isExcused, hasSubmission, now = new Date() }) {
  if (!assignment) return false;
  if (assignment.type === "manual") return !!hasScore || !!isExcused;
  return !!hasSubmission || !!(assignment.dueDate && dueToDate(assignment.dueDate) < now);
}

// ── Statistics ────────────────────────────────────────────────────────────────

// Pearson product-moment correlation over [x, y] pairs. Returns null when there are fewer than
// 3 pairs or when either variable has no variance (every student scored the same), since r is
// undefined there rather than zero — a distinction that matters, because "everyone got 10/10"
// is a real and common outcome on an easy assignment and must not be reported as "no relationship".
export function pearson(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx, dy = y - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  // Clamp: floating-point error can push a perfect correlation a hair past ±1, which would make
  // atanh() below return Infinity.
  return Math.max(-1, Math.min(1, r));
}

// Least-squares line y = slope·x + intercept, for drawing the trend on the scatter.
export function linearFit(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  if (sxx <= 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

// 95% confidence interval for r via the Fisher z-transform.
//
// This is the honest counterweight to a headline r. A class of 25 is a SMALL sample: r = 0.45
// there carries a CI of roughly [0.07, 0.72] — real, but nothing like as precise as the two
// decimal places suggest. Showing the interval is what stops a semester's worth of noise being
// read as a finding.
export function correlationCI(r, n, z = 1.96) {
  if (r == null || n < 4) return null;
  if (Math.abs(r) >= 1) return [r, r];
  const zr = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(zr - z * se), Math.tanh(zr + z * se)];
}

const median = xs => {
  const a = xs.filter(v => v != null && Number.isFinite(v)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// Flatten a stored submission's `problems` into per-item rows. A submission mirrors the
// runner's own shape: a multipart problem carries `parts`, a single-part one IS the item.
function submissionItems(sub) {
  const out = [];
  for (const p of (sub?.problems || [])) {
    if (Array.isArray(p.parts) && p.parts.length) {
      for (const pt of p.parts) out.push(pt);
    } else out.push(p);
  }
  return out;
}

// ── Pairing students against an outcome ───────────────────────────────────────

// Turn one assignment into a per-student percentage, applying the missing-work policy.
//
// Percentages, not raw points: exams are out of 100 and homework out of 10, so raw points would
// make the two scatter axes incomparable. (r itself is scale-invariant, but the plot is not.)
//
// `countMissingAsZero` is the instructor's toggle, and it is a genuine analytical fork rather
// than a cosmetic one:
//   • ON  — a past-due, unsubmitted quiz/homework is a 0, matching how the gradebook actually
//           grades it. This is the default because it is the truth about the student's term.
//   • OFF — only work the student actually turned in is paired. Use it to check whether a
//           correlation survives without the zeros: if r collapses, the "relationship" was
//           mostly the fact that students who skip one thing skip everything, not evidence that
//           this assignment teaches the exam.
// Excused work is excluded either way — an excusal is an explicit instruction to ignore the cell.
function pctFor(assignment, sid, { scoreMap, excusedMap, subsByStudent, countMissingAsZero, now }) {
  if (excusedMap[sid]?.[assignment.id]) return null;
  const raw = scoreMap[sid]?.[assignment.id];
  const max = assignment.maxPts || 10;
  if (raw != null) return (raw / max) * 100;
  if (!countMissingAsZero) return null;
  const counts = countsTowardGrade(assignment, {
    hasScore: false,
    isExcused: false,
    hasSubmission: !!subsByStudent[sid]?.[assignment.id],
    now,
  });
  return counts ? 0 : null;
}

// Pair every student for whom BOTH getters return a number.
// Returns [{ studentId, name, x, y }] — the scatter's points, and the input to `pearson`.
// `xOf`/`yOf` take a studentId, so a predictor can be anything per-student, not just a score.
export function pairBy({ roster, xOf, yOf }) {
  const out = [];
  for (const stu of (roster || [])) {
    const x = xOf(stu.studentId);
    const y = yOf(stu.studentId);
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ studentId: stu.studentId, name: stu.altName || stu.fullName || stu.studentId, x, y });
  }
  return out;
}

// Score-vs-score pairing, the phase 1 behaviour, expressed through pairBy.
export function pairStudents({ roster, predictor, outcome, matrix, countMissingAsZero = true, now = new Date() }) {
  const opts = { ...matrix, countMissingAsZero, now };
  return pairBy({
    roster,
    xOf: sid => pctFor(predictor, sid, opts),
    yOf: sid => pctFor(outcome, sid, opts),
  });
}

// Strongest |r| first. A row we cannot correlate at all sinks to the bottom rather than sorting
// as if it were r = 0, which would place "no data" among the genuinely unrelated.
const byStrength = (p, q) => {
  if (p.r == null && q.r == null) return 0;
  if (p.r == null) return 1;
  if (q.r == null) return -1;
  return Math.abs(q.r) - Math.abs(p.r);
};

const statsFor = points => {
  const r = pearson(points.map(p => [p.x, p.y]));
  return { n: points.length, r, r2: r == null ? null : r * r, ci: correlationCI(r, points.length), points };
};

// ── Predictors ────────────────────────────────────────────────────────────────
//
// The correlation view can measure an assignment by more than its score. Homework scores are
// heavily CEILING-COMPRESSED by the 3-attempt/hint/reveal schedule — most students end up near
// full credit — and restriction of range attenuates correlation badly at class-sized n. So a
// homework can genuinely teach the exam while its SCORE correlates weakly, simply because the
// score has almost no variance left to correlate with. Attempts and time are not ceiling-bound
// and often carry the signal the score cannot.
//
// `expected` is the direction a healthy course should show, and it differs per feature. It is
// displayed rather than baked into the sign, because reversing a coefficient to make every bar
// point right would hide exactly the surprises worth seeing.
export const PREDICTORS = {
  score: {
    id: "score", label: "Assignment score", short: "score", unit: "%",
    expected: "positive",
    blurb: "Higher score goes with higher exam performance. The obvious measure, and the one most weakened by the attempt schedule: if nearly everyone finishes near full credit there is little variance left to correlate.",
  },
  attempts: {
    id: "attempts", label: "Attempts to correct", short: "attempts", unit: "",
    expected: "negative",
    blurb: "The average number of tries a student needed on the problems they eventually got right. A NEGATIVE correlation is the healthy result: students who needed fewer attempts did better on the exam. Not ceiling-bound, so it often separates students the score cannot.",
  },
  time: {
    id: "time", label: "Time on task", short: "time", unit: "min",
    expected: "either",
    blurb: "Minutes actually spent, excluding time the tab was hidden or idle. The direction is genuinely informative here rather than assumed: positive suggests effort paying off, negative suggests the students taking longest are the ones struggling. Both are real findings.",
  },
};

// Minimum items a student must have resolved before a mean-attempts figure means anything. Below
// this the average swings wildly on one lucky or unlucky problem.
const MIN_RESOLVED_FOR_ATTEMPTS = 3;

// Per-student effort measures per homework, plus a pooled "all homework" entry.
//
//   { [studentId]: { [hwId]: { attempts, timeMs, resolved }, all: { … } } }
//
// Attempts come from the SUBMISSION where there is one — it stores the exact per-item count and
// is the completed record — falling back to the telemetry attempt log for a student still
// working. The two are not mixed for the same student, so one student's figure is never half
// exact and half approximate. Time comes only from telemetry, which is the only place it exists.
export function effortByStudent({ homeworkIds = [], submissions = [], telemetryAll = {} }) {
  const ids = new Set(homeworkIds);
  const out = {};
  const blank = () => ({ attemptSum: 0, resolved: 0, timeMs: 0, hasTime: false });

  const bump = (sid, hwId, add) => {
    const stu = (out[sid] ||= {});
    for (const key of [hwId, "all"]) {
      const e = (stu[key] ||= blank());
      e.attemptSum += add.attemptSum; e.resolved += add.resolved;
      e.timeMs += add.timeMs; e.hasTime = e.hasTime || add.hasTime;
    }
  };

  const withSubmission = new Set();
  for (const sub of submissions) {
    if (sub.type !== "homework" || !ids.has(sub.quizId)) continue;
    withSubmission.add(`${sub.studentId}|${sub.quizId}`);
    let attemptSum = 0, resolved = 0;
    for (const it of submissionItems(sub)) {
      // Only items the student actually got right have an "attempts to correct". A revealed or
      // abandoned item has no such number, and counting its 5 failed tries as though they were
      // the cost of success would make giving up look like diligence.
      if (it.status === "correct" && it.attempts > 0) { attemptSum += it.attempts; resolved += 1; }
    }
    const tele = sub.telemetry || telemetryAll?.[sub.studentId]?.[sub.quizId] || null;
    const timeMs = tele ? Object.values(tele.items || {}).reduce((n, x) => n + (x.activeMs || 0), 0) : 0;
    bump(sub.studentId, sub.quizId, { attemptSum, resolved, timeMs, hasTime: !!tele });
  }

  for (const [sid, byHw] of Object.entries(telemetryAll)) {
    for (const [hwId, tele] of Object.entries(byHw || {})) {
      if (!ids.has(hwId) || withSubmission.has(`${sid}|${hwId}`)) continue;
      let attemptSum = 0, resolved = 0, timeMs = 0;
      for (const it of Object.values(tele?.items || {})) {
        timeMs += it.activeMs || 0;
        const log = it.attemptLog || [];
        const win = log.findIndex(a => a.correct);
        if (win >= 0) { attemptSum += win + 1; resolved += 1; }
      }
      bump(sid, hwId, { attemptSum, resolved, timeMs, hasTime: true });
    }
  }

  // Collapse the accumulators into the two reported measures.
  const final = {};
  for (const [sid, byKey] of Object.entries(out)) {
    final[sid] = {};
    for (const [key, e] of Object.entries(byKey)) {
      final[sid][key] = {
        attempts: e.resolved >= MIN_RESOLVED_FOR_ATTEMPTS ? e.attemptSum / e.resolved : null,
        timeMs: e.hasTime && e.timeMs > 0 ? e.timeMs : null,
        resolved: e.resolved,
      };
    }
  }
  return final;
}

// The ranked list behind the correlation view.
//
// `feature` selects what an assignment is measured BY. "score" ranks every assignment except the
// outcome. The effort features only exist for homework, so they rank the homework assignments
// plus a pooled "All homework" row — pooling every item across the term is the most statistically
// powerful row available at class-sized n, and is usually the one worth reading first.
export function buildCorrelations({
  roster, assignments, outcomeId, matrix, countMissingAsZero = true, now = new Date(),
  feature = "score", effort = null,
}) {
  const outcome = (assignments || []).find(a => a.id === outcomeId);
  if (!outcome) return [];
  const opts = { ...matrix, countMissingAsZero, now };
  const yOf = sid => pctFor(outcome, sid, opts);

  if (feature === "score" || !effort) {
    return (assignments || [])
      .filter(a => a.id !== outcomeId)
      .map(a => ({ assignment: a, ...statsFor(pairBy({ roster, xOf: sid => pctFor(a, sid, opts), yOf })) }))
      .sort(byStrength);
  }

  const valueOf = (sid, key) => {
    const e = effort[sid]?.[key];
    if (!e) return null;
    if (feature === "attempts") return e.attempts;
    if (feature === "time") return e.timeMs == null ? null : e.timeMs / 60000; // minutes
    return null;
  };

  const homework = (assignments || []).filter(a => a.type === "homework" && a.id !== outcomeId);
  const rows = homework.map(a => ({
    assignment: a,
    ...statsFor(pairBy({ roster, xOf: sid => valueOf(sid, a.id), yOf })),
  }));

  // The pooled row is not an assignment, so it carries a synthetic one. `pooled` marks it for
  // the UI, which pins it to the top rather than letting it sort among the individual sets.
  if (homework.length > 1) {
    rows.push({
      assignment: { id: "__all_homework__", title: "All homework combined", type: "homework", catId: "cat_hw", maxPts: 10 },
      pooled: true,
      ...statsFor(pairBy({ roster, xOf: sid => valueOf(sid, "all"), yOf })),
    });
  }

  const sorted = rows.filter(x => !x.pooled).sort(byStrength);
  const pooled = rows.find(x => x.pooled);
  return pooled ? [pooled, ...sorted] : sorted;
}

// ── Reading a correlation in words ────────────────────────────────────────────

// Plain-language gloss for an r, so the table doesn't ask the instructor to hold Cohen's
// conventions in their head. Deliberately hedged at small n by the caller (see `strengthNote`).
export function strengthLabel(r) {
  if (r == null) return "not enough data";
  const a = Math.abs(r);
  const dir = r < 0 ? "negative" : "positive";
  if (a < 0.1) return "essentially none";
  if (a < 0.3) return `weak ${dir}`;
  if (a < 0.5) return `moderate ${dir}`;
  if (a < 0.7) return `strong ${dir}`;
  return `very strong ${dir}`;
}

// The "Reading" column. `strengthLabel` alone cannot tell the two null cases apart, and calling
// them both "not enough data" is wrong and misleading in the common one: a quiz where every
// student scored 10/10 has plenty of data and simply no variation to correlate. That happens
// constantly with mastery-style grading, so it deserves its own words.
export function readingFor(row) {
  if (row?.r != null) return strengthLabel(row.r);
  if (!row || row.n < 3) return "not enough data";
  return "no variation to measure";
}

// The caveat that belongs beside any r computed on a class-sized sample. Returns null when
// there is nothing worth warning about.
export function strengthNote(row) {
  if (row.r == null) {
    return row.n < 3
      ? "Too few students have scores on both assignments."
      : "Every student got the same result on one of these, so there is no variation to correlate. That is a finding about the assignment, not a gap in the data: an assignment everyone aces cannot predict anything.";
  }
  if (row.n < 10) return "Very small sample — treat this as a hint, not a finding.";
  if (row.ci && row.ci[0] < 0 && row.ci[1] > 0) return "The confidence interval spans zero, so the direction is not yet established.";
  return null;
}

// ── Phase 3: item analysis ────────────────────────────────────────────────────

// Normalize a typed answer for grouping. Wrong answers are only interesting in aggregate, so
// "9.8 " and "9.8" must land in the same bucket.
const normAnswer = a => String(a || "").trim().toLowerCase().replace(/\s+/g, " ");

// Per-item statistics across every student who has submitted this homework.
//
// `telemetryByStudent` is `{ [studentId]: teleObj }` already scoped to THIS homework — the
// caller assembles it from the live `hwTelemetry` node for students still working and from
// `submission.telemetry` for those who have handed in (the live node is cleared at submit).
//
// The point of this view is deciding what to reteach and which problems to keep, so the columns
// are chosen to separate "hard" from "badly worded": a low mean with HIGH discrimination is a
// hard problem doing its job; a low mean with LOW or negative discrimination is usually a
// problem the strong students are also getting wrong, which points at the wording or the figure.
export function buildItemAnalysis({ homework, submissions = [], telemetryByStudent = {} }) {
  const problems = homework?.problems || [];
  // Item order and labels ("3", "3a") come from the same itemsOf the runner uses, so a label
  // here always names the part a student actually saw.
  const labels = problems.flatMap((p, pi) => {
    const its = itemsOf(p);
    return its.map((it, ii) => ({
      id: it.id,
      label: its.length > 1 ? `${pi + 1}${"abcdefgh"[ii]}` : `${pi + 1}`,
      prompt: it.prompt || p.prompt || "",
      answerType: it.answerType || "numeric",
    }));
  });

  const subs = submissions.filter(s => s.quizId === homework?.id && s.type === "homework");
  // Per student: their row for each item, plus their total earned/max on the assignment. The
  // totals feed the CORRECTED item-total correlation below.
  const byStudent = subs.map(s => {
    const rows = {};
    let totEarned = 0, totMax = 0;
    for (const it of submissionItems(s)) {
      const max = it.max || 1;
      const earned = it.earned || 0;
      rows[it.id] = { earned, max, attempts: it.attempts || 0, status: it.status || "open" };
      totEarned += earned; totMax += max;
    }
    return { studentId: s.studentId, rows, totEarned, totMax };
  });

  return labels.map(l => {
    const present = byStudent.filter(b => b.rows[l.id]);
    const n = present.length;
    const fracs = present.map(b => (b.rows[l.id].max > 0 ? b.rows[l.id].earned / b.rows[l.id].max : 0));
    const meanPct = n ? (fracs.reduce((a, b) => a + b, 0) / n) * 100 : null;

    const firstTry = present.filter(b => b.rows[l.id].status === "correct" && b.rows[l.id].attempts <= 1).length;
    const later = present.filter(b => b.rows[l.id].status === "correct" && b.rows[l.id].attempts > 1).length;
    const revealed = present.filter(b => b.rows[l.id].status === "revealed").length;
    const unresolved = n - firstTry - later - revealed;

    // CORRECTED item-total correlation: this item's score against the sum of the OTHER items.
    // Correlating against a total that includes the item inflates every coefficient, which
    // would make a useless item look discriminating simply because it is part of its own total.
    const pairs = present
      .map(b => {
        const r = b.rows[l.id];
        const restMax = b.totMax - r.max;
        if (restMax <= 0 || r.max <= 0) return null;
        return [r.earned / r.max, (b.totEarned - r.earned) / restMax];
      })
      .filter(Boolean);
    const discrimination = pearson(pairs);

    // Timing and wrong answers come from telemetry, which only exists from the point it shipped,
    // so these are null on older assignments rather than zero.
    const teles = present.map(b => telemetryByStudent[b.studentId]?.items?.[l.id]).filter(Boolean);
    const medianActiveMs = median(teles.map(t => t.activeMs));
    const medianTtfMs = median(teles.map(t => {
      if (!t.firstSeenAt || !t.firstSubmitAt) return null;
      const d = new Date(t.firstSubmitAt) - new Date(t.firstSeenAt);
      return Number.isFinite(d) && d >= 0 ? d : null;
    }));

    // The distribution of WRONG answers is the most directly actionable thing here: a cluster on
    // one value is usually a single shared misconception (a dropped factor of 2, degrees for
    // radians) and makes a lecture slide on its own.
    const counts = {};
    for (const t of teles) {
      // One student contributes each distinct wrong value once, so a student who retypes the
      // same wrong answer five times cannot manufacture a class-wide "pattern".
      const seen = new Set();
      for (const a of (t.attemptLog || [])) {
        if (a.correct) continue;
        const key = normAnswer(a.answer);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const topWrong = Object.entries(counts)
      // A single student's wrong answer is not a pattern, and printing it would single them out.
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([answer, count]) => ({ answer, count }));

    return {
      ...l, n, meanPct, firstTry, later, revealed, unresolved,
      discrimination, medianActiveMs, medianTtfMs, topWrong,
    };
  });
}

// Plain-language read of a corrected item-total correlation, which is the column most likely to
// be misread. Thresholds are the conventional classical-test-theory bands.
export function discriminationNote(d, meanPct) {
  if (d == null) return null;
  if (d < 0) return "Strong students are getting this wrong more often than weak ones. Check the wording, the figure, or the answer key.";
  if (d < 0.15) return "Barely separates strong from weak students. Often a wording problem rather than a hard problem.";
  if (meanPct != null && meanPct < 40) return "Hard, and it does separate strong students from weak ones. Worth reteaching, not cutting.";
  return null;
}

// ── Phase 3: class pulse ──────────────────────────────────────────────────────

const dayKey = d => {
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

// Distinct students active per day over the last `days` days, from telemetry sessions and
// submission timestamps. Sessions are the better source (they mark real working time), but
// submissions cover students whose work predates telemetry.
export function buildActivityByDay({ submissions = [], telemetryAll = {}, days = 30, now = new Date() }) {
  const perDay = {};
  const add = (key, studentId) => { if (key) (perDay[key] ||= new Set()).add(studentId); };

  for (const s of submissions) add(dayKey(s.timestamp), s.studentId);
  for (const [studentId, byHw] of Object.entries(telemetryAll)) {
    for (const tele of Object.values(byHw || {})) {
      for (const sess of (tele?.sessions || [])) add(dayKey(sess.end || sess.start), studentId);
    }
  }

  const out = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ date: k, students: perDay[k]?.size || 0 });
  }
  return out;
}

// Where the class stands on one homework: not started -> started -> finished but not handed in
// -> submitted. The third bucket is the one worth acting on, and it is invisible in the
// gradebook, which simply reads as missing.
export function buildFunnel({ assignment, roster = [], submissions = [], progress = {} }) {
  const submitted = new Set(
    submissions.filter(s => s.quizId === assignment?.id).map(s => s.studentId)
  );
  let notStarted = 0, started = 0, stalled = 0;
  for (const stu of roster) {
    if (submitted.has(stu.studentId)) continue;
    const rec = progress?.[stu.studentId]?.[assignment?.id];
    const pct = rec && rec.total > 0 ? (rec.pct ?? Math.round((rec.done / rec.total) * 100)) : null;
    if (pct == null) notStarted++;
    else if (pct >= 100) stalled++;
    else started++;
  }
  return { notStarted, started, stalled, submitted: submitted.size, total: roster.length };
}

// ── Phase 3: per-student term view ────────────────────────────────────────────

// Telemetry lives in TWO places, and a view that reads only one of them is wrong: the live
// `hwTelemetry` node holds students still working, and the copy on a submission holds everyone
// who has handed in (the live node is cleared at final submit). Reading only the node makes
// every student who finished look as though they spent no time at all, which is backwards.
// The submission copy wins, since it is the completed record.
export function mergeTelemetry({ telemetryAll = {}, submissions = [] }) {
  const out = {};
  for (const [sid, byHw] of Object.entries(telemetryAll)) out[sid] = { ...byHw };
  for (const sub of submissions) {
    if (!sub?.telemetry || !sub.studentId || !sub.quizId) continue;
    (out[sub.studentId] ||= {})[sub.quizId] = sub.telemetry;
  }
  return out;
}

// When each student was last seen working, from the same two sources as the activity chart.
export function lastActiveMap({ submissions = [], telemetryAll = {} }) {
  const out = {};
  const bump = (id, iso) => {
    if (!id || !iso) return;
    if (!out[id] || new Date(iso) > new Date(out[id])) out[id] = iso;
  };
  for (const s of submissions) bump(s.studentId, s.timestamp);
  for (const [id, byHw] of Object.entries(telemetryAll)) {
    for (const tele of Object.values(byHw || {})) {
      bump(id, tele?.updatedAt);
      for (const sess of (tele?.sessions || [])) bump(id, sess.end);
    }
  }
  return out;
}

// Total recorded time on task per student across every assignment.
export function timeOnTaskMap(telemetryAll = {}) {
  const out = {};
  for (const [id, byHw] of Object.entries(telemetryAll)) {
    let ms = 0;
    for (const tele of Object.values(byHw || {})) {
      for (const it of Object.values(tele?.items || {})) ms += it.activeMs || 0;
    }
    out[id] = ms;
  }
  return out;
}
