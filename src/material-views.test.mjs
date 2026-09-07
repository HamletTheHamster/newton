// Course-material open tracking. Plain node, no framework:  node src/material-views.test.mjs
//
// Worth testing because every failure here is silently plausible, and the output is a claim
// about a named student. A placeholder item counted as material reports the whole class as
// having ignored a file that was never posted; a `viewRecordOf` that mishandles a stored shape
// tells the instructor a student never opened the reading they did open; and a
// `materialOpensByStudent` that skips students with no records at all would quietly drop exactly
// the students the correlation exists to find, leaving a chart built only from the diligent.
import assert from "node:assert";
import {
  MATERIAL_TRACKING_SINCE, isMaterialItem, materialTarget, materialsOf, viewRecordOf,
  openersOf, materialStats, materialOpensByStudent, materialModules,
} from "./material-views.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

const MODULES = [
  {
    id: "m1", title: "Lecture 1",
    items: [
      { _key: "it_a", id: "it_a", type: "quiz", refId: "q1" },                                  // not material
      { _key: "it_b", id: "it_b", type: "file", title: "Reading Ch. 1", downloadUrl: "u/1" },
      { _key: "it_c", id: "it_c", type: "file", title: "Lecture 1 Notes", downloadUrl: null },  // placeholder
      { _key: "it_d", id: "it_d", type: "link", title: "Demo video", url: "https://x" },
    ],
  },
  {
    id: "m2", title: "Lecture 2",
    items: [
      { _key: "it_e", id: "it_e", type: "page", title: "Lab safety", pageId: "p1" },
      { _key: "it_f", id: "it_f", type: "file", title: "Hidden handout", downloadUrl: "u/2", _hidden: true },
      { _key: "it_g", id: "it_g", type: "homework", refId: "hw2" },                             // not material
    ],
  },
];

test("only openable material counts", () => {
  assert.strictEqual(isMaterialItem({ type: "file", downloadUrl: "u" }), true);
  assert.strictEqual(isMaterialItem({ type: "page", pageId: "p" }), true);
  assert.strictEqual(isMaterialItem({ type: "reading", url: "https://x" }), true);
  // A seeded placeholder has nothing behind it, renders with no click target, and must never
  // sit in the denominator.
  assert.strictEqual(isMaterialItem({ type: "file", uploadId: null, downloadUrl: null }), false);
  assert.strictEqual(isMaterialItem({ type: "notes" }), false);
  // Work, not material — tracked far more richly by submissions and telemetry.
  assert.strictEqual(isMaterialItem({ type: "quiz", refId: "q1" }), false);
  assert.strictEqual(isMaterialItem({ type: "homework", refId: "hw1" }), false);
  assert.strictEqual(isMaterialItem(null), false);
  assert.strictEqual(materialTarget({ type: "file", downloadUrl: "u" }), "u");
  assert.strictEqual(materialTarget({ type: "page", pageId: "p1" }), "p1");
  assert.strictEqual(materialTarget(null), null);
});

test("materialsOf flattens in order and drops placeholders, work and hidden items", () => {
  assert.deepStrictEqual(materialsOf(MODULES).map(m => m.id), ["it_b", "it_d", "it_e"]);
  assert.deepStrictEqual(materialsOf(MODULES)[0], {
    id: "it_b", type: "file", title: "Reading Ch. 1", moduleId: "m1", moduleTitle: "Lecture 1",
  });
  // The instructor may want to see what a since-hidden item collected.
  assert.deepStrictEqual(materialsOf(MODULES, { includeHidden: true }).map(m => m.id),
    ["it_b", "it_d", "it_e", "it_f"]);
  assert.deepStrictEqual(materialsOf(null), []);
});

test("viewRecordOf normalizes every stored shape", () => {
  assert.strictEqual(viewRecordOf(undefined), undefined);
  assert.strictEqual(viewRecordOf(null), undefined);
  assert.strictEqual(viewRecordOf(false), undefined);
  assert.deepStrictEqual(viewRecordOf(true), { first: null, last: null, count: 1 });
  assert.deepStrictEqual(viewRecordOf("2026-09-08T10:00:00.000Z"),
    { first: "2026-09-08T10:00:00.000Z", last: "2026-09-08T10:00:00.000Z", count: 1 });
  assert.deepStrictEqual(viewRecordOf({ first: "A", last: "B", count: 4 }), { first: "A", last: "B", count: 4 });
  // A record written by an older client, or half-written, is still an OPEN. Reporting it as
  // "never opened" because `count` is missing would be the worst possible failure.
  assert.deepStrictEqual(viewRecordOf({ first: "A" }), { first: "A", last: "A", count: 1 });
  assert.deepStrictEqual(viewRecordOf({}), { first: null, last: null, count: 1 });
});

