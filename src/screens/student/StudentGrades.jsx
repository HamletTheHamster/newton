import { useEffect, useState } from "react";
import { useTheme } from "../../theme.js";
import { fbGet, classPath } from "../../firebase.js";
import { buildGradebookAssignments, calcGrades, dueToDate, effectiveDue } from "../../utils.js";
import { resolveScore } from "../../homework.js";
import { SubViewModal } from "../../components/SubmissionView.jsx";
import { categoryColor } from "../../category-colors.js";
import { splitRemaining, overallColor, overallLetter } from "../../grade-scenarios.js";
import { GradeScenario } from "./GradeScenario.jsx";
import { buildAbsenceMap, attendanceFor, formatSessionDate } from "../../attendance.js";
import { closesAssignment } from "../../auto-submit.js";

// The what-if panel is BUILT AND TESTED but not yet shown to students: it is worth the most late
// in a term, when there is a real spread of marks behind it and the work still ahead is the thing
// a student is actually weighing. Flip this to true to unveil it. It is a flag rather than
// commented-out code or a deleted call site so the wiring stays live and cannot rot in the
// meantime — the props below are the real ones, and `node src/grade-scenarios.test.mjs` still
// guards the projection. See src/screens/student/GradeScenario.jsx.
const SHOW_GRADE_SCENARIOS = false;

// By percentage, not raw points: exams are out of 100 and everything else out of 10, so an
// 85 and an 8.5 have to read the same green.
function scoreColor(score, maxPts, excused, missing, muted) {
  if (excused || missing) return muted;
  const pct = (maxPts || 10) > 0 ? (score / (maxPts || 10)) * 100 : 0;
  if (pct >= 80) return "#4ade80";
  if (pct >= 60) return "#facc15";
  if (pct >= 40) return "#fb923c";
  return "#f87171";
}

