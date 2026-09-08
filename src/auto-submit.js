// ── Auto-submission of homework at the deadline ───────────────────────────────
//
// Pure and env-agnostic, like `student-work.js` / `material-views.js`, so it can be tested with
// plain `node` (see auto-submit.test.mjs). Everything that touches the network lives in the
// caller; this module only decides WHO needs one and builds the record.
//
// The problem it solves is the funnel's third bucket (see AnalyticsPulse): a student who
// resolved every problem and never pressed "Finish & Submit" is recorded as *missing*, which is
// indistinguishable from a student who did nothing, and they are invisible until the grade is
// already a zero. So when a deadline passes over a draft with real work in it, that work is
// written down as a record of its own.
//
// WHAT THAT RECORD IS: A RECEIPT, NOT A GRADE. Handing in the written work is what makes a
// homework count — that rule does not bend for a late submission, and it must not bend for one
// the app made on the student's behalf, since nobody uploaded anything and the integrity check
// never ran. So the record is worth nothing in the gradebook until the work arrives. What it
// does instead is preserve two things that would otherwise be lost at midnight: the fact that
// there is finished work waiting to be claimed (which the student is told, in the one place they
// look at grades), and EXACTLY WHICH PARTS were finished on time — which is what lets those
// parts keep full credit when the student finally does hand in.
//
// Four rules follow from that.
//
// 1. IT IS NOT AN ENDING. The draft is deliberately NOT cleared and the assignment stays open;
//    the student comes back, finishes what they like, uploads their work and submits normally.
//    That single path is also how the record is redeemed, so there is no second upload UI.
//
// 2. THE PARTS DONE ON TIME KEEP FULL CREDIT. Every part in the record is stamped `onTime: true`.
//    When the real submission replaces it, `markOnTimeParts` carries those stamps across and the
//    late penalty is applied only to the parts NOT stamped (see `partIsOnTime` and
//    `scoreFromPartOverrides`, homework.js) instead of to the whole
//    score. Three of ten problems finished before the deadline and seven after is 3 + 7×0.5 =
//    6.5/10, not the 5.0 a whole-assignment halving would give. This is the entire payoff: the
//    student is never worse off for having started early, and never worse off for coming back.
//
// 3. IT COUNTS FOR NOTHING UNTIL THE WORK IS IN. The record carries `workPending: true`, and
//    `resolveScore` reports 0 while that stands — with the earned score kept as `base` so the
//    gradebook can show it struck through beside the enforced 0, exactly as it does for a lab
//    zeroed by the attendance policy. The student's grades row says what to do about it. The
//    instructor's escape hatch is the explicit `workReview: "accepted"` flag, mirroring
//    `attendanceWaived` and `integrityReview`. (This is deliberately STRICTER than the integrity
//    flag, which never withholds credit on its own: a flag is a suspicion about work that was
//    handed in, whereas this is work that was not.)
//
// 4. IT ONLY EVER LOOKS FORWARD. `AUTO_SUBMIT_SINCE` stops the first sweep after the deploy from
//    manufacturing records for every past-due draft left over from the whole term — work the
//    instructor has already graded as missing, and whose deadline nobody was watching.

// Deadlines before this date are never auto-submitted. Same purpose as `READ_TRACKING_SINCE`
// (announcements.js) and `MATERIAL_TRACKING_SINCE` (material-views.js): the feature must not
// rewrite history the first time it runs. It stops mattering once every live assignment is due
// after it.
export const AUTO_SUBMIT_SINCE = "2026-09-07";

// A submission's id is derived from the assignment, not from the clock, so a sweep that runs
// twice (the student's portal and the instructor's, or two tabs) writes the SAME key and is
// idempotent. Ids only need to be unique inside `submissions/{studentId}/`.
export const autoSubmitId = hwId => `auto_${hwId}`;

// Is this a record this module wrote?
export const isAutoSubmission = sub => !!(sub && sub.autoSubmitted);

