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
import { resolveScore } from "./homework.js";
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

// Pair every student who has a usable percentage on BOTH assignments.
// Returns [{ studentId, name, x, y }] — the scatter's points, and the input to `pearson`.
export function pairStudents({ roster, predictor, outcome, matrix, countMissingAsZero = true, now = new Date() }) {
  const opts = { ...matrix, countMissingAsZero, now };
  const out = [];
  for (const stu of (roster || [])) {
    const x = pctFor(predictor, stu.studentId, opts);
    const y = pctFor(outcome, stu.studentId, opts);
    if (x == null || y == null) continue;
    out.push({ studentId: stu.studentId, name: stu.altName || stu.fullName || stu.studentId, x, y });
  }
  return out;
}

// The ranked table behind the correlation view: every assignment except the outcome, scored by
// how well it predicts that outcome, strongest relationship first.
export function buildCorrelations({ roster, assignments, outcomeId, matrix, countMissingAsZero = true, now = new Date() }) {
  const outcome = (assignments || []).find(a => a.id === outcomeId);
  if (!outcome) return [];
  const rows = [];
  for (const a of (assignments || [])) {
    if (a.id === outcomeId) continue;
    const points = pairStudents({ roster, predictor: a, outcome, matrix, countMissingAsZero, now });
    const r = pearson(points.map(p => [p.x, p.y]));
    rows.push({
      assignment: a,
      n: points.length,
      r,
      r2: r == null ? null : r * r,
      ci: correlationCI(r, points.length),
      points,
    });
  }
  // Strongest |r| first; an assignment we cannot correlate at all sinks to the bottom rather
  // than sorting as if it were r = 0.
  return rows.sort((p, q) => {
    if (p.r == null && q.r == null) return 0;
    if (p.r == null) return 1;
    if (q.r == null) return -1;
    return Math.abs(q.r) - Math.abs(p.r);
  });
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

// The caveat that belongs beside any r computed on a class-sized sample. Returns null when
// there is nothing worth warning about.
export function strengthNote(row) {
  if (row.r == null) {
    return row.n < 3
      ? "Too few students have scores on both assignments."
      : "Every student scored the same on one of these, so there is no relationship to measure.";
  }
  if (row.n < 10) return "Very small sample — treat this as a hint, not a finding.";
  if (row.ci && row.ci[0] < 0 && row.ci[1] > 0) return "The confidence interval spans zero, so the direction is not yet established.";
  return null;
}
