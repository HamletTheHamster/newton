// Lab schedule tests. Run with:  node src/lab-schedule.test.mjs
//
// Two things here can hurt someone. The seeded count is the course's lab schedule, so getting it
// wrong quietly changes the gradebook's possible points, the lecture-absence policy and the
// student's grade projection together. And `trimmableLabs` DELETES assignments out of a live
// gradebook to correct a class seeded with too many — the one operation in the app that can make
// a mark disappear, so every guard that stops it is worth a test of its own.
import { DEFAULT_LAB_WEEKS, labWeeksFor, labId, labAssignments, trimmableLabs } from "./lab-schedule.js";

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

// ── trimmableLabs ────────────────────────────────────────────────────────────
const P2 = { weeks: labWeeksFor("physics2") };
const seeded = weeks => ({
  asgn_midterm: { id: "asgn_midterm", catId: "cat_midterm", maxPts: 100 },
  asgn_final: { id: "asgn_final", catId: "cat_final", maxPts: 100 },
  ...labAssignments(weeks),
});

eq("a class seeded with fourteen weeks gives up its last pair",
  trimmableLabs(seeded(14), P2).remove, ["asgn_lab14a", "asgn_lab14b"]);
eq("a correctly seeded class is left alone", trimmableLabs(seeded(13), P2), { remove: [], blocked: null });
eq("and so is a class that has run once already", trimmableLabs(seeded(13), P2), { remove: [], blocked: null });
eq("a shorter list is not padded, only trimmed", trimmableLabs(seeded(10), P2), { remove: [], blocked: null });
eq("no labs at all is not a crash", trimmableLabs({ asgn_final: { id: "asgn_final" } }, P2), { remove: [], blocked: null });
eq("no manual assignments at all is not a crash", trimmableLabs(null, P2), { remove: [], blocked: null });
eq("a sixteen-week seed gives up all three extra pairs",
  trimmableLabs(seeded(16), P2).remove, ["asgn_lab14a", "asgn_lab14b", "asgn_lab15a", "asgn_lab15b", "asgn_lab16a", "asgn_lab16b"]);

// The trim must never be the reason a mark disappears. Any grade record at all against one of
// the labs on the block cancels the whole thing: a score means that lab happened, whatever the
// schedule says, and then the schedule is what is wrong.
for (const [what, rec] of [["a score", { score: 8 }], ["an excusal", { excused: true }], ["a deadline extension", { dueDate: "2026-11-02" }], ["an attendance waiver", { attendanceWaived: true }]]) {
  const r = trimmableLabs(seeded(14), { ...P2, gradeOverrides: { stu1: { asgn_lab14b: rec } } });
  eq(`${what} on the last lab cancels the trim`, r.remove, []);
  eq(`  and says which lab stopped it`, r.blocked.includes("asgn_lab14b"), true);
}
eq("a grade record on a lab that is staying does not block anything",
  trimmableLabs(seeded(14), { ...P2, gradeOverrides: { stu1: { asgn_lab2a: { score: 10 } } } }).remove, ["asgn_lab14a", "asgn_lab14b"]);
eq("nor does one on another kind of assignment",
  trimmableLabs(seeded(14), { ...P2, gradeOverrides: { stu1: { asgn_midterm: { score: 88 }, hw3: { score: 9 } } } }).remove, ["asgn_lab14a", "asgn_lab14b"]);

// A roll call linked to a lab is what the absence policy reads. Deleting that lab would leave
// the policy pointing at an assignment nobody can see, so the link cancels the trim too.
{
  const att = { "2026-12-07": { id: "2026-12-07", date: "2026-12-07", labId: "asgn_lab14a", takenAt: 1 } };
  const r = trimmableLabs(seeded(14), { ...P2, attendance: att });
  eq("a roll call linked to the last lab cancels the trim", r.remove, []);
  eq("  and says so", r.blocked.includes("roll call"), true);
}
eq("a roll call linked to a lab that is staying is fine",
  trimmableLabs(seeded(14), { ...P2, attendance: { d: { labId: "asgn_lab3b", takenAt: 1 } } }).remove, ["asgn_lab14a", "asgn_lab14b"]);
eq("and neither is a session that links no lab",
  trimmableLabs(seeded(14), { ...P2, attendance: { d: { labId: null, takenAt: 1 } } }).remove, ["asgn_lab14a", "asgn_lab14b"]);

// A hand-edited list is not ours to tidy: if the stored labs are not exactly the seeded shape,
// the app does not know what the instructor meant by it and must not delete from it.
{
  const holed = seeded(14);
  delete holed[labId(5, "b")];
  const r = trimmableLabs(holed, P2);
  eq("a gap in the stored weeks cancels the trim", r.remove, []);
  eq("  and says the list is not the seeded one", r.blocked.includes("seeded list"), true);
}
{
  const extra = seeded(14);
  extra.asgn_lab9c = { id: "asgn_lab9c", title: "Lab 9c", catId: "cat_lab", maxPts: 10 };
  eq("an unrecognised session letter is ignored rather than trimmed", trimmableLabs(extra, P2).remove, ["asgn_lab14a", "asgn_lab14b"]);
}
{
  // Removing only the half it is sure about would leave a stranded orphan, so it is all or none.
  const r = trimmableLabs(seeded(15), { ...P2, gradeOverrides: { stu1: { asgn_lab15a: { score: 7 } } } });
  eq("one blocked lab blocks the whole pair, and the pair before it", r.remove, []);
}

// A PHY 115 class holds fourteen weeks of labs legitimately, so the same stored list that gets
// trimmed for PHY 215 must be left completely alone for it.
eq("a fourteen-week class is untouched under PHY 115's own count",
  trimmableLabs(seeded(14), { weeks: labWeeksFor("physics1") }), { remove: [], blocked: null });

// The write the caller makes from this is a PATCH of null at each returned key, so the result
// must never name anything but the labs past the end of the term.
eq("it only ever names labs", trimmableLabs(seeded(16), P2).remove.every(id => /^asgn_lab\d+[ab]$/.test(id)), true);
eq("and only ones past the end of the term",
  trimmableLabs(seeded(16), P2).remove.every(id => Number(/^asgn_lab(\d+)/.exec(id)[1]) > 13), true);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
