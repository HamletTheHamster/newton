// Deadline auto-submission of homework. Plain node, no framework:  node src/auto-submit.test.mjs
//
// Worth testing because every failure here is silently plausible and lands on a student's grade.
// A baseline that lets old deadlines through manufactures a term's worth of submissions for work
// the instructor already graded as missing. A missed per-student extension auto-submits exactly
// the students who were given more time, taking the extension away. A `late` flag set from the
// clock rather than the deadline halves the marks of the students this feature exists to protect.
// A per-part late penalty that loses its `onTime` stamps halves work that WAS done on time,
// leaving the student worse off for having started early — the exact thing this prevents. And a
// `closesAssignment` that answers "yes" locks the homework into practice mode, where nothing can
// be submitted at all — the feature would look like it worked and quietly do the opposite.
import assert from "node:assert";
import {
  AUTO_SUBMIT_SINCE, autoSubmitId, isAutoSubmission, closesAssignment, isTrackedDeadline,
  resolvedItems, draftHasCompletedWork, pendingAutoSubmissions, buildAutoSubmission,
  onTimeItemIds, markOnTimeParts, workPendingState, onTimeIdsFromTelemetry, stampOnTimeParts,
} from "./auto-submit.js";
import { itemsOf, resolveScore, partEarned, partIsOnTime, rescoreSubmission, onTimeCreditIds, scoreFromPartOverrides } from "./homework.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

// A two-problem homework: one single-part numeric, one two-part.
const HW = {
  id: "hw3", title: "Homework 3",
  problems: [
    { id: "p1", prompt: "Find v.", answerType: "numeric" },
    { id: "p2", prompt: "A block…", parts: [
      { id: "p2_a", prompt: "(a)", answerType: "numeric" },
      { id: "p2_b", prompt: "(b)", answerType: "text" },
    ] },
  ],
};
const STUDENT = { studentId: "s1", fullName: "Ada Lovelace" };
// Everything but p2_b resolved: 1 + 0.5 of 2 problems = 1.5/2 → 7.5/10.
const DRAFT = {
  answers: { p1: "9.81", p2_a: "4.0", p2_b: "half typed" },
  attempts: { p1: 1, p2_a: 2, p2_b: 1 },
  status: { p1: "correct", p2_a: "correct" },
  earned: { p1: 1, p2_a: 0.5 },
  idx: 1,
};
// The stored due-date shape, and the Date it means. Mirrors utils.js `dueToDate` closely enough
// for the selection logic under test; the app passes the real one in.
const dueToDate = due => {
  if (!due) return null;
  const m = String(due).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
};

// ── The baseline ──────────────────────────────────────────────────────────────

test("deadlines before the baseline are never swept", () => {
  // The first sweep after deploy must not invent submissions for the whole term behind it.
  assert.strictEqual(isTrackedDeadline("2026-08-01", "2026-09-07"), false);
  assert.strictEqual(isTrackedDeadline("2026-09-06 23:59", "2026-09-07"), false);
  assert.strictEqual(isTrackedDeadline("2026-09-07", "2026-09-07"), true);
  assert.strictEqual(isTrackedDeadline("2026-10-01 12:00", "2026-09-07"), true);
  assert.strictEqual(isTrackedDeadline(null, "2026-09-07"), false);
  assert.match(AUTO_SUBMIT_SINCE, /^\d{4}-\d{2}-\d{2}$/);
});

// ── What counts as work ───────────────────────────────────────────────────────

test("only graded-and-resolved items count as completed work", () => {
  assert.deepStrictEqual(resolvedItems(DRAFT).sort(), ["p1", "p2_a"]);
  // A revealed answer is still a part they worked, exactly as hwProgress counts it.
  assert.deepStrictEqual(resolvedItems({ status: { p1: "revealed" } }), ["p1"]);
  // Typed but never submitted is not work with a score to bank.
  assert.strictEqual(draftHasCompletedWork({ answers: { p1: "9.81" } }), false);
  assert.strictEqual(draftHasCompletedWork({ status: { p1: "open" } }), false);
  assert.strictEqual(draftHasCompletedWork(null), false);
  assert.strictEqual(draftHasCompletedWork(DRAFT), true);
});

// ── Who gets swept ────────────────────────────────────────────────────────────