// Does a submission CLOSE its assignment? An auto-submission does not, and this is what makes
// rule 1 real rather than a comment. Everywhere a student's own progress is read, "has a
// submission" is what turns a homework into finished work: it ticks the module list, drops the
// assignment off the To Do rail, and — the one that would break the feature outright — makes
// re-opening it launch in PRACTICE mode, where nothing can be submitted. So an auto-submission
// is deliberately not counted there: the score is banked, the assignment stays open, and the
// student can still finish it. The grades list is the deliberate exception — the row is where the
// student is told there is work waiting to be claimed and what to do about it.
export const closesAssignment = sub => !!sub && !isAutoSubmission(sub);

// A deadline is in scope only if it falls on or after the baseline. Parsed by hand rather than
// via `new Date(str)`, which reads a bare "YYYY-MM-DD" as UTC midnight and lands a day early
// west of Greenwich — the same trap `formatSessionDate` and `shortDate` avoid.
export function isTrackedDeadline(due, since = AUTO_SUBMIT_SINCE) {
  if (!due) return false;
  return String(due).slice(0, 10) >= String(since).slice(0, 10);
}

// The item ids a draft records as finished. "Finished" is `correct` or `revealed`, matching the
// runner's own `doneWeight` and the instructor-facing `hwProgress` node: this measures how far
// through the student got, not how much credit they earned, so a revealed answer still counts as
// a part they worked.
export function resolvedItems(draft) {
  const status = draft?.status;
  if (!status || typeof status !== "object") return [];
  return Object.entries(status)
    .filter(([, st]) => st === "correct" || st === "revealed")
    .map(([id]) => id);
}

// "Any part of it that's complete" — the whole entry condition. A draft holding only typed but
// unsubmitted text is not work that has been graded, so it has no score to bank and is left
// alone; the student's answers stay safe in the draft either way.
export const draftHasCompletedWork = draft => resolvedItems(draft).length > 0;

// Which (student, homework) pairs need an auto-submission right now.
//
// `dueFor(studentId, hwId)` must resolve the deadline AS IT APPLIES TO THAT STUDENT — an
// instructor's per-student extension (gradeOverrides[sid][hwId].dueDate, via `effectiveDue`)
// replaces the class date, and auto-submitting an extended student at the class deadline would
// take away the extension they were given.
//
// `hasDraftWork(studentId, hwId)` is the cheap prefilter: the instructor's sweep answers it from
// the tiny `hwProgress` node rather than reading `hwDrafts`, which carries every typed answer,
// every feedback string and the whole Claude history for every student. The draft itself is read
// only for the pairs that survive, and `draftHasCompletedWork` is the authoritative check.
export function pendingAutoSubmissions({ homeworks = [], studentIds = [], submissions = [], dueFor, hasDraftWork, now = new Date(), since = AUTO_SUBMIT_SINCE, dueToDate }) {
  const submitted = new Set();
  for (const sub of submissions || []) {
    if (sub?.studentId && sub?.quizId) submitted.add(`${sub.studentId}|${sub.quizId}`);
  }
  const out = [];
  for (const hw of homeworks) {
    if (!hw?.id) continue;
    for (const studentId of studentIds) {
      if (!studentId || submitted.has(`${studentId}|${hw.id}`)) continue;
      const due = dueFor ? dueFor(studentId, hw.id) : hw.dueDate;
      if (!isTrackedDeadline(due, since)) continue;
      const deadline = dueToDate(due);
      if (!deadline || now <= deadline) continue;
      if (hasDraftWork && !hasDraftWork(studentId, hw.id)) continue;
      out.push({ studentId, hwId: hw.id, due, deadline });
    }
  }
  return out;
}

