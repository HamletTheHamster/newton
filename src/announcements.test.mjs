// Announcement read receipts. Plain node, no framework:  node src/announcements.test.mjs
//
// Worth testing because every failure here is silently plausible. A `readAtOf` that mishandles
// the legacy `true` reports a student who HAS read an announcement as never having opened it,
// and the instructor may act on that; an `isTracked` off by one string comparison either pops a
// term of old notices at every student at once or hides a new one from all of them.
import assert from "node:assert";
import { READ_TRACKING_SINCE, isTracked, readAtOf, unseenAnnouncements, readReceiptsFor } from "./announcements.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test("readAtOf normalizes every stored shape", () => {
  assert.strictEqual(readAtOf(undefined), undefined);
  assert.strictEqual(readAtOf(null), undefined);
  assert.strictEqual(readAtOf(false), undefined);
  assert.strictEqual(readAtOf(true), null, "legacy pre-6.9 flag = viewed, time unknown");
  assert.strictEqual(readAtOf("2026-09-06T14:00:00.000Z"), "2026-09-06T14:00:00.000Z");
});

test("isTracked keys off the baseline, and a full ISO stamp compares correctly", () => {
  // A bare-date baseline vs. a full timestamp: string comparison has to put
  // "2026-09-06T00:01:00Z" on or after "2026-09-06", and the day before, before it.
  assert.strictEqual(isTracked({ createdAt: `${READ_TRACKING_SINCE}T00:01:00.000Z` }), true);
  assert.strictEqual(isTracked({ createdAt: "2026-09-05T23:59:00.000Z" }), false);
  assert.strictEqual(isTracked({ createdAt: "2027-01-02T10:00:00.000Z" }), true);
  assert.strictEqual(isTracked({}), false);
  assert.strictEqual(isTracked(null), false);
});

test("unseenAnnouncements skips read and untracked ones", () => {
  const anns = [
    { id: "a3", createdAt: "2027-01-03T10:00:00.000Z" },   // unseen, tracked
    { id: "a2", createdAt: "2027-01-02T10:00:00.000Z" },   // seen
    { id: "a1", createdAt: "2026-01-01T10:00:00.000Z" },   // predates tracking
  ];
  const unseen = unseenAnnouncements(anns, { a2: "2027-01-02T11:00:00.000Z" });
  assert.deepStrictEqual(unseen.map(a => a.id), ["a3"]);
  // A legacy `true` still counts as seen, or the popup would re-offer it forever.
  assert.deepStrictEqual(unseenAnnouncements(anns, { a2: true, a3: true }).map(a => a.id), []);
  // A student with NO receipts has seen nothing, so every tracked announcement is unseen.
  // "receipts not loaded yet" is a different state and is the caller's to guard (App.jsx shows
  // the popup only once the loaded receipts match the current class and student).
  assert.deepStrictEqual(unseenAnnouncements(anns, {}).map(a => a.id), ["a3", "a2"]);
  assert.deepStrictEqual(unseenAnnouncements(anns, null).map(a => a.id), ["a3", "a2"]);
  assert.deepStrictEqual(unseenAnnouncements(null, {}), []);
});

test("readReceiptsFor splits the roster and sorts viewers newest first", () => {
  const roster = [{ studentId: "s1" }, { studentId: "s2" }, { studentId: "s3" }, { studentId: "s4" }];
  const reads = {
    s1: { ann1: "2027-01-03T09:00:00.000Z" },
    s2: { ann1: "2027-01-04T09:00:00.000Z" },
    s3: { ann1: true },                 // legacy: viewed, no timestamp
    s4: { annOther: "2027-01-04T09:00:00.000Z" },   // read a DIFFERENT announcement
  };
  const { viewed, notViewed, total } = readReceiptsFor("ann1", roster, reads);
  assert.deepStrictEqual(viewed.map(v => v.student.studentId), ["s2", "s1", "s3"]);
  assert.deepStrictEqual(notViewed.map(st => st.studentId), ["s4"]);
  assert.strictEqual(total, 4);
  assert.strictEqual(viewed[2].at, null);
});

test("readReceiptsFor with nothing recorded reports the whole roster as not viewed", () => {
  const roster = [{ studentId: "s1" }, { studentId: "s2" }];
  const { viewed, notViewed, total } = readReceiptsFor("ann1", roster, {});
  assert.strictEqual(viewed.length, 0);
  assert.strictEqual(notViewed.length, 2);
  assert.strictEqual(total, 2);
  assert.deepStrictEqual(readReceiptsFor("ann1", [], null), { viewed: [], notViewed: [], total: 0 });
});

console.log(`\n${passed} announcement read-receipt tests passed.`);
