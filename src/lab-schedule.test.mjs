// Lab schedule tests. Run with:  node src/lab-schedule.test.mjs
//
// The seeded count IS the course's lab schedule, and a lab is not something the instructor builds
// in the app — there is no UI to add or delete one. So getting the count wrong quietly changes the
// gradebook's possible points, the lecture-absence policy and the student's grade projection
// together, and once a class is seeded no screen in the app can correct it.
import { DEFAULT_LAB_WEEKS, labWeeksFor, labAssignments } from "./lab-schedule.js";

let fails = 0;
const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) { fails++; console.log(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } else console.log(`ok   ${l}`); };

// ── the seeded list ──────────────────────────────────────────────────────────
eq("PHY 215 teaches 13 lecture weeks, so 26 lab sessions", labWeeksFor("physics2") * 2, 26);
eq("PHY 115 teaches 14, and is not shortened along with it", labWeeksFor("physics1") * 2, 28);
eq("an unlisted course keeps the original count, since too few labs cannot be added back",
  [labWeeksFor("chem101"), labWeeksFor(undefined)], [DEFAULT_LAB_WEEKS, DEFAULT_LAB_WEEKS]);

{
  const labs = labAssignments(labWeeksFor("physics2"));
  eq("thirteen weeks, two sessions each", Object.keys(labs).length, 26);
  eq("numbered consecutively, with no gap for midterm week", [labs.asgn_lab1a.title, labs.asgn_lab7b.title, labs.asgn_lab13b.title], ["Lab 1a", "Lab 7b", "Lab 13b"]);
  eq("there is no fourteenth week", [labs.asgn_lab14a, labs.asgn_lab14b], [undefined, undefined]);
  eq("and PHY 115's list still has one", Object.keys(labAssignments(labWeeksFor("physics1"))).length, 28);
  eq("every session is a 10-point lab", [...new Set(Object.values(labs).map(l => `${l.catId}/${l.maxPts}`))], ["cat_lab/10"]);
  // Labs sort after every module item and both exams, and a week's two sessions stay adjacent
  // and in order — the gradebook and the student's grades list are both read in this order.
  const orders = Object.values(labs).map(l => l.order);
  eq("ordered from 2000, contiguous, a before b", [orders[0], orders.at(-1), orders.length === new Set(orders).size, orders.every((o, i) => i === 0 || o === orders[i - 1] + 1)], [2000, 2025, true, true]);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
