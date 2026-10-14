// Tests for the in-progress quiz draft. Run with: node src/quiz-draft.test.mjs
//
// This file exists because every failure it guards is SILENT and lands on a student in the
// middle of a graded sitting. RTDB has no arrays, so a transcript comes back as an object with
// numeric string keys the moment the list is not dense from zero — read in string order, "10"
// precedes "2" and the student is handed their own quiz with the turns shuffled and their
// answers sitting under the wrong questions, which looks like a quiz, grades like a quiz, and
// is wrong. A patch that emits a null prunes a turn another session wrote. A `qScores` that
// comes back short silently drops the tail of the quiz out of the final total. And a draft
// that fails the restorable test discards the sitting it was written to protect — with no
// error anywhere, because losing a quiz is exactly what used to happen.

import assert from "node:assert/strict";
import {
  buildQuizDraftPatch, buildQuizInputPatch, readQuizDraft, restorableQuizDraft,
  quizDraftHasWork, sanitizeMessages, applyQuizDraftPatch,
  QUIZ_DRAFT_LISTS, QUIZ_DRAFT_SCALARS,
} from "./quiz-draft.js";

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
};

const qMsg = n => ({ id: n, type: "question", num: n, q: { text: `Question ${n}` } });
const userMsg = (n, text) => ({ id: n, type: "user", text });
const sitting = (over = {}) => ({
  messages: [qMsg(1), userMsg(2, "because the field is uniform")],
  apiHist: [{ role: "user", content: "..." }, { role: "assistant", content: "{}" }],
  qScores: [2, null, null],
  completedParts: [{ label: "a", credit: 2 }],
  qIdx: 0, attemptCount: 1, input: "half a sentence", awaitingJustification: false,
  ...over,
});

// ── What counts as work worth saving ──────────────────────────────────────────

test("a freshly opened quiz is not work", () => {
  // One message, and it is the question the runner posed. The student has done nothing, and a
  // node here would be noise that restores as a blank screen.
  assert.equal(quizDraftHasWork({ messages: [qMsg(1)], qScores: [null, null], completedParts: [], attemptCount: 0, input: "" }), false);
});

test("typing alone is work", () => {
  // The case the whole feature was asked for: text in the box, nothing submitted yet.
  assert.equal(quizDraftHasWork({ messages: [qMsg(1)], qScores: [null], completedParts: [], attemptCount: 0, input: "the flux is zero" }), true);
});

test("whitespace in the box is not work", () => {
  assert.equal(quizDraftHasWork({ messages: [qMsg(1)], qScores: [null], completedParts: [], attemptCount: 0, input: "   \n " }), false);
});

test("a scored question is work even with an empty box", () => {
  assert.equal(quizDraftHasWork({ messages: [qMsg(1)], qScores: [2, null], completedParts: [], attemptCount: 0, input: "" }), true);
});

test("a spent attempt is work even if nothing scored", () => {
  // A wrong answer scores nothing but costs an attempt, and losing that is losing progress.
  assert.equal(quizDraftHasWork({ messages: [qMsg(1)], qScores: [null], completedParts: [], attemptCount: 2, input: "" }), true);
});

// ── The patch is additive, and never prunes ───────────────────────────────────

test("the patch emits deep-path keys, one per list entry", () => {
  const patch = buildQuizDraftPatch(sitting(), "T");
  assert.equal(patch["messages/0"].type, "question");
  assert.equal(patch["messages/1"].text, "because the field is uniform");
  assert.equal(patch["qScores/0"], 2);
  assert.equal(patch["completedParts/0"].label, "a");
  assert.equal(patch.savedAt, "T");
});

test("the patch NEVER emits a null — an unanswered question is skipped, not deleted", () => {
  // qScores is `new Array(n).fill(null)`, so a faithful write would send a null per unanswered
  // question. In a PATCH a null is a delete: that is a stale session pruning another's work.
  const patch = buildQuizDraftPatch(sitting(), "T");
  assert.equal(Object.values(patch).some(v => v === null), false);
  assert.equal("qScores/1" in patch, false);
  assert.equal("qScores/2" in patch, false);
});

