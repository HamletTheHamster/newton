// Due-date and per-student-extension tests. Run with:  node src/due-dates.test.mjs
//
// These decide whether a student's work is halved for lateness, so a silent regression here
// costs real marks. The extension path in particular was display-only until this was written:
// the Gradebook showed "Extended to ...", and every late check still read the class date.
//
// Plain node, no framework and no dependencies, in keeping with the repo having no test runner.
import { dueToDate, isLate, effectiveDue, fmtDueTime } from "./utils.js";
let fails = 0;
const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) { fails++; console.log(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } else console.log(`ok   ${l}`); };

// An extension replaces the assignment's date; no extension leaves it alone.
eq("no override keeps the class date", effectiveDue("2026-09-01", undefined), "2026-09-01");
eq("override with no dueDate keeps the class date", effectiveDue("2026-09-01", { score: 8 }), "2026-09-01");
eq("an extension wins", effectiveDue("2026-09-01", { dueDate: "2026-09-15T17:00" }), "2026-09-15T17:00");
eq("an extension works with no class date", effectiveDue(null, { dueDate: "2026-09-15T17:00" }), "2026-09-15T17:00");

// The picker's "T" form must be read in Eastern, like every other due date.
const spaceForm = dueToDate("2026-09-15 17:00");
const tForm = dueToDate("2026-09-15T17:00");
eq("both separators resolve to the same instant", tForm.getTime(), spaceForm.getTime());
eq("the extension's own time is displayed, not the 11:59 default", fmtDueTime("2026-09-15T17:00"), "5:00 PM");

// The behaviour that was broken: an extended student is no longer late.
const past = "2026-08-01", future = "2099-01-01T23:00";
eq("past due without an extension is late", !!isLate(effectiveDue(past, undefined)), true);
eq("past due WITH an extension is not late", !!isLate(effectiveDue(past, { dueDate: future })), false);
eq("an expired extension is late again", !!isLate(effectiveDue(future, { dueDate: past })), true);

console.log(fails ? `\n${fails} FAILURE(S)` : "\nall passed");
process.exit(fails ? 1 : 0);
