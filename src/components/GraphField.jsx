import { useRef, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { parseGraphValue } from "../homework.js";
import { MathText } from "./MathText.jsx";
import { InfoDot } from "./InfoDot.jsx";

// Controlled structured-sketch plotter for homework `answerType: "graph"` items.
//
// Students build one or more curves on a fixed set of axes: click in the plot to add an
// anchor point, drag a point to move it, click a point to remove it, and choose each
// curve's shape (straight line / concave-up curve / concave-down curve). The value is a
// JSON string { curves: { [id]: { pts:[[x,y],…], shape } } } that the grader scores
// deterministically (see gradeGraph in homework.js).
//
// Props:
//   config   — { xLabel,yLabel,xMin,xMax,yMin,yMax,xTick,yTick, curves:[{id,label,color}] }
//   value    — JSON string (controlled)
//   onChange — (jsonString) => void
//   disabled — locked (renders read-only, no toolbar)
//   readOnly — display only (reveal / gradebook); no toolbar, no interaction
//   grade    — { pass: { [curveId]: bool } } from the last graded submission; a step's
//              checklist tick turns green ONLY for curves that actually passed, so a
//              merely-drawn (but ungraded) curve never looks "correct".
const DEFAULT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
const VB_W = 480, VB_H = 320;
const PAD_L = 46, PAD_R = 14, PAD_T = 14, PAD_B = 38;
const PLOT_X0 = PAD_L, PLOT_X1 = VB_W - PAD_R, PLOT_Y0 = PAD_T, PLOT_Y1 = VB_H - PAD_B;
const PLOT_W = PLOT_X1 - PLOT_X0, PLOT_H = PLOT_Y1 - PLOT_Y0;

const fmt = v => {
  const r = Math.round(v * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : String(r);
};

function catmullRom(P) {
  if (P.length < 3) return "M" + P.map(p => `${p[0]},${p[1]}`).join(" L");
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// Screen-space path for a curve. Straight = polyline; curved = smooth spline, with a
// single-segment "bow" when only two points exist so concavity reads visually.
function buildPath(P, shape) {
  if (P.length < 2) return "";
  if (shape === "line") return "M" + P.map(p => `${p[0]},${p[1]}`).join(" L");
  if (P.length === 2) {
    const [a, b] = P, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const k = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18;
    const off = shape === "curveUp" ? k : -k; // screen-y grows downward
    return `M${a[0]},${a[1]} Q${mx},${my + off} ${b[0]},${b[1]}`;
  }
  return catmullRom(P);
}

const SHAPES = [
  { id: "line", label: "Straight" },
  { id: "curveUp", label: "Curve ↑" },
  { id: "curveDown", label: "Curve ↓" },
];

export function GraphField({ config, value, onChange, disabled = false, readOnly = false, grade = null }) {
  const { border, text, muted, isLight, card } = useTheme();
  const { xMin, xMax, yMin, yMax, xTick, yTick, xLabel, yLabel } = config;
  const curves = config.curves || [];
  const data = parseGraphValue(value);
  const dataRef = useRef(data); dataRef.current = data;
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const activeRef = useRef(curves[0]?.id);
  if (!activeRef.current && curves[0]) activeRef.current = curves[0].id;
  const interactive = !readOnly && !disabled;
  const [hover, setHover] = useState(null); // { x, y } snapped data coords under the cursor

  const sx = x => PLOT_X0 + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const sy = y => PLOT_Y0 + (1 - (y - yMin) / (yMax - yMin)) * PLOT_H;
  const dx = vx => xMin + ((vx - PLOT_X0) / PLOT_W) * (xMax - xMin);
  const dy = vy => yMin + (1 - (vy - PLOT_Y0) / PLOT_H) * (yMax - yMin);
  const snapDiv = config.snapDiv || 10; // sub-divisions per gridline tick (override per graph)
  const snap = (v, step, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v / step) * step));
  const snapX = v => snap(v, xTick / snapDiv, xMin, xMax);
  const snapY = v => snap(v, yTick / snapDiv, yMin, yMax);

  const colorOf = (c, i) => c.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  const isFrozen = id => !!grade?.pass?.[id]; // a curve graded correct locks in place (no Submit model)
  const gridColor = isLight ? "#e5e7eb" : "#3a3b3d";
  const axisColor = isLight ? "#9ca3af" : "#6b7280";
  const svgBg = isLight ? "#ffffff" : "#1c1d1e";

  const commit = mut => {
    const next = JSON.parse(JSON.stringify(dataRef.current.curves ? dataRef.current : { curves: {} }));
    if (!next.curves) next.curves = {};
    mut(next);
    onChange && onChange(JSON.stringify(next));
  };
  const ensure = (n, id) => (n.curves[id] || (n.curves[id] = { pts: [], shape: "line" }));

  const toVB = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { vx: ((e.clientX - r.left) / r.width) * VB_W, vy: ((e.clientY - r.top) / r.height) * VB_H };
  };

  const onDown = e => {
    if (!interactive) return;
    const { vx, vy } = toVB(e);
    if (vx < PLOT_X0 - 4 || vx > PLOT_X1 + 4 || vy < PLOT_Y0 - 4 || vy > PLOT_Y1 + 4) return;
    const id = activeRef.current;
    if (isFrozen(id)) return; // locked: a curve that's graded correct can't be edited
    const cur = data.curves?.[id] || { pts: [] };
    let idx = -1, best = 144; // ~12px hit radius (viewBox units)
    cur.pts.forEach((p, i) => {
      const d2 = (sx(p[0]) - vx) ** 2 + (sy(p[1]) - vy) ** 2;
      if (d2 < best) { best = d2; idx = i; }
    });
    svgRef.current.setPointerCapture(e.pointerId);
    if (idx >= 0) gestureRef.current = { type: "point", idx, moved: false, startVX: vx, startVY: vy };
    else gestureRef.current = { type: "bg", x: snapX(dx(vx)), y: snapY(dy(vy)), moved: false, startVX: vx, startVY: vy };
  };
  const onMove = e => {
    if (!interactive) { gestureRef.current = null; return; } // disabled mid-gesture (curve locked) → stop dragging
    const { vx, vy } = toVB(e);
    {
      const inPlot = vx >= PLOT_X0 - 2 && vx <= PLOT_X1 + 2 && vy >= PLOT_Y0 - 2 && vy <= PLOT_Y1 + 2;
      setHover(inPlot ? { x: snapX(dx(vx)), y: snapY(dy(vy)) } : null);
    }
    const g = gestureRef.current;
    if (!g) return;
    if (isFrozen(activeRef.current)) { gestureRef.current = null; return; } // curve locked mid-drag → freeze it in place
    if (Math.hypot(vx - g.startVX, vy - g.startVY) > 4) g.moved = true;
    if (g.type === "point") {
      const nx = snapX(dx(vx)), ny = snapY(dy(vy));
      commit(n => { const c = ensure(n, activeRef.current); if (c.pts[g.idx]) c.pts[g.idx] = [nx, ny]; });
    }
  };
  const onUp = () => {
    const g = gestureRef.current; gestureRef.current = null;
    if (!g) return;
    if (g.type === "point") {
      if (!g.moved) commit(n => { ensure(n, activeRef.current).pts.splice(g.idx, 1); });
      else commit(n => { ensure(n, activeRef.current).pts.sort((a, b) => a[0] - b[0]); });
    } else if (!g.moved) {
      commit(n => { const c = ensure(n, activeRef.current); c.pts.push([g.x, g.y]); c.pts.sort((a, b) => a[0] - b[0]); });
    }
  };

  const setShape = shape => { if (!isFrozen(activeRef.current)) commit(n => { ensure(n, activeRef.current).shape = shape; }); };
  const clearActive = () => { if (!isFrozen(activeRef.current)) commit(n => { if (n.curves[activeRef.current]) n.curves[activeRef.current].pts = []; }); };
  // activeRef drives interaction; force a re-render on curve switch via onChange-free state.
  const rerender = useRerender();
  const setActive = id => { activeRef.current = id; rerender(); };

  // When the active curve locks in (turns green), auto-advance to the next unsolved curve so the
  // student keeps plotting without clicking a chip. Keyed on the pass map so it fires on each lock.
  const passKey = JSON.stringify(grade?.pass || {});
  useEffect(() => {
    if (!interactive || !isFrozen(activeRef.current)) return;
    const next = curves.find(c => !isFrozen(c.id));
    if (next && next.id !== activeRef.current) { activeRef.current = next.id; rerender(); }
  }, [passKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const xticks = [], yticks = [];
  for (let v = xMin; v <= xMax + 1e-9; v += xTick) xticks.push(Math.round(v * 1e6) / 1e6);
  for (let v = yMin; v <= yMax + 1e-9; v += yTick) yticks.push(Math.round(v * 1e6) / 1e6);

  const activeId = activeRef.current;
  const activeShape = data.curves?.[activeId]?.shape || "line";
  const activeEmpty = !(data.curves?.[activeId]?.pts || []).length;

  const chip = (active, color) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8,
    border: `1px solid ${active ? color : border}`, background: active ? color + "22" : "transparent",
    color: text, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
  });
  const sbtn = on => ({
    padding: "5px 11px", borderRadius: 8, border: `1px solid ${on ? text : border}`,
    background: on ? text + "18" : "transparent", color: text, fontSize: 13, cursor: "pointer", fontWeight: on ? 700 : 500,
  });

  // Optional step-by-step guide rendered beside the plot (interactive only). Each step has THREE
  // states so a drawn-but-ungraded curve never masquerades as correct: "empty" (not drawn),
  // "drawn" (meets the step's point/shape criteria — neutral blue, work in progress), and
  // "correct" (green — only after a Submit that graded it right, via the `grade.pass` map).
  const guide = interactive ? config.guide : null;
  const stepDrawn = step => {
    const c = data.curves?.[step.curve];
    const pts = c?.pts || [];
    if (step.minPoints && pts.length < step.minPoints) return false;
    if (step.shape && (c?.shape || "line") !== step.shape) return false;
    return (pts.length || 0) >= 2;
  };
  const stepState = step =>
    grade?.pass?.[step.curve] ? "correct" : stepDrawn(step) ? "drawn" : "empty";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", maxWidth: guide ? 940 : 540 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 360px", minWidth: 0, maxWidth: 540 }}>
      {interactive && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {curves.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 13 }}>Curve:</span>
              {curves.map((c, i) => (
                <button key={c.id} type="button" onClick={() => setActive(c.id)} style={chip(activeId === c.id, colorOf(c, i))}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(c, i), display: "inline-block" }} />
                  {c.label}
                  {isFrozen(c.id) && <span style={{ color: "#4ade80", fontWeight: 900 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ color: muted, fontSize: 13 }}>Shape:</span>
            {SHAPES.map(sh => (
              <button key={sh.id} type="button" onClick={() => setShape(sh.id)} style={sbtn(activeShape === sh.id)}>{sh.label}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={clearActive} style={{ ...sbtn(false), color: muted }}>Clear</button>
              <InfoDot title="How to plot" align="right">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>Click in the plot to add a point. Drag a point to move it; click a point to remove it.</div>
                  <div>Pick each curve's <strong>shape</strong> with the buttons above. The readout shows the coordinate under your cursor.</div>
                </div>
              </InfoDot>
            </div>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={VB_W}
        height={VB_H}
        style={{ width: "100%", height: "auto", background: svgBg, border: `1px solid ${border}`, borderRadius: 10, touchAction: "none", cursor: interactive ? "crosshair" : "default" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
      >
        {/* gridlines */}
        {xticks.map(v => <line key={"gx" + v} x1={sx(v)} y1={PLOT_Y0} x2={sx(v)} y2={PLOT_Y1} stroke={gridColor} strokeWidth={1} />)}
        {yticks.map(v => <line key={"gy" + v} x1={PLOT_X0} y1={sy(v)} x2={PLOT_X1} y2={sy(v)} stroke={gridColor} strokeWidth={1} />)}
        {/* axes */}
        <line x1={PLOT_X0} y1={PLOT_Y0} x2={PLOT_X0} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        <line x1={PLOT_X0} y1={PLOT_Y1} x2={PLOT_X1} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        {/* tick labels */}
        {xticks.map(v => <text key={"tx" + v} x={sx(v)} y={PLOT_Y1 + 17} fill={muted} fontSize={13} textAnchor="middle">{fmt(v)}</text>)}
        {yticks.map(v => <text key={"ty" + v} x={PLOT_X0 - 6} y={sy(v) + 4} fill={muted} fontSize={13} textAnchor="end">{fmt(v)}</text>)}
        {/* axis labels */}
        {xLabel && <text x={(PLOT_X0 + PLOT_X1) / 2} y={VB_H - 5} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle">{xLabel}</text>}
        {yLabel && <text x={11} y={(PLOT_Y0 + PLOT_Y1) / 2} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle" transform={`rotate(-90 11 ${(PLOT_Y0 + PLOT_Y1) / 2})`}>{yLabel}</text>}

        {/* curves */}
        {curves.map((c, i) => {
          const cur = data.curves?.[c.id];
          if (!cur || !cur.pts?.length) return null;
          const color = colorOf(c, i);
          const P = [...cur.pts].sort((a, b) => a[0] - b[0]).map(p => [sx(p[0]), sy(p[1])]);
          const isActive = c.id === activeId;
          const frozen = interactive && isFrozen(c.id);
          const r = isActive && interactive ? 5 : 3.5;
          return (
            <g key={c.id} opacity={interactive && !isActive && !frozen ? 0.55 : 1}>
              {P.length >= 2 && <path d={buildPath(P, cur.shape || "line")} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />}
              {frozen && P.map((p, j) => <circle key={"lk" + j} cx={p[0]} cy={p[1]} r={r + 3} fill="none" stroke="#4ade80" strokeWidth={1.5} />)}
              {P.map((p, j) => <circle key={j} cx={p[0]} cy={p[1]} r={r} fill={color} stroke={svgBg} strokeWidth={1.5} />)}
            </g>
          );
        })}

        {interactive && activeEmpty && !hover && (
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={(PLOT_Y0 + PLOT_Y1) / 2} fill={muted} fontSize={14} textAnchor="middle">Click to add points</text>
        )}

        {/* Hover crosshair + coordinate readout — shows the snapped point the next click places. */}
        {interactive && hover && (() => {
          const px = sx(hover.x), py = sy(hover.y);
          const rightSide = px > (PLOT_X0 + PLOT_X1) / 2;
          const topSide = py < PLOT_Y0 + 26;
          return (
            <g pointerEvents="none">
              <line x1={px} y1={PLOT_Y0} x2={px} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <line x1={PLOT_X0} y1={py} x2={PLOT_X1} y2={py} stroke={axisColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <circle cx={px} cy={py} r={3.5} fill="none" stroke={text} strokeWidth={1.5} />
              <text
                x={px + (rightSide ? -8 : 8)}
                y={py + (topSide ? 19 : -9)}
                fill={text} fontSize={14} fontWeight={700}
                textAnchor={rightSide ? "end" : "start"}
                style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3, strokeLinejoin: "round" }}
              >
                ({fmt(hover.x)}, {fmt(hover.y)})
              </text>
            </g>
          );
        })()}
      </svg>

      </div>

      {guide && (
        <aside style={{ flex: "1 1 240px", minWidth: 210, maxWidth: 320, border: `1px solid ${border}`, borderRadius: 10, padding: "13px 15px", background: isLight ? "#f8fafc" : "#202122" }}>
          <div style={{ color: text, fontWeight: 700, fontSize: 15, marginBottom: 9 }}>{guide.title || "How to plot it"}</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {guide.steps.map((step, i) => {
              const state = stepState(step);
              const cv = curves.find(c => c.id === step.curve);
              const box = state === "correct"
                ? { border: "1.5px solid #4ade80", background: "#4ade80", glyph: "✓", glyphColor: "#0b3b18" }
                : state === "drawn"
                  ? { border: "1.5px solid #3b82f6", background: "#3b82f633", glyph: "•", glyphColor: "#3b82f6" }
                  : { border: `1.5px solid ${border}`, background: "transparent", glyph: "", glyphColor: "transparent" };
              return (
                <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, marginTop: 1, border: box.border, background: box.background, color: box.glyphColor, fontSize: 12, fontWeight: 900, lineHeight: "15px", textAlign: "center" }}>{box.glyph}</span>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: state === "correct" ? muted : text }}>
                    {cv && <span style={{ color: colorOf(cv, curves.indexOf(cv)), fontWeight: 700 }}>{cv.label}: </span>}
                    <MathText>{step.label}</MathText>
                    {step.note && <> <InfoDot title="More detail"><MathText>{step.note}</MathText></InfoDot></>}
                  </div>
                </li>
              );
            })}
          </ol>
          <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${border}`, color: muted, fontSize: 12.5, lineHeight: 1.45 }}>
            Each box turns <span style={{ color: "#4ade80", fontWeight: 700 }}>green ✓</span> and locks the moment that curve is in the right place — no Submit needed.
          </div>
        </aside>
      )}
    </div>
  );
}

// Tiny re-render hook for the curve selector (activeRef is a ref so switching is local).
function useRerender() {
  const [, set] = useState(0);
  return () => set(n => n + 1);
}
