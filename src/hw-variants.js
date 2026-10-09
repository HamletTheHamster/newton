// Parameterized homework problems — the machinery that re-numbers a problem so a student
// re-working it on a study guide solves a fresh instance rather than re-typing the answer they
// were shown last time.
//
// WHY THIS IS SHAPED THE WAY IT IS
//
// A committed homework problem keeps its numbers in two places that must agree: the prompt
// string in src/courses/<course>.js (student-visible) and the answer in
// netlify/functions/_answerKeys.js (server-only). Re-numbering one without the other is the
// obvious catastrophe, so a variant is never authored as a second prompt beside a second answer.
// Instead each parameterized problem gets:
//
//   1. a PARAM SPEC + PROMPT TEMPLATE in src/courses/variants/<course>.js — client-safe, since
//      a template and a range of plausible givens reveal nothing, and the client has to render
//      the prompt it shows.
//   2. a SOLVER in netlify/functions/_variantSolvers.js — server-only, beside the answer key and
//      for the same reason: it computes answers.
//
// Both halves are driven from the SAME params, which both sides derive from the same seed with
// the deterministic generator below, so the client and the grader cannot disagree about what
// numbers the student was asked. Nothing about the variant is stored for grading: the seed is,
// and everything else is recomputed.
//
// The whole scheme rests on two invariants, both mechanically checked by
// src/variant-fidelity.test.mjs against every spec:
//
//   A. renderTemplate(spec.prompt, baseParams(spec)) === the committed prompt, byte for byte.
//      This is what makes a template a faithful stand-in for the problem instead of a paraphrase
//      of it (CLAUDE.md: prompts are the source problem's wording, verbatim). Authoring a
//      template is a mechanical hole-punching of the committed sentence, and the test fails on
//      so much as a changed space.
//   B. solve(baseParams(spec)) === the committed answer key's values.
//      The solver is therefore verified against an answer that was independently worked when the
//      homework was authored — which is also why a solver may only ever be authored by working
//      the problem symbolically, never by curve-fitting it to the one known answer.
//
// A problem with no spec is served with its original numbers (see variantProblem). That is a
// deliberate floor, not a gap: every student gets the problems they actually did worst on, and
// specs are added problem by problem without the feature waiting on all of them.

// ── Deterministic randomness ─────────────────────────────────────────────────────
// Seeds are strings (student id + study id + problem id), so they are hashed to a 32-bit
// integer first. xfnv1a + mulberry32: tiny, well-mixed, and - the only property that actually
// matters here - identical in every JS runtime, forever. Math.random() could not be used for
// any of this: the grader has to derive the same numbers as the browser, hours later, in a
// different process.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Params ───────────────────────────────────────────────────────────────────────
// A param is declared in the units and the FORM the prompt shows it in - `r_cm` not `r`,
// `v0_mant` for the mantissa of 1.60e6 - so that the template substitution is a plain
// find-and-replace and the prompt's own precision is preserved by `decimals`. Converting to SI
// is the solver's job. Two draw shapes:
//
//   { base, choices: [...], decimals }        pick one of a hand-picked list
//   { base, min, max, step, decimals }        pick off a grid (textbook-looking numbers only)
//
// `decimals` is how the value is PRINTED, and it is not cosmetic: a prompt reading "0.220 N"
// has three decimals and three significant figures, and dropping to "0.22 N" changes what the
// student is entitled to round to. Invariant A catches a wrong `decimals` immediately.
const roundTo = (v, decimals) => Number(Math.round(v * 10 ** decimals + Number.EPSILON) / 10 ** decimals);

export function formatParam(value, decimals = 0) {
  return Number(value).toFixed(decimals);
}

// How a name is printed, whether it was drawn or derived.
function decimalsFor(spec, name) {
  return spec?.params?.[name]?.decimals ?? spec?.derived?.[name]?.decimals ?? 0;
}

// DERIVED params: values the prompt prints that are fixed FUNCTIONS of the drawn ones.
//
// These exist because so many textbook problems quote a second value that is tied to the first
// by the problem's own structure: "what is the flux if its radius is increased to 0.500 m" when
// the radius is 0.250 m, or a point "0.100 m below the surface" of a sphere of radius 0.450 m.
// Drawing those independently would break the relationship the problem is built on, and in
// several cases the committed reference answer argues FROM it ("doubling the radius doubles the
// area, but the field drops to half, and the two cancel exactly"). So they are computed, not
// drawn, and the relationship survives every draw.
//
// A derived function must be a pure function of the drawn params and must never compute an
// ANSWER: like a constraint, this file ships to the browser (see the authoring rules in
// src/courses/variants/physics2.js).
function withDerived(spec, params) {
  const out = { ...params };
  for (const [name, d] of Object.entries(spec?.derived || {})) {
    out[name] = roundTo(d.from(out), d.decimals ?? 0);
  }
  return out;
}

