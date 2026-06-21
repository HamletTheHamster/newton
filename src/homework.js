// Homework grading engine. Mirrors the quiz Claude-call pattern in utils.js (`evaluateAnswer`)
// but adds: deterministic numeric grading (±2% relative band, OR the true answer correctly
// rounded to the student's sig figs — see numericMatch — so honest rounding never penalizes),
// generous Claude word grading,
// Claude math/vector-equivalence grading, and attempt-based hints/reveal with penalties.
//
// Attempt/penalty schedule (defaults — see HW_GRADING_DEFAULTS):
//   • Attempts 1–3: no penalty. Correct → full credit.
//   • After the 3rd failed attempt: a targeted hint is revealed; correct on attempt 4 → 80%.
//   • After the 5th failed attempt: the answer is revealed → 0% credit (no more attempts).
// Each problem is worth 1 point; multipart `parts` split that point equally.
import { COURSE_LABELS } from "./courses/index.js";
import { compressImage } from "./utils.js";

const HW_MODEL = "claude-opus-4-8";

// Penalty applied to a homework score when its written-work integrity flag is upheld.
export const WORK_INTEGRITY_PENALTY = 0.5;

// Shared rules for hint phrasing. The line a hint must not cross is the ANSWER, not numbers:
// method numbers (factors, constants, exponents) are useful and allowed; revealing, stating,
// contrasting, or hand-computing the result is not.
const HINT_RULES = `RULES:
- Do NOT reveal or imply the answer. Never state it, and never contrast it with their value (no "X instead of Y", no "you got X but it should be Y").
- Do NOT spell out the exact operation that turns their answer into the correct one.
- You MAY mention numbers that belong to the METHOD (a factor, a constant like g=9.8, an exponent) when it points at the mistake — as long as that number is not the answer and doesn't let them reconstruct it.
- Focus on the wrong concept or step, not the result.`;

// Configurable defaults. The per-problem/per-homework shape is designed so an instructor
// settings UI can later override these without touching the engine.
export const HW_GRADING_DEFAULTS = {
  freeAttempts: 3,        // attempts 1..3 earn full credit
  hintAfterAttempt: 3,    // a hint is revealed once the 3rd attempt is wrong
  hintCredit: 0.8,        // correct on attempts 4–5 (with hint) → 80%
  maxAttempts: 5,         // attempts that can earn credit; after the 5th wrong, the answer is revealed
  revealCredit: 0,        // credit awarded when the answer is revealed (after the 5th wrong)
  numericTolerance: 0.02, // ±2%
};

// Credit multiplier (of an item's point weight) for a CORRECT answer on attempt `n`.
export function creditForAttempt(n, grading = HW_GRADING_DEFAULTS) {
  if (n <= grading.freeAttempts) return 1;
  return grading.hintCredit; // attempts 4–5 (post-hint) by default
}

// The "phase" the runner intends for a given attempt number (used to word Claude's reply
// and to decide hint/reveal). `wrong`-only thresholds; a correct answer always confirms.
export function phaseForAttempt(n, grading = HW_GRADING_DEFAULTS) {
  if (n >= grading.maxAttempts) return "reveal";
  if (n >= grading.hintAfterAttempt) return "hint";
  return "normal";
}

// ── Numeric grading ────────────────────────────────────────────────────────────
export function parseNumber(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/,/g, "").trim();
  const m = cleaned.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

// Count the significant figures in a student's raw entry. Leading zeros are never
// significant; trailing zeros count only when a decimal point is present (so "20" → 1,
// "20." → 2, "20.0" → 3, "16.6" → 3, "0.00500" → 3). Used to grade sig-fig-agnostically.
export function sigFigsOf(raw) {
  const cleaned = String(raw ?? "").replace(/,/g, "").trim();
  const m = cleaned.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
  if (!m) return 0;
  let token = m[0].replace(/^[-+]/, "");
  const eIdx = token.search(/[eE]/);
  if (eIdx >= 0) token = token.slice(0, eIdx);          // drop exponent
  const hasDot = token.includes(".");
  let digits = token.replace(".", "").replace(/^0+/, ""); // strip dot + leading zeros
  if (digits === "") return 1;                            // all zeros (e.g. "0", "0.00")
  if (hasDot) return digits.length;                       // trailing zeros after a dot are significant
  return digits.replace(/0+$/, "").length || 1;           // bare integer: trailing zeros ambiguous → drop
}

export function numericMatch(studentRaw, answer, tol = HW_GRADING_DEFAULTS.numericTolerance) {
  const s = parseNumber(studentRaw);
  if (Number.isNaN(s)) return false;
  const a = Number(answer);
  if (a === 0) return Math.abs(s) <= (tol || 1e-9);
  if (Math.abs(s - a) <= tol * Math.abs(a)) return true;
  // Sig-fig leniency: accept the true answer correctly rounded to however many sig figs
  // the student typed (so 16.603 → "17" at 2 sf is right), but not 1-sf coarsening like
  // "20", which can otherwise round-match a leading-1 answer well outside the tolerance.
  const sf = sigFigsOf(studentRaw);
  if (sf >= 2) {
    const aRounded = Number(toSigFigString(a, sf));
    if (Math.abs(aRounded - s) <= Math.abs(a) * 1e-9) return true;
  }
  return false;
}

