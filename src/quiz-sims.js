// The physics behind the PHY 215 quiz simulations other than the twisted pair (which has its
// own module, src/twisted-pair.js). Pure and SI throughout so the numbers can be checked with
// plain node (src/quiz-sims.test.mjs); the components convert to the units their sliders show.
//
//   bulbs      q7_1  identical bulbs on a flashlight battery, in series or in parallel
//   rc         q7_2  a capacitor charging through a resistor
//   gauss      q3_3, q3_4  field lines of a point charge through a closed surface
//   chargeInB  q8_1, q8_2  a charged particle moving through a uniform magnetic field

// ── q7_1: bulbs ─────────────────────────────────────────────────────────────────────────────
// N identical bulbs of resistance R on a battery of emf ε (Young & Freedman's symbol) and
// internal resistance r, ideal when r = 0. Series: one loop, I = ε / (NR + r), each bulb
// dissipates I²R. Parallel: the bulbs are R/N together, the battery supplies
// I = ε / (R/N + r), the terminal voltage I·R/N is what each bulb sees, and with an ideal cell
// that is the full ε however many there are. A bulb's brightness is its power, and "how long
// the battery lasts" is set by the current the battery must supply.
export function bulbs(N, arrangement, emf, R, r = 0) {
  const n = Math.max(1, Math.round(N));
  if (arrangement === "series") {
    const I = emf / (n * R + r);
    return { n, arrangement, bulbCurrent: I, bulbVoltage: I * R, bulbPower: I * I * R, batteryCurrent: I, terminalVoltage: I * n * R, totalPower: I * I * n * R };
  }
  const Rp = R / n;
  const I = emf / (Rp + r);
  const vTerm = I * Rp, iBulb = vTerm / R;
  return { n, arrangement, bulbCurrent: iBulb, bulbVoltage: vTerm, bulbPower: iBulb * iBulb * R, batteryCurrent: I, terminalVoltage: vTerm, totalPower: n * iBulb * iBulb * R };
}

// ── q7_2: RC ────────────────────────────────────────────────────────────────────────────────
// Charging from zero at t = 0 through R onto C from an emf ε: q(t) = Cε (1 − e^{−t/RC}) and
// i(t) = (ε/R) e^{−t/RC} (Y&F 26.12, 26.13). The final charge Q_f = Cε does not contain R;
// the time constant τ = RC is where R lives.
export const rcCharge = (t, emf, R, C) => C * emf * (1 - Math.exp(-t / (R * C)));
export const rcCurrent = (t, emf, R, C) => (emf / R) * Math.exp(-t / (R * C));
export const rcFinalCharge = (emf, C) => C * emf;
export const rcTimeConstant = (R, C) => R * C;

// ── q3: Gauss ───────────────────────────────────────────────────────────────────────────────
// A point charge at (cx, cy) with `count` field lines leaving it at evenly spaced angles, and
// a circular closed surface of radius `radius` about the origin. Each line is a ray; a ray
// from a charge INSIDE the surface crosses it exactly once, outward; a ray from a charge
// OUTSIDE either misses or crosses twice (in, then out). So the net crossing count is `count`
// for an enclosed charge and 0 otherwise, whatever the radius and wherever the charge sits:
// that is Gauss's law, counted. Returns each line's crossings (distances along the ray) plus
// the totals the readout prints.
export function fieldLineCrossings(cx, cy, count, radius, rayLength = 1e9) {
  const lines = [];
  let out = 0, inward = 0;
  for (let k = 0; k < count; k++) {
    const a = (2 * Math.PI * k) / count + Math.PI / count;   // offset so no line runs along an axis
    const dx = Math.cos(a), dy = Math.sin(a);
    // |P + s D|² = r²  →  s² + 2 s (P·D) + |P|² − r² = 0
    const b = cx * dx + cy * dy, c = cx * cx + cy * cy - radius * radius;
    const disc = b * b - c;
    const hits = [];
    if (disc >= 0) {
      const s1 = -b - Math.sqrt(disc), s2 = -b + Math.sqrt(disc);
      if (s1 > 0 && s1 < rayLength) { hits.push({ s: s1, dir: "in" }); inward++; }
      if (s2 > 0 && s2 < rayLength) { hits.push({ s: s2, dir: "out" }); out++; }
    }
    lines.push({ angle: a, dx, dy, hits });
  }
  return { lines, out, in: inward, net: out - inward, enclosed: cx * cx + cy * cy < radius * radius };
}

