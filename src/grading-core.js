// Environment-agnostic homework-grading helpers — pure functions with NO React, browser, or
// Node-only dependencies, so they can be imported by BOTH the client (src/homework.js) and the
// server-side grading function (netlify/functions/grade.js). The answer key for numeric/text/math
// problems lives server-side (netlify/functions/_answerKeys.js) and is never shipped to the client;
// these are the shared primitives the grader uses on either side.

// Default ±2% numeric tolerance (mirrors HW_GRADING_DEFAULTS.numericTolerance in homework.js).
export const DEFAULT_NUMERIC_TOL = 0.02;

// Shared rules for hint phrasing. The line a hint must not cross is the ANSWER, not numbers:
// method numbers (factors, constants, exponents) are useful and allowed; revealing, stating,
// contrasting, or hand-computing the result is not.
export const HINT_RULES = `RULES:
- Do NOT reveal or imply the answer. Never state it, and never contrast it with their value (no "X instead of Y", no "you got X but it should be Y").
- Do NOT spell out the exact operation that turns their answer into the correct one.
- You MAY mention numbers that belong to the METHOD (a factor, a constant like g=9.8, an exponent) when it points at the mistake — as long as that number is not the answer and doesn't let them reconstruct it.
- Focus on the wrong concept or step, not the result.`;

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

export function numericMatch(studentRaw, answer, tol = DEFAULT_NUMERIC_TOL) {
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

// Format a numeric correct answer in its proper sig figs (when specified), with unit.
export function formatNumeric(answer, sigFigs, unit) {
  const val = sigFigs ? toSigFigString(answer, sigFigs) : String(answer);
  return unit ? `${val} ${unit}` : val;
}

// ── Robust JSON extraction from a model reply ─────────────────────────────────────
// Extract the first balanced {...} object from a string, ignoring braces inside strings, so we
// can recover the JSON even when the model wraps it in reasoning prose (despite "reply ONLY JSON").
export function extractJsonObject(text) {
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

export function parseJsonReply(text, fallback) {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(cleaned); }
  catch { /* try to recover an embedded object below */ }
  const obj = extractJsonObject(cleaned);
  if (obj) { try { return JSON.parse(obj); } catch { /* fall through */ } }
  return fallback;
}
