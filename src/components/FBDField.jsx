import { useRef, useState, useEffect } from "react";
import { useTheme } from "../theme.js";
import { parseFBDValue, FORCE_TYPES } from "../homework.js";
import { MathText } from "./MathText.jsx";
import { axisLabelTspans } from "./VectorField.jsx";
import { InfoDot } from "./InfoDot.jsx";

// Controlled free-body-diagram builder for homework `answerType: "fbd"`.
//
// The student builds an FBD with the full lecture method: (1) draw every force acting on the
// body — chosen from a *bank* of the basic force types (generic F, tension T, normal N,
// weight w, friction f), drawing any number of each; (2) assign positive axes; (3) note any
// angles for off-axis forces; (4) place a little acceleration arrow off to the side (or mark
// "no acceleration"). We never list the forces for them — they pick from the bank, and each
// repeated force of a type gets an auto subscript (N₁, N₂, …). All force arrows share one
// color (blue) so the diagram reads as "forces"; the acceleration arrow is a distinct color.
//
// Grading is deterministic (`gradeFBD` in homework.js): forces matched as a multiset by
// type+direction, acceleration by direction. Axes orientation is a required step but ungraded.
//
// Props mirror VectorField: { config, value (JSON string), onChange, disabled, readOnly, grade }.
// config.fbd shape is documented in homework.js (gradeFBD).
const FORCE_COLOR = "#3b82f6";   // all forces share one color — the label disambiguates them
const ACCEL_COLOR = "#f59e0b";   // acceleration is conceptually not a force → its own color
const VB_W = 480, VB_H = 320;
const PAD = 16;
const PLOT_X0 = PAD, PLOT_X1 = VB_W - PAD, PLOT_Y0 = PAD, PLOT_Y1 = VB_H - PAD;
const PLOT_W = PLOT_X1 - PLOT_X0, PLOT_H = PLOT_Y1 - PLOT_Y0;

const TYPE_ORDER = ["F", "T", "N", "w", "f"];
const TYPE_NAME = { F: "Applied force", T: "Tension", N: "Normal", w: "Weight", f: "Friction" };

