// Run with: node src/hw-variants.test.mjs
//
// The variant generator is the one piece of this app where the browser and the grader must
// independently arrive at the same numbers, hours apart, in different processes, with nothing
// but a seed string passed between them. Every failure mode here is silent: a drift between the
// two means a student is graded against an answer to a problem they were never shown, and a
// template with a hole in it means a problem no student can solve. Neither raises an error
// anywhere, so they are tested.
//
// The per-problem fidelity of the committed specs - that a template re-renders the real prompt
// and a solver reproduces the real answer key - is a separate run: src/variant-fidelity.test.mjs.
import assert from "node:assert/strict";
import {
  hashSeed, makeRng, formatParam, baseParams, paramsFor, renderTemplate, variantProblem, isVariable,
} from "./hw-variants.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

console.log("\nhw-variants: determinism");

test("the same seed gives the same stream, a different seed does not", () => {
  const a = makeRng("joel|study_midterm|hw1_p2");
  const b = makeRng("joel|study_midterm|hw1_p2");
  const c = makeRng("joel|study_midterm|hw1_p3");
  const fromA = [a(), a(), a()];
  const fromB = [b(), b(), b()];
  const fromC = [c(), c(), c()];
  assert.deepEqual(fromA, fromB);
  assert.notDeepEqual(fromA, fromC);
});

