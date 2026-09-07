// Which roster entries are actually STUDENTS — pure and env-agnostic, like `material-views.js`.
//
// An instructor sits on their own roster. It is the only way to walk an assignment the way a
// student walks it (the homework runner reads `loggedInStudent` for drafts, attempt counts, the
// work upload and the submission), and it is how a new set gets checked before a class opens it.
// That entry then behaves like a student in every respect: it submits, it accumulates telemetry,
// it opens materials, it can be marked absent. None of that is coursework, and in a class of two
// dozen none of it is noise either. One extra entry moves an r, a class average, an open rate, a
// grade distribution and a funnel bucket, and it adds a row to the gradebook, a name to the
// attendance roll and a line to the Blackboard export that no registrar has ever heard of.
//
// So exactly one roster entry per class may be marked **`instructorAccount: true`** — chosen from
// a single picker above the roster table, never a control repeated on every student's row, since
// the fact being recorded is "which one of these is me" and not a property each student has.
// It is one more optional roster field beside `altName` / `nicknameLocked`, so there is no new
// RTDB node and no rules change, and it travels with the roster through backup and restore.
//
// THREE THINGS THIS IS NOT.
//
//   • It is not a write-side switch. The marked account still writes submissions, telemetry,
//     drafts and material views exactly like a student, because exercising those paths is the
//     entire point of having it. Nothing is deleted and nothing is hidden from the account
//     itself: it still appears on the student login picker, still sits its own homework, and
//     still sees its own grades.
//   • It is not "hide this student". A real student must never end up here, so the flag is only
//     ever set by picking a name, absent means counted, and an explicit `false` counts too.
//   • It is not a grading policy. Where the roster means "people who can log in" (the student
//     picker) or "people to email" (an announcement broadcast), the full roster is still the
//     right list. This filters only the places the roster means "the students I am assessing".

export function isInstructorAccount(entry) {
  return !!(entry && entry.instructorAccount);
}

// The roster as the instructor-facing class views should see it: the gradebook, the analytics,
// the assignments hub's progress column and the attendance roll.
export function studentRoster(roster = []) {
  return (roster || []).filter(r => !isInstructorAccount(r));
}

// The entry marked as the instructor's own, or null. There is at most one per class (the picker
// clears the previous one before setting the new), but a hand-edited backup could carry several,
// so this answers with the first and `studentRoster` drops all of them.
export function instructorAccountOf(roster = []) {
  return (roster || []).find(isInstructorAccount) || null;
}

// The ids that count. Everything below is scoped against this set, so "marked as the instructor"
// and "no longer on the roster at all" collapse into one rule: App.jsx flattens whole per-class
// nodes without consulting the roster, so a removed or never-enrolled student's work survives in
// `submissions` / `hwTelemetry` / `materialViews` long after the Gradebook (which iterates the
// roster) has stopped showing them.
export function studentIds(roster = []) {
  return new Set(studentRoster(roster).map(r => r.studentId));
}

// A flat submissions list, scoped. Takes the id set rather than the roster so a caller that
// scopes several nodes builds it once.
export function scopeSubmissions(submissions = [], ids) {
  return (submissions || []).filter(sub => ids.has(sub.studentId));
}

// Any `{ [studentId]: … }` node (hwTelemetry, hwProgress, materialViews), scoped. Returns a new
// object; the input is never mutated, and the values are shared by reference (this scopes a read,
// it does not clone a tree).
export function scopeByStudent(node, ids) {
  const out = {};
  Object.entries(node || {}).forEach(([studentId, v]) => { if (ids.has(studentId)) out[studentId] = v; });
  return out;
}