// Render x with `sf` significant figures in plain decimal notation, preserving
// significant trailing zeros (e.g. 9 @3sf → "9.00", 40 @3sf → "40.0", 0.6 @3sf → "0.600").
// Unlike Number.prototype.toPrecision, this never emits scientific notation for the
// normal-magnitude values used in this course ((1000).toPrecision(2) === "1.0e+3" → "1000").
export function toSigFigString(x, sf) {
  const n = Number(x);
  if (!Number.isFinite(n) || !sf) return String(x);
  if (n === 0) return (0).toFixed(Math.max(0, sf - 1));
  const rounded = Number(n.toPrecision(sf)); // correctly rounded to sf sig figs (e.g. 1796 @3 → 1800)
  const exp = parseInt(Math.abs(rounded).toExponential().split("e")[1], 10); // order of magnitude
  const decimals = Math.max(0, sf - 1 - exp);
  return rounded.toFixed(decimals);
}

// Display the correct numeric answer in its proper sig figs (when specified), with unit.
export function formatNumericAnswer(item) {
  const val = item.sigFigs ? toSigFigString(item.answer, item.sigFigs) : String(item.answer);
  return item.unit ? `${val} ${item.unit}` : val;
}

// The canonical correct-answer string to reveal (numeric formatted, text as-is, math LaTeX).
export function revealAnswerFor(item) {
  if (item.answerType === "numeric") return formatNumericAnswer(item);
  if (item.answerType === "graph" || item.answerType === "vector") return "See plotted solution.";
  if (item.answerType === "fbd") return "See the free-body diagram solution.";
  return String(item.answer);
}

// ── Graph / sketch grading ─────────────────────────────────────────────────────
// A graph answer is a JSON string of the shape:
//   { curves: { [curveId]: { pts: [[x,y], …], shape: "line"|"curveUp"|"curveDown" } } }
// The problem's `graph` config carries the axes, the curves to draw, and a per-curve
// grading `key` ({ points: [[x,y], …], shape, yTolFrac? }). Grading is fully
// deterministic (no Claude): each keyed curve must (a) span the keyed x-values, (b) pass
// within tolerance of each key point, and (c) match the expected shape flag.
export function parseGraphValue(raw) {
  if (raw && typeof raw === "object") return raw.curves ? raw : { curves: {} };
  try {
    const o = JSON.parse(String(raw || ""));
    return o && o.curves ? o : { curves: {} };
  } catch { return { curves: {} }; }
}

// True if the student has placed at least one point on any curve (used to enable Submit).
export function graphHasInput(raw) {
  const d = parseGraphValue(raw);
  return Object.values(d.curves || {}).some(c => Array.isArray(c?.pts) && c.pts.length > 0);
}

// Build a renderable value object from a graph config's grading key (the "correct sketch").
export function keyToValue(graph) {
  const curves = {};
  for (const c of graph?.curves || []) {
    const k = graph.key?.[c.id];
    if (k) curves[c.id] = { pts: k.points.map(p => [...p]), shape: k.shape || "line" };
  }
  return { curves };
}

// Linear interpolation of a sorted point list at x; null if x is outside the drawn span.
function valueAtX(pts, x) {
  if (!pts.length) return null;
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}

// Deterministic grade of a graph answer. Returns { correct, reasons:[{curve,type,...}] }.
export function gradeGraph(raw, graph) {
  const data = parseGraphValue(raw);
  const reasons = [];
  const pass = {}; // { [curveId]: bool } — per-curve verdict, so the UI can green only what's right
  for (const c of graph?.curves || []) {
    const key = graph.key?.[c.id];
    if (!key) continue;
    pass[c.id] = false;
    const sc = data.curves?.[c.id];
    const pts = sc && Array.isArray(sc.pts) ? [...sc.pts].sort((a, b) => a[0] - b[0]) : [];
    if (pts.length < 2) { reasons.push({ curve: c.label, type: "missing" }); continue; }
    const yTol = (key.yTolFrac ?? 0.1) * (graph.yMax - graph.yMin);
    let outOfRange = false, pointFail = false;
    for (const [kx, ky] of key.points) {
      const yv = valueAtX(pts, kx);
      if (yv == null) { outOfRange = true; break; }
      if (Math.abs(yv - ky) > yTol) pointFail = true;
    }
    if (outOfRange) { reasons.push({ curve: c.label, type: "range" }); continue; }
    if (pointFail) { reasons.push({ curve: c.label, type: "points" }); continue; }
    if (key.shape && (sc.shape || "line") !== key.shape) { reasons.push({ curve: c.label, type: "shape" }); continue; }
    pass[c.id] = true;
  }
  return { correct: reasons.length === 0, reasons, pass };
}

// Targeted (but answer-preserving) hint for the first failing curve. Never names the exact
// shape ("parabola") or values — only nudges toward the feature to reconsider.
export function graphHint(reason) {
  if (!reason) return "Re-examine your sketch.";
  const c = reason.curve;
  switch (reason.type) {
    case "missing": return `Your “${c}” curve needs at least two points — sketch it across the time axis.`;
    case "range":   return `Extend your “${c}” curve so it spans the full time axis.`;
    case "points":  return `Your “${c}” curve doesn’t pass through the expected values — check where it should start and where the two motions meet.`;
    case "shape":   return `Re-examine the shape of your “${c}” curve: does its slope stay constant, or change as time goes on?`;
    default:        return "Re-examine your sketch.";
  }
}

