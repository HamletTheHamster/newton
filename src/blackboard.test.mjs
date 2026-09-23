// Blackboard interchange tests — plain `node src/blackboard.test.mjs`, no framework, matching
// the other three test files in this repo.
//
// This one earns its place for the same reason hw-telemetry's does: a wrong answer here is
// silently plausible. A CSV that looks right but carries a mistyped column id, a dropped
// leading zero on a student ID, or a score in the wrong column uploads without complaint and
// corrupts the OFFICIAL gradebook of record, where the error is discovered by a student.

import assert from "node:assert/strict";
import {
  parseCsv, toCsv, parseColumnHeader, formatColumnHeader, isCalculatedColumn,
  normalizeTitle, readBlackboardExport, suggestColumnMap, buildBlackboardCsv,
  mergeImport, pairColumn, newColumnHeader, pendingExemptions,
  formatScore, timeStamp, gradebookFilename,
} from "./blackboard.js";

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; } };

// ── CSV reading ──────────────────────────────────────────────────────────────
test("parseCsv keeps a comma inside a quoted field", () => {
  const rows = parseCsv('"a","Homework 5: Current, Resistance, & EMF","c"');
  assert.deepEqual(rows, [["a", "Homework 5: Current, Resistance, & EMF", "c"]]);
});

test("parseCsv unescapes doubled quotes and handles CRLF", () => {
  const rows = parseCsv('"he said ""hi""","b"\r\n"c","d"\r\n');
  assert.deepEqual(rows, [['he said "hi"', "b"], ["c", "d"]]);
});

test("parseCsv strips the UTF-8 BOM so the first header matches", () => {
  assert.equal(parseCsv('﻿"Last Name","First Name"')[0][0], "Last Name");
});

test("parseCsv keeps a newline inside a quoted field", () => {
  assert.deepEqual(parseCsv('"one\ntwo","b"'), [["one\ntwo", "b"]]);
});

