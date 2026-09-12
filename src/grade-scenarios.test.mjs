// Grade-scenario projection tests. Run with:  node src/grade-scenarios.test.mjs
//
// A projected grade is silently plausible when it is wrong — it is a number in the right range
// with no submission behind it to check it against — and a student plans real effort around it
// ("I can skip the last lab", "I only need a 60 on the final"). These guard the three rules that
// make the projection agree with the gradebook rather than merely look like it: drop-lowest is
// re-run over the projected scores, category weights renormalize once a projected category has
// work in it, and a category nobody asked about is left out rather than assumed zero.
//
// Plain node, no framework and no dependencies, in keeping with the repo having no test runner.
import { splitRemaining, plannedRemaining, scenarioGroups, defaultPcts, projectScenario, clampPct, overallLetter, overallColor } from "./grade-scenarios.js";
import { calcGrades } from "./utils.js";

let fails = 0;
const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) { fails++; console.log(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } else console.log(`ok   ${l}`); };
const near = (l, g, w, tol = 1e-6) => { const ok = g != null && Math.abs(g - w) <= tol; if (!ok) { fails++; console.log(`FAIL ${l}: got ${g} want ${w}`); } else console.log(`ok   ${l}`); };

const CATS = {
  cat_hw:      { id: "cat_hw",      name: "Homework", weight: 40, order: 0, dropLowest: 0 },
  cat_lab:     { id: "cat_lab",     name: "Labs",     weight: 20, order: 1, dropLowest: 0 },
  cat_final:   { id: "cat_final",   name: "Final",    weight: 40, order: 2, dropLowest: 0 },
};
const A = (id, catId, maxPts = 10) => ({ id, catId, maxPts, title: id });
const ALL = [A("hw1", "cat_hw"), A("hw2", "cat_hw"), A("hw3", "cat_hw"),
             A("lab1", "cat_lab"), A("lab2", "cat_lab"),
             A("final", "cat_final", 100)];

// ── splitRemaining ───────────────────────────────────────────────────────────
{
  const { graded, remaining } = splitRemaining(ALL, new Set(["hw1", "lab1"]));
  eq("graded is what the grades list already shows", graded.map(a => a.id), ["hw1", "lab1"]);
  eq("remaining is everything else, released or not", remaining.map(a => a.id), ["hw2", "hw3", "lab2", "final"]);
}
eq("an array of ids works as well as a Set", splitRemaining(ALL, ["hw1"]).remaining.length, 5);
eq("no assignments at all is not a crash", splitRemaining(null, null), { graded: [], remaining: [] });

// ── scenarioGroups ───────────────────────────────────────────────────────────
{
  const { remaining } = splitRemaining(ALL, new Set(["hw1", "lab1"]));
  const groups = scenarioGroups(remaining, CATS);
  eq("one row per category with work left, in category order", groups.map(g => g.id), ["cat_hw", "cat_lab", "cat_final"]);
  eq("the row counts what is left, not what exists", groups.map(g => g.count), [2, 1, 1]);
  eq("and totals its points", groups.map(g => g.points), [20, 10, 100]);
}
eq("a fully graded category gets no row", scenarioGroups([A("hw2", "cat_hw")], CATS).map(g => g.id), ["cat_hw"]);
eq("nothing left means no rows at all", scenarioGroups([], CATS), []);
// An assignment carrying a category the class no longer defines is dropped here, exactly as
// calcGrades would drop it later — otherwise the panel offers a slider that moves nothing.
eq("an orphaned category id gets no row", scenarioGroups([A("x", "cat_gone")], CATS), []);

// ── defaultPcts ──────────────────────────────────────────────────────────────
{
  const groups = scenarioGroups(splitRemaining(ALL, new Set(["hw1", "lab1"])).remaining, CATS);
  const byCategory = { cat_hw: { pct: 87.5 }, cat_lab: { pct: 100 }, cat_final: { pct: null } };
  const d = defaultPcts(groups, byCategory, 91.2);
  eq("a slider starts at the student's pace in that category", [d.cat_hw, d.cat_lab], [88, 100]);
  eq("a category with no history yet inherits the overall", d.cat_final, 91);
  eq("and with no overall either, at full marks", defaultPcts(groups, {}, null).cat_final, 100);
}

// ── projectScenario ──────────────────────────────────────────────────────────
// The student: 10/10 on hw1, 5/10 on lab1. Nothing else marked.
const scores = { hw1: 10, lab1: 5 };
const { graded, remaining } = splitRemaining(ALL, new Set(["hw1", "lab1"]));