// ── Vector / arrow grading ──────────────────────────────────────────────────────
// A vector answer is a JSON string of the shape:
//   { vectors: { [vecId]: { tip: [x, y], tail?: [x, y] } } }
// Each vector is an arrow from a `tail` to a `tip`; when `tail` is omitted it defaults to the
// config's common `origin` (default [0,0]). The graded quantity is the arrow itself — the
// displacement (tip − tail) — NOT the absolute tip, so a free vector drawn anywhere on the plane
// is judged purely on its direction and length. (Most vectors are rooted at the origin and only
// place a tip; a vector flagged `freeTail` in the config can also have its tail dragged, e.g. to
// draw a graphical subtraction v₂−v₁ from v₁'s tip to v₂'s tip.) The problem's `vector` config
// carries the plane (axes), the vectors to draw, the common origin, and a per-vector grading
// `key` ({ tip:[x,y], tail?:[x,y], angleTol?:deg, magTol?:frac }). Direction is ALWAYS graded
// (the angle between the student's arrow and the key arrow must be within `angleTol`, default
// 15°). Magnitude is graded ONLY when the key supplies `magTol` (a fraction of the key length)
// — so free-body diagrams (no meaningful scale) can omit it and be graded on direction alone,
// while scaled vectors (e.g. velocity components) set it to also require the right length. Fully
// deterministic (no Claude), mirroring gradeGraph.
export function parseVectorValue(raw) {
  if (raw && typeof raw === "object") return raw.vectors ? raw : { vectors: {} };
  try {
    const o = JSON.parse(String(raw || ""));
    return o && o.vectors ? o : { vectors: {} };
  } catch { return { vectors: {} }; }
}

// True if the student has placed at least one vector tip (used to enable Submit).
export function vectorHasInput(raw) {
  const d = parseVectorValue(raw);
  return Object.values(d.vectors || {}).some(
    v => Array.isArray(v?.tip) && v.tip.length === 2 && Number.isFinite(v.tip[0]) && Number.isFinite(v.tip[1])
  );
}

// Build a renderable value object from a vector config's grading key (the "correct diagram").
export function keyToVectorValue(vector) {
  const vectors = {};
  for (const v of vector?.vectors || []) {
    const k = vector.key?.[v.id];
    if (k && Array.isArray(k.tip)) {
      vectors[v.id] = Array.isArray(k.tail) ? { tail: [...k.tail], tip: [...k.tip] } : { tip: [...k.tip] };
    }
  }
  return { vectors };
}

// Deterministic grade of a vector answer. Returns { correct, reasons:[{vector,type}] }.
// Each vector is judged by its displacement (tip − tail), so the same arrow grades the same
// whether drawn from the origin or anywhere else (e.g. a subtraction from one tip to another).
export function gradeVectors(raw, vector) {
  const data = parseVectorValue(raw);
  const origin = vector?.origin || [0, 0];
  const reasons = [];
  const pass = {}; // { [vectorId]: bool } — per-vector verdict, so the UI can green only what's right
  for (const v of vector?.vectors || []) {
    const key = vector.key?.[v.id];
    if (!key || !Array.isArray(key.tip)) continue;
    pass[v.id] = false;
    const sv = data.vectors?.[v.id];
    const tip = sv && Array.isArray(sv.tip) ? sv.tip : null;
    if (!tip) { reasons.push({ vector: v.label, type: "missing" }); continue; }
    const sTail = Array.isArray(sv.tail) ? sv.tail : origin;
    const kTail = Array.isArray(key.tail) ? key.tail : origin;
    const sdx = tip[0] - sTail[0], sdy = tip[1] - sTail[1];
    const kdx = key.tip[0] - kTail[0], kdy = key.tip[1] - kTail[1];
    const sMag = Math.hypot(sdx, sdy), kMag = Math.hypot(kdx, kdy);
    if (sMag < 1e-9 || kMag < 1e-9) { reasons.push({ vector: v.label, type: "missing" }); continue; }
    const cos = (sdx * kdx + sdy * kdy) / (sMag * kMag);
    const angDiff = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (angDiff > (key.angleTol ?? 15)) { reasons.push({ vector: v.label, type: "direction" }); continue; }
    if (key.magTol != null && Math.abs(sMag - kMag) > key.magTol * kMag) {
      reasons.push({ vector: v.label, type: "magnitude" }); continue;
    }
    pass[v.id] = true;
  }
  return { correct: reasons.length === 0, reasons, pass };
}

// Targeted (but answer-preserving) hint for the first failing vector.
export function vectorHint(reason) {
  if (!reason) return "Re-examine your vectors.";
  const v = reason.vector;
  switch (reason.type) {
    case "missing":   return `Draw the “${v}” vector — click in the plane to place its arrow tip.`;
    case "direction": return `Re-check the direction of “${v}”: which quadrant should it point into, and at what angle?`;
    case "magnitude": return `Re-check the length of “${v}”: its components set how far its tip sits from the origin.`;
    default:          return "Re-examine your vectors.";
  }
}

