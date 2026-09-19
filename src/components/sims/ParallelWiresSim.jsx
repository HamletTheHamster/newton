import { useMemo, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { wireColors, plotColors, SimSlider } from "./ui.jsx";

// Interactive two-wire magnetic-field simulation, shown beside PHY 215's Quiz 9 (Y&F Ch. 28) for
// the whole sitting (see `simulation` on the quiz object and QuizSim in App.jsx). Two very long
// straight wires run perpendicular to the page (⊙ out, ⊗ into), a distance d apart on the x-axis;
// below them the plot is the net field along the line through both wires, so the student can
// discover for themselves where the fields cancel (same-direction currents: the midpoint; opposite
// currents: nowhere), how the far field behaves, and that an opposed pair's far field shrinks as d
// shrinks. It is a discovery tool, not a graded item: nothing here is recorded.
//
// Physics: an infinite straight wire's field is B = μ0 I / 2π r, tangential. On the line through
// the wires (the x-axis, wires at x = ±d/2) each wire's field is purely ±y, and for a current I
// OUT of the page (positive here) at x0 it is B_y = (μ0/2π) I / (x − x0): positive (up the page)
// to the right of the wire, negative to the left. In the units the sliders use, A and cm,
// μ0/2π = 2×10⁻⁷ T·m/A gives B_y = 20 I / (x − x0) μT.
//
// The y-axis is FIXED (±Y_MAX), never auto-scaled, because the discovery is a comparison: a
// student who shrinks d while watching one spot on the plot must see the curve itself change,
// not the axis. The 1/r poles at the wires are therefore clipped, which is what a plot of this
// field always does. Each curve is split at the wire positions so the clipped poles do not get
// joined by a spurious vertical line.
//
// Series colors are the validated pair in ui.jsx (blue, orange); the NET field is
// drawn in the theme's text ink, which is deliberate: it is the headline series and the two wire
// contributions are its supporting detail. Both are listed in the legend and the wire glyphs
// carry the same colors, so identity is never color-alone.
//
// `onAnswer`, when the quiz screen passes it, means the part being asked accepts a point on the
// plot as an answer (a part opts in through the question's `simAnswer`, see App.jsx). The sim
// then offers its PINNED point as the answer, with the settings it was found under: what the
// point means depends entirely on which currents were flowing when it was picked, so the pick
// is described in full and the grader, not the sim, judges it. A pick never completes a part on
// its own; the runner always follows it with a request to justify the point in words.

const X_MAX = 20;      // cm, plot half-width (the wires sit within ±3 cm of the origin)
const Y_MAX = 40;      // μT, plot half-height
const K = 20;          // μT·cm/A  (μ0/2π in these units)

const I_MAX = 5, I_STEP = 0.1;   // A
const D_MIN = 0.5, D_MAX = 6, D_STEP = 0.1;   // cm

const W = 460, PAD_L = 46, PAD_R = 16;
const PLOT_W = W - PAD_L - PAD_R;
const WIRE_H = 64;                  // the strip that holds the wire glyphs
const PLOT_Y0 = WIRE_H + 8, PLOT_H = 200, PLOT_Y1 = PLOT_Y0 + PLOT_H;
const AXIS_H = 34;
const H = PLOT_Y1 + AXIS_H;

const fieldAt = (x, i1, i2, d) => {
  const b1 = K * i1 / (x + d / 2);
  const b2 = K * i2 / (x - d / 2);
  return { b1, b2, net: b1 + b2 };
};

const fmtB = v => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

export function ParallelWiresSim({ compact = false, onAnswer = null }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const [c1, c2] = wireColors(isLight);
  const { grid: gridColor, axis: axisColor, bg: svgBg } = plotColors(isLight);

  // Magnitudes and directions are separate controls: the direction is the physics being asked
  // about, and a signed slider hides it inside a sign.
  const [mag1, setMag1] = useState(3);
  const [mag2, setMag2] = useState(3);
  const [out1, setOut1] = useState(true);     // true = out of the page (⊙), false = into (⊗)
  const [out2, setOut2] = useState(true);      // both out by default: the same-direction case the quiz opens on
  const [d, setD] = useState(4);
  const [showParts, setShowParts] = useState(true);
  // The probe: the x position whose field is read out. Hovering moves it live; a click pins it
  // so the sliders can be worked while the number at that spot is watched.
  const [pinned, setPinned] = useState(15);
  const [hoverX, setHoverX] = useState(null);
  const svgRef = useRef(null);

  const i1 = out1 ? mag1 : -mag1;
  const i2 = out2 ? mag2 : -mag2;

  const sx = x => PAD_L + ((x + X_MAX) / (2 * X_MAX)) * PLOT_W;
  const sy = b => PLOT_Y0 + (1 - (b + Y_MAX) / (2 * Y_MAX)) * PLOT_H;
  const dx = px => -X_MAX + ((px - PAD_L) / PLOT_W) * (2 * X_MAX);

  // Sample each curve on three open intervals split at the wires, so a pole is never bridged.
  const paths = useMemo(() => {
    const x1 = -d / 2, x2 = d / 2;
    const bounds = [[-X_MAX, x1], [x1, x2], [x2, X_MAX]];
    const build = pick => bounds.map(([a, b]) => {
      const n = Math.max(8, Math.round((b - a) / 0.04));
      let dstr = "";
      for (let k = 0; k <= n; k++) {
        const x = a + ((b - a) * k) / n;
        if (k === 0 || k === n) continue;           // the endpoints are the poles themselves
        const v = pick(fieldAt(x, i1, i2, d));
        const yy = Math.max(-Y_MAX * 1.5, Math.min(Y_MAX * 1.5, v));  // overshoot is clipped by the clipPath
        dstr += (dstr ? " L" : "M") + sx(x).toFixed(2) + " " + sy(yy).toFixed(2);
      }
      return dstr;
    }).join(" ");
    return { net: build(f => f.net), b1: build(f => f.b1), b2: build(f => f.b2) };
  }, [i1, i2, d]);

  const probeX = hoverX ?? pinned;
  const probe = fieldAt(probeX, i1, i2, d);
  const onWire = Math.abs(Math.abs(probeX) - d / 2) < 0.05;
  const pinnedOnWire = Math.abs(Math.abs(pinned) - d / 2) < 0.05;
  const describeWire = (label, mag, out) => `${label} = ${mag.toFixed(1)} A ${mag === 0 ? "(off)" : out ? "out of the page" : "into the page"}`;
  const answerWithPin = () => {
    if (!onAnswer || pinnedOnWire) return;
    const f = fieldAt(pinned, i1, i2, d);
    onAnswer({
      summary: `x = ${pinned.toFixed(1)} cm on the plot, with ${describeWire("I1", mag1, out1)}, ${describeWire("I2", mag2, out2)} and d = ${d.toFixed(1)} cm. Net field there: ${fmtB(f.net)} μT (wire 1: ${fmtB(f.b1)} μT, wire 2: ${fmtB(f.b2)} μT).`,
      x: pinned, net: f.net, i1, i2, d,
    });
  };

  const xFromEvent = e => {
    const svg = svgRef.current; if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    if (px < PAD_L || px > PAD_L + PLOT_W) return null;
    return Math.round(dx(px) * 10) / 10;
  };

  const xticks = [-20, -15, -10, -5, 0, 5, 10, 15, 20];
  const yticks = [-40, -20, 0, 20, 40];

  // A plain helper rather than a nested component, so React does not remount the glyphs on every
  // slider tick. The glyphs sit at the wires' true x on the plot's own scale (so they line up
  // with the poles below), so a close pair's glyphs genuinely overlap; each wire's labels are
  // pushed to its outer side so the pair stays readable as d closes.
  const wire = (x, out, color, label, mag, side) => {
    const cx = sx(x), cy = WIRE_H / 2 + 4, r = 10;
    const anchor = side < 0 ? "end" : "start", lx = cx + side * 3;   // label on the wire's outer side
    return (
      <g key={label}>
        <circle cx={cx} cy={cy} r={r} fill={svgBg} stroke={color} strokeWidth={2} opacity={mag === 0 ? 0.35 : 1} />
        {mag === 0 ? null : out
          ? <circle cx={cx} cy={cy} r={2.5} fill={color} />
          : <g stroke={color} strokeWidth={1.75} strokeLinecap="round"><line x1={cx - 3.5} y1={cy - 3.5} x2={cx + 3.5} y2={cy + 3.5} /><line x1={cx + 3.5} y1={cy - 3.5} x2={cx - 3.5} y2={cy + 3.5} /></g>}
        <text x={lx} y={cy - r - 5} textAnchor={anchor} fontSize={11} fontWeight={700} fill={color} fontFamily="monospace">{label}</text>
      </g>
    );
  };

  const dirBtn = (on, color, glyph, title, onClick) => (
    <button type="button" onClick={onClick} title={title} aria-pressed={on}
      style={{ width: 30, height: 26, borderRadius: 7, border: `1px solid ${on ? color : border}`, background: on ? color + "22" : "transparent", color: on ? color : muted, fontSize: 15, lineHeight: 1, cursor: "pointer", padding: 0, fontWeight: 700 }}>
      {glyph}
    </button>
  );

  const control = (label, color, mag, setMag, out, setOut) => (
    <SimSlider label={label} color={color} value={mag} min={0} max={I_MAX} step={I_STEP} onChange={setMag} format={v => v.toFixed(1) + " A"} aria={`Current in wire ${label}`}>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {dirBtn(out, color, "⊙", "Current out of the page", () => setOut(true))}
        {dirBtn(!out, color, "⊗", "Current into the page", () => setOut(false))}
      </div>
    </SimSlider>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      {control("I₁", c1, mag1, setMag1, out1, setOut1)}
      {control("I₂", c2, mag2, setMag2, out2, setOut2)}
      <SimSlider label="d" color={teal} value={d} min={D_MIN} max={D_MAX} step={D_STEP} onChange={setD} format={v => v.toFixed(1) + " cm"} aria="Separation between the wires">
        <div style={{ width: 64, flexShrink: 0 }} />
      </SimSlider>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}`, touchAction: "none", cursor: "crosshair" }}
        onPointerMove={e => setHoverX(xFromEvent(e))}
        onPointerLeave={() => setHoverX(null)}
        onPointerDown={e => { const x = xFromEvent(e); if (x != null) setPinned(x); }}>
        <defs>
          <clipPath id="pw-plot"><rect x={PAD_L} y={PLOT_Y0} width={PLOT_W} height={PLOT_H} /></clipPath>
        </defs>

        {/* The line through the wires: the x-axis the plot below is measured along */}
        <line x1={PAD_L} y1={WIRE_H / 2 + 4} x2={PAD_L + PLOT_W} y2={WIRE_H / 2 + 4} stroke={axisColor} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
        <text x={PAD_L + PLOT_W + 2} y={WIRE_H / 2 + 8} fontSize={10} fill={muted} fontFamily="monospace">x</text>
        {/* d bracket */}
        {d >= 1.2 && (
          <g stroke={muted} strokeWidth={1} fill="none">
            <line x1={sx(-d / 2)} y1={WIRE_H - 2} x2={sx(d / 2)} y2={WIRE_H - 2} />
            <line x1={sx(-d / 2)} y1={WIRE_H - 5} x2={sx(-d / 2)} y2={WIRE_H + 1} />
            <line x1={sx(d / 2)} y1={WIRE_H - 5} x2={sx(d / 2)} y2={WIRE_H + 1} />
          </g>
        )}
        {wire(-d / 2, out1, c1, "I₁", mag1, -1)}
        {wire(d / 2, out2, c2, "I₂", mag2, 1)}

        {/* Plot grid, axes */}
        {xticks.map(v => <line key={"gx" + v} x1={sx(v)} y1={PLOT_Y0} x2={sx(v)} y2={PLOT_Y1} stroke={gridColor} strokeWidth={1} />)}
        {yticks.map(v => <line key={"gy" + v} x1={PAD_L} y1={sy(v)} x2={PAD_L + PLOT_W} y2={sy(v)} stroke={v === 0 ? axisColor : gridColor} strokeWidth={v === 0 ? 1.25 : 1} />)}
        <line x1={PAD_L} y1={PLOT_Y0} x2={PAD_L} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        <line x1={PAD_L} y1={PLOT_Y1} x2={PAD_L + PLOT_W} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        {xticks.map(v => <text key={"tx" + v} x={sx(v)} y={PLOT_Y1 + 13} textAnchor="middle" fontSize={10} fill={muted} fontFamily="monospace">{v}</text>)}
        {yticks.map(v => <text key={"ty" + v} x={PAD_L - 6} y={sy(v) + 3.5} textAnchor="end" fontSize={10} fill={muted} fontFamily="monospace">{v}</text>)}
        <text x={PAD_L + PLOT_W / 2} y={H - 5} textAnchor="middle" fontSize={10.5} fill={muted}>x (cm)</text>
        <text transform={`translate(11 ${PLOT_Y0 + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" fontSize={10.5} fill={muted}>B (μT)</text>

        {/* Wire positions continue down through the plot as the poles */}
        <line x1={sx(-d / 2)} y1={PLOT_Y0} x2={sx(-d / 2)} y2={PLOT_Y1} stroke={c1} strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
        <line x1={sx(d / 2)} y1={PLOT_Y0} x2={sx(d / 2)} y2={PLOT_Y1} stroke={c2} strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />

        <g clipPath="url(#pw-plot)">
          {showParts && <path d={paths.b1} fill="none" stroke={c1} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.85} />}
          {showParts && <path d={paths.b2} fill="none" stroke={c2} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.85} />}
          <path d={paths.net} fill="none" stroke={text} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Probe: crosshair at the hovered or pinned x, with the net field there */}
        {(() => {
          const px = sx(probeX);
          const clipped = !Number.isFinite(probe.net) || Math.abs(probe.net) > Y_MAX;
          const py = clipped ? (probe.net > 0 ? PLOT_Y0 : PLOT_Y1) : sy(probe.net);
          const label = onWire ? "at the wire" : `x = ${probeX.toFixed(1)} cm, B = ${fmtB(probe.net)} μT`;
          const lw = label.length * 6.3 + 12;
          const lx = px + lw + 8 > PAD_L + PLOT_W ? px - lw - 8 : px + 8;
          return (
            <g pointerEvents="none">
              <line x1={px} y1={PLOT_Y0} x2={px} y2={PLOT_Y1} stroke={hoverX == null ? teal : axisColor} strokeWidth={1} strokeDasharray="3 3" />
              {!clipped && !onWire && <circle cx={px} cy={py} r={4} fill={text} stroke={svgBg} strokeWidth={2} />}
              {hoverX == null && <polygon points={`${px - 5},${PLOT_Y1 + 1} ${px + 5},${PLOT_Y1 + 1} ${px},${PLOT_Y1 - 6}`} fill={teal} />}
              <rect x={lx} y={PLOT_Y0 + 6} width={lw} height={18} rx={5} fill={isLight ? "rgba(255,255,255,0.92)" : "rgba(28,29,30,0.92)"} stroke={border} />
              <text x={lx + 6} y={PLOT_Y0 + 18.5} fontSize={10.5} fill={text} fontFamily="monospace">{label}</text>
            </g>
          );
        })()}
      </svg>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13, fontWeight: 600, color: text }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 26, height: 0, borderTop: `3px solid ${text}` }} />Net field</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: c1 }}><span style={{ width: 26, height: 0, borderTop: `2.5px dashed ${c1}` }} />Wire 1</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: c2 }}><span style={{ width: 26, height: 0, borderTop: `2.5px dashed ${c2}` }} />Wire 2</span>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: muted, cursor: "pointer" }}>
          <input type="checkbox" checked={showParts} onChange={e => setShowParts(e.target.checked)} style={{ accentColor: teal, margin: 0 }} />
          Show each wire's field
        </label>
      </div>
      {onAnswer && (
        <button type="button" onClick={answerWithPin} disabled={pinnedOnWire}
          style={{ background: teal, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 13, cursor: pinnedOnWire ? "not-allowed" : "pointer", opacity: pinnedOnWire ? 0.5 : 1, width: "100%" }}>
          Answer with the pinned point: x = {pinned.toFixed(1)} cm
        </button>
      )}
    </div>
  );
}
