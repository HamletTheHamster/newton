// Personalized study guides — which problems a given student is served, and the assignment
// object the homework runner is handed.
//
// Pure (no React, no Firebase, no DOM) and tested, because every judgment here is one a student
// will read as a statement about their own work. "These are the problems you did worst on" is a
// claim, and if the ranking is wrong the guide quietly sends someone to practice the problems
// they had already mastered while the ones they failed go unmentioned.
//
// WHAT A STUDY GUIDE IS
//
// Ungraded, optional, and assembled per student: up to `perHw` problems from each homework it
// covers, chosen as the lowest-scoring problems on that student's own submission, re-numbered
// where a variant spec exists (src/hw-variants.js). It carries no points, no deadline and no
// written-work step, and it writes no submission - the draft is the record, so a student can
// keep coming back to it. See docs/homework-roadmap.md § Study guides.
//
// It is NOT an instructor-selected review set, and the student-facing copy says so in those
// words (SELECTION_NOTE below, plus the per-problem line the runner shows). That distinction
// matters to a student deciding how to read the thing: a set chosen for everyone says "this is
// what the midterm covers", whereas this says "this is where YOUR homework was weakest", and a
// student who mistook the second for the first would take a short guide as a short midterm.

import { variantProblem } from "./hw-variants.js";
import { itemsOf } from "./homework.js";

// A problem counts as mastered, and so is left out of the guide, only at full credit. Floating
// point sums of per-part credit land a hair under 1 (0.3333... x 3), hence the epsilon rather
// than a bare `=== 1`.
const MASTERED = 0.999;

// Class-difficulty ranking is only used where the student has no submission of their own, and
// only once enough of the class has handed in to mean anything. Three is the same floor
// `pearson` uses in analytics.js, for the same reason: below it, one student's bad afternoon is
// indistinguishable from a hard problem.
export const MIN_SUBS_FOR_DIFFICULTY = 3;

export const STUDY_PER_HW = 3;

// Grading policy for a study run. Nothing here is a grade - no study record reaches the
// gradebook - so the schedule that rations attempts on real homework would only get in the way
// of the one thing a study guide is for. So: unlimited attempts (`freeAttempts: Infinity` also
// makes `creditForAttempt` return 1 forever, so the on-screen score reads "did you get this
// right" rather than "how many tries did it take"), hints on demand as often as the student
// wants them (`unlimitedHints`), and the answer available whenever they ask (`revealOnDemand`).
// `revealCredit: 0` is what keeps the summary honest: a problem whose answer you asked for is
// not a problem you can do.
export const STUDY_GRADING = {
  freeAttempts: Infinity,
  hintAfterAttempt: 3,
  hintCredit: 1,
  maxAttempts: Infinity,
  revealCredit: 0,
  numericTolerance: 0.02,
  unlimitedHints: true,
  revealOnDemand: true,
};

// The one sentence every student sees at the top of the guide. Kept here, beside the selection
// logic it describes, so the copy and the behavior cannot drift apart.
export const SELECTION_NOTE =
  "This study guide was put together automatically from your own homework. For each homework it covers, it picks the problems you scored lowest on and gives you a fresh set of numbers for them, so the problems below are yours alone and are not a review set the instructor chose for the whole class.";

// ── Per-problem scores off a submission ──────────────────────────────────────────
// The submission record carries `problems[]` with `earned` and `max` per problem (built by
// HomeworkRunner's buildSubmission), which is already the attempt-weighted credit: a problem
// solved on the fourth try sits at 0.8 and so ranks as weaker than one solved first time. That
// is exactly the ordering a study guide wants - it ranks by struggle, not just by failure.
export function problemScores(submission) {
  const out = {};
  for (const row of submission?.problems || []) {
    if (!row?.id) continue;
    const max = Number(row.max) || 1;
    const earned = Number(row.earned) || 0;
    out[row.id] = { earned, max, frac: max > 0 ? earned / max : 0 };
  }
  return out;
}

// Mean fraction earned per problem across the class, for the no-submission fallback. Submissions
// must already be scoped to this homework's real students (src/roster-scope.js) by the caller -
// a test account's blank submission would otherwise read as the hardest problem in the set.
export function classDifficulty(submissions = []) {
  const sums = {};
  let n = 0;
  for (const sub of submissions) {
    const scores = problemScores(sub);
    if (!Object.keys(scores).length) continue;
    n++;
    for (const [pid, sc] of Object.entries(scores)) {
      (sums[pid] || (sums[pid] = { total: 0, count: 0 })).total += sc.frac;
      sums[pid].count++;
    }
  }
  if (n < MIN_SUBS_FOR_DIFFICULTY) return null;
  const out = {};
  for (const [pid, { total, count }] of Object.entries(sums)) out[pid] = count ? total / count : 0;
  return out;
}

