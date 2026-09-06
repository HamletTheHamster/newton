// Tests for the storage shapes of student work. Run with: node src/student-work.test.mjs
//
// This file exists because every failure it guards is SILENT. A submission that stops being
// read looks exactly like a student who never handed anything in; a draft patch that writes
// the wrong key shape saves something that restores as an empty assignment. Nobody finds out
// until an instructor opens a gradebook cell and there is nothing behind it — which is what
// happened on 2026-09-06, an hour and a half after the homework was submitted, and was only
// noticed because the instructor had already read that submission earlier the same afternoon.

import assert from "node:assert/strict";
import {
  flattenSubs, subsByStudentMap, submissionMergePatch,
  keyForSubmission, buildDraftPatch, applyDraftPatch, DRAFT_ITEM_MAPS,
} from "./student-work.js";

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
};

const sub = (studentId, id, quizId) => ({ studentId, id, quizId, score: 10 });

// ── Reading both node shapes ──────────────────────────────────────────────────

test("flattenSubs reads the canonical per-id map", () => {
  const node = { "0428673": { sub_1: sub("0428673", "sub_1", "q1"), sub_2: sub("0428673", "sub_2", "hw1") } };
  assert.equal(flattenSubs(node).length, 2);
  assert.deepEqual(flattenSubs(node).map(s => s.quizId).sort(), ["hw1", "q1"]);
});

test("flattenSubs still reads the legacy per-student array", () => {
  const node = { "0428673": [sub("0428673", "sub_1", "q1"), sub("0428673", "sub_2", "hw1")] };
  assert.equal(flattenSubs(node).length, 2);
});

// A class mid-migration holds both at once: whoever has submitted since the fix is a map,
// everyone else is still an array. Reading one shape only would blank half the gradebook.
test("flattenSubs reads a node holding both shapes at once", () => {
  const node = {
    "0428673": { sub_2: sub("0428673", "sub_2", "hw1") },
    "0368905": [sub("0368905", "sub_9", "q1")],
  };
  assert.equal(flattenSubs(node).length, 2);
});

// RTDB has no arrays: a per-key write onto a legacy array makes it read back as an object with
// the integer keys preserved. Both the old entries and the new one must survive that.
test("flattenSubs reads an array that RTDB coerced to an integer-keyed object", () => {
  const node = { "0428673": { 0: sub("0428673", "sub_1", "q1"), 1: sub("0428673", "sub_2", "q2"), sub_3: sub("0428673", "sub_3", "hw1") } };
  assert.deepEqual(flattenSubs(node).map(s => s.quizId).sort(), ["hw1", "q1", "q2"]);
});

test("flattenSubs skips holes, nulls and junk rather than inventing submissions", () => {
  const node = { "0428673": [null, sub("0428673", "sub_1", "q1"), undefined], "0000": null, "0001": "nope", "0002": {} };
  assert.equal(flattenSubs(node).length, 1);
  assert.deepEqual(flattenSubs(null), []);
  assert.deepEqual(flattenSubs("nope"), []);
});

// ── Round trip ────────────────────────────────────────────────────────────────

test("subsByStudentMap round-trips through flattenSubs without loss", () => {
  const subs = [sub("a", "sub_1", "q1"), sub("a", "sub_2", "hw1"), sub("b", "sub_3", "q1")];
  const back = flattenSubs(subsByStudentMap(subs));
  assert.equal(back.length, 3);
  assert.deepEqual(back.map(s => s.id).sort(), ["sub_1", "sub_2", "sub_3"]);
});

test("subsByStudentMap keys by submission id, so two submissions never collapse into one", () => {
  const map = subsByStudentMap([sub("a", "sub_1", "q1"), sub("a", "sub_2", "hw1")]);
  assert.deepEqual(Object.keys(map.a).sort(), ["sub_1", "sub_2"]);
});

test("subsByStudentMap keeps an id-less submission instead of dropping or colliding it", () => {
  const map = subsByStudentMap([{ studentId: "a", quizId: "q1" }, { studentId: "a", quizId: "q2" }]);
  assert.equal(Object.keys(map.a).length, 2);
});

test("subsByStudentMap ignores entries with no student to file them under", () => {
  assert.deepEqual(subsByStudentMap([{ id: "sub_1" }, null, "nope"]), {});
});

// ── The import merge ──────────────────────────────────────────────────────────

// A backup is always older than live data. Restoring one must add and update, never remove —
// otherwise importing a February backup in September deletes the entire term's work.
test("submissionMergePatch addresses each submission by its own deep path", () => {
  const patch = submissionMergePatch([sub("a", "sub_1", "q1"), sub("b", "sub_2", "hw1")]);
  assert.deepEqual(Object.keys(patch).sort(), ["a/sub_1", "b/sub_2"]);
});

test("submissionMergePatch never emits a key that would replace a whole student", () => {
  const patch = submissionMergePatch([sub("a", "sub_1", "q1")]);
  for (const key of Object.keys(patch)) assert.ok(key.includes("/"), `"${key}" would overwrite a whole student's node`);
});

test("submissionMergePatch drops entries it cannot address rather than guessing a key", () => {
  assert.deepEqual(submissionMergePatch([{ studentId: "a" }, { id: "sub_1" }, null]), {});
});

