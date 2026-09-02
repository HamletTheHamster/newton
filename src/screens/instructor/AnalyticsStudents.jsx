import { useState, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { calcGrades } from "../../utils.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import { categoryColor } from "../../category-colors.js";
import { countsTowardGrade, lastActiveMap, timeOnTaskMap } from "../../analytics.js";
import { buildAbsenceMap } from "../../attendance.js";
import { formatDuration } from "../../hw-telemetry.js";
import { CORR_POS, fmtPct, fmtSince, daysSince, Stat, StatRow, Meter, Panel, EmptyCard } from "./analytics-ui.jsx";

// Analytics -> Students. A whole-term view of the class, and a per-student drill-down.
//
// Deliberately NOT a "risk score". A single composite number would be an opaque ranking that
// invites acting on the number rather than on what produced it, and every component here has an
// innocent reading on its own. Instead the table shows the components, sorts by the one
// defensible default (overall grade, lowest first), and lets the instructor sort by any of them.
// The badges call out only facts that are plainly true ("4 missing", "no activity in 14 days"),
// never an inference about why.

const OVERALL_BANDS = [[90, "#4ade80"], [80, "#a3e635"], [70, "#facc15"], [60, "#fb923c"]];
const overallColor = pct => {
  if (pct == null) return null;
  for (const [floor, c] of OVERALL_BANDS) if (pct >= floor) return c;
  return "#f87171";
};

const STALE_DAYS = 14;

function StudentDetail({ student, assignments, matrix, submissions, telemetryAll, absenceMap, onBack }) {
  const { s, text, muted, border, isLight } = useTheme();
  const sid = student.studentId;

  const rows = assignments.map(a => {
    const raw = matrix.scoreMap[sid]?.[a.id];
    const excused = !!matrix.excusedMap[sid]?.[a.id];
    const sub = matrix.subsByStudent[sid]?.[a.id] || null;
    const counted = countsTowardGrade(a, { hasScore: raw != null, isExcused: excused, hasSubmission: !!sub });
    const pct = excused || raw == null ? null : (raw / (a.maxPts || 10)) * 100;
    const tele = sub?.telemetry || telemetryAll?.[sid]?.[a.id] || null;
    const ms = tele ? Object.values(tele.items || {}).reduce((n, it) => n + (it.activeMs || 0), 0) : 0;
    return {
      a, pct, excused, counted, submitted: !!sub, ms,
      missing: counted && !excused && !sub && a.type !== "manual",
      absent: !!matrix.absentMap[sid]?.[a.id],
      flagged: !!matrix.flaggedMap[sid]?.[a.id],
    };
  });

  const graded = rows.filter(r => r.pct != null);
  const totalMs = rows.reduce((n, r) => n + r.ms, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onBack} style={{ ...s.btnGhost, width: "auto", alignSelf: "flex-start", padding: "6px 12px" }}>
        ‹ All students
      </button>

      <StatRow>
        <Stat label="Scored" value={`${graded.length}`} hint={`of ${rows.filter(r => r.counted).length} counted`} />
        <Stat label="Missing" value={rows.filter(r => r.missing).length || "0"} hint="past due, nothing handed in" />
        <Stat label="Time on task" value={formatDuration(totalMs)} hint="homework, all assignments" />
        <Stat label="Absences" value={Object.keys(absenceMap[sid] || {}).length || "0"} hint="lectures with a linked lab" />
      </StatRow>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <thead>
            <tr>
              {[["Assignment", "left"], ["Score", "right"], ["Time", "right"], ["Status", "left"]].map(([h, a]) => (
                <th key={h} style={{ textAlign: a, color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", padding: "0 10px 8px", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.a.id} style={{ borderTop: `1px solid ${border}` }}>
                <td style={{ padding: "9px 10px", color: text, fontSize: 13 }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: categoryColor(r.a.catId, muted), marginRight: 8 }} />
                  {r.a.title}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.pct == null ? (
                    <span style={{ color: muted, fontSize: 12 }}>-</span>
                  ) : (<>
                    <Meter pct={r.pct} color={overallColor(r.pct)} width={34} />
                    <span style={{ color: overallColor(r.pct), fontSize: 12, fontFamily: "monospace", marginLeft: 8, fontWeight: 600 }}>{fmtPct(r.pct)}</span>
                  </>)}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: r.ms ? text : muted }}>
                  {r.ms ? formatDuration(r.ms) : "-"}
                </td>
                <td style={{ padding: "9px 10px", fontSize: 12 }}>
                  {r.excused && <span style={{ ...s.badge(muted), marginRight: 6 }}>Excused</span>}
                  {r.missing && <span style={{ ...s.badge("#f87171"), marginRight: 6 }}>Missing</span>}
                  {r.absent && <span style={{ ...s.badge("#f87171"), marginRight: 6 }}>Absent</span>}
                  {r.flagged && <span style={{ ...s.badge("#fbbf24"), marginRight: 6 }}>Flagged</span>}
                  {!r.excused && !r.missing && !r.absent && !r.flagged && r.submitted && <span style={{ color: muted }}>Submitted</span>}
                  {!r.excused && !r.missing && !r.absent && !r.flagged && !r.submitted && <span style={{ color: muted }}>{r.counted ? "-" : "Not due yet"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsStudents({
  roster, assignments, matrix, submissions, gradeCategories, attendance, telemetryAll, telemetryLoading,
}) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState(null);
  const [sort, setSort] = useState("overall");

  const absenceMap = useMemo(() => buildAbsenceMap(attendance), [attendance]);
  const lastActive = useMemo(() => lastActiveMap({ submissions, telemetryAll }), [submissions, telemetryAll]);
  const timeOnTask = useMemo(() => timeOnTaskMap(telemetryAll), [telemetryAll]);

  const rows = useMemo(() => (roster || []).map(stu => {
    const sid = stu.studentId;
    // Overall goes through the same calcGrades the Gradebook uses, on the same "counts yet"
    // filter, so this column and the gradebook's Overall can never disagree.
    const active = assignments.filter(a => countsTowardGrade(a, {
      hasScore: matrix.scoreMap[sid]?.[a.id] != null,
      isExcused: !!matrix.excusedMap[sid]?.[a.id],
      hasSubmission: !!matrix.subsByStudent[sid]?.[a.id],
    }));
    const g = calcGrades({
      assignments: active, categories: gradeCategories,
      scores: matrix.scoreMap[sid] || {}, excused: matrix.excusedMap[sid] || {},
    });
    const missing = active.filter(a =>
      a.type !== "manual" && !matrix.excusedMap[sid]?.[a.id] && !matrix.subsByStudent[sid]?.[a.id]
    ).length;
    return {
      studentId: sid,
      name: stu.altName || stu.fullName || sid,
      overall: g?.overall ?? null,
      missing,
      ms: timeOnTask[sid] || 0,
      last: lastActive[sid] || null,
      absences: Object.keys(absenceMap[sid] || {}).length,
    };
  }), [roster, assignments, matrix, gradeCategories, timeOnTask, lastActive, absenceMap]);

  const sorted = useMemo(() => {
    const r = [...rows];
    if (sort === "overall") r.sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999) || a.name.localeCompare(b.name));
    if (sort === "missing") r.sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name));
    if (sort === "stale") r.sort((a, b) => (daysSince(b.last) ?? -1) - (daysSince(a.last) ?? -1));
    if (sort === "time") r.sort((a, b) => a.ms - b.ms);
    if (sort === "name") r.sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [rows, sort]);

  const student = openId ? (roster || []).find(r => r.studentId === openId) : null;

  if (!roster?.length) return <EmptyCard title="No students enrolled">Add students in the Roster tab and this view fills in.</EmptyCard>;

  if (student) {
    return (
      <Panel title={student.altName || student.fullName || student.studentId} subtitle="Every assignment this term">
        <StudentDetail
          student={student} assignments={assignments} matrix={matrix} submissions={submissions}
          telemetryAll={telemetryAll} absenceMap={absenceMap} onBack={() => setOpenId(null)}
        />
      </Panel>
    );
  }

  const Cell = ({ children, align = "right", color, mono, title }) => (
    <td title={title} style={{ padding: "9px 10px", textAlign: align, fontSize: 12, color: color || muted, fontFamily: mono ? "monospace" : "inherit", whiteSpace: "nowrap" }}>{children}</td>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...s.card, padding: 14, display: "flex", gap: 14, alignItems: isMobile ? "stretch" : "flex-end", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : "0 1 260px" }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Sort by</label>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...s.input, padding: "9px 12px", colorScheme: isLight ? "light" : "dark" }}>
            <option value="overall">Lowest overall grade</option>
            <option value="missing">Most missing work</option>
            <option value="stale">Longest since active</option>
            <option value="time">Least time on task</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: isMobile ? 0 : 10 }}>
          <span style={{ color: muted, fontSize: 12 }}>How to read this</span>
          <InfoDot title="No risk score, on purpose" align="right">
            This table shows the components rather than a single risk number. A composite would rank students by
            a formula nobody can see, and every column here has an innocent explanation on its own: a student
            with little time on task may work on paper, and one who has been quiet for a week may have been ill.
            <br /><br />
            Sorted by overall grade because that is the one ordering that needs no interpretation. Use it to
            decide who to check in with, not to conclude anything.
          </InfoDot>
        </div>
      </div>

      <Panel title={`${rows.length} students`} subtitle="Click any student for their whole term.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 0 : 620 }}>
            <thead>
              <tr>
                {(isMobile
                  ? [["Student", "left"], ["Overall", "right"], ["Missing", "right"]]
                  : [["Student", "left"], ["Overall", "right"], ["Missing", "right"], ["Time on task", "right"], ["Last active", "right"], ["Absences", "right"]]
                ).map(([h, a]) => (
                  <th key={h} style={{ textAlign: a, color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", padding: "0 10px 8px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const stale = daysSince(r.last);
                return (
                  <tr
                    key={r.studentId}
                    onClick={() => setOpenId(r.studentId)}
                    style={{ borderTop: `1px solid ${border}`, cursor: "pointer" }}
                  >
                    <td style={{ padding: "9px 10px", color: text, fontSize: 13 }}>
                      {r.name}
                      <span style={{ display: isMobile ? "block" : "inline", marginLeft: isMobile ? 0 : 8, marginTop: isMobile ? 3 : 0 }}>
                        {r.missing >= 3 && <span style={{ ...s.badge("#f87171"), marginRight: 6 }}>{r.missing} missing</span>}
                        {stale != null && stale >= STALE_DAYS && <span style={{ ...s.badge("#fbbf24"), marginRight: 6 }}>quiet {stale}d</span>}
                      </span>
                    </td>
                    <Cell mono color={overallColor(r.overall)} align="right">
                      {r.overall == null ? "-" : `${Math.round(r.overall)}%`}
                    </Cell>
                    <Cell mono color={r.missing ? "#f87171" : muted}>{r.missing || "-"}</Cell>
                    {!isMobile && <>
                      <Cell mono color={r.ms ? text : muted} title={telemetryLoading ? "Loading" : ""}>
                        {telemetryLoading ? "…" : r.ms ? formatDuration(r.ms) : "-"}
                      </Cell>
                      <Cell title={r.last || ""}>{fmtSince(r.last) || "-"}</Cell>
                      <Cell mono color={r.absences ? "#f87171" : muted}>{r.absences || "-"}</Cell>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", lineHeight: 1.5 }}>
          Time on task counts homework only, and only from the point engagement tracking existed, so early
          assignments read as blank rather than zero.
        </p>
      </Panel>
    </div>
  );
}
