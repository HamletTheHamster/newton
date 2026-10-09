// SERVER-ONLY solvers for parameterized homework problems. The leading underscore tells Netlify
// this is an importable helper, NOT a deployed endpoint; like _answerKeys.js it is imported only
// by grade.js and is never shipped to the browser.
//
// A solver takes one problem's params (drawn deterministically from the student's seed - see
// src/hw-variants.js) and returns the answers to that problem's items. It is the moving half of
// the answer key: _answerKeys.js holds the committed instance's answers and all of the grading
// METADATA (sigFigs, unit, tolerance, nonNegative, angle, sci), and a solver replaces only the
// `answer`. That split is deliberate - a variant must never be able to change the tolerance a
// blank is graded with, or how its answer is formatted on reveal.
//
// THE RULES FOR WRITING ONE
//
//   1. Solve the problem symbolically, from the physics, exactly as the authoring process
//      requires of any answer that reaches a student (CLAUDE.md: independently solve every
//      problem). NEVER fit a formula to the one committed answer: it would reproduce that answer
//      perfectly and be wrong for every other draw, which is precisely the failure the fidelity
//      test exists to catch and the one shape of bug it cannot catch on its own.
//   2. Return an entry for every item whose answer depends on ANY param. An item left out
//      inherits the committed answer, which is correct only when that answer is genuinely
//      independent of every param (a direction that never flips, a purely symbolic result).
//   3. A text/math answer that quotes derived numbers must be re-rendered here, with the
//      computed values, or a student who reveals it reads a paragraph about a different problem.
//      Keep the committed wording and swap only the numbers - invariant B checks the whole
//      string against the committed one at base params.
//   4. Use the course's declared constants below. They are what the committed keys were worked
//      with, so anything else shows up as a fidelity failure in the last digit.
import { toSigFigString } from "../../src/grading-core.js";
import { lookupAnswer } from "./_answerKeys.js";
import { variantSpec } from "../../src/courses/variants/index.js";
import { paramsFor } from "../../src/hw-variants.js";

// PHY 215's constant convention (docs/courses/phy215.md): k = 8.988e9, e = 1.602e-19,
// m_e = 9.109e-31, m_p = 1.673e-27, g = 9.81. Both courses use g = 9.81 m/s^2.
const K_E = 8.988e9;      // N m^2 / C^2
const EPS0 = 8.8542e-12;  // C^2 / N m^2  (k = 1/4 pi eps0 to six figures)
const E_CHG = 1.602e-19;  // C
const M_E = 9.109e-31;    // kg
const M_P = 1.673e-27;    // kg
const G = 9.81;           // m/s^2

// Significant-figure formatting for a number quoted inside a re-rendered prose answer, so the
// sentence reads like the committed one ("5.39 μN vs. 3.00 μN") rather than spilling float noise.
const sf = (v, n = 3) => toSigFigString(v, n);

// The same thing in LaTeX scientific notation, for a prose answer that quotes a large or small
// number the way the committed one does ("1.36\times10^{5}"). toSciString in grading-core is no
// use here: it emits Unicode superscripts for the answer box, not LaTeX for a sentence.
const sciTex = (v, n = 3) => {
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / 10 ** exp;
  return `${sf(mant, n)}\\times10^{${exp}}`;
};

