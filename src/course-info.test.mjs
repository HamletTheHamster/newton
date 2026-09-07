// Run with: node src/course-info.test.mjs
//
// Two things here are silently plausible when wrong, which is why they are tested at all.
// A mis-partition makes a whole module disappear from BOTH the student's Home and the Resources
// page with no error anywhere, and a shelf wrongly dropped from `mergedModules` would keep being
// clicked by students every week while vanishing from the instructor's open rates. And the guide
// is written by Claude, so its stored shape is never something the renderer may assume.
import assert from "node:assert/strict";
import {
  RESOURCE_KIND, isResourceModule, partitionModules,
  visibleShelves,
  normalizeGuide, guideHasContent,
} from "./course-info.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

console.log("\ncourse-info: resource shelves");

test("absent kind is coursework, so every module authored before shelves existed stays put", () => {
  assert.equal(isResourceModule({ id: "m1", title: "Lecture 1" }), false);
  assert.equal(isResourceModule({ id: "m1", kind: null }), false);
  assert.equal(isResourceModule({ id: "m1", kind: "" }), false);
});

test("only the exact flag marks a shelf", () => {
  assert.equal(isResourceModule({ kind: RESOURCE_KIND }), true);
  assert.equal(isResourceModule({ kind: "resource" }), false);
  assert.equal(isResourceModule({ kind: "Resources" }), false);
});

test("a nullish module never throws", () => {
  assert.equal(isResourceModule(null), false);
  assert.equal(isResourceModule(undefined), false);
});

test("partition keeps the instructor's order within each side", () => {
  const mods = [
    { id: "r1", kind: RESOURCE_KIND },
    { id: "c1" },
    { id: "c2" },
    { id: "r2", kind: RESOURCE_KIND },
    { id: "c3" },
  ];
  const { course, resources } = partitionModules(mods);
  assert.deepEqual(course.map(m => m.id), ["c1", "c2", "c3"]);
  assert.deepEqual(resources.map(m => m.id), ["r1", "r2"]);
});

test("every module lands on exactly one side, so none can go missing", () => {
  const mods = [{ id: "a" }, { id: "b", kind: RESOURCE_KIND }, { id: "c" }];
  const { course, resources } = partitionModules(mods);
  assert.equal(course.length + resources.length, mods.length);
});

test("a non-array is empty on both sides rather than a throw", () => {
  for (const bad of [null, undefined, {}, "modules"]) {
    assert.deepEqual(partitionModules(bad), { course: [], resources: [] });
  }
});

console.log("\ncourse-info: what a shelf lists");

const file = (id, extra = {}) => ({ id, _key: id, type: "file", downloadUrl: "https://x/" + id, ...extra });

test("a placeholder with nothing behind it is not material, so it never lists", () => {
  const [shelf] = visibleShelves([{ id: "s", items: [file("a"), { id: "b", type: "file", uploadId: null }] }]);
  assert.deepEqual(shelf.items.map(i => i.id), ["a"]);
});

test("a hidden item is not listed: a student cannot open what they cannot see", () => {
  const [shelf] = visibleShelves([{ id: "s", items: [file("a"), file("b", { _hidden: true })] }]);
  assert.deepEqual(shelf.items.map(i => i.id), ["a"]);
});

test("coursework dropped into a shelf is not reference material", () => {
  const [shelf] = visibleShelves([{ id: "s", items: [file("a"), { id: "q", type: "quiz", refId: "q1" }] }]);
  assert.deepEqual(shelf.items.map(i => i.id), ["a"]);
});

test("a shelf left with nothing is dropped whole, not rendered as an empty card", () => {
  assert.deepEqual(visibleShelves([{ id: "s", items: [{ id: "b", type: "file" }] }]), []);
  assert.deepEqual(visibleShelves([{ id: "s", items: [] }]), []);
  assert.deepEqual(visibleShelves([{ id: "s" }]), []);
});

test("the source shelf is not mutated, since mergedModules stays the complete list", () => {
  const items = [file("a"), file("b", { _hidden: true })];
  const src = [{ id: "s", items }];
  visibleShelves(src);
  assert.equal(src[0].items.length, 2);
  assert.equal(items.length, 2);
});

test("a non-array is empty rather than a throw", () => {
  for (const bad of [null, undefined, {}]) assert.deepEqual(visibleShelves(bad), []);
});

console.log("\ncourse-info: guide shape");

test("a guide with no text at all normalizes to null, not an empty scaffold", () => {
  assert.equal(normalizeGuide(null), null);
  assert.equal(normalizeGuide({}), null);
  assert.equal(normalizeGuide({ rhythm: { steps: [] }, policies: [] }), null);
});

test("a section title alone is not content: only steps and cards are", () => {
  assert.equal(normalizeGuide({ rhythm: { title: "Your week", intro: "Every week:" } }), null);
});

test("steps and policies carrying no text are dropped rather than rendered empty", () => {
  const g = normalizeGuide({
    rhythm: { steps: [{ title: "Quiz", body: "b" }, { title: "  ", body: "" }, {}] },
    policies: [{ title: "Late work", body: "Half credit." }, { title: "", body: "   " }],
  });
  assert.equal(g.rhythm.steps.length, 1);
  assert.equal(g.policies.length, 1);
});

test("a step keeps its kind, and a missing kind is null so it renders neutral", () => {
  const g = normalizeGuide({ rhythm: { steps: [
    { title: "Quiz", kind: "quiz" },
    { title: "Come to class" },
  ] } });
  assert.equal(g.rhythm.steps[0].kind, "quiz");
  assert.equal(g.rhythm.steps[1].kind, null);
});

test("non-array steps/policies from a bad extraction do not throw", () => {
  const g = normalizeGuide({ rhythm: { steps: "1. Quiz" }, policies: [{ title: "t", body: "b" }] });
  assert.deepEqual(g.rhythm.steps, []);
  assert.equal(g.policies.length, 1);
});

test("whitespace-only strings are trimmed away everywhere", () => {
  const g = normalizeGuide({ rhythm: { title: "  Your week  ", intro: " Every week: ", steps: [{ title: " Quiz " }] } });
  assert.equal(g.rhythm.title, "Your week");
  assert.equal(g.rhythm.intro, "Every week:");
  assert.equal(g.rhythm.steps[0].title, "Quiz");
});

test("either half alone is content: a guide may be all steps or all cards", () => {
  assert.equal(guideHasContent(normalizeGuide({ rhythm: { steps: [{ title: "Quiz" }] } })), true);
  assert.equal(guideHasContent(normalizeGuide({ policies: [{ title: "Late work", body: "Half credit." }] })), true);
  assert.equal(guideHasContent(null), false);
});

test("a greeting has no field of its own, so it is a card like any other", () => {
  const g = normalizeGuide({ welcome: { body: "Glad you are here." } });
  assert.equal(g, null);
  const carded = normalizeGuide({ policies: [{ title: "Welcome", body: "Glad you are here." }] });
  assert.equal(carded.policies[0].title, "Welcome");
});

console.log(`\n${passed} passed\n`);