// ── Addressing an existing submission ─────────────────────────────────────────
//
// Caught against the live database: under the legacy shape the KEY is a position, not the id,
// so `submissions/{sid}/{sub.id}` addresses nothing. A delete silently missed (the record came
// back on the next load) and a merge wrote a second copy beside the original.

test("keyForSubmission returns the id under the canonical shape", () => {
  const node = { sub_1: sub("a", "sub_1", "q1"), sub_2: sub("a", "sub_2", "hw1") };
  assert.equal(keyForSubmission(node, "sub_2"), "sub_2");
});

test("keyForSubmission returns the POSITION under the legacy array shape", () => {
  const node = [sub("a", "sub_1", "q1"), sub("a", "sub_2", "hw1")];
  assert.equal(keyForSubmission(node, "sub_2"), "1");
});

test("keyForSubmission handles an array RTDB coerced to an integer-keyed object", () => {
  const node = { 0: sub("a", "sub_1", "q1"), 1: sub("a", "sub_2", "hw1"), sub_3: sub("a", "sub_3", "q2") };
  assert.equal(keyForSubmission(node, "sub_2"), "1");
  assert.equal(keyForSubmission(node, "sub_3"), "sub_3");
});

test("keyForSubmission falls back to the id for one that isn't stored yet", () => {
  assert.equal(keyForSubmission({ sub_1: sub("a", "sub_1", "q1") }, "sub_new"), "sub_new");
  assert.equal(keyForSubmission(null, "sub_new"), "sub_new");
});

test("submissionMergePatch targets the existing key, so an import updates instead of duplicating", () => {
  const live = { a: [sub("a", "sub_1", "q1")] };
  const patch = submissionMergePatch([{ ...sub("a", "sub_1", "q1"), score: 8 }], live);
  assert.deepEqual(Object.keys(patch), ["a/0"]);
  assert.equal(patch["a/0"].score, 8);
});

test("submissionMergePatch uses the id when the student has no node yet", () => {
  assert.deepEqual(Object.keys(submissionMergePatch([sub("b", "sub_9", "q1")], { a: [] })), ["b/sub_9"]);
});

// ── Homework draft patches ────────────────────────────────────────────────────

const draftState = () => ({
  answers: { p1: "3.7", p2_a: "$x^2$" },
  attempts: { p1: 2 },
  status: { p1: "correct" },
  earned: { p1: 1 },
  feedback: { p1: { text: "Nice", kind: "correct" } },
  revealed: {}, gradePass: {}, hintUsed: {}, history: { p1: ["3.6"] },
  idx: 1,
});

test("buildDraftPatch addresses every item map at the leaf", () => {
  const patch = buildDraftPatch(draftState(), "T");
  assert.equal(patch["answers/p1"], "3.7");
  assert.equal(patch["answers/p2_a"], "$x^2$");
  assert.equal(patch["attempts/p1"], 2);
  assert.equal(patch["status/p1"], "correct");
  assert.deepEqual(patch["history/p1"], ["3.6"]);
  assert.equal(patch.idx, 1);
  assert.equal(patch.savedAt, "T");
});

test("buildDraftPatch never writes a whole item map, which would replace its siblings", () => {
  const patch = buildDraftPatch(draftState(), "T");
  for (const field of DRAFT_ITEM_MAPS) {
    assert.ok(!(field in patch), `"${field}" is written whole, so another session's items would be erased`);
  }
});

test("buildDraftPatch emits no nulls, so a stale session cannot delete what it never saw", () => {
  const patch = buildDraftPatch(draftState(), "T");
  for (const [k, v] of Object.entries(patch)) assert.notEqual(v, null, `${k} is null`);
});

// The failure this whole change is about, in miniature: a second sitting that loaded before
// the first finished must not be able to undo it.
test("a stale session's patch cannot erase items resolved by another session", () => {
  const stored = applyDraftPatch({}, buildDraftPatch({
    answers: { p1: "3.7", p2: "9.8", p3: "12" },
    status: { p1: "correct", p2: "correct", p3: "correct" },
    attempts: { p1: 1, p2: 1, p3: 2 }, idx: 2,
  }, "T1"));

  // A tab opened before any of that, holding only p1, saves after them.
  const after = applyDraftPatch(stored, buildDraftPatch({
    answers: { p1: "3.7" }, status: { p1: "correct" }, attempts: { p1: 1 }, idx: 0,
  }, "T2"));

  assert.deepEqual(Object.keys(after.status).sort(), ["p1", "p2", "p3"]);
  assert.equal(after.answers.p2, "9.8");
  assert.equal(after.attempts.p3, 2);
});

test("a newer answer for the same item does replace the older one", () => {
  const stored = applyDraftPatch({}, buildDraftPatch({ answers: { p1: "3.6" }, idx: 0 }, "T1"));
  const after = applyDraftPatch(stored, buildDraftPatch({ answers: { p1: "3.7" }, idx: 0 }, "T2"));
  assert.equal(after.answers.p1, "3.7");
});

test("buildDraftPatch survives a missing or malformed state without throwing", () => {
  assert.deepEqual(buildDraftPatch(null, "T"), { idx: 0, savedAt: "T" });
  assert.deepEqual(buildDraftPatch({ answers: "nope", idx: 3 }, "T"), { idx: 3, savedAt: "T" });
});

if (!process.exitCode) console.log(`✓ ${passed} student-work tests passed`);