export const SOLVERS = {
  physics2: {
    // 21.2 — Q = (dq/dt) t, then N = Q/e.
    hw1_p1: p => {
      const Q = p.rate_k * 1000 * p.t_us * 1e-6;
      return { hw1_p1a: Q, hw1_p1b: Q / E_CHG };
    },

    // 21.9 — equal charges: F = k q^2 / r^2, so q = sqrt(F r^2 / k).
    // Four-to-one case: F = k (4q')(q') / r^2 = 4 k q'^2 / r^2, so q' = q/2 and 4q' = 2q.
    hw1_p2: p => {
      const r = p.r_cm / 100;
      const q = Math.sqrt(p.F * r * r / K_E);       // C
      return {
        hw1_p2a: q * 1e6,
        hw1_p2b_small: (q / 2) * 1e6,
        hw1_p2b_large: 2 * q * 1e6,
      };
    },

    // 21.22 — q3 is negative and both others positive, so both pull it toward themselves: q1
    // (at +x1) pulls it in +x, q2 (at -x2) pulls it in -x. Magnitudes k q_i |q3| / x_i^2, and
    // the spec's constraint guarantees the +x pull wins, so the net magnitude is F1 - F2.
    hw1_p3: p => {
      const F1 = K_E * (p.q1 * 1e-9) * (p.q3 * 1e-9) / (p.x1 * p.x1);
      const F2 = K_E * (p.q2 * 1e-9) * (p.q3 * 1e-9) / (p.x2 * p.x2);
      const net = (F1 - F2) * 1e6;                  // μN
      return {
        hw1_p3_m: net,
        hw1_p3_d: `In the $+x$-direction (toward $q_1$). Both charges attract $q_3$ because $q_3$ is negative and both are positive, so $q_1$ pulls it toward $+x$ and $q_2$ pulls it toward $-x$. The pull from $q_1$ is stronger ($${sf(F1 * 1e6)}\\ \\mu\\text{N}$ vs. $${sf(F2 * 1e6)}\\ \\mu\\text{N}$) because it is closer ($${p.x1.toFixed(3)}\\text{ m}$ vs. $${p.x2.toFixed(3)}\\text{ m}$), and distance matters more than the slightly larger $q_2$, so the net force points toward $q_1$ along $+x$.`,
      };
    },

    // 21.45 — collinear signed x-components. q1 (+, at the origin) pushes a test charge away
    // from the origin; q2 (-, at xq) pulls it toward xq. So at a point x:
    //   E = k q1 sign(x) / x^2  +  k q2 sign(xq - x) / (x - xq)^2
    // with q2 entered as a magnitude. The force on an ELECTRON is -e E, which flips the sign.
    hw1_p7: p => {
      const q1 = p.q1 * 1e-9, q2 = p.q2 * 1e-9;
      const field = x => {
        const e1 = K_E * q1 * Math.sign(x) / (x * x);
        const e2 = K_E * q2 * Math.sign(p.xq - x) / ((x - p.xq) ** 2);
        return e1 + e2;
      };
      const Ea = field(p.xa), Eb = field(p.xb), Ec = field(-p.xc);
      return {
        hw1_p7a_i: Ea, hw1_p7a_ii: Eb, hw1_p7a_iii: Ec,
        hw1_p7b_i: -E_CHG * Ea, hw1_p7b_ii: -E_CHG * Eb, hw1_p7b_iii: -E_CHG * Ec,
      };
    },

    // ── hw2 — Ch. 22, Gauss's law ─────────────────────────────────────────────
    // 22.6 — flux through a flat sheet in a uniform field: Phi = E A cos(phi). Part (c) asks
    // about the angle in general and is independent of all three givens, so it is not returned
    // here and inherits the committed answer.
    hw2_p1: p => {
      const flux = p.E * p.A * Math.cos(p.phi * Math.PI / 180);
      return {
        hw2_p1a: flux,
        hw2_p1b: `No. For a flat sheet in a uniform field the flux is $\\Phi_E = \\vec E \\cdot \\vec A = EA\\cos\\phi$, which depends only on the magnitude of the field, the area of the sheet, and the angle between the field and the normal to the sheet. The outline of the sheet appears nowhere in that expression, so a square, a circle, a triangle or any other shape of the same $${p.A.toFixed(3)}\\text{ m}^2$ held at the same $${p.phi.toFixed(0)}°$ orientation intercepts the same number of field lines and gives the same flux, $${sf(flux, 2)}\\text{ N}\\cdot\\text{m}^2/\\text{C}$.`,
      };
    },

    // 22.9 — the sphere passes through the point where E was measured, so Phi = E (4 pi r^2),
    // and Gauss's law then gives the charge, Q = eps0 Phi.
    hw2_p2: p => {
      const E = p.Emant * 1e6;
      const flux = E * 4 * Math.PI * p.r * p.r;
      return { hw2_p2a: flux, hw2_p2b: flux * EPS0 * 1e6 };
    },

    // 22.10 — only the length of line inside the cylinder matters: Phi = Q_encl/eps0 = lambda l
    // / eps0. Widening it encloses the same charge (part b), doubling its length encloses twice
    // as much (part c). Part (d) argues from both numbers, so it is rebuilt with them.
    hw2_p3: p => {
      const lam = p.lam * 1e-6;
      const flux = lam * p.l / EPS0;
      const fluxLong = lam * p.l2 / EPS0;
      return {
        hw2_p3a: flux,
        hw2_p3b: flux,
        hw2_p3c: fluxLong,
        hw2_p3d: `Gauss's law says the flux depends only on the charge enclosed, $\\Phi_E = Q_{encl}/\\epsilon_0$, so the flux changes only if the change puts a different amount of the line inside the cylinder. Widening the cylinder from $r = ${p.r.toFixed(3)}\\text{ m}$ to $r = ${p.r2.toFixed(3)}\\text{ m}$ encloses exactly the same $${p.l.toFixed(3)}\\text{ m}$ of line, so the enclosed charge, and hence the flux, is unchanged at $${sciTex(flux)}\\text{ N}\\cdot\\text{m}^2/\\text{C}$. Working it out the long way through $\\Phi_E = EA$ shows the same thing from the other side: doubling the radius doubles the area of the curved surface, $A = 2\\pi r l$, but the field there, $E = \\lambda/2\\pi\\epsilon_0 r$, drops to half its former value, and the two changes cancel exactly. Doubling the length from $${p.l.toFixed(3)}\\text{ m}$ to $${p.l2.toFixed(3)}\\text{ m}$ is different: it puts twice as much of the line inside the cylinder, so the enclosed charge doubles and the flux doubles with it, to $${sciTex(fluxLong)}\\text{ N}\\cdot\\text{m}^2/\\text{C}$.`,
      };
    },

    // 22.12 — Phi = Q_encl/eps0, and the only question is which charges each sphere encloses:
    // (a) neither, (b) q2 alone, (c) both. q2 is entered as a magnitude and is negative.
    hw2_p4: p => ({
      hw2_p4a: 0,
      hw2_p4b: -p.q2 * 1e-9 / EPS0,
      hw2_p4c: (p.q1 - p.q2) * 1e-9 / EPS0,
    }),

    // 22.23 — outside a charged conductor the field is that of a point charge at its center,
    // E = k q /(R + d)^2; inside a conductor in equilibrium it is zero. Part (c) is the Gauss's
    // law argument for that zero, and quotes the radius of the interior Gaussian surface.
    hw2_p5: p => ({
      hw2_p5a: K_E * p.q * 1e-9 / ((p.R + p.d) ** 2),
      hw2_p5b: 0,
      hw2_p5c: `Any net charge on a conductor in electrostatic equilibrium sits entirely on its outer surface. The charges in a conductor are free to move and they repel one another, so they spread as far apart as they can get, which puts all of them on the surface. A spherical Gaussian surface drawn inside the metal, at radius $${p.inside.toFixed(3)}\\text{ m}$, therefore encloses no charge at all, so Gauss's law gives $\\oint \\vec E \\cdot d\\vec A = Q_{encl}/\\epsilon_0 = 0$. By the spherical symmetry the field has the same magnitude everywhere on that surface and is radial, so $4\\pi r^2 E = 0$ and $E = 0$ at every point inside. Equivalently: if the field inside were not zero it would push the free charges around, and the conductor would not be in equilibrium.`,
    }),

    // 22.29 — each line sits in the other's field E = lambda/(2 pi eps0 d), so the force on a
    // length L of one is F = lambda L E = lambda^2 L /(2 pi eps0 d).
    hw2_p6: p => {
      const lam = p.lam * 1e-6;
      return { hw2_p6: lam * lam * p.L / (2 * Math.PI * EPS0 * p.d) };
    },

    // 22.31 — the sheet's field is uniform, E = sigma/(2 eps0), so the work done on the electron
    // over the distance it closes is W = e E (d1 - d2), and all of it goes to kinetic energy.
    hw2_p7: p => {
      const E = p.sigmant * 1e-12 / (2 * EPS0);
      const W = E_CHG * E * (p.d1 - p.d2);
      return { hw2_p7a: W, hw2_p7b: Math.sqrt(2 * W / M_E) };
    },

    // 22.43 — the sheet's field is uniform, E = sigma/(2 eps0), so equilibrium of the hanging
    // sphere gives tan(theta) = qE/mg with no distance in it anywhere. Part (c) is that
    // observation, and quotes the angle.
    hw2_p9: p => {
      const E = p.sig_mant * 1e-9 / (2 * EPS0);
      const q = p.q_mant * 1e-8;
      const m = p.m_mant * 1e-6;
      const theta = Math.atan(q * E / (m * G)) * 180 / Math.PI;
      return {
        hw2_p9_ang: theta,
        hw2_p9_why: `No, the angle would not change in either case. Gauss's law gives the field of a very large uniformly charged sheet as $E = \\sigma/2\\epsilon_0$, which contains no distance: the field has the same magnitude everywhere near the sheet. (Applying Gauss's law to a box straddling the sheet, the flux $2EA$ equals $\\sigma A/\\epsilon_0$, and the area cancels.) So the horizontal electric force on the sphere, $F = qE = q\\sigma/2\\epsilon_0$, is the same no matter how far from the sheet it hangs. Equilibrium requires $T\\sin\\theta = qE$ and $T\\cos\\theta = mg$, so $\\tan\\theta = qE/mg = q\\sigma/2mg\\epsilon_0$, which depends only on the charge, the surface charge density, and the weight. Lengthening the thread or starting the sphere nearer the sheet moves where the sphere ends up, but the thread still settles at the same $${sf(theta, 3)}°$ from the vertical.`,
      };
    },

    // ── hw3 — Ch. 23, electric potential ──────────────────────────────────────
    // 23.5 — W = U_i - U_f = k q1 q2 (1/r_i - 1/r_f), with q2 negative. The final point is at
    // (x2, x2), so r_f = x2 sqrt(2).
    hw3_p1: p => {
      const q1 = p.q1 * 1e-6, q2 = -p.q2 * 1e-6;
      const rf = p.x2 * Math.SQRT2;
      return { hw3_p1: K_E * q1 * q2 * (1 / p.x1 - 1 / rf) };
    },

    // 23.9 — (a) the work is the change in potential energy, W = k e^2 (1/r_nuc - 1/r_at).
    // (b) released from rest, that energy is shared equally by the two protons, so each gets
    // W/2 = (1/2) m_p v^2 and v = sqrt(W/m_p).
    hw3_p2: p => {
      const rAt = p.r_at * 1e-10, rNuc = p.r_nuc * 1e-15;
      const W = K_E * E_CHG * E_CHG * (1 / rNuc - 1 / rAt);
      return { hw3_p2a: W, hw3_p2b: Math.sqrt(W / M_P) };
    },

    // 23.14 — three pairs, each k q^2 / a.
    hw3_p3: p => ({ hw3_p3: 3 * K_E * (p.q * 1e-6) ** 2 / p.a }),

    // 23.17 — energy conservation with U = qV: (1/2)mv_B^2 = (1/2)mv_A^2 - q(V_B - V_A), and q is
    // negative, so a rise in potential is a FALL in potential energy and the particle speeds up.
    // Part (b) is that argument with every number in it.
    hw3_p4: p => {
      const q = -p.q * 1e-6;
      const m = p.m_mant * 1e-4;
      const UA = q * p.VA, UB = q * p.VB;
      const KA = 0.5 * m * p.vA * p.vA;
      const KB = KA - (UB - UA);
      const vB = Math.sqrt(2 * KB / m);
      return {
        hw3_p4a: vB,
        hw3_p4b: `Faster: it speeds up from $${p.vA.toFixed(2)}\\text{ m/s}$ to $${sf(vB)}\\text{ m/s}$. The particle's charge is negative, so its potential energy $U = qV$ runs opposite to the potential, and moving to the higher potential at $B$ therefore lowers its potential energy: $U_A = (${sciTex(q)}\\text{ C})(${p.VA.toFixed(0)}\\text{ V}) = ${sciTex(UA)}\\text{ J}$ falls to $U_B = (${sciTex(q)}\\text{ C})(${p.VB.toFixed(0)}\\text{ V}) = ${sciTex(UB)}\\text{ J}$, a drop of $${sciTex(UA - UB)}\\text{ J}$. The electric force is the only force acting, so mechanical energy is conserved and that lost potential energy reappears as kinetic energy: $K$ rises from $${sciTex(KA)}\\text{ J}$ to $${sciTex(KB)}\\text{ J}$, and the speed rises with it. Equivalently, the force on a negative charge points from low potential toward high potential, so here it pushes the particle along its way from $A$ to $B$ and does positive work on it. A positive charge making the same trip would have slowed down instead.`,
      };
    },

    // 23.19 — potentials add as scalars, V = k sum(q_i / r_i), with the distances fixed by the
    // figure: A is midway (0.050 m from each), B is 0.080 m from q1 and 0.060 m from q2. The work
    // done by the field on a charge moved from B to A is W = q (V_B - V_A).
    hw3_p5: p => {
      const q1 = p.q1 * 1e-9, q2 = -p.q2 * 1e-9;
      const VA = K_E * (q1 / 0.050 + q2 / 0.050);
      const VB = K_E * (q1 / 0.080 + q2 / 0.060);
      return { hw3_p5a: VA, hw3_p5b: VB, hw3_p5c: p.qt * 1e-9 * (VB - VA) };
    },

    // 23.41 — (a) energy conservation: (1/2)mv0^2 + kq1q2/d0 = (1/2)mv1^2 + kq1q2/r, so
    //   r = kq1q2 / [ (1/2)m(v0^2 - v1^2) + kq1q2/d0 ].
    // (b) a = F/m = kq1q2/(m r^2) at that point.
    hw3_p7: p => {
      const kqq = K_E * (p.q1 * 1e-6) * (p.q2 * 1e-6);
      const m = p.m_mant * 1e-3;
      const d0 = p.d0_cm / 100;
      const r = kqq / (0.5 * m * (p.v0 * p.v0 - p.v1 * p.v1) + kqq / d0);
      return { hw3_p7a: r, hw3_p7b: kqq / (m * r * r) };
    },

    // 23.62 — equilibrium of the hanging sphere gives qE = mg tan(theta) with theta = 30 degrees
    // (fixed by the diagram key), and the plates are 5.00 cm apart, so V = E d = mg tan(theta) d/q.
    hw3_p10: p => {
      const m = p.m_g / 1000;
      const q = p.q_mant * 1e-6;
      const E = m * G * Math.tan(30 * Math.PI / 180) / q;
      return { hw3_p10_v: E * 0.0500 };
    },

    // ── hw4 — Ch. 24, capacitance and dielectrics ─────────────────────────────
    // Series and parallel helpers, so a network reads the way it is drawn.
    // 24.3 — V = Ed, then A from C = eps0 A/d with C = Q/V, i.e. A = Q/(eps0 E).
    hw4_p1: p => {
      const d = p.d_mm / 1000, Q = p.Q_nC * 1e-9, E = p.E_mant * 1e6;
      const V = E * d;
      return {
        hw4_p1a: V,
        hw4_p1b: (Q / (EPS0 * E)) * 1e4,   // m^2 -> cm^2
        hw4_p1c: (Q / V) * 1e12,           // F -> pF
      };
    },

    // 24.6 — a cylindrical capacitor has C = 2 pi eps0 L / ln(rb/ra), so
    //   rb = ra exp(2 pi eps0 L / C), and lambda = Q/L = CV/L.
    hw4_p2: p => {
      const ra = p.ra_cm / 100, L = p.L_cm / 100, C = p.C_pF * 1e-12;
      const rb = ra * Math.exp(2 * Math.PI * EPS0 * L / C);
      return {
        hw4_p2a: rb * 1000,                 // m -> mm
        hw4_p2b: (C * p.V / L) * 1e9,       // C/m -> nC/m
      };
    },

    // 24.17 — C1 in series with C2, in parallel with C3, all in series with C4. With every
    // capacitance equal to C: the C1-C2 pair is C/2, the parallel group is 3C/2, and the whole
    // network is (3C/2 · C)/(5C/2) = 3C/5. The charge on C4 is the whole network's charge, and
    // what is left of V_ab sits across the parallel group (which is also V_ad).
    hw4_p4: p => {
      const C = p.C * 1e-6, V = p.V;
      const Ceq = 0.6 * C;
      const Q4 = Ceq * V;                   // the series charge, carried by C4
      const Vpar = Q4 / (1.5 * C);          // across the C3 / (C1+C2) group = V_ad
      return {
        hw4_p4a_q1: 0.5 * C * Vpar * 1e6,
        hw4_p4a_q2: 0.5 * C * Vpar * 1e6,
        hw4_p4a_q3: C * Vpar * 1e6,
        hw4_p4a_q4: Q4 * 1e6,
        hw4_p4b_v1: Vpar / 2,
        hw4_p4b_v2: Vpar / 2,
        hw4_p4b_v3: Vpar,
        hw4_p4b_v4: Q4 / C,
        hw4_p4c: Vpar,
      };
    },

    // 24.21 — three parallel branches across ab, with the values printed in the figure: 7.5 nF,
    // a 18.0-30.0-10.0 nF series chain, and 6.5 nF. Only the applied voltage varies.
    hw4_p5: p => {
      const chain = 1 / (1 / 18.0 + 1 / 30.0 + 1 / 10.0);   // nF
      const Ceq = 7.5 + chain + 6.5;                        // nF
      return {
        hw4_p5a: Ceq,
        hw4_p5b: Ceq * p.V,                                 // nF x V = nC
        hw4_p5c: 6.5 * p.V,                                 // it sits straight across ab
        hw4_p5d: p.V,                                       // so does the 7.5 nF
      };
    },

    // 24.26 — the energy density is set by the field alone: u = (1/2) eps0 E^2 with E = V/d.
    // The stated capacitance plays no part.
    hw4_p6: p => {
      const E = p.V / (p.d_mm / 1000);
      return { hw4_p6: 0.5 * EPS0 * E * E };
    },

    // 24.30 — 150 nF in SERIES with 120 nF (both printed in the figure), so they carry the same
    // charge and share the voltage in inverse proportion to their capacitance.
    hw4_p7: p => {
      const c1 = 150e-9, c2 = 120e-9;
      const Ceq = 1 / (1 / c1 + 1 / c2);
      const Q = Ceq * p.V;
      return {
        hw4_p7a: Q * 1e6,
        hw4_p7b_150: Q * 1e6,
        hw4_p7b_120: Q * 1e6,
        hw4_p7c: 0.5 * Ceq * p.V * p.V * 1e6,
        hw4_p7d_150: 0.5 * Q * Q / c1 * 1e6,
        hw4_p7d_120: 0.5 * Q * Q / c2 * 1e6,
        hw4_p7e_150: Q / c1,
        hw4_p7e_120: Q / c2,
      };
    },

    // 24.31 — 35 nF in PARALLEL with 75 nF, so both have the full voltage across them and the
    // charges add. (The pairing with 24.30 is the point of the two problems.)
    hw4_p8: p => {
      const c1 = 35e-9, c2 = 75e-9, V = p.V;
      return {
        hw4_p8a: (c1 + c2) * V * 1e6,
        hw4_p8b_35: c1 * V * 1e6,
        hw4_p8b_75: c2 * V * 1e6,
        hw4_p8c: 0.5 * (c1 + c2) * V * V * 1e3,
        hw4_p8d_35: 0.5 * c1 * V * V * 1e3,
        hw4_p8d_75: 0.5 * c2 * V * V * 1e3,
        hw4_p8e_35: V,
        hw4_p8e_75: V,
      };
    },

    // 24.39 — the field cap fixes the voltage, V = E d, so Q = C0 E d; filling the gap with a
    // dielectric multiplies the capacitance, and so the charge at the same field, by K.
    hw4_p9: p => {
      const Q = p.C0 * 1e-12 * (p.E_mant * 1e4) * (p.d_mm / 1000);
      return { hw4_p9a: Q * 1e12, hw4_p9b: p.K * Q * 1e12 };
    },

    // 24.63 — the ladder, reduced from the right-hand end:
    //   right:  three C1 in series (top, rung, bottom)      -> C1/3
    //   at cd:  that in parallel with the C2 across c and d -> Ccd
    //   middle: C1 + Ccd + C1 in series                     -> Cmid
    //   rung 1: that in parallel with the first C2          -> Cgroup
    //   whole:  C1 + Cgroup + C1 in series                  -> Ceq
    // The charge on each outer C1 is the whole network's charge, and the voltages follow by
    // walking back in: V across the first rung group, then across Ccd.
    hw4_p10: p => {
      const C1 = p.C1 * 1e-6, C2 = p.C2 * 1e-6, V = p.V;
      const Ccd = C2 + C1 / 3;
      const Cmid = 1 / (2 / C1 + 1 / Ccd);
      const Cgroup = C2 + Cmid;
      const Ceq = 1 / (2 / C1 + 1 / Cgroup);
      const Q = Ceq * V;                      // through each outer C1
      const Vgroup = Q / Cgroup;
      const Vcd = (Cmid * Vgroup) / Ccd;
      return {
        hw4_p10a: Ceq * 1e6,
        hw4_p10b_c1a: Q * 1e6,
        hw4_p10b_c1b: Q * 1e6,
        hw4_p10b_c2: C2 * Vgroup * 1e6,
        hw4_p10c: Vcd,
      };
    },

    // ── hw5 — Ch. 25, current, resistance and emf ─────────────────────────────
    // 25.3 — I = n |q| v_d A, so v_d = I/(n e A) and the trip takes t = L/v_d. The diameters are
    // the two gauges' own and do not vary; part (c) compares them and is independent of L and I.
    hw5_p1: p => {
      const n = 8.5e28;
      const L = p.L_cm / 100;
      const timeFor = dmm => {
        const A = Math.PI * (dmm / 2000) ** 2;         // mm diameter -> m^2
        const vd = p.I / (n * E_CHG * A);
        return L / vd / 60;                            // s -> min
      };
      return { hw5_p1a: timeFor(2.05), hw5_p1b: timeFor(4.12) };
    },

    // 25.47 — a bulb's rating is its power at the line voltage, so R = V^2/P and I = P/V.
    hw5_p4: p => ({
      hw5_p4a: p.V * p.V / p.P1,
      hw5_p4b: p.V * p.V / p.P2,
      hw5_p4c_100: p.P1 / p.V,
      hw5_p4c_60: p.P2 / p.V,
    }),

    // 25.48 — the bulb's RESISTANCE is what it carries from country to country, so its power
    // scales as V^2: P' = P (V'/V)^2. The mains voltages are fixed at 220 V and 120 V.
    hw5_p5: p => {
      const EU = 220, US = 120;
      const pUsHere = p.P_eu * (US / EU) ** 2;
      return {
        hw5_p5a: p.P_us * (EU / US) ** 2,
        hw5_p5b: pUsHere,
        hw5_p5c: pUsHere / US,
      };
    },

    // 25.71 — in series the same current runs through both, so
    //   V_batt = I R + (alpha I + beta I^2),  i.e.  beta I^2 + (R + alpha) I - V = 0,
    // and the physical root is the positive one.
    hw5_p7: p => {
      const b = p.R + p.alpha;
      const I = (-b + Math.sqrt(b * b + 4 * p.beta * p.Vb)) / (2 * p.beta);
      return { hw5_p7: I };
    },

    // 25.83 — fully charged, no current flows into C, so the whole current runs through R2 and
    // R1 in series. C sits across R1 (see the figure), so V_R1 = Q/C, the current is
    // I = V_R1/R1, and the emf is I (R1 + R2).
    hw5_p9: p => {
      const vc = p.Q / p.C;                            // = the drawn vc, recomputed from the printed givens
      const I = vc / p.R1;
      return { hw5_p9: I * (p.R1 + p.R2) };
    },

    // 25.84 — fully charged, so no current flows into either capacitor and the steady current
    // runs through R1 and R2 in series. Both capacitors sit across R2, so they share one
    // voltage: V = Q1/C1 gives Q2 = C2 V, and I = V/R2 gives R1 = emf/I - R2.
    hw5_p10: p => {
      const V = p.Q1 / p.C1;
      const I = V / p.R2;
      return { hw5_p10a: p.C2 * V, hw5_p10b: p.emf / I - p.R2 };
    },

    // ── hw6 — Ch. 26, direct-current circuits ─────────────────────────────────
    // 26.1 — three resistors in parallel: each has the full battery voltage across it, so
    // I_i = V/R_i and P_i = V^2/R_i, the equivalent resistance is the reciprocal sum, and the
    // total current is the sum of the branch currents. Part (f) is the comparison, with the
    // extremes named.
    hw6_p1: p => {
      const { R1, R2, R3, V } = p;
      const Req = 1 / (1 / R1 + 1 / R2 + 1 / R3);
      const P1 = V * V / R1, P3 = V * V / R3;
      return {
        hw6_p1a: Req,
        hw6_p1b_160: V / R1,
        hw6_p1b_240: V / R2,
        hw6_p1b_480: V / R3,
        hw6_p1c: V / Req,
        hw6_p1d_160: V,
        hw6_p1d_240: V,
        hw6_p1d_480: V,
        hw6_p1e_160: P1,
        hw6_p1e_240: V * V / R2,
        hw6_p1e_480: P3,
        hw6_p1f: `The resistor with the LEAST resistance, the $${R1.toFixed(2)}\\text{-}\\Omega$ one, dissipates the most power. The three resistors are in parallel, so every one of them has the same $${V.toFixed(1)}\\text{ V}$ across it. With the voltage held fixed, $P = V^2/R$, so the power is inversely proportional to the resistance and the smallest resistance dissipates the most: $${sf(P1)}\\text{ W}$ in the $${R1.toFixed(2)}\\text{-}\\Omega$ resistor against only $${sf(P3)}\\text{ W}$ in the $${R3.toFixed(2)}\\text{-}\\Omega$ one. Physically, the smallest resistance is the easiest path, so it carries the largest current, $I = V/R = ${sf(V / R1)}\\text{ A}$; each of those charges falls through the same $${V.toFixed(1)}\\text{ V}$, so the branch that moves the most charge per second converts the most electrical energy per second into heat. Note that this is the opposite of what happens in SERIES, where the current is common and $P = I^2R$ makes the LARGEST resistance the hottest. What decides the comparison is which quantity the circuit holds fixed.`,
      };
    },

    // 26.81 — a balanced bridge draws no current through the galvanometer, so the two arms
    // divide their potentials in the same ratio: X = MP/N. Part (a) is that derivation and
    // carries no numbers, so it inherits.
    hw6_p10: p => ({ hw6_p10b: p.M * p.P / p.N }),

    // 21.73 — the ball hangs in equilibrium at theta from the wall (the wall is vertical, so
    // theta is from the vertical): T cos(theta) = mg and T sin(theta) = |q| E, hence
    // E = mg tan(theta) / |q|. The 17.4 degree angle is fixed by the figure, so it is a constant
    // here rather than a param. Part (c)'s direction does not depend on any of this.
    hw1_p9: p => {
      const theta = 17.4 * Math.PI / 180;
      const E = (p.m_g / 1000) * G * Math.tan(theta) / (p.q_uC * 1e-6);
      return { hw1_p9_m: E };
    },
  },
};