// ── Free-body-diagram grading (`answerType: "fbd"`) ─────────────────────────────────
// An FBD is built from a *bank* of force types (the student draws any number of each), plus
// an off-to-the-side acceleration arrow and a ( pedagogical, ungraded) positive-axes gizmo.
// We never tell the student which forces act on the body — they choose from the bank. The
// grader matches the drawn set of force arrows against the key as a multiset (by type +
// direction), so it accepts the forces in any order and flags missing / extra ones without
// naming them. Deterministic (no Claude), like gradeGraph / gradeVectors.
//
//   config.fbd = {
//     bank:    ["F","T","N","w","f"]          // which force types are offered (subset)
//     forces:  [{ type, dir:[dx,dy], angleTol? }]   // the required forces (the key)
//     prefill: [{ type, dir:[dx,dy] }]        // forces the app draws & locks for the student
//     accel:   { dir:[dx,dy], angleTol? } | { none:true }   // expected acceleration (or equilibrium)
//     origin?, plane bounds, guide?, bodyLabel?
//   }
//   value (JSON string) = {
//     forces: { [id]: { type, tip:[x,y] } },  // origin-rooted force arrows the student placed
//     accel:  { tail:[x,y], tip:[x,y] } | { none:true } | null,
//     axes:   { angle:degrees }               // +x orientation (ungraded)
//   }
const FORCE_TYPES = { F: "F", T: "T", N: "N", w: "w", f: "f" }; // symbol per type (f rendered italic)

export function parseFBDValue(raw) {
  const norm = o => ({
    forces: o && o.forces && typeof o.forces === "object" ? o.forces : {},
    accel: o && o.accel ? o.accel : null,
    axes: o && o.axes && Number.isFinite(o.axes.angle) ? o.axes : { angle: 0 },
  });
  if (raw && typeof raw === "object") return norm(raw);
  try { return norm(JSON.parse(String(raw || ""))); } catch { return norm(null); }
}

// True once the student has placed any force tip or set the acceleration (enables resume / nav warn).
export function fbdHasInput(raw) {
  const d = parseFBDValue(raw);
  const anyForce = Object.values(d.forces).some(v => Array.isArray(v?.tip) && Number.isFinite(v.tip[0]));
  const anyAccel = !!d.accel && (d.accel.none || (Array.isArray(d.accel.tip) && Array.isArray(d.accel.tail)));
  return anyForce || anyAccel;
}