const selectArgs = (over = {}) => ({
  homeworks: [{ ...HW, dueDate: "2026-09-10 23:59" }],
  studentIds: ["s1", "s2"],
  submissions: [],
  dueFor: (_sid, hwId) => ({ hw3: "2026-09-10 23:59" }[hwId]),
  hasDraftWork: () => true,
  now: new Date(2026, 8, 11, 8, 0),
  since: "2026-09-07",
  dueToDate,
  ...over,
});

test("a past deadline over a draft with work is swept, once per student", () => {
  const out = pendingAutoSubmissions(selectArgs());
  assert.deepStrictEqual(out.map(c => `${c.studentId}|${c.hwId}`), ["s1|hw3", "s2|hw3"]);
});

test("nothing is swept before the deadline", () => {
  assert.strictEqual(pendingAutoSubmissions(selectArgs({ now: new Date(2026, 8, 10, 22, 0) })).length, 0);
});

test("a student who already handed in is skipped", () => {
  const out = pendingAutoSubmissions(selectArgs({ submissions: [{ studentId: "s1", quizId: "hw3" }] }));
  assert.deepStrictEqual(out.map(c => c.studentId), ["s2"]);
});

test("a per-student extension is honored, not overridden", () => {
  // s2 was given until the 20th. Auto-submitting them on the 11th would take the extension away.
  const out = pendingAutoSubmissions(selectArgs({
    dueFor: (sid) => (sid === "s2" ? "2026-09-20 23:59" : "2026-09-10 23:59"),
  }));
  assert.deepStrictEqual(out.map(c => c.studentId), ["s1"]);
});

test("a draft with no completed work is filtered out before it is read", () => {
  const out = pendingAutoSubmissions(selectArgs({ hasDraftWork: sid => sid === "s1" }));
  assert.deepStrictEqual(out.map(c => c.studentId), ["s1"]);
});

test("the id is derived from the assignment, so a second sweep is idempotent", () => {
  assert.strictEqual(autoSubmitId("hw3"), "auto_hw3");
  assert.strictEqual(autoSubmitId("hw3"), autoSubmitId("hw3"));
});

// ── The record ────────────────────────────────────────────────────────────────

const build = (over = {}) => buildAutoSubmission({
  homework: HW, student: STUDENT, draft: DRAFT, itemsOf,
  due: "2026-09-10 23:59", deadline: new Date(2026, 8, 10, 23, 59),
  serverAnswers: { p1: "9.81 m/s^2", p2_b: "It doubles." },
  ...over,
});

test("the score is the resolved work, out of the whole assignment", () => {
  const sub = build();
  assert.strictEqual(sub.rawScore, 1.5);
  assert.strictEqual(sub.nativeTotal, 2);
  assert.strictEqual(sub.score, 7.5);
});

test("it is stamped at the deadline and is never late", () => {
  // Materialized the morning after, but the work was done before the deadline: halving it here
  // would punish exactly the student this feature exists to protect.
  const sub = build();
  assert.strictEqual(sub.late, false);
  assert.strictEqual(sub.timestamp, new Date(2026, 8, 10, 23, 59).toISOString());
  assert.strictEqual(sub.autoSubmitted.at, sub.timestamp);
  assert.strictEqual(sub.autoSubmitted.resolved, 2);
  assert.strictEqual(sub.autoSubmitted.totalItems, 3);
});

test("it is marked as owing written work, with no files and no integrity verdict", () => {
  const sub = build();
  assert.strictEqual(sub.workPending, true);
  assert.deepStrictEqual(sub.workFiles, []);
  assert.strictEqual(sub.integrity, null);
  assert.strictEqual(isAutoSubmission(sub), true);
});

test("every finished part is stamped on time, and nothing else is", () => {
  const sub = build();
  assert.deepStrictEqual([...onTimeItemIds(sub)].sort(), ["p1", "p2_a"]);
  assert.strictEqual(sub.problems[0].onTime, true);
  assert.strictEqual(sub.problems[1].parts[0].onTime, true);
  assert.strictEqual(sub.problems[1].parts[1].onTime, undefined);   // never resolved
  assert.strictEqual(onTimeItemIds({ id: "sub_1", problems: [] }).size, 0);
});

