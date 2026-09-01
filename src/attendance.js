// ── Attendance ────────────────────────────────────────────────────────────────
// Pure, env-agnostic helpers for the lecture-attendance record and the course policy
// that a student absent from lecture earns no credit for that day's lab.
//
// Storage shape — `classes/{classId}/attendance/{sessionId}`, sessionId = the date:
//   { date: "2026-09-08", labId: "asgn_lab2a" | null, takenAt: 1757…| null,
//     marks: { [studentId]: "present" | "absent" | "excused" } }
//
// Two invariants the rest of the app depends on:
//   1. `takenAt` gates everything. A session created but never taken zeroes nobody —
//      otherwise setting up next week's sessions in advance would silently zero the class.
//   2. An absence must be AFFIRMATIVE. A student with no entry in `marks` (added to the
//      roster after the roll was taken) is never zeroed; the History grid shows the gap
//      so it can be filled in.

export const ATT_PRESENT = "present";
export const ATT_ABSENT  = "absent";
export const ATT_EXCUSED = "excused";

// Cycle order for click-to-edit cells in the History grid.
export const ATT_CYCLE = [ATT_PRESENT, ATT_ABSENT, ATT_EXCUSED];

export const ATT_LABEL = {
  [ATT_PRESENT]: "Present",
  [ATT_ABSENT]:  "Absent",
  [ATT_EXCUSED]: "Excused",
};

// Single letter shown in the History grid.
export const ATT_SHORT = {
  [ATT_PRESENT]: "P",
  [ATT_ABSENT]:  "A",
  [ATT_EXCUSED]: "E",
};

export const ATT_COLOR = {
  [ATT_PRESENT]: "#4ade80",
  [ATT_ABSENT]:  "#f87171",
  [ATT_EXCUSED]: "#facc15",
};

// Sessions, oldest first. Tolerates a malformed node without throwing.
export function sessionList(attendance) {
  return Object.entries(attendance || {})
    .filter(([, sess]) => sess && typeof sess === "object")
    .map(([id, sess]) => ({ ...sess, id, date: sess.date || id, marks: sess.marks || {} }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// How many of the roster still have no status on this session. Save is blocked while > 0:
// every student is marked explicitly, so a saved session can never be a half-recorded one.
export function unmarkedCount(session, roster) {
  const marks = session?.marks || {};
  return (roster || []).filter(stu => !marks[stu.studentId]).length;
}

export function sessionCounts(session, roster) {
  const marks = session?.marks || {};
  const counts = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  for (const stu of (roster || [])) {
    const m = marks[stu.studentId];
    if (m === ATT_PRESENT || m === ATT_ABSENT || m === ATT_EXCUSED) counts[m]++;
    else counts.unmarked++;
  }
  return counts;
}

// { [studentId]: { [labId]: sessionDate } } — every affirmative absence from a TAKEN
// session that gates a lab. This is the whole input the grading path needs, so building it
// once per render keeps the per-cell lookup a plain object read.
export function buildAbsenceMap(attendance) {
  const map = {};
  for (const sess of sessionList(attendance)) {
    if (!sess.takenAt || !sess.labId) continue;
    for (const [studentId, mark] of Object.entries(sess.marks || {})) {
      if (mark !== ATT_ABSENT) continue;
      if (!map[studentId]) map[studentId] = {};
      map[studentId][sess.labId] = sess.date;
    }
  }
  return map;
}

// The `attendance` argument to resolveScore: { absent, date } when the course policy applies
// to this student/assignment pair, else null.
export function attendanceFor(absenceMap, studentId, assignmentId) {
  const date = absenceMap?.[studentId]?.[assignmentId];
  return date ? { absent: true, date } : null;
}

// Labs already gated by another session, so the lab picker can't silently double-link.
// { [labId]: sessionId }
export function labLinkMap(attendance) {
  const map = {};
  for (const sess of sessionList(attendance)) {
    if (sess.labId) map[sess.labId] = sess.id;
  }
  return map;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// "2026-09-08" → "Sep 8". Parsed by hand, never `new Date(str)`, which reads a bare
// date-only string as UTC midnight and lands on the previous day west of Greenwich.
export function formatSessionDate(date, { withYear = false, weekday = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!m) return String(date || "");
  const [, y, mo, d] = m;
  const base = `${MONTHS[+mo - 1] || mo} ${+d}`;
  const head = weekday
    ? `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(+y, +mo - 1, +d).getDay()]} `
    : "";
  return `${head}${base}${withYear ? `, ${y}` : ""}`;
}

// Today as "YYYY-MM-DD" in LOCAL time (toISOString would be UTC, and after 8pm ET that is
// already tomorrow's date — the wrong session id for an evening class).
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
