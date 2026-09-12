// The term's lab sessions.
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

const labId = (week, session) => `asgn_lab${week}${session}`;

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
