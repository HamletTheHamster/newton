// The physics behind TwistedPairSim (src/components/sims/TwistedPairSim.jsx): a pair of wires
// carrying equal and opposite currents, twisted N half-turns over a length L, as a chain of
// current loops and as a source of magnetic field. Pure and SI throughout (m, A, T) so the
// numbers can be checked with plain node (src/twisted-pair.test.mjs); the component converts
// to the cm / μT the sliders use.
//
// Geometry. The pair's axis is z. Wire 1 sits at angle θ(z) = πN z / L on a circle of radius
// d/2 about the axis, wire 2 at θ + π; wire 1 carries I in +z, wire 2 carries it back. Seen from
// the side (the page plane holds the axis and y) the wires are y = ±(d/2) sin θ(z): they cross
// in projection at z = kL/N, and between consecutive crossings the two wires enclose a lens.
// Each lens is a current loop, and its dipole moment along the viewing axis is I times the lens
// area, with the sign alternating lens to lens because the wires swap sides at every crossing.
// That alternation is the projection of a normal that ROTATES with θ along the pair; over a
// whole number of full twists the dipoles sum to zero, which is why twisting kills the stray
// field. N = 0 is the straight pair, drawn at y = ±d/2, whose one "lens" is the rectangle d × L.

export const MU0_OVER_4PI = 1e-7;   // T·m/A

// Area of each lens in projection: ∫₀^{L/N} d |sin(πN z / L)| dz = 2dL / (πN).
export const lensArea = (d, L, N) => (N <= 0 ? d * L : (2 * d * L) / (Math.PI * N));

// The chain of lens dipoles along the pair, in order: { z0, z1, area, mu } with mu the signed
// dipole component along the viewing axis (positive = toward the viewer, i.e. out of the page).
// It is μ, not m, because Young & Freedman write the magnetic dipole moment as μ (μ = IA,
// §27.7), and everything students see here follows the textbook's notation.
// Between crossings k and k+1 wire 1 is above (y > 0) when k is even; current then runs +z along
// the top wire and −z along the bottom, a clockwise circulation as drawn, so the dipole points
// INTO the page: mu < 0 for even k, > 0 for odd k. For N = 0 wire 1 is the top wire everywhere.
export function lensDipoles(I, d, L, N) {
  const n = Math.max(1, N);
  const A = lensArea(d, L, N);
  return Array.from({ length: n }, (_, k) => ({
    z0: (k * L) / n,
    z1: ((k + 1) * L) / n,
    area: A,
    mu: (k % 2 === 0 ? -1 : 1) * I * A,
  }));
}

export const netDipole = dipoles => dipoles.reduce((s, l) => s + l.mu, 0);

// Field of ONE wire (μ0 I / 2π r), and of the straight pair in its own plane at distance r from
// the pair's axis: the two fields oppose, so B = (μ0 I / 2π) d / (r² − d²/4). Both in tesla.
export const singleWireField = (I, r) => (2 * MU0_OVER_4PI * I) / r;
export const straightPairField = (I, d, r) => (2 * MU0_OVER_4PI * I * d) / (r * r - (d * d) / 4);

// Biot–Savart for the twisted pair, |B| at a point a distance r from the axis in the +y
// direction (the plane of the side view), at height z along the pair. The pair is computed as
// longer than it is drawn (`compLength`, centred on the drawn midpoint L/2, same pitch) so the
// open ends of a short pair cannot put a false floor under the far field: a 40 cm pair's ends
// alone give ~0.1 μT at 10 cm, which would hide exactly the drop-off the plot is there to show.
export function twistedPairField(I, d, L, N, r, z, { segments = 4000, compLength = 2.0 } = {}) {
  if (N <= 0) return straightPairField(I, d, r);
  const k = (Math.PI * N) / L;                        // rad per metre of pair
  const zStart = L / 2 - compLength / 2;
  const dz = compLength / segments;
  let Bx = 0, By = 0, Bz = 0;
  for (const [sgn, phase] of [[1, 0], [-1, Math.PI]]) {
    let px = (d / 2) * Math.cos(k * zStart + phase), py = (d / 2) * Math.sin(k * zStart + phase), pz = zStart;
    for (let s = 1; s <= segments; s++) {
      const zz = zStart + s * dz, th = k * zz + phase;
      const qx = (d / 2) * Math.cos(th), qy = (d / 2) * Math.sin(th), qz = zz;
      const dlx = qx - px, dly = qy - py, dlz = qz - pz;
      const mx = (qx + px) / 2, my = (qy + py) / 2, mz = (qz + pz) / 2;
      const Rx = -mx, Ry = r - my, Rz = z - mz;
      const R2 = Rx * Rx + Ry * Ry + Rz * Rz;
      const inv = 1 / (R2 * Math.sqrt(R2));
      Bx += sgn * (dly * Rz - dlz * Ry) * inv;
      By += sgn * (dlz * Rx - dlx * Rz) * inv;
      Bz += sgn * (dlx * Ry - dly * Rx) * inv;
      px = qx; py = qy; pz = qz;
    }
  }
  const c = MU0_OVER_4PI * I;
  return c * Math.sqrt(Bx * Bx + By * By + Bz * Bz);
}

// The field a student would meet beside the pair: the twisted pair's field varies along z with
// the pitch (it is largest beside a lens centre and smallest beside a crossing), so "the field
// at distance r" is taken as the LARGEST over a quarter pitch from the midpoint, which is the
// honest number for "how much field leaks out". For the straight pair there is no variation.
export function twistedPairFieldMax(I, d, L, N, r, opts) {
  if (N <= 0) return straightPairField(I, d, r);
  const pitch = (2 * L) / N;
  let best = 0;
  for (const f of [0, 0.125, 0.25]) best = Math.max(best, twistedPairField(I, d, L, N, r, L / 2 + f * pitch, opts));
  return best;
}
