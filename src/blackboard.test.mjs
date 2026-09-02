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
  mergeImport, pairColumn, newColumnHeader,
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

// ── Scaling to the Blackboard column's points ────────────────────────────────
// Blackboard creates an uploaded column at ITS default points total (Ultra: 100), and the upload
// format has no field to say otherwise. Scaling is the alternative to editing every column by
// hand: send 80 into a /100 column for an 8/10 quiz so the percentage feeding the Overall Grade
// is right either way.
function scaleFixture() {
  const f = fixture();
  // Blackboard created "Quiz 1" at 100 points; Newton grades it out of 10.
  f.link = { ...f.link, columns: f.link.columns.map(c => c.bbId === "1281892" ? { ...c, points: 100 } : c) };
  return f;
}

test("scaleToColumn off sends raw points and reports the mismatch", () => {
  const r = buildBlackboardCsv({ ...scaleFixture(), scaleToColumn: false });
  assert.deepEqual(r.pointMismatches.map(m => m.assignment.id), ["q1"]);
  assert.deepEqual(r.scaled, []);
  assert.equal(parseCsv(r.csv)[1][4], "10");   // 10/10 raw into a /100 column
});

test("scaleToColumn on converts to the column's scale", () => {
  const r = buildBlackboardCsv({ ...scaleFixture(), scaleToColumn: true });
  const rows = parseCsv(r.csv).slice(1);
  assert.equal(rows[0][4], "100");   // Chavez 10/10 → 100/100
  assert.equal(rows[1][4], "75");    // Gnandt 7.5/10 → 75/100
  assert.equal(rows[2][4], "0");     // Patel 0/10 → 0, still a real zero
  assert.deepEqual(r.scaled.map(x => x.assignment.id), ["q1"]);
});

test("scaling leaves a column whose points already agree completely alone", () => {
  const r = buildBlackboardCsv({ ...scaleFixture(), scaleToColumn: true });
  const rows = parseCsv(r.csv).slice(1);
  assert.equal(rows[0][5], "8.33");  // HW1 is /10 both sides — untouched
  assert.equal(rows[0][7], "87");    // Midterm is /100 both sides — untouched
});

test("scaling never touches a blank or an excused cell", () => {
  const rows = parseCsv(buildBlackboardCsv({ ...scaleFixture(), scaleToColumn: true }).csv).slice(1);
  assert.equal(rows[1][5], "");      // Gnandt never submitted HW1
  assert.equal(rows[1][6], "");      // Gnandt excused from Lab 1a
});

test("a column Newton has never seen the points of is NOT scaled by a guess", () => {
  // A column being created this very upload has no known points total — assuming Blackboard's
  // current default would multiply every grade by ten the day that default changes.
  const r = buildBlackboardCsv({ ...scaleFixture(), createMissing: true, scaleToColumn: true });
  const header = parseCsv(r.csv)[0];
  const col = header.indexOf("Quiz 2: Electric Charge");
  assert.equal(parseCsv(r.csv)[1][col], "9");   // raw, not 90
  assert.deepEqual(r.scaled.map(x => x.assignment.id), ["q1"]);
});

test("a zero-point column is not treated as a scale (it would divide grades away)", () => {
  const f = fixture();
  f.link = { ...f.link, columns: f.link.columns.map(c => c.bbId === "1281892" ? { ...c, points: 0 } : c) };
  const r = buildBlackboardCsv({ ...f, scaleToColumn: true });
  assert.deepEqual(r.scaled, []);
  assert.equal(parseCsv(r.csv)[1][4], "10");
});

test("scaling self-corrects once the column is fixed in Blackboard", () => {
  // Instructor sets the column back to /10; the next import reports 10, and scaling stops.
  const r = buildBlackboardCsv({ ...fixture(), scaleToColumn: true });
  assert.deepEqual(r.scaled, []);
  assert.equal(parseCsv(r.csv)[1][4], "10");
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
