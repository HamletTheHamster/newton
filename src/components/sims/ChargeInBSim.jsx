import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { plotColors, SimSlider } from "./ui.jsx";
import { chargeInB, magneticForce, cyclotronRadius, cyclotronOmega } from "../../quiz-sims.js";

// A charged particle moving through a uniform magnetic field, for PHY 215's Quiz 8 (Y&F
// Ch. 27): can it move with no force (q8_1), and how can a force that does no work change its
// motion (q8_2)? The field points along +x (drawn as a row of arrows); the student launches a
// proton (or the same particle with the opposite charge) at a chosen speed and at a chosen
// angle θ to B, and watches. Along B (θ = 0 or 180°) the path is a straight line and the force
// readout is zero, which is q8_1. Across B the path is a circle, at other angles a helix, and
// the speed and kinetic energy readouts never move while the velocity arrow swings round,
// which is q8_2: the force is always perpendicular to v (drawn so), turning it without
// speeding it up. Closed forms in src/quiz-sims.js (Y&F 27.11–27.12); the animation only
// evaluates them at the current time.
//
// The picture is an oblique projection of 3D (x to the right along B, y up, z toward the
// viewer drawn down-left) so the circle, which lies in the y–z plane, reads as a tilted ring.
// Units on screen: mT, 10⁶ m/s, degrees, fN, keV, m. Records nothing and grades nothing.

const Q_P = 1.602e-19, M_P = 1.673e-27;
const RATE = 0.3e-6;                     // simulated seconds per real second
const X_MAX = 4, Y_MAX = 2;              // m, the view
const W = 460, H = 300, PAD = 16;
const SCALE = (W - 2 * PAD) / (X_MAX + 0.8);
const OX = PAD + 0.4 * SCALE, OY = H / 2;
const project = (x, y, z) => [OX + SCALE * (x - 0.4 * z), OY - SCALE * (y - 0.4 * z)];