const _sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const _angleBetween = (u, v) => {
  const um = Math.hypot(u[0], u[1]), vm = Math.hypot(v[0], v[1]);
  if (um < 1e-9 || vm < 1e-9) return 999;
  const c = (u[0] * v[0] + u[1] * v[1]) / (um * vm);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

// Deterministic grade of an FBD. Matches drawn forces to the key as a multiset (type+direction),
// counts prefilled forces as already satisfied, and grades the acceleration arrow by direction.
// Returns { correct, reasons:[{type,...}], pass } where pass = { [forceId]:bool, _forces:bool, _accel:bool }.
export function gradeFBD(raw, fbd) {
  const data = parseFBDValue(raw);
  const origin = fbd?.origin || [0, 0];
  const reasons = [];
  const pass = {};
  const keyForces = (fbd?.forces || []).map((k, i) => ({ ...k, _i: i }));

  const studentForces = Object.entries(data.forces || {})
    .filter(([, v]) => Array.isArray(v?.tip) && Number.isFinite(v.tip[0]))
    .map(([id, v]) => ({ id, type: v.type, dir: _sub(v.tip, v.tail || origin) }));

  const matched = new Array(keyForces.length).fill(false);
  const prefillLeft = (fbd?.prefill || []).map(p => ({ ...p })); // app-supplied forces satisfy their slot first
  for (const kf of keyForces) {
    const pi = prefillLeft.findIndex(p => p.type === kf.type && _angleBetween(p.dir, kf.dir) <= (kf.angleTol ?? 18));
    if (pi >= 0) { matched[kf._i] = true; prefillLeft.splice(pi, 1); }
  }
  const usedStudent = new Set();
  for (const kf of keyForces) {
    if (matched[kf._i]) continue;
    let best = null, bestAng = Infinity;
    for (const sf of studentForces) {
      if (usedStudent.has(sf.id) || sf.type !== kf.type) continue;
      const a = _angleBetween(sf.dir, kf.dir);
      if (a <= (kf.angleTol ?? 18) && a < bestAng) { best = sf; bestAng = a; }
    }
    if (best) { matched[kf._i] = true; usedStudent.add(best.id); pass[best.id] = true; }
    else reasons.push({ type: "missing-force", forceType: kf.type });
  }
  for (const sf of studentForces) {
    if (!usedStudent.has(sf.id)) { pass[sf.id] = false; reasons.push({ type: "extra-force", id: sf.id }); }
  }
  const forcesOk = matched.every(Boolean) && studentForces.every(sf => usedStudent.has(sf.id));
  pass._forces = forcesOk;

  // Acceleration: direction-only, or "no acceleration" for an equilibrium key. Omitting fbd.accel
  // means the acceleration step isn't graded (treated as satisfied).
  let accelOk = true;
  if (fbd?.accel?.none) {
    accelOk = !!data.accel?.none;
    if (!accelOk) reasons.push({ type: "accel" });
  } else if (fbd?.accel?.dir) {
    const a = data.accel;
    accelOk = !!(a && Array.isArray(a.tip) && Array.isArray(a.tail) &&
      _angleBetween(_sub(a.tip, a.tail), fbd.accel.dir) <= (fbd.accel.angleTol ?? 20));
    if (!accelOk) reasons.push({ type: "accel" });
  }
  pass._accel = accelOk;

  return { correct: reasons.length === 0, reasons, pass };
}

// Build the renderable "correct diagram" from an FBD key (every required force once, plus the
// acceleration arrow off to the lower-right). Used for the reveal and the gradebook.
export function keyToFBDValue(fbd) {
  const forces = {};
  let i = 0;
  // Skip forces that the field draws itself from `prefill` (so the reveal doesn't double them).
  const prefillLeft = (fbd?.prefill || []).map(p => ({ ...p }));
  for (const k of fbd?.forces || []) {
    const pi = prefillLeft.findIndex(p => p.type === k.type && _angleBetween(p.dir, k.dir) <= (k.angleTol ?? 18));
    if (pi >= 0) { prefillLeft.splice(pi, 1); continue; }
    forces["k" + i++] = { type: k.type, tip: [k.dir[0], k.dir[1]] };
  }
  let accel = null;
  if (fbd?.accel?.none) accel = { none: true };
  else if (fbd?.accel?.dir) {
    const base = [0.95, -1.15]; // off to the side, away from the origin-rooted force arrows
    accel = { tail: base, tip: [base[0] + fbd.accel.dir[0] * 0.6, base[1] + fbd.accel.dir[1] * 0.6] };
  }
  return { forces, accel, axes: { angle: 0 } };
}

// Process-level hint for an FBD — guides the student through the drawing method without naming
// the specific forces (so the diagram isn't given away). Mirrors the lecture FBD checklist.
export function fbdHint(reason) {
  if (!reason) return "Re-examine your free-body diagram.";
  switch (reason.type) {
    case "missing-force": return "You're missing at least one force. Go through every object touching the body — surfaces it rests against or pushes on, ropes or cords, applied pushes/pulls — and don't forget gravity (the weight). Each contact is a force.";
    case "extra-force":   return "You've drawn a force that doesn't belong. Every force on the body must have a physical source actually touching it (or be gravity). If you can't name what's pushing or pulling, remove that arrow.";
    case "accel":         return "Re-check your acceleration arrow (the one off to the side). Which way is the body's velocity changing? If the body isn't accelerating, mark “no acceleration (equilibrium)” instead of drawing an arrow.";
    default:              return "Re-examine your free-body diagram.";
  }
}

// Name a 2-D direction the way a student reads it off the diagram (+y is up). Snaps to the four
// axis directions within a tolerance; otherwise describes the diagonal with its angle.
function _dirName(d) {
  if (!Array.isArray(d) || (Math.abs(d[0]) < 1e-9 && Math.abs(d[1]) < 1e-9)) return "no direction";
  const ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI; // +x = 0°, up = +90°
  const near = (t) => Math.abs(((ang - t + 540) % 360) - 180) < 14;
  if (near(0)) return "right (+x)";
  if (near(180)) return "left (−x)";
  if (near(90)) return "up (+y)";
  if (near(-90)) return "down (−y)";
  const deg = Math.round((Math.atan2(Math.abs(d[1]), Math.abs(d[0])) * 180) / Math.PI);
  return `${d[0] > 0 ? "right" : "left"}-and-${d[1] > 0 ? "up" : "down"} (about ${deg}° from horizontal)`;
}

// Describe the FBD the student actually drew, using THEIR labels (same ordering/auto-subscripting
// as FBDField: prefilled forces first, then student forces by id; repeats of a type get N₁, N₂…).
// Fed to Claude when grading a later text/math part so it interprets the student's force labels by
// their own diagram (e.g. their N₁ may be the box-box contact, not the ground normal). Returns null
// when nothing was drawn.
export function describeFBDDiagram(raw, fbd, bodyLabel) {
  const data = parseFBDValue(raw);
  const origin = fbd?.origin || [0, 0];
  const studentIds = Object.keys(data.forces || {})
    .filter(id => Array.isArray(data.forces[id]?.tip))
    .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
  const rendered = [
    ...(fbd?.prefill || []).map(p => ({ type: p.type, dir: p.dir, prefill: true })),
    ...studentIds.map(id => ({ type: data.forces[id].type, dir: _sub(data.forces[id].tip, data.forces[id].tail || origin), prefill: false })),
  ];
  if (!rendered.length) return null;
  const typeCounts = {};
  rendered.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
  const typeSeen = {};
  const lines = rendered.map(r => {
    typeSeen[r.type] = (typeSeen[r.type] || 0) + 1;
    const sym = FORCE_TYPES[r.type] || r.type;
    const label = typeCounts[r.type] > 1 ? `${sym}_${typeSeen[r.type]}` : sym;
    return `${label} pointing ${_dirName(r.dir)}${r.prefill ? " (given/pre-drawn)" : ""}`;
  });
  let acc = "";
  if (data.accel?.none) acc = "; acceleration: marked none (equilibrium)";
  else if (Array.isArray(data.accel?.tip) && Array.isArray(data.accel?.tail)) acc = `; acceleration pointing ${_dirName(_sub(data.accel.tip, data.accel.tail))}`;
  const head = bodyLabel ? `Free-body diagram the student drew for body ${bodyLabel}` : "Free-body diagram the student drew";
  return `${head}: ${lines.join(", ")}${acc}.`;
}

export { FORCE_TYPES };

// ── Written-work integrity ───────────────────────────────────────────────────────
// Resolve the integrity state of a homework submission given the instructor's review
// decision (stored at gradeOverrides[studentId][hwId].integrityReview). Single source of
// truth shared by the gradebook and the student grades page. A flag never withholds credit
// on its own — the submission counts at full credit until an instructor explicitly upholds:
//   • not flagged                       → no penalty
//   • flagged + no review               → no penalty (full credit; instructor may still review)
//   • flagged + review === "cleared"    → no penalty (full credit)
//   • flagged + review === "upheld"     → penalized (50%)
export function integrityState(sub, ov) {
  const flagged = !!(sub && sub.integrity && sub.integrity.flagged);
  const review = (ov && ov.integrityReview) || null;
  const penalized = flagged && review === "upheld";
  return { flagged, review, penalized };
}

// Apply the integrity penalty to a base /10 score (null passes through).
export function integrityAdjustedScore(baseScore, penalized) {
  if (baseScore == null) return baseScore;
  return penalized ? parseFloat((baseScore * WORK_INTEGRITY_PENALTY).toFixed(2)) : baseScore;
}

// Recompute a homework /10 score from instructor per-part overrides
// (partScores: { [itemId]: earnedValue }). Items without an override keep their
// submitted `earned`. Mirrors the late penalty baked into the original score.
export function scoreFromPartOverrides(submission, partScores) {
  const rawScore = (submission.problems || []).reduce((total, p) => {
    const items = p.parts || [p];
    return total + items.reduce((sum, item) => {
      const ov = (partScores || {})[item.id];
      return sum + (ov != null ? Number(ov) : (item.earned ?? 0));
    }, 0);
  }, 0);
  const pct = (submission.nativeTotal || 1) > 0 ? rawScore / submission.nativeTotal : 0;
  return parseFloat((pct * 10 * (submission.late ? 0.5 : 1)).toFixed(2));
}

// Canonical effective-score resolver — THE single source of truth shared by the
// instructor Gradebook, the student StudentGrades page, and the shared SubViewModal,
// so the score the instructor sets is always exactly what the student sees (grades
// list AND submission view), for quizzes and homework alike. Resolution order:
//   1. ov.excused                        → excluded from the grade (no score)
//   2. ov.score (whole-assignment)       → wins over everything below
//   3. ov.partScores (homework only)     → recompute via scoreFromPartOverrides
//   4. submission.score                  → the auto-graded score
// then the upheld-integrity 50% penalty applies. Returns:
//   { excused, base, penalized, flagged, effective }
//   base      = /10 score before the integrity penalty (null = no score yet)
//   effective = the integrity-adjusted /10 score to display & feed into calcGrades
//               (null when excused or no score exists)
export function resolveScore(submission, override) {
  const ov = override || {};
  const sub = submission || null;
  const ist = integrityState(sub, ov);
  if (ov.excused) return { excused: true, base: null, penalized: ist.penalized, flagged: ist.flagged, effective: null };
  let base;
  if (ov.score != null) base = ov.score;
  else if (ov.partScores && sub && sub.type === "homework") base = scoreFromPartOverrides(sub, ov.partScores);
  else base = sub != null ? sub.score : null;
  return { excused: false, base, penalized: ist.penalized, flagged: ist.flagged, effective: integrityAdjustedScore(base, ist.penalized) };
}

// Turn a student-uploaded work File into a Claude content block: images are compressed and
// sent as image blocks; PDFs are sent as document blocks. Returns null if unusable.
export async function workFileToBlock(file) {
  if (!file) return null;
  try {
    if ((file.type || "").startsWith("image/")) {
      const img = await compressImage(file);
      return { type: "image", source: { type: "base64", media_type: img.type, data: img.data } };
    }
    if (file.type === "application/pdf") {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      return data ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } } : null;
    }
  } catch { /* fall through */ }
  return null;
}

