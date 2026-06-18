import { useState } from "react";
import { useTheme } from "../../theme.js";
import { buildGradebookAssignments, calcGrades, dueToDate } from "../../utils.js";
import { integrityState, integrityAdjustedScore } from "../../homework.js";
import { SubViewModal } from "../../components/SubmissionView.jsx";

const CAT_COLORS = {
  cat_lab: "#818cf8", cat_hw: "#60a5fa", cat_quiz: "#34d399",
  cat_midterm: "#fbbf24", cat_final: "#f87171",
};

function overallColor(pct) {
  if (pct >= 90) return "#4ade80"; if (pct >= 80) return "#a3e635";
  if (pct >= 70) return "#facc15"; if (pct >= 60) return "#fb923c";
  return "#f87171";
}

function overallLetter(pct) {
  if (pct >= 93) return "A";  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+"; if (pct >= 83) return "B"; if (pct >= 80) return "B-";
  if (pct >= 77) return "C+"; if (pct >= 73) return "C"; if (pct >= 70) return "C-";
  if (pct >= 67) return "D+"; if (pct >= 63) return "D"; if (pct >= 60) return "D-";
  return "F";
}

function scoreColor(score, excused, missing, muted) {
  if (excused || missing) return muted;
  if (score >= 8) return "#4ade80";
  if (score >= 6) return "#facc15";
  if (score >= 4) return "#fb923c";
  return "#f87171";
}

export function StudentGrades({ loggedInStudent, modules, quizzes, submissions, gradeCategories, gradeOverrides, assignmentCategories, assignmentNameOverrides }) {
  const { s, text, muted, border, teal } = useTheme();
  const myId = loggedInStudent?.studentId;
  const [viewSub, setViewSub] = useState(null);  // { submission, title, id } — opens read-only SubViewModal

  // Only show non-hidden items in the student view
  const visibleModules = (modules || []).map(mod => ({
    ...mod,
    items: (mod.items || []).filter(it => !it._hidden),
  }));

  const allAssignments = buildGradebookAssignments(visibleModules, quizzes, assignmentCategories, {}, assignmentNameOverrides);

  // Only count assignments the student has attempted or whose due date has passed.
  const submittedIds = new Set((submissions || []).filter(s => s.studentId === myId).map(s => s.quizId));
  const now = new Date();
  const assignments = allAssignments.filter(a =>
    submittedIds.has(a.id) || (a.dueDate && dueToDate(a.dueDate) < now)
  );

  const scores = {};
  const excused = {};
  for (const a of assignments) {
    const ov = (gradeOverrides[myId] || {})[a.id];
    const sub = (submissions || []).find(s => s.studentId === myId && s.quizId === a.id);
    if (ov?.excused) { excused[a.id] = true; continue; }
    const base = ov?.score != null ? ov.score : (sub != null ? sub.score : null);
    // A flag never withholds credit — the score counts in full unless the instructor upheld it.
    const ist = integrityState(sub, ov);
    scores[a.id] = integrityAdjustedScore(base, ist.penalized);
  }

  const { overall, byCategory } = calcGrades({ assignments, categories: gradeCategories, scores, excused });

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
        integrityReview={(gradeOverrides[myId] || {})[viewSub.id]?.integrityReview || null}
        showIntegrity={false}
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

      {/* Category breakdown */}
      {sortedCats.map(cat => {
        const data = byCategory[cat.id];
        if (!data || data.assignments.length === 0) return null;
        const catAssignments = assignments.filter(a => a.catId === cat.id);
        const cc = CAT_COLORS[cat.id] || teal;

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
              const sc = scoreColor(item.score, item.excused, item.score == null && !item.excused, muted);
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: isDropped ? muted : text, fontSize: 14 }}>{a?.title || item.id}</span>
                    {isDropped && <span style={{ ...s.badge(muted), fontSize: 10 }}>dropped</span>}
                    {mySub && <span style={{ color: teal, fontSize: 12 }}>View ›</span>}
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: sc }}>
                    {item.excused ? "EX" : item.score == null ? "–" : `${item.score}/10`}
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
