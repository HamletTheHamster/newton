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
import { splitRemaining, scenarioGroups, defaultPcts, projectScenario, clampPct, overallLetter, overallColor } from "./grade-scenarios.js";
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

// ── clampPct ─────────────────────────────────────────────────────────────────
eq("out-of-range input is clamped, not trusted", [clampPct(120), clampPct(-5), clampPct("87.5"), clampPct(""), clampPct(null)], [100, 0, 87.5, 0, 0]);

// ── the reading of an overall ────────────────────────────────────────────────
eq("letter bands", [93, 90, 89.9, 83, 70, 60, 59.9].map(overallLetter), ["A", "A-", "B+", "B", "C-", "D-", "F"]);
eq("no grade has no letter and no color", [overallLetter(null), overallColor(null)], [null, null]);
eq("band colors", [95, 85, 75, 65, 55].map(overallColor), ["#4ade80", "#a3e635", "#facc15", "#fb923c", "#f87171"]);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
