import { useMemo, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { wireColors, plotColors, SimSlider } from "./ui.jsx";
import { lensDipoles, netDipole, singleWireField, straightPairField, twistedPairFieldMax } from "../../twisted-pair.js";

// Twisted-pair simulation for PHY 215's Quiz 9 question 2 (Y&F Ch. 28): why a power lead's two
// wires are kept close (part a) and twisted (part b). Two stacked pictures over shared sliders
// for I, d and the number of half-twists N along a 40 cm length:
//
//   1. The DIPOLE LADDER. A side view of the pair; between consecutive crossings the wires
//      enclose a lens, and each lens is a current loop with dipole moment μ = I × area (μ is
//      Young & Freedman's symbol for it, §27.7, and the sim keeps the textbook's notation), drawn
//      as a ⊙/⊗ glyph sized by |μ| and alternating in sign lens to lens (the wires swap sides at
//      every crossing). That alternation is the projection of a loop normal that rotates
//      helically along the pair; the sim deliberately does NOT draw that rotation (a strip of
//      local markers with in-page and out-of-page parts was tried and removed, 2026-09-19),
//      because the ⊙/⊗ in the lenses is exactly the idea students are to focus on and the
//      helical components complicate it without changing the conclusion.
//      The glyphs scale with |μ|, so the picture alone carries the argument (more half-twists
//      means more, weaker, alternating dipoles that sum to nothing) and the count, |μ| per loop
//      and net μ are printed under it. A bar chart of the per-loop moments was tried and removed
//      (2026-09-19): drawn as blocks along z it read as a step function, which the local moment
//      is not, and the glyphs already show the magnitudes.
//   2. The FIELD BESIDE THE PAIR, |B| against distance r from the axis on a log axis: one wire
//      (1/r), the straight pair (1/r², shrinking with d: part a) and the twisted pair at the
//      current N, which drops off a cliff once the pitch is shorter than r (part b). The twisted
//      curve is Biot–Savart on a long pair (src/twisted-pair.js), recomputed on every tick.
//
// The vertical scale of the side view is NOT the horizontal one (a 1 cm pair over 40 cm would
// be a hairline); it carries its own ticks so the exaggeration is stated by the axis itself.
// Series: the two wires in the shared blue/orange, everything derived from them in text ink
// (the dipoles, the twisted curve as the headline), the two reference curves dashed/dotted.
// The sim records nothing and grades nothing.

const L = 0.40;                         // m, the drawn length
const I_MAX = 5, I_STEP = 0.1;          // A
const D_MIN = 0.2, D_MAX = 1.5;         // cm
const N_MAX = 24;
// The field plot's axis is 0–20 cm with ticks every 5, the same span and ticks as the right-hand
// half of ParallelWiresSim's x axis (−20..20), so the two sims' "distance from the wires" read
// alike. The curves start at R_CURVE_MIN, since the field diverges at the wires.
const R_MIN = 0, R_MAX = 20, R_CURVE_MIN = 1;   // cm
const B_LO = 0.01, B_HI = 100;          // μT, log axis

const W = 460, PAD_L = 46, PAD_R = 16;
const PLOT_W = W - PAD_L - PAD_R;

// Panel 1 geometry
const SIDE_Y0 = 14, SIDE_H = 96, SIDE_Y1 = SIDE_Y0 + SIDE_H;
const H1 = SIDE_Y1 + 32;
const Y_SIDE = 0.9;                     // cm, side-view half-range (d/2 ≤ 0.75)

// Panel 2 geometry
const F_Y0 = 12, F_H = 190, F_Y1 = F_Y0 + F_H;
const H2 = F_Y1 + 34;

const fmtB = v => (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(3) : v.toExponential(1));

export function TwistedPairSim({ compact = false, initial = {} }) {
  const { text, muted, border, isLight, teal } = useTheme();
  const [c1, c2] = wireColors(isLight);
  const { grid: gridColor, axis: axisColor, bg: svgBg } = plotColors(isLight);
  const lensFill = isLight ? "rgba(28,29,31,0.07)" : "rgba(255,255,255,0.08)";

  const [I, setI] = useState(initial.I ?? 3);
  const [dcm, setD] = useState(initial.d ?? 1.0);
  const [N, setN] = useState(initial.N ?? 4);
  const [pinned, setPinned] = useState(5);   // cm, the field probe
  const [hoverR, setHoverR] = useState(null);
  const svg2Ref = useRef(null);
  const d = dcm / 100;

  // ── Panel 1: the ladder ────────────────────────────────────────────────────────────────────
  const sz = z => PAD_L + (z / L) * PLOT_W;                                 // z in m
  const sySide = ycm => SIDE_Y0 + (1 - (ycm + Y_SIDE) / (2 * Y_SIDE)) * SIDE_H;
  const yWire = (z, sgn) => (N === 0 ? sgn * dcm / 2 : sgn * (dcm / 2) * Math.sin((Math.PI * N * z) / L));
  const wirePath = sgn => {
    const n = 240;
    let p = "";
    for (let k = 0; k <= n; k++) { const z = (L * k) / n; p += (k ? " L" : "M") + sz(z).toFixed(1) + " " + sySide(yWire(z, sgn)).toFixed(1); }
    return p;
  };
  const lenses = useMemo(() => lensDipoles(I, d, L, N), [I, d, N]);
  const lensPolygon = l => {
    const n = 24;
    const top = [], bot = [];
    for (let k = 0; k <= n; k++) {
      const z = l.z0 + ((l.z1 - l.z0) * k) / n;
      top.push(sz(z).toFixed(1) + "," + sySide(yWire(z, 1)).toFixed(1));
      bot.push(sz(z).toFixed(1) + "," + sySide(yWire(z, -1)).toFixed(1));
    }
    return [...top, ...bot.reverse()].join(" ");
  };
  // Glyph radius from the lens area, so a lens at N = 1 reads bigger than one at N = 16
  const glyphR = l => Math.max(3.5, Math.min(11, 11 * Math.sqrt(l.area / (d * L))));
  const dipoleGlyph = (cx, cy, r, into) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={svgBg} stroke={text} strokeWidth={1.5} />
      {into
        ? <g stroke={text} strokeWidth={1.5} strokeLinecap="round"><line x1={cx - r * 0.45} y1={cy - r * 0.45} x2={cx + r * 0.45} y2={cy + r * 0.45} /><line x1={cx + r * 0.45} y1={cy - r * 0.45} x2={cx - r * 0.45} y2={cy + r * 0.45} /></g>
        : <circle cx={cx} cy={cy} r={Math.max(1.2, r * 0.28)} fill={text} />}
    </g>
  );
  // Current-direction arrowheads along each wire
  const arrowsOn = (sgn, color, dir) => [0.12, 0.5, 0.88].map(f => {
    const z = f * L, z2 = z + dir * 0.004;
    const x1 = sz(z), y1 = sySide(yWire(z, sgn)), x2 = sz(z2), y2 = sySide(yWire(z2, sgn));
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const ax = x2, ay = y2, s = 6;
    const p1 = [ax - s * Math.cos(ang - 0.5), ay - s * Math.sin(ang - 0.5)], p2 = [ax - s * Math.cos(ang + 0.5), ay - s * Math.sin(ang + 0.5)];
    return <polygon key={f} points={`${ax},${ay} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={color} />;
  });
  const net = netDipole(lenses);
  const mUnit = 1e3;                                                          // mA·m²

  // ── Panel 2: the field ─────────────────────────────────────────────────────────────────────
  const sr = rcm => PAD_L + ((rcm - R_MIN) / (R_MAX - R_MIN)) * PLOT_W;
  const sb = uT => F_Y0 + (1 - (Math.log10(Math.max(uT, B_LO)) - Math.log10(B_LO)) / (Math.log10(B_HI) - Math.log10(B_LO))) * F_H;
  const rFromPx = px => R_MIN + ((px - PAD_L) / PLOT_W) * (R_MAX - R_MIN);
  const curves = useMemo(() => {
    const rs = Array.from({ length: 40 }, (_, i) => R_CURVE_MIN * Math.pow(R_MAX / R_CURVE_MIN, i / 39));
    const path = f => rs.map((r, i) => (i ? " L" : "M") + sr(r).toFixed(1) + " " + sb(f(r / 100) * 1e6).toFixed(1)).join("");
    return {
      one: path(r => singleWireField(I, r)),
      pair: path(r => straightPairField(I, d, r)),
      twist: path(r => twistedPairFieldMax(I, d, L, N, r, { segments: 1500 })),
    };
  }, [I, d, N]);
  const probeR = hoverR ?? pinned;
  const probe = {
    one: singleWireField(I, probeR / 100) * 1e6,
    pair: straightPairField(I, d, probeR / 100) * 1e6,
    twist: twistedPairFieldMax(I, d, L, N, probeR / 100, { segments: 1500 }) * 1e6,
  };
  const rFromEvent = e => {
    const svg = svg2Ref.current; if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    if (px < PAD_L || px > PAD_L + PLOT_W) return null;
    return Math.max(R_CURVE_MIN, Math.round(rFromPx(px) * 10) / 10);
  };
  const pitchCm = N > 0 ? (2 * L * 100) / N : null;

  const legendItem = (swatch, label, color) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: color || text }}>{swatch}{label}</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <SimSlider label="I" color={teal} value={I} min={0} max={I_MAX} step={I_STEP} onChange={setI} format={v => v.toFixed(1) + " A"} aria="Current in the pair" />
      <SimSlider label="d" color={teal} value={dcm} min={D_MIN} max={D_MAX} step={0.1} onChange={setD} format={v => v.toFixed(1) + " cm"} aria="Separation between the wires" />
      <SimSlider label="N" color={teal} value={N} min={0} max={N_MAX} step={1} onChange={setN} format={v => v + (v === 1 ? " half-twist" : " half-twists")} valueWidth={110} aria="Half-twists along the 40 cm length" />

      {/* Panel 1: the dipole ladder */}
      <svg viewBox={`0 0 ${W} ${H1}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}` }}>
        {/* side view */}
        {[-0.5, 0, 0.5].map(v => <line key={"sg" + v} x1={PAD_L} y1={sySide(v)} x2={PAD_L + PLOT_W} y2={sySide(v)} stroke={v === 0 ? axisColor : gridColor} strokeWidth={1} strokeDasharray={v === 0 ? "3 4" : undefined} />)}
        {[-0.5, 0, 0.5].map(v => <text key={"st" + v} x={PAD_L - 6} y={sySide(v) + 3.5} textAnchor="end" fontSize={9.5} fill={muted} fontFamily="monospace">{v === 0 ? "0" : v.toFixed(1)}</text>)}
        <text transform={`translate(11 ${SIDE_Y0 + SIDE_H / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill={muted}>y (cm)</text>
        {lenses.map((l, k) => <polygon key={"lens" + k} points={lensPolygon(l)} fill={lensFill} />)}
        <path d={wirePath(1)} fill="none" stroke={c1} strokeWidth={2} />
        <path d={wirePath(-1)} fill="none" stroke={c2} strokeWidth={2} />
        {arrowsOn(1, c1, 1)}
        {arrowsOn(-1, c2, -1)}
        {/* wire labels at wire 1's first crest, where the two wires are farthest apart */}
        {(() => { const zl = N === 0 ? 0.02 : L / (2 * N); return (<>
          <text x={sz(zl)} y={sySide(yWire(zl, 1)) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={c1} fontFamily="monospace">I₁</text>
          <text x={sz(zl)} y={sySide(yWire(zl, -1)) + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill={c2} fontFamily="monospace">I₂</text>
        </>); })()}
        {lenses.map((l, k) => {
          const zc = (l.z0 + l.z1) / 2;
          return <g key={"g" + k}>{dipoleGlyph(sz(zc), sySide(0), glyphR(l), l.mu < 0)}</g>;
        })}
        {[0, 10, 20, 30, 40].map(v => <text key={"zt" + v} x={sz(v / 100)} y={SIDE_Y1 + 13} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="monospace">{v}</text>)}
        <text x={PAD_L + PLOT_W / 2} y={H1 - 5} textAnchor="middle" fontSize={10} fill={muted}>z along the pair (cm)</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center", fontSize: 12, color: text }}>
        {legendItem(<span style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${text}`, display: "inline-block", boxSizing: "border-box" }} />, `${lenses.length} ${lenses.length === 1 ? "loop" : "loops"}, |μ| = ${(Math.abs(lenses[0].mu) * mUnit).toFixed(2)} mA·m²${lenses.length > 1 ? " each" : ""}`)}
        {legendItem(null, `net μ = ${(net * mUnit).toFixed(2)} mA·m²`)}
      </div>

      {/* Panel 2: the field beside the pair */}
      <svg ref={svg2Ref} viewBox={`0 0 ${W} ${H2}`} style={{ width: "100%", height: "auto", display: "block", background: svgBg, borderRadius: 12, border: `1px solid ${border}`, touchAction: "none", cursor: "crosshair" }}
        onPointerMove={e => setHoverR(rFromEvent(e))}
        onPointerLeave={() => setHoverR(null)}
        onPointerDown={e => { const r = rFromEvent(e); if (r != null) setPinned(r); }}>
        {[0.01, 0.1, 1, 10, 100].map(v => <line key={"fg" + v} x1={PAD_L} y1={sb(v)} x2={PAD_L + PLOT_W} y2={sb(v)} stroke={gridColor} strokeWidth={1} />)}
        {[5, 10, 15, 20].map(v => <line key={"fx" + v} x1={sr(v)} y1={F_Y0} x2={sr(v)} y2={F_Y1} stroke={gridColor} strokeWidth={1} />)}
        <line x1={PAD_L} y1={F_Y0} x2={PAD_L} y2={F_Y1} stroke={axisColor} strokeWidth={1.5} />
        <line x1={PAD_L} y1={F_Y1} x2={PAD_L + PLOT_W} y2={F_Y1} stroke={axisColor} strokeWidth={1.5} />
        {[0.01, 0.1, 1, 10, 100].map(v => <text key={"ft" + v} x={PAD_L - 6} y={sb(v) + 3.5} textAnchor="end" fontSize={9.5} fill={muted} fontFamily="monospace">{v}</text>)}
        {[0, 5, 10, 15, 20].map(v => <text key={"fxt" + v} x={sr(v)} y={F_Y1 + 13} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="monospace">{v}</text>)}
        <text x={PAD_L + PLOT_W / 2} y={H2 - 5} textAnchor="middle" fontSize={10} fill={muted}>r from the pair (cm)</text>
        <text transform={`translate(11 ${F_Y0 + F_H / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill={muted}>B (μT)</text>
        <path d={curves.one} fill="none" stroke={muted} strokeWidth={1.5} strokeDasharray="2 4" />
        <path d={curves.pair} fill="none" stroke={text} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.8} />
        <path d={curves.twist} fill="none" stroke={text} strokeWidth={2.5} strokeLinejoin="round" />
        {(() => {
          const px = sr(probeR);
          const label = `r = ${probeR.toFixed(1)} cm: twisted ${fmtB(probe.twist)}, straight ${fmtB(probe.pair)}, one wire ${fmtB(probe.one)} μT`;
          const lw = label.length * 6.05 + 12;
          const lx = Math.min(Math.max(PAD_L, px - lw / 2), PAD_L + PLOT_W - lw);
          return (
            <g pointerEvents="none">
              <line x1={px} y1={F_Y0} x2={px} y2={F_Y1} stroke={hoverR == null ? teal : axisColor} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={px} cy={sb(probe.twist)} r={4} fill={text} stroke={svgBg} strokeWidth={2} />
              {hoverR == null && <polygon points={`${px - 5},${F_Y1 + 1} ${px + 5},${F_Y1 + 1} ${px},${F_Y1 - 6}`} fill={teal} />}
              <rect x={lx} y={F_Y1 - 26} width={lw} height={18} rx={5} fill={isLight ? "rgba(255,255,255,0.92)" : "rgba(28,29,30,0.92)"} stroke={border} />
              <text x={lx + 6} y={F_Y1 - 13.5} fontSize={10} fill={text} fontFamily="monospace">{label}</text>
            </g>
          );
        })()}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center", fontSize: 13, fontWeight: 600, color: text }}>
        {legendItem(<span style={{ width: 26, height: 0, borderTop: `3px solid ${text}` }} />, pitchCm ? `Twisted pair, pitch ${pitchCm.toFixed(0)} cm` : "Twisted pair (no twist)")}
        {legendItem(<span style={{ width: 26, height: 0, borderTop: `2px dashed ${text}`, opacity: 0.8 }} />, "Straight pair")}
        {legendItem(<span style={{ width: 26, height: 0, borderTop: `2px dotted ${muted}` }} />, "One wire", muted)}
      </div>
    </div>
  );
}
