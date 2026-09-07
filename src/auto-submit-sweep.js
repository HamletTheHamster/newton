// ── The deadline sweep ────────────────────────────────────────────────────────
//
// The impure half of `auto-submit.js`: it reads the drafts, calls the reveal endpoint, and hands
// finished submission records back to the caller to persist. All the decisions live in the pure
// module; this file is the plumbing, so what needs testing stays testable with plain `node`.
//
// There is no cron and no server-side Firebase credential — every RTDB write in this app is made
// by a signed-in browser — so the sweep is LAZY: it runs when a session that would care opens the
// class. Two callers, deliberately different in scope:
//
//   • the student's own portal, over their own drafts, so their grades page stops showing the
//     assignment as missing the next time they log in;
//   • the instructor's portal, over the whole class, which is the one that matters — it is
//     guaranteed to have run before the instructor ever looks at a grade.
//
// Both write the same deterministic key (`autoSubmitId`), so running twice is idempotent: the
// second sweep finds the submission and skips the pair entirely.
//
// The instructor's pass must NOT read `hwDrafts` wholesale — that node carries every typed
// answer, every feedback string and the whole Claude history for every student × assignment, and
// the rest of the instructor side goes out of its way never to load it (see `ProgressCell`). So
// candidates are found in the tiny `hwProgress` node (`{ done, total, pct }` per pair) and only
// the drafts that survive that filter are read.
import { fbGet, classPath } from "./firebase.js";
import { dueToDate } from "./utils.js";
import { itemsOf, revealAnswerFor, revealHomeworkAnswers } from "./homework.js";
import { pendingAutoSubmissions, draftHasCompletedWork, buildAutoSubmission } from "./auto-submit.js";

const GRAPHICAL = new Set(["graph", "vector", "fbd"]);

// Read `hwProgress` and turn it into the cheap `hasDraftWork(studentId, hwId)` prefilter.
// `done > 0` is written by the same chokepoint as the draft and means at least one item is
// resolved, which is exactly the entry condition — but it is only a hint here: the draft itself
// is re-checked with `draftHasCompletedWork` before anything is built.
async function progressFilter(classId, studentId) {
  const path = studentId ? `hwProgress/${studentId}` : "hwProgress";
  let node = null;
  try { node = await fbGet(classPath(classId, path)); } catch { return null; }
  if (!node || typeof node !== "object") return () => false;
  const byStudent = studentId ? { [studentId]: node } : node;
  return (sid, hwId) => {
    const row = byStudent?.[sid]?.[hwId];
    return !!(row && typeof row === "object" && (row.done || 0) > 0);
  };
}

// Run one sweep. Returns the submissions it built — the caller persists them (through App.jsx's
// `addSubmission`, so local state and the class cache stay in step) and reports what happened.
//
//   classId      the class to sweep
//   courseType   for the reveal endpoint
//   homeworks    the course's homework list, already carrying `dueDate`
//   students     roster entries to consider ([the one student] on the student side)
//   submissions  what is already handed in, so a pair is never swept twice
//   dueFor       (studentId, hwId) → the deadline AS IT APPLIES TO THAT STUDENT, so a per-student
//                extension is honored rather than overridden
export async function runAutoSubmitSweep({ classId, courseType, homeworks = [], students = [], submissions = [], dueFor, now = new Date() }) {
  if (!classId || !homeworks.length || !students.length) return [];
  const byId = new Map(students.filter(s => s?.studentId).map(s => [s.studentId, s]));
  const single = byId.size === 1 ? [...byId.keys()][0] : null;

  const hasDraftWork = await progressFilter(classId, single);
  if (!hasDraftWork) return [];

  const candidates = pendingAutoSubmissions({
    homeworks, studentIds: [...byId.keys()], submissions,
    dueFor, hasDraftWork, now, dueToDate,
  });
  if (!candidates.length) return [];

  // The correct answers are per-assignment, not per-student, so fetch each homework's key once
  // however many students it covers. Best-effort: a failed reveal only leaves the gradebook key
  // blank for unattempted items, which is not a reason to skip banking a student's score.
  const answerCache = new Map();
  const answersFor = async hw => {
    if (answerCache.has(hw.id)) return answerCache.get(hw.id);
    const ids = (hw.problems || []).flatMap(itemsOf).filter(it => !GRAPHICAL.has(it.answerType)).map(it => it.id);
    const p = revealHomeworkAnswers({ courseType, hwId: hw.id, itemIds: ids }).catch(() => ({}));
    answerCache.set(hw.id, p);
    return p;
  };

  const built = [];
  for (const c of candidates) {
    const hw = homeworks.find(h => h.id === c.hwId);
    const student = byId.get(c.studentId);
    if (!hw || !student) continue;
    let draft = null, telemetry = null;
    try {
      [draft, telemetry] = await Promise.all([
        fbGet(classPath(classId, `hwDrafts/${c.studentId}/${hw.id}`)),
        fbGet(classPath(classId, `hwTelemetry/${c.studentId}/${hw.id}`)).catch(() => null),
      ]);
    } catch { continue; }
    // The authoritative check. `hwProgress` is derived and could in principle be stale; the draft
    // is the work, so nothing is banked on a draft that turns out to hold none.
    if (!draftHasCompletedWork(draft)) continue;
    built.push(buildAutoSubmission({
      homework: hw, student, draft, telemetry,
      due: c.due, deadline: c.deadline,
      itemsOf, revealAnswerFor, graphicalTypes: GRAPHICAL,
      serverAnswers: await answersFor(hw),
    }));
  }
  return built;
}