// Build the submission record from a saved draft. Mirrors `HomeworkRunner`'s `buildSubmission`
// field for field — same breakdown shape, same rounding at the same levels — because the
// gradebook, the submission view, the per-part regrade and every analytics derivation read one
// shape and must not be able to tell these apart except by the flags that are meant to differ.
//
// `itemsOf` is passed in (from homework.js) rather than imported so this module stays free of the
// grading engine; `serverAnswers` is the caller's `revealHomeworkAnswers` result, so an
// unattempted numeric item still shows its key in the gradebook.
export function buildAutoSubmission({ homework, student, draft, telemetry = null, due, deadline, itemsOf, revealAnswerFor = () => null, graphicalTypes = new Set(["graph", "vector", "fbd"]), serverAnswers = {} }) {
  const problems = homework?.problems || [];
  const total = problems.length;
  const answers = draft?.answers || {};
  const attempts = draft?.attempts || {};
  const status = draft?.status || {};
  const earned = draft?.earned || {};
  const revealed = draft?.revealed || {};

  const allItems = problems.flatMap(itemsOf);
  const rawScore = parseFloat(allItems.reduce((sum, it) => sum + (earned[it.id] || 0), 0).toFixed(2));
  const pct = total > 0 ? rawScore / total : 0;
  // No late penalty: the work was done before the deadline and the record is stamped at it.
  const score = parseFloat((pct * 10).toFixed(2));

  const problemsBreakdown = problems.map(p => {
    const its = itemsOf(p);
    const partRows = its.map(it => ({
      id: it.id, prompt: it.prompt, answerType: it.answerType,
      studentAnswer: answers[it.id] || "", attempts: attempts[it.id] || 0,
      status: status[it.id] || "open", earned: parseFloat((earned[it.id] || 0).toFixed(3)),
      max: it.weight,
      // Finished before the deadline, by construction: this record is built FROM the deadline.
      // The stamp is the whole point of writing it down — `markOnTimeParts` carries it onto the
      // real submission, and `partIsOnTime` is what keeps these parts off the late penalty.
      ...(status[it.id] === "correct" || status[it.id] === "revealed" ? { onTime: true } : {}),
      correctAnswer: graphicalTypes.has(it.answerType) ? revealAnswerFor(it) : (revealed[it.id] ?? serverAnswers[it.id] ?? null),
      ...(it.answerType === "graph" ? { graph: it.graph } : {}),
      ...(it.answerType === "vector" ? { vector: it.vector } : {}),
      ...(it.answerType === "fbd" ? { fbd: it.fbd } : {}),
    }));
    const pEarned = parseFloat(partRows.reduce((s2, r) => s2 + r.earned, 0).toFixed(3));
    if (p.parts && p.parts.length) {
      return { id: p.id, prompt: p.prompt, figure: p.figure || null, parts: partRows, earned: pEarned, max: 1 };
    }
    return { ...partRows[0], id: p.id, prompt: p.prompt, figure: p.figure || null, max: 1, earned: pEarned };
  });

  const at = (deadline instanceof Date && !isNaN(deadline)) ? deadline.toISOString() : new Date().toISOString();
  return {
    id: autoSubmitId(homework.id),
    studentName: student?.fullName || "",
    studentId: student?.studentId,
    quizId: homework.id,
    quizTitle: homework.title,
    type: "homework",
    rawScore, nativeTotal: total, score, late: false,
    timestamp: at,
    problems: problemsBreakdown,
    workFiles: [],
    integrity: null,
    telemetry: telemetry || null,
    // Why this record exists, in the record. `resolved`/`totalItems` are what the banner shows,
    // so the instructor can see at a glance whether this is a finished set nobody handed in or
    // three problems out of fourteen.
    autoSubmitted: { at, due: due || null, resolved: resolvedItems(draft).length, totalItems: allItems.length },
    // No files were uploaded and no integrity check ran — see rule 3 above.
    workPending: true,
  };
}

// ── On-time credit ────────────────────────────────────────────────────────────

// Every part id the deadline record says was finished on time.
export function onTimeItemIds(previous) {
  const ids = new Set();
  if (!isAutoSubmission(previous)) return ids;
  for (const p of previous.problems || []) {
    for (const row of (p.parts || [p])) if (row?.onTime && row.id) ids.add(row.id);
  }
  return ids;
}

