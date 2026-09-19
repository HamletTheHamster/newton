import { useState } from "react";
import { useTheme } from "../../theme.js";
import { plotColors, SimSlider } from "./ui.jsx";
import { bulbs } from "../../quiz-sims.js";

// Bulbs on a flashlight battery, for PHY 215's Quiz 7 question 1 (Y&F Ch. 26): what happens
// to each bulb's brightness as bulbs are added in series (a) and in parallel (b), and which
// arrangement drains the battery faster (c). The student picks the arrangement and adds bulbs;
// the circuit is drawn with each bulb glowing in proportion to its power, and the battery's
// current is printed beside it, so all three answers are seen rather than recalled. The bulb
// glow is the ONLY brightness cue that is not a number, and it is scaled to the single-bulb
// power so "the same brightness" and "a quarter as bright" are visibly those.
//
// The battery opens ideal (emf ε, internal resistance r = 0), which is the textbook's model for
// the question: with it, parallel bulbs hold their brightness exactly. The r slider is there
// because the course note credits a student who invokes it: a real cell dims a big parallel set
// gradually, and the picture shows exactly how gradually. Per src/quiz-sims.js: ε = 3.0 V,
// R = 10 Ω per bulb. Records nothing and grades nothing.

const EMF = 3.0, R_BULB = 10;   // V, Ω
const N_MAX = 6;
const W = 460, H = 210;