export function StudentGrades({ classId, loggedInStudent, modules, quizzes, submissions, gradeCategories, gradeOverrides, assignmentCategories, manualAssignments, attendance, dueDates, assignmentNameOverrides }) {
  const { s, text, muted, border, teal } = useTheme();
  const myId = loggedInStudent?.studentId;
  const [viewSub, setViewSub] = useState(null);  // { submission, title, id } — opens read-only SubViewModal
  // This student's own homework progress ({ [hwId]: { done, total, pct } }), read on demand like
  // every other per-student node. It is what tells a student their unfinished homework is still
  // claimable, and it is read HERE rather than taken from a deadline record because the deadline
  // sweep is lazy (src/auto-submit-sweep.js): if nobody's portal happened to open after the
  // deadline there is no record, and the student would be told nothing at all while the row
  // showed a zero. The draft's progress summary always exists, so the notice always appears.
  const [myProgress, setMyProgress] = useState(null);   // null while loading, {} when there is none
  useEffect(() => {
    if (!classId || !myId) { setMyProgress({}); return; }
    let cancelled = false;
    fbGet(classPath(classId, `hwProgress/${myId}`))
      .then(r => { if (!cancelled) setMyProgress(r || {}); })
      .catch(() => { if (!cancelled) setMyProgress({}); });
    return () => { cancelled = true; };
  }, [classId, myId]);

  // Only show non-hidden items in the student view
  const visibleModules = (modules || []).map(mod => ({
    ...mod,
    items: (mod.items || []).filter(it => !it._hidden),
  }));

  const allAssignments = buildGradebookAssignments(visibleModules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, {}, dueDates);

  const myOverrides = gradeOverrides[myId] || {};
  // Only count assignments the student has attempted or whose due date has passed.
  // Manual assignments (exams, labs) are the exception: there is no submission to detect and
  // scores are entered by hand days after the date, so they appear only once a score or an
  // excusal exists. Showing them earlier would park a phantom zero on the student's grade.
  const submittedIds = new Set((submissions || []).filter(s => s.studentId === myId).map(s => s.quizId));
  const now = new Date();
  // An absence is a third way a manual row becomes real: the lecture-attendance policy fixes
  // that lab at 0 whether or not it has been marked yet, so waiting for a score would hide a
  // grade the student already has. Shown only once the roll call is taken (buildAbsenceMap).
  const myAbsences = buildAbsenceMap(attendance)[myId] || {};
  const assignments = allAssignments.filter(a =>
    a.type === "manual"
      ? myOverrides[a.id]?.score != null || !!myOverrides[a.id]?.excused
        || (myAbsences[a.id] && !myOverrides[a.id]?.attendanceWaived)
      : submittedIds.has(a.id) || (a.dueDate && dueToDate(a.dueDate) < now)
  );

  const scores = {};
  const excused = {};
  const absentOn = {};   // { [assignmentId]: sessionDate } — labs zeroed by the attendance policy
  const workPending = {};// { [assignmentId]: { zeroed } } — auto-submitted, written work still owed
  const absenceMap = { [myId]: myAbsences };
  for (const a of assignments) {
    const ov = myOverrides[a.id];
    const sub = (submissions || []).find(s => s.studentId === myId && s.quizId === a.id);
    // Shared resolver: whole-assignment override > per-part overrides > submission score,
    // then the upheld-integrity penalty — identical to the instructor Gradebook so what the
    // instructor sets is exactly what the student sees here. A flag alone never withholds credit.
    const r = resolveScore(sub, ov, attendanceFor(absenceMap, myId, a.id), effectiveDue(a.dueDate, ov?.dueDate));
    if (r.excused) { excused[a.id] = true; continue; }
    if (r.absentZero) absentOn[a.id] = myAbsences[a.id];
    // An auto-submission still owing its written work is the one row a student has to act on:
    // the work is saved and waiting, but it scores 0 until the handwritten work is handed in.
    // A bare 0 beside a homework they know they did would read as a bug, so the row carries the
    // score being held and what to do to claim it — the same reasoning as the absence badge.
    if (r.workPending) workPending[a.id] = { base: r.base };
    scores[a.id] = r.effective;
  }

  // Past-due homework the student has started but never handed in — the row that otherwise reads
  // as a bare zero with nothing to act on. `closesAssignment` is what separates "handed in" from
  // "a record the app wrote on their behalf at the deadline", which does not close the assignment
  // and still needs finishing. Driven by the student's own draft progress rather than by that
  // record, so the notice does not depend on a lazy sweep having run.
  const unfinished = {};
  for (const a of assignments) {
    if (a.type !== "homework") continue;
    const due = effectiveDue(a.dueDate, myOverrides[a.id]?.dueDate);
    if (!due || dueToDate(due) >= now) continue;
    if (myOverrides[a.id]?.excused) continue;
    if ((submissions || []).some(sb => sb.studentId === myId && sb.quizId === a.id && closesAssignment(sb))) continue;
    const prog = (myProgress || {})[a.id];
    const done = prog?.done || 0;
    if (done > 0) unfinished[a.id] = { done, total: prog.total || 0 };
  }

  const { overall, byCategory } = calcGrades({ assignments, categories: gradeCategories, scores, excused });

  // The work still ahead: everything on the gradebook with no grade against it yet. It feeds the
  // scenario panel only, and deliberately includes assignments not yet released, since those are
  // exactly what a student planning the rest of the term is asking about.
  const { remaining } = SHOW_GRADE_SCENARIOS
    ? splitRemaining(allAssignments, new Set(assignments.map(a => a.id)))
    : { remaining: [] };

  const sortedCats = Object.values(gradeCategories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const activeCatCount = sortedCats.filter(c => (byCategory[c.id]?.possible ?? 0) > 0).length;

  if (assignments.length === 0) {
    return (
      <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
        No graded assignments yet.
      </div>
    );
  }

  return (
    <>
    {viewSub && (
      <SubViewModal
        submission={viewSub.submission}
        studentName={loggedInStudent?.fullName}
        assignmentTitle={viewSub.title}
        override={(gradeOverrides[myId] || {})[viewSub.id] || {}}
        due={effectiveDue(allAssignments.find(a => a.id === viewSub.id)?.dueDate, (gradeOverrides[myId] || {})[viewSub.id]?.dueDate)}
        showIntegrity={false}
        audience="student"
        onClose={() => setViewSub(null)}
      />
    )}
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Overall grade banner */}
      <div style={{ ...s.card, padding: "28px 32px", textAlign: "center" }}>
        <p style={{ color: muted, fontSize: 12, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Overall Grade</p>
        {overall != null ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 54, fontWeight: 800, color: overallColor(overall), lineHeight: 1 }}>
                {overall.toFixed(1)}%
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: overallColor(overall) }}>
                {overallLetter(overall)}
              </span>
            </div>
            <p style={{ color: muted, fontSize: 13, margin: "12px 0 0" }}>
              {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} across {activeCatCount} categor{activeCatCount !== 1 ? "ies" : "y"}
            </p>
          </>
        ) : (
          <p style={{ color: muted, fontSize: 16, margin: 0 }}>No graded work yet</p>
        )}
      </div>

      {/* Optional what-if panel, closed by default. Renders nothing when nothing is left. */}
      {SHOW_GRADE_SCENARIOS && <GradeScenario
        assignments={assignments}
        remaining={remaining}
        categories={gradeCategories}
        scores={scores}
        excused={excused}
        byCategory={byCategory}
        overall={overall}
      />}

      {/* Category breakdown */}
      {sortedCats.map(cat => {
        const data = byCategory[cat.id];
        if (!data || data.assignments.length === 0) return null;
        const catAssignments = assignments.filter(a => a.catId === cat.id);
        const cc = categoryColor(cat.id, teal);

        return (
          <div key={cat.id} style={{ ...s.card, overflow: "hidden" }}>
            {/* Category header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${border}`, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: cc, flexShrink: 0 }} />
                <span style={{ color: text, fontWeight: 700, fontSize: 15 }}>{cat.name}</span>
                <span style={{ color: muted, fontSize: 12 }}>· {cat.weight}% of grade</span>
                {cat.dropLowest > 0 && (
                  <span style={{ ...s.badge(muted), fontSize: 11 }}>
                    {data.dropped.length > 0 ? `${data.dropped.length} lowest dropped` : `drops ${cat.dropLowest} lowest`}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {data.possible > 0 && (
                  <span style={{ color: muted, fontSize: 13 }}>
                    {data.earned % 1 === 0 ? data.earned : data.earned.toFixed(1)}/{data.possible} pts
                  </span>
                )}
                {data.pct != null && (
                  <span style={{ color: text, fontWeight: 700, fontSize: 15 }}>{data.pct.toFixed(1)}%</span>
                )}
                {data.weightedContrib > 0 && (
                  <span style={{ ...s.badge(cc), fontSize: 11 }}>+{data.weightedContrib.toFixed(1)}% overall</span>
                )}
              </div>
            </div>

            {/* Per-assignment rows */}
            {data.assignments.map((item, i) => {
              const a = catAssignments.find(x => x.id === item.id);
              const isDropped = data.dropped.includes(item.id);
              const sc = scoreColor(item.score, item.maxPts, item.excused, item.score == null && !item.excused, muted);
              const mySub = (submissions || []).find(sub => sub.studentId === myId && sub.quizId === item.id);
              return (
                <div
                  key={item.id}
                  onClick={mySub ? () => setViewSub({ submission: mySub, title: a?.title || item.id, id: item.id }) : undefined}
                  title={mySub ? "View your submission" : undefined}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 20px",
                    borderTop: i > 0 ? `1px solid ${border}` : "none",
                    opacity: isDropped ? 0.4 : 1,
                    cursor: mySub ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: isDropped ? muted : text, fontSize: 14 }}>{a?.title || item.id}</span>
                    {isDropped && <span style={{ ...s.badge(muted), fontSize: 10 }}>dropped</span>}
                    {/* A bare 0 on a lab prompts an email. Say why it is a 0. */}
                    {absentOn[item.id] && (
                      <span style={{ ...s.badge("#f87171"), fontSize: 10 }}>
                        absent for lecture {formatSessionDate(absentOn[item.id])}
                      </span>
                    )}
                    {/* Same reasoning as the absence badge: a score the student did not hand in
                        themselves prompts a question, so the row answers it and says what to do. */}
                    {(unfinished[item.id] || workPending[item.id]) && (
                      <span style={{ ...s.badge("#fbbf24"), fontSize: 10 }}>
                        {unfinished[item.id]
                          ? `${unfinished[item.id].done} of ${unfinished[item.id].total} problems finished: open it, finish it and upload your written work. Anything you finished before the deadline still earns full credit`
                          : `${workPending[item.id].base != null ? `${workPending[item.id].base}/${item.maxPts} saved at the deadline: ` : ""}upload your written work to claim it. Anything you finished before the deadline still earns full credit`}
                      </span>
                    )}
                    {mySub && <span style={{ color: teal, fontSize: 12 }}>View ›</span>}
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: sc }}>
                    {item.excused ? "EX" : item.score == null ? "–" : `${item.score}/${item.maxPts}`}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </>
  );
}