test("the breakdown matches the runner's shape, including unresolved parts", () => {
  const sub = build();
  assert.strictEqual(sub.type, "homework");
  assert.strictEqual(sub.quizId, "hw3");
  const [p1, p2] = sub.problems;
  assert.strictEqual(p1.id, "p1");
  assert.strictEqual(p1.status, "correct");
  assert.strictEqual(p1.earned, 1);
  assert.strictEqual(p1.correctAnswer, "9.81 m/s^2");
  assert.strictEqual(p2.parts.length, 2);
  // The part they never resolved is still on the record, with its typed answer and the key, so
  // the gradebook shows what they had and what it should have been.
  const b = p2.parts[1];
  assert.strictEqual(b.status, "open");
  assert.strictEqual(b.earned, 0);
  assert.strictEqual(b.studentAnswer, "half typed");
  assert.strictEqual(b.correctAnswer, "It doubles.");
  assert.strictEqual(p2.earned, 0.5);
});

// ── It does not close the assignment ──────────────────────────────────────────

test("an auto-submission does not close its assignment, a real one does", () => {
  assert.strictEqual(closesAssignment(build()), false);
  assert.strictEqual(closesAssignment({ id: "sub_1", quizId: "hw3" }), true);
  assert.strictEqual(closesAssignment(null), false);
});

// ── On-time parts keep full credit ───────────────────────────────────────────

// Ten one-point problems. `on` of them were finished before the deadline.
const TEN = { id: "hw9", title: "Homework 9", problems: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, prompt: "…", answerType: "numeric" })) };
const lateSubmission = (correct = 10) => ({
  id: "sub_9", quizId: "hw9", type: "homework", nativeTotal: 10, late: true,
  problems: TEN.problems.map((p, i) => ({ id: p.id, earned: i < correct ? 1 : 0, max: 1 })),
});
const deadlineRecord = on => buildAutoSubmission({
  homework: TEN, student: STUDENT, itemsOf,
  draft: {
    status: Object.fromEntries(TEN.problems.slice(0, on).map(p => [p.id, "correct"])),
    earned: Object.fromEntries(TEN.problems.slice(0, on).map(p => [p.id, 1])),
  },
  due: "2026-09-10 23:59", deadline: new Date(2026, 8, 10, 23, 59),
});

test("the late penalty applies part by part, never to on-time work", () => {
  // 3 finished on time, the other 7 the next day: 3 + 7 x 0.5 = 6.5. A whole-assignment halving
  // would give 5.0 and punish the student for the three they DID finish before the deadline.
  const merged = markOnTimeParts(lateSubmission(), deadlineRecord(3));
  assert.strictEqual(rescoreSubmission(merged), 6.5);
  assert.strictEqual(merged.onTimeCredit.parts, 3);
});

test("an ordinary late submission is still halved in full", () => {
  // Nothing was banked, so nothing is stamped, and the penalty behaves exactly as it always did.
  assert.strictEqual(rescoreSubmission(lateSubmission()), 5);
  assert.strictEqual(rescoreSubmission(markOnTimeParts(lateSubmission(), null)), 5);
  assert.strictEqual(rescoreSubmission(markOnTimeParts(lateSubmission(), { id: "x", score: 9 })), 5);
});

test("finishing nothing new still recovers the whole on-time score", () => {
  // The student comes back only to upload their work: every part they have is already on time.
  const merged = markOnTimeParts(lateSubmission(3), deadlineRecord(3));
  assert.strictEqual(rescoreSubmission(merged), 3);
});

test("an on-time submission is never penalized, stamps or not", () => {
  assert.strictEqual(rescoreSubmission({ ...lateSubmission(), late: false }), 10);
});

test("an instructor per-part regrade goes through the same rule", () => {
  assert.strictEqual(partEarned({ earned: 0.5 }, undefined), 0.5);
  assert.strictEqual(partEarned({ earned: 0 }, 1), 1);
  assert.strictEqual(partIsOnTime({ earned: 1, onTime: true }), true);
  assert.strictEqual(partIsOnTime({ earned: 1 }), false);
  // Regrading an on-time part to full credit gives full credit; a late one is still halved.
  const merged = markOnTimeParts(lateSubmission(0), deadlineRecord(3));
  const regraded = { ...merged, problems: merged.problems.map(r => ({ ...r, earned: 1 })) };
  assert.strictEqual(rescoreSubmission(regraded), 6.5);
});

test("a late submission that predates on-time stamps scores exactly as it always did", () => {
  // The penalty stays on the total for precisely this reason: no existing grade may move.
  const thirds = {
    type: "homework", nativeTotal: 2, late: true,
    problems: [
      { id: "a", parts: [{ id: "a1", earned: 0.333 }, { id: "a2", earned: 0.333 }, { id: "a3", earned: 0.333 }] },
      { id: "b", earned: 1 },
    ],
  };
  // Old formula: (round2(0.999) + round2(1)) / 2 * 10 * 0.5 = 2/2*10*0.5 = 5.
  assert.strictEqual(rescoreSubmission(thirds), 5);
});