export function ChargeInBSim({ compact = false, initial = {} }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const { grid: gridColor, bg: svgBg } = plotColors(isLight);
  const fieldColor = isLight ? "#9ca3af" : "#6b7280";
  const forceColor = isLight ? "#eb6834" : "#d95926";     // the wire-2 orange, validated against the blue
  const velColor = isLight ? "#2a78d6" : "#3987e5";

  const [Bmt, setB] = useState(initial.B ?? 50);
  const [v6, setV] = useState(initial.v ?? 2.0);
  const [deg, setDeg] = useState(initial.deg ?? 90);
  const [positive, setPositive] = useState(true);
  const [playing, setPlaying] = useState(initial.playing ?? true);
  const [t, setT] = useState(initial.t ?? 0);
  const tRef = useRef(initial.t ?? 0);
  const lastRef = useRef(null);

  const q = positive ? Q_P : -Q_P, B = Bmt / 1000, v = v6 * 1e6, theta = (deg * Math.PI) / 180;
  const restart = () => { tRef.current = 0; setT(0); };
  const set = setter => val => { setter(val); restart(); };

  // The run restarts when the particle leaves the view or after three turns, so a circle is
  // drawn over itself a few times and a straight line crosses the picture and comes back.
  const w = cyclotronOmega(q, M_P, B);
  const curved = Math.abs(Math.sin(theta)) > 1e-9;
  const period = (2 * Math.PI) / w;
  useEffect(() => {
    if (!playing) { lastRef.current = null; return undefined; }
    let raf;
    const tick = now => {
      if (lastRef.current != null) {
        tRef.current += ((now - lastRef.current) / 1000) * RATE;
        const p = chargeInB(q, M_P, v, B, theta, tRef.current);
        const gone = p.x > X_MAX + 0.2 || p.x < -0.5 || Math.abs(p.y) > Y_MAX + 0.6 || Math.abs(p.z) > Y_MAX + 0.6;
        if (gone || (curved && tRef.current > 3 * period)) tRef.current = 0;
        setT(tRef.current);
      }
      lastRef.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, q, v, B, theta, curved, period]);

  const p = chargeInB(q, M_P, v, B, theta, t);
  const F = magneticForce(q, v, B, theta);
  const r = cyclotronRadius(q, M_P, v, B, theta);
  const ke = 0.5 * M_P * v * v / 1.602e-16;           // keV
  // the trail from launch to now
  const nPts = 240;
  const trail = Array.from({ length: nPts + 1 }, (_, i) => { const s = chargeInB(q, M_P, v, B, theta, (t * i) / nPts); return project(s.x, s.y, s.z); });
  const trailPath = trail.map((pt, i) => (i ? " L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join("");
  const [px, py] = project(p.x, p.y, p.z);
  // velocity and force arrows at the particle, in the projection; force = q v × B with B = (B,0,0)
  const arrow = (dx, dy, dz, len, color) => {
    const mag = Math.hypot(dx, dy, dz); if (mag === 0) return null;
    const [ex, ey] = project(p.x + (dx / mag) * len, p.y + (dy / mag) * len, p.z + (dz / mag) * len);
    const ang = Math.atan2(ey - py, ex - px), a = 7;
    return (
      <g>
        <line x1={px} y1={py} x2={ex} y2={ey} stroke={color} strokeWidth={2.5} />
        <polygon points={`${ex + a * Math.cos(ang)},${ey + a * Math.sin(ang)} ${ex - a * Math.cos(ang - 0.5)},${ey - a * Math.sin(ang - 0.5)} ${ex - a * Math.cos(ang + 0.5)},${ey - a * Math.sin(ang + 0.5)}`} fill={color} />
      </g>
    );
  };
  const Fx = 0, Fy = q * p.vz * B, Fz = -q * p.vy * B;

  const btn = (on, label, onClick, title) => (
    <button type="button" onClick={onClick} title={title} aria-pressed={on}
      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${on ? teal : border}`, background: on ? teal + "22" : "transparent", color: on ? teal : muted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <SimSlider label="B" color={teal} value={Bmt} min={20} max={100} step={5} onChange={set(setB)} format={v => v + " mT"} aria="Magnetic field" />
      <SimSlider label="v" color={teal} value={v6} min={0.5} max={3} step={0.1} onChange={set(setV)} format={v => v.toFixed(1) + "×10⁶ m/s"} valueWidth={96} aria="Speed" />
      <SimSlider label="θ" color={teal} value={deg} min={0} max={180} step={5} onChange={set(setDeg)} format={v => v + "° to B"} valueWidth={72} aria="Angle between the velocity and the field" />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {btn(positive, "+q", () => { setPositive(true); restart(); }, "Positive charge")}
        {btn(!positive, "−q", () => { setPositive(false); restart(); }, "Negative charge")}
        <span style={{ flex: 1 }} />
        {btn(false, playing ? "Pause" : "Play", () => setPlaying(pl => !pl))}
        {btn(false, "Restart", restart)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}` }}>
        {/* the field: arrows along +x across the picture, their length proportional to B */}
        {[-1.5, -0.5, 0.5, 1.5].map(yy => [0.2, 1.2, 2.2, 3.2].map(xx => {
          const len = 0.9 * (Bmt / 100);
          const [ax, ay] = project(xx, yy, 0), [bx, by] = project(xx + len, yy, 0);
          return <g key={xx + ":" + yy}><line x1={ax} y1={ay} x2={bx} y2={by} stroke={fieldColor} strokeWidth={1 + Bmt / 100} opacity={0.6} /><polygon points={`${bx},${by} ${bx - 6},${by - 3.5} ${bx - 6},${by + 3.5}`} fill={fieldColor} opacity={0.6} /></g>;
        }))}
        <text x={W - PAD - 4} y={H - 10} textAnchor="end" fontSize={11} fontWeight={700} fill={fieldColor} fontFamily="monospace">B →</text>
        {/* launch point and axes hint */}
        <circle cx={OX} cy={OY} r={2.5} fill={gridColor} />
        <path d={trailPath} fill="none" stroke={text} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />
        {/* v and F drawn to scale: v against the slider's range, F against |q|vB at v = 2×10⁶ m/s, B = 50 mT */}
        {arrow(p.vx, p.vy, p.vz, 0.28 * v6, velColor)}
        {F > 0 && arrow(Fx, Fy, Fz, Math.max(0.12, Math.min(1.1, 0.45 * (F / (Q_P * 2e6 * 0.05)))), forceColor)}
        <circle cx={px} cy={py} r={7} fill={positive ? velColor : forceColor} stroke={svgBg} strokeWidth={2} />
        <text x={px} y={py + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{positive ? "+" : "−"}</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center", fontSize: 13, color: text }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 0, borderTop: `2.5px solid ${velColor}` }} />v = {(p.speed / 1e6).toFixed(2)}×10⁶ m/s, K = {ke.toFixed(1)} keV</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 0, borderTop: `2.5px solid ${forceColor}` }} />F = {(F * 1e15).toFixed(1)} fN{curved && Number.isFinite(r) ? `, r = ${r.toFixed(2)} m` : ""}</span>
      </div>
    </div>
  );
}