test("every declared list and scalar actually reaches the patch", () => {
  // Guards the next field someone adds to the sitting and forgets to save.
  const patch = buildQuizDraftPatch(sitting({ awaitingJustification: true }), "T");
  for (const list of QUIZ_DRAFT_LISTS) assert.ok(`${list}/0` in patch, `${list} missing from patch`);
  for (const key of QUIZ_DRAFT_SCALARS) assert.ok(key in patch, `${key} missing from patch`);
});

test("a second session cannot destroy the first session's turns", () => {
  // The 2026-09-06 failure, in quiz shape: two tabs, no realtime listener. A PATCH merges.
  const stored = applyQuizDraftPatch({}, buildQuizDraftPatch(sitting(), "T1"));
  const laptop = sitting({ messages: [qMsg(1), userMsg(2, "a"), userMsg(3, "b"), userMsg(4, "c")] });
  const after = applyQuizDraftPatch(stored, buildQuizDraftPatch(laptop, "T2"));
  assert.equal(Object.keys(after.messages).length, 4);
  assert.equal(after.messages[3].text, "c");
  assert.equal(after.apiHist[1].role, "assistant"); // untouched sibling survives
});

test("the typing patch carries the box and nothing else", () => {
  const patch = buildQuizInputPatch("mid sent", "T");
  assert.deepEqual(Object.keys(patch).sort(), ["input", "savedAt"]);
  // It must be able to clear the box: emptying what you wrote is itself progress to remember.
  assert.equal(buildQuizInputPatch("", "T").input, "");
});

test("the typing patch leaves the stored transcript alone", () => {
  const stored = applyQuizDraftPatch({}, buildQuizDraftPatch(sitting(), "T1"));
  const after = applyQuizDraftPatch(stored, buildQuizInputPatch("more words", "T2"));
  assert.equal(after.input, "more words");
  assert.equal(Object.keys(after.messages).length, 2);
});

// ── Images are stripped ───────────────────────────────────────────────────────

test("a drawing's data URL never enters the draft", () => {
  // It is the whole compressed image inline, re-sent on every turn; the submission strips the
  // same field for the same reason.
  const msgs = [{ id: 1, type: "user", text: "see drawing", imageUrl: "data:image/jpeg;base64,AAAA" }];
  assert.equal("imageUrl" in sanitizeMessages(msgs)[0], false);
  assert.equal(sanitizeMessages(msgs)[0].text, "see drawing");
  const patch = buildQuizDraftPatch(sitting({ messages: msgs }), "T");
  assert.equal("imageUrl" in patch["messages/0"], false);
});

// ── Reading back the shapes RTDB actually returns ─────────────────────────────

test("a dense list comes back as an array", () => {
  const d = readQuizDraft({ messages: [qMsg(1), userMsg(2, "x")], qIdx: 1 }, 3);
  assert.equal(d.messages.length, 2);
  assert.equal(d.qIdx, 1);
});

test("a sparse list comes back as a numeric-keyed OBJECT and must reorder numerically", () => {
  // The bug this test exists for: Object.keys order is not the answer for a node that has
  // been written across sittings, and string order puts turn 10 before turn 2.
  const stored = { messages: { 0: qMsg(1), 1: userMsg(2, "a"), 2: userMsg(3, "b"), 10: userMsg(11, "last"), 9: userMsg(10, "ninth") } };
  const d = readQuizDraft(stored, 1);
  assert.equal(d.messages.length, 5);
  assert.equal(d.messages[d.messages.length - 1].text, "last");
  assert.equal(d.messages[d.messages.length - 2].text, "ninth");
});

test("qScores is padded back to one slot per question", () => {
  // Only question 3 was scored, so that is the only key stored. Read back short, the runner's
  // final reduce would total a quiz with its tail missing.
  const d = readQuizDraft({ qScores: { 2: 4 } }, 5);
  assert.equal(d.qScores.length, 5);
  assert.deepEqual(d.qScores, [null, null, 4, null, null]);
});