// The answers for one problem's params, or null when nothing here solves that problem (which is
// the normal case: an unvaried problem is served with its committed numbers and graded against
// the committed key).
export function variantAnswers(courseType, problemId, params) {
  const solver = SOLVERS?.[courseType]?.[problemId];
  if (!solver) return null;
  try { return solver(params) || null; }
  catch { return null; }
}

// The answer-key entry one grading request is judged against. This is the join between the two
// halves of the scheme, and it lives here rather than in grade.js so that the end-to-end test
// (src/variant-fidelity.test.mjs) exercises the same function the endpoint does.
//
// The committed key owns everything about HOW a blank is graded and shown - the tolerance, the
// sig figs, the unit, `sci`, `nonNegative`, `angle` - and a variant replaces only the `answer`.
// So a forged or stale `variant` from a client can change which instance is graded but never
// how: nobody can widen their own tolerance, which is the property that put numeric grading on
// the server in the first place. (Nor is there anything to gain by forging one. A study guide
// will show a student the answer for the asking; a real homework sends no variant at all.)
//
// Falling back to the committed key whenever anything is missing is deliberate, and it is what
// makes partial coverage safe: a problem with no spec, a seed for a problem that is no longer
// parameterized, or a solver that threw all land on the committed instance - which is exactly
// the instance the CLIENT renders when it finds no spec (see variantProblem). The two cannot
// end up disagreeing about which problem the student was asked.
export function resolveKey(courseType, hwId, itemId, variant) {
  const key = lookupAnswer(courseType, hwId, itemId);
  if (!key || !variant?.problemId || !variant?.seed) return key;
  const spec = variantSpec(courseType, variant.problemId);
  if (!spec) return key;
  const answers = variantAnswers(courseType, variant.problemId, paramsFor(spec, variant.seed));
  if (!answers || answers[itemId] == null) return key;
  return { ...key, answer: answers[itemId] };
}
