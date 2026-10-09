// Run with: node src/variant-fidelity.test.mjs
//
// This is the gate every parameterized problem has to pass before a student is served a variant
// of it. It checks the committed specs and solvers against the committed problems and answer
// key, which is the only way to know that a re-numbered problem is still the same problem.
//
// Four checks per spec:
//
//   A. TEMPLATE FIDELITY — rendering the template with the params' `base` values reproduces the
//      committed prompt byte for byte (stem and every templated part). A template is supposed to
//      be the textbook sentence with holes punched in it, and anything else - a reworded clause,
//      a lost "\\ ", a changed decimal count - is a paraphrase of the problem reaching students
//      under the verbatim-wording rule.
//   B. SOLVER FIDELITY — solving at those same base values reproduces the committed answer key,
//      at the precision the student is shown AND to within a tight relative margin. The
//      committed answers were independently worked when the homework was authored, so this is
//      the solver being checked against known-good physics rather than against itself.
//   C. METADATA — every id a solver returns is really an item of that problem and really has a
//      key entry, and no item that depends on the params was left out by type (a numeric item
//      whose answer the solver does not supply would silently be graded against the committed
//      instance's number).
//   D. THE SWEEP — hundreds of draws per spec, re-solved, asserting every answer stays finite,
//      stays in the same ballpark as the committed one, keeps the sign its key promises, and
//      never lands near zero. This is where ill-conditioned ranges are caught (CLAUDE.md: an
//      answer hypersensitive to rounding, or one where the correct value is about zero, has no
//      meaningful +/-2% band). It lives here rather than in a constraint because a constraint
//      ships to the browser and must never compute a solved quantity.
import assert from "node:assert/strict";
import { HOMEWORKS_PHYSICS2 } from "./courses/physics2.js";
import { VARIANTS_PHYSICS2 } from "./courses/variants/physics2.js";
import { ANSWER_KEYS } from "../netlify/functions/_answerKeys.js";
import { variantAnswers, SOLVERS, resolveKey } from "../netlify/functions/_variantSolvers.js";
import { baseParams, paramsFor, renderTemplate, isVariable } from "./hw-variants.js";
import { formatNumeric, numericMatch, DEFAULT_NUMERIC_TOL } from "./grading-core.js";
import { buildStudyAssignment } from "./study-guide.js";
import { itemsOf, keyRefFor } from "./homework.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

const COURSES = [
  { courseType: "physics2", homeworks: HOMEWORKS_PHYSICS2, specs: VARIANTS_PHYSICS2 },
];

// Where each problem lives, so a spec can be checked against its own homework's key.
function indexProblems(homeworks) {
  const out = {};
  for (const hw of homeworks) {
    for (const p of hw.problems || []) out[p.id] = { hwId: hw.id, problem: p };
  }
  return out;
}

const itemsOfProblem = p => (p.parts?.length ? p.parts : [{ ...p, id: p.id }]);

// graph / vector / fbd answers are graded on the CLIENT against key geometry in the course file,
// so they have no answer-key entry and never reach the grading endpoint.
const GRAPHICAL = new Set(["graph", "vector", "fbd"]);

// How many draws to sweep. 400 covers every corner of the hand-sized param grids these specs
// use, and the whole run still finishes in well under a second.
const SWEEP = 400;