test("qScores never shrinks below what was stored", () => {
  // A quiz edited to have fewer questions must not silently drop a score already earned.
  const d = readQuizDraft({ qScores: { 4: 2 } }, 2);
  assert.equal(d.qScores.length, 5);
  assert.equal(d.qScores[4], 2);
});

test("a hole in the transcript is compacted, not padded with undefined", () => {
  // ChatMessages maps over this list; an undefined in the middle throws and takes the screen
  // down, which is a worse answer to a half-written save than one missing turn.
  const d = readQuizDraft({ messages: { 0: qMsg(1), 2: userMsg(3, "b") } }, 1);
  assert.equal(d.messages.length, 2);
  assert.ok(d.messages.every(m => m && typeof m === "object"));
});

test("missing cursors read as a fresh sitting, not as NaN or undefined", () => {
  const d = readQuizDraft({ messages: [qMsg(1)] }, 2);
  assert.equal(d.qIdx, 0);
  assert.equal(d.attemptCount, 0);
  assert.equal(d.input, "");
  assert.equal(d.awaitingJustification, false);
});

test("readQuizDraft returns null for an absent node", () => {
  assert.equal(readQuizDraft(null, 3), null);
  assert.equal(readQuizDraft("nonsense", 3), null);
});

// ── Round trip: what the student actually gets back ───────────────────────────

test("a sitting survives save → store → read unchanged", () => {
  const before = sitting();
  const stored = applyQuizDraftPatch({}, buildQuizDraftPatch(before, "T"));
  const after = readQuizDraft(stored, 3);
  assert.deepEqual(after.messages, before.messages);
  assert.deepEqual(after.apiHist, before.apiHist);
  assert.deepEqual(after.qScores, before.qScores);
  assert.deepEqual(after.completedParts, before.completedParts);
  assert.equal(after.qIdx, before.qIdx);
  assert.equal(after.attemptCount, before.attemptCount);
  assert.equal(after.input, before.input);
});

test("the attempt count survives, so a reload cannot reset it", () => {
  // Restoring is unconditional in startQuiz precisely so that reloading is not a way to shed
  // a spent attempt. If this ever stops round-tripping, that guarantee is gone.
  const stored = applyQuizDraftPatch({}, buildQuizDraftPatch(sitting({ attemptCount: 4 }), "T"));
  assert.equal(readQuizDraft(stored, 3).attemptCount, 4);
});

// ── What is worth restoring ───────────────────────────────────────────────────

test("a sitting with a typed box but no submitted turn IS restorable", () => {
  // The exact case the feature was asked for. It is also why the typing autosave sends the
  // whole sitting until the transcript is down: an input-only node has no messages and would
  // fail here, losing the very text the save was for.
  const stored = applyQuizDraftPatch({}, buildQuizDraftPatch({
    messages: [qMsg(1)], apiHist: [], qScores: [null, null], completedParts: [],
    qIdx: 0, attemptCount: 0, input: "the flux through the closed surface is zero",
  }, "T"));
  const d = restorableQuizDraft(stored, 2);
  assert.ok(d);
  assert.equal(d.input, "the flux through the closed surface is zero");
});

test("a node holding only an emptied box is NOT restorable", () => {
  // Restoring it would replace a freshly posed question 1 with an empty transcript.
  assert.equal(restorableQuizDraft({ input: "", savedAt: "T" }, 2), null);
  assert.equal(restorableQuizDraft({ input: "typed then deleted" }, 2), null);
});

test("a node with a transcript but no student work is NOT restorable", () => {
  assert.equal(restorableQuizDraft({ messages: [qMsg(1)], qScores: {}, input: "" }, 2), null);
});

test("an absent node is not restorable", () => {
  assert.equal(restorableQuizDraft(null, 2), null);
});

console.log(`✓ ${passed} quiz-draft tests passed`);