{
  // Reality check first: with only hw1 and lab1 marked, the final's 40% weight is not in play,
  // so the overall renormalizes over 40 + 20.
  const now = calcGrades({ assignments: graded, categories: CATS, scores, excused: {} });
  near("the un-projected grade renormalizes over the categories that have work", now.overall, 100 * (40 / 60) + 50 * (20 / 60));

  // Now project the final at 70 and nothing else. It brings its own 40% in with it, which is the
  // whole reason a student asks this question.
  const p = projectScenario({ assignments: graded, remaining, categories: CATS, scores, excused: {}, pctByCat: { cat_final: 70 } });
  near("projecting the final brings its weight into the total", p.overall, 100 * 0.4 + 50 * 0.2 + 70 * 0.4);
  eq("a category nobody asked about keeps only its graded work", p.byCategory.cat_hw.possible, 10);
}

{
  // Every category projected: 95% on the rest of the homework, 100% on the last lab, 70% final.
  const p = projectScenario({ assignments: graded, remaining, categories: CATS, scores, excused: {}, pctByCat: { cat_hw: 95, cat_lab: 100, cat_final: 70 } });
  near("homework becomes 10 + 9.5 + 9.5 out of 30", p.byCategory.cat_hw.pct, (29 / 30) * 100);
  near("labs become 5 + 10 out of 20", p.byCategory.cat_lab.pct, 75);
  near("the overall is those three at their stated weights", p.overall, (29 / 30) * 100 * 0.4 + 75 * 0.2 + 70 * 0.4);
}

{
  // Drop-lowest is the rule a hand-rolled projection gets wrong: acing the rest is worth more
  // than the arithmetic suggests, because the projected scores push the real zero out.
  const cats = { ...CATS, cat_hw: { ...CATS.cat_hw, dropLowest: 1 } };
  const p = projectScenario({ assignments: graded, remaining, categories: cats, scores: { hw1: 2, lab1: 5 }, excused: {}, pctByCat: { cat_hw: 100 } });
  eq("the projected scores are what drop-lowest is re-run over", p.byCategory.cat_hw.dropped, ["hw1"]);
  near("so the dropped 2/10 leaves the category perfect", p.byCategory.cat_hw.pct, 100);
}

{
  // Excused work stays excused under a scenario; it must not be quietly re-scored.
  const p = projectScenario({ assignments: graded, remaining, categories: CATS, scores, excused: { lab1: true }, pctByCat: { cat_lab: 0 } });
  eq("an excused assignment is not given the scenario's score", p.byCategory.cat_lab.possible, 10);
  near("only the remaining lab counts, at the assumed 0", p.byCategory.cat_lab.pct, 0);
}

eq("0% on everything left is a real scenario, not a missing one",
  Math.round(projectScenario({ assignments: graded, remaining, categories: CATS, scores, excused: {}, pctByCat: { cat_hw: 0, cat_lab: 0, cat_final: 0 } }).overall * 100) / 100,
  Math.round((10 / 30 * 100 * 0.4 + 5 / 20 * 100 * 0.2 + 0) * 100) / 100);

// ── plannedRemaining: the work the term will hold that does not exist yet ────
// The reason this needs guarding is the question the instructor actually asked: the panel must
// not go wrong the moment the missing homework and quizzes get built and graded. The count is a
// FLOOR that real assignments consume, so the term total must hold steady all the way through.
const PLANNED = {
  cat_hw:    { ...CATS.cat_hw,    plannedCount: 13 },
  cat_lab:   { ...CATS.cat_lab,   plannedCount: 0 },
  cat_final: { ...CATS.cat_final, plannedCount: 0 },
};
const hwRun = n => Array.from({ length: n }, (_, i) => A(`hw${i + 1}`, "cat_hw"));
const withHw = n => [...hwRun(n), A("lab1", "cat_lab"), A("lab2", "cat_lab"), A("final", "cat_final", 100)];

{
  const held = plannedRemaining(withHw(3), PLANNED);
  eq("the shortfall against the term's count is filled", held.length, 10);
  eq("and only in the category that is short", [...new Set(held.map(h => h.catId))], ["cat_hw"]);
  eq("a placeholder is numbered on from the real ones", [held[0].title, held.at(-1).title], ["Homework 4", "Homework 13"]);
  eq("and is worth what the category's real work is worth", [...new Set(held.map(h => h.maxPts))], [10]);
  eq("its id cannot collide with a real assignment's", held.every(h => h.id.startsWith("planned:") && h.planned === true), true);
  eq("plannedCount 0 means 'however many exist'", plannedRemaining(withHw(3), PLANNED).filter(h => h.catId !== "cat_hw"), []);
}
eq("a category already holding more than promised gets nothing", plannedRemaining(withHw(14), PLANNED), []);
eq("neither does one holding exactly the promised number", plannedRemaining(withHw(13), PLANNED), []);
eq("no categories at all is not a crash", plannedRemaining(null, null), []);
eq("a category with nothing in it yet falls back to 10 points",
  [...new Set(plannedRemaining([], { cat_hw: PLANNED.cat_hw }).map(h => h.maxPts))], [10]);