// Weakest first. Ties are broken by class difficulty (the harder problem first) and then by the
// problem's position in the homework, so the same inputs always produce the same guide - a
// student who opens their guide twice must not find the problems swapped around.
export function rankProblems({ homework, submission, difficulty = null }) {
  const scores = problemScores(submission);
  const problems = homework?.problems || [];
  const have = problems.some(p => p.id in scores);
  const rows = problems.map((p, i) => ({
    problemId: p.id,
    order: i,
    frac: have ? (scores[p.id]?.frac ?? 0) : null,
    classFrac: difficulty?.[p.id] ?? null,
  }));
  rows.sort((a, b) => {
    if (a.frac != null && b.frac != null && a.frac !== b.frac) return a.frac - b.frac;
    if (a.classFrac != null && b.classFrac != null && a.classFrac !== b.classFrac) return a.classFrac - b.classFrac;
    return a.order - b.order;
  });
  return rows;
}

// The student's picks, across every homework the guide covers.
//
// `source` records WHY each problem is here, because the student is told: "own" (their own
// lowest-scoring problems) or "missed" (nothing was handed in, so the class's hardest stand in).
// A homework where every problem was fully correct contributes nothing, which is why the guide
// is "up to three per homework" - a student who aced a set is not sent to re-do it.
export function pickStudyProblems({ covers = [], homeworks = [], submissionsByHw = {}, difficultyByHw = {}, perHw = STUDY_PER_HW }) {
  const picks = [];
  for (const hwId of covers) {
    const homework = homeworks.find(h => h.id === hwId);
    if (!homework || !(homework.problems || []).length) continue;
    const submission = submissionsByHw[hwId] || null;
    const ranked = rankProblems({ homework, submission, difficulty: difficultyByHw[hwId] || null });
    const source = submission ? "own" : "missed";
    const eligible = submission ? ranked.filter(r => r.frac == null || r.frac < MASTERED) : ranked;
    for (const row of eligible.slice(0, perHw)) {
      picks.push({ hwId, problemId: row.problemId, source, frac: row.frac });
    }
  }
  return picks;
}

// A stable per-problem seed. Per problem rather than per guide so that adding, removing or
// reordering a pick cannot change the numbers on the problems beside it - a student who worked
// problem 4 last night must find the same problem 4 tonight, whatever else moved.
export const variantSeed = (studentId, studyId, problemId) => `${studentId}|${studyId}|${problemId}`;

// ── The assignment object ────────────────────────────────────────────────────────
// Homework-shaped, so HomeworkRunner, itemsOf, StudySheet and the submission viewer all handle
// it with no idea it was assembled a moment ago. Two things are added to each problem:
//   `_sourceHw` - which homework it came from. The grader needs it (the answer key is indexed by
//     homework), and the student is shown it, since "where this came from" is the whole premise.
//   `_variant`  - set by variantProblem: the problem id and the seed the grader recomputes the
//     params from, or `varied: false` when the problem is served with its original numbers.
// Item ids are left exactly as committed (`hw3_p5b`), which keeps them unique across the guide
// and keeps every draft/attempt key readable as the problem it belongs to.
export function buildStudyAssignment({ guide, homeworks = [], picks = [], studentId, specs = {} }) {
  const problems = [];
  for (const pick of picks) {
    const homework = homeworks.find(h => h.id === pick.hwId);
    const source = (homework?.problems || []).find(p => p.id === pick.problemId);
    if (!source) continue;
    const seed = variantSeed(studentId, guide.id, pick.problemId);
    const problem = variantProblem(source, specs[pick.problemId] || null, seed);
    problems.push({
      ...problem,
      _sourceHw: pick.hwId,
      _sourceTitle: homework?.title || pick.hwId,
      _pickSource: pick.source,
    });
  }
  return {
    id: guide.id,
    title: guide.title,
    study: true,
    problems,
    grading: { ...STUDY_GRADING },
    // No dueDate on purpose. A date is what makes work late, lockable and sweepable, and a study
    // guide is none of those: `isLate`, the To Do rail's past-due section and the auto-submit
    // sweep all key off a due date, and the honest value for an optional ungraded guide is none.
    dueDate: null,
  };
}

// How many items (blanks) the built guide holds, for the "n problems, m parts" line the student
// sees before starting. Uses the same itemsOf the runner grades with, so the count cannot
// disagree with the thing itself.
export function studyGuideSize(assignment) {
  const problems = assignment?.problems || [];
  return { problems: problems.length, items: problems.reduce((n, p) => n + itemsOf(p).length, 0) };
}

// Does this guide have anything in it? A student who aced every covered homework gets an empty
// guide, and the runner must not be opened on it - the portal says so in words instead.
export const isEmptyGuide = assignment => !(assignment?.problems || []).length;