for (const { courseType, homeworks, specs } of COURSES) {
  const byId = indexProblems(homeworks);
  const keys = ANSWER_KEYS[courseType] || {};
  const specIds = Object.keys(specs);

  console.log(`\n${courseType}: ${specIds.length} parameterized problems`);

  test("every spec names a problem that actually exists in this course", () => {
    for (const pid of specIds) assert.ok(byId[pid], `no committed problem ${pid}`);
  });

  test("every spec is variable: it has both a template and the params to fill it", () => {
    for (const pid of specIds) assert.ok(isVariable(specs[pid]), `${pid} is not a usable spec`);
  });

  test("every solver belongs to a spec, and every spec has a solver", () => {
    // A spec with no solver would re-number the prompt and grade against the committed answer:
    // the one failure mode of this whole design that students would experience as "the app says
    // I am wrong when I am right".
    const solverIds = Object.keys(SOLVERS[courseType] || {});
    for (const pid of solverIds) assert.ok(specs[pid], `solver ${pid} has no variant spec`);
    for (const pid of specIds) assert.ok(solverIds.includes(pid), `spec ${pid} has no solver`);
  });

  for (const pid of specIds) {
    const spec = specs[pid];
    const { hwId, problem } = byId[pid];
    const base = baseParams(spec);
    const hwKeys = keys[hwId] || {};

    console.log(`\n  ${pid}  (${hwId})`);

    // ── A ────────────────────────────────────────────────────────────────────────
    test("A: the stem renders back to the committed prompt, byte for byte", () => {
      assert.equal(renderTemplate(spec.prompt, base, spec), problem.prompt);
    });

    test("A: every templated part renders back to its committed prompt", () => {
      for (const [partId, t] of Object.entries(spec.parts || {})) {
        const part = itemsOfProblem(problem).find(x => x.id === partId);
        assert.ok(part, `no part ${partId} on ${pid}`);
        if (t.prompt) assert.equal(renderTemplate(t.prompt, base, spec), part.prompt, `part ${partId}`);
      }
    });

    test("A: the base params are the committed instance (no placeholder left unfilled)", () => {
      const rendered = renderTemplate(spec.prompt, base, spec);
      assert.equal(/\{\{\w+\}\}/.test(rendered), false, rendered);
    });

    // ── B ────────────────────────────────────────────────────────────────────────
    const solvedBase = variantAnswers(courseType, pid, base);

    test("B: the solver runs at base params and returns something", () => {
      assert.ok(solvedBase && Object.keys(solvedBase).length, `${pid} solved to nothing`);
    });

    test("B: every solved answer reproduces the committed answer key", () => {
      for (const [itemId, value] of Object.entries(solvedBase)) {
        const key = hwKeys[itemId];
        assert.ok(key, `no committed key for ${itemId}`);
        if (key.answerType === "numeric") {
          // Shown-to-the-student equality first: this is the answer that gets revealed and the
          // precision the problem's givens justify.
          //
          // The one exemption is a value that is identical to the committed one to float
          // precision but sits a hair on the other side of a rounding midpoint: 75 nF x 220 V
          // evaluates to 16.499999999999996, which prints as "16" at two significant figures
          // where the committed 16.5 prints as "17". That is midpoint rounding, not a different
          // answer, and it is a property the committed key already has with or without
          // variants. Anything looser than 1e-9 still has to match the printed string exactly.
          const shown = formatNumeric(value, key.sigFigs, key.unit, key.sci);
          const committedShown = formatNumeric(key.answer, key.sigFigs, key.unit, key.sci);
          const relExact = Math.abs(value - key.answer) / Math.max(Math.abs(key.answer), Number.MIN_VALUE);
          assert.ok(
            shown === committedShown || relExact < 1e-9,
            `${itemId}: solved ${value} (${shown}), committed ${key.answer} (${committedShown})`
          );
          // …then a tight relative margin, so a solver that happens to round to the same
          // displayed digits from the wrong formula is still caught. 0.2% is far inside the
          // +/-2% grading band and comfortably outside the last-digit differences that come
          // from the course's rounded constants (k = 8.988e9 and friends).
          const rel = Math.abs(value - key.answer) / Math.max(Math.abs(key.answer), Number.MIN_VALUE);
          assert.ok(rel < 0.002, `${itemId}: ${value} is ${(rel * 100).toFixed(3)}% from the committed ${key.answer}`);
        } else {
          assert.equal(String(value), String(key.answer), `${itemId} prose answer drifted from the committed one`);
        }
      }
    });

    // ── C ────────────────────────────────────────────────────────────────────────
    test("C: every solved id is an item of this problem with a key entry", () => {
      const ids = new Set(itemsOfProblem(problem).map(i => i.id));
      for (const itemId of Object.keys(solvedBase)) {
        assert.ok(ids.has(itemId), `${itemId} is not an item of ${pid}`);
        assert.ok(hwKeys[itemId], `${itemId} has no key entry`);
      }
    });

    test("C: no numeric item of this problem is left to inherit the committed number", () => {
      // A numeric answer that did not move when the givens did can only mean the solver is
      // incomplete. Prose and symbolic items legitimately inherit (a direction that never
      // flips, an expression with no numbers in it), so only numeric items are required here.
      for (const item of itemsOfProblem(problem)) {
        const key = hwKeys[item.id];
        if (!key || key.answerType !== "numeric") continue;
        assert.ok(item.id in solvedBase, `${item.id} is numeric but the solver does not supply it`);
      }
    });

    test("C: a drawn part on a varied problem is acknowledged by the spec", () => {
      // A graph/vector/fbd key lives in the course file and is graded on the CLIENT, so NO
      // solver can re-derive it (src/courses/variants/physics2.js, rule 4). If such a problem is
      // re-numbered and the drawn answer depended on one of the varied numbers, the student
      // would be graded against a diagram for a different problem - silently, since the field
      // would simply refuse to turn green. There is no way to detect that automatically, so the
      // spec has to state that its author checked, and this test is what forces the statement.
      const drawn = itemsOfProblem(problem).filter(i => GRAPHICAL.has(i.answerType));
      if (!drawn.length) return;
      assert.equal(
        spec.graphicalSafe, true,
        `${pid} has a drawn part (${drawn.map(d => d.id).join(", ")}) but its spec does not declare graphicalSafe: ` +
        `confirm no varied param reaches that key, then say so in the spec`
      );
    });

    test("C: a variant can never change how a blank is graded or formatted", () => {
      // Tolerance, sigFigs, unit, sci, nonNegative and angle all stay in _answerKeys.js. The
      // solver returns bare values, so there is nothing here for it to override.
      for (const value of Object.values(solvedBase)) {
        assert.ok(typeof value === "number" || typeof value === "string", "a solver returned a key object, not a value");
      }
    });

    // ── D ────────────────────────────────────────────────────────────────────────
    test(`D: ${SWEEP} draws stay solvable, in scale, and away from zero`, () => {
      const seen = new Set();
      for (let i = 0; i < SWEEP; i++) {
        const params = paramsFor(spec, `sweep-${pid}-${i}`);
        seen.add(JSON.stringify(params));
        if (spec.constraint) assert.ok(spec.constraint(params), `constraint violated: ${JSON.stringify(params)}`);
        const solved = variantAnswers(courseType, pid, params);
        assert.ok(solved, `draw ${i} solved to nothing: ${JSON.stringify(params)}`);
        for (const [itemId, value] of Object.entries(solved)) {
          const key = hwKeys[itemId];
          if (key.answerType !== "numeric") {
            assert.ok(typeof value === "string" && value.length > 20, `${itemId}: prose answer went missing`);
            assert.equal(/\{\{|NaN|undefined/.test(value), false, `${itemId}: unrendered prose: ${value}`);
            continue;
          }
          assert.ok(Number.isFinite(value), `${itemId}: ${value} from ${JSON.stringify(params)}`);
          // Ballpark: within a factor of 20 of the committed answer either way. A variant that
          // leaves the scale changes what the problem is teaching, and a `sci`/`sigFigs`
          // formatting chosen for the committed magnitude stops suiting it.
          // An answer that is exactly zero is zero for a structural reason - no charge enclosed,
          // inside a conductor - so it must stay exactly zero for every draw rather than drift
          // to a small number the grader's absolute band would still accept (see matchValue in
          // grading-core.js, and CLAUDE.md on zero answers).
          if (key.answer === 0) {
            assert.equal(value, 0, `${itemId}: ${value} where the committed answer is exactly 0`);
          } else {
            const ratio = Math.abs(value) / Math.abs(key.answer);
            assert.ok(ratio > 0.05 && ratio < 20, `${itemId}: ${value} is ${ratio.toFixed(3)}x the committed answer (${JSON.stringify(params)})`);
          }
          // A `nonNegative` blank refuses a negative entry from the student, so a draw that
          // makes the true answer negative would make the problem unanswerable.
          if (key.nonNegative) assert.ok(value >= 0, `${itemId}: ${value} is negative but the key is nonNegative`);
          // A signed answer must keep its sign: the committed prose, and often a sibling
          // direction part, describe which way it points.
          if (!key.nonNegative && !key.angle && key.answer !== 0) {
            assert.equal(Math.sign(value), Math.sign(key.answer), `${itemId}: sign flipped (${value} vs ${key.answer}) at ${JSON.stringify(params)}`);
          }
        }
      }
      // A spec whose draws all collapse onto a handful of instances is not giving students a
      // fresh problem; it is giving them one of three problems.
      assert.ok(seen.size >= 8, `${pid}: only ${seen.size} distinct instances in ${SWEEP} draws`);
    });
  }
}

// ── E: the whole round trip ──────────────────────────────────────────────────────
// The failure this guards against is the only one a student would actually experience, and it
// would read to them as the app being broken: shown one instance of a problem and graded against
// another. It cannot be caught by testing either half, because each half is self-consistent. So
// this walks the real path - assemble a student's guide, flatten it the way the runner does, ask
// the way the client asks, resolve the way the endpoint resolves - and checks that the answer the
// grader would accept is the answer to the problem that was actually rendered.
console.log("\nphysics2: client-to-grader round trip");

{
  const specs = VARIANTS_PHYSICS2;
  const byId = indexProblems(HOMEWORKS_PHYSICS2);
  const guide = { id: "study_midterm", title: "Midterm Study Guide", covers: ["hw1"], perHw: 3 };
  const picks = Object.keys(specs)
    .filter(pid => byId[pid].hwId === "hw1")
    .map(pid => ({ hwId: "hw1", problemId: pid, source: "own", frac: 0 }));

  test("a rendered variant is graded against the instance that was rendered, for every student", () => {
    for (const studentId of ["s1", "s2", "s3", "s17", "jj-9900"]) {
      const assignment = buildStudyAssignment({ guide, homeworks: HOMEWORKS_PHYSICS2, picks, studentId, specs });
      for (const problem of assignment.problems) {
        const spec = specs[problem.id];
        // What the student is looking at, recovered from the seed the problem carries.
        const shown = paramsFor(spec, problem._variant.seed);
        const expected = variantAnswers("physics2", problem.id, shown);
        for (const item of itemsOf(problem)) {
          if (GRAPHICAL.has(item.answerType)) continue;   // graded on the client, no key to resolve
          const ref = keyRefFor(item, assignment.id);
          // The study guide's own id has no answer key: the item has to carry its source
          // homework, or every blank on every guide is an immediate "no answer key" error.
          assert.equal(ref.hwId, "hw1");
          assert.equal(ref.variant.seed, problem._variant.seed);
          const key = resolveKey("physics2", ref.hwId, item.id, ref.variant);
          assert.ok(key, `no key resolved for ${item.id}`);
          if (expected[item.id] == null) continue;
          assert.equal(key.answer, expected[item.id], `${item.id} graded against the wrong instance`);
          // And the student's correct value really does pass the grader's own matcher at the
          // precision the problem is posed in.
          if (key.answerType === "numeric") {
            const asShown = formatNumeric(key.answer, key.sigFigs, null, key.sci);
            assert.ok(
              numericMatch(asShown, key.answer, key.tolerance ?? DEFAULT_NUMERIC_TOL),
              `${item.id}: the revealed answer ${asShown} would not pass grading`
            );
          }
        }
      }
    }
  });

  test("two students are asked different instances of the same problem", () => {
    const a = buildStudyAssignment({ guide, homeworks: HOMEWORKS_PHYSICS2, picks, studentId: "s1", specs });
    const b = buildStudyAssignment({ guide, homeworks: HOMEWORKS_PHYSICS2, picks, studentId: "s2", specs });
    let differing = 0;
    for (let i = 0; i < a.problems.length; i++) {
      if (a.problems[i].prompt !== b.problems[i].prompt) differing++;
      const ia = itemsOf(a.problems[i]).find(it => !GRAPHICAL.has(it.answerType));
      const ib = itemsOf(b.problems[i]).find(it => !GRAPHICAL.has(it.answerType));
      const ka = resolveKey("physics2", "hw1", ia.id, keyRefFor(ia, a.id));
      const kb = resolveKey("physics2", "hw1", ib.id, keyRefFor(ib, b.id));
      if (ka.answer !== kb.answer) differing++;
    }
    assert.ok(differing >= a.problems.length, `only ${differing} differences across ${a.problems.length} problems`);
  });

  test("a problem with no spec is graded against the committed key, not a fabricated one", () => {
    // hw1_p5 is deliberately unparameterized (its prose answers quote derived numbers), so it is
    // served as committed. The client marks it `varied: false`, which must reach the grader as no
    // variant at all - the fallback the whole partial-coverage design rests on.
    const unvaried = buildStudyAssignment({
      guide, homeworks: HOMEWORKS_PHYSICS2, studentId: "s1", specs,
      picks: [{ hwId: "hw1", problemId: "hw1_p5", source: "own", frac: 0 }],
    }).problems[0];
    assert.equal(unvaried._variant.varied, false);
    const item = itemsOf(unvaried).find(i => i.id === "hw1_p5a");
    const ref = keyRefFor(item, guide.id);
    assert.equal(ref.variant, null);
    assert.equal(resolveKey("physics2", ref.hwId, "hw1_p5a", ref.variant).answer, ANSWER_KEYS.physics2.hw1.hw1_p5a.answer);
  });

  test("an item of a real homework is unaffected: no variant, committed answer", () => {
    const item = itemsOf(HOMEWORKS_PHYSICS2[0].problems.find(p => p.id === "hw1_p2")).find(i => i.id === "hw1_p2a");
    const ref = keyRefFor(item, "hw1");
    assert.equal(ref.hwId, "hw1");
    assert.equal(ref.variant, null);
    assert.equal(resolveKey("physics2", "hw1", "hw1_p2a", null).answer, ANSWER_KEYS.physics2.hw1.hw1_p2a.answer);
  });

  test("a forged variant cannot loosen how a blank is graded", () => {
    const key = resolveKey("physics2", "hw1", "hw1_p2a", { problemId: "hw1_p2", seed: "forged" });
    const committed = ANSWER_KEYS.physics2.hw1.hw1_p2a;
    assert.equal(key.sigFigs, committed.sigFigs);
    assert.equal(key.unit, committed.unit);
    assert.equal(key.tolerance, committed.tolerance);
    assert.equal(key.answerType, committed.answerType);
  });
}

console.log(`\n${passed} passed\n`);