// The committed problem's own numbers, i.e. the instance that was authored and verified. Used
// for invariant A/B and as the value served when a param has no draw.
export function baseParams(spec) {
  const out = {};
  for (const [name, p] of Object.entries(spec?.params || {})) out[name] = p.base;
  return withDerived(spec, out);
}

function drawParam(p, rng) {
  if (Array.isArray(p.choices)) {
    const pool = p.choices.length > 1 ? p.choices.filter(c => c !== p.base) : p.choices;
    return pool[Math.floor(rng() * pool.length)];
  }
  const step = p.step ?? 1;
  const n = Math.floor((p.max - p.min) / step + 1e-9) + 1;
  return roundTo(p.min + step * Math.floor(rng() * n), p.decimals ?? 0);
}

// Draw one instance of a spec's params from `seed`.
//
// Two rejections, retried up to a bounded number of times so this can never hang:
//   - a draw identical to the committed instance (the point of a variant is a fresh instance,
//     and a study guide that re-serves the exact problem invites re-typing the revealed answer)
//   - a draw the spec's own `constraint` rejects. This is where a spec protects its solver's
//     assumptions: that a charge stays inside the plates, that a root stays real, that two
//     given values keep the ordering the figure shows, that no answer lands so near zero that
//     the +/-2% band stops meaning anything (CLAUDE.md: ill-conditioned numerics).
// Exhausting the retries falls back to the committed instance, which is always valid.
const MAX_DRAWS = 50;

export function paramsFor(spec, seed) {
  if (!spec?.params) return {};
  const base = baseParams(spec);
  const names = Object.keys(spec.params);
  const rng = makeRng(seed);
  for (let i = 0; i < MAX_DRAWS; i++) {
    const draw = {};
    for (const name of names) draw[name] = drawParam(spec.params[name], rng);
    const unchanged = names.every(n => draw[n] === base[n]);
    if (unchanged) continue;
    const full = withDerived(spec, draw);
    // The constraint sees the derived values too, so a spec can require what the problem's own
    // structure requires of them (a second radius still outside the first, a point still inside
    // the sphere) without restating the arithmetic that produced them.
    if (spec.constraint && !spec.constraint(full)) continue;
    return full;
  }
  return base;
}

// ── Templating ───────────────────────────────────────────────────────────────────
// `{{name}}` rather than `${name}` or a bare `{name}`: every prompt is LaTeX-bearing, so braces
// and dollar signs are already load-bearing in the string ("$15.0\\text{ cm}$"). A doubled brace
// appears nowhere in KaTeX source, which makes the placeholder unambiguous and the template
// readable as the sentence it came from.
//
// An unknown placeholder throws rather than rendering empty: a prompt with a hole in it is a
// problem no student can solve, and failing here means invariant A catches it in the test run
// instead of a student meeting "When they are  cm apart".
const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function renderTemplate(template, params, spec = null) {
  if (template == null) return template;
  return String(template).replace(PLACEHOLDER, (_m, name) => {
    if (!(name in params)) throw new Error(`hw-variants: no param "${name}" for this template`);
    return formatParam(params[name], decimalsFor(spec, name));
  });
}

// ── A varied problem ─────────────────────────────────────────────────────────────
// Returns a problem in exactly the shape src/courses/<course>.js commits, so every consumer -
// the runner, itemsOf, StudySheet, the submission viewer - handles it without knowing it is a
// variant. The variant identity rides along in `_variant` for the grader to recompute from.
//
// With no spec (or no seed) the ORIGINAL problem is returned, marked `varied: false`. A problem
// can be unvariable for good reasons that will never go away: its givens are printed inside the
// figure image, its answer is purely symbolic, or it is a one-off like the clockface whose
// numbers ARE the problem. Those are still worth re-working, and the study guide says plainly
// which problems are the original.
export function variantProblem(problem, spec, seed) {
  if (!problem) return problem;
  if (!spec || !seed) return { ...problem, _variant: { problemId: problem.id, varied: false } };
  const params = paramsFor(spec, seed);
  const varied = { problemId: problem.id, seed: String(seed), varied: true };
  const out = {
    ...problem,
    prompt: spec.prompt ? renderTemplate(spec.prompt, params, spec) : problem.prompt,
    _variant: varied,
  };
  if (problem.freeHint && spec.freeHint) out.freeHint = renderTemplate(spec.freeHint, params, spec);
  if (problem.parts?.length) {
    out.parts = problem.parts.map(pt => {
      const t = spec.parts?.[pt.id];
      if (!t) return pt;
      return {
        ...pt,
        prompt: t.prompt ? renderTemplate(t.prompt, params, spec) : pt.prompt,
        ...(pt.freeHint && t.freeHint ? { freeHint: renderTemplate(t.freeHint, params, spec) } : {}),
      };
    });
  }
  return out;
}

// Is this problem one a variant spec can re-number at all? Used by the authoring report so the
// instructor can see how much of a study guide is fresh and what is still being served as the
// original.
export const isVariable = (spec) => !!(spec && spec.prompt && spec.params);
