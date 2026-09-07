import { useState, useMemo, useId, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { buildGradebookAssignments } from "../../utils.js";
import { categoryColor } from "../../category-colors.js";
import { fbGet, classPath } from "../../firebase.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import {
  buildScoreMatrix, buildCorrelations, linearFit, strengthNote, readingFor, mergeTelemetry,
  effortByStudent, PREDICTORS,
} from "../../analytics.js";
import { CORR_POS, corrNeg, fmtR, fmtPct, Stat, StatRow, ViewTabs, EmptyCard, Panel } from "./analytics-ui.jsx";
import { AnalyticsItems } from "./AnalyticsItems.jsx";
import { AnalyticsStudents } from "./AnalyticsStudents.jsx";
import { AnalyticsPulse } from "./AnalyticsPulse.jsx";
import { AnalyticsMaterials } from "./AnalyticsMaterials.jsx";
import { materialsOf, materialModules, materialOpensByStudent } from "../../material-views.js";
import { studentIds, scopeSubmissions, scopeByStudent } from "../../roster-scope.js";

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

// Round a raw axis step up to 1, 2 or 5 times a power of ten.
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// Scatter geometry. The plot area is deliberately SQUARE: both axes are percentages, so equal
// px-per-percent is what lets the eye read the trend line's slope honestly.
const SC = { w: 360, h: 354, padL: 44, padT: 14, padR: 14, padB: 38, plot: 302 };
const scY = v => SC.padT + (1 - v / 100) * SC.plot;

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
// `xDomain`/`xTicks`/`xLabel` are supplied by the caller: the y axis is always a score
// percentage, but x may be a percentage, a count of attempts, or minutes.
function Scatter({ row, outcome, isLight, xDomain, xTicks, xLabel, fmtX }) {
  const { text, muted, border } = useTheme();
  const [hover, setHover] = useState(null);
  // A document-unique clip id: a hardcoded one would be silently reused if a second scatter is
  // ever mounted (a comparison view, a print layout), and the first definition would win.
  const clipId = `scatterClip-${useId().replace(/:/g, "")}`;
  const points = row?.points || [];
  // The fit is computed from the RAW points, never the stacks below: every student must weigh
  // the same in the regression, however many share a coordinate.
  const fit = useMemo(() => linearFit(points.map(p => [p.x, p.y])), [points]);
  // Group students who land on the same coordinate. Rounded to 2dp, which is finer than the
  // plot can resolve, so only genuinely coincident points merge.
  const stacks = useMemo(() => {
    const by = new Map();
    for (const p of points) {
      const key = `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
      const st = by.get(key) || { key, x: p.x, y: p.y, names: [] };
      st.names.push(p.name);
      by.set(key, st);
    }
    return [...by.values()].map(st => ({ ...st, n: st.names.length }));
  }, [points]);
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

  const [x0, x1] = xDomain;
  const span = x1 - x0 || 1;
  const sx = v => SC.padL + ((v - x0) / span) * SC.plot;
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${SC.w} ${SC.h}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={SC.padL} y={SC.padT} width={SC.plot} height={SC.plot} />
          </clipPath>
        </defs>

        {/* Recessive solid hairline grid, one shade off the surface. Never dashed. */}
        {xTicks.map(t => (
          <g key={`gx${t}`}>
            <line x1={sx(t)} y1={scY(0)} x2={sx(t)} y2={scY(100)} stroke={gridInk} strokeWidth="1" />
            <text x={sx(t)} y={scY(0) + 15} textAnchor="middle" fontSize="10" fill={muted}>{t}</text>
          </g>
        ))}
        {yTicks.map(t => (
          <g key={`gy${t}`}>
            <line x1={SC.padL} y1={scY(t)} x2={SC.padL + SC.plot} y2={scY(t)} stroke={gridInk} strokeWidth="1" />
            <text x={SC.padL - 8} y={scY(t) + 3.5} textAnchor="end" fontSize="10" fill={muted}>{t}</text>
          </g>
        ))}

        {/* Trend line, clipped to the plot so a steep fit cannot run into the axis labels. */}
        {fit && (
          <line
            x1={sx(x0)} y1={scY(fit.slope * x0 + fit.intercept)}
            x2={sx(x1)} y2={scY(fit.slope * x1 + fit.intercept)}
            stroke={text} strokeWidth="2" strokeOpacity="0.5" clipPath={`url(#${clipId})`}
          />
        )}

        {/* Coincident students are drawn as ONE marker sized by how many are stacked there, with
            the count printed on it. Course grades are heavily discretized — a quiz where everyone
            scored 10/10 puts the whole class on a single pixel — so plain markers would silently
            draw ten students as one dot and invite counting the dots. That is not a rare edge
            case here; it is the normal shape of a well-done assignment. */}
        {stacks.map(st => {
          const on = hover?.key === st.key;
          // Area grows with the count, capped, so a big stack reads as big without swallowing
          // the plot. Never let a marker fall below the 8px minimum.
          const r = Math.min(11, 4.5 + 2.2 * Math.sqrt(st.n - 1)) + (on ? 1.5 : 0);
          return (
            <g key={st.key}>
              <circle
                cx={sx(st.x)} cy={scY(st.y)} r={r}
                fill={CORR_POS} fillOpacity={on ? 1 : 0.85}
                stroke={isLight ? "#faf8f6" : "#1e1e1f"} strokeWidth="2"
                style={{ cursor: "pointer", transition: "r 0.1s" }}
                onMouseEnter={() => setHover(st)}
                onMouseLeave={() => setHover(null)}
              />
              {st.n > 1 && (
                <text
                  x={sx(st.x)} y={scY(st.y) + 3.2} textAnchor="middle" fontSize="9.5"
                  fontWeight="700" fill={isLight ? "#fff" : "#0d1211"} style={{ pointerEvents: "none" }}
                >{st.n}</text>
              )}
            </g>
          );
        })}

        <text x={SC.padL + SC.plot / 2} y={SC.h - 4} textAnchor="middle" fontSize="10.5" fill={muted}>
          {xLabel}
        </text>
        <text
          x={12} y={SC.padT + SC.plot / 2} textAnchor="middle" fontSize="10.5" fill={muted}
          transform={`rotate(-90 12 ${SC.padT + SC.plot / 2})`}
        >
          {outcome.title} (%)
        </text>
      </svg>

      {hover && (() => {
      // Clamp the tooltip's anchor near the edges. Centering it on the marker pushes half the
      // box outside the panel for a point at 0% or 100%, and grades cluster at exactly those
      // values, so the edge case is the common one.
      const fx = sx(hover.x) / SC.w;
      const shiftX = fx > 0.78 ? "-88%" : fx < 0.22 ? "-12%" : "-50%";
      return (
        <div style={{
          position: "absolute", pointerEvents: "none", zIndex: 5,
          left: `${fx * 100}%`,
          top: `${(scY(hover.y) / SC.h) * 100}%`,
          transform: `translate(${shiftX}, calc(-100% - 12px))`,
          background: isLight ? "#fff" : "#252627",
          border: `1px solid ${border}`, borderRadius: 8, padding: "6px 9px",
          boxShadow: "0 8px 22px rgba(0,0,0,0.35)", whiteSpace: "nowrap",
        }}>
          <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>
            {hover.n === 1 ? hover.names[0] : `${hover.n} students`}
          </div>
          {hover.n > 1 && (
            <div style={{ color: muted, fontSize: 11, maxWidth: 220, whiteSpace: "normal" }}>
              {hover.names.slice(0, 6).join(", ")}{hover.names.length > 6 ? `, and ${hover.names.length - 6} more` : ""}
            </div>
          )}
          <div style={{ color: muted, fontSize: 11, fontFamily: "monospace" }}>
            {fmtX(hover.x)} / {fmtPct(hover.y)}
          </div>
        </div>
      );
      })()}
    </div>
  );
}

// ── Correlation view ──────────────────────────────────────────────────────────
function CorrelationView({ roster, assignments, matrix, feature, onFeature, effort, effortLoading, materials, materialsLoading }) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [outcomeId, setOutcomeId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [countMissing, setCountMissing] = useState(true);
  const pred = PREDICTORS[feature] || PREDICTORS.score;
  const isScore = feature === "score";
  const isMaterials = feature === "materials";
  // The x axis is a percentage for scores AND for materials opened, which is what decides
  // whether it can be pinned to 0-100. Attempts and minutes have to be fitted to the data.
  const isPct = pred.unit === "%";

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
    feature, effort, materials,
  }) : []), [roster, assignments, activeOutcomeId, matrix, countMissing, outcome, feature, effort, materials]);

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
    const head = [isMaterials ? "Module" : "Assignment", "Measured by", "Type", "n", "r", "r squared", "CI low", "CI high", "Reading"];
    const lines = [head.join(",")];
    for (const row of rows) {
      lines.push([
        `"${(row.assignment.title || "").replace(/"/g, '""')}"`,
        pred.label,
        row.assignment.type,
        row.n,
        row.r == null ? "" : row.r.toFixed(4),
        row.r2 == null ? "" : row.r2.toFixed(4),
        row.ci ? row.ci[0].toFixed(4) : "",
        row.ci ? row.ci[1].toFixed(4) : "",
        `"${readingFor(row)}"`,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = t => (t || "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    a.download = `correlations-${slug(pred.short)}-vs-${slug(outcome?.title || "outcome")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selColor = selected?.r == null ? muted : selected.r < 0 ? corrNeg(isLight) : CORR_POS;

  // The x axis is a percentage only for the score feature. Attempts and minutes get a domain
  // fitted to the data (rounded outward), because pinning them to 0-100 would squash every point
  // into the left edge.
  const axis = useMemo(() => {
    const xs = (selected?.points || []).map(p => p.x);
    if (isPct || !xs.length) {
      return {
        domain: [0, 100], ticks: [0, 25, 50, 75, 100],
        label: isMaterials
          ? `${selected?.assignment.title || ""} - % of materials opened`
          : `${selected?.assignment.title || ""} (%)`,
        fmt: v => `${Math.round(v)}%`,
      };
    }
    const lo = feature === "attempts" ? 1 : 0;
    const rawHi = Math.max(lo + 1, Math.max(...xs));
    // Round the axis outward to a "nice" step so the ticks read 0/100/200 rather than
    // 0/111.3/222.5. Evenly dividing the data range gives arithmetically correct but unreadable
    // labels, and an axis nobody can read at a glance is a chart that does not work.
    const step = niceStep((rawHi - lo) / 5);
    const hi = lo + Math.ceil((rawHi - lo) / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return {
      domain: [lo, hi],
      ticks,
      label: feature === "attempts"
        ? `${selected?.assignment.title || ""} - mean attempts to correct`
        : `${selected?.assignment.title || ""} - minutes on task`,
      fmt: v => (feature === "attempts" ? `${v.toFixed(1)} tries` : `${Math.round(v)} min`),
    };
  }, [selected, isPct, isMaterials, feature]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : "0 1 230px" }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Measured by</label>
          <select
            value={feature}
            onChange={e => { onFeature(e.target.value); setSelectedId(null); }}
            style={{ ...s.input, padding: "9px 12px", colorScheme: isLight ? "light" : "dark" }}
          >
            {Object.values(PREDICTORS).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        {/* The missing-work policy is a question about SCORES. There is no "zero attempts" for a
            student who never opened the assignment, so the toggle is hidden rather than left
            visible and inert. */}
        {isScore && (
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
        )}

        <div style={{ flex: 1 }} />

        <button onClick={exportCsv} style={{ ...s.btnGhost, width: isMobile ? "100%" : "auto", padding: "9px 16px" }}>
          Export CSV
        </button>
      </div>

      {effortLoading ? (
        <EmptyCard title="Loading engagement data">Attempts and time come from homework engagement tracking, which is read on demand.</EmptyCard>
      ) : materialsLoading ? (
        <EmptyCard title="Loading material opens">Which materials each student has opened is read on demand.</EmptyCard>
      ) : !isScore && !isMaterials && effort && Object.keys(effort).length === 0 ? (
        <EmptyCard title="No engagement data yet">
          Attempts and time are recorded from the point a student next opens a homework, so a class whose work
          predates that has none. Assignment score still works in the meantime.
        </EmptyCard>
      ) : isMaterials && !rows.length ? (
        <EmptyCard title="No course materials posted yet">
          Readings, lecture notes, links and pages attached to a module appear here once they have a file or a URL
          behind them. The Materials view shows what has been posted and who has opened it.
        </EmptyCard>
      ) : outcomeScored === 0 ? (
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
                {isScore ? "Ranked by strength. Click any row to plot it."
                  : isMaterials
                    ? "One row per module, measured by the share of its materials a student opened, with every material across the term pooled at the top. Click any row to plot it."
                    : `Homework measured by ${pred.short}. Ranked by strength, with every problem across the term pooled at the top. Click any row to plot it.`}
              </p>
              <CorrelationBars rows={rows} selectedId={activeSelectedId} onSelect={setSelectedId} />
              <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", paddingTop: 12, lineHeight: 1.5, marginTop: "auto", borderTop: `1px solid ${border}` }}>
                Right of the line: more {pred.short} goes with higher {outcome?.title} scores. Left: the reverse.
                {pred.expected === "negative" && " A bar to the LEFT is the healthy result here: students who needed fewer attempts did better."}
                {pred.expected === "either" && " Neither direction is the \u0022right\u0022 one; which way it points is the finding."}
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
                  {!isScore && (
                    <p style={{
                      color: muted, fontSize: 11.5, margin: "0 0 12px", lineHeight: 1.5,
                      padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`,
                      background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
                    }}>{pred.blurb}</p>
                  )}

                  <div style={{
                    display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 12px", marginBottom: 14,
                    borderRadius: 8, border: `1px solid ${border}`,
                  }}>
                    <Stat label="r" value={fmtR(selected.r)} color={selColor} hint={readingFor(selected)} />
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

                  <Scatter
                    row={selected} outcome={outcome} isLight={isLight}
                    xDomain={axis.domain} xTicks={axis.ticks} xLabel={axis.label} fmtX={axis.fmt}
                  />

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
            <h3 style={{ color: text, fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>{isMaterials ? "All modules" : "All assignments"}</h3>
            {/* On a phone the six-column table cannot fit, and letting it scroll sideways leaves a
                truncated "R SQUARED" header reading as a second "R". So mobile drops to the three
                columns that carry the ranking and folds the plain-language reading under the title,
                where it has room to be a sentence. */}
            <div style={{ overflowX: isMobile ? "visible" : "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 0 : 620 }}>
                <thead>
                  <tr>
                    {(isMobile
                      ? [[isMaterials ? "Module" : "Assignment", "left"], ["n", "right"], ["r", "right"]]
                      : [[isMaterials ? "Module" : "Assignment", "left"], ["n", "right"], ["r", "right"], ["r squared", "right"], ["95% interval", "right"], ["Reading", "left"]]
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
                              {readingFor(row)}
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
                            <td style={{ padding: "9px 10px", color: muted, fontSize: 12 }}>{readingFor(row)}</td>
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

// ── Shell ─────────────────────────────────────────────────────────────────────
// Owns the assignment list, the shared score matrix, and the two on-demand RTDB reads the
// engagement views need. Everything below it is a pure render of derived data.
// Order runs from the most immediate question to the most reflective one: what is happening
// right now, then who, then which problems, then what any of it predicts. The first tab is also
// the landing view.
const VIEWS = [
  { id: "pulse", label: "Pulse" },
  { id: "students", label: "Students" },
  { id: "items", label: "Items" },
  { id: "materials", label: "Materials" },
  { id: "correlation", label: "Correlation" },
];

// Views that always need hwProgress / hwTelemetry. The correlation view needs them only once an
// effort predictor is chosen, so a visit that just wants the exam scatter never pays for the read.
const NEEDS_ENGAGEMENT = new Set(["items", "students", "pulse"]);
// The correlation predictors that come from homework engagement. Materials is deliberately NOT
// one: it reads its own node, so picking it must not drag in the far larger telemetry read.
const EFFORT_FEATURES = new Set(["attempts", "time"]);

export function Analytics({
  classId, roster, modules, quizzes, submissions, gradeOverrides, assignmentCategories,
  manualAssignments, attendance, dueDates, gradeCategories, assignmentLocks,
  assignmentNameOverrides, assignmentOrderOverrides,
}) {
  const { s, text } = useTheme();
  const [view, setView] = useState(VIEWS[0].id);
  // What the correlation view measures an assignment BY. Lifted here because it decides whether
  // the engagement read is needed, which is the shell's job.
  const [feature, setFeature] = useState("score");
  // null while unloaded; {} once a load has finished (including a failed one, so a broken read
  // shows "nothing recorded" rather than a spinner that never resolves).
  const [engagement, setEngagement] = useState(null);
  const [loadingEngagement, setLoadingEngagement] = useState(false);
  // When the engagement node was last read. The Pulse view's "working right now" panel is only
  // as true as this timestamp, so it prints it rather than implying the numbers are live.
  const [engagementAt, setEngagementAt] = useState(null);
  // Same null-vs-{} contract as `engagement`: null while unloaded, {} once a load has finished,
  // so a class where nobody has clicked anything reads as "nothing opened" and not as a spinner.
  const [materialViews, setMaterialViews] = useState(null);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Every per-student node this tab reads is scoped to the roster it was handed, which App.jsx
  // has already reduced to the actual students (`studentRoster`, so the instructor's own entry is
  // not among them). Two things make that necessary rather than tidy:
  //
  //   • App.jsx flattens the whole `submissions` node without consulting the roster, so a removed
  //     or never-enrolled student's work survives in it. The Gradebook never sees them because it
  //     iterates the roster, and every count here has to agree with the Gradebook; without this
  //     the analytics reported a homework submission the gradebook said did not exist.
  //   • `hwTelemetry` / `hwProgress` / `materialViews` are read WHOLE and are not iterated over
  //     the roster at all — `buildActivityByDay`, `lastActiveMap` and `timeOnTaskMap` walk the
  //     node's own keys — so an entry absent from the roster would still reach the activity
  //     chart and the time-on-task figures.
  const rosterIds = useMemo(() => studentIds(roster), [roster]);
  const rosterSubmissions = useMemo(
    () => scopeSubmissions(submissions, rosterIds),
    [submissions, rosterIds]
  );

  const assignments = useMemo(() => buildGradebookAssignments(
    modules, quizzes, assignmentCategories, manualAssignments,
    assignmentNameOverrides, assignmentOrderOverrides, dueDates,
  ), [modules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, assignmentOrderOverrides, dueDates]);

  const matrix = useMemo(() => buildScoreMatrix({
    roster, assignments, submissions: rosterSubmissions, gradeOverrides, attendance,
  }), [roster, assignments, rosterSubmissions, gradeOverrides, attendance]);

  // Two whole-node reads, once per visit, the first time an engagement view is opened.
  // `hwProgress` is tiny; `hwTelemetry` is the larger one and is deliberately not fetched for
  // the correlation view, which is derived entirely from data App.jsx already holds.
  const wantsEngagement = NEEDS_ENGAGEMENT.has(view) || (view === "correlation" && EFFORT_FEATURES.has(feature));

  // The read itself, separate from the effect below so the Pulse view can ask for a fresh one.
  // Two things a re-read must not do, both of which a naive version does:
  //   • It must not clear `engagement` first. A poll refreshes the numbers in place; blanking
  //     them would wipe the panel the instructor is reading, once a minute, forever.
  //   • It must not raise the loading flag once there IS data. Every view reads that flag to
  //     show "Loading…" or "…", so a background poll would flash all of them on each tick.
  // `loadedRef` is what tells the two apart without adding the flag to the callback's deps,
  // which would give it a new identity on every load and restart the Pulse view's poll timer.
  const loadedRef = useRef(false);
  useEffect(() => { loadedRef.current = !!engagement; }, [engagement]);

  const readEngagement = useCallback(() => {
    if (!classId) return Promise.resolve();
    if (!loadedRef.current) setLoadingEngagement(true);
    return Promise.all([
      fbGet(classPath(classId, "hwProgress")).catch(() => null),
      fbGet(classPath(classId, "hwTelemetry")).catch(() => null),
    ])
      .then(([p, t]) => setEngagement({ progress: p || {}, telemetryAll: t || {} }))
      // A failed poll keeps whatever was already on screen; only a failed FIRST read resolves to
      // an empty object, so a broken node reads as "nothing recorded" and not as a stuck spinner.
      .catch(() => setEngagement(prev => prev || { progress: {}, telemetryAll: {} }))
      .finally(() => { setEngagementAt(Date.now()); setLoadingEngagement(false); });
  }, [classId]);

  useEffect(() => {
    if (!classId || engagement || loadingEngagement || !wantsEngagement) return;
    readEngagement();
  }, [classId, wantsEngagement, engagement, loadingEngagement, readEngagement]);

  // Course-material opens: a second on-demand whole-node read, kept separate from the engagement
  // one so a visit to Pulse never pays for it and a visit to Materials never pays for telemetry.
  // Needed by the Materials view and by the correlation view's materials predictor.
  const wantsMaterials = view === "materials" || (view === "correlation" && feature === "materials");

  useEffect(() => {
    if (!classId || materialViews || loadingMaterials || !wantsMaterials) return;
    setLoadingMaterials(true);
    fbGet(classPath(classId, "materialViews"))
      .then(d => setMaterialViews(d || {}))
      .catch(() => setMaterialViews({}))
      .finally(() => setLoadingMaterials(false));
  }, [classId, wantsMaterials, materialViews, loadingMaterials]);

  // Reset when the class changes, or one class's telemetry would be shown under another's name.
  useEffect(() => { setEngagement(null); setMaterialViews(null); setEngagementAt(null); loadedRef.current = false; }, [classId]);

  const progress = useMemo(() => scopeByStudent(engagement?.progress, rosterIds), [engagement, rosterIds]);
  // Merged once here so no view can accidentally read only the live node and report every
  // student who has handed in as having spent no time. See mergeTelemetry.
  const telemetryAll = useMemo(
    () => mergeTelemetry({
      telemetryAll: scopeByStudent(engagement?.telemetryAll, rosterIds),
      submissions: rosterSubmissions,
    }),
    [engagement, rosterIds, rosterSubmissions]
  );

  // Per-student attempts and time, for the correlation view's effort predictors. Only computed
  // once the engagement read has landed, so it is null (not an empty object) while loading and
  // the view can tell "still loading" from "genuinely nothing recorded".
  const effort = useMemo(() => {
    if (!engagement) return null;
    const homeworkIds = assignments.filter(a => a.type === "homework").map(a => a.id);
    return effortByStudent({ homeworkIds, submissions: rosterSubmissions, telemetryAll });
  }, [engagement, assignments, rosterSubmissions, telemetryAll]);

  // The materials predictor's input: the openable materials, the modules holding them, and each
  // student's share opened. Null while the read is outstanding, for the same reason `effort` is.
  const scopedViews = useMemo(() => scopeByStudent(materialViews, rosterIds), [materialViews, rosterIds]);

  const materials = useMemo(() => {
    if (!materialViews) return null;
    const list = materialsOf(modules);
    return {
      modules: materialModules(list),
      opens: materialOpensByStudent({ materials: list, roster, views: scopedViews }),
    };
  }, [materialViews, scopedViews, modules, roster]);

  if (!assignments.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ color: text, fontSize: 20, fontWeight: 700, margin: 0 }}>Analytics</h2>
        <EmptyCard title="Nothing to analyze yet">
          Add quizzes, homework or exams to this class and the analytics will fill in.
        </EmptyCard>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* The tab strip below names the view; a paragraph restating it in longer words is the same
          thing said twice. Each view's panels have to carry their own meaning. */}
      <h2 style={{ color: text, fontSize: 20, fontWeight: 700, margin: 0 }}>Analytics</h2>

      <ViewTabs views={VIEWS} active={view} onSelect={setView} />

      {view === "correlation" && (
        <CorrelationView
          roster={roster} assignments={assignments} matrix={matrix}
          feature={feature} onFeature={setFeature}
          effort={effort} effortLoading={EFFORT_FEATURES.has(feature) && !engagement}
          materials={materials} materialsLoading={feature === "materials" && !materialViews}
        />
      )}
      {view === "materials" && (
        <AnalyticsMaterials
          roster={roster} modules={modules} views={scopedViews} loading={loadingMaterials}
        />
      )}
      {view === "items" && (
        <AnalyticsItems
          assignments={assignments} quizzes={quizzes} submissions={rosterSubmissions}
          telemetryAll={telemetryAll} telemetryLoading={loadingEngagement}
        />
      )}
      {view === "students" && (
        <AnalyticsStudents
          roster={roster} assignments={assignments} quizzes={quizzes}
          matrix={matrix} submissions={rosterSubmissions}
          gradeCategories={gradeCategories} attendance={attendance}
          telemetryAll={telemetryAll} telemetryLoading={loadingEngagement}
        />
      )}
      {view === "pulse" && (
        <AnalyticsPulse
          roster={roster} assignments={assignments} submissions={rosterSubmissions}
          progress={progress} telemetryAll={telemetryAll} telemetryLoading={loadingEngagement}
          dueDates={dueDates} assignmentLocks={assignmentLocks}
          onRefresh={readEngagement} refreshedAt={engagementAt}
        />
      )}
    </div>
  );
}
