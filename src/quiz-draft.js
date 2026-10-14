// ── The storage shape of an in-progress quiz sitting ──────────────────────────
//
// Pure and env-agnostic, like `student-work.js` beside it, so it can be tested with plain
// `node` (see quiz-draft.test.mjs).
//
// WHY THIS EXISTS. Homework has had a draft since it shipped; a quiz did not. The whole sitting
// lived in `App.jsx` component state — `messages`, `qIdx`, `qScores`, `apiHist`, `attemptCount`,
// `completedParts`, and the half-typed `input` — and nothing wrote any of it anywhere. A reload
// therefore cost the student the entire attempt, not merely the sentence in the box: every
// question they had already answered and had graded went with it, and they restarted at
// question 1. The stale-build notice makes that reload involuntary and unskippable, so on
// 2026-10-13 a deploy could take a sitting away from a student mid-quiz, under a modal that
// told them "Your work is saved."
//
// HOW IT DIFFERS FROM THE HOMEWORK DRAFT, and why.
//
//   • A homework draft is a set of per-ITEM maps, because a student answers homework items in
//     any order across days. A quiz is a TRANSCRIPT — strictly append-only, one question at a
//     time — so the draft is the message list plus the few cursors that say where in it we are.
//     The stored message shape is deliberately the SAME one a submission's `dialogue` already
//     uses, so `ChatMessages` renders a restored sitting with no new code and no second
//     serialization to keep in step.
//
//   • A homework draft survives EVERY exit, including a deliberate one. A quiz draft survives
//     an involuntary exit (reload, crash, a phone reclaiming the page, the stale-build notice)
//     and is DELETED on a deliberate one. That is not an oversight: the quiz's leave dialog
//     has always said "Your progress will be lost and this attempt will not be saved", and a
//     student may legitimately rely on it to abandon a bad start. Keeping the draft through
//     that exit would silently convert quizzes into resumable work — a change to how the course
//     assesses, not a fix for lost work — and would hand back a sitting the student was told
//     they had discarded. See `confirmLeave` in App.jsx, which clears it.
//
// WRITE DISCIPLINE (CLAUDE.md § Write discipline). Two sessions of one student are routine and
// there is no realtime listener, so nothing here may be written as a whole-object PUT built
// from local state. Every function below emits DEEP-PATH keys for a PATCH, and emits no nulls:
// a null here would be a stale session pruning a turn it had simply never seen.

// The lists that make up a sitting, each stored under its own index. They are append-only in
// the runner (`setMessages([...messages, next])` everywhere; `advanceOrFinish` appends the next
// question), which is what makes an index-keyed patch additive rather than merely tidy.
// `qScores` is the one exception — it is index-ASSIGNED (`nScores[qIdx] = earned`) — but it is
// still only ever written at an index whose question has just been settled, so it never needs
// to erase an index another session wrote.
export const QUIZ_DRAFT_LISTS = ["messages", "apiHist", "qScores", "completedParts"];

// The cursors. `input` is the half-typed answer the box is holding, which is the thing a
// student notices losing first even though it is the smallest part of what was at risk.
export const QUIZ_DRAFT_SCALARS = ["qIdx", "attemptCount", "input", "awaitingJustification"];