export function BulbsCircuitSim({ compact = false, initial = {} }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const { axis: wireColor, bg: svgBg } = plotColors(isLight);
  const [n, setN] = useState(initial.n ?? 1);
  const [arr, setArr] = useState(initial.arr ?? "series");
  const [rInt, setRInt] = useState(0);      // Ω
  const r = bulbs(n, arr, EMF, R_BULB, rInt);
  const one = bulbs(1, "series", EMF, R_BULB, 0);
  const glow = r.bulbPower / one.bulbPower;          // 1 = a single bulb's brightness
  // Brightness cue. Power alone (1, 1/4, 1/9, 1/16 in series) collapses the dim states into
  // each other on screen, so the cue is on a compressed scale, b = √glow (1, 0.50, 0.33, 0.25,
  // 0.20, 0.17 for N = 1..6, i.e. proportional to the current), and it drives three things at once: the halo's radius and
  // opacity, the filament's opacity, and the filament's color, which slides from a hot yellow
  // to a dim ember the way a real bulb does. The numbers under the picture stay the real powers.
  const b = Math.sqrt(Math.min(1, glow));
  const mix = (a, c, t) => { const h = x => parseInt(x, 16); const ch = i => Math.round(h(a.slice(i, i + 2)) + (h(c.slice(i, i + 2)) - h(a.slice(i, i + 2))) * t).toString(16).padStart(2, "0"); return "#" + ch(1) + ch(3) + ch(5); };
  const hot = isLight ? "#f59e0b" : "#fbbf24", ember = isLight ? "#78350f" : "#451a03";
  const glowColor = mix(ember, hot, b);

  const arrBtn = (id, label) => (
    <button type="button" onClick={() => setArr(id)} aria-pressed={arr === id}
      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${arr === id ? teal : border}`, background: arr === id ? teal + "22" : "transparent", color: arr === id ? teal : muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
      {label}
    </button>
  );

  // The circuit. Battery on the left; bulbs laid out along the top rail (series) or as rungs
  // of a ladder (parallel). Everything is drawn from the same n so the picture and the numbers
  // cannot disagree.
  const left = 92, right = W - 30, top = 40, bottom = H - 40;
  const bulb = (cx, cy, key) => {
    const rad = 13;
    return (
      <g key={key}>
        {b > 0.05 && <circle cx={cx} cy={cy} r={rad + 1 + 44 * b} fill={hot} opacity={0.02 + 0.55 * b} />}
        {b > 0.05 && <circle cx={cx} cy={cy} r={rad + 1 + 18 * b} fill={hot} opacity={0.1 + 0.5 * b} />}
        <circle cx={cx} cy={cy} r={rad} fill={svgBg} stroke={wireColor} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={rad - 4} fill={glowColor} opacity={0.08 + 0.92 * b} />
      </g>
    );
  };
  const battery = (
    <g>
      <line x1={left} y1={top} x2={left} y2={(top + bottom) / 2 - 12} stroke={wireColor} strokeWidth={2} />
      <line x1={left - 12} y1={(top + bottom) / 2 - 12} x2={left + 12} y2={(top + bottom) / 2 - 12} stroke={text} strokeWidth={3} />
      <line x1={left - 6} y1={(top + bottom) / 2 - 2} x2={left + 6} y2={(top + bottom) / 2 - 2} stroke={text} strokeWidth={2} />
      <line x1={left - 12} y1={(top + bottom) / 2 + 8} x2={left + 12} y2={(top + bottom) / 2 + 8} stroke={text} strokeWidth={3} />
      <line x1={left - 6} y1={(top + bottom) / 2 + 18} x2={left + 6} y2={(top + bottom) / 2 + 18} stroke={text} strokeWidth={2} />
      <line x1={left} y1={(top + bottom) / 2 + 18} x2={left} y2={bottom} stroke={wireColor} strokeWidth={2} />
      <text x={left - 18} y={(top + bottom) / 2 - 2} textAnchor="end" fontSize={11} fontFamily="monospace" fill={muted}>ε = {EMF.toFixed(1)} V</text>
      <text x={left - 18} y={(top + bottom) / 2 + 12} textAnchor="end" fontSize={11} fontFamily="monospace" fill={muted}>r = {rInt.toFixed(2)} Ω</text>
    </g>
  );
  let circuit;
  if (arr === "series") {
    const span = right - left - 40;
    circuit = (
      <g>
        <line x1={left} y1={top} x2={right} y2={top} stroke={wireColor} strokeWidth={2} />
        <line x1={right} y1={top} x2={right} y2={bottom} stroke={wireColor} strokeWidth={2} />
        <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={wireColor} strokeWidth={2} />
        {Array.from({ length: n }, (_, i) => bulb(left + 20 + ((i + 0.5) * span) / n, top, "b" + i))}
      </g>
    );
  } else {
    const gap = (right - left - 20) / (n + 0.5);
    circuit = (
      <g>
        <line x1={left} y1={top} x2={left + 20 + gap * (n - 0.5)} y2={top} stroke={wireColor} strokeWidth={2} />
        <line x1={left} y1={bottom} x2={left + 20 + gap * (n - 0.5)} y2={bottom} stroke={wireColor} strokeWidth={2} />
        {Array.from({ length: n }, (_, i) => {
          const x = left + 20 + gap * (i + 0.5);
          return (
            <g key={"p" + i}>
              <line x1={x} y1={top} x2={x} y2={bottom} stroke={wireColor} strokeWidth={2} />
              {bulb(x, (top + bottom) / 2, "b" + i)}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {arrBtn("series", "Series")}
        {arrBtn("parallel", "Parallel")}
      </div>
      <SimSlider label="bulbs" labelWidth={44} color={teal} value={n} min={1} max={N_MAX} step={1} onChange={setN} format={v => String(v)} aria="Number of bulbs" />
      <SimSlider label="r" labelWidth={44} color={teal} value={rInt} min={0} max={1} step={0.05} onChange={setRInt} format={v => v.toFixed(2) + " Ω"} aria="Internal resistance of the battery" />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}` }}>
        {battery}
        {circuit}
        <text x={right} y={H - 12} textAnchor="end" fontSize={11} fontFamily="monospace" fill={text}>battery current {r.batteryCurrent.toFixed(2)} A</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 13, color: text }}>
        <span>each bulb: {r.bulbCurrent.toFixed(2)} A, {r.bulbVoltage.toFixed(2)} V, <b>{r.bulbPower.toFixed(2)} W</b></span>
        <span style={{ color: muted }}>one bulb on an ideal cell: {one.bulbPower.toFixed(2)} W</span>
      </div>
    </div>
  );
}
