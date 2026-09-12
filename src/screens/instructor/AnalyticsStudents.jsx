import { useState, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { calcGrades } from "../../utils.js";
import { categoryColor } from "../../category-colors.js";
import { countsTowardGrade, lastActiveMap, timeOnTaskMap } from "../../analytics.js";
import { buildAbsenceMap } from "../../attendance.js";
import { formatDuration } from "../../hw-telemetry.js";
import { CORR_POS, fmtPct, fmtSince, daysSince, Stat, StatRow, Meter, Panel, EmptyCard } from "./analytics-ui.jsx";
import { StudentWorkDetail } from "./StudentWorkDetail.jsx";

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

function StudentDetail({ student, assignments, matrix, telemetryAll, absenceMap, gradeCategories, onOpenWork, onBack }) {
  const { s, text, muted, border, isLight } = useTheme();
  const sid = student.studentId;

  // Category filter, the same pills as the Assignments hub: any number lit, none lit means
  // everything. Only categories this term actually has assignments in are offered, in the
  // gradebook's own order, so the bar cannot show a pill that filters to nothing.
  const [cats, setCats] = useState(new Set());
  const catPills = useMemo(() => {
    const present = new Set(assignments.map(a => a.catId));
    return [...present]
      .map(id => ({ id, label: gradeCategories?.[id]?.name || id.replace(/^cat_/, ""), color: categoryColor(id, muted), order: gradeCategories?.[id]?.order ?? 99 }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [assignments, gradeCategories, muted]);
  const toggleCat = id => setCats(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const shown = cats.size ? assignments.filter(a => cats.has(a.catId)) : assignments;

  const rows = shown.map(a => {
    const raw = matrix.scoreMap[sid]?.[a.id];
    const excused = !!matrix.excusedMap[sid]?.[a.id];
    const sub = matrix.subsByStudent[sid]?.[a.id] || null;
    const counted = countsTowardGrade(a, { hasScore: raw != null, isExcused: excused, hasSubmission: !!sub });
    const pct = excused || raw == null ? null : (raw / (a.maxPts || 10)) * 100;
    const tele = sub?.telemetry || telemetryAll?.[sid]?.[a.id] || null;
    const ms = tele ? Object.values(tele.items || {}).reduce((n, it) => n + (it.activeMs || 0), 0) : 0;
    return {
      a, pct, excused, counted, submitted: !!sub, ms, tele,
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

      {/* The three assignment stats follow the filter, so the numbers above the table are
          always the numbers OF the table. Absences is a fact about lectures, not about any
          assignment, so it does not. */}
      <StatRow>
        <Stat label="Scored" value={`${graded.length}`} hint={`of ${rows.filter(r => r.counted).length} counted`} />
        <Stat label="Missing" value={rows.filter(r => r.missing).length || "0"} hint="past due, nothing handed in" />
        <Stat label="Time on task" value={formatDuration(totalMs)} hint={cats.size ? "homework, shown assignments" : "homework, all assignments"} />
        <Stat label="Absences" value={Object.keys(absenceMap[sid] || {}).length || "0"} hint="lectures with a linked lab" />
      </StatRow>

      {catPills.length > 1 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {catPills.map(c => (
            <button
              key={c.id}
              onClick={() => toggleCat(c.id)}
              title={cats.has(c.id) ? `Hide ${c.label}` : `Show only ${c.label}`}
              style={{
                ...s.badge(c.color),
                cursor: "pointer",
                padding: "3px 10px",
                fontSize: 11,
                border: cats.has(c.id) ? `1px solid ${c.color}` : `1px solid ${c.color}44`,
                opacity: cats.has(c.id) || cats.size === 0 ? 1 : 0.4,
                background: "none",
              }}
            >
              {c.label}
            </button>
          ))}
          {cats.size > 0 && (
            <button onClick={() => setCats(new Set())} style={{ ...s.btnGhost, width: "auto", padding: "3px 10px", fontSize: 11 }}>Clear</button>
          )}
        </div>
      )}

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
            {rows.map(r => {
              // Only a homework carries per-problem engagement, and only if something was
              // recorded: a row with nothing behind it stays plain text rather than offering a
              // click that opens an empty panel.
              const canOpen = r.a.type === "homework" && !!r.tele && !!onOpenWork;
              return (
              <tr
                key={r.a.id}
                onClick={canOpen ? () => onOpenWork(r.a) : undefined}
                title={canOpen ? "See how this student worked this set" : ""}
                style={{ borderTop: `1px solid ${border}`, cursor: canOpen ? "pointer" : "default" }}
              >
                <td style={{ padding: "9px 10px", color: text, fontSize: 13 }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: categoryColor(r.a.catId, muted), marginRight: 8 }} />
                  {r.a.title}
                  {canOpen && <span style={{ color: muted, fontSize: 12, marginLeft: 8 }}>›</span>}
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
            );})}
          </tbody>
        </table>
      </div>
      <p style={{ ...s.muted, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        Click a homework row to watch how this student worked through it, problem by problem.
      </p>
    </div>
  );
}

export function AnalyticsStudents({
  roster, assignments, quizzes, matrix, submissions, gradeCategories, attendance,
  telemetryAll, telemetryLoading,
}) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState(null);
  // Which homework's engagement detail is open beneath the student, if any. Cleared whenever
  // the student changes, so a back-out always lands on that student's term rather than on
  // someone else's problem list.
  const [openWorkId, setOpenWorkId] = useState(null);
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
  // The full homework definition, which carries the problems the item ids are labelled from.
  // `assignments` is the gradebook row and has titles and points but no problems.
  const openWork = openWorkId ? (quizzes || []).find(q => q.id === openWorkId) : null;
  const openWorkAssignment = openWorkId ? (assignments || []).find(a => a.id === openWorkId) : null;

  if (!roster?.length) return <EmptyCard title="No students enrolled">Add students in the Roster tab and this view fills in.</EmptyCard>;

  if (student) {
    const name = student.altName || student.fullName || student.studentId;
    if (openWork) {
      return (
        <Panel title={`${name} · ${openWorkAssignment?.title || openWork.title || openWorkId}`}>
          <StudentWorkDetail
            student={student} homework={openWork}
            telemetry={telemetryAll?.[student.studentId]?.[openWorkId] || null}
            onBack={() => setOpenWorkId(null)} backLabel="‹ All assignments"
          />
        </Panel>
      );
    }
    return (
      <Panel title={`${name} · every assignment this term`}>
        <StudentDetail
          student={student} assignments={assignments} matrix={matrix}
          telemetryAll={telemetryAll} absenceMap={absenceMap} gradeCategories={gradeCategories}
          onOpenWork={a => setOpenWorkId(a.id)}
          onBack={() => { setOpenWorkId(null); setOpenId(null); }}
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
      </div>

      <Panel title={`${rows.length} students`}>
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
                    onClick={() => { setOpenWorkId(null); setOpenId(r.studentId); }}
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