test("openersOf splits the roster and sorts by most recent open", () => {
  const roster = [{ studentId: "s1" }, { studentId: "s2" }, { studentId: "s3" }, { studentId: "s4" }];
  const views = {
    s1: { it_b: { first: "2026-09-08T09:00:00.000Z", last: "2026-09-08T09:00:00.000Z", count: 1 } },
    s2: { it_b: { first: "2026-09-08T08:00:00.000Z", last: "2026-09-09T08:00:00.000Z", count: 3 } },
    s3: { it_b: true },                       // opened, time unknown
    s4: { it_d: { first: "X", last: "X", count: 1 } },  // opened a DIFFERENT material
  };
  const { opened, notOpened, total, pct } = openersOf("it_b", roster, views);
  assert.deepStrictEqual(opened.map(o => o.student.studentId), ["s2", "s1", "s3"]);
  assert.deepStrictEqual(notOpened.map(st => st.studentId), ["s4"]);
  assert.strictEqual(total, 4);
  assert.strictEqual(pct, 75);
  assert.strictEqual(opened[0].count, 3);
  assert.strictEqual(opened[2].last, null);
  // Nothing recorded is the whole roster not opened, never an empty chart.
  const none = openersOf("it_b", roster, {});
  assert.strictEqual(none.opened.length, 0);
  assert.strictEqual(none.notOpened.length, 4);
  assert.strictEqual(none.pct, 0);
  assert.deepStrictEqual(openersOf("it_b", [], null), { opened: [], notOpened: [], total: 0, pct: null });
});

test("materialStats keeps posting order", () => {
  const roster = [{ studentId: "s1" }];
  const views = { s1: { it_e: "2026-09-08T09:00:00.000Z" } };
  const rows = materialStats({ materials: materialsOf(MODULES), roster, views });
  assert.deepStrictEqual(rows.map(r => r.material.id), ["it_b", "it_d", "it_e"]);
  assert.deepStrictEqual(rows.map(r => r.pct), [0, 0, 100]);
});

test("materialOpensByStudent counts a student with no records at all as zero", () => {
  const roster = [{ studentId: "s1" }, { studentId: "s2" }];
  const views = {
    s1: { it_b: { first: "A", last: "2026-09-09T08:00:00.000Z", count: 2 }, it_e: "2026-09-10T08:00:00.000Z" },
    // s2 has opened nothing, and is deliberately absent from the node entirely.
  };
  const opens = materialOpensByStudent({ materials: materialsOf(MODULES), roster, views });
  assert.deepStrictEqual(opens.s1.m1, { opened: 1, total: 2, pct: 50, lastAt: "2026-09-09T08:00:00.000Z" });
  assert.deepStrictEqual(opens.s1.m2, { opened: 1, total: 1, pct: 100, lastAt: "2026-09-10T08:00:00.000Z" });
  assert.deepStrictEqual(opens.s1.all,
    { opened: 2, total: 3, pct: (2 / 3) * 100, lastAt: "2026-09-10T08:00:00.000Z" });
  // The zero row is the point: a student who opened nothing must reach the correlation as a 0,
  // not be dropped as missing data, or the chart is built only from the students who clicked.
  assert.deepStrictEqual(opens.s2.all, { opened: 0, total: 3, pct: 0, lastAt: null });
  assert.deepStrictEqual(opens.s2.m1, { opened: 0, total: 2, pct: 0, lastAt: null });
});

test("materialModules totals only modules with something posted", () => {
  assert.deepStrictEqual(materialModules(materialsOf(MODULES)), [
    { id: "m1", title: "Lecture 1", total: 2 },
    { id: "m2", title: "Lecture 2", total: 1 },
  ]);
  assert.deepStrictEqual(materialModules([]), []);
});

test("the tracking baseline is a plain date, so it compares against a full ISO stamp", () => {
  assert.match(MATERIAL_TRACKING_SINCE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(`${MATERIAL_TRACKING_SINCE}T00:01:00.000Z` >= MATERIAL_TRACKING_SINCE);
});

console.log(`\n${passed} material-view tests passed.`);