eq("a category of 100-point work gets 100-point placeholders",
  [...new Set(plannedRemaining([A("m1", "cat_final", 100)], { cat_final: { ...CATS.cat_final, plannedCount: 3 } }).map(h => h.maxPts))], [100]);

// The invariant the instructor asked for in words: across the whole life of the term — nothing
// built, half built, fully built, over-built — the number of homeworks the projection reasons
// over is the promised 13 until the real ones exceed it, and never 13 PLUS the real ones. It
// must not matter how many of the real ones have been graded, since a graded assignment leaves
// `remaining` but is still an assignment that exists.
{
  const bad = [];
  for (let real = 0; real <= 15; real++) {
    const all = withHw(real);
    for (let gradedCount = 0; gradedCount <= real; gradedCount++) {
      const gradedIds = new Set(hwRun(gradedCount).map(a => a.id));
      const { remaining } = splitRemaining(all, gradedIds);
      const scenario = [...remaining, ...plannedRemaining(all, PLANNED)];
      const hwInPlay = gradedCount + scenario.filter(a => a.catId === "cat_hw").length;
      const ids = new Set(scenario.map(a => a.id));
      if (hwInPlay !== Math.max(13, real)) bad.push(`${real} built/${gradedCount} graded → ${hwInPlay}`);
      if (ids.size !== scenario.length) bad.push(`${real}/${gradedCount} duplicate id`);
    }
  }
  eq("the term holds 13 homeworks at every stage of building and grading them", bad, []);
}

// The same thing read as the panel's own label, since that is what the student sees.
{
  const all = withHw(6);
  const { remaining } = splitRemaining(all, new Set(["hw1", "hw2", "hw3", "hw4", "hw5"]));
  const groups = scenarioGroups([...remaining, ...plannedRemaining(all, PLANNED)], PLANNED);
  eq("five graded of six built leaves 8 homeworks to plan over", groups.find(g => g.id === "cat_hw").count, 8);
  eq("which is the promised 13 less the five that are marked", 13 - 5, 8);
}

// ── the projection over a term that is still being written ───────────────────
{
  // Three homeworks marked (10, 2, 10) of a promised 13, one lab marked, the final ahead.
  const all = withHw(3);
  const gradedIds = new Set(["hw1", "hw2", "hw3", "lab1"]);
  const gradedList = all.filter(a => gradedIds.has(a.id));
  const scores = { hw1: 10, hw2: 2, hw3: 10, lab1: 8 };
  const DROPPING = { ...PLANNED, cat_hw: { ...PLANNED.cat_hw, dropLowest: 1 } };
  const scenario = [...splitRemaining(all, gradedIds).remaining, ...plannedRemaining(all, DROPPING)];

  const ace = projectScenario({ assignments: gradedList, remaining: scenario, categories: DROPPING, scores, excused: {}, pctByCat: { cat_hw: 100 } });
  eq("the slider reaches all ten unwritten homeworks, not just the built ones", ace.byCategory.cat_hw.possible, 120);
  eq("and the lowest of the thirteen is still dropped", ace.byCategory.cat_hw.dropped, ["hw2"]);
  near("so acing the rest of the term is a perfect homework category", ace.byCategory.cat_hw.pct, 100);

  const zero = projectScenario({ assignments: gradedList, remaining: scenario, categories: DROPPING, scores, excused: {}, pctByCat: { cat_hw: 0 } });
  eq("giving up drops a placeholder zero instead", zero.byCategory.cat_hw.dropped.length, 1);
  near("and the marks already earned are all that is left", zero.byCategory.cat_hw.pct, 22 / 120 * 100);
  near("the slider never touches work already graded", zero.byCategory.cat_hw.earned, 22);
  eq("a category the panel was not asked about keeps only its real work", zero.byCategory.cat_lab.possible, 10);
}

// ── clampPct ─────────────────────────────────────────────────────────────────
eq("out-of-range input is clamped, not trusted", [clampPct(120), clampPct(-5), clampPct("87.5"), clampPct(""), clampPct(null)], [100, 0, 87.5, 0, 0]);

// ── the reading of an overall ────────────────────────────────────────────────
eq("letter bands", [93, 90, 89.9, 83, 70, 60, 59.9].map(overallLetter), ["A", "A-", "B+", "B", "C-", "D-", "F"]);
eq("no grade has no letter and no color", [overallLetter(null), overallColor(null)], [null, null]);
eq("band colors", [95, 85, 75, 65, 55].map(overallColor), ["#4ade80", "#a3e635", "#facc15", "#fb923c", "#f87171"]);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
