import { useRef, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { parseVectorValue } from "../homework.js";
import { MathText } from "./MathText.jsx";

// Controlled vector/arrow plotter for homework `answerType: "vector"` items.
//
// Students draw one or more arrows, each from a common origin to a tip they place: click in
// the plane to set the active vector's tip, drag the tip to move it, click the tip to remove
// it, and use the chips to switch which vector is active. The value is a JSON string
// { vectors: { [id]: { tip:[x,y] } } } that the grader scores deterministically (gradeVectors
// in homework.js — direction always, magnitude only when the key gives magTol). Built for
// reuse: velocity/acceleration vectors on a scaled plane AND free-body diagrams (set
// `hideTicks` and omit magTol so only directions matter).
//
// Props:
//   config   — { xMin,xMax,yMin,yMax,xTick,yTick, xLabel?,yLabel?, origin?:[x,y],
//                vectors:[{id,label,color}], snapDiv?, hideTicks?, guide? }
//   value    — JSON string (controlled)
//   onChange — (jsonString) => void
//   disabled — locked (renders read-only, no toolbar)
//   readOnly — display only (reveal / gradebook); no toolbar, no interaction
//   grade    — { pass: { [vectorId]: bool } } from the last graded submission; a step's
//              checklist tick turns green ONLY for vectors that actually passed, so a
//              merely-drawn (but ungraded) arrow never looks "correct".
const DEFAULT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899"];
const VB_W = 480, VB_H = 320;
const PAD_L = 46, PAD_R = 14, PAD_T = 14, PAD_B = 38;
const PLOT_X0 = PAD_L, PLOT_X1 = VB_W - PAD_R, PLOT_Y0 = PAD_T, PLOT_Y1 = VB_H - PAD_B;
const PLOT_W = PLOT_X1 - PLOT_X0, PLOT_H = PLOT_Y1 - PLOT_Y0;

const fmt = v => String(Math.round(v * 1000) / 1000);

// Render an axis-label string with `_x` / `_{xy}` subscripts as proper SVG subscripts
// (e.g. "v_y (m/s)" → v with a subscript y). Uses small dy nudges so it works across browsers.
export function axisLabelTspans(str) {
  const re = /_(\{[^}]+\}|[A-Za-z0-9]+)/g;
  const out = [];
  let last = 0, m, k = 0, reset = 0;
  const pushText = t => { if (t) { out.push(<tspan key={k++} dy={reset}>{t}</tspan>); reset = 0; } };
  while ((m = re.exec(str))) {
    pushText(str.slice(last, m.index));
    out.push(<tspan key={k++} dy={3} fontSize="0.72em">{m[1].replace(/[{}]/g, "")}</tspan>);
    reset = -3;
    last = re.lastIndex;
  }
  pushText(str.slice(last));
  return out;
}

// HTML counterpart of axisLabelTspans — renders `_x` / `_{xy}` as real <sub> elements for
// use outside SVG (chips, the guide's vector name). Keeps "v_1" → v₁, "F_{AB}" → F-sub-AB.
export function htmlSubscripts(str) {
  const re = /_(\{[^}]+\}|[A-Za-z0-9]+)/g;
  const out = [];
  let last = 0, m, k = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(<sub key={k++} style={{ fontSize: "0.72em" }}>{m[1].replace(/[{}]/g, "")}</sub>);
    last = re.lastIndex;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