// Field of a point charge q at distance r (Coulomb's law), and at a point from a charge at
// (cx, cy): the vector, for the marker on the surface.
export const K_E = 8.988e9;   // N·m²/C²
export function pointChargeField(q, cx, cy, px, py) {
  const rx = px - cx, ry = py - cy;
  const r2 = rx * rx + ry * ry, r = Math.sqrt(r2);
  if (r === 0) return { Ex: 0, Ey: 0, E: Infinity, r: 0 };
  const E = (K_E * q) / r2;
  return { Ex: (E * rx) / r, Ey: (E * ry) / r, E: Math.abs(E), r };
}

// ── q8: a charge in a uniform B ─────────────────────────────────────────────────────────────
// B along +x. A particle of charge q, mass m and speed v launched at angle θ to B (in the
// x–y plane) feels F = q v × B of magnitude |q| v B sin θ, always perpendicular to v, so its
// speed never changes: the component along B (v cos θ) is untouched and the perpendicular
// component (v sin θ) goes round a circle of radius r = m v sin θ / |q| B with angular speed
// ω = |q| B / m (Y&F 27.11, 27.12). θ = 0 or 180° means no force and a straight line.
// sin θ and cos θ are snapped to zero within floating-point noise of 0°, 90° and 180°, so
// "along B" is exactly a straight line rather than a circle of radius 1e-10 m that a readout
// would print, and "across B" is exactly a circle with no drift along B.
const snap = x => (Math.abs(x) < 1e-12 ? 0 : x);
const sinTheta = theta => snap(Math.sin(theta));
const cosTheta = theta => snap(Math.cos(theta));
export const magneticForce = (q, v, B, theta) => Math.abs(q) * v * B * Math.abs(sinTheta(theta));
export const cyclotronRadius = (q, m, v, B, theta) => (q === 0 || B === 0 ? Infinity : (m * v * Math.abs(sinTheta(theta))) / (Math.abs(q) * B));
export const cyclotronOmega = (q, m, B) => (Math.abs(q) * B) / m;

// Position and velocity at time t, starting at the origin. For a positive charge with B in
// +x and v in the x–y plane at t = 0, F = q v × B points along −z at launch (ŷ × x̂ = −ẑ), so
// the circle is traced in the y–z plane starting toward −z; a negative charge goes the other
// way. Both are the same closed form with the sign of q in the sense of rotation.
export function chargeInB(q, m, v, B, theta, t) {
  const vPar = v * cosTheta(theta), vPerp = v * sinTheta(theta);
  const w = cyclotronOmega(q, m, B);
  const sgn = q >= 0 ? 1 : -1;
  if (w === 0 || vPerp === 0) {
    return { x: vPar * t, y: vPerp * t, z: 0, vx: vPar, vy: vPerp, vz: 0, speed: v };
  }
  const r = vPerp / w;
  // y(t) = r sin(ωt), z(t) = −sgn · r (1 − cos ωt): starts at the origin moving in +y, curving
  // toward −z (positive q) or +z (negative q).
  const y = r * Math.sin(w * t);
  const z = -sgn * r * (1 - Math.cos(w * t));
  const vy = vPerp * Math.cos(w * t);
  const vz = -sgn * vPerp * Math.sin(w * t);
  return { x: vPar * t, y, z, vx: vPar, vy, vz, speed: Math.sqrt(vPar * vPar + vy * vy + vz * vz) };
}