export function FBDField({ config, value, onChange, disabled = false, readOnly = false, grade = null }) {
  const { border, text, muted, isLight } = useTheme();
  const fbd = config || {};
  const { xMin = -1.5, xMax = 1.5, yMin = -1.5, yMax = 1.5, xTick = 1, yTick = 1 } = fbd;
  const origin = fbd.origin || [0, 0];
  const bank = fbd.bank || ["F", "T", "N", "w"];
  const prefill = fbd.prefill || [];
  const data = parseFBDValue(value);
  const dataRef = useRef(data); dataRef.current = data;
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const idRef = useRef(1);
  const interactive = !readOnly && !disabled;
  const [tool, setTool] = useState(null);    // armed force type, "accel", or null
  const [activeId, setActiveId] = useState(null);
  const [hover, setHover] = useState(null);

  // Seed the id counter past any ids already in the value (so resumed drafts don't collide).
  useEffect(() => {
    const maxN = Object.keys(data.forces || {}).reduce((m, k) => Math.max(m, parseInt(k.replace(/\D/g, ""), 10) || 0), 0);
    if (maxN >= idRef.current) idRef.current = maxN + 1;
  }); // every render is cheap; keeps the counter monotonic

  const sx = x => PLOT_X0 + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const sy = y => PLOT_Y0 + (1 - (y - yMin) / (yMax - yMin)) * PLOT_H;
  const dx = vx => xMin + ((vx - PLOT_X0) / PLOT_W) * (xMax - xMin);
  const dy = vy => yMin + (1 - (vy - PLOT_Y0) / PLOT_H) * (yMax - yMin);
  const snapDiv = fbd.snapDiv || 30;
  const snap = (v, step, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v / step) * step));
  const snapX = v => snap(v, xTick / snapDiv, xMin, xMax);
  const snapY = v => snap(v, yTick / snapDiv, yMin, yMax);

  const gridColor = isLight ? "#e5e7eb" : "#3a3b3d";
  const axisColor = isLight ? "#9ca3af" : "#6b7280";
  const svgBg = isLight ? "#ffffff" : "#1c1d1e";
  const isFrozen = id => grade?.pass?.[id] === true; // a force matched to the key locks in place

  const commit = mut => {
    const next = JSON.parse(JSON.stringify(dataRef.current));
    if (!next.forces) next.forces = {};
    mut(next);
    onChange && onChange(JSON.stringify(next));
  };
  const toVB = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { vx: ((e.clientX - r.left) / r.width) * VB_W, vy: ((e.clientY - r.top) / r.height) * VB_H };
  };
  const near = (px, py, vx, vy) => (px - vx) ** 2 + (py - vy) ** 2 < 156; // ~12.5px hit radius

  // ── Ordered list of every rendered force (prefilled first, then student by id) + subscripts.
  const studentIds = Object.keys(data.forces || {})
    .filter(id => Array.isArray(data.forces[id]?.tip))
    .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
  const rendered = [
    ...prefill.map((p, i) => ({ key: "pf" + i, type: p.type, tip: [p.dir[0] + origin[0], p.dir[1] + origin[1]], prefill: true })),
    ...studentIds.map(id => ({ key: id, type: data.forces[id].type, tip: data.forces[id].tip, prefill: false })),
  ];
  const typeCounts = {};
  rendered.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
  const typeSeen = {};
  const labelFor = r => {
    typeSeen[r.type] = (typeSeen[r.type] || 0) + 1;
    const sym = FORCE_TYPES[r.type] || r.type;
    return typeCounts[r.type] > 1 ? `${sym}_{${typeSeen[r.type]}}` : sym;
  };

  // ── Pointer interaction (interactive mode only) ─────────────────────────────────
  const onDown = e => {
    if (!interactive) return;
    const { vx, vy } = toVB(e);
    if (vx < PLOT_X0 - 4 || vx > PLOT_X1 + 4 || vy < PLOT_Y0 - 4 || vy > PLOT_Y1 + 4) return;
    svgRef.current.setPointerCapture(e.pointerId);
    // 1) grab an existing (unlocked) force tip?
    for (const id of studentIds) {
      if (isFrozen(id)) continue;
      const tip = data.forces[id].tip;
      if (near(sx(tip[0]), sy(tip[1]), vx, vy)) {
        setActiveId(id);
        gestureRef.current = { kind: "force-tip", id, moved: false, sx0: vx, sy0: vy };
        return;
      }
    }
    // 2) grab the acceleration arrow's tip or tail?
    const a = data.accel;
    if (a && Array.isArray(a.tip)) {
      if (near(sx(a.tip[0]), sy(a.tip[1]), vx, vy)) { gestureRef.current = { kind: "accel-tip", moved: false, sx0: vx, sy0: vy }; return; }
      if (Array.isArray(a.tail) && near(sx(a.tail[0]), sy(a.tail[1]), vx, vy)) { gestureRef.current = { kind: "accel-tail", moved: false, sx0: vx, sy0: vy }; return; }
    }
    // 3) background — resolved on pointer-up against the armed tool
    gestureRef.current = { kind: "bg", x: snapX(dx(vx)), y: snapY(dy(vy)), moved: false, sx0: vx, sy0: vy };
  };
  const onMove = e => {
    if (!interactive) { gestureRef.current = null; return; }
    const { vx, vy } = toVB(e);
    const inPlot = vx >= PLOT_X0 - 2 && vx <= PLOT_X1 + 2 && vy >= PLOT_Y0 - 2 && vy <= PLOT_Y1 + 2;
    setHover(inPlot ? { x: snapX(dx(vx)), y: snapY(dy(vy)) } : null);
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "force-tip" && isFrozen(g.id)) { gestureRef.current = null; return; }
    if (Math.hypot(vx - g.sx0, vy - g.sy0) > 4) g.moved = true;
    const nx = snapX(dx(vx)), ny = snapY(dy(vy));
    if (g.kind === "force-tip") commit(n => { if (n.forces[g.id]) n.forces[g.id].tip = [nx, ny]; });
    else if (g.kind === "accel-tip") commit(n => { if (n.accel) n.accel.tip = [nx, ny]; });
    else if (g.kind === "accel-tail") commit(n => { if (n.accel) n.accel.tail = [nx, ny]; });
  };
  const onUp = () => {
    const g = gestureRef.current; gestureRef.current = null;
    if (!g) return;
    if (g.kind === "force-tip" && !g.moved) { if (!isFrozen(g.id)) commit(n => { delete n.forces[g.id]; }); return; }
    if (g.kind === "accel-tip" && !g.moved) { commit(n => { n.accel = null; }); return; }
    if (g.kind === "accel-tail" && !g.moved) { commit(n => { if (n.accel && !Array.isArray(n.accel.tip)) n.accel = null; }); return; }
    if (g.kind !== "bg" || g.moved) return;
    if (tool && FORCE_TYPES[tool]) {
      const id = "s" + idRef.current++;
      commit(n => { n.forces[id] = { type: tool, tip: [g.x, g.y] }; });
      setActiveId(id);
    } else if (tool === "accel") {
      commit(n => {
        if (!n.accel || n.accel.none) n.accel = { tail: [g.x, g.y] };          // first click: place the tail
        else if (!Array.isArray(n.accel.tip)) n.accel.tip = [g.x, g.y];         // second click: place the tip
      });
    }
  };

  const setNoAccel = () => { setTool(null); commit(n => { n.accel = { none: true }; }); };
  const clearAccel = () => commit(n => { n.accel = null; });
  const rotateAxes = deg => commit(n => { n.axes = { angle: (((n.axes?.angle || 0) + deg) % 360 + 360) % 360 }; });
  const axesAngle = data.axes?.angle || 0;
  const accelArmed = tool === "accel";

  // ── Guide / process checklist state ─────────────────────────────────────────────
  const forcesState = grade?.pass?._forces ? "correct" : (studentIds.length || prefill.length) ? "drawn" : "empty";
  const accelState = grade?.pass?._accel ? "correct"
    : data.accel?.none || Array.isArray(data.accel?.tip) ? "drawn" : "empty";
  const axesState = "drawn"; // axes always have a value (standard by default); ungraded info step

  // ── Sub-renderers ───────────────────────────────────────────────────────────────
  const Arrow = ({ tail, tip, color, label, italic, locked, dim, accent }) => {
    const tailX = sx(tail[0]), tailY = sy(tail[1]), tx = sx(tip[0]), ty = sy(tip[1]);
    const ang = Math.atan2(ty - tailY, tx - tailX);
    const len = Math.hypot(tx - tailX, ty - tailY);
    if (len < 0.5) return null;
    const head = Math.min(12, len), wing = head * 0.5;
    const bx = tx - head * Math.cos(ang), by = ty - head * Math.sin(ang);
    const p1 = [bx - wing * Math.sin(ang), by + wing * Math.cos(ang)];
    const p2 = [bx + wing * Math.sin(ang), by - wing * Math.cos(ang)];
    return (
      <g opacity={dim ? 0.55 : 1}>
        {accent && <line x1={tailX} y1={tailY} x2={tx} y2={ty} stroke={color} strokeWidth={7} strokeLinecap="round" opacity={0.18} />}
        <line x1={tailX} y1={tailY} x2={tx} y2={ty} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <polygon points={`${tx},${ty} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={color} />
        {locked && <circle cx={tx} cy={ty} r={9} fill="none" stroke="#4ade80" strokeWidth={2} />}
        {label && (
          <text x={tx + 9 * Math.cos(ang)} y={ty + 9 * Math.sin(ang)} fill={color} fontSize={16} fontWeight={700}
            fontStyle={italic ? "italic" : "normal"}
            textAnchor={tx >= tailX ? "start" : "end"} dominantBaseline={ty >= tailY ? "hanging" : "auto"}
            style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3.5, strokeLinejoin: "round" }}>
            {axisLabelTspans(label)}
          </text>
        )}
      </g>
    );
  };

  const ox = sx(origin[0]), oy = sy(origin[1]);
  // Axes gizmo anchored in the lower-left, rotated by the chosen +x angle.
  const gizmo = (() => {
    const gx = PLOT_X0 + 30, gy = PLOT_Y1 - 30, L = 26;
    const rad = (axesAngle * Math.PI) / 180;
    const xEnd = [gx + L * Math.cos(rad), gy - L * Math.sin(rad)];
    const yEnd = [gx + L * Math.cos(rad + Math.PI / 2), gy - L * Math.sin(rad + Math.PI / 2)];
    return { gx, gy, xEnd, yEnd };
  })();

  const xticks = [], yticks = [];
  for (let v = xMin; v <= xMax + 1e-9; v += xTick) xticks.push(v);
  for (let v = yMin; v <= yMax + 1e-9; v += yTick) yticks.push(v);

  // ── Toolbar ─────────────────────────────────────────────────────────────────────
  const toolBtn = (on, color) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8,
    border: `1px solid ${on ? (color || text) : border}`, background: on ? (color || text) + "22" : "transparent",
    color: text, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", maxWidth: 960 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 380px", minWidth: 0, maxWidth: 560 }}>
        {interactive && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                Force bank:
                <InfoDot title="Drawing forces">
                  Pick a force type, then click in the diagram to draw its arrow from the body (the dot at the center). Draw as many of each type as the body actually feels — repeats are numbered automatically (e.g. <MathText>{"$N_1, N_2$"}</MathText>). Drag a tip to move it; click a tip to delete it.
                </InfoDot>
              </span>
              {bank.map(t => (
                <button key={t} type="button" onClick={() => setTool(tool === t ? null : t)} style={toolBtn(tool === t, FORCE_COLOR)} title={TYPE_NAME[t]}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: FORCE_COLOR, display: "inline-block" }} />
                  <span style={{ fontStyle: t === "f" ? "italic" : "normal", fontWeight: 700 }}>{FORCE_TYPES[t]}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                Acceleration:
                <InfoDot title="Acceleration arrow">
                  After your forces, show the direction of the body's acceleration with a small arrow placed <em>off to the side</em> (two clicks: tail, then tip) — not from the body like the forces. If the body is in equilibrium (not accelerating), press “No acceleration” instead.
                </InfoDot>
              </span>
              <button type="button" onClick={() => setTool(accelArmed ? null : "accel")} style={toolBtn(accelArmed, ACCEL_COLOR)}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: ACCEL_COLOR, display: "inline-block" }} />↗ Draw <MathText>{"$\\vec a$"}</MathText>
              </button>
              <button type="button" onClick={setNoAccel} style={toolBtn(data.accel?.none, muted)}>⊘ No acceleration</button>
              {(data.accel?.none || Array.isArray(data.accel?.tip) || Array.isArray(data.accel?.tail)) && (
                <button type="button" onClick={clearAccel} style={{ ...toolBtn(false), color: muted }}>Clear <MathText>{"$\\vec a$"}</MathText></button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                Positive axes:
                <InfoDot title="Assign your axes">
                  Set which way is positive <MathText>{"$+x$"}</MathText> and <MathText>{"$+y$"}</MathText> for this problem (rotate them if an incline makes tilted axes convenient). This is part of the method but isn't graded.
                </InfoDot>
              </span>
              <button type="button" onClick={() => rotateAxes(-15)} style={toolBtn(false)}>↺</button>
              <span style={{ color: text, fontSize: 13, minWidth: 70, textAlign: "center" }}>+x at {Math.round(axesAngle)}°</span>
              <button type="button" onClick={() => rotateAxes(15)} style={toolBtn(false)}>↻</button>
            </div>
          </>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width={VB_W} height={VB_H}
          style={{ width: "100%", height: "auto", background: svgBg, border: `1px solid ${border}`, borderRadius: 10, touchAction: "none", cursor: interactive ? "crosshair" : "default" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
        >
          {xticks.map((v, i) => <line key={"gx" + i} x1={sx(v)} y1={PLOT_Y0} x2={sx(v)} y2={PLOT_Y1} stroke={gridColor} strokeWidth={1} />)}
          {yticks.map((v, i) => <line key={"gy" + i} x1={PLOT_X0} y1={sy(v)} x2={PLOT_X1} y2={sy(v)} stroke={gridColor} strokeWidth={1} />)}

          {/* the body (origin) */}
          <rect x={ox - 17} y={oy - 17} width={34} height={34} rx={5} fill={isLight ? "#fde9cf" : "#3a3326"} stroke={axisColor} strokeWidth={1.5} />
          {fbd.bodyLabel && <text x={ox} y={oy + 1} fill={text} fontSize={15} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{fbd.bodyLabel}</text>}

          {/* axes gizmo (positive-axis indicator) */}
          <g pointerEvents="none">
            <line x1={gizmo.gx} y1={gizmo.gy} x2={gizmo.xEnd[0]} y2={gizmo.xEnd[1]} stroke={axisColor} strokeWidth={1.5} strokeDasharray="4 3" />
            <line x1={gizmo.gx} y1={gizmo.gy} x2={gizmo.yEnd[0]} y2={gizmo.yEnd[1]} stroke={axisColor} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={gizmo.xEnd[0]} y={gizmo.xEnd[1]} dx={4} dy={4} fill={muted} fontSize={12} fontWeight={700}>{axisLabelTspans("+x")}</text>
            <text x={gizmo.yEnd[0]} y={gizmo.yEnd[1]} dx={-4} dy={-3} fill={muted} fontSize={12} fontWeight={700} textAnchor="end">{axisLabelTspans("+y")}</text>
          </g>

          {/* forces */}
          {rendered.map(r => (
            <Arrow key={r.key} tail={origin} tip={r.tip} color={FORCE_COLOR} label={labelFor(r)} italic={r.type === "f"}
              locked={interactive && (r.prefill || isFrozen(r.key))} dim={r.prefill && interactive}
              accent={interactive && r.key === activeId && !isFrozen(r.key)} />
          ))}

          {/* acceleration */}
          {data.accel && Array.isArray(data.accel.tip) && Array.isArray(data.accel.tail) && (
            <Arrow tail={data.accel.tail} tip={data.accel.tip} color={ACCEL_COLOR} label="a" italic />
          )}
          {data.accel && Array.isArray(data.accel.tail) && !Array.isArray(data.accel.tip) && (
            <circle cx={sx(data.accel.tail[0])} cy={sy(data.accel.tail[1])} r={4} fill={svgBg} stroke={ACCEL_COLOR} strokeWidth={2} />
          )}
          {interactive && data.accel?.none && (
            <text x={PLOT_X1 - 8} y={PLOT_Y0 + 16} fill={ACCEL_COLOR} fontSize={13} fontWeight={700} textAnchor="end">{axisLabelTspans("a = 0 (equilibrium)")}</text>
          )}

          {/* prompt / hover */}
          {interactive && !tool && rendered.length === 0 && (
            <text x={(PLOT_X0 + PLOT_X1) / 2} y={PLOT_Y0 + 22} fill={muted} fontSize={13.5} textAnchor="middle">Pick a force from the bank above, then click to draw it.</text>
          )}
          {interactive && tool && hover && (() => {
            const px = sx(hover.x), py = sy(hover.y);
            return <g pointerEvents="none"><circle cx={px} cy={py} r={3.5} fill="none" stroke={tool === "accel" ? ACCEL_COLOR : FORCE_COLOR} strokeWidth={1.5} /></g>;
          })()}
        </svg>
      </div>

      {interactive && (
        <aside style={{ flex: "1 1 250px", minWidth: 220, maxWidth: 330, border: `1px solid ${border}`, borderRadius: 10, padding: "13px 15px", background: isLight ? "#f8fafc" : "#202122" }}>
          <div style={{ color: text, fontWeight: 700, fontSize: 15, marginBottom: 9 }}>Free-body diagram — the method</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            <GuideStep n={1} state={forcesState} text={text} muted={muted} border={border}
              label="Draw & label every force acting on the body" note="One arrow per push or pull the body actually feels (contact forces, ropes, applied pushes) — plus gravity. Pick each from the bank; repeats auto-number." />
            <GuideStep n={2} state={axesState} text={text} muted={muted} border={border} info
              label="Assign your positive axes" note="Choose which way is $+x$ and $+y$ (rotate for inclines). Required step, not graded." />
            <GuideStep n={3} state="drawn" text={text} muted={muted} border={border} info
              label="Describe any angles" note="If a force doesn't lie along an axis, note the angle it makes with one. (Here every force lies along an axis, so there's nothing to label.)" />
            <GuideStep n={4} state={accelState} text={text} muted={muted} border={border}
              label="Show the acceleration direction" note="A small arrow off to the side for the body's acceleration — or mark “no acceleration” if it's in equilibrium." />
          </ol>
          <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${border}`, color: muted, fontSize: 12.5, lineHeight: 1.45 }}>
            Steps turn <span style={{ color: "#4ade80", fontWeight: 700 }}>green ✓</span> as you get the forces and acceleration right; the part scores when all are correct.
          </div>
        </aside>
      )}
    </div>
  );
}

function GuideStep({ n, state, label, note, text, muted, border, info }) {
  const box = state === "correct"
    ? { border: "1.5px solid #4ade80", background: "#4ade80", glyph: "✓", glyphColor: "#0b3b18" }
    : state === "drawn"
      ? { border: "1.5px solid #3b82f6", background: "#3b82f633", glyph: info ? "•" : "•", glyphColor: "#3b82f6" }
      : { border: `1.5px solid ${border}`, background: "transparent", glyph: "", glyphColor: "transparent" };
  return (
    <li style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, marginTop: 1, border: box.border, background: box.background, color: box.glyphColor, fontSize: 12, fontWeight: 900, lineHeight: "15px", textAlign: "center" }}>{box.glyph}</span>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: state === "correct" ? muted : text }}>
        <span style={{ fontWeight: 700 }}>{n}. <MathText>{label}</MathText></span>
        {note && <span style={{ display: "block", color: muted, fontSize: 12.5, marginTop: 2 }}><MathText>{note}</MathText></span>}
      </div>
    </li>
  );
}
