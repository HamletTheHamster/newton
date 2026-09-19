import { useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { plotColors, SimSlider } from "./ui.jsx";
import { fieldLineCrossings, pointChargeField } from "../../quiz-sims.js";

// A point charge and a closed surface, for PHY 215's Quiz 3 questions 3 and 4 (Y&F Ch. 22):
// does the flux through a balloon depend on how far it is inflated (q3_3), and does moving the
// charge off centre change the field at the surface and the flux through it (q3_4)? The charge
// is drawn with its field lines (8 per nC, radial, as Y&F draw a point charge); the surface is
// a circle whose radius the student inflates; the charge can be DRAGGED anywhere, including
// out through the surface. Every crossing of a line with the surface is marked, and the count
// (out, in, net) is printed: it never changes as the balloon inflates or the charge moves
// inside, and it drops to zero when the charge leaves, which is Gauss's law counted rather
// than stated. A marker on the surface (click the surface to move it) shows E there, which
// DOES change as the charge moves: the distinction q3_4 asks about.
//
// Units on screen: nC and cm; E in N/C from Coulomb's law (K_E in src/quiz-sims.js). Records
// nothing and grades nothing.

const VIEW = 15;                 // cm, half-width of the square plot
const R_MIN = 3, R_MAX = 12;     // cm, the surface
const LINES_PER_NC = 8;
const W = 460, PAD = 14, PLOT = W - 2 * PAD, H = W;

export function GaussSurfaceSim({ compact = false }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const { grid: gridColor, axis: axisColor, bg: svgBg } = plotColors(isLight);
  const lineColor = isLight ? "#2a78d6" : "#3987e5";     // the field, wire-1 blue from ui.jsx
  const [q, setQ] = useState(2);                           // nC
  const [radius, setRadius] = useState(8);                 // cm
  const [charge, setCharge] = useState({ x: 0, y: 0 });    // cm
  const [markerAngle, setMarkerAngle] = useState(Math.PI / 2);
  const dragRef = useRef(false);
  const svgRef = useRef(null);

  const sx = x => PAD + ((x + VIEW) / (2 * VIEW)) * PLOT;
  const sy = y => PAD + (1 - (y + VIEW) / (2 * VIEW)) * PLOT;
  const fromEvent = e => {
    const svg = svgRef.current; if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W, py = ((e.clientY - box.top) / box.height) * H;
    return { x: -VIEW + ((px - PAD) / PLOT) * 2 * VIEW, y: VIEW - ((py - PAD) / PLOT) * 2 * VIEW };
  };
  const onDown = e => {
    const p = fromEvent(e); if (!p) return;
    if (Math.hypot(p.x - charge.x, p.y - charge.y) < 2.2) { dragRef.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); return; }
    setMarkerAngle(Math.atan2(p.y, p.x));
  };
  const onMove = e => {
    if (!dragRef.current) return;
    const p = fromEvent(e); if (!p) return;
    const lim = VIEW - 1;
    setCharge({ x: Math.max(-lim, Math.min(lim, p.x)), y: Math.max(-lim, Math.min(lim, p.y)) });
  };
  const onUp = () => { dragRef.current = false; };

  const count = LINES_PER_NC * q;
  const cross = fieldLineCrossings(charge.x, charge.y, count, radius, 1e4);
  const mx = radius * Math.cos(markerAngle), my = radius * Math.sin(markerAngle);
  const field = pointChargeField(q * 1e-9, charge.x / 100, charge.y / 100, mx / 100, my / 100);
  const eRef = pointChargeField(1e-9, 0, 0, 0, 0.08).E;          // 1 nC at 8 cm, the arrow's unit length
  const arrowLen = Math.min(6, 2.2 * Math.sqrt(field.E / eRef));  // cm on the plot, √ so a 4× field is 2× the arrow
  const ex = field.E > 0 ? field.Ex / field.E : 0, ey = field.E > 0 ? field.Ey / field.E : 0;
  const rayEnd = (dx, dy) => {
    // where a ray from the charge leaves the square view
    const tx = dx > 0 ? (VIEW - charge.x) / dx : dx < 0 ? (-VIEW - charge.x) / dx : Infinity;
    const ty = dy > 0 ? (VIEW - charge.y) / dy : dy < 0 ? (-VIEW - charge.y) / dy : Infinity;
    return Math.min(tx, ty);
  };
  const fmtE = v => (v >= 1e4 ? (v / 1e3).toFixed(1) + " kN/C" : v.toFixed(0) + " N/C");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <SimSlider label="q" color={teal} value={q} min={1} max={4} step={1} onChange={setQ} format={v => v + " nC"} aria="Charge" />
      <SimSlider label="R" color={teal} value={radius} min={R_MIN} max={R_MAX} step={0.5} onChange={setRadius} format={v => v.toFixed(1) + " cm"} aria="Radius of the closed surface" />
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}`, touchAction: "none", cursor: "crosshair" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <defs><clipPath id="gs-clip"><rect x={PAD} y={PAD} width={PLOT} height={PLOT} /></clipPath></defs>
        {[-10, -5, 0, 5, 10].map(v => <g key={"g" + v}><line x1={sx(v)} y1={PAD} x2={sx(v)} y2={PAD + PLOT} stroke={gridColor} strokeWidth={1} /><line x1={PAD} y1={sy(v)} x2={PAD + PLOT} y2={sy(v)} stroke={gridColor} strokeWidth={1} /></g>)}
        <g clipPath="url(#gs-clip)">
          {cross.lines.map((l, i) => {
            const s = rayEnd(l.dx, l.dy);
            return (
              <g key={"l" + i}>
                <line x1={sx(charge.x)} y1={sy(charge.y)} x2={sx(charge.x + l.dx * s)} y2={sy(charge.y + l.dy * s)} stroke={lineColor} strokeWidth={1.25} opacity={0.75} />
                {l.hits.map((h, j) => {
                  const hx = charge.x + l.dx * h.s, hy = charge.y + l.dy * h.s;
                  const ang = Math.atan2(-l.dy, l.dx), a = 5;
                  const tip = [sx(hx) + a * Math.cos(ang), sy(hy) + a * Math.sin(ang)];
                  const b1 = [sx(hx) - a * Math.cos(ang - 0.6), sy(hy) - a * Math.sin(ang - 0.6)];
                  const b2 = [sx(hx) - a * Math.cos(ang + 0.6), sy(hy) - a * Math.sin(ang + 0.6)];
                  return <polygon key={"h" + j} points={`${tip[0]},${tip[1]} ${b1[0]},${b1[1]} ${b2[0]},${b2[1]}`} fill={h.dir === "out" ? lineColor : svgBg} stroke={lineColor} strokeWidth={1.25} />;
                })}
              </g>
            );
          })}
        </g>
        {/* the closed surface */}
        <circle cx={sx(0)} cy={sy(0)} r={(radius / (2 * VIEW)) * PLOT} fill="none" stroke={text} strokeWidth={2} />
        {/* the field at the marker */}
        <line x1={sx(mx)} y1={sy(my)} x2={sx(mx + ex * arrowLen)} y2={sy(my + ey * arrowLen)} stroke={teal} strokeWidth={2.5} />
        {(() => { const ang = Math.atan2(-ey, ex), tx = sx(mx + ex * arrowLen), ty = sy(my + ey * arrowLen), a = 7; return <polygon points={`${tx + a * Math.cos(ang)},${ty + a * Math.sin(ang)} ${tx - a * Math.cos(ang - 0.5)},${ty - a * Math.sin(ang - 0.5)} ${tx - a * Math.cos(ang + 0.5)},${ty - a * Math.sin(ang + 0.5)}`} fill={teal} />; })()}
        <circle cx={sx(mx)} cy={sy(my)} r={5} fill={svgBg} stroke={teal} strokeWidth={2} />
        {/* the charge */}
        <circle cx={sx(charge.x)} cy={sy(charge.y)} r={9} fill={lineColor} stroke={svgBg} strokeWidth={2} style={{ cursor: "grab" }} />
        <text x={sx(charge.x)} y={sy(charge.y) + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" pointerEvents="none">+</text>
        <text x={PAD + 6} y={H - PAD - 6} fontSize={10} fill={muted} fontFamily="monospace">{2 * VIEW} cm across</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center", fontSize: 13, color: text }}>
        <span><b>{cross.out}</b> lines out, <b>{cross.in}</b> in, net <b>{cross.net}</b>{cross.enclosed ? "" : " (charge outside)"}</span>
        <span style={{ color: teal }}>E at the marker: <b>{fmtE(field.E)}</b> at {(field.r * 100).toFixed(1)} cm from q</span>
      </div>
    </div>
  );
}
