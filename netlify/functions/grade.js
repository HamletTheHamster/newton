// Server-side homework grading endpoint for numeric / text / math problems. The answer key
// (netlify/functions/_answerKeys.js) is bundled into THIS function and never shipped to the
// browser, so students can't read answers from the client JS bundle. (The repo itself is public
// and this key is committed to it — a deliberate choice; see _answerKeys.js.) Graph /
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
//     attemptNum, phase, fullPrompt, figureBlock?, history?, diagramContext?, variant? }
//   { action: "reveal", courseType, hwId, items: [itemId | { id, hwId?, variant? }, …] }
//   { action: "hint",  courseType, hwId, itemId, fullPrompt, figureBlock?, studentAnswer?,
//     priorHints?, variant? }
//
// `variant` ({ problemId, seed }) marks an item served as a PARAMETERIZED instance - a study
// guide re-numbers the problems it draws from a student's weakest homework (src/hw-variants.js).
// The params are recomputed here from the seed and solved server-side, so the answer for a
// re-numbered problem never exists on the client any more than a committed one does.
import { resolveKey } from "./_variantSolvers.js";
import { courseLabelFor } from "../../src/course-meta.js";
import {
  numericMatch,
  angleMatch,
  parseNumber,
  formatNumeric,
  normalizeLatexForGrading,
  parseJsonReply,
  HINT_RULES,
  PLAIN_TEXT_RULE,
  DEFAULT_NUMERIC_TOL,
  GRADING_MODEL,
  GRADING_EFFORT,
  GRADING_TOKENS,
} from "../../src/grading-core.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = JSON.parse(await req.text()); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  // Course label only — ../../src/course-meta.js is content-free, so importing it does NOT pull
  // the course content (quizzes/modules/homeworks) into this function's bundle.
  const courseLabel = courseLabelFor(body.courseType);

  // ── reveal: return the correct answers for a set of items (used at final submit to populate the
  // gradebook key; post-submission so revealing is fine). Skips ids with no key entry. ──────────
  // A study guide's items come from several different homeworks at once, so each entry may carry
  // its own `hwId` and `variant`. A bare string still means "this homework, committed instance",
  // which is what every real homework sends.
  if (body.action === "reveal") {
    const out = {};
    for (const entry of body.items || []) {
      const itemId = typeof entry === "string" ? entry : entry?.id;
      if (!itemId) continue;
      const hwId = (typeof entry === "object" && entry.hwId) || body.hwId;
      const key = resolveKey(body.courseType, hwId, itemId, typeof entry === "object" ? entry.variant : null);
      if (!key) continue;
      out[itemId] = key.answerType === "numeric"
        ? formatNumeric(key.answer, key.sigFigs, key.unit, key.sci)
        : String(key.answer);
    }
    return json({ answers: out });
  }

  // ── hint: a hint asked for, rather than one earned by failing. ───────────────────────────────
  // A study guide gives as many hints per problem as the student wants (src/study-guide.js:
  // nothing there is graded, so rationing hints would only get in the way of the one thing a
  // study guide is for). That needs a path of its own: the `grade` action's hint phase is reached
  // only by submitting a wrong answer, so it cannot help a student who is stuck BEFORE they have
  // anything to submit, and it consumes an attempt on the way.
  //
  // `priorHints` is what makes a second press worth pressing: each hint is told what has already
  // been said and asked to go one step further, so a student who keeps asking is walked through
  // the method instead of being handed the same sentence again. HINT_RULES still forbids the
  // answer itself - the line is the ANSWER, not the method (see src/grading-core.js).
  if (body.action === "hint") {
    const key = resolveKey(body.courseType, body.hwId, body.itemId, body.variant);
    if (!key) return json({ error: `No answer key for ${body.hwId}/${body.itemId}.` }, 400);
    const prior = (Array.isArray(body.priorHints) ? body.priorHints : []).filter(Boolean);
    const answerLine = key.answerType === "numeric"
      ? `${key.answer}${key.unit ? " " + key.unit : ""}`
      : String(key.answer);
    const system = `You are an encouraging ${courseLabel} tutor helping a student work through a practice problem on a study guide. The full problem and any figure are provided.\n\nYou are given the correct answer ONLY so that you can aim your help at the right method - treat it as CONFIDENTIAL.\n\n` +
      (prior.length
        ? `You have already given this student ${prior.length} hint(s) on this problem, listed below. Give the NEXT step: go one concrete step further than the last hint rather than restating it. If the previous hints have already laid out the method, help them execute the next piece of it.\n\nHints already given:\n${prior.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
        : `Give the FIRST hint: name the principle or relationship this problem turns on and the first step to take with it. Do not work the problem out.`) +
      `\n\n${HINT_RULES}\n\nReply with ONLY the hint, one to three sentences, no preamble.`;
    const user = `Problem: ${body.fullPrompt || ""}\nCorrect answer (confidential): ${answerLine}` +
      (body.studentAnswer ? `\nWhat the student has entered so far: ${body.studentAnswer}` : `\nThe student has not entered anything yet.`);
    let text = "";
    try { text = await callClaude({ system, messages: [{ role: "user", content: contentWith(body.figureBlock || null, user) }] }); }
    catch (err) { return json({ error: err?.message || "Hint error." }, 502); }
    return json({ message: text.trim() || "Start from the relationship this chapter gives between the quantities you are told and the one you are asked for, and write it down before putting numbers in." });
  }

  if (body.action !== "grade") return json({ error: "Unknown action." }, 400);

  const key = resolveKey(body.courseType, body.hwId, body.itemId, body.variant);
  if (!key) return json({ error: `No answer key for ${body.hwId}/${body.itemId}.` }, 400);

  const { studentAnswer = "", phase, fullPrompt = "", figureBlock = null, diagramContext = null } = body;
  const history = Array.isArray(body.history) ? body.history : [];

  // ── Numeric: deterministic match (server owns the tolerance — never trust a client-sent one) ──
  if (key.answerType === "numeric") {
    const revealed = formatNumeric(key.answer, key.sigFigs, key.unit, key.sci);
    // This blank can't take a negative value (a magnitude, speed, distance, time, mass…), but
    // students routinely compute the signed quantity and type what they got — e.g. -2.72 μm for
    // a downward displacement whose direction the NEXT part asks for. That's a convention slip,
    // not a physics error, so nudge and don't burn an attempt. The message is identical whether
    // or not their value was right, so it leaks nothing and can't be used to probe.
    // `angle` items are exempt: there a negative is a correct coterminal answer, not a slip.
    if (key.nonNegative && !key.angle && parseNumber(studentAnswer) < 0) {
      return json({
        correct: false,
        retry: true,
        message: "This quantity can't be negative — enter it as a positive number. (This didn't count as an attempt.)",
      });
    }
    const tol = key.tolerance ?? DEFAULT_NUMERIC_TOL;
    const correct = key.angle
      ? angleMatch(studentAnswer, key.answer, tol)
      : numericMatch(studentAnswer, key.answer, tol);
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
      try { text = await callClaude({ system, messages: [{ role: "user", content: contentWith(figureBlock, user) }] }); }
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
  // "Do all your thinking silently" used to live here, for a model that did not think. On Opus
  // 5.5 the reasoning is in thinking blocks the client never reads, and a rule telling the model
  // not to think is one it cannot obey — the migration guide notes it raises tag leakage instead.
  // The requirement that SURVIVES is the shape of the reply: one JSON object, nothing around it.
  system += `\n\n${PLAIN_TEXT_RULE}\n\nReply with ONLY a single JSON object and nothing else — no preamble or text before or after it:\n- If correct: {"status":"correct","message":"1-2 sentences confirming what they got right"}\n- If incorrect: {"status":"incorrect","message":"${phase === "reveal" ? "state the correct answer and a one-line explanation" : phase === "hint" ? "one targeted hint about their likely mistake" : "one short Socratic nudge"}"}`;

  // Re-brace MathLive's compact \frac serialization so the grader reads the expression the
  // student actually sees rendered (see normalizeLatexForGrading). Only the copy sent to Claude
  // is normalized — the raw LaTeX stays on the draft and submission.
  const shownAnswer = isMath ? normalizeLatexForGrading(studentAnswer) : studentAnswer;
  const userText = `Problem: ${fullPrompt}\n\nStudent Answer: ${shownAnswer}`;
  let text;
  try {
    text = await callClaude({ system, messages: [...history, { role: "user", content: contentWith(figureBlock, userText) }] });
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
async function callClaude({ system, messages, maxTokens = GRADING_TOKENS, effort = GRADING_EFFORT }) {
  const key = process.env.CLAUDE_API_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({ model: GRADING_MODEL, max_tokens: maxTokens, output_config: { effort }, system, messages }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("The grader returned a non-JSON response."); }
  if (!res.ok || data?.error) throw new Error("Grader error: " + (data?.error?.message || `HTTP ${res.status}`));
  // A thinking model answers in `thinking` + `text` blocks; only the text blocks are the reply,
  // and a `thinking` block's own text is empty under the default display. Join by `.text` so
  // the reasoning never reaches the student and never lands in the stored feedback string.
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text.trim()) {
    // Distinguish the two ways a thinking model hands back nothing, because the fixes differ:
    // a budget that the thinking ate (raise GRADING_TOKENS) vs. a dead key or a refusal.
    if (data.stop_reason === "max_tokens") throw new Error(`The grader ran out of room (max_tokens ${maxTokens}) before it wrote an answer.`);
    throw new Error(`The grader returned an empty response (stop_reason ${data.stop_reason || "unknown"}; check that CLAUDE_API_KEY is set).`);
  }
  return text;
}
