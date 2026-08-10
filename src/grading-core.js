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

const SUPERSCRIPT_DIGITS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-" };

// Rewrite the scientific-notation spellings students actually type into the JS `1.25e19`
// form that parseFloat understands. Answers like "how many electrons?" (~1.25e19) are
// unusable without this — nobody types twenty digits.
//
// Accepted: 1.25e19 · 1.25E+19 · 1.25 e 19 · 1.25x10^19 · 1.25X10^19 · 1.25*10^19 ·
//           1.25×10^19 · 1.25·10^19 · 1.25×10¹⁹ · 10^19 and ×10⁻¹⁹ (implicit mantissa of 1).
// Whitespace is only collapsed around the notation's own operators, never globally, so a
// stray "2 5" still parses as 2 rather than silently becoming 25.
export function normalizeSciNotation(str) {
  // A pasted unicode minus (U+2212, what MathLive and most textbooks emit) would otherwise be
  // skipped by the token regex, silently turning "−2.72" into +2.72.
  let t = String(str).replace(/−/g, "-");
  // Unicode superscript runs ("10¹⁹") → caret form ("10^19") so one rule handles both.
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, run => "^" + [...run].map(c => SUPERSCRIPT_DIGITS[c]).join(""));
  // "…[×x*·]10^<exp>" → "…e<exp>". With no mantissa in front ("10^19"), imply 1.
  t = t.replace(/\s*(?:[×xX*·⋅•]\s*)?10\s*\^\s*([-+]?\d+)/g, (match, exp, offset, whole) =>
    (/[\d.]\s*$/.test(whole.slice(0, offset)) ? "e" : "1e") + exp);
  // "1.25 e 19" / "1.25 E +19" → "1.25e19".
  t = t.replace(/([\d.])\s*[eE]\s*([-+]?\d+)/g, "$1e$2");
  return t;
}

// The numeric token, after sci-notation normalization: optional sign, digits with an
// optional decimal point, optional `e` exponent.
const NUMERIC_TOKEN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;

export function parseNumber(raw) {
  if (raw == null) return NaN;
  const cleaned = normalizeSciNotation(String(raw).replace(/,/g, "")).trim();
  const m = cleaned.match(NUMERIC_TOKEN);
  return m ? parseFloat(m[0]) : NaN;
}

