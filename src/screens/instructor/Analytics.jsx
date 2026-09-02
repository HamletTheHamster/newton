import { useState, useMemo, useId } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { buildGradebookAssignments } from "../../utils.js";
import { categoryColor } from "../../category-colors.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import {
  buildScoreMatrix, buildCorrelations, linearFit, strengthLabel, strengthNote,
} from "../../analytics.js";

// Instructor Analytics tab (`instructorSection === "analytics"`).
//
// Phase one is the correlation view: pick an outcome (normally the midterm or final) and see
// which assignments actually predict performance on it. Everything here is derived from data the
// app already stores — `submissions` plus `gradeOverrides`, resolved through the shared
// `buildScoreMatrix` — so no new instrumentation and no new Firebase node is involved.
//
// Chart choices follow the house data-viz rules:
//   • The ranked bars are a DIVERGING form (correlation has polarity), so they carry two hues
//     either side of a neutral zero line, never a single ramp.
//   • The scatter is a single series, so it needs no legend; the panel title names it.
//   • Both palettes were run through the colorblind/contrast validator for light AND dark rather
//     than picked by eye — see CORR_POS / corrNeg below.

// Diverging pair, validated in both modes (lightness band, chroma floor, protan/deutan
// separation, contrast vs the card surface). The positive hue passes in both, so only the
// negative pole needs a per-mode step.
const CORR_POS = "#0e9e90";
const corrNeg = isLight => (isLight ? "#c25d10" : "#dd7024");

// Scatter geometry. The plot area is deliberately SQUARE: both axes are percentages, so equal
// px-per-percent is what lets the eye read the trend line's slope honestly.
const SC = { w: 360, h: 354, padL: 44, padT: 14, padR: 14, padB: 38, plot: 302 };
const scX = v => SC.padL + (v / 100) * SC.plot;
const scY = v => SC.padT + (1 - v / 100) * SC.plot;

const fmtR = r => (r == null ? "-" : r.toFixed(2));
const fmtPct = v => `${Math.round(v)}%`;