// Lenient academic-integrity "sniff check" of a student's uploaded written work against the
// homework problems and their submitted answers. Returns { flagged, reason } — and on any
// grader error returns { flagged: false, error } so an outage never penalizes a student.
export async function checkWorkIntegrity({ problems = [], answers = {}, files = [], courseType = "physics1" }) {
  const courseLabel = COURSE_LABELS[courseType] || "Physics";
  try {
    const blocks = (await Promise.all(files.map(workFileToBlock))).filter(Boolean);
    if (!blocks.length) return { flagged: false, error: "No readable work files were provided to the integrity check." };

    // Summarize each problem + the student's submitted answer(s).
    const lines = problems.map((p, i) => {
      const its = (p.parts && p.parts.length)
        ? p.parts.map((pt, j) => `  Part (${"abcdefgh"[j]}): ${pt.prompt || ""} → answered: ${answers[pt.id] || "—"}`)
        : [`  → answered: ${answers[p.id] || "—"}`];
      return `Problem ${i + 1}: ${p.prompt || ""}\n${its.join("\n")}`;
    }).join("\n\n");

    const system = `You are doing a LENIENT academic-integrity sniff check on a ${courseLabel} student's uploaded handwritten/scratch work. You are given the homework problems, the student's submitted final answers, and image/PDF scans of the work they claim to have done themselves.\n\nYour job is to decide whether the uploaded work shows plausible evidence the student personally worked THESE SPECIFIC problems — calculations, diagrams, intermediate steps, attempts, crossed-out work, algebra, free-body diagrams, etc. Be GENEROUS about quality: messy, partial, disorganized, or hard-to-read scratch work counts as sufficient. Handwriting need not be neat and work need not be complete or correct, and it need not cover every problem.\n\nBut the work must actually CORRESPOND to the assigned problems above: it should reference recognizable quantities, given values, setups, figures, or topics from these problems. Work that is clearly about DIFFERENT problems — even if it is legitimate, neat, and obviously real ${courseLabel} work — does NOT count, because it is not evidence the student did THIS assignment.\n\nFLAG (sufficient:false) when there is no plausible evidence of personal work on THESE problems: blank or irrelevant images, photos of something unrelated, only the final typed answers copied out with no supporting work, OR work that does not match the assigned problems (different quantities, different scenarios, an unrelated topic). When in doubt about whether messy work matches, lean toward accepting it — only flag when the mismatch or absence is clear.\n\nReply ONLY with valid JSON: {"sufficient":true} if the work is acceptable, or {"sufficient":false,"reason":"one short sentence describing what is missing or mismatched"} if you must flag it.`;
    const userText = `Homework problems and the student's submitted answers:\n\n${lines}\n\nThe student's uploaded written work is attached. Does it show reasonable evidence they personally worked THESE specific problems (not just generic ${courseLabel} work for some other assignment)?`;

    const text = await callClaude({
      system,
      messages: [{ role: "user", content: [...blocks, { type: "text", text: userText }] }],
      maxTokens: 300,
    });
    const parsed = parseJsonReply(text, { sufficient: true });
    if (parsed.sufficient === false) {
      return { flagged: true, reason: parsed.reason || "The uploaded work does not show enough evidence of original effort." };
    }
    return { flagged: false };
  } catch (err) {
    return { flagged: false, error: err?.message || "Integrity check could not be completed." };
  }
}