// Count the significant figures in a student's raw entry. Leading zeros are never
// significant; trailing zeros count only when a decimal point is present (so "20" → 1,
// "20." → 2, "20.0" → 3, "16.6" → 3, "0.00500" → 3). Used to grade sig-fig-agnostically.
export function sigFigsOf(raw) {
  // Normalize first so the mantissa of "1.25×10¹⁹" is counted (3), not the "10".
  const cleaned = normalizeSciNotation(String(raw ?? "").replace(/,/g, "")).trim();
  const m = cleaned.match(NUMERIC_TOKEN);
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

// Compare an already-parsed value against the answer. Shared by numericMatch and angleMatch so
// both get the tolerance band AND the sig-fig leniency; `sf` is the sig-fig count of what the
// student actually typed.
function matchValue(s, sf, a, tol) {
  if (a === 0) return Math.abs(s) <= (tol || 1e-9);
  if (Math.abs(s - a) <= tol * Math.abs(a)) return true;
  // Sig-fig leniency: accept the true answer correctly rounded to however many sig figs
  // the student typed (so 16.603 → "17" at 2 sf is right), but not 1-sf coarsening like
  // "20", which can otherwise round-match a leading-1 answer well outside the tolerance.
  if (sf >= 2) {
    const aRounded = Number(toSigFigString(a, sf));
    if (Math.abs(aRounded - s) <= Math.abs(a) * 1e-9) return true;
  }
  return false;
}

export function numericMatch(studentRaw, answer, tol = DEFAULT_NUMERIC_TOL) {
  const s = parseNumber(studentRaw);
  if (Number.isNaN(s)) return false;
  return matchValue(s, sigFigsOf(studentRaw), Number(answer), tol);
}

// Angles: accept any COTERMINAL spelling of the same direction — -19° ≡ 341° ≡ 701°. Prompts ask
// for "degrees CCW from +x", but a student who lands on -19° has named the identical direction,
// so it must grade identically. Only whole turns are folded, so a genuinely different direction
// (213.6° vs 33.6°, say) is still wrong: shifting by ±360 can only bring two values together if
// they were coterminal to begin with.
export function angleMatch(studentRaw, answer, tol = DEFAULT_NUMERIC_TOL) {
  const s = parseNumber(studentRaw);
  if (Number.isNaN(s)) return false;
  const a = Number(answer);
  const sf = sigFigsOf(studentRaw);
  if (matchValue(s, sf, a, tol)) return true;
  const turns = Math.round((a - s) / 360);
  return turns !== 0 && matchValue(s + 360 * turns, sf, a, tol);
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

// ── LaTeX normalization (student math answers) ─────────────────────────────────
// MathLive serializes single-token arguments in TeX's COMPACT form: \frac{3}{5} comes back as
// `\frac35`. That renders correctly, but when a digit follows it produces genuinely ambiguous
// text — a student's "(4/5)(1.08×10⁴)" serializes as `\frac451.08\times10^4`, which the grader
// misread (it replied "it looks like you dropped the multiplication sign") and marked a correct
// answer wrong. Re-brace those arguments before the expression is shown to the grader; the raw
// value the student typed is what stays stored on the draft/submission.
const LATEX_TOKEN = String.raw`(\\[a-zA-Z]+|[0-9A-Za-z])`;
const TWO_ARG_RE = new RegExp(String.raw`\\(frac|dfrac|tfrac|binom)\s*${LATEX_TOKEN}\s*${LATEX_TOKEN}`, "g");
const ONE_ARG_RE = new RegExp(String.raw`\\(sqrt)\s*${LATEX_TOKEN}`, "g");

export function normalizeLatexForGrading(latex) {
  if (latex == null) return latex;
  return String(latex)
    .replace(TWO_ARG_RE, (_m, cmd, a, b) => `\\${cmd}{${a}}{${b}}`)
    .replace(ONE_ARG_RE, (_m, cmd, a) => `\\${cmd}{${a}}`);
}

// ── Scientific notation ────────────────────────────────────────────────────────
// Unicode superscripts, so a revealed answer reads correctly as PLAIN TEXT. Numeric reveals are
// rendered as text (HomeworkRunner's "Correct answer:" line, SubmissionView's "Key:", the CSV
// export) — not through MathText — so LaTeX would leak markup instead of typesetting.
const SUPERSCRIPT = { "-": "⁻", "+": "", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const superscript = n => String(n).split("").map(c => SUPERSCRIPT[c] ?? c).join("");

// Render x in scientific notation with `sf` significant figures: 1.2483e19 @3 → "1.25 × 10¹⁹",
// 9.1998e-17 @3 → "9.20 × 10⁻¹⁷". Used for the E&M-scale answers in Physics 2, where
// toSigFigString's plain decimal would give "12500000000000000000".
//
// Deliberately SEPARATE from toSigFigString rather than a mode of it: numericMatch feeds
// toSigFigString's output back through Number(), which superscript glyphs would break.
export function toSciString(x, sf) {
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  if (n === 0) return (0).toFixed(Math.max(0, (sf || 1) - 1));
  const [mantissa, exp] = n.toExponential(Math.max(0, (sf || 3) - 1)).split("e");
  const e = parseInt(exp, 10);
  return e === 0 ? mantissa : `${mantissa} × 10${superscript(e)}`;
}

// Format a numeric correct answer in its proper sig figs (when specified), with unit.
// `sci` opts this answer into scientific notation — set per answer-key entry rather than by an
// automatic magnitude threshold, so Physics 1's deliberate plain reveals ("3700000 N",
// "0.0022 m/s²") are unaffected.
export function formatNumeric(answer, sigFigs, unit, sci = false) {
  const val = sci ? toSciString(answer, sigFigs) : (sigFigs ? toSigFigString(answer, sigFigs) : String(answer));
  return unit ? `${val} ${unit}` : val;
}

// ── Robust JSON extraction from a model reply ─────────────────────────────────────
// Extract the first balanced {...} object from a string, ignoring braces inside strings, so we
// can recover the JSON even when the model wraps it in reasoning prose (despite "reply ONLY JSON").
export function extractJsonObject(text, from = 0) {
  const start = text.indexOf("{", from);
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

// A LaTeX command inside a JSON string — "you wrote \left(3/5\right)", "\hat{\imath}" — is an
// INVALID JSON escape, so JSON.parse throws on the model's whole reply. That silently turned a
// {"status":"correct"} verdict into the "incorrect" fallback, which is exactly the kind of reply
// a math problem provokes. Double every backslash that isn't already a legal JSON escape.
function repairJsonEscapes(str) {
  return str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
}

function tryParse(str) {
  try { return JSON.parse(str); } catch {}
  try { return JSON.parse(repairJsonEscapes(str)); } catch {}
  return null;
}

// Recover the grader's {"status","message"} object from a reply that may wrap it in prose.
// Scans EVERY balanced {…} candidate (not just the first) and prefers one carrying a `status`
// key, because reasoning prose routinely contains LaTeX braces like \frac{4}{5} whose "{4}"
// would otherwise be picked up as the object and fail to parse.
export function parseJsonReply(text, fallback) {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const direct = tryParse(cleaned);
  if (direct && typeof direct === "object") return direct;

  const parsedCandidates = [];
  for (let from = 0; from < cleaned.length; ) {
    const idx = cleaned.indexOf("{", from);
    if (idx < 0) break;
    const obj = extractJsonObject(cleaned, idx);
    if (!obj) break;
    const val = tryParse(obj);
    if (val && typeof val === "object") {
      if (val.status) return val;              // the grader's verdict — done
      parsedCandidates.push(val);
    }
    from = idx + 1;
  }
  return parsedCandidates[0] ?? fallback;
}