// ── Ranked correlation bars ───────────────────────────────────────────────────
// One row per assignment, bar drawn from a central zero line. The scale is pinned to -1..+1
// rather than auto-fitted, so a bar means the same thing after switching outcomes.
function CorrelationBars({ rows, selectedId, onSelect }) {
  const { text, muted, border, isLight } = useTheme();
  const neg = corrNeg(isLight);
  const [hover, setHover] = useState(null);

  if (!rows.length) {
    return <p style={{ color: muted, fontSize: 13, margin: 0 }}>No other assignments to compare against yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map(row => {
        const isSel = row.assignment.id === selectedId;
        const isHov = hover === row.assignment.id;
        const r = row.r;
        const color = r == null ? muted : r < 0 ? neg : CORR_POS;
        // Emphasis, not recoloring: the hue always follows the sign of the correlation, and
        // selection only changes opacity. A reader who learned "teal means it predicts the exam"
        // is never shown that same bar in another color.
        // Light mode needs a higher floor: the same 0.45 that reads as "recessive" on the dark
        // card washes almost to nothing against the eggshell one.
        const dim = isSel || isHov ? 1 : isLight ? 0.62 : 0.5;
        const half = r == null ? 0 : Math.abs(r) * 50; // % of the track, half-width at |r| = 1

        return (
          <button
            key={row.assignment.id}
            onClick={() => onSelect(row.assignment.id)}
            onMouseEnter={() => setHover(row.assignment.id)}
            onMouseLeave={() => setHover(null)}
            title={`${row.assignment.title}: r = ${fmtR(r)} from ${row.n} students`}
            style={{
              display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px 42px", gap: 10,
              alignItems: "center", width: "100%", textAlign: "left", font: "inherit",
              background: isSel ? (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)") : "none",
              border: "none", borderRadius: 6, padding: "5px 7px", cursor: "pointer",
            }}
          >
            <span style={{
              color: isSel ? text : muted, fontSize: 12.5, fontWeight: isSel ? 600 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.assignment.title}
            </span>

            {/* Track with a hairline zero rule down the middle. */}
            <span style={{ position: "relative", height: 14, display: "block" }}>
              <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: border }} />
              {r != null && (
                <span style={{
                  position: "absolute", top: 3, height: 8,
                  ...(r < 0 ? { right: "50%" } : { left: "50%" }),
                  width: `${half}%`,
                  background: color, opacity: dim,
                  // Round only the outer end: the inner end is anchored to the zero baseline.
                  borderRadius: r < 0 ? "4px 0 0 4px" : "0 4px 4px 0",
                  transition: "opacity 0.15s",
                }} />
              )}
            </span>

            <span style={{
              color: r == null ? muted : isSel ? text : muted,
              fontSize: 12, fontFamily: "monospace", textAlign: "right", fontWeight: isSel ? 700 : 400,
            }}>
              {fmtR(r)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Scatter with least-squares trend line ─────────────────────────────────────
function Scatter({ row, outcome, isLight }) {
  const { text, muted, border } = useTheme();
  const [hover, setHover] = useState(null);
  // A document-unique clip id: a hardcoded one would be silently reused if a second scatter is
  // ever mounted (a comparison view, a print layout), and the first definition would win.
  const clipId = `scatterClip-${useId().replace(/:/g, "")}`;
  const points = row?.points || [];
  const fit = useMemo(() => linearFit(points.map(p => [p.x, p.y])), [points]);
  const gridInk = border;

  if (!points.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
        <p style={{ color: muted, fontSize: 13, margin: 0, textAlign: "center" }}>
          No students have scores on both of these yet.
        </p>
      </div>
    );
  }

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${SC.w} ${SC.h}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={SC.padL} y={SC.padT} width={SC.plot} height={SC.plot} />
          </clipPath>
        </defs>

        {/* Recessive solid hairline grid, one shade off the surface. Never dashed. */}
        {ticks.map(t => (
          <g key={`g${t}`}>
            <line x1={scX(t)} y1={scY(0)} x2={scX(t)} y2={scY(100)} stroke={gridInk} strokeWidth="1" />
            <line x1={scX(0)} y1={scY(t)} x2={scX(100)} y2={scY(t)} stroke={gridInk} strokeWidth="1" />
            <text x={scX(t)} y={scY(0) + 15} textAnchor="middle" fontSize="10" fill={muted}>{t}</text>
            <text x={SC.padL - 8} y={scY(t) + 3.5} textAnchor="end" fontSize="10" fill={muted}>{t}</text>
          </g>
        ))}

        {/* Trend line, clipped to the plot so a steep fit cannot run into the axis labels. */}
        {fit && (
          <line
            x1={scX(0)} y1={scY(fit.intercept)}
            x2={scX(100)} y2={scY(fit.slope * 100 + fit.intercept)}
            stroke={text} strokeWidth="2" strokeOpacity="0.5" clipPath={`url(#${clipId})`}
          />
        )}

        {/* Markers: >= 8px, each with a 2px surface ring so overlapping students stay countable. */}
        {points.map(p => {
          const on = hover?.studentId === p.studentId;
          return (
            <circle
              key={p.studentId}
              cx={scX(p.x)} cy={scY(p.y)} r={on ? 6.5 : 5}
              fill={CORR_POS} fillOpacity={on ? 1 : 0.85}
              stroke={isLight ? "#faf8f6" : "#1e1e1f"} strokeWidth="2"
              style={{ cursor: "pointer", transition: "r 0.1s" }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        <text x={SC.padL + SC.plot / 2} y={SC.h - 4} textAnchor="middle" fontSize="10.5" fill={muted}>
          {row.assignment.title} (%)
        </text>
        <text
          x={12} y={SC.padT + SC.plot / 2} textAnchor="middle" fontSize="10.5" fill={muted}
          transform={`rotate(-90 12 ${SC.padT + SC.plot / 2})`}
        >
          {outcome.title} (%)
        </text>
      </svg>

      {hover && (
        <div style={{
          position: "absolute", pointerEvents: "none", zIndex: 5,
          left: `${(scX(hover.x) / SC.w) * 100}%`,
          top: `${(scY(hover.y) / SC.h) * 100}%`,
          transform: "translate(-50%, calc(-100% - 12px))",
          background: isLight ? "#fff" : "#252627",
          border: `1px solid ${border}`, borderRadius: 8, padding: "6px 9px",
          boxShadow: "0 8px 22px rgba(0,0,0,0.35)", whiteSpace: "nowrap",
        }}>
          <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{hover.name}</div>
          <div style={{ color: muted, fontSize: 11, fontFamily: "monospace" }}>
            {fmtPct(hover.x)} / {fmtPct(hover.y)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
// A single headline number is a stat tile, never a one-bar chart.
function Stat({ label, value, hint, color }) {
  const { text, muted } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 76 }}>
      <span style={{ color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: color || text, fontSize: 20, fontWeight: 700, fontFamily: "monospace", lineHeight: 1.1 }}>{value}</span>
      {hint && <span style={{ color: muted, fontSize: 11 }}>{hint}</span>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Analytics({
  roster, modules, quizzes, submissions, gradeOverrides, assignmentCategories,
  manualAssignments, attendance, dueDates, assignmentNameOverrides, assignmentOrderOverrides,
}) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [outcomeId, setOutcomeId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [countMissing, setCountMissing] = useState(true);

  const assignments = useMemo(() => buildGradebookAssignments(
    modules, quizzes, assignmentCategories, manualAssignments,
    assignmentNameOverrides, assignmentOrderOverrides, dueDates,
  ), [modules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, assignmentOrderOverrides, dueDates]);

  const matrix = useMemo(() => buildScoreMatrix({
    roster, assignments, submissions, gradeOverrides, attendance,
  }), [roster, assignments, submissions, gradeOverrides, attendance]);

  // Default outcome: the midterm if there is one, then the final, then any manual assignment,
  // then simply the last assignment. Exams are what an instructor almost always wants on the y
  // axis, and guessing right saves a click every visit.
  const defaultOutcomeId = useMemo(() => {
    const byCat = c => assignments.find(a => a.catId === c);
    return (byCat("cat_midterm") || byCat("cat_final") || assignments.find(a => a.type === "manual")
      || assignments[assignments.length - 1])?.id || null;
  }, [assignments]);

  const activeOutcomeId = outcomeId && assignments.some(a => a.id === outcomeId) ? outcomeId : defaultOutcomeId;
  const outcome = assignments.find(a => a.id === activeOutcomeId) || null;

  const rows = useMemo(() => (outcome ? buildCorrelations({
    roster, assignments, outcomeId: activeOutcomeId, matrix, countMissingAsZero: countMissing,
  }) : []), [roster, assignments, activeOutcomeId, matrix, countMissing, outcome]);

  const activeSelectedId = selectedId && rows.some(r => r.assignment.id === selectedId)
    ? selectedId
    : rows[0]?.assignment.id || null;
  const selected = rows.find(r => r.assignment.id === activeSelectedId) || null;

  // How many students have a usable score on the outcome at all. If this is zero the whole view
  // is empty, and the reason is almost always "the exam hasn't been marked yet", which is worth
  // saying outright rather than showing a blank panel.
  const outcomeScored = useMemo(() => {
    if (!outcome) return 0;
    return (roster || []).filter(stu =>
      matrix.scoreMap[stu.studentId]?.[outcome.id] != null && !matrix.excusedMap[stu.studentId]?.[outcome.id]
    ).length;
  }, [roster, outcome, matrix]);

  const exportCsv = () => {
    const head = ["Assignment", "Type", "n", "r", "r squared", "CI low", "CI high", "Reading"];
    const lines = [head.join(",")];
    for (const row of rows) {
      lines.push([
        `"${(row.assignment.title || "").replace(/"/g, '""')}"`,
        row.assignment.type,
        row.n,
        row.r == null ? "" : row.r.toFixed(4),
        row.r2 == null ? "" : row.r2.toFixed(4),
        row.ci ? row.ci[0].toFixed(4) : "",
        row.ci ? row.ci[1].toFixed(4) : "",
        `"${strengthLabel(row.r)}"`,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `correlations-${(outcome?.title || "outcome").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const solidBg = isLight ? "#fff" : "#252627";
  const selColor = selected?.r == null ? muted : selected.r < 0 ? corrNeg(isLight) : CORR_POS;

  if (!assignments.length) {
    return (
      <div style={{ ...s.card, padding: 28, textAlign: "center" }}>
        <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>Nothing to analyze yet</p>
        <p style={{ ...s.muted, margin: 0 }}>Add quizzes, homework or exams to this class and the analytics will fill in.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div>
        <h2 style={{ color: text, fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Analytics</h2>
        <p style={{ ...s.muted, margin: 0 }}>
          Which assignments predict performance on an exam, measured across the students who have both scores.
        </p>
      </div>

      {/* Controls, one row above the charts */}
      <div style={{
        ...s.card, padding: 14, display: "flex", gap: 14, alignItems: isMobile ? "stretch" : "flex-end",
        flexWrap: "wrap", flexDirection: isMobile ? "column" : "row",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : "0 1 300px" }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Predict scores on</label>
          <select
            value={activeOutcomeId || ""}
            onChange={e => { setOutcomeId(e.target.value); setSelectedId(null); }}
            style={{ ...s.input, padding: "9px 12px", colorScheme: isLight ? "light" : "dark" }}
          >
            {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: isMobile ? 0 : 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: text, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={countMissing}
              onChange={e => setCountMissing(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: CORR_POS, cursor: "pointer" }}
            />
            Count missing work as zero
          </label>
          <InfoDot title="Missing work">
            On, a past due assignment with nothing submitted counts as a 0, exactly as the gradebook grades it.
            Off, only work a student actually turned in is compared.
            <br /><br />
            Turning it off asks a different question: does the relationship hold among the students who actually
            did the work? If a strong correlation collapses, much of it was coming from who submitted rather than
            from how well they did.
            <br /><br />
            Excused work is left out either way, and an exam with no marks entered is never treated as a zero.
          </InfoDot>
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={exportCsv} style={{ ...s.btnGhost, width: isMobile ? "100%" : "auto", padding: "9px 16px" }}>
          Export CSV
        </button>
      </div>

      {outcomeScored === 0 ? (
        <div style={{ ...s.card, padding: 28, textAlign: "center" }}>
          <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>
            No scores entered for {outcome?.title || "this assignment"}
          </p>
          <p style={{ ...s.muted, margin: 0 }}>
            Enter its scores in the Gradebook, or pick a different assignment above, and the correlations will appear.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row", alignItems: "stretch" }}>
            {/* Ranked bars */}
            <div style={{ ...s.card, padding: 16, flex: isMobile ? "none" : "1 1 46%", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <h3 style={{ color: text, fontSize: 14, fontWeight: 700, margin: 0 }}>
                  Strength of relationship
                </h3>
                <InfoDot title="Reading these bars">
                  Each bar is a correlation coefficient r, on a fixed scale from -1 to +1.
                  <br /><br />
                  A bar to the right means students who scored higher here also scored higher on {outcome?.title}.
                  A bar to the left means the reverse. A short bar near the centre line means the two scores move
                  independently.
                  <br /><br />
                  Correlation is not proof that the assignment caused the exam performance. A strong bar most often
                  means the assignment measures the same understanding the exam measures, which is still exactly
                  what you want to know when deciding what to keep.
                </InfoDot>
              </div>
              <p style={{ ...s.muted, fontSize: 11.5, margin: "0 0 12px" }}>
                Ranked by strength. Click any row to plot it.
              </p>
              <CorrelationBars rows={rows} selectedId={activeSelectedId} onSelect={setSelectedId} />
              <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", paddingTop: 12, lineHeight: 1.5, marginTop: "auto", borderTop: `1px solid ${border}` }}>
                Right of the line: higher scores go with higher {outcome?.title} scores. Left: the reverse.
              </p>
            </div>

            {/* Scatter for the selected predictor */}
            <div style={{ ...s.card, padding: 16, flex: isMobile ? "none" : "1 1 54%", minWidth: 0 }}>
              {selected ? (
                <>
                  <h3 style={{ color: text, fontSize: 14, fontWeight: 700, margin: "0 0 3px" }}>
                    {selected.assignment.title} vs {outcome.title}
                  </h3>
                  <p style={{ ...s.muted, fontSize: 11.5, margin: "0 0 12px" }}>
                    One dot per student. Hover a dot for the name.
                  </p>

                  <div style={{
                    display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 12px", marginBottom: 14,
                    borderRadius: 8, border: `1px solid ${border}`,
                  }}>
                    <Stat label="r" value={fmtR(selected.r)} color={selColor} hint={strengthLabel(selected.r)} />
                    <Stat
                      label="r squared"
                      value={selected.r2 == null ? "-" : selected.r2.toFixed(2)}
                      hint={selected.r2 == null ? null : `${Math.round(selected.r2 * 100)}% of variation`}
                    />
                    <Stat label="Students" value={selected.n} hint="with both scores" />
                    <Stat
                      label="95% interval"
                      value={selected.ci ? `${fmtR(selected.ci[0])} to ${fmtR(selected.ci[1])}` : "-"}
                      hint="plausible range for r"
                    />
                  </div>

                  <Scatter row={selected} outcome={outcome} isLight={isLight} />

                  {strengthNote(selected) && (
                    <p style={{
                      color: muted, fontSize: 11.5, margin: "12px 0 0", lineHeight: 1.5,
                      padding: "8px 10px", borderRadius: 8,
                      border: `1px solid ${border}`, background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
                    }}>
                      {strengthNote(selected)}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ ...s.muted, margin: 0 }}>Select an assignment to plot it.</p>
              )}
            </div>
          </div>

          {/* Table view: the same numbers in text, which is also what makes the charts accessible. */}
          <div style={{ ...s.card, padding: 16 }}>
            <h3 style={{ color: text, fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>All assignments</h3>
            {/* On a phone the six-column table cannot fit, and letting it scroll sideways leaves a
                truncated "R SQUARED" header reading as a second "R". So mobile drops to the three
                columns that carry the ranking and folds the plain-language reading under the title,
                where it has room to be a sentence. */}
            <div style={{ overflowX: isMobile ? "visible" : "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 0 : 620 }}>
                <thead>
                  <tr>
                    {(isMobile
                      ? [["Assignment", "left"], ["n", "right"], ["r", "right"]]
                      : [["Assignment", "left"], ["n", "right"], ["r", "right"], ["r squared", "right"], ["95% interval", "right"], ["Reading", "left"]]
                    ).map(([h, align]) => (
                      <th key={h} style={{
                        textAlign: align,
                        color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                        textTransform: "uppercase", padding: "0 10px 8px", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isSel = row.assignment.id === activeSelectedId;
                    const color = row.r == null ? muted : row.r < 0 ? corrNeg(isLight) : CORR_POS;
                    return (
                      <tr
                        key={row.assignment.id}
                        onClick={() => setSelectedId(row.assignment.id)}
                        style={{
                          borderTop: `1px solid ${border}`, cursor: "pointer",
                          background: isSel ? (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)") : "transparent",
                        }}
                      >
                        <td style={{ padding: "9px 10px", color: text, fontSize: 13 }}>
                          <span style={{
                            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                            background: categoryColor(row.assignment.catId, muted), marginRight: 8,
                          }} />
                          {row.assignment.title}
                          {isMobile && (
                            <span style={{ display: "block", color: muted, fontSize: 11, marginTop: 3, marginLeft: 15 }}>
                              {strengthLabel(row.r)}
                              {row.ci ? ` · ${fmtR(row.ci[0])} to ${fmtR(row.ci[1])}` : ""}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "9px 10px", color: muted, fontSize: 12, fontFamily: "monospace", textAlign: "right", verticalAlign: "top" }}>{row.n}</td>
                        <td style={{ padding: "9px 10px", color, fontSize: 12.5, fontFamily: "monospace", textAlign: "right", fontWeight: 700, verticalAlign: "top" }}>{fmtR(row.r)}</td>
                        {!isMobile && (
                          <>
                            <td style={{ padding: "9px 10px", color: muted, fontSize: 12, fontFamily: "monospace", textAlign: "right" }}>
                              {row.r2 == null ? "-" : row.r2.toFixed(2)}
                            </td>
                            <td style={{ padding: "9px 10px", color: muted, fontSize: 12, fontFamily: "monospace", textAlign: "right", whiteSpace: "nowrap" }}>
                              {row.ci ? `${fmtR(row.ci[0])} to ${fmtR(row.ci[1])}` : "-"}
                            </td>
                            <td style={{ padding: "9px 10px", color: muted, fontSize: 12 }}>{strengthLabel(row.r)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", lineHeight: 1.5 }}>
              A class is a small sample, so treat r as a direction rather than a measurement. The 95% interval is the
              range the true value plausibly sits in, and when it spans zero the direction is not yet established.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
