import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme.js";
import { MathText } from "./MathText.jsx";
import { axisLabelTspans } from "./VectorField.jsx";

// Animated, read-only illustration that decomposes a keyed vector into `count` equal steps laid
// tip-to-tail, revealing them one per tick — showing how repeated equal increments rebuild a
// resultant. Built for the "ten ā·(1 s) steps add up to Δv, carrying v₁ to v₂" idea in 3.6(c),
// but reusable for any per-step accumulation (impulse, net force over time, …).
//
// Reads `vector.buildup` (rides on the same plane/key as the VectorField question):
//   buildup: { vectorId, count, base?:[ids], stepColor?, runningColor?, caption?, replayLabel? }
// The decomposed vector is `vector.key[vectorId]` (tail→tip); each step = (tip−tail)/count.
const VB_W = 480, VB_H = 320, PAD_L = 46, PAD_R = 14, PAD_T = 14, PAD_B = 38;
const PLOT_X0 = PAD_L, PLOT_X1 = VB_W - PAD_R, PLOT_Y0 = PAD_T, PLOT_Y1 = VB_H - PAD_B;
const PLOT_W = PLOT_X1 - PLOT_X0, PLOT_H = PLOT_Y1 - PLOT_Y0;
const fmt = v => String(Math.round(v * 100) / 100);

