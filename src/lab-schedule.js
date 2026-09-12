// The term's lab sessions, and the one safe way to shorten the list once it has been seeded.
//
// Labs are the only graded category the app enumerates UP FRONT: a class is seeded with every
// lab session the term will hold, because a lab is not a thing the instructor builds in the app
// (there is nothing to author and no UI to add one) — it happens in a room, gets a mark typed
// into the gradebook, and gates lecture-absence credit through `attendance.js`. That means the
// seeded count IS the course's lab schedule, and a wrong count is wrong in three places at once:
// the gradebook's possible points, the lecture-absence policy, and the student's grade
// projection, which divides a slider over the labs it can see.
//
// Two sessions a week, for as many weeks as the course actually teaches. Midterm week holds no
// lab, so the count is the number of LECTURE weeks and not the length of the term: PHY 215 runs
// 13 lecture weeks with the midterm falling between weeks 6 and 7, which is 26 lab sessions.
//
// It is per course because the courses are not the same length — PHY 115 teaches 14 modules with
// its midterm after module 7 — and a course is far worse off with too FEW labs than too many:
// there is no UI to add a manual assignment, so a missing session cannot be recorded at all,
// while a surplus one only overstates the points left. So an unlisted course keeps the original
// 14, and shortening one is the deliberate act of naming it here.
const LAB_WEEKS_BY_COURSE = {
  physics2: 13,   // PHY 215 — 13 lecture weeks, midterm week between 6 and 7
};
export const DEFAULT_LAB_WEEKS = 14;
export const labWeeksFor = courseType => LAB_WEEKS_BY_COURSE[courseType] ?? DEFAULT_LAB_WEEKS;

// Labs are numbered CONSECUTIVELY (`Lab 1a`..`Lab 13b`) rather than by calendar week. Midterm
// week falls in a different place in each course, so week-aligned numbering would put the gap
// somewhere different per course and make "Lab 8a" the name of two different sessions; counting
// straight up keeps a lab number meaning the same thing everywhere, and for PHY 215 it lands
// back on the lecture week anyway, since the midterm week carries no lab to number.
const LAB_SESSIONS = ["a", "b"];
const LAB_ID_RE = /^asgn_lab(\d+)([ab])$/;

export const labId = (week, session) => `asgn_lab${week}${session}`;

// The seeded lab list. `order` starts at 2000 so labs sort after every module item and both
// exams (see the ordering note beside the seed in App.jsx).
export function labAssignments(weeks = DEFAULT_LAB_WEEKS) {
  const out = {};
  for (let w = 1; w <= weeks; w++) {
    for (const [i, sess] of LAB_SESSIONS.entries()) {
      const id = labId(w, sess);
      out[id] = { id, title: `Lab ${w}${sess}`, catId: "cat_lab", maxPts: 10, order: 2000 + (w - 1) * LAB_SESSIONS.length + i };
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY, AND MEANT TO BE DELETED. Everything from here to the end of the file is a ONE-TIME
// migration for classes seeded before the lab count was corrected, added 2026-09-12. It is the
// only code in the app that deletes an assignment out of a live gradebook, so it should not
// outlive the job: a class created from now on is seeded with the right number and can never
// need it.
//
// To remove it, once every existing class has been opened on a deployed build and no longer
// lists Lab 14a/14b:
//   1. delete `trimmableLabs` and this banner (LAB_ID_RE and labId go with it if nothing else
//      has picked them up);
//   2. in App.jsx, delete the `staleLabs` block in `loadClassData` and drop `trimmableLabs`
//      from the lab-schedule import (the `attendanceObj` hoist above it can stay - it is
//      harmless where it is, and moving it back is a needless diff);
//   3. delete the `trimmableLabs` half of src/lab-schedule.test.mjs, keeping the seeded-list
//      tests, and drop the phrase about it from the file header;
//   4. update the `src/lab-schedule.js` rows in CLAUDE.md and docs/key-files.md, and the note in
//      docs/courses/phy215.md.
// ─────────────────────────────────────────────────────────────────────────────

// Which stored labs run past the end of the term, and whether it is safe to delete them.
//
// Classes seeded before the count was corrected hold fourteen weeks of labs. Those two extra
// sessions cannot be removed by hand (a manual assignment has no delete control), so the load
// path trims them — and deleting an assignment out of a live gradebook is exactly the kind of
// write that must refuse rather than guess. Four conditions, and a single failing one cancels
// the whole trim rather than deleting the half it is sure about:
//
//   1. The stored labs are EXACTLY the seeded shape — sessions a and b for every week from 1 to
//      the last, nothing missing, nothing extra. A hand-edited list is not ours to tidy.
//   2. Nothing over the limit carries a grade record: no score, no excusal, no extension, no
//      integrity review, nothing under `gradeOverrides[student][labId]`. A mark already typed in
//      means that lab happened, whatever the schedule says, and the schedule is what is wrong.
//   3. No roll call links one (`attendance[date].labId`), since that link is what the absence
//      policy reads and a dangling id would zero a lab nobody can see.
//   4. There is something to remove at all.
//
// Condition 1 is also what makes this run once: after the trim the stored last week IS the limit,
// so there is nothing over it. A fourteenth week can only reappear through a deliberate code or
// database change, which is not something to defend against by refusing to clean up.
export function trimmableLabs(manualAssignments, { gradeOverrides = {}, attendance = {}, weeks = DEFAULT_LAB_WEEKS } = {}) {
  const byWeek = new Map();
  for (const [id, ma] of Object.entries(manualAssignments || {})) {
    const m = LAB_ID_RE.exec(id);
    if (!m || !ma) continue;
    const week = Number(m[1]);
    if (!byWeek.has(week)) byWeek.set(week, new Set());
    byWeek.get(week).add(m[2]);
  }
  if (!byWeek.size) return { remove: [], blocked: null };

  const lastWeek = Math.max(...byWeek.keys());
  for (let w = 1; w <= lastWeek; w++) {
    const sessions = byWeek.get(w);
    if (!sessions || sessions.size !== LAB_SESSIONS.length) return { remove: [], blocked: "the stored labs are not the seeded list" };
  }

  const over = [];
  for (const week of [...byWeek.keys()].sort((a, b) => a - b)) {
    if (week > weeks) for (const sess of LAB_SESSIONS) over.push(labId(week, sess));
  }
  if (!over.length) return { remove: [], blocked: null };

  const graded = over.filter(id => Object.values(gradeOverrides || {}).some(byAsgn => byAsgn && byAsgn[id] != null));
  if (graded.length) return { remove: [], blocked: `${graded.join(", ")} already carries a grade record` };

  const rolled = over.filter(id => Object.values(attendance || {}).some(sess => sess && sess.labId === id));
  if (rolled.length) return { remove: [], blocked: `${rolled.join(", ")} is linked to a roll call` };

  return { remove: over, blocked: null };
}