// Every part id the submission's OWN telemetry says was resolved before the deadline.
//
// The deadline record is the tidier evidence, but it only exists when the sweep happened to run
// while the draft was still open, and it cannot exist at all for work submitted before that
// sweep shipped. That made on-time credit depend on whether anyone opened a portal near
// midnight — the student who stays up to 1am and finishes is exactly the one nobody was there
// to sweep for. The telemetry snapshot rides on every real submission (`telemetrySnapshot`,
// HomeworkRunner) and stamps `resolvedAt` the moment an item is answered correctly or revealed,
// accumulated across sittings, so it carries the same fact and survives both gaps.
//
// `resolvedAt` is the student's own browser clock, so this is evidence rather than proof. That
// is acceptable because of the direction it can move a grade: it only ever REMOVES a penalty
// from an answer already graded correct, and can never add one or create credit.
export function onTimeIdsFromTelemetry(telemetry, deadline) {
  const ids = new Set();
  const at = deadline instanceof Date ? deadline : (deadline ? new Date(deadline) : null);
  if (!at || isNaN(at.getTime())) return ids;
  for (const [id, it] of Object.entries(telemetry?.items || {})) {
    const r = it?.resolvedAt ? new Date(it.resolvedAt) : null;
    if (r && !isNaN(r.getTime()) && r.getTime() <= at.getTime()) ids.add(id);
  }
  return ids;
}

// Stamp `onTime: true` onto every part named by `ids`, and record how many were stamped.
// The count is taken from the rows actually stamped, not from `ids.size`: an id set derived from
// telemetry can name items that are not in this submission's breakdown, and the banner reports
// what the student is being credited for.
export function stampOnTimeParts(sub, ids, at = null) {
  if (!sub || !ids || !ids.size) return sub;
  let parts = 0;
  const stamp = row => {
    if (!row?.id || !ids.has(row.id)) return row;
    parts += 1;
    return { ...row, onTime: true };
  };
  const problems = (sub.problems || []).map(p => (p.parts ? { ...p, parts: p.parts.map(stamp) } : stamp(p)));
  if (!parts) return sub;
  return { ...sub, problems, onTimeCredit: { at, parts } };
}

// Carry the deadline record's stamps onto the real submission that replaces it.
//
// This is what makes the whole thing worth doing. Without it a student who had 3 of 10 problems
// done at the deadline and finished the rest the next day is halved on all ten and scores 5.0 —
// punished on work that WAS done on time, and left better off having never started early. With
// it the penalty falls only on the parts not stamped (`scoreFromPartOverrides`, homework.js):
// 3 + 7×0.5 = 6.5.
//
// The caller re-scores afterwards through `scoreFromPartOverrides`, so the arithmetic lives in
// one place and an instructor's later per-part regrade goes through the same rule rather than
// silently dropping the on-time credit.
export function markOnTimeParts(sub, previous) {
  const ids = onTimeItemIds(previous);
  if (!sub || !ids.size) return sub;
  return stampOnTimeParts(sub, ids, previous.autoSubmitted?.at || previous.timestamp || null);
}

// ── Pending written work ──────────────────────────────────────────────────────

// The state of a deadline record's outstanding written work. A state object rather than a
// penalty, like `integrityState`, so every consumer reads one rule.
//   pending  — this record was written by the deadline sweep and no written work has arrived
//   review   — the instructor's decision: "accepted" (count it as it stands) or null
//   withheld — pending, and therefore worth nothing in the gradebook
//
// Deliberately stricter than `integrityState`, where a flag alone never withholds credit: a flag
// is a suspicion about work that WAS handed in, and this is work that was not. Handing in the
// written work is what makes a homework count, and that rule cannot bend for a record the app
// wrote on the student's behalf without becoming a way around it.
export function workPendingState(sub, ov) {
  const review = (ov && ov.workReview) || null;
  const pending = !!(sub && sub.workPending) && review !== "accepted";
  return { pending, review, withheld: pending };
}
