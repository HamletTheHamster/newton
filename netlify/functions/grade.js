// Server-side homework grading endpoint for numeric / text / math problems. The answer key
// (netlify/functions/_answerKeys.js) is bundled into THIS function and never shipped to the
// browser, so students can't read answers from the client JS bundle or the public repo. Graph /
// vector / fbd problems are still graded deterministically on the client (their key geometry lives
// in the course file) — those never hit this endpoint.
//
// The only secret this function adds is the looked-up answer/tolerance/sigFigs/unit. Everything
// else (the prompt text, the figure image, the chat history, the FBD diagram context) is already
// student-visible and is passed in by the client, so the function just composes the Claude call
// with the confidential answer injected here.
//
// Request body (POST JSON):
//   { action: "grade", courseType, hwId, itemId, answerType, studentAnswer,
//     attemptNum, phase, fullPrompt, figureBlock?, history?, diagramContext? }
//   { action: "reveal", courseType, hwId, items: [itemId, …] }
import { lookupAnswer } from "./_answerKeys.js";
import {
  numericMatch,
  formatNumeric,
  parseJsonReply,
  HINT_RULES,
  DEFAULT_NUMERIC_TOL,
} from "../../src/grading-core.js";

const HW_MODEL = "claude-opus-4-8";

// Minimal course label map (kept local so this function doesn't bundle the whole course content).
const COURSE_LABELS = { physics1: "Physics 1", physics2: "Physics 2" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = JSON.parse(await req.text()); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  const courseLabel = COURSE_LABELS[body.courseType] || "Physics";

  // ── reveal: return the correct answers for a set of items (used at final submit to populate the
  // gradebook key; post-submission so revealing is fine). Skips ids with no key entry. ──────────
  if (body.action === "reveal") {
    const out = {};
    for (const itemId of body.items || []) {
      const key = lookupAnswer(body.courseType, body.hwId, itemId);
      if (!key) continue;
      out[itemId] = key.answerType === "numeric"
        ? formatNumeric(key.answer, key.sigFigs, key.unit)
        : String(key.answer);
    }
    return json({ answers: out });
  }

  if (body.action !== "grade") return json({ error: "Unknown action." }, 400);

  const key = lookupAnswer(body.courseType, body.hwId, body.itemId);
  if (!key) return json({ error: `No answer key for ${body.hwId}/${body.itemId}.` }, 400);

  const { studentAnswer = "", phase, fullPrompt = "", figureBlock = null, diagramContext = null } = body;
  const history = Array.isArray(body.history) ? body.history : [];

  // ── Numeric: deterministic match (server owns the tolerance — never trust a client-sent one) ──
  if (key.answerType === "numeric") {
    const revealed = formatNumeric(key.answer, key.sigFigs, key.unit);
    const correct = numericMatch(studentAnswer, key.answer, key.tolerance ?? DEFAULT_NUMERIC_TOL);
    if (correct) return json({ correct: true, message: "✓ Correct.", revealedAnswer: revealed });
    if (phase === "reveal") {
      return json({ correct: false, revealedAnswer: revealed, message: `Not quite. The correct answer is ${revealed}.` });
    }
    if (phase === "hint") {
      // Ask Claude to diagnose the likely mistake WITHOUT revealing the answer (see HINT_RULES).
      // Best-effort: fall back to a generic hint if the grader call fails.
      const system = `You are an encouraging ${courseLabel} tutor. The full problem and any figure are provided. The student has answered this numeric problem incorrectly several times.\n\nYou are given the correct answer ONLY to help you diagnose their mistake — treat it as CONFIDENTIAL.\n\nInfer the single most likely error (a missing/extra factor, a squared-vs-linear term, a sign error, a unit conversion, the wrong formula, a misread value) and give ONE short hint pointing to that specific step.\n\n${HINT_RULES}\n\nReply with ONLY the hint sentence, no preamble.`;
      const user = `Problem: ${fullPrompt}\nCorrect answer (confidential): ${key.answer}${key.unit ? " " + key.unit : ""}\nStudent's (incorrect) answer: ${studentAnswer}`;
      let text = "";
      try { text = await callClaude({ system, messages: [{ role: "user", content: contentWith(figureBlock, user) }], maxTokens: 200 }); }
      catch { /* fall through to generic hint */ }
      return json({ correct: false, message: "💡 " + (text.trim() || "Re-check your setup — look carefully at your formula and units.") });
    }
    return json({ correct: false, message: "That's not correct. Re-check your calculation and try again." });
  }

  // ── text + math → Claude judges correctness and writes the reply. ───────────────────────────
  const isMath = key.answerType === "math";
  let system = `You are an encouraging ${courseLabel} tutor grading a homework problem. The full problem and any figure are provided.\n\n` +
    (isMath
      ? `The student enters a math/LaTeX expression. Mark CORRECT if it is mathematically equivalent to the reference answer (accept any algebraically/notationally equivalent form, including reordered vector components, equivalent unit-vector notation like \\hat{i} vs \\mathbf{i} vs î, and equivalent magnitudes/directions). Reference answer (LaTeX, confidential): ${key.answer}`
      : `Grade the student's written answer GENEROUSLY — accept any answer that conveys the correct idea, even if informal or differently worded. Reference answer (confidential): "${key.answer}"`) +
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
  let text;
  try {
    text = await callClaude({ system, messages: [...history, { role: "user", content: contentWith(figureBlock, userText) }], maxTokens: 600 });
  } catch (err) {
    return json({ error: err?.message || "Grader error." }, 502);
  }
  const parsed = parseJsonReply(text, { status: "incorrect", message: text || "Can you elaborate a bit more?" });
  const correct = parsed.status === "correct";
  const out = {
    correct,
    message: parsed.message || (correct ? "✓ Correct." : "Not quite — try again."),
    _historyUser: userText,
    _historyAssistant: JSON.stringify(parsed),
  };
  if (!correct && phase === "reveal") out.revealedAnswer = String(key.answer);
  return json(out);
};

// Attach the figure image block (if any) to a Claude user message.
function contentWith(figureBlock, text) {
  return figureBlock ? [figureBlock, { type: "text", text }] : text;
}

// Call Claude directly (mirrors netlify/functions/claude.js — same CLAUDE_API_KEY, version, beta).
async function callClaude({ system, messages, maxTokens = 600 }) {
  const key = process.env.CLAUDE_API_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({ model: HW_MODEL, max_tokens: maxTokens, system, messages }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("The grader returned a non-JSON response."); }
  if (!res.ok || data?.error) throw new Error("Grader error: " + (data?.error?.message || `HTTP ${res.status}`));
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text.trim()) throw new Error("The grader returned an empty response (check that CLAUDE_API_KEY is set).");
  return text;
}
