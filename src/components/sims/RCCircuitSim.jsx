import { useMemo, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { plotColors, SimSlider } from "./ui.jsx";
import { rcCharge, rcFinalCharge, rcTimeConstant } from "../../quiz-sims.js";

// A capacitor charging through a resistor, for PHY 215's Quiz 7 question 2 (Y&F §26.4): does
// the resistor affect the maximum charge (a), and what does it do (b)? The plot is q(t) for
// the current R and C against a dashed reference curve at the default R, on FIXED axes: as
// the R slider moves, the plateau stays put and only the approach to it stretches, which is
// (a) and (b) in one motion. The C slider is there for contrast, since it is the control that
// DOES move the plateau. τ = RC is marked on the curve, since R lives there.
//
// Units on screen: kΩ, μF, ms, μC (Y&F's symbols: ε for the emf, q for the charge, τ for the
// time constant). The emf is fixed at 9.0 V. Records nothing and grades nothing.

const EMF = 9.0;                          // V
const R_REF = 5;                          // kΩ, the dashed reference
const T_MAX = 200;                        // ms
const Q_MAX = 130;                        // μC (12 μF × 9 V = 108 μC)
const W = 460, PAD_L = 46, PAD_R = 16, PLOT_W = W - PAD_L - PAD_R;
const P_Y0 = 12, P_H = 190, P_Y1 = P_Y0 + P_H, H = P_Y1 + 34;

export function RCCircuitSim({ compact = false }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const { grid: gridColor, axis: axisColor, bg: svgBg } = plotColors(isLight);
  const [Rk, setR] = useState(R_REF);     // kΩ
  const [Cu, setC] = useState(10);        // μF
  const [pinned, setPinned] = useState(40);   // ms
  const [hoverT, setHoverT] = useState(null);
  const svgRef = useRef(null);

  const R = Rk * 1e3, C = Cu * 1e-6;
  const st = ms => PAD_L + (ms / T_MAX) * PLOT_W;
  const sq = uC => P_Y0 + (1 - uC / Q_MAX) * P_H;
  const qAt = (ms, Rohm) => rcCharge(ms / 1000, EMF, Rohm, C) * 1e6;
  const path = Rohm => Array.from({ length: 121 }, (_, i) => { const ms = (T_MAX * i) / 120; return (i ? " L" : "M") + st(ms).toFixed(1) + " " + sq(qAt(ms, Rohm)).toFixed(1); }).join("");
  const curves = useMemo(() => ({ now: path(R), ref: path(R_REF * 1e3) }), [R, C]);   // eslint-disable-line react-hooks/exhaustive-deps
  const qf = rcFinalCharge(EMF, C) * 1e6;
  const tau = rcTimeConstant(R, C) * 1e3;
  const probeT = hoverT ?? pinned;
  const tFromEvent = e => {
    const svg = svgRef.current; if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    if (px < PAD_L || px > PAD_L + PLOT_W) return null;
    return Math.round(((px - PAD_L) / PLOT_W) * T_MAX);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <SimSlider label="R" color={teal} value={Rk} min={1} max={20} step={0.5} onChange={setR} format={v => v.toFixed(1) + " kΩ"} valueWidth={64} aria="Resistance" />
      <SimSlider label="C" color={teal} value={Cu} min={2} max={12} step={0.5} onChange={setC} format={v => v.toFixed(1) + " μF"} valueWidth={64} aria="Capacitance" />
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}`, touchAction: "none", cursor: "crosshair" }}
        onPointerMove={e => setHoverT(tFromEvent(e))} onPointerLeave={() => setHoverT(null)}
        onPointerDown={e => { const t = tFromEvent(e); if (t != null) setPinned(t); }}>
        {[25, 50, 75, 100, 125].map(v => <line key={"g" + v} x1={PAD_L} y1={sq(v)} x2={PAD_L + PLOT_W} y2={sq(v)} stroke={gridColor} strokeWidth={1} />)}
        {[50, 100, 150, 200].map(v => <line key={"gt" + v} x1={st(v)} y1={P_Y0} x2={st(v)} y2={P_Y1} stroke={gridColor} strokeWidth={1} />)}
        <line x1={PAD_L} y1={P_Y0} x2={PAD_L} y2={P_Y1} stroke={axisColor} strokeWidth={1.5} />
        <line x1={PAD_L} y1={P_Y1} x2={PAD_L + PLOT_W} y2={P_Y1} stroke={axisColor} strokeWidth={1.5} />
        {[0, 25, 50, 75, 100, 125].map(v => <text key={"qt" + v} x={PAD_L - 6} y={sq(v) + 3.5} textAnchor="end" fontSize={9.5} fill={muted} fontFamily="monospace">{v}</text>)}
        {[0, 50, 100, 150, 200].map(v => <text key={"tt" + v} x={st(v)} y={P_Y1 + 13} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="monospace">{v}</text>)}
        <text x={PAD_L + PLOT_W / 2} y={H - 5} textAnchor="middle" fontSize={10} fill={muted}>t (ms)</text>
        <text transform={`translate(11 ${P_Y0 + P_H / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill={muted}>q (μC)</text>
        {/* the final charge Cε, the line the curve approaches */}
        <line x1={PAD_L} y1={sq(qf)} x2={PAD_L + PLOT_W} y2={sq(qf)} stroke={teal} strokeWidth={1} strokeDasharray="2 4" />
        <text x={PAD_L + PLOT_W - 4} y={sq(qf) - 4} textAnchor="end" fontSize={10} fill={teal} fontFamily="monospace">Cε = {qf.toFixed(0)} μC</text>
        <path d={curves.ref} fill="none" stroke={text} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} />
        <path d={curves.now} fill="none" stroke={text} strokeWidth={2.5} strokeLinejoin="round" />
        {/* τ marker on the live curve */}
        {tau <= T_MAX && (
          <g>
            <line x1={st(tau)} y1={P_Y1} x2={st(tau)} y2={sq(qAt(tau, R))} stroke={teal} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={st(tau)} cy={sq(qAt(tau, R))} r={4} fill={teal} stroke={svgBg} strokeWidth={2} />
            <text x={st(tau) + 5} y={P_Y1 - 6} fontSize={10} fill={teal} fontFamily="monospace">τ = RC = {tau.toFixed(0)} ms</text>
          </g>
        )}
        {(() => {
          const px = st(probeT), q = qAt(probeT, R);
          const label = `t = ${probeT} ms: q = ${q.toFixed(1)} μC (${((100 * q) / qf).toFixed(0)}% of Cε)`;
          const lw = label.length * 6.05 + 12;
          const lx = Math.min(Math.max(PAD_L, px - lw / 2), PAD_L + PLOT_W - lw);
          return (
            <g pointerEvents="none">
              <line x1={px} y1={P_Y0} x2={px} y2={P_Y1} stroke={hoverT == null ? teal : axisColor} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={px} cy={sq(q)} r={4} fill={text} stroke={svgBg} strokeWidth={2} />
              {hoverT == null && <polygon points={`${px - 5},${P_Y1 + 1} ${px + 5},${P_Y1 + 1} ${px},${P_Y1 - 6}`} fill={teal} />}
              <rect x={lx} y={P_Y0 + 6} width={lw} height={18} rx={5} fill={isLight ? "rgba(255,255,255,0.92)" : "rgba(28,29,30,0.92)"} stroke={border} />
              <text x={lx + 6} y={P_Y0 + 18.5} fontSize={10} fill={text} fontFamily="monospace">{label}</text>
            </g>
          );
        })()}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center", fontSize: 13, fontWeight: 600, color: text }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 26, height: 0, borderTop: `3px solid ${text}` }} />R = {Rk.toFixed(1)} kΩ</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, opacity: 0.7 }}><span style={{ width: 26, height: 0, borderTop: `2px dashed ${text}` }} />R = {R_REF.toFixed(1)} kΩ</span>
        <span style={{ color: muted, fontWeight: 400 }}>ε = {EMF.toFixed(1)} V, switch closed at t = 0</span>
      </div>
    </div>
  );
}