// ── Claude calls ────────────────────────────────────────────────────────────────
async function callClaude({ system, messages, maxTokens = 600 }) {
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: HW_MODEL, max_tokens: maxTokens, system, messages }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("The grader returned a non-JSON response. Run the app with `netlify dev` so the Claude proxy function is available."); }
  if (!res.ok || data?.error) {
    throw new Error("Grader error: " + (data?.error?.message || `HTTP ${res.status}`));
  }
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text.trim()) {
    throw new Error("The grader returned an empty response (check that ANTHROPIC_API_KEY is set in the Netlify dev environment).");
  }
  return text;
}

// Extract the first balanced {...} object from a string, ignoring braces inside strings, so we
// can recover the JSON even when the model wraps it in reasoning prose (despite "reply ONLY JSON").
function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function parseJsonReply(text, fallback) {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(cleaned); }
  catch { /* try to recover an embedded object below */ }
  const obj = extractJsonObject(cleaned);
  if (obj) { try { return JSON.parse(obj); } catch { /* fall through */ } }
  return fallback;
}

// Fetch a problem figure (a same-origin static asset like "/homeworkFigures/HW1/fig1.png")
// and return it as a Claude image content block, so the grader sees the full problem including
// the figure. Best-effort: returns null if there's no figure or it can't be loaded, so a
// missing/broken figure never blocks grading.
async function figureToImageBlock(figure) {
  if (!figure || typeof fetch !== "function") return null;
  try {
    const res = await fetch(figure);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mediaType = blob.type || "image/png";
    if (!/^image\/(png|jpeg|gif|webp)$/.test(mediaType)) return null;
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return data ? { type: "image", source: { type: "base64", media_type: mediaType, data } } : null;
  } catch { return null; }
}

// The complete problem statement for the grader: the shared stem (multipart) + this item's
// prompt. Single-item problems carry their whole prompt in item.prompt, so there's no stem.
function fullPromptFor(item) {
  return [item._problemPrompt, item.prompt].filter(Boolean).join("\n\n");
}

// Compose a Claude user message, attaching the figure image block when one is available.
function userContentWith(figureBlock, text) {
  return figureBlock ? [figureBlock, { type: "text", text }] : text;
}