// Drop what cannot survive the document that made it.
//
// `imageUrl` on a user message is the preview of a drawing they uploaded. It is a data: URL
// holding the whole compressed image, so storing it would put a few hundred KB of base64 into
// the draft and re-send it on every turn. The submission path already strips exactly this field
// for the same reason (`finishQuiz`), so a restored sitting is no poorer than the saved record
// of one: the answer, the grading and the tutor's reply all survive, the thumbnail does not.
export function sanitizeMessages(messages) {
  return (messages || [])
    .filter(m => m && typeof m === "object")
    .map(({ imageUrl, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

// Is there anything in this sitting worth saving? Opening a quiz and leaving immediately must
// not create a node: the first message is the question the runner posed, which the student had
// no hand in. So a sitting counts as work once the student has answered something, scored
// something, or typed something.
export function quizDraftHasWork(state) {
  if (!state) return false;
  if ((state.messages || []).length > 1) return true;
  if ((state.qScores || []).some(v => v != null)) return true;
  if ((state.completedParts || []).length) return true;
  if (state.attemptCount > 0) return true;
  if ((state.input || "").trim()) return true;
  return false;
}

// The deep-path patch that saves a sitting: one key per list entry, plus the cursors.
//
// Every index is rewritten on every save rather than only the new ones. That is deliberate and
// it is what `buildDraftPatch` does for homework: it costs a re-send of a transcript that is at
// most a few dozen short objects, and in exchange a save that failed earlier is repaired by the
// next one instead of leaving a permanent hole in the middle of the student's quiz.
//
// A null or undefined entry is SKIPPED, never emitted. `qScores` starts life as
// `new Array(n).fill(null)`, so emitting it faithfully would mean sending a null for every
// unanswered question — which in a PATCH is a delete, i.e. precisely the stale-session prune
// the no-nulls rule exists to forbid. `readQuizDraft` puts those holes back as nulls on the way
// out, where they are local state's business and not the database's.
export function buildQuizDraftPatch(state, now = new Date().toISOString()) {
  const patch = { savedAt: now };
  for (const field of QUIZ_DRAFT_SCALARS) {
    const value = state?.[field];
    if (value === undefined || value === null) continue;
    patch[field] = value;
  }
  for (const field of QUIZ_DRAFT_LISTS) {
    const list = field === "messages" ? sanitizeMessages(state?.messages) : state?.[field];
    if (!Array.isArray(list)) continue;
    list.forEach((value, i) => {
      if (value === undefined || value === null) return;
      patch[`${field}/${i}`] = value;
    });
  }
  return patch;
}

// The patch for the typing autosave, which is the only save that runs while the student is
// mid-sentence. It carries the box and nothing else: typing changes no turn of the transcript,
// so re-sending the transcript on a 1.2s debounce would be pure waste on a phone connection.
export function buildQuizInputPatch(input, now = new Date().toISOString()) {
  return { input: input || "", savedAt: now };
}

// Read one of the stored lists back.
//
// RTDB has no arrays. It returns a dense list from index 0 as a JSON array, and ANY other shape
// — a list whose first entries are missing, which is exactly what `qScores` becomes once the
// no-nulls rule above has skipped the unanswered questions — as an OBJECT with numeric string
// keys. Both shapes must come back as the same array, and the keys must be ordered NUMERICALLY:
// read as strings, "10" sorts before "2", which would hand the student their quiz with the
// turns shuffled and their answers under the wrong questions.
function toList(node) {
  if (Array.isArray(node)) return node.slice();
  if (!node || typeof node !== "object") return [];
  const out = [];
  for (const key of Object.keys(node).map(Number).filter(n => Number.isInteger(n) && n >= 0).sort((a, b) => a - b)) {
    out[key] = node[String(key)];
  }
  return out;
}

// Rehydrate a stored sitting into the state the runner holds.
//
// `questionCount` pads `qScores` back to one slot per question: the runner does
// `const nScores = [...qScores]; nScores[qIdx] = earned`, and the final score is a reduce over
// the whole array, so a short array would silently drop the tail of the quiz from the total.
// Holes become `null`, which is what an unanswered question has always been.
//
// `messages` is COMPACTED rather than padded. A hole there can only come from a half-written
// save, and `ChatMessages` maps over the list — an `undefined` in the middle would throw and
// take the whole screen down, which is a worse answer to a partial write than a missing turn.
export function readQuizDraft(stored, questionCount = 0) {
  if (!stored || typeof stored !== "object") return null;
  const messages = toList(stored.messages).filter(m => m && typeof m === "object");
  const apiHist = toList(stored.apiHist).filter(m => m && typeof m === "object");
  const completedParts = toList(stored.completedParts).filter(p => p && typeof p === "object");
  const scores = toList(stored.qScores);
  const qScores = Array.from({ length: Math.max(questionCount, scores.length) },
    (_, i) => (scores[i] === undefined ? null : scores[i]));
  return {
    messages,
    apiHist,
    completedParts,
    qScores,
    qIdx: Number.isInteger(stored.qIdx) ? stored.qIdx : 0,
    attemptCount: Number.isInteger(stored.attemptCount) ? stored.attemptCount : 0,
    input: typeof stored.input === "string" ? stored.input : "",
    awaitingJustification: stored.awaitingJustification === true,
    savedAt: stored.savedAt || null,
  };
}

// Is a stored sitting worth restoring? A node can legitimately exist with nothing in it (the
// typing autosave fires on a box the student then empties), and restoring one would replace a
// freshly posed question 1 with an empty transcript — a blank quiz screen.
export function restorableQuizDraft(stored, questionCount = 0) {
  const draft = readQuizDraft(stored, questionCount);
  if (!draft || !draft.messages.length) return null;
  return quizDraftHasWork(draft) ? draft : null;
}

// Apply a patch the way RTDB's PATCH does, so a test can assert what a second session actually
// ends up with. Not used by the app: RTDB does this server-side. Mirrors `applyDraftPatch`.
export function applyQuizDraftPatch(stored, patch) {
  const next = JSON.parse(JSON.stringify(stored || {}));
  for (const [key, value] of Object.entries(patch || {})) {
    const parts = key.split("/");
    let node = next;
    for (const part of parts.slice(0, -1)) {
      if (!node[part] || typeof node[part] !== "object") node[part] = {};
      node = node[part];
    }
    const leaf = parts[parts.length - 1];
    if (value === null) delete node[leaf];
    else node[leaf] = value;
  }
  return next;
}