test("rng output stays in [0,1)", () => {
  const rng = makeRng(12345);
  for (let i = 0; i < 2000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("a numeric seed and its hash are interchangeable entry points", () => {
  const viaString = makeRng("abc");
  const viaHash = makeRng(hashSeed("abc"));
  assert.equal(viaString(), viaHash());
});

test("hashing is stable across runs (the grader rehashes the same string later)", () => {
  // Pinned values: if the hash ever changes, every study guide in flight silently re-numbers
  // itself and students lose the problems they were part way through.
  assert.equal(hashSeed(""), 2166136261);
  assert.equal(hashSeed("hw1_p2"), 2795337402);
  assert.equal(hashSeed("s100|study_midterm|hw3_p7"), 340268879);
});

console.log("\nhw-variants: params");

const SPEC = {
  params: {
    r_cm: { base: 15.0, choices: [12.0, 15.0, 18.0, 20.0, 25.0], decimals: 1 },
    F: { base: 0.220, min: 0.15, max: 0.4, step: 0.005, decimals: 3 },
  },
  prompt: "When they are {{r_cm}} cm apart, the force has magnitude {{F}} N.",
};

test("base params are the committed instance", () => {
  assert.deepEqual(baseParams(SPEC), { r_cm: 15.0, F: 0.220 });
});

test("a draw is reproducible from its seed", () => {
  const once = paramsFor(SPEC, "s1|study|hw1_p2");
  const again = paramsFor(SPEC, "s1|study|hw1_p2");
  assert.deepEqual(once, again);
});

test("different students get different instances", () => {
  const a = paramsFor(SPEC, "s1|study|hw1_p2");
  const b = paramsFor(SPEC, "s2|study|hw1_p2");
  assert.notDeepEqual(a, b);
});

test("a choice param never draws the committed value, so the problem is genuinely fresh", () => {
  for (let i = 0; i < 300; i++) {
    const p = paramsFor(SPEC, `student${i}|study|hw1_p2`);
    assert.notEqual(p.r_cm, 15.0);
    assert.ok(SPEC.params.r_cm.choices.includes(p.r_cm));
  }
});

test("a range param lands on the declared grid, inside the declared bounds", () => {
  for (let i = 0; i < 300; i++) {
    const { F } = paramsFor(SPEC, `student${i}|study|hw1_p2`);
    assert.ok(F >= 0.15 && F <= 0.4, `out of bounds: ${F}`);
    assert.ok(Math.abs(Math.round((F - 0.15) / 0.005) - (F - 0.15) / 0.005) < 1e-6, `off grid: ${F}`);
  }
});

test("a single-choice param is allowed to hold its base (nothing else to draw)", () => {
  const fixed = { params: { n: { base: 4, choices: [4], decimals: 0 }, m: { base: 2, min: 1, max: 9, step: 1, decimals: 0 } } };
  for (let i = 0; i < 50; i++) assert.equal(paramsFor(fixed, `s${i}`).n, 4);
});

test("a constraint rejects draws the solver could not survive", () => {
  const spec = {
    params: {
      a: { base: 2, min: 1, max: 9, step: 1, decimals: 0 },
      b: { base: 5, min: 1, max: 9, step: 1, decimals: 0 },
    },
    // The figure shows a < b; a draw that inverts it would contradict the picture.
    constraint: p => p.a < p.b,
  };
  for (let i = 0; i < 300; i++) {
    const p = paramsFor(spec, `s${i}`);
    assert.ok(p.a < p.b, `constraint violated: ${JSON.stringify(p)}`);
  }
});

test("an unsatisfiable constraint falls back to the committed instance rather than hanging", () => {
  const spec = {
    params: { a: { base: 2, min: 1, max: 9, step: 1, decimals: 0 } },
    constraint: () => false,
  };
  assert.deepEqual(paramsFor(spec, "s1"), { a: 2 });
});

test("no draw is ever identical to the committed instance", () => {
  const spec = {
    params: {
      a: { base: 2, min: 1, max: 3, step: 1, decimals: 0 },
      b: { base: 2, min: 1, max: 3, step: 1, decimals: 0 },
    },
  };
  for (let i = 0; i < 400; i++) {
    const p = paramsFor(spec, `s${i}`);
    assert.ok(!(p.a === 2 && p.b === 2), "served the original problem as a variant");
  }
});

console.log("\nhw-variants: derived params");

const DERIVED_SPEC = {
  params: { r_cm: { base: 25.0, min: 15.0, max: 40.0, step: 5.0, decimals: 1 } },
  derived: { r2_cm: { from: p => 2 * p.r_cm, decimals: 1 } },
  prompt: "radius {{r_cm}} cm, then increased to {{r2_cm}} cm",
};

test("a derived value is computed from the draw, and printed at its own precision", () => {
  const p = paramsFor(DERIVED_SPEC, "s1");
  assert.equal(p.r2_cm, 2 * p.r_cm);
  assert.equal(renderTemplate(DERIVED_SPEC.prompt, p, DERIVED_SPEC), `radius ${p.r_cm.toFixed(1)} cm, then increased to ${p.r2_cm.toFixed(1)} cm`);
});

test("base params carry their derived values too, so invariant A can be checked", () => {
  assert.deepEqual(baseParams(DERIVED_SPEC), { r_cm: 25.0, r2_cm: 50.0 });
});

test("the relationship holds for every draw — it is the problem's own structure", () => {
  for (let i = 0; i < 200; i++) {
    const p = paramsFor(DERIVED_SPEC, `s${i}`);
    assert.equal(p.r2_cm, 2 * p.r_cm);
  }
});

test("a constraint can reject on a derived value", () => {
  const spec = {
    params: { R_cm: { base: 45.0, min: 20.0, max: 60.0, step: 5.0, decimals: 1 }, d_cm: { base: 10.0, min: 5.0, max: 30.0, step: 5.0, decimals: 1 } },
    // The point has to stay INSIDE the sphere, which is a statement about the derived depth.
    derived: { inside_cm: { from: p => p.R_cm - p.d_cm, decimals: 1 } },
    constraint: p => p.inside_cm >= 10.0,
  };
  for (let i = 0; i < 200; i++) assert.ok(paramsFor(spec, `s${i}`).inside_cm >= 10.0);
});

console.log("\nhw-variants: templating");

test("decimals are printed, not dropped — 0.220 N is three sig figs and 0.22 N is two", () => {
  assert.equal(formatParam(0.22, 3), "0.220");
  assert.equal(formatParam(15, 1), "15.0");
  assert.equal(formatParam(9, 0), "9");
});

test("rendering substitutes every placeholder at its declared precision", () => {
  assert.equal(
    renderTemplate(SPEC.prompt, { r_cm: 20.0, F: 0.315 }, SPEC),
    "When they are 20.0 cm apart, the force has magnitude 0.315 N."
  );
});

test("LaTeX in the template survives untouched", () => {
  const spec = { params: { q: { base: 4, decimals: 2 } } };
  assert.equal(
    renderTemplate("charge $q_1 = +{{q}}\\text{ nC}$ at $x = 0.200\\text{ m}$", { q: 6 }, spec),
    "charge $q_1 = +6.00\\text{ nC}$ at $x = 0.200\\text{ m}$"
  );
});

test("a placeholder with no param throws, so a holed prompt never reaches a student", () => {
  assert.throws(() => renderTemplate("{{nope}} m", { r: 1 }, SPEC), /no param "nope"/);
});

test("a template with no placeholders, and a null template, are both passed through", () => {
  assert.equal(renderTemplate("No numbers here.", {}), "No numbers here.");
  assert.equal(renderTemplate(null, {}), null);
});

console.log("\nhw-variants: a varied problem");

const PROBLEM = {
  id: "hw1_p2",
  prompt: "Two spheres. When they are 15.0 cm apart, the force has magnitude 0.220 N.",
  parts: [
    { id: "hw1_p2a", prompt: "(a) What is the charge on each if they are equal?", answerType: "numeric", unit: "μC" },
    { id: "hw1_p2b", prompt: "(b) What if one has four times the charge?", answerType: "numeric", unit: "μC" },
  ],
};
const FULL_SPEC = {
  ...SPEC,
  prompt: "Two spheres. When they are {{r_cm}} cm apart, the force has magnitude {{F}} N.",
  parts: { hw1_p2a: { prompt: "(a) What is the charge on each if they are equal? ({{r_cm}} cm)" } },
};

test("with no spec the original problem is served, marked unvaried", () => {
  const p = variantProblem(PROBLEM, null, "s1|study|hw1_p2");
  assert.equal(p.prompt, PROBLEM.prompt);
  assert.equal(p._variant.varied, false);
  assert.equal(p._variant.problemId, "hw1_p2");
});

test("with no seed the original problem is served, marked unvaried", () => {
  assert.equal(variantProblem(PROBLEM, FULL_SPEC, null)._variant.varied, false);
});

test("a varied problem keeps its shape: same id, same parts, same answer types", () => {
  const p = variantProblem(PROBLEM, FULL_SPEC, "s1|study|hw1_p2");
  assert.equal(p.id, "hw1_p2");
  assert.equal(p.parts.length, 2);
  assert.deepEqual(p.parts.map(x => x.id), ["hw1_p2a", "hw1_p2b"]);
  assert.deepEqual(p.parts.map(x => x.answerType), ["numeric", "numeric"]);
  assert.equal(p.parts[0].unit, "μC");
});

test("the variant's numbers reach the stem AND any templated part", () => {
  const p = variantProblem(PROBLEM, FULL_SPEC, "s1|study|hw1_p2");
  const { r_cm, F } = paramsFor(FULL_SPEC, "s1|study|hw1_p2");
  assert.ok(p.prompt.includes(formatParam(r_cm, 1)), p.prompt);
  assert.ok(p.prompt.includes(formatParam(F, 3)), p.prompt);
  assert.ok(p.parts[0].prompt.includes(formatParam(r_cm, 1)));
});

test("a part with no template keeps its committed wording verbatim", () => {
  const p = variantProblem(PROBLEM, FULL_SPEC, "s1|study|hw1_p2");
  assert.equal(p.parts[1].prompt, PROBLEM.parts[1].prompt);
});

test("the seed rides along on the problem, since the grader recomputes the params from it", () => {
  const p = variantProblem(PROBLEM, FULL_SPEC, "s1|study|hw1_p2");
  assert.equal(p._variant.seed, "s1|study|hw1_p2");
  assert.equal(p._variant.varied, true);
});

test("a figure is carried through unchanged — a variant cannot re-number an image", () => {
  const withFig = { ...PROBLEM, figure: "/homeworkFigures/physics2/HW1/fig.png", figureWidth: 400 };
  const p = variantProblem(withFig, FULL_SPEC, "s1|study|hw1_p2");
  assert.equal(p.figure, withFig.figure);
  assert.equal(p.figureWidth, 400);
});

test("isVariable needs both halves: a template and the params to fill it", () => {
  assert.equal(isVariable(FULL_SPEC), true);
  assert.equal(isVariable({ params: SPEC.params }), false);
  assert.equal(isVariable({ prompt: "x" }), false);
  assert.equal(isVariable(null), false);
});

console.log(`\n${passed} passed\n`);