export function VectorField({ config, value, onChange, disabled = false, readOnly = false, grade = null }) {
  const { border, text, muted, isLight } = useTheme();
  const { xMin, xMax, yMin, yMax, xTick, yTick, xLabel, yLabel } = config;
  const vectors = config.vectors || [];
  const origin = config.origin || [0, 0];
  const data = parseVectorValue(value);
  const dataRef = useRef(data); dataRef.current = data;
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const activeRef = useRef(vectors[0]?.id);
  if (!activeRef.current && vectors[0]) activeRef.current = vectors[0].id;
  const interactive = !readOnly && !disabled;
  const [hover, setHover] = useState(null); // { x, y } snapped data coords under the cursor

  const sx = x => PLOT_X0 + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const sy = y => PLOT_Y0 + (1 - (y - yMin) / (yMax - yMin)) * PLOT_H;
  const dx = vx => xMin + ((vx - PLOT_X0) / PLOT_W) * (xMax - xMin);
  const dy = vy => yMin + (1 - (vy - PLOT_Y0) / PLOT_H) * (yMax - yMin);
  const snapDiv = config.snapDiv || 10;
  const snap = (v, step, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v / step) * step));
  const snapX = v => snap(v, xTick / snapDiv, xMin, xMax);
  const snapY = v => snap(v, yTick / snapDiv, yMin, yMax);

  const colorOf = (c, i) => c.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  const isFrozen = id => !!grade?.pass?.[id]; // a vector graded correct locks in place (no Submit model)
  const gridColor = isLight ? "#e5e7eb" : "#3a3b3d";
  const axisColor = isLight ? "#9ca3af" : "#6b7280";
  const svgBg = isLight ? "#ffffff" : "#1c1d1e";

  const commit = mut => {
    const next = JSON.parse(JSON.stringify(dataRef.current.vectors ? dataRef.current : { vectors: {} }));
    if (!next.vectors) next.vectors = {};
    mut(next);
    onChange && onChange(JSON.stringify(next));
  };

  const toVB = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { vx: ((e.clientX - r.left) / r.width) * VB_W, vy: ((e.clientY - r.top) / r.height) * VB_H };
  };

  const freeTailOf = id => !!vectors.find(c => c.id === id)?.freeTail;

  const onDown = e => {
    if (!interactive) return;
    const { vx, vy } = toVB(e);
    if (vx < PLOT_X0 - 4 || vx > PLOT_X1 + 4 || vy < PLOT_Y0 - 4 || vy > PLOT_Y1 + 4) return;
    const id = activeRef.current;
    if (isFrozen(id)) return; // locked: a vector that's graded correct can't be moved or removed
    const sv = data.vectors?.[id];
    const tip = sv?.tip;
    const tail = sv?.tail || origin;
    const near = (px, py) => (px - vx) ** 2 + (py - vy) ** 2 < 144; // ~12px hit radius
    svgRef.current.setPointerCapture(e.pointerId);
    // Priority: grab the tip; else (free-tail vectors) grab an already-placed tail handle;
    // else this is a placement/bg gesture (resolved on pointer-up).
    if (tip && near(sx(tip[0]), sy(tip[1]))) {
      gestureRef.current = { type: "tip", moved: false, startVX: vx, startVY: vy };
    } else if (freeTailOf(id) && sv?.tail && near(sx(tail[0]), sy(tail[1]))) {
      gestureRef.current = { type: "tail", moved: false, startVX: vx, startVY: vy };
    } else {
      gestureRef.current = { type: "bg", x: snapX(dx(vx)), y: snapY(dy(vy)), moved: false, startVX: vx, startVY: vy };
    }
  };
  const onMove = e => {
    if (!interactive) { gestureRef.current = null; return; } // disabled mid-gesture (piece locked) → stop dragging
    const { vx, vy } = toVB(e);
    {
      const inPlot = vx >= PLOT_X0 - 2 && vx <= PLOT_X1 + 2 && vy >= PLOT_Y0 - 2 && vy <= PLOT_Y1 + 2;
      setHover(inPlot ? { x: snapX(dx(vx)), y: snapY(dy(vy)) } : null);
    }
    const g = gestureRef.current;
    if (!g) return;
    if (isFrozen(activeRef.current)) { gestureRef.current = null; return; } // piece locked mid-drag → freeze it in place
    if (Math.hypot(vx - g.startVX, vy - g.startVY) > 4) g.moved = true;
    if (g.type === "tip" || g.type === "tail") {
      const nx = snapX(dx(vx)), ny = snapY(dy(vy));
      commit(n => { (n.vectors[activeRef.current] || (n.vectors[activeRef.current] = {}))[g.type] = [nx, ny]; });
    }
  };
  const onUp = () => {
    const g = gestureRef.current; gestureRef.current = null;
    if (!g) return;
    const id = activeRef.current;
    const sv = data.vectors?.[id];
    const setProp = (k, v) => commit(n => { (n.vectors[id] || (n.vectors[id] = {}))[k] = v; });
    if (g.type === "tip" && !g.moved) {
      commit(n => { delete n.vectors[id]; });                                    // click the tip → remove the whole vector
    } else if (g.type === "tail" && !g.moved) {
      if (!sv?.tip) commit(n => { if (n.vectors[id]) delete n.vectors[id].tail; }); // click the tail before the tip is set → undo it
    } else if (g.type === "bg" && !g.moved) {
      if (freeTailOf(id)) {
        // Free vector: two-click placement — first click sets the tail, second sets the tip.
        if (!sv?.tail) setProp("tail", [g.x, g.y]);
        else if (!sv?.tip) setProp("tip", [g.x, g.y]);
        // once complete, a stray background click is ignored — drag a handle to adjust
      } else {
        setProp("tip", [g.x, g.y]);                                             // origin-rooted vector: place/replace the tip
      }
    }
  };

  const clearActive = () => { if (!isFrozen(activeRef.current)) commit(n => { delete n.vectors[activeRef.current]; }); };
  const rerender = useRerender();
  const setActive = id => { activeRef.current = id; rerender(); };

  // When the active vector locks in (turns green), auto-advance to the next unsolved one so the
  // student keeps drawing without clicking a chip. Keyed on the pass map so it fires on each lock.
  const passKey = JSON.stringify(grade?.pass || {});
  useEffect(() => {
    if (!interactive || !isFrozen(activeRef.current)) return;
    const next = vectors.find(v => !isFrozen(v.id));
    if (next && next.id !== activeRef.current) { activeRef.current = next.id; rerender(); }
  }, [passKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const xticks = [], yticks = [];
  for (let v = xMin; v <= xMax + 1e-9; v += xTick) xticks.push(Math.round(v * 1e6) / 1e6);
  for (let v = yMin; v <= yMax + 1e-9; v += yTick) yticks.push(Math.round(v * 1e6) / 1e6);
  const zeroX = xMin <= 0 && xMax >= 0, zeroY = yMin <= 0 && yMax >= 0;

  const activeId = activeRef.current;
  const ox = sx(origin[0]), oy = sy(origin[1]);

  const chip = (active, color) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8,
    border: `1px solid ${active ? color : border}`, background: active ? color + "22" : "transparent",
    color: text, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
  });
  const sbtn = on => ({
    padding: "5px 11px", borderRadius: 8, border: `1px solid ${on ? text : border}`,
    background: on ? text + "18" : "transparent", color: text, fontSize: 13, cursor: "pointer", fontWeight: on ? 700 : 500,
  });

  // Optional step-by-step guide (interactive only). Each step has THREE states so a drawn-but-
  // ungraded arrow never masquerades as correct: "empty" (not drawn), "drawn" (placed, neutral
  // blue — work in progress), "correct" (green — only after a Submit that graded it right, via
  // the `grade.pass` map). This is the fix for students mistaking a drawn checkmark for a grade.
  const guide = interactive ? config.guide : null;
  const stepState = step =>
    grade?.pass?.[step.vector] ? "correct"
      : Array.isArray(data.vectors?.[step.vector]?.tip) ? "drawn"
      : "empty";

  // An arrow from (tailX,tailY) to (tx,ty) in screen space, with a triangular head. When
  // `showTail` is set, a hollow handle marks the (draggable) tail of a free-tail vector.
  const Arrow = ({ tailX, tailY, tx, ty, color, label, faded, showTail, locked }) => {
    const ang = Math.atan2(ty - tailY, tx - tailX);
    const len = Math.hypot(tx - tailX, ty - tailY);
    if (len < 0.5) return null;
    const head = Math.min(12, len);
    const wing = head * 0.5;
    const bx = tx - head * Math.cos(ang), by = ty - head * Math.sin(ang);
    const p1 = [bx - wing * Math.sin(ang), by + wing * Math.cos(ang)];
    const p2 = [bx + wing * Math.sin(ang), by - wing * Math.cos(ang)];
    return (
      <g opacity={faded ? 0.5 : 1}>
        <line x1={tailX} y1={tailY} x2={tx} y2={ty} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <polygon points={`${tx},${ty} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={color} />
        {locked && <circle cx={tx} cy={ty} r={9} fill="none" stroke="#4ade80" strokeWidth={2} />}
        {showTail && <circle cx={tailX} cy={tailY} r={4} fill={svgBg} stroke={color} strokeWidth={2} />}
        {label && (
          <text x={tx + 8 * Math.cos(ang)} y={ty + 8 * Math.sin(ang)} fill={color} fontSize={15.5} fontWeight={700}
            textAnchor={tx >= tailX ? "start" : "end"} dominantBaseline={ty >= tailY ? "hanging" : "auto"}
            style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3, strokeLinejoin: "round" }}>
            {axisLabelTspans(label)}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", maxWidth: guide ? 940 : 540 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 360px", minWidth: 0, maxWidth: 540 }}>
        {interactive && vectors.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ color: muted, fontSize: 13 }}>Vector:</span>
            {vectors.map((c, i) => (
              <button key={c.id} type="button" onClick={() => setActive(c.id)} style={chip(activeId === c.id, colorOf(c, i))}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(c, i), display: "inline-block" }} />
                {htmlSubscripts(c.label)}
                {isFrozen(c.id) && <span style={{ color: "#4ade80", fontWeight: 900 }}>✓</span>}
              </button>
            ))}
            <button type="button" onClick={clearActive} style={{ ...sbtn(false), marginLeft: "auto", color: muted }}>Clear</button>
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
          {/* axes through the origin (or the plot edge if 0 is out of range) */}
          <line x1={zeroX ? sx(0) : PLOT_X0} y1={PLOT_Y0} x2={zeroX ? sx(0) : PLOT_X0} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
          <line x1={PLOT_X0} y1={zeroY ? sy(0) : PLOT_Y1} x2={PLOT_X1} y2={zeroY ? sy(0) : PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
          {/* tick labels (hidden for scale-free diagrams like FBDs) */}
          {!config.hideTicks && xticks.map(v => <text key={"tx" + v} x={sx(v)} y={PLOT_Y1 + 17} fill={muted} fontSize={13} textAnchor="middle">{fmt(v)}</text>)}
          {!config.hideTicks && yticks.map(v => <text key={"ty" + v} x={PLOT_X0 - 6} y={sy(v) + 4} fill={muted} fontSize={13} textAnchor="end">{fmt(v)}</text>)}
          {/* axis labels */}
          {xLabel && <text x={(PLOT_X0 + PLOT_X1) / 2} y={VB_H - 5} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle">{axisLabelTspans(xLabel)}</text>}
          {yLabel && <text x={11} y={(PLOT_Y0 + PLOT_Y1) / 2} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle" transform={`rotate(-90 11 ${(PLOT_Y0 + PLOT_Y1) / 2})`}>{axisLabelTspans(yLabel)}</text>}

          {/* origin dot */}
          <circle cx={ox} cy={oy} r={3} fill={axisColor} />

          {/* vectors */}
          {vectors.map((c, i) => {
            const sv = data.vectors?.[c.id];
            if (!sv) return null;
            const color = colorOf(c, i);
            const faded = interactive && c.id !== activeId && !isFrozen(c.id);
            // Free vector mid-placement: tail set but no tip yet — show the lone tail handle.
            if (!sv.tip) {
              return c.freeTail && sv.tail
                ? <circle key={c.id} cx={sx(sv.tail[0])} cy={sy(sv.tail[1])} r={4} fill={svgBg} stroke={color} strokeWidth={2} opacity={faded ? 0.5 : 1} />
                : null;
            }
            const tail = sv.tail || origin;
            return <Arrow key={c.id} tailX={sx(tail[0])} tailY={sy(tail[1])} tx={sx(sv.tip[0])} ty={sy(sv.tip[1])} color={color} label={c.label} faded={faded} showTail={!!c.freeTail} locked={interactive && isFrozen(c.id)} />;
          })}

          {interactive && !data.vectors?.[activeId]?.tip && !hover && (
            <text x={(PLOT_X0 + PLOT_X1) / 2} y={(PLOT_Y0 + PLOT_Y1) / 2} fill={muted} fontSize={14} textAnchor="middle">
              {freeTailOf(activeId) ? (data.vectors?.[activeId]?.tail ? "Click to place the tip (the arrow's head)" : "Click to place the tail") : "Click to draw the arrow tip"}
            </text>
          )}

          {/* Hover crosshair + coordinate readout — the snapped point the next click places. */}
          {interactive && hover && (() => {
            const px = sx(hover.x), py = sy(hover.y);
            const rightSide = px > (PLOT_X0 + PLOT_X1) / 2;
            const topSide = py < PLOT_Y0 + 26;
            return (
              <g pointerEvents="none">
                <line x1={px} y1={PLOT_Y0} x2={px} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PLOT_X0} y1={py} x2={PLOT_X1} y2={py} stroke={axisColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                <circle cx={px} cy={py} r={3.5} fill="none" stroke={text} strokeWidth={1.5} />
                {!config.hideTicks && (
                  <text
                    x={px + (rightSide ? -8 : 8)}
                    y={py + (topSide ? 19 : -9)}
                    fill={text} fontSize={14} fontWeight={700}
                    textAnchor={rightSide ? "end" : "start"}
                    style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3, strokeLinejoin: "round" }}
                  >
                    ({fmt(hover.x)}, {fmt(hover.y)})
                  </text>
                )}
              </g>
            );
          })()}
        </svg>

      </div>

      {guide && (
        <aside style={{ flex: "1 1 240px", minWidth: 210, maxWidth: 320, border: `1px solid ${border}`, borderRadius: 10, padding: "13px 15px", background: isLight ? "#f8fafc" : "#202122" }}>
          <div style={{ color: text, fontWeight: 700, fontSize: 15, marginBottom: 9 }}>{guide.title || "How to draw it"}</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {guide.steps.map((step, i) => {
              const state = stepState(step);
              const cv = vectors.find(c => c.id === step.vector);
              const vColor = cv ? colorOf(cv, vectors.indexOf(cv)) : "#3b82f6";
              // Drawn-but-not-yet-correct → color-code the box to its own vector; correct → green ✓.
              const box = state === "correct"
                ? { border: "1.5px solid #4ade80", background: "#4ade80", glyph: "✓", glyphColor: "#0b3b18" }
                : state === "drawn"
                  ? { border: `1.5px solid ${vColor}`, background: vColor + "33", glyph: "•", glyphColor: vColor }
                  : { border: `1.5px solid ${border}`, background: "transparent", glyph: "", glyphColor: "transparent" };
              return (
                <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, marginTop: 1, border: box.border, background: box.background, color: box.glyphColor, fontSize: 12, fontWeight: 900, lineHeight: "15px", textAlign: "center" }}>{box.glyph}</span>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: state === "correct" ? muted : text }}>
                    {cv && <span style={{ color: colorOf(cv, vectors.indexOf(cv)), fontWeight: 700 }}>{htmlSubscripts(cv.label)}: </span>}
                    <MathText>{step.label}</MathText>
                  </div>
                </li>
              );
            })}
          </ol>
          <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${border}`, color: muted, fontSize: 12.5, lineHeight: 1.45 }}>
            Each box turns <span style={{ color: "#4ade80", fontWeight: 700 }}>green ✓</span> (and you receive credit) when the vector has been placed correctly.
          </div>
        </aside>
      )}
    </div>
  );
}

// Tiny re-render hook for the vector selector (activeRef is a ref so switching is local).
function useRerender() {
  const [, set] = useState(0);
  return () => set(n => n + 1);
}