test("toCsv round-trips through parseCsv", () => {
  const rows = [["Last Name", 'Quiz "1"'], ["Chavez", "10"]];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test("toCsv writes the BOM Blackboard's own export carries", () => {
  assert.equal(toCsv([["a"]]).charCodeAt(0), 0xfeff);
});

// ── Column headers ───────────────────────────────────────────────────────────
test("parseColumnHeader reads title, points and the load-bearing column id", () => {
  assert.deepEqual(parseColumnHeader("Quiz 1 [Total Pts: 10 Score] |1281892"),
    { title: "Quiz 1", points: 10, variablePoints: false, display: "Score", bbId: "1281892" });
});

test("parseColumnHeader reads a /100 exam column", () => {
  const c = parseColumnHeader("Midterm Exam [Total Pts: 100 Score] |1281894");
  assert.equal(c.points, 100); assert.equal(c.bbId, "1281894");
});

test("parseColumnHeader flags an 'up to N' calculated column", () => {
  const c = parseColumnHeader("Overall Grade [Total Pts: up to 55 Letter] |1281890");
  assert.equal(c.variablePoints, true);
  assert.equal(c.points, null);
  assert.equal(c.display, "Letter");
  assert.equal(isCalculatedColumn(c), true);
});

test("parseColumnHeader returns null for an identity column", () => {
  assert.equal(parseColumnHeader("Last Access"), null);
});

test("formatColumnHeader reproduces the header byte-for-byte", () => {
  const h = "Lab 1a [Total Pts: 10 Score] |1281896";
  assert.equal(formatColumnHeader(parseColumnHeader(h)), h);
});

test("isCalculatedColumn catches Weighted Total by name even at fixed points", () => {
  assert.equal(isCalculatedColumn({ title: "Weighted Total", points: 100, variablePoints: false }), true);
  assert.equal(isCalculatedColumn({ title: "Quiz 1", points: 10, variablePoints: false }), false);
});

// ── Title normalization ──────────────────────────────────────────────────────
test("normalizeTitle bridges Newton's full titles and Blackboard's abbreviations", () => {
  assert.equal(normalizeTitle("Homework 1: Electric Charge & Electric Field"), normalizeTitle("HW1"));
  assert.equal(normalizeTitle("Quiz 1: Welcome & Course Survey"), normalizeTitle("Quiz 1"));
  assert.equal(normalizeTitle("Lab 1a"), normalizeTitle("Lab 1A"));
  assert.equal(normalizeTitle("Midterm Exam"), "midtermexam");
});

test("normalizeTitle keeps genuinely different assignments apart", () => {
  assert.notEqual(normalizeTitle("Quiz 1"), normalizeTitle("Quiz 2"));
  assert.notEqual(normalizeTitle("Lab 1a"), normalizeTitle("Lab 1b"));
  assert.notEqual(normalizeTitle("HW1"), normalizeTitle("Quiz 1"));
});

// ── Reading a real Blackboard download ───────────────────────────────────────
const BB = toCsv([
  ["Last Name", "First Name", "Username", "Student ID", "Last Access", "Availability",
   "Quiz 1 [Total Pts: 10 Score] |1281892", "HW1 [Total Pts: 10 Score] |1281893",
   "Lab 1a [Total Pts: 10 Score] |1281896", "Midterm Exam [Total Pts: 100 Score] |1281894",
   "Overall Grade [Total Pts: up to 55 Letter] |1281890"],
  ["Chavez", "Peter", "peter.chavez", "0442474", "2026-09-01 20:20:47", "Yes", "", "", "", "", ""],
  ["Gnandt", "Wesley", "wesley.gnandt", "0433673", "2026-09-01 18:53:47", "Yes", "", "", "", "", ""],
  ["Patel", "Kunj", "kunj.patel2", "0439413", "2026-09-01 22:28:34", "Yes", "", "", "", "", ""],
]);

const ROSTER = [
  { studentId: "0442474", firstName: "Peter", lastName: "Chavez", fullName: "Peter Chavez" },
  { studentId: "0433673", firstName: "Wes", lastName: "Gnandt", fullName: "Wes Gnandt" },   // preferred name ≠ Blackboard's
  { studentId: "0439413", firstName: "Kunj", lastName: "Patel", fullName: "Kunj Patel" },
  { studentId: "9999999", firstName: "Joel", lastName: "Johnson", fullName: "Joel Johnson" }, // instructor test account
];

test("readBlackboardExport collects the grade columns and skips identity columns", () => {
  const r = readBlackboardExport(BB, ROSTER);
  assert.equal(r.error, null);
  assert.deepEqual(r.columns.map(c => c.title), ["Quiz 1", "HW1", "Lab 1a", "Midterm Exam", "Overall Grade"]);
});

test("readBlackboardExport matches by student ID even when the first name differs", () => {
  const r = readBlackboardExport(BB, ROSTER);
  const wes = r.links.find(l => l.studentId === "0433673");
  assert.equal(wes.username, "wesley.gnandt");
});

test("readBlackboardExport reports a roster student Blackboard doesn't have", () => {
  const r = readBlackboardExport(BB, ROSTER);
  assert.deepEqual(r.unmatchedStudents.map(s => s.studentId), ["9999999"]);
  assert.deepEqual(r.unmatchedRows, []);
});

test("readBlackboardExport matches a roster whose IDs lost their leading zero", () => {
  const stripped = ROSTER.map(s => ({ ...s, studentId: s.studentId.replace(/^0+/, "") }));
  const r = readBlackboardExport(BB, stripped);
  assert.equal(r.links.length, 3);
});

test("readBlackboardExport falls back to first+last name when there is no ID column", () => {
  const noId = toCsv([["Last Name", "First Name", "Username"], ["Chavez", "Peter", "peter.chavez"]]);
  const r = readBlackboardExport(noId, ROSTER);
  assert.equal(r.links[0].username, "peter.chavez");
});

test("readBlackboardExport never guesses across a name difference without an ID", () => {
  const noId = toCsv([["Last Name", "First Name", "Username"], ["Gnandt", "Wesley", "wesley.gnandt"]]);
  const r = readBlackboardExport(noId, ROSTER);
  assert.equal(r.links.length, 0);
  assert.equal(r.unmatchedRows.length, 1);
});

test("readBlackboardExport refuses a file with no Username column", () => {
  const r = readBlackboardExport(toCsv([["Last Name", "First Name"], ["Chavez", "Peter"]]), ROSTER);
  assert.match(r.error, /Username/);
});

// ── Suggested mapping ────────────────────────────────────────────────────────
const ASSIGNMENTS = [
  { id: "q1", title: "Quiz 1: Welcome & Course Survey", maxPts: 10 },
  { id: "hw1", title: "Homework 1: Electric Charge & Electric Field", maxPts: 10 },
  { id: "lab_1a", title: "Lab 1a", maxPts: 10 },
  { id: "midterm", title: "Midterm Exam", maxPts: 100 },
  { id: "q2", title: "Quiz 2: Electric Charge", maxPts: 10 },  // no Blackboard column yet
];

test("suggestColumnMap links the four columns that exist and leaves the fifth alone", () => {
  const { columns } = readBlackboardExport(BB, ROSTER);
  const map = suggestColumnMap(ASSIGNMENTS, columns);
  assert.deepEqual(map, { q1: "1281892", hw1: "1281893", lab_1a: "1281896", midterm: "1281894" });
});

test("suggestColumnMap never proposes a calculated column", () => {
  const { columns } = readBlackboardExport(BB, ROSTER);
  const map = suggestColumnMap([{ id: "x", title: "Overall Grade", maxPts: 10 }], columns);
  assert.deepEqual(map, {});
});

test("suggestColumnMap gives an ambiguous title no suggestion at all", () => {
  const cols = [
    { title: "Quiz 1", points: 10, display: "Score", bbId: "1" },
    { title: "quiz 1", points: 10, display: "Score", bbId: "2" },
  ];
  assert.deepEqual(suggestColumnMap([{ id: "q1", title: "Quiz 1", maxPts: 10 }], cols), {});
});

test("suggestColumnMap claims each Blackboard column at most once", () => {
  const cols = [{ title: "Quiz 1", points: 10, display: "Score", bbId: "1" }];
  const map = suggestColumnMap([{ id: "a", title: "Quiz 1", maxPts: 10 }, { id: "b", title: "Quiz 1", maxPts: 10 }], cols);
  assert.deepEqual(map, { a: "1" });
});

// ── Re-import merge and manual pairing ───────────────────────────────────────
test("mergeImport keeps a hand-made pairing the new download still contains", () => {
  const res = readBlackboardExport(BB, ROSTER);
  const prev = { columns: res.columns, map: { q2: "1281896" }, usernames: {} };   // Quiz 2 → Lab 1a, by hand
  const { link } = mergeImport(prev, res, ASSIGNMENTS, "gc.csv");
  assert.equal(link.map.q2, "1281896");
  assert.equal(link.map.lab_1a, undefined, "auto-match must not steal a claimed column");
});

test("mergeImport drops a pairing whose column no longer exists in Blackboard", () => {
  const res = readBlackboardExport(BB, ROSTER);
  const prev = { columns: [], map: { q1: "9999999" }, usernames: {} };
  const { link } = mergeImport(prev, res, ASSIGNMENTS, "gc.csv");
  assert.equal(link.map.q1, "1281892", "re-matched to the column that does exist");
});

test("mergeImport auto-matches only what is still unpaired", () => {
  const res = readBlackboardExport(BB, ROSTER);
  const prev = { columns: res.columns, map: { q1: "1281892" }, usernames: {} };
  const { newlyMatched, keptMatches } = mergeImport(prev, res, ASSIGNMENTS, "gc.csv");
  assert.equal(keptMatches, 1);
  assert.equal(newlyMatched, 3);   // hw1, lab_1a, midterm
});

test("mergeImport accumulates usernames rather than replacing them", () => {
  const res = readBlackboardExport(BB, ROSTER);
  const prev = { columns: [], map: {}, usernames: { "5555555": "old.student" } };
  const { link } = mergeImport(prev, res, ASSIGNMENTS, "gc.csv");
  assert.equal(link.usernames["5555555"], "old.student");
  assert.equal(link.usernames["0442474"], "peter.chavez");
});

test("mergeImport records the file and time it came from", () => {
  const res = readBlackboardExport(BB, ROSTER);
  const { link } = mergeImport(null, res, ASSIGNMENTS, "gc_83679.csv", new Date(2026, 8, 2, 14, 49));
  assert.equal(link.sourceFile, "gc_83679.csv");
  assert.equal(typeof link.importedAt, "string");
});

test("pairColumn frees a column from whatever assignment held it", () => {
  assert.deepEqual(pairColumn({ q1: "A", hw1: "B" }, "q2", "A"), { hw1: "B", q2: "A" });
});

test("pairColumn with an empty id unpairs the assignment", () => {
  assert.deepEqual(pairColumn({ q1: "A", hw1: "B" }, "q1", ""), { hw1: "B" });
});

test("pairColumn re-pairing an assignment replaces its old column", () => {
  assert.deepEqual(pairColumn({ q1: "A" }, "q1", "B"), { q1: "B" });
});

// ── Building the upload file ─────────────────────────────────────────────────
function fixture() {
  const { columns, links } = readBlackboardExport(BB, ROSTER);
  return {
    roster: ROSTER,
    assignments: ASSIGNMENTS,
    link: {
      columns,
      map: suggestColumnMap(ASSIGNMENTS, columns),
      usernames: Object.fromEntries(links.map(l => [l.studentId, l.username])),
    },
    scoreMap: {
      "0442474": { q1: 10, hw1: 8.333333, lab_1a: 10, midterm: 87, q2: 9 },
      "0433673": { q1: 7.5, midterm: 91 },
      "0439413": { q1: 0 },
    },
    excusedMap: { "0433673": { lab_1a: true } },
  };
}

test("buildBlackboardCsv writes exactly the linked columns, headers intact", () => {
  const r = buildBlackboardCsv(fixture());
  const [header] = parseCsv(r.csv);
  assert.deepEqual(header, [
    "Last Name", "First Name", "Username", "Student ID",
    "Quiz 1 [Total Pts: 10 Score] |1281892",
    "HW1 [Total Pts: 10 Score] |1281893",
    "Lab 1a [Total Pts: 10 Score] |1281896",
    "Midterm Exam [Total Pts: 100 Score] |1281894",
  ]);
});

test("buildBlackboardCsv omits Last Access, Availability and every calculated column", () => {
  const header = parseCsv(buildBlackboardCsv(fixture()).csv)[0].join("|");
  for (const banned of ["Last Access", "Availability", "Overall Grade"]) {
    assert.equal(header.includes(banned), false, `${banned} must not be uploaded`);
  }
});

test("buildBlackboardCsv drops a student with no username and says so", () => {
  const r = buildBlackboardCsv(fixture());
  const rows = parseCsv(r.csv).slice(1);
  assert.equal(rows.length, 3);
  assert.equal(r.studentCount, 3);
  assert.deepEqual(r.skippedStudents.map(s => s.studentId), ["9999999"]);
});

test("buildBlackboardCsv sorts by last name, as Blackboard's own download does", () => {
  const rows = parseCsv(buildBlackboardCsv(fixture()).csv).slice(1);
  assert.deepEqual(rows.map(r => r[0]), ["Chavez", "Gnandt", "Patel"]);
});

test("buildBlackboardCsv rounds fractional part credit to 2dp with no trailing zeros", () => {
  const rows = parseCsv(buildBlackboardCsv(fixture()).csv).slice(1);
  assert.equal(rows[0][5], "8.33");  // 8.333333 homework
  assert.equal(rows[0][4], "10");    // not "10.00"
  assert.equal(rows[1][4], "7.5");   // not "7.50"
});

test("buildBlackboardCsv writes a real zero, and blanks only what is ungraded", () => {
  const rows = parseCsv(buildBlackboardCsv(fixture()).csv).slice(1);
  assert.equal(rows[2][4], "0");   // Patel scored 0 on Quiz 1 — a grade, not a gap
  assert.equal(rows[2][5], "");    // never submitted HW1
});

test("buildBlackboardCsv leaves an excused cell blank (upload cannot set the exempt flag)", () => {
  const rows = parseCsv(buildBlackboardCsv(fixture()).csv).slice(1);
  assert.equal(rows[1][6], "");    // Gnandt, Lab 1a, excused
});

test("buildBlackboardCsv reports an unlinked assignment instead of creating a column", () => {
  const r = buildBlackboardCsv(fixture());
  assert.deepEqual(r.skippedAssignments.map(a => a.id), ["q2"]);
  assert.equal(r.csv.includes("Quiz 2"), false);
});

test("buildBlackboardCsv flags a points mismatch between the two systems", () => {
  const f = fixture();
  f.assignments = f.assignments.map(a => a.id === "midterm" ? { ...a, maxPts: 10 } : a);
  const r = buildBlackboardCsv(f);
  assert.deepEqual(r.pointMismatches.map(m => m.assignment.id), ["midterm"]);
});

test("buildBlackboardCsv with nothing linked yields a header-only file, no crash", () => {
  const r = buildBlackboardCsv({ roster: ROSTER, assignments: ASSIGNMENTS, link: {}, scoreMap: {}, excusedMap: {} });
  assert.equal(r.exportedCount, 0);
  assert.equal(r.studentCount, 0);
});

test("the built file re-reads as a valid Blackboard export (round trip)", () => {
  const r = buildBlackboardCsv(fixture());
  const back = readBlackboardExport(r.csv, ROSTER);
  assert.equal(back.error, null);
  assert.equal(back.links.length, 3);
  assert.deepEqual(back.columns.map(c => c.bbId), ["1281892", "1281893", "1281896", "1281894"]);
});

// ── Creating columns Blackboard has never seen ───────────────────────────────
test("newColumnHeader is the bare title — no bracket suffix, no id", () => {
  assert.equal(newColumnHeader({ title: "Quiz 2: Electric Charge", maxPts: 10 }), "Quiz 2: Electric Charge");
});

test("createMissing exports an unlinked assignment that somebody has a score in", () => {
  const r = buildBlackboardCsv({ ...fixture(), createMissing: true });
  const header = parseCsv(r.csv)[0];
  assert.equal(header.includes("Quiz 2: Electric Charge"), true);
  assert.deepEqual(r.created.map(a => a.id), ["q2"]);
  assert.equal(r.linkedCount, 4);
});

test("a created column carries no column id, which is what makes Blackboard create it", () => {
  const r = buildBlackboardCsv({ ...fixture(), createMissing: true });
  const newHeader = parseCsv(r.csv)[0].find(h => h.startsWith("Quiz 2"));
  assert.equal(newHeader.includes("|"), false);
  assert.equal(newHeader.includes("Total Pts"), false);
});

test("createMissing still routes a LINKED assignment through its existing column id", () => {
  const header = parseCsv(buildBlackboardCsv({ ...fixture(), createMissing: true }).csv)[0];
  assert.equal(header.includes("Quiz 1 [Total Pts: 10 Score] |1281892"), true);
});

test("an unlinked assignment nobody has a score in is held back, not exported", () => {
  // Blackboard only creates a column when at least one student has a grade in it, so an
  // all-blank column would silently fail to appear while looking like it worked.
  const f = { ...fixture(), createMissing: true };
  f.assignments = [...f.assignments, { id: "q3", title: "Quiz 3: Gauss's Law", maxPts: 10 }];
  const r = buildBlackboardCsv(f);
  assert.deepEqual(r.skippedEmpty.map(a => a.id), ["q3"]);
  assert.equal(r.csv.includes("Quiz 3"), false);
});

test("a score belonging only to a student with no username does not count as data", () => {
  const f = { ...fixture(), createMissing: true };
  f.assignments = [...f.assignments, { id: "q3", title: "Quiz 3", maxPts: 10 }];
  f.scoreMap = { ...f.scoreMap, "9999999": { q3: 10 } };   // the unlinked instructor account
  const r = buildBlackboardCsv(f);
  assert.deepEqual(r.skippedEmpty.map(a => a.id), ["q3"]);
});

test("an excused-only assignment is not enough to create a column", () => {
  const f = { ...fixture(), createMissing: true };
  f.assignments = [...f.assignments, { id: "q3", title: "Quiz 3", maxPts: 10 }];
  f.excusedMap = { ...f.excusedMap, "0442474": { q3: true } };
  assert.deepEqual(buildBlackboardCsv(f).skippedEmpty.map(a => a.id), ["q3"]);
});

test("createMissing off keeps the old behaviour exactly", () => {
  const r = buildBlackboardCsv({ ...fixture(), createMissing: false });
  assert.deepEqual(r.created, []);
  assert.deepEqual(r.skippedAssignments.map(a => a.id), ["q2"]);
});

test("a created column re-links by name on the NEXT import, with no hand-pairing", () => {
  // The round trip that makes the whole scheme work: upload creates "Quiz 2: Electric Charge",
  // Blackboard assigns it an id, the next download carries that id, and mergeImport picks it up.
  const f = fixture();
  const afterBlackboard = toCsv([
    ["Last Name", "First Name", "Username", "Student ID",
     "Quiz 1 [Total Pts: 10 Score] |1281892", "Quiz 2: Electric Charge [Total Pts: 0 Text] |1281999"],
    ["Chavez", "Peter", "peter.chavez", "0442474", "10", "9"],
  ]);
  const res = readBlackboardExport(afterBlackboard, ROSTER);
  const { link } = mergeImport(f.link, res, ASSIGNMENTS, "gc2.csv");
  assert.equal(link.map.q2, "1281999");
  const out = buildBlackboardCsv({ ...f, link });
  assert.equal(parseCsv(out.csv)[0].includes("Quiz 2: Electric Charge [Total Pts: 0 Text] |1281999"), true);
  assert.deepEqual(out.created, []);
});

// ── Recorded zeros ───────────────────────────────────────────────────────────
// A past-due assignment with nothing handed in has no entry in `scoreMap` — Newton keeps "no
// score" and "a zero" apart — but the grade arithmetic has always counted it as a zero. Sending
// a blank to Blackboard is NOT sending a zero: under "points earned out of total graded points"
// a blank leaves the item out of the denominator, so the missing work would RAISE the Blackboard
// grade while lowering the Newton one, and the two gradebooks would disagree by exactly the work
// a student failed to do.
test("a recorded zero uploads as a real 0, not a blank", () => {
  const f = fixture();
  f.zeroMap = { "0433673": { hw1: true } };          // Gnandt: past due, nothing handed in
  const rows = parseCsv(buildBlackboardCsv(f).csv).slice(1);
  assert.equal(rows[1][5], "0");
});

test("an excused cell stays blank even if it is also past due", () => {
  const f = fixture();
  f.zeroMap = { "0433673": { lab_1a: true, hw1: true } };
  const rows = parseCsv(buildBlackboardCsv(f).csv).slice(1);
  assert.equal(rows[1][6], "", "excused outranks the zero — a blank is the only honest cell");
});

test("a real score always outranks a zero flag", () => {
  const f = fixture();
  f.zeroMap = { "0442474": { q1: true } };
  assert.equal(parseCsv(buildBlackboardCsv(f).csv)[1][4], "10");
});

test("a cell with no score and no zero flag stays blank", () => {
  const rows = parseCsv(buildBlackboardCsv(fixture()).csv).slice(1);
  assert.equal(rows[1][5], "", "Gnandt's HW1 is not yet due — nothing to say about it");
});

test("a recorded zero is enough to have Blackboard create the column", () => {
  // Nobody has a score on q2, but the whole class has missed it. That is precisely the column
  // that needs creating — holding it back would leave the zeros nowhere to land.
  const f = fixture();
  f.scoreMap = { ...f.scoreMap, "0442474": { ...f.scoreMap["0442474"], q2: undefined } };
  f.zeroMap = { "0442474": { q2: true }, "0433673": { q2: true } };
  const r = buildBlackboardCsv({ ...f, createMissing: true });
  assert.deepEqual(r.created.map(a => a.id), ["q2"]);
  const col = parseCsv(r.csv)[0].indexOf("Quiz 2: Electric Charge");
  assert.equal(parseCsv(r.csv)[1][col], "0");
});

// ── Exemptions ───────────────────────────────────────────────────────────────
// Blackboard's exempt flag cannot be uploaded and does not even survive a download (a cell
// exempted in Ultra comes back holding its score). So the excused cell goes up blank, Blackboard
// keeps whatever it had, and the instructor gets a punch list instead of a promise.
const BB_GRADED = toCsv([
  ["Last Name", "First Name", "Username", "Student ID", "Last Access", "Availability",
   "Quiz 1 [Total Pts: 10 Score] |1281892", "HW1 [Total Pts: 10 Score] |1281893",
   "Lab 1a [Total Pts: 10 Score] |1281896", "Midterm Exam [Total Pts: 100 Score] |1281894",
   "Overall Grade [Total Pts: up to 55 Letter] |1281890"],
  ["Chavez", "Peter", "peter.chavez", "0442474", "2026-09-01 20:20:47", "Yes", "10.00", "8.33", "10.00", "87.00", "A"],
  ["Gnandt", "Wesley", "wesley.gnandt", "0433673", "2026-09-01 18:53:47", "Yes", "7.50", "", "0.00", "91.00", "B"],
  ["Patel", "Kunj", "kunj.patel2", "0439413", "2026-09-01 22:28:34", "Yes", "0.00", "", "", "", "F"],
]);

test("readBlackboardExport reads each matched student's cell values by column id", () => {
  const r = readBlackboardExport(BB_GRADED, ROSTER);
  assert.equal(r.values["0433673"]["1281892"], "7.50");
  assert.equal(r.values["0433673"]["1281896"], "0.00");
  assert.equal(r.values["0433673"]["1281893"], "", "an empty cell is recorded as empty, not missing");
  assert.equal(r.values["9999999"], undefined, "nobody Blackboard does not have");
});

test("mergeImport replaces the value snapshot rather than merging it", () => {
  // Values are only ever read beside `importedAt`. Merging an older file's cells in would build
  // a grid that was never true of Blackboard at any single moment.
  const prev = { columns: [], map: {}, usernames: {}, values: { "0442474": { "1281892": "3" } } };
  const { link } = mergeImport(prev, readBlackboardExport(BB_GRADED, ROSTER), ASSIGNMENTS, "gc.csv");
  assert.equal(link.values["0442474"]["1281892"], "10.00");
});

function exemptFixture() {
  const f = fixture();
  const res = readBlackboardExport(BB_GRADED, ROSTER);
  const { link } = mergeImport(f.link, res, ASSIGNMENTS, "gc.csv");
  return { roster: ROSTER, assignments: ASSIGNMENTS, link, excusedMap: f.excusedMap };
}

test("pendingExemptions lists the excused cell with what Blackboard still shows", () => {
  const [x, ...rest] = pendingExemptions(exemptFixture());
  assert.deepEqual(rest, []);
  assert.equal(x.studentName, "Wes Gnandt");
  assert.equal(x.assignmentId, "lab_1a");
  assert.equal(x.column.title, "Lab 1a");
  assert.equal(x.bbShows, "0.00", "the stale score under the exemption is the whole point");
});

test("pendingExemptions marks a cell Blackboard already has empty", () => {
  const f = exemptFixture();
  f.excusedMap = { "0433673": { hw1: true } };
  assert.equal(pendingExemptions(f)[0].bbShows, "");
});

test("pendingExemptions says nothing about a pairing the last import did not cover", () => {
  const f = exemptFixture();
  f.link = { ...f.link, values: {} };
  assert.equal(pendingExemptions(f)[0].bbShows, undefined);
});

test("pendingExemptions skips an assignment with no Blackboard column", () => {
  const f = exemptFixture();
  f.excusedMap = { "0442474": { q2: true } };   // q2 has no linked column
  assert.deepEqual(pendingExemptions(f), []);
});

test("pendingExemptions skips a student Blackboard does not have", () => {
  const f = exemptFixture();
  f.excusedMap = { "9999999": { lab_1a: true } };
  assert.deepEqual(pendingExemptions(f), []);
});

// ── Scores and filenames ─────────────────────────────────────────────────────
test("formatScore blanks a missing grade but keeps a zero", () => {
  assert.equal(formatScore(null), "");
  assert.equal(formatScore(undefined), "");
  assert.equal(formatScore(0), "0");
});

test("timeStamp reads in LOCAL time so it matches the clock on the wall", () => {
  assert.equal(timeStamp(new Date(2026, 8, 2, 14, 49)), "2026-09-02-1449");
});

test("gradebookFilename stamps the download and sanitizes the course code", () => {
  const d = new Date(2026, 8, 2, 9, 5);
  assert.equal(gradebookFilename("phy215", "gradebook", d), "phy215-gradebook-2026-09-02-0905.csv");
  assert.equal(gradebookFilename("PHY 215/2", "blackboard", d), "PHY-215-2-blackboard-2026-09-02-0905.csv");
  assert.equal(gradebookFilename("", "gradebook", d), "gradebook-2026-09-02-0905.csv");
});

console.log(`✓ ${passed} blackboard tests passed`);
