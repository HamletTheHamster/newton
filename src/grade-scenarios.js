// What a student's grade WOULD be — "if I get 95% on the rest of the homework, and 70% on the
// midterm, where do I land?" Pure and env-agnostic apart from `calcGrades`, which is the point:
//
// **A projection must go through the SAME `calcGrades` the real grade goes through.** A parallel
// "weighted average of what's left" formula looks right and is wrong in three ways that all bite
// exactly the student who is trying to plan: it misses drop-lowest (an acing scenario is worth
// far more than it looks, because the projected scores push a real zero out of the category), it
// misses that `calcGrades` renormalizes over the categories that HAVE work (which is why bringing
// the final in moves everything), and it would drift the moment either rule changed. So this
// module only ever builds `calcGrades`'s inputs and hands them over.
//
// The second thing it owns is the reading of an overall percentage — the letter and the band
// color — because the projected number is shown beside the real one and the two must agree.
//
// Covered by src/grade-scenarios.test.mjs.
import { calcGrades } from "./utils.js";

export const clampPct = p => {
  const n = typeof p === "number" ? p : parseFloat(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

export function overallColor(pct) {
  if (pct == null) return null;
  if (pct >= 90) return "#4ade80"; if (pct >= 80) return "#a3e635";
  if (pct >= 70) return "#facc15"; if (pct >= 60) return "#fb923c";
  return "#f87171";
}

export function overallLetter(pct) {
  if (pct == null) return null;
  if (pct >= 93) return "A";  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+"; if (pct >= 83) return "B"; if (pct >= 80) return "B-";
  if (pct >= 77) return "C+"; if (pct >= 73) return "C"; if (pct >= 70) return "C-";
  if (pct >= 67) return "D+"; if (pct >= 63) return "D"; if (pct >= 60) return "D-";
  return "F";
}

// The work still ahead of the student: everything on the gradebook they have no grade for yet.
// `gradedIds` is what the grades list is already showing (submitted, or past due, or a manual
// assignment that has been marked) — so "remaining" deliberately includes work not yet released,
// since that is exactly the work a scenario is about.
export function splitRemaining(allAssignments, gradedIds) {
  const graded = [], remaining = [];
  const done = gradedIds instanceof Set ? gradedIds : new Set(gradedIds || []);
  for (const a of allAssignments || []) (done.has(a.id) ? graded : remaining).push(a);
  return { graded, remaining };
}

// Work the term will hold that does not exist yet. Homework and quizzes reach the gradebook only
// once they are BUILT, but a student planning the term is asking about the whole term: a course
// that promises 13 homeworks and has 6 written has seven more coming, and a projection that
// cannot see them divides the slider over the wrong denominator — "100% on the rest of the
// homework" then moves the grade by a seventh of what it really would, which is worse than not
// offering the slider. So a category carries `plannedCount`, how many assignments the term will
// hold, and this fills the shortfall with placeholders that exist ONLY inside the projection.
//
// The count is a FLOOR that real assignments consume, never an addition, and that is the whole
// of why this stays accurate as the term fills in. `have` counts every real assignment in the
// category — graded and ungraded alike — so:
//
//   * writing homework 7 turns a placeholder into the real thing (6 real + 7 held → 7 + 6), and
//     the category's total never moves;
//   * grading homework 7 moves it from remaining to graded, which `have` counts either way, so
//     nothing is double counted and no placeholder reappears behind it;
//   * a category that ends up holding MORE than promised gets no placeholders at all rather
//     than a negative correction, so the real assignments always win;
//   * an excused assignment is not replaced by a placeholder, since it still exists.
//
// Labs and both exams are seeded whole when a class is created (a midterm, a final, and two labs
// for every lecture week the course teaches — 26 for PHY 215, see src/lab-schedule.js), so their
// `plannedCount` is 0, meaning "however many actually exist".
const PLANNED_PREFIX = "planned:";

// Placeholders are worth what the category's real assignments are worth — the most common
// `maxPts` among them, since a category can hold a mix. 10 is the fallback for a category with
// nothing in it yet, matching every non-exam assignment the app creates.
function typicalMaxPts(items) {
  const counts = new Map();
  for (const a of items || []) {
    const pts = a.maxPts || 0;
    if (pts > 0) counts.set(pts, (counts.get(pts) || 0) + 1);
  }
  let best = 10, bestCount = 0;
  for (const [pts, n] of counts) if (n > bestCount) { best = pts; bestCount = n; }
  return best;
}

export function plannedRemaining(allAssignments, categories) {
  const cats = Object.values(categories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out = [];
  for (const cat of cats) {
    const planned = Math.floor(Number(cat.plannedCount) || 0);
    if (planned <= 0) continue;
    const have = (allAssignments || []).filter(a => a.catId === cat.id);
    const gap = planned - have.length;
    if (gap <= 0) continue;
    const maxPts = typicalMaxPts(have);
    for (let n = 1; n <= gap; n++) {
      out.push({
        id: `${PLANNED_PREFIX}${cat.id}:${n}`,
        title: `${cat.name} ${have.length + n}`,
        type: "planned",
        catId: cat.id,
        maxPts,
        planned: true,
      });
    }
  }
  return out;
}

// One row per category that still has work in it, in the instructor's category order. Built by
// walking the CATEGORIES rather than the assignments, so an assignment carrying a category id the
// class no longer defines is dropped here exactly as `calcGrades` would drop it later.
export function scenarioGroups(remaining, categories) {
  const cats = Object.values(categories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows = [];
  for (const cat of cats) {
    const items = (remaining || []).filter(a => a.catId === cat.id);
    if (!items.length) continue;
    rows.push({ id: cat.id, name: cat.name, weight: cat.weight, count: items.length, points: items.reduce((t, a) => t + (a.maxPts || 0), 0) });
  }
  return rows;
}

// Where each slider starts: the student's current pace in that category, so opening the panel
// answers "what happens if I carry on as I am" before anything is touched. A category with no
// graded work yet (the final, usually) has no pace of its own, so it inherits the overall.
export function defaultPcts(groups, byCategory, overall) {
  const out = {};
  for (const g of groups || []) {
    const pct = (byCategory || {})[g.id]?.pct;
    out[g.id] = Math.round(clampPct(pct != null ? pct : (overall != null ? overall : 100)));
  }
  return out;
}

// The scenario itself: every remaining assignment in a projected category is scored at that
// category's assumed percentage, and the whole set — graded and projected together — goes back
// through `calcGrades`. A category absent from `pctByCat` is left out entirely rather than
// assumed to be zero, so a scenario never invents a grade for work it was not asked about.
export function projectScenario({ assignments, remaining, categories, scores, excused, pctByCat }) {
  const projScores = { ...(scores || {}) };
  const included = [...(assignments || [])];
  for (const a of remaining || []) {
    const pct = (pctByCat || {})[a.catId];
    if (pct == null) continue;
    projScores[a.id] = (clampPct(pct) / 100) * (a.maxPts || 0);
    included.push(a);
  }
  return calcGrades({ assignments: included, categories, scores: projScores, excused: excused || {} });
}
