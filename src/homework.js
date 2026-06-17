// Homework grading engine. Mirrors the quiz Claude-call pattern in utils.js (`evaluateAnswer`)
// but adds: deterministic numeric grading (±2%, sig-fig agnostic), generous Claude word grading,
// Claude math/vector-equivalence grading, and attempt-based hints/reveal with penalties.
//
// Attempt/penalty schedule (defaults — see HW_GRADING_DEFAULTS):
//   • Attempts 1–3: no penalty. Correct → full credit.
//   • After the 3rd failed attempt: a targeted hint is revealed; correct on attempt 4 → 80%.
//   • After the 4th failed attempt: the answer is revealed → 50% credit (no more attempts).
// Each problem is worth 1 point; multipart `parts` split that point equally.
import { COURSE_LABELS } from "./courses/index.js";

const HW_MODEL = "claude-opus-4-8";

// Configurable defaults. The per-problem/per-homework shape is designed so an instructor
// settings UI can later override these without touching the engine.
export const HW_GRADING_DEFAULTS = {
  freeAttempts: 3,        // attempts 1..3 earn full credit
  hintAfterAttempt: 3,    // a hint is revealed once the 3rd attempt is wrong
  hintCredit: 0.8,        // correct on attempts 4–5 (with hint) → 80%
  maxAttempts: 5,         // attempts that can earn credit; after the 5th wrong, the answer is revealed
  revealCredit: 0.5,      // credit awarded when the answer is revealed
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

export function numericMatch(studentRaw, answer, tol = HW_GRADING_DEFAULTS.numericTolerance) {
  const s = parseNumber(studentRaw);
  if (Number.isNaN(s)) return false;
  const a = Number(answer);
  if (a === 0) return Math.abs(s) <= (tol || 1e-9);
  return Math.abs(s - a) <= tol * Math.abs(a);
}

// Display the correct numeric answer in its proper sig figs (when specified), with unit.
export function formatNumericAnswer(item) {
  let val = String(item.answer);
  if (item.sigFigs) {
    const p = Number(item.answer).toPrecision(item.sigFigs);
    // Trim trailing zeros that toPrecision may introduce for integers-as-decimals,
    // but keep significant trailing zeros implied by sigFigs.
    val = p;
  }
  return item.unit ? `${val} ${item.unit}` : val;
}

// The canonical correct-answer string to reveal (numeric formatted, text as-is, math LaTeX).
export function revealAnswerFor(item) {
  if (item.answerType === "numeric") return formatNumericAnswer(item);
  return String(item.answer);
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

function parseJsonReply(text, fallback) {
  try { return JSON.parse(text.replace(/```json\n?|```/g, "").trim()); }
  catch { return fallback; }
}

// Evaluate one item (a problem, or a single part of a multipart problem).
// phase ∈ "normal" | "hint" | "reveal" — the intent IF the answer is wrong.
// Returns { correct, message, revealedAnswer? }.
export async function evaluateHomeworkAnswer({ item, studentAnswer, attemptNum, phase, history = [], courseType = "physics1" }) {
  const courseLabel = COURSE_LABELS[courseType] || "Physics";

  if (item.answerType === "numeric") {
    const correct = numericMatch(studentAnswer, item.answer, item.tolerance);
    if (correct) return { correct: true, message: "✓ Correct." };
    if (phase === "reveal") {
      return { correct: false, revealedAnswer: revealAnswerFor(item), message: `Not quite. The correct answer is ${revealAnswerFor(item)}.` };
    }
    if (phase === "hint") {
      // Ask Claude to diagnose the likely mistake from the student's value and give a
      // targeted hint — without stating the correct answer. Best-effort: if the grader
      // is unreachable, fall back to a generic hint rather than failing the submission.
      const system = `You are an encouraging ${courseLabel} tutor helping with a numeric homework problem. The student has answered incorrectly three times. Look at their answer and the correct answer, infer the MOST LIKELY mistake (e.g. a factor of 2, a sign error, a unit conversion, using the wrong formula), and give ONE short, targeted hint that points them toward that specific mistake. Do NOT state the correct numeric answer. Reply with ONLY the hint sentence, no preamble.`;
      const user = `Problem: ${item.prompt}\nCorrect answer: ${item.answer}${item.unit ? " " + item.unit : ""}\nStudent's (incorrect) answer: ${studentAnswer}`;
      let text = "";
      try { text = await callClaude({ system, messages: [{ role: "user", content: user }], maxTokens: 200 }); } catch { /* fall through to generic hint */ }
      return { correct: false, message: "💡 " + (text.trim() || "Re-check your setup — look carefully at your formula and units.") };
    }
    return { correct: false, message: "That's not correct. Re-check your calculation and try again." };
  }

  // text + math → Claude judges correctness and writes the reply.
  const isMath = item.answerType === "math";
  let system = `You are an encouraging ${courseLabel} tutor grading a homework problem.\n\n` +
    (isMath
      ? `The student enters a math/LaTeX expression. Mark CORRECT if it is mathematically equivalent to the reference answer (accept any algebraically/notationally equivalent form, including reordered vector components, equivalent unit-vector notation like \\hat{i} vs \\mathbf{i} vs î, and equivalent magnitudes/directions). Reference answer (LaTeX): ${item.answer}`
      : `Grade the student's written answer GENEROUSLY — accept any answer that conveys the correct idea, even if informal or differently worded. Reference answer: "${item.answer}"`) +
    `\n\nWhen the student is wrong, make a genuine effort to figure out what misconception or mistake led to their answer.`;

  if (phase === "hint") {
    system += `\n\nThis is the student's 3rd failed attempt. Diagnose their likely mistake and give ONE targeted hint that guides them toward it WITHOUT revealing the full answer.`;
  } else if (phase === "reveal") {
    system += `\n\nThe student has now used all their attempts. If still incorrect, kindly state the correct answer directly and briefly explain it.`;
  }
  system += `\n\nReply ONLY with valid JSON:\n- If correct: {"status":"correct","message":"1-2 sentences confirming what they got right"}\n- If incorrect: {"status":"incorrect","message":"${phase === "reveal" ? "state the correct answer and a one-line explanation" : phase === "hint" ? "one targeted hint about their likely mistake" : "one short Socratic nudge"}"}`;

  const userText = `Problem: ${item.prompt}\n\nStudent Answer: ${studentAnswer}`;
  const text = await callClaude({ system, messages: [...history, { role: "user", content: userText }], maxTokens: 600 });
  const parsed = parseJsonReply(text, { status: "incorrect", message: text || "Can you elaborate a bit more?" });
  const correct = parsed.status === "correct";
  const out = { correct, message: parsed.message || (correct ? "✓ Correct." : "Not quite — try again.") };
  if (!correct && phase === "reveal") out.revealedAnswer = revealAnswerFor(item);
  return { ...out, _historyUser: userText, _historyAssistant: JSON.stringify(parsed) };
}
