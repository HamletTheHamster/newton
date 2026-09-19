// Run with: node src/quiz-parts.test.mjs
//
// A quiz's parts are posed one at a time from what `splitParts` cuts, and the grader is handed
// only the current part's text. A wrong cut is silently plausible: the student is asked a
// fragment, or a sentence that belongs to (b) is graded as part of (a), and every quiz question
// with labels in both courses goes through it. So every committed labelled question is split
// here and its cut checked, alongside the shapes the cutter has to get right.
import assert from "node:assert/strict";
import { splitParts, detectParts } from "./utils.js";
import { QUIZZES_PHYSICS1 } from "./courses/physics1.js";
import { QUIZZES_PHYSICS2 } from "./courses/physics2.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

console.log("\nquiz-parts: the cutter");

test("no labels, or one label, is not a multi-part question", () => {
  assert.equal(splitParts("Can a charged particle move through a magnetic field without force?"), null);
  assert.equal(splitParts("(a) only one part here"), null);
  assert.equal(detectParts("(a) only one part here"), null);
});

test("stem before (a), parts on their own lines", () => {
  const r = splitParts("Stem sentence.\n\n(a) First question?\n\n(b) Second question.");
  assert.deepEqual(r, { stem: "Stem sentence.", parts: [{ label: "a", text: "First question?" }, { label: "b", text: "Second question." }] });
});

test("no stem when the question opens on (a)", () => {
  const r = splitParts("(a) First?\n\n(b) Second?");
  assert.equal(r.stem, "");
  assert.equal(r.parts.length, 2);
});

test("a later mention of an earlier label stays inside the part that says it", () => {
  const r = splitParts("Stem.\n\n(a) Where?\n\n(b) How would your answer to (a) change?\n\n(c) Explain.");
  assert.deepEqual(r.parts.map(p => p.label), ["a", "b", "c"]);
  assert.equal(r.parts[1].text, "How would your answer to (a) change?");
  assert.equal(r.parts[2].text, "Explain.");
});

test("parts written inline in a list lose their trailing ', and'", () => {
  const r = splitParts("Describe three scenarios: (a) positive work, (b) negative work, and (c) zero work.");
  assert.equal(r.stem, "Describe three scenarios:");
  assert.deepEqual(r.parts.map(p => p.text), ["positive work", "negative work", "zero work."]);
});

test("the stem keeps its own trailing punctuation", () => {
  assert.equal(splitParts("Consider a wire.\n\n(a) x\n\n(b) y").stem, "Consider a wire.");
});

console.log("\nquiz-parts: every committed labelled question");

const all = [...QUIZZES_PHYSICS1, ...QUIZZES_PHYSICS2].flatMap(q => q.questions.map(x => ({ quiz: q.id, ...x })));
const widget = q => !!(q.yesNo || q.dragDrop || q.choices || q.survey);
for (const q of all) {
  if (widget(q)) continue;
  const labels = detectParts(q.text);
  if (!labels) continue;
  test(`${q.quiz} ${q.id} splits into ${labels.join("/")} with nothing lost`, () => {
    const r = splitParts(q.text);
    assert.ok(r, "splitParts returned null for a labelled question");
    assert.deepEqual(r.parts.map(p => p.label), labels);
    // Consecutive letters from a: a gap means a label was missed or a stray "(x)" was read as one.
    r.parts.forEach((p, i) => assert.equal(p.label, String.fromCharCode(97 + i)));
    for (const p of r.parts) {
      assert.ok(p.text.length > 10, `part (${p.label}) is a fragment: "${p.text}"`);
      assert.ok(!/^\(?[a-z]\)/.test(p.text), `part (${p.label}) starts with a label`);
    }
    // Every word of the source is in the stem or a part (only labels and joining punctuation go).
    const words = t => t.replace(/\([a-z]\)/g, " ").split(/[\s,;:]+/).filter(w => w && w !== "and");
    const kept = new Set([r.stem, ...r.parts.map(p => p.text)].flatMap(words));
    for (const w of words(q.text)) assert.ok(kept.has(w), `word "${w}" was dropped by the cut`);
  });
}

console.log(`\n${passed} passed\n`);