export function VectorBuildup({ vector, autoPlay = true, stepMs = 430, startDelayMs = 1000 }) {
  const { border, text, muted, isLight } = useTheme();
  const b = vector?.buildup;
  const keyV = b && vector.key?.[b.vectorId];

  const { xMin, xMax, yMin, yMax, xTick, yTick, xLabel, yLabel } = vector || {};
  const origin = vector?.origin || [0, 0];
  const count = b?.count || 10;
  const tail = keyV?.tail || origin;
  const tip = keyV?.tip;
  const step = tip ? [(tip[0] - tail[0]) / count, (tip[1] - tail[1]) / count] : [0, 0];

  const [k, setK] = useState(autoPlay ? 0 : count);
  const timerRef = useRef(null);
  const play = () => {
    clearInterval(timerRef.current);
    setK(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1; setK(i);
      if (i >= count) clearInterval(timerRef.current);
    }, stepMs);
  };
  // Start after a short delay so the student can take in the setup (and the page can scroll the
  // whole illustration + caption into view) before the steps begin marching.
  useEffect(() => {
    if (!autoPlay) return undefined;
    const t = setTimeout(play, startDelayMs);
    return () => { clearTimeout(t); clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || !keyV || !tip) return null;

  const gridColor = isLight ? "#e5e7eb" : "#3a3b3d";
  const axisColor = isLight ? "#9ca3af" : "#6b7280";
  const svgBg = isLight ? "#ffffff" : "#1c1d1e";
  const stepColor = b.stepColor || "#eab308";
  const runColor = b.runningColor || "#14b8a6";

  const sx = x => PLOT_X0 + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const sy = y => PLOT_Y0 + (1 - (y - yMin) / (yMax - yMin)) * PLOT_H;
  const colorOf = id => vector.vectors?.find(v => v.id === id)?.color || muted;
  const labelOf = id => vector.vectors?.find(v => v.id === id)?.label || "";

  const xticks = [], yticks = [];
  for (let v = xMin; v <= xMax + 1e-9; v += xTick) xticks.push(Math.round(v * 1e6) / 1e6);
  for (let v = yMin; v <= yMax + 1e-9; v += yTick) yticks.push(Math.round(v * 1e6) / 1e6);
  const zeroX = xMin <= 0 && xMax >= 0, zeroY = yMin <= 0 && yMax >= 0;

  const head = j => [tail[0] + j * step[0], tail[1] + j * step[1]]; // data coords after j steps
  const Arrow = ({ a, c, color, width = 2.5, headLen = 10, dash }) => {
    const x1 = sx(a[0]), y1 = sy(a[1]), x2 = sx(c[0]), y2 = sy(c[1]);
    const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) return null;
    const h = Math.min(headLen, len), w = h * 0.52;
    const bx = x2 - h * Math.cos(ang), by = y2 - h * Math.sin(ang);
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash || undefined} />
        {!dash && <polygon points={`${x2},${y2} ${bx - w * Math.sin(ang)},${by + w * Math.cos(ang)} ${bx + w * Math.sin(ang)},${by - w * Math.cos(ang)}`} fill={color} />}
      </g>
    );
  };

  const headK = head(k);
  const runMag = Math.hypot(headK[0] - origin[0], headK[1] - origin[1]);
  const done = k >= count;

  const btn = {
    alignSelf: "flex-start", padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`,
    background: "transparent", color: text, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  };
  const swatch = c => ({ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block", marginRight: 5, verticalAlign: "-1px" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 540 }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width={VB_W} height={VB_H}
        style={{ width: "100%", height: "auto", background: svgBg, border: `1px solid ${border}`, borderRadius: 10 }}>
        {xticks.map(v => <line key={"gx" + v} x1={sx(v)} y1={PLOT_Y0} x2={sx(v)} y2={PLOT_Y1} stroke={gridColor} strokeWidth={1} />)}
        {yticks.map(v => <line key={"gy" + v} x1={PLOT_X0} y1={sy(v)} x2={PLOT_X1} y2={sy(v)} stroke={gridColor} strokeWidth={1} />)}
        <line x1={zeroX ? sx(0) : PLOT_X0} y1={PLOT_Y0} x2={zeroX ? sx(0) : PLOT_X0} y2={PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        <line x1={PLOT_X0} y1={zeroY ? sy(0) : PLOT_Y1} x2={PLOT_X1} y2={zeroY ? sy(0) : PLOT_Y1} stroke={axisColor} strokeWidth={1.5} />
        {xLabel && <text x={(PLOT_X0 + PLOT_X1) / 2} y={VB_H - 5} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle">{axisLabelTspans(xLabel)}</text>}
        {yLabel && <text x={11} y={(PLOT_Y0 + PLOT_Y1) / 2} fill={text} fontSize={14.5} fontWeight={600} textAnchor="middle" transform={`rotate(-90 11 ${(PLOT_Y0 + PLOT_Y1) / 2})`}>{axisLabelTspans(yLabel)}</text>}

        {/* faint dashed guide along the full decomposed vector (the target the steps fill in) */}
        <Arrow a={tail} c={tip} color={axisColor} width={1.25} dash="4 4" />

        {/* context: the base vectors from the origin (faded) */}
        {(b.base || []).map(id => {
          const t = vector.key?.[id]?.tip;
          if (!t) return null;
          return (
            <g key={id} opacity={0.4}>
              <Arrow a={origin} c={t} color={colorOf(id)} width={2} />
              <text x={sx(t[0]) + (t[0] >= origin[0] ? 7 : -7)} y={sy(t[1]) + (t[1] >= origin[1] ? 14 : -6)} fill={colorOf(id)} fontSize={15} fontWeight={700}
                textAnchor={t[0] >= origin[0] ? "start" : "end"}
                style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3, strokeLinejoin: "round" }}>{labelOf(id)}</text>
            </g>
          );
        })}

        {/* the k revealed acceleration steps, tip-to-tail from the tail */}
        {Array.from({ length: k }, (_, j) => <Arrow key={j} a={head(j)} c={head(j + 1)} color={stepColor} width={2.25} headLen={6} />)}

        {/* the running velocity vector: origin → current chain head (sweeps v₁ → v₂) */}
        <Arrow a={origin} c={headK} color={runColor} width={3} headLen={12} />
        <circle cx={sx(origin[0])} cy={sy(origin[1])} r={3} fill={axisColor} />
        <circle cx={sx(headK[0])} cy={sy(headK[1])} r={3.5} fill={runColor} stroke={svgBg} strokeWidth={1.5} />

        {/* running counters */}
        <text x={PLOT_X0 + 6} y={PLOT_Y0 + 16} fill={text} fontSize={14} fontWeight={700}
          style={{ paintOrder: "stroke", stroke: svgBg, strokeWidth: 3, strokeLinejoin: "round" }}>
          t = {k} s · |v| = {fmt(runMag)} m/s
        </text>
      </svg>

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: muted }}>
        <span><span style={swatch(runColor)} />velocity v(t)</span>
        <span><span style={swatch(stepColor)} />ā·(1 s) steps</span>
        <button type="button" onClick={play} style={btn}>{done ? "↻ Replay" : "▶ Playing…"}</button>
      </div>

      {b.caption && <div style={{ color: muted, fontSize: 14, lineHeight: 1.55 }}><MathText>{b.caption}</MathText></div>}
    </div>
  );
}