// ── Pending written work, and what it does to the grade ───────────────────────

test("a record with no written work behind it counts for nothing", () => {
  // Handing in the written work is what makes a homework count. That rule does not bend for a
  // record the app wrote on the student's behalf, or it becomes the way around it.
  const sub = build();
  assert.deepStrictEqual(workPendingState(sub, {}), { pending: true, review: null, withheld: true });
  const r = resolveScore(sub, {});
  assert.strictEqual(r.effective, 0);
  assert.strictEqual(r.base, 7.5);       // what is waiting to be claimed, shown struck through
  assert.strictEqual(r.workPending, true);
});

test("the instructor can accept it without the work", () => {
  const sub = build();
  const r = resolveScore(sub, { workReview: "accepted" });
  assert.strictEqual(r.workPending, false);
  assert.strictEqual(r.workWithheld, false);
  assert.strictEqual(r.effective, 7.5);
});

test("a real submission is never pending, and excusing still wins", () => {
  const real = { type: "homework", score: 6, workFiles: [{ name: "p1.jpg" }] };
  assert.strictEqual(workPendingState(real, {}).pending, false);
  assert.strictEqual(resolveScore(real, {}).workPending, false);
  assert.strictEqual(resolveScore(real, {}).effective, 6);
  assert.strictEqual(resolveScore(build(), { excused: true }).effective, null);
});

// ── On-time credit derived from the submission's own telemetry ────────────────
//
// The deadline record only exists if the sweep ran while the draft was still open. The student
// who stays up until 1am and finishes is exactly the one nobody was there to sweep for, and no
// record can exist at all for work handed in before the sweep shipped. Telemetry's `resolvedAt`
// is the same fact from the student's own session, so it has to carry the same credit — getting
// this wrong halves work that was demonstrably finished on time and nothing on screen says so.

const DEADLINE = "2026-09-10 23:59";
const AT = new Date(2026, 8, 10, 23, 59);
// Telemetry for `on` of the ten problems resolved an hour before the deadline, the rest at 1am.
const teleFor = on => ({
  items: Object.fromEntries(TEN.problems.map((p, i) => [p.id, {
    resolvedAt: new Date(i < on ? AT.getTime() - 3600_000 : AT.getTime() + 3600_000).toISOString(),
  }])),
});

test("telemetry names the parts resolved before the deadline", () => {
  assert.deepStrictEqual([...onTimeIdsFromTelemetry(teleFor(3), AT)].sort(), ["q0", "q1", "q2"]);
  // An item never resolved carries no timestamp and earns nothing.
  assert.strictEqual(onTimeIdsFromTelemetry({ items: { q0: { resolvedAt: null } } }, AT).size, 0);
  // No deadline to compare against is not an excuse to hand out credit.
  assert.strictEqual(onTimeIdsFromTelemetry(teleFor(10), null).size, 0);
  assert.strictEqual(onTimeIdsFromTelemetry(teleFor(10), "not a date").size, 0);
  assert.strictEqual(onTimeIdsFromTelemetry(null, AT).size, 0);
});

test("a late submission keeps full credit on the parts telemetry proves were on time", () => {
  // Ben: 7 of 10 finished before the deadline, the rest at 1am. 7 + 3 x 0.5 = 8.5, not 5.0.
  const sub = { ...lateSubmission(), score: 5, telemetry: teleFor(7) };
  assert.strictEqual(resolveScore(sub, {}, null, DEADLINE).effective, 8.5);
  // Without the deadline nothing is derived, so every existing caller is unaffected: the stored
  // score (the old whole-assignment halving) is handed back untouched.
  assert.strictEqual(resolveScore(sub, {}).effective, 5);
});

test("the stored score is what stands when no part was on time", () => {
  const sub = { ...lateSubmission(), score: 5, telemetry: teleFor(0) };
  assert.strictEqual(resolveScore(sub, {}, null, DEADLINE).effective, 5);
  assert.strictEqual(onTimeCreditIds(sub, DEADLINE), null);
});