// Evaluate one item (a problem, or a single part of a multipart problem).
// phase ∈ "normal" | "hint" | "reveal" — the intent IF the answer is wrong.
// Returns { correct, message, revealedAnswer? }.
export async function evaluateHomeworkAnswer({ item, studentAnswer, attemptNum, phase, history = [], courseType = "physics1", grading = HW_GRADING_DEFAULTS, diagramContext = null }) {
  const courseLabel = COURSE_LABELS[courseType] || "Physics";
  const fullPrompt = fullPromptFor(item);
  const figureBlock = await figureToImageBlock(item._figure);

  if (item.answerType === "numeric") {
    const correct = numericMatch(studentAnswer, item.answer, item.tolerance ?? grading.numericTolerance);
    if (correct) return { correct: true, message: "✓ Correct." };
    if (phase === "reveal") {
      return { correct: false, revealedAnswer: revealAnswerFor(item), message: `Not quite. The correct answer is ${revealAnswerFor(item)}.` };
    }
    if (phase === "hint") {
      // Ask Claude to diagnose the likely mistake and give a targeted hint WITHOUT revealing
      // the answer (see HINT_RULES). Best-effort: if the grader is unreachable, fall back to a
      // generic hint rather than failing the submission.
      const system = `You are an encouraging ${courseLabel} tutor. The full problem and any figure are provided. The student has answered this numeric problem incorrectly several times.\n\nYou are given the correct answer ONLY to help you diagnose their mistake — treat it as CONFIDENTIAL.\n\nInfer the single most likely error (a missing/extra factor, a squared-vs-linear term, a sign error, a unit conversion, the wrong formula, a misread value) and give ONE short hint pointing to that specific step.\n\n${HINT_RULES}\n\nReply with ONLY the hint sentence, no preamble.`;
      const user = `Problem: ${fullPrompt}\nCorrect answer (confidential): ${item.answer}${item.unit ? " " + item.unit : ""}\nStudent's (incorrect) answer: ${studentAnswer}`;
      let text = "";
      try { text = await callClaude({ system, messages: [{ role: "user", content: userContentWith(figureBlock, user) }], maxTokens: 200 }); } catch { /* fall through to generic hint */ }
      return { correct: false, message: "💡 " + (text.trim() || "Re-check your setup — look carefully at your formula and units.") };
    }
    return { correct: false, message: "That's not correct. Re-check your calculation and try again." };
  }

  if (item.answerType === "graph") {
    // Deterministic grade — no Claude call needed. `_gradePass` lets the runner green only the
    // curves that actually passed (so a drawn-but-unverified curve never looks "correct").
    const res = gradeGraph(studentAnswer, item.graph);
    if (res.correct) return { correct: true, message: "✓ Correct — your sketch matches.", _gradePass: res.pass };
    if (phase === "reveal") return { correct: false, revealedAnswer: revealAnswerFor(item), message: "Here is the correct sketch.", _gradePass: res.pass };
    if (phase === "hint") return { correct: false, message: "💡 " + graphHint(res.reasons[0]), _gradePass: res.pass };
    return { correct: false, message: "Not quite — review the points your curves pass through and their shape, then try again.", _gradePass: res.pass };
  }

  if (item.answerType === "vector") {
    // Deterministic grade — no Claude call needed. `_gradePass` lets the runner green only the
    // vectors that actually passed (so a drawn-but-unverified arrow never looks "correct").
    const res = gradeVectors(studentAnswer, item.vector);
    if (res.correct) return { correct: true, message: "✓ Correct — your vectors match.", _gradePass: res.pass };
    if (phase === "reveal") return { correct: false, revealedAnswer: revealAnswerFor(item), message: "Here is the correct diagram.", _gradePass: res.pass };
    if (phase === "hint") return { correct: false, message: "💡 " + vectorHint(res.reasons[0]), _gradePass: res.pass };
    return { correct: false, message: "Not quite — re-check the direction (and length) of each vector, then try again.", _gradePass: res.pass };
  }

  if (item.answerType === "fbd") {
    // Deterministic grade — no Claude call. Graphical items normally live-grade via the runner's
    // onGraphicalChange (no Submit), but mirror the graph/vector branches for completeness.
    const res = gradeFBD(studentAnswer, item.fbd);
    if (res.correct) return { correct: true, message: "✓ Correct — your free-body diagram matches.", _gradePass: res.pass };
    if (phase === "reveal") return { correct: false, revealedAnswer: revealAnswerFor(item), message: "Here is the correct free-body diagram.", _gradePass: res.pass };
    if (phase === "hint") return { correct: false, message: "💡 " + fbdHint(res.reasons[0]), _gradePass: res.pass };
    return { correct: false, message: "Not quite — re-check that every force on the body is drawn (and no extras), and that your acceleration arrow points the right way.", _gradePass: res.pass };
  }

  // text + math → Claude judges correctness and writes the reply.
  const isMath = item.answerType === "math";
  let system = `You are an encouraging ${courseLabel} tutor grading a homework problem. The full problem and any figure are provided.\n\n` +
    (isMath
      ? `The student enters a math/LaTeX expression. Mark CORRECT if it is mathematically equivalent to the reference answer (accept any algebraically/notationally equivalent form, including reordered vector components, equivalent unit-vector notation like \\hat{i} vs \\mathbf{i} vs î, and equivalent magnitudes/directions). Reference answer (LaTeX, confidential): ${item.answer}`
      : `Grade the student's written answer GENEROUSLY — accept any answer that conveys the correct idea, even if informal or differently worded. Reference answer (confidential): "${item.answer}"`) +
    `\n\nWhen the student is wrong, make a genuine effort to figure out what misconception or mistake led to their answer.`;

  if (diagramContext) {
    system += `\n\nIMPORTANT — earlier in this problem the student drew and labeled their OWN free-body diagram(s). Interpret any force labels in their answer (e.g. F, T, N, N_1, N_2, w, f) by what those labels refer to in THEIR diagram below, NOT by conventional defaults. For example, if their N_1 is the contact (normal) force between two bodies, accept "N_1" as naming that contact force. Their diagram(s):\n${diagramContext}`;
  }

  if (phase === "hint") {
    system += `\n\nThis is the student's 3rd failed attempt. Diagnose their likely mistake and give ONE targeted hint that guides them toward it.\n\n${HINT_RULES}`;
  } else if (phase === "reveal") {
    system += `\n\nThe student has now used all their attempts. If still incorrect, kindly state the correct answer directly and briefly explain it.`;
  }
  system += `\n\nReply with ONLY a single JSON object and nothing else — no reasoning, preamble, or text before or after it. Do all your thinking silently; emit only the JSON:\n- If correct: {"status":"correct","message":"1-2 sentences confirming what they got right"}\n- If incorrect: {"status":"incorrect","message":"${phase === "reveal" ? "state the correct answer and a one-line explanation" : phase === "hint" ? "one targeted hint about their likely mistake" : "one short Socratic nudge"}"}`;

  const userText = `Problem: ${fullPrompt}\n\nStudent Answer: ${studentAnswer}`;
  const text = await callClaude({ system, messages: [...history, { role: "user", content: userContentWith(figureBlock, userText) }], maxTokens: 600 });
  const parsed = parseJsonReply(text, { status: "incorrect", message: text || "Can you elaborate a bit more?" });
  const correct = parsed.status === "correct";
  const out = { correct, message: parsed.message || (correct ? "✓ Correct." : "Not quite — try again.") };
  if (!correct && phase === "reveal") out.revealedAnswer = revealAnswerFor(item);
  return { ...out, _historyUser: userText, _historyAssistant: JSON.stringify(parsed) };
}