test("on-time credit is only ever read off a late homework", () => {
  assert.strictEqual(onTimeCreditIds({ ...lateSubmission(), late: false, telemetry: teleFor(7) }, DEADLINE), null);
  assert.strictEqual(onTimeCreditIds({ type: "quiz", late: true, telemetry: teleFor(7) }, DEADLINE), null);
  assert.strictEqual(onTimeCreditIds(null, DEADLINE), null);
});

test("the two kinds of evidence are unioned, never traded off", () => {
  // Stamps from the deadline record cover q0-q2; telemetry additionally proves q3 and q4.
  const stamped = markOnTimeParts({ ...lateSubmission(), telemetry: teleFor(5) }, deadlineRecord(3));
  assert.deepStrictEqual([...onTimeCreditIds(stamped, DEADLINE)].sort(), ["q0", "q1", "q2", "q3", "q4"]);
  assert.strictEqual(resolveScore(stamped, {}, null, DEADLINE).effective, 7.5);   // 5 + 5 x 0.5
  // A stamp still counts on its own when telemetry was never recorded.
  assert.strictEqual(resolveScore(markOnTimeParts(lateSubmission(), deadlineRecord(3)), {}, null, DEADLINE).effective, 6.5);
});

test("a per-student extension widens what counts as on time", () => {
  // The instructor extends Ben to 2am. Work he did at 1am is no longer late at all.
  const sub = { ...lateSubmission(), telemetry: teleFor(7) };
  const ov = { dueDate: new Date(2026, 8, 11, 2, 0).toISOString() };
  assert.strictEqual(resolveScore(sub, ov, null, ov.dueDate).effective, 10);
});

test("an instructor per-part regrade keeps the derived on-time credit", () => {
  // The regrade path and the plain path must not disagree about which parts were on time.
  const sub = { ...lateSubmission(0), telemetry: teleFor(3) };
  const ids = onTimeCreditIds(sub, DEADLINE);
  const partScores = Object.fromEntries(TEN.problems.map(p => [p.id, 1]));
  assert.strictEqual(scoreFromPartOverrides(sub, partScores, ids), 6.5);
  assert.strictEqual(resolveScore(sub, { partScores }, null, DEADLINE).effective, 6.5);
});

test("stamping counts the rows stamped, not the ids offered", () => {
  // A telemetry id for an item that is not in this breakdown must not inflate the banner.
  const stamped = stampOnTimeParts(lateSubmission(), new Set(["q0", "q1", "ghost"]), DEADLINE);
  assert.strictEqual(stamped.onTimeCredit.parts, 2);
  assert.strictEqual(stampOnTimeParts(lateSubmission(), new Set(["ghost"])).onTimeCredit, undefined);
  assert.strictEqual(stampOnTimeParts(lateSubmission(), new Set()).onTimeCredit, undefined);
});

test("a bare YYYY-MM-DD deadline means 11:59 PM Eastern, not UTC midnight", () => {
  // `new Date("2026-09-07")` is UTC midnight, i.e. 8 PM the PREVIOUS evening in Eastern — nearly
  // 28 hours before the real deadline. Reading the due date that way silently rejects work the
  // telemetry timestamped as on time, which is a penalty applied to a student who was not late.
  const AT_11PM = new Date(2026, 8, 7, 23, 8).toISOString();     // 11:08 PM ET on the due date
  const sub = {
    id: "sub_d", quizId: "hw1", type: "homework", nativeTotal: 2, late: true,
    problems: [{ id: "a", earned: 1, max: 1 }, { id: "b", earned: 1, max: 1 }],
    telemetry: { items: { a: { resolvedAt: AT_11PM } } },
  };
  const ids = onTimeCreditIds(sub, "2026-09-07");
  assert.deepStrictEqual([...ids], ["a"]);
  // 1 on time + 1 late halved, out of 2 = 7.5/10, not the 5.0 the whole-assignment halving gives.
  assert.strictEqual(resolveScore(sub, {}, null, "2026-09-07").effective, 7.5);
});

test("on-time credit never outranks an excusal, an absence or a whole-assignment override", () => {
  const sub = { ...lateSubmission(), telemetry: teleFor(7) };
  assert.strictEqual(resolveScore(sub, { excused: true }, null, DEADLINE).effective, null);
  assert.strictEqual(resolveScore(sub, {}, { absent: true, date: "2026-09-10" }, DEADLINE).effective, 0);
  assert.strictEqual(resolveScore(sub, { score: 4 }, null, DEADLINE).effective, 4);
});

console.log(`\nall passed (${passed})`);
