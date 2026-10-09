// PHY 215 (physics2) variant specs — the client-safe half of a parameterized problem: which of
// its given numbers vary, over what values, and the prompt template they are substituted into.
// The answers live server-side in netlify/functions/_variantSolvers.js, beside the answer key
// and for the same reason.
//
// Read src/hw-variants.js first. The contract in one line: rendering `prompt` with the params'
// `base` values must reproduce the committed prompt in src/courses/physics2.js BYTE FOR BYTE,
// and src/variant-fidelity.test.mjs fails on a single changed space. That is what makes a
// template a faithful hole-punching of the textbook sentence rather than a paraphrase of it
// (CLAUDE.md: prompts are the source problem's wording, verbatim).
//
// AUTHORING RULES, all of them learned from something that would otherwise go wrong silently:
//
//   1. A param is declared in the units and the FORM the prompt prints it in - `r_cm`, not `r`;
//      `rate_k` for the "20" in "20{,}000"; the mantissa alone for a value written
//      "$1.60\times10^6$". Substitution is then a plain find-and-replace and the LaTeX around it
//      is untouched. Converting to SI is the solver's job.
//   2. `decimals` is the printed precision and it is physics, not cosmetics: "0.220 N" offers
//      three significant figures and "0.22 N" two. Keep the committed precision.
//   3. NEVER vary a value the FIGURE shows. The served figures are textbook screenshots; a
//      re-numbered prompt beside a figure still showing the old value is a problem with two
//      different answers. Where the figure carries the geometry, only the quantities it does not
//      print may vary (hw1_p9: the mass and the charge vary, the 17.4 degree angle cannot).
//   4. NEVER vary a value a client-side graph/vector/fbd KEY was built from. Those keys live in
//      physics2.js and no solver can reach them, so varying what they encode would grade a
//      student against a diagram for a different problem. hw1_p10 is left unvaried for exactly
//      this reason: its part (d) trajectory sketch is keyed to part (c)'s numbers.
//   5. A `constraint` may only talk about the GIVENS and their relationships - an ordering the
//      figure shows, a charge ratio, a point staying inside the plates. It must never compute a
//      solved quantity, because this file ships to the browser and a predicate like
//      `k*q/r**2 > ...` would hand over the solution's structure for free. Keeping an answer
//      away from zero (CLAUDE.md: ill-conditioned numerics) is instead enforced at TEST time,
//      where the fidelity sweep re-solves hundreds of draws and rejects any spec that can
//      produce an answer near zero or wildly off the committed scale.
//   6. A problem with no entry here is served with its ORIGINAL numbers, which is a supported
//      outcome, not a gap. Problems that can never be varied, and why, are listed in
//      docs/courses/phy215.md § Study-guide variants.

export const VARIANTS_PHYSICS2 = {
  // ── hw1 — Ch. 21, electric charge and electric field ───────────────────────────
  // 21.2. Both givens are round numbers quoted "about", so both move freely. The comma in
  // "20{,}000" is LaTeX, so the param is the leading figure and the template keeps "{,}000".
  hw1_p1: {
    params: {
      rate_k: { base: 20, choices: [10, 12, 15, 18, 20, 25, 30, 40], decimals: 0 },
      t_us: { base: 100, choices: [50, 60, 80, 100, 120, 150, 200, 250], decimals: 0 },
    },
    prompt: "Lightning occurs when there is a flow of electric charge (principally electrons) between the ground and a thundercloud. The maximum rate of charge flow in a lightning bolt is about ${{rate_k}}{,}000\\text{ C/s}$; this lasts for ${{t_us}}\\ \\mu\\text{s}$ or less.",
  },

  // 21.9. Nothing is pinned by a figure and both parts are numeric, so this is the cleanest kind
  // of variant: two givens, three answers, all of them q = sqrt(F r^2 / k) and its halves.
  hw1_p2: {
    params: {
      r_cm: { base: 15.0, choices: [10.0, 12.0, 15.0, 18.0, 20.0, 24.0, 25.0], decimals: 1 },
      F: { base: 0.220, min: 0.120, max: 0.400, step: 0.005, decimals: 3 },
    },
    prompt: "Two small plastic spheres are given positive electrical charges. When they are ${{r_cm}}\\text{ cm}$ apart, the repulsive force between them has magnitude ${{F}}\\text{ N}$.",
  },

  // 21.22. The direction part (b) is prose that quotes the two competing pulls, so the solver
  // re-renders it; the constraint is what keeps that prose TRUE: q1 must stay the nearer charge
  // and q2 the slightly larger one, or the sentence "the pull from q1 is stronger ... because it
  // is closer ... and distance matters more than the slightly larger q2" stops describing the
  // problem. The margin on the ratio also keeps the net force away from zero, where a +/-2% band
  // would mean nothing.
  hw1_p3: {
    params: {
      q1: { base: 4.00, min: 2.00, max: 6.00, step: 0.50, decimals: 2 },
      x1: { base: 0.200, min: 0.150, max: 0.250, step: 0.010, decimals: 3 },
      q2: { base: 5.00, min: 3.00, max: 9.00, step: 0.50, decimals: 2 },
      x2: { base: 0.300, min: 0.280, max: 0.450, step: 0.010, decimals: 3 },
      q3: { base: 6.00, min: 4.00, max: 9.00, step: 0.50, decimals: 2 },
    },
    // Givens only, and deliberately crude: q2 is the larger charge but only slightly (ratio at
    // most 1.6), while q1 is enough closer (ratio at least 1.45) that being closer must win. Two
    // plain bounds on ratios of the given data, with no squaring and no force computed, are
    // sufficient to guarantee it - and that is the point, since this file ships to the browser
    // (rule 5). The bounds leave the nearer pull at least 30% larger, so the net force is never
    // the small difference of two big numbers.
    constraint: p => p.q2 > p.q1 && p.q2 / p.q1 <= 1.6 && p.x2 / p.x1 >= 1.45,
    prompt: "Two point charges are placed on the $x$-axis as follows: charge $q_1 = +{{q1}}\\text{ nC}$ is located at $x = {{x1}}\\text{ m}$, and charge $q_2 = +{{q2}}\\text{ nC}$ is at $x = -{{x2}}\\text{ m}$. What are the magnitude and direction of the total force exerted by these two charges on a negative point charge $q_3 = -{{q3}}\\text{ nC}$ that is placed at the origin?",
  },

  // 21.45. Collinear, so every answer is a signed x-component and the three field points are
  // part of the question: they are templated too. The constraint holds the configuration's SHAPE
  // (the near point inside the pair, the far point beyond the negative charge, the third point
  // behind the origin, and a charge ratio near the committed one) which is what keeps all six
  // answers away from the cancellation that makes a signed field hypersensitive to rounding.
  hw1_p7: {
    params: {
      q1: { base: 2.00, min: 1.00, max: 4.00, step: 0.50, decimals: 2 },
      q2: { base: 5.00, min: 3.00, max: 8.00, step: 0.50, decimals: 2 },
      xq: { base: 0.800, min: 0.600, max: 1.000, step: 0.100, decimals: 3 },
      xa: { base: 0.200, min: 0.150, max: 0.300, step: 0.050, decimals: 3 },
      xb: { base: 1.20, min: 1.10, max: 1.60, step: 0.10, decimals: 2 },
      xc: { base: 0.200, min: 0.150, max: 0.400, step: 0.050, decimals: 3 },
    },
    // Givens only (rule 5), and each bound earns its keep. The near point stays well inside the
    // pair, so both contributions there point the same way and nothing can cancel. The far point
    // stays close behind the negative charge (xq + 0.25 to xq + 0.5), so that charge dominates
    // there. The third point stays close behind the origin (at most 0.35 xq), so the positive
    // charge dominates there. And the charge ratio is held between 1.8 and 3, which is what
    // makes "close to one charge" decisive rather than a coin toss: without the upper bound, a
    // big q2 at a modest distance cancels the near charge's field almost exactly.
    constraint: p =>
      p.q2 / p.q1 >= 1.8 && p.q2 / p.q1 <= 3.0 &&
      p.xa <= 0.45 * p.xq &&
      p.xb >= p.xq + 0.25 && p.xb <= p.xq + 0.5 &&
      p.xc <= 0.35 * p.xq,
    prompt: "A $+{{q1}}\\text{-nC}$ point charge is at the origin, and a second $-{{q2}}\\text{-nC}$ point charge is on the $x$-axis at $x = {{xq}}\\text{ m}$.\n\nEverything here lies along the $x$-axis, so give each answer as a signed $x$-component: a positive value means the $+x$-direction, a negative value means the $-x$-direction.",
    parts: {
      hw1_p7a_i: { prompt: "(a)(i) Find the electric field at $x = {{xa}}\\text{ m}$." },
      hw1_p7a_ii: { prompt: "(a)(ii) Find the electric field at $x = {{xb}}\\text{ m}$." },
      hw1_p7a_iii: { prompt: "(a)(iii) Find the electric field at $x = -{{xc}}\\text{ m}$." },
      hw1_p7b_i: { prompt: "(b)(i) Find the net electric force the two charges would exert on an electron placed at $x = {{xa}}\\text{ m}$." },
      hw1_p7b_ii: { prompt: "(b)(ii) Find the net electric force on an electron placed at $x = {{xb}}\\text{ m}$." },
      hw1_p7b_iii: { prompt: "(b)(iii) Find the net electric force on an electron placed at $x = -{{xc}}\\text{ m}$." },
    },
  },

  // 21.73. The figure shows the ball on its string against the wall and labels the angle, so the
  // ANGLE CANNOT MOVE (rule 3) - and it is also what the part (a) free-body diagram's key is
  // built from (rule 4). The mass, the string length and the charge are free: part (b) is
  // E = mg tan(theta)/|q|, and part (c)'s direction argument turns only on the charge being
  // negative and the string hanging away from the wall, both of which hold for every draw.
  hw1_p9: {
    // Declares that the part (a) free-body diagram's key does not depend on anything varied
    // here: it is built from the 17.4 degree string angle, which is held fixed, and from the
    // SET of forces acting, which is the same whatever the ball weighs or carries. The mass,
    // the length and the charge change only the numeric answer in part (b).
    graphicalSafe: true,
    params: {
      m_g: { base: 12.3, min: 8.0, max: 24.0, step: 0.1, decimals: 1 },
      L_cm: { base: 28.6, min: 20.0, max: 40.0, step: 0.1, decimals: 1 },
      q_uC: { base: 1.11, min: 0.60, max: 2.40, step: 0.01, decimals: 2 },
    },
    prompt: "A small ${{m_g}}\\text{-g}$ plastic ball is tied to a very light ${{L_cm}}\\text{-cm}$ string that is attached to the vertical wall of a room (see figure). A uniform horizontal electric field exists in this room. When the ball has been given an excess charge of $-{{q_uC}}\\ \\mu\\text{C}$, you observe that it remains suspended, with the string making an angle of $17.4°$ with the wall.",
  },

  // ── hw2 — Ch. 22, Gauss's law ──────────────────────────────────────────────────
  // 22.6. Flux through a flat sheet in a uniform field. The angle choices stop short of 90
  // degrees, where cos(phi) and the flux with it go to zero and a +/-2% band stops meaning
  // anything. Part (c) is about the angle in general and so inherits unchanged; part (b) quotes
  // the area, the angle and the flux, so the solver re-renders it.
  hw2_p1: {
    params: {
      A: { base: 0.250, choices: [0.125, 0.150, 0.200, 0.250, 0.300, 0.400, 0.500], decimals: 3 },
      phi: { base: 60, choices: [30, 40, 45, 50, 60, 70], decimals: 0 },
      E: { base: 14, choices: [8, 10, 12, 14, 16, 20, 24, 30], decimals: 0 },
    },
    prompt: "A flat sheet of paper of area ${{A}}\\text{ m}^2$ is oriented so that the normal to the sheet is at an angle of ${{phi}}°$ to a uniform electric field of magnitude ${{E}}\\text{ N/C}$.",
  },

  // 22.9. Both parts numeric and both read off the same two givens, so this one varies freely.
  // The radius appears again in part (a)'s own wording and is templated there too.
  hw2_p2: {
    params: {
      Emant: { base: 1.25, min: 0.80, max: 2.50, step: 0.05, decimals: 2 },
      r: { base: 0.150, choices: [0.100, 0.120, 0.150, 0.200, 0.250, 0.300], decimals: 3 },
    },
    prompt: "You measure an electric field of ${{Emant}}\\times10^{6}\\text{ N/C}$ at a distance of ${{r}}\\text{ m}$ from a point charge. There is no other source of electric field in the region other than this point charge.",
    parts: {
      hw2_p2a: { prompt: "(a) What is the magnitude of the electric flux through the surface of a sphere that has this charge at its center and that has radius ${{r}}\\text{ m}$?" },
    },
  },

  // 22.10. The widened radius and the doubled length are DERIVED, not drawn: part (d)'s whole
  // argument is that doubling the radius doubles the area while halving the field so the two
  // cancel, and that doubling the length doubles the enclosed charge. Draw them independently
  // and the reference answer would be arguing about a problem the student was not set.
  hw2_p3: {
    params: {
      lam: { base: 3.00, min: 1.50, max: 8.00, step: 0.25, decimals: 2 },
      r: { base: 0.250, choices: [0.150, 0.200, 0.250, 0.300, 0.350], decimals: 3 },
      l: { base: 0.400, choices: [0.250, 0.300, 0.400, 0.500, 0.600], decimals: 3 },
    },
    derived: {
      r2: { from: p => 2 * p.r, decimals: 3 },
      l2: { from: p => 2 * p.l, decimals: 3 },
    },
    prompt: "It was shown in Example 21.11 (Section 21.5) that the electric field due to an infinite line of charge is perpendicular to the line and has magnitude $E = \\lambda/2\\pi\\epsilon_0 r$. Consider an imaginary cylinder with radius $r = {{r}}\\text{ m}$ and length $l = {{l}}\\text{ m}$ that has an infinite line of positive charge running along its axis. The charge per unit length on the line is $\\lambda = {{lam}}\\ \\mu\\text{C/m}$.",
    parts: {
      hw2_p3b: { prompt: "(b) What is the flux through the cylinder if its radius is increased to $r = {{r2}}\\text{ m}$?" },
      hw2_p3c: { prompt: "(c) What is the flux through the cylinder if its length is increased to $l = {{l2}}\\text{ m}$ (with the radius back at ${{r}}\\text{ m}$)?" },
    },
  },

  // 22.12. Three spheres, one in each regime: inside both charges, around the nearer one only,
  // around both. The three radii are templated along with the charges because WHICH charges a
  // sphere encloses is the entire question. No constraint is needed on the charge magnitudes:
  // the ranges cannot overlap, so q2 is always the larger and part (c) always comes out
  // negative, which is what the problem's sign convention and the sweep's sign check require.
  hw2_p4: {
    params: {
      q1: { base: 4.00, min: 2.00, max: 4.50, step: 0.25, decimals: 2 },
      x1: { base: 2.00, min: 1.60, max: 3.00, step: 0.20, decimals: 2 },
      q2: { base: 6.00, min: 5.50, max: 9.00, step: 0.25, decimals: 2 },
      y2: { base: 1.00, min: 0.80, max: 1.40, step: 0.10, decimals: 2 },
      ra: { base: 0.500, choices: [0.400, 0.500, 0.600], decimals: 3 },
      rb: { base: 1.50, min: 1.50, max: 1.60, step: 0.05, decimals: 2 },
      rc: { base: 2.50, min: 3.20, max: 4.00, step: 0.10, decimals: 2 },
    },
    // Each sphere must stay in its own regime, with clearance so that no reader has to squint at
    // a radius that is nearly exactly a charge's distance: inside both, between the two, outside
    // both. (The committed instance's own rc = 2.50 sits only 0.50 outside x1 = 2.00, which is
    // why the drawn range starts further out: the clearance is for the variants, and the base
    // instance is exempt from the constraint by construction.)
    constraint: p => p.ra <= p.y2 - 0.2 && p.rb >= p.y2 + 0.2 && p.rb <= p.x1 - 0.2 && p.rc >= p.x1 + 0.5,
    prompt: "A point charge $q_1 = {{q1}}\\text{ nC}$ is located on the $x$-axis at $x = {{x1}}\\text{ m}$, and a second point charge $q_2 = -{{q2}}\\text{ nC}$ is on the $y$-axis at $y = {{y2}}\\text{ m}$. What is the total electric flux due to these two point charges through a spherical surface centered at the origin with the radius given in each part?\n\nElectric flux is a signed quantity: give each answer with its sign, where a negative value means a net flux inward.",
    parts: {
      hw2_p4a: { prompt: "(a) Radius ${{ra}}\\text{ m}$." },
      hw2_p4b: { prompt: "(b) Radius ${{rb}}\\text{ m}$." },
      hw2_p4c: { prompt: "(c) Radius ${{rc}}\\text{ m}$." },
    },
  },

  // 22.23. The point "d below the surface" has to stay inside the sphere, which is a statement
  // about the derived depth, and part (c)'s Gauss's-law argument quotes that depth by radius.
  hw2_p5: {
    params: {
      R: { base: 0.450, choices: [0.300, 0.350, 0.400, 0.450, 0.500, 0.600], decimals: 3 },
      q: { base: 0.250, min: 0.150, max: 0.600, step: 0.025, decimals: 3 },
      d: { base: 0.100, choices: [0.050, 0.100, 0.150, 0.200], decimals: 3 },
    },
    derived: { inside: { from: p => p.R - p.d, decimals: 3 } },
    constraint: p => p.inside >= 0.100,
    prompt: "A solid metal sphere with radius ${{R}}\\text{ m}$ carries a net charge of ${{q}}\\text{ nC}$.",
    parts: {
      hw2_p5a: { prompt: "(a) Find the magnitude of the electric field at a point ${{d}}\\text{ m}$ outside the surface of the sphere." },
      hw2_p5b: { prompt: "(b) Find the magnitude of the electric field at a point inside the sphere, ${{d}}\\text{ m}$ below the surface." },
    },
  },

  // 22.29. One blank, three givens, nothing pinned by a figure.
  hw2_p6: {
    params: {
      d: { base: 0.300, choices: [0.150, 0.200, 0.250, 0.300, 0.400, 0.500], decimals: 3 },
      lam: { base: 5.20, min: 2.50, max: 9.00, step: 0.10, decimals: 2 },
      L: { base: 0.0500, choices: [0.0250, 0.0400, 0.0500, 0.0750, 0.1000], decimals: 4 },
    },
    prompt: "Two very long uniform lines of charge are parallel and are separated by ${{d}}\\text{ m}$. Each line of charge has charge per unit length $+{{lam}}\\ \\mu\\text{C/m}$. What magnitude of force does one line of charge exert on a ${{L}}\\text{-m}$ section of the other line of charge?",
  },

  // 22.31. The electron must still be released further out than the point it is asked about, or
  // the work changes sign and the problem reads backwards.
  hw2_p7: {
    params: {
      d1: { base: 0.300, choices: [0.200, 0.250, 0.300, 0.400, 0.500], decimals: 3 },
      sigmant: { base: 2.90, min: 1.50, max: 6.00, step: 0.10, decimals: 2 },
      d2: { base: 0.050, choices: [0.025, 0.050, 0.075, 0.100], decimals: 3 },
    },
    constraint: p => p.d2 <= p.d1 - 0.100,
    prompt: "An electron is released from rest at a distance of ${{d1}}\\text{ m}$ from a large insulating sheet of charge that has uniform surface charge density $+{{sigmant}}\\times10^{-12}\\text{ C/m}^2$.",
    parts: {
      hw2_p7a: { prompt: "(a) How much work is done on the electron by the electric field of the sheet as the electron moves from its initial position to a point ${{d2}}\\text{ m}$ from the sheet?" },
      hw2_p7b: { prompt: "(b) What is the speed of the electron when it is ${{d2}}\\text{ m}$ from the sheet?" },
    },
  },

  // 22.43. The part (a) free-body diagram's tension key is the FIGURE's schematic thread angle
  // (25 degrees from vertical, graded to a deliberately wide +/-22 degrees because the data have
  // not yet fixed the angle at diagram time), and `angleSymbol` names the angle rather than
  // measuring it. So the key encodes nothing that varies here. The ranges are kept narrow for a
  // related reason: they hold the true angle at roughly 5 to 25 degrees, so the figure stays an
  // honest picture of the situation and the answer stays well clear of 0 and 90 degrees.
  hw2_p9: {
    graphicalSafe: true,
    params: {
      m_mant: { base: 4.00, min: 3.00, max: 5.50, step: 0.25, decimals: 2 },
      q_mant: { base: 5.00, min: 4.00, max: 7.00, step: 0.25, decimals: 2 },
      sig_mant: { base: 2.50, min: 1.80, max: 3.50, step: 0.10, decimals: 2 },
    },
    prompt: "A small sphere with a mass of ${{m_mant}}\\times10^{-6}\\text{ kg}$ and carrying a charge of ${{q_mant}}\\times10^{-8}\\text{ C}$ hangs from a thread near a very large, charged insulating sheet, as shown in the figure. The charge density on the surface of the sheet is uniform and equal to ${{sig_mant}}\\times10^{-9}\\text{ C/m}^2$.\n\nIn the figure the sheet is on the left and the sphere hangs to the right of the vertical.",
  },

  // ── hw3 — Ch. 23, electric potential ──────────────────────────────────────────
  // 23.5. Work done by the electric force moving q2 from one point to another: it depends only
  // on the two distances from q1, so the second point's x and y (equal in the source) are one
  // param. The constraint keeps the move OUTWARD, which is what makes the work negative for an
  // attracting pair, as the committed sign says.
  hw3_p1: {
    params: {
      q1: { base: 2.40, min: 1.50, max: 4.00, step: 0.10, decimals: 2 },
      q2: { base: 4.30, min: 2.50, max: 6.50, step: 0.10, decimals: 2 },
      x1: { base: 0.150, choices: [0.100, 0.120, 0.150, 0.180, 0.200], decimals: 3 },
      x2: { base: 0.250, choices: [0.200, 0.250, 0.300, 0.350, 0.400], decimals: 3 },
    },
    constraint: p => p.x2 >= p.x1,
    prompt: "A point charge $q_1 = +{{q1}}\\ \\mu\\text{C}$ is held stationary at the origin. A second point charge $q_2 = -{{q2}}\\ \\mu\\text{C}$ moves from the point $x = {{x1}}\\text{ m}$, $y = 0$ to the point $x = {{x2}}\\text{ m}$, $y = {{x2}}\\text{ m}$. How much work is done by the electric force on $q_2$?\n\nWork is a signed quantity: give your answer with its sign.",
  },

  // 23.9. The two separations are the whole problem and both live in part (a)'s wording. They are
  // held orders of magnitude apart (atomic to nuclear) because that contrast is the point of the
  // question, and the nuclear distance dominates the answer.
  hw3_p2: {
    params: {
      r_at: { base: 2.00, choices: [1.00, 1.50, 2.00, 2.50, 3.00], decimals: 2 },
      r_nuc: { base: 3.00, choices: [1.50, 2.00, 2.50, 3.00, 4.00, 5.00], decimals: 2 },
    },
    prompt: "Two protons are pushed together, then released.",
    parts: {
      hw3_p2a: { prompt: "(a) How much work would it take to push the two protons very slowly from a separation of ${{r_at}}\\times10^{-10}\\text{ m}$ (a typical atomic distance) to ${{r_nuc}}\\times10^{-15}\\text{ m}$ (a typical nuclear distance)?" },
    },
  },

  // 23.14. Three identical charges on an equilateral triangle: U = 3 k q^2 / a.
  hw3_p3: {
    params: {
      q: { base: 1.20, min: 0.60, max: 3.00, step: 0.10, decimals: 2 },
      a: { base: 0.500, choices: [0.200, 0.250, 0.300, 0.400, 0.500, 0.600, 0.750], decimals: 3 },
    },
    prompt: "Three equal ${{q}}\\ \\mu\\text{C}$ point charges are placed at the corners of an equilateral triangle whose sides are ${{a}}\\text{ m}$ long. What is the potential energy of the system? (Take as zero the potential energy of the three charges when they are infinitely far apart.)",
  },

  // 23.17. Part (b) walks through the energy bookkeeping with every number in it, so the solver
  // rebuilds the sentence. The constraint keeps B at the HIGHER potential, which for this
  // negative charge is what makes the answer "faster" rather than "slower" - reverse it and the
  // reference answer would contradict itself.
  hw3_p4: {
    params: {
      q: { base: 5.00, min: 2.00, max: 8.00, step: 0.50, decimals: 2 },
      m_mant: { base: 2.00, min: 1.00, max: 4.00, step: 0.25, decimals: 2 },
      VA: { base: 200, choices: [100, 150, 200, 250, 300, 400], decimals: 0 },
      VB: { base: 800, choices: [600, 700, 800, 900, 1000, 1200], decimals: 0 },
      vA: { base: 5.00, min: 3.00, max: 8.00, step: 0.50, decimals: 2 },
    },
    constraint: p => p.VB >= p.VA + 300,
    prompt: "A small particle has charge $-{{q}}\\ \\mu\\text{C}$ and mass ${{m_mant}}\\times10^{-4}\\text{ kg}$. It moves from point $A$, where the electric potential is $V_A = +{{VA}}\\text{ V}$, to point $B$, where the electric potential is $V_B = +{{VB}}\\text{ V}$. The electric force is the only force acting on the particle. The particle has speed ${{vA}}\\text{ m/s}$ at point $A$.",
  },

  // 23.19. The FIGURE carries the geometry - the separation and both distances to point B - so
  // none of it may move (rule 3). The three charges are free, and they are what the problem is
  // about. Their ranges are kept WELL apart, which is load-bearing rather than tidy: the
  // potential difference in part (c) is a difference of similar-sized terms, and at a charge
  // ratio near 2.2 the work passes through zero and changes sign, contradicting the problem's
  // own stated sign convention. These ranges hold the ratio above 2.6. (The fidelity sweep is
  // what caught it, at q1 = 2.80 with q2 = 6.10.)
  hw3_p5: {
    params: {
      q1: { base: 2.40, min: 1.80, max: 2.60, step: 0.10, decimals: 2 },
      q2: { base: 6.50, min: 7.00, max: 9.00, step: 0.10, decimals: 2 },
      qt: { base: 2.50, min: 1.50, max: 5.00, step: 0.10, decimals: 2 },
    },
    prompt: "Two point charges $q_1 = +{{q1}}\\text{ nC}$ and $q_2 = -{{q2}}\\text{ nC}$ are $0.100\\text{ m}$ apart. Point $A$ is midway between them; point $B$ is $0.080\\text{ m}$ from $q_1$ and $0.060\\text{ m}$ from $q_2$, as shown in the figure. Take the electric potential to be zero at infinity.\n\nElectric potential and work are both signed quantities: give each answer with its sign.",
    parts: {
      hw3_p5c: { prompt: "(c) Find the work done by the electric field on a charge of ${{qt}}\\text{ nC}$ that travels from point $B$ to point $A$." },
    },
  },

  // 23.41. Energy conservation on the way in, then F = ma at the point reached. The constraint
  // keeps the sphere genuinely slowed (at least 10 m/s lost), so the energy difference the
  // answer divides by is never a small difference of two nearly equal numbers.
  hw3_p7: {
    params: {
      q1: { base: 5.00, min: 3.00, max: 8.00, step: 0.50, decimals: 2 },
      q2: { base: 2.00, min: 1.00, max: 4.00, step: 0.25, decimals: 2 },
      d0_cm: { base: 6.00, choices: [4.00, 5.00, 6.00, 8.00, 10.00], decimals: 2 },
      m_mant: { base: 4.00, min: 2.00, max: 8.00, step: 0.50, decimals: 2 },
      v0: { base: 40.0, choices: [30.0, 35.0, 40.0, 45.0, 50.0], decimals: 1 },
      v1: { base: 25.0, choices: [15.0, 20.0, 25.0, 30.0], decimals: 1 },
    },
    constraint: p => p.v1 <= p.v0 - 10.0,
    prompt: "A point charge $q_1 = +{{q1}}\\ \\mu\\text{C}$ is held fixed in space. From a horizontal distance of ${{d0_cm}}\\text{ cm}$, a small sphere with mass ${{m_mant}}\\times10^{-3}\\text{ kg}$ and charge $q_2 = +{{q2}}\\ \\mu\\text{C}$ is fired toward the fixed charge with an initial speed of ${{v0}}\\text{ m/s}$. Gravity can be neglected.",
    parts: {
      hw3_p7a: { prompt: "(a) How far is the sphere from the fixed charge at the instant its speed is ${{v1}}\\text{ m/s}$?" },
      hw3_p7b: { prompt: "(b) What is the acceleration of the sphere at the instant when its speed is ${{v1}}\\text{ m/s}$?" },
    },
  },

  // 23.62. The 30 degree thread angle CANNOT move: the part (a) free-body diagram's tension key
  // is [-0.5, 0.86603], which is that angle to the house +/-5 degrees, and no solver can reach a
  // client-side key (rule 4). Nor can the plate separation, which the figure shows. The mass and
  // the charge are free, and they are what part (b) divides. Part (c) turns on the sign of the
  // charge and the side the sphere hangs toward, so it inherits unchanged.
  hw3_p10: {
    graphicalSafe: true,
    params: {
      m_g: { base: 1.50, min: 0.80, max: 3.00, step: 0.10, decimals: 2 },
      q_mant: { base: 8.90, min: 5.00, max: 12.00, step: 0.10, decimals: 2 },
    },
    prompt: "A small sphere with mass ${{m_g}}\\text{ g}$ hangs by a thread between two parallel vertical plates $5.00\\text{ cm}$ apart, as shown in the figure. The plates are insulating and have uniform surface charge densities $+\\sigma$ and $-\\sigma$. The charge on the sphere is $q = {{q_mant}}\\times10^{-6}\\text{ C}$. In the figure the sphere is displaced toward the right-hand plate.",
  },

  // ── hw4 — Ch. 24, capacitance and dielectrics ─────────────────────────────────
  // This set is entirely numeric, which makes it the most variable in the course - but most of
  // its problems keep their capacitor values INSIDE the figure, where no template can reach
  // them. Where that is so, only the quantity the prompt states (the potential difference) is
  // varied, and the network stays exactly as drawn. That is still a fresh problem: every charge,
  // energy and voltage in it moves. 24.16 is left out altogether, since every number it has is
  // in its figure.

  // 24.3. Nothing is pinned by a figure: V = Ed, A = Q/(eps0 E), C = Q/V.
  hw4_p1: {
    params: {
      d_mm: { base: 2.50, min: 1.00, max: 5.00, step: 0.25, decimals: 2 },
      Q_nC: { base: 80.0, min: 40.0, max: 160.0, step: 5.0, decimals: 1 },
      E_mant: { base: 4.00, min: 2.00, max: 6.00, step: 0.25, decimals: 2 },
    },
    prompt: "The plates of a parallel-plate capacitor are ${{d_mm}}\\text{ mm}$ apart, and each carries a charge of magnitude ${{Q_nC}}\\text{ nC}$. The plates are in vacuum. The electric field between the plates has a magnitude of ${{E_mant}}\\times10^{6}\\text{ V/m}$.",
  },

  // 24.6. The outer radius comes out of the cylindrical-capacitor formula through a logarithm,
  // so the ranges are kept near the committed instance: they hold the radius ratio between
  // roughly 1.08 and 1.6, which keeps the geometry a recognizable cylindrical capacitor rather
  // than either a hair-thin gap or a tube with nothing in common with the core.
  hw4_p2: {
    params: {
      ra_cm: { base: 0.250, choices: [0.150, 0.200, 0.250, 0.300, 0.400], decimals: 3 },
      L_cm: { base: 12.0, min: 8.0, max: 20.0, step: 0.5, decimals: 1 },
      C_pF: { base: 36.7, min: 25.0, max: 60.0, step: 0.1, decimals: 1 },
      V: { base: 125, choices: [75, 100, 125, 150, 200, 250], decimals: 0 },
    },
    prompt: "A cylindrical capacitor consists of a solid inner conducting core with radius ${{ra_cm}}\\text{ cm}$, surrounded by an outer hollow conducting tube. The two conductors are separated by air, and the length of the cylinder is ${{L_cm}}\\text{ cm}$. The capacitance is ${{C_pF}}\\text{ pF}$.",
    parts: {
      hw4_p2b: { prompt: "(b) When the capacitor is charged to ${{V}}\\text{ V}$, what is the charge per unit length $\\lambda$ on the capacitor?" },
    },
  },

  // 24.17. The figure is label-only (C_1 … C_4, no values), so both givens are free. The network
  // it draws: C1 in series with C2, that pair in parallel with C3, and the whole of it in series
  // with C4 across ab.
  hw4_p4: {
    params: {
      C: { base: 4.00, min: 2.00, max: 9.00, step: 0.50, decimals: 2 },
      V: { base: 28.0, min: 12.0, max: 60.0, step: 2.0, decimals: 1 },
    },
    prompt: "In the figure, each capacitor has $C = {{C}}\\ \\mu\\text{F}$ and $V_{ab} = +{{V}}\\text{ V}$.",
  },

  // 24.21. Every capacitance is printed in the figure, so only the applied voltage can move.
  // Note that part (a)'s answer is the equivalent capacitance, which does not depend on the
  // voltage at all and is therefore the same for every student - correctly so: it is a property
  // of the network, and the network is the one the figure draws.
  hw4_p5: {
    // A one-given problem has only as many instances as its one range offers, so the range is
    // a wide grid rather than a short list: two students sharing a bench should not be likely to
    // share a problem.
    params: { V: { base: 25, min: 10, max: 60, step: 5, decimals: 0 } },
    prompt: "For the system of capacitors shown in the figure, a potential difference of ${{V}}\\text{ V}$ is maintained across $ab$.",
  },

  // 24.26. The capacitance is a red herring (the energy density depends only on the field), and
  // it is varied anyway: a student who reaches for it is meant to find it does not belong.
  hw4_p6: {
    params: {
      C_uF: { base: 5.80, min: 2.00, max: 12.00, step: 0.10, decimals: 2 },
      d_mm: { base: 5.00, min: 2.00, max: 10.00, step: 0.50, decimals: 2 },
      V: { base: 400, choices: [200, 250, 300, 400, 500, 600], decimals: 0 },
    },
    prompt: "A ${{C_uF}}\\text{-}\\mu\\text{F}$, parallel-plate, air capacitor has a plate separation of ${{d_mm}}\\text{ mm}$ and is charged to a potential difference of ${{V}}\\text{ V}$. Calculate the energy density in the region between the plates, in units of $\\text{J/m}^3$.",
  },

  // 24.30. Two capacitors in SERIES (150 nF and 120 nF, both printed in the figure and named in
  // the parts), so only the voltage moves.
  hw4_p7: {
    params: { V: { base: 36, min: 12, max: 72, step: 4, decimals: 0 } },
    prompt: "For the capacitor network shown in the figure, the potential difference across $ab$ is ${{V}}\\text{ V}$.",
  },

  // 24.31. The same wording as 24.30 but a PARALLEL pair (35 nF and 75 nF), which is the
  // contrast the two problems are set together to draw. Voltage only, for the same reason.
  hw4_p8: {
    params: { V: { base: 220, min: 100, max: 350, step: 10, decimals: 0 } },
    prompt: "For the capacitor network shown in the figure, the potential difference across $ab$ is ${{V}}\\text{ V}$.",
  },

  // 24.39. No figure. Q = C0 V = C0 E d, and the dielectric multiplies it by K.
  hw4_p9: {
    params: {
      // Four givens multiply into part (b), so the ranges are narrower than any one of them
      // would need on its own: at their extremes the answer would otherwise swing by a factor
      // of more than twenty, which leaves the problem's scale (and the sig figs and units
      // chosen for it) behind.
      C0: { base: 5.00, min: 2.50, max: 9.00, step: 0.50, decimals: 2 },
      d_mm: { base: 1.50, min: 0.75, max: 3.00, step: 0.25, decimals: 2 },
      E_mant: { base: 3.00, min: 2.00, max: 4.50, step: 0.25, decimals: 2 },
      K: { base: 2.70, choices: [1.80, 2.10, 2.40, 2.70, 3.40, 4.70], decimals: 2 },
    },
    prompt: "A parallel-plate capacitor has capacitance $C_0 = {{C0}}\\text{ pF}$ when there is air between the plates. The separation between the plates is ${{d_mm}}\\text{ mm}$.",
    parts: {
      hw4_p9a: { prompt: "(a) What is the maximum magnitude of charge $Q$ that can be placed on each plate if the electric field in the region between the plates is not to exceed ${{E_mant}}\\times10^{4}\\text{ V/m}$?" },
      hw4_p9b: { prompt: "(b) A dielectric with $K = {{K}}$ is inserted between the plates of the capacitor, completely filling the volume between the plates. Now what is the maximum magnitude of charge on each plate if the electric field between the plates is not to exceed ${{E_mant}}\\times10^{4}\\text{ V/m}$?" },
    },
  },

  // 24.63. A label-only figure again, so both capacitances and the voltage are free. The ladder
  // it draws, from the right: three C1 in series (top, the vertical rung, bottom), that in
  // parallel with the C2 across cd, that in series with the C1 above and below it, that in
  // parallel with the first C2, and finally in series with the two C1 at a and b.
  hw4_p10: {
    params: {
      C1: { base: 6.9, min: 3.0, max: 12.0, step: 0.1, decimals: 1 },
      C2: { base: 4.6, min: 2.0, max: 9.0, step: 0.1, decimals: 1 },
      V: { base: 420, choices: [180, 240, 300, 360, 420, 500, 600], decimals: 0 },
    },
    prompt: "In the figure, each capacitance $C_1$ is ${{C1}}\\ \\mu\\text{F}$, and each capacitance $C_2$ is ${{C2}}\\ \\mu\\text{F}$.",
    parts: {
      hw4_p10b_c1a: { prompt: "(b) When $V_{ab} = {{V}}\\text{ V}$, compute the charge on the $C_1$ nearest $a$." },
      hw4_p10b_c1b: { prompt: "(b) When $V_{ab} = {{V}}\\text{ V}$, compute the charge on the $C_1$ nearest $b$." },
      hw4_p10b_c2: { prompt: "(b) When $V_{ab} = {{V}}\\text{ V}$, compute the charge on the $C_2$ nearest $a$ and $b$." },
      hw4_p10c: { prompt: "(c) With ${{V}}\\text{ V}$ across $a$ and $b$, compute $V_{cd}$." },
    },
  },

  // ── hw5 — Ch. 25, current, resistance and emf ─────────────────────────────────
  // Four of this set's ten problems cannot be re-numbered at all, and for four different
  // reasons worth recording: 25.17's answer is the NAME of a metal read off a resistivity
  // table, so moving the givens moves the answer to a different material (or to none);
  // 25.38 and 25.68 put every value inside their circuit figures; and 25.77 reads a wire gauge
  // out of a printed table. They are served with their own numbers.

  // 25.3. The diameter CANNOT move: it is what "12-gauge" means, and part (b)'s 4.12 mm is what
  // "6-gauge" means, so re-numbering either would make the prompt contradict itself. Part (c)
  // compares the two gauges and is unaffected by the length and the current, so it inherits.
  hw5_p1: {
    params: {
      L_cm: { base: 71.0, min: 40.0, max: 120.0, step: 1.0, decimals: 1 },
      I: { base: 4.85, min: 2.00, max: 8.00, step: 0.05, decimals: 2 },
    },
    prompt: "Copper has $8.5\\times10^{28}$ free electrons per cubic meter. A ${{L_cm}}\\text{-cm}$ length of 12-gauge copper wire that is $2.05\\text{ mm}$ in diameter carries ${{I}}\\text{ A}$ of current.",
  },

  // 25.47. Both wattages and the line voltage are free, and all four answers follow from
  // R = V^2/P and I = P/V.
  hw5_p4: {
    params: {
      P1: { base: 100, choices: [60, 75, 100, 125, 150, 200], decimals: 0 },
      P2: { base: 60, choices: [25, 40, 50, 60, 75, 90], decimals: 0 },
      V: { base: 120, choices: [100, 110, 120, 125, 130], decimals: 0 },
    },
    constraint: p => p.P1 > p.P2,
    prompt: "Light Bulbs. The power rating of a light bulb (such as a ${{P1}}\\text{-W}$ bulb) is the power it dissipates when connected across a ${{V}}\\text{-V}$ potential difference.",
    parts: {
      hw5_p4a: { prompt: "(a) What is the resistance of a ${{P1}}\\text{-W}$ bulb?" },
      hw5_p4b: { prompt: "(b) What is the resistance of a ${{P2}}\\text{-W}$ bulb?" },
      hw5_p4c_100: { prompt: "(c) How much current does the ${{P1}}\\text{-W}$ bulb draw in normal use?" },
      hw5_p4c_60: { prompt: "(c) How much current does the ${{P2}}\\text{-W}$ bulb draw in normal use?" },
    },
  },

  // 25.48. The two MAINS VOLTAGES are left alone: 220 V and 120 V are facts about Europe and
  // the United States, and a problem that opened by misstating them would be teaching something
  // false in passing. The bulb ratings are free, and they are what the question turns on.
  hw5_p5: {
    params: {
      P_us: { base: 75, choices: [40, 60, 75, 90, 100, 120], decimals: 0 },
      P_eu: { base: 100, choices: [40, 60, 75, 100, 150, 200], decimals: 0 },
    },
    prompt: "European Light Bulb. In Europe the standard voltage in homes is $220\\text{ V}$ instead of the $120\\text{ V}$ used in the United States. Therefore a \"${{P_eu}}\\text{-W}$\" European bulb would be intended for use with a $220\\text{-V}$ potential difference.",
    parts: {
      hw5_p5a: { prompt: "(a) If a \"${{P_us}}\\text{-W}$\" bulb (see the previous problem) is connected across a $220\\text{-V}$ potential difference (as is used in Europe), how much power does it dissipate?" },
      hw5_p5b: { prompt: "(b) If you bring a \"${{P_eu}}\\text{-W}$\" European bulb home to the United States, what should be its U.S. power rating?" },
      hw5_p5c: { prompt: "(c) How much current will the ${{P_eu}}\\text{-W}$ European bulb draw in normal use in the United States?" },
    },
  },

  // 25.71. A genuine quadratic, so every given moves it: beta stays well away from zero, where
  // the thermistor would stop being one and the problem would collapse to Ohm's law.
  hw5_p7: {
    params: {
      Vb: { base: 12.6, min: 9.0, max: 24.0, step: 0.2, decimals: 1 },
      R: { base: 3.2, min: 1.5, max: 6.0, step: 0.1, decimals: 1 },
      alpha: { base: 3.8, min: 2.0, max: 7.0, step: 0.1, decimals: 1 },
      beta: { base: 1.3, min: 0.6, max: 2.5, step: 0.1, decimals: 1 },
    },
    prompt: "A ${{Vb}}\\text{-V}$ car battery with negligible internal resistance is connected to a series combination of a ${{R}}\\text{-}\\Omega$ resistor that obeys Ohm's law and a thermistor that does not obey Ohm's law but instead has a current–voltage relationship $V = \\alpha I + \\beta I^2$, with $\\alpha = {{alpha}}\\ \\Omega$ and $\\beta = {{beta}}\\ \\Omega/\\text{A}$. What is the current through the ${{R}}\\text{-}\\Omega$ resistor?",
  },

  // 25.83. The figure shows C in parallel with R1 and R2 in series with the source, with no
  // values on it, so every given in the prompt is free. The charge is DERIVED from a capacitor
  // voltage that is drawn but never printed: a charge drawn independently of the capacitance
  // could put several volts of the figure's small circuit into a quantity whose scale the
  // problem never intended, and deriving it keeps every instance a sensible circuit.
  hw5_p9: {
    params: {
      R1: { base: 6.00, min: 3.00, max: 12.00, step: 0.50, decimals: 2 },
      R2: { base: 4.00, min: 2.00, max: 9.00, step: 0.50, decimals: 2 },
      C: { base: 9.00, min: 4.00, max: 15.00, step: 0.50, decimals: 2 },
      vc: { base: 4.00, min: 2.00, max: 8.00, step: 0.50, decimals: 2 },
    },
    derived: { Q: { from: p => p.C * p.vc, decimals: 1 } },
    prompt: "Consider the circuit shown in the figure. The emf source has negligible internal resistance. The resistors have resistances $R_1 = {{R1}}\\ \\Omega$ and $R_2 = {{R2}}\\ \\Omega$. The capacitor has capacitance $C = {{C}}\\ \\mu\\text{F}$. When the capacitor is fully charged, the magnitude of the charge on its plates is $Q = {{Q}}\\ \\mu\\text{C}$. Calculate the emf $\\mathcal{E}$.",
  },

  // 25.84. Same device as 25.83 and for the same reason: Q1 is derived from an undrawn
  // capacitor voltage, which here also guarantees that the resistance asked for in part (b)
  // comes out positive and of a sane size for every draw.
  hw5_p10: {
    params: {
      emf: { base: 60.0, min: 50.0, max: 90.0, step: 2.0, decimals: 1 },
      R2: { base: 2.00, min: 1.50, max: 3.00, step: 0.25, decimals: 2 },
      C1: { base: 3.00, min: 2.00, max: 5.00, step: 0.50, decimals: 2 },
      C2: { base: 6.00, min: 4.00, max: 12.00, step: 0.50, decimals: 2 },
      vc: { base: 6.00, min: 3.00, max: 9.00, step: 0.50, decimals: 2 },
    },
    derived: { Q1: { from: p => p.C1 * p.vc, decimals: 1 } },
    prompt: "Consider the circuit shown in the figure. The battery has emf ${{emf}}\\text{ V}$ and negligible internal resistance. $R_2 = {{R2}}\\ \\Omega$, $C_1 = {{C1}}\\ \\mu\\text{F}$, and $C_2 = {{C2}}\\ \\mu\\text{F}$. After the capacitors have attained their final charges, the charge on $C_1$ is $Q_1 = {{Q1}}\\ \\mu\\text{C}$.",
  },

  // ── hw6 — Ch. 26, direct-current circuits ─────────────────────────────────────
  // Only two of this set's ten problems can be re-numbered, and the reason is the chapter
  // rather than the authoring: Ch. 26 is where the problem IS the circuit diagram, so eight of
  // them keep every resistance, emf and meter reading inside a figure that no template can
  // reach (26.24, 26.31, 26.34, 26.47, 26.63, 26.66, 26.74, and 26.71, whose two long polarity
  // answers are argued from figure values throughout). They are served as committed.

  // 26.1. Everything is stated in the prompt, and the set is the biggest in the course: twelve
  // items off four givens. Part (f) compares the extremes by name and number, so it is rebuilt,
  // and the constraint is what keeps its comparison the right way round.
  hw6_p1: {
    params: {
      R1: { base: 1.60, min: 1.00, max: 3.00, step: 0.20, decimals: 2 },
      R2: { base: 2.40, min: 2.00, max: 6.00, step: 0.20, decimals: 2 },
      R3: { base: 4.80, min: 5.00, max: 12.00, step: 0.20, decimals: 2 },
      V: { base: 28.0, min: 12.0, max: 48.0, step: 1.0, decimals: 1 },
    },
    // Strictly increasing, so "the least resistance" and "the greatest" in part (f) name one
    // resistor each. The ranges almost guarantee it; the constraint makes it certain.
    constraint: p => p.R1 < p.R2 && p.R2 < p.R3,
    prompt: "Three resistors having resistances of ${{R1}}\\ \\Omega$, ${{R2}}\\ \\Omega$, and ${{R3}}\\ \\Omega$ are connected in parallel to a ${{V}}\\text{-V}$ battery that has negligible internal resistance.",
    parts: {
      hw6_p1b_160: { prompt: "(b) Find the current in the ${{R1}}\\text{-}\\Omega$ resistor." },
      hw6_p1b_240: { prompt: "(b) Find the current in the ${{R2}}\\text{-}\\Omega$ resistor." },
      hw6_p1b_480: { prompt: "(b) Find the current in the ${{R3}}\\text{-}\\Omega$ resistor." },
      hw6_p1d_160: { prompt: "(d) Find the voltage across the ${{R1}}\\text{-}\\Omega$ resistor." },
      hw6_p1d_240: { prompt: "(d) Find the voltage across the ${{R2}}\\text{-}\\Omega$ resistor." },
      hw6_p1d_480: { prompt: "(d) Find the voltage across the ${{R3}}\\text{-}\\Omega$ resistor." },
      hw6_p1e_160: { prompt: "(e) Find the power dissipated in the ${{R1}}\\text{-}\\Omega$ resistor." },
      hw6_p1e_240: { prompt: "(e) Find the power dissipated in the ${{R2}}\\text{-}\\Omega$ resistor." },
      hw6_p1e_480: { prompt: "(e) Find the power dissipated in the ${{R3}}\\text{-}\\Omega$ resistor." },
    },
  },

  // 26.81. The Wheatstone bridge: part (a) derives X = MP/N symbolically and inherits unchanged,
  // and part (b) puts three numbers into it. All three are in the prompt, and the figure is the
  // bridge itself with no values on it.
  hw6_p10: {
    params: {
      M: { base: 850.0, min: 500.0, max: 1200.0, step: 10.0, decimals: 1 },
      N: { base: 15.00, min: 10.00, max: 40.00, step: 0.50, decimals: 2 },
      P: { base: 33.48, min: 20.00, max: 60.00, step: 0.04, decimals: 2 },
    },
    prompt: "The Wheatstone Bridge. The circuit shown in the figure, called a Wheatstone bridge, is used to determine the value of an unknown resistor $X$ by comparison with three resistors $M$, $N$, and $P$ whose resistances can be varied. For each setting, the resistance of each resistor is precisely known. With switches $K_1$ and $K_2$ closed, these resistors are varied until the current in the galvanometer G is zero; the bridge is then said to be balanced.",
    parts: {
      hw6_p10b: { prompt: "(b) If the galvanometer G shows zero deflection when $M = {{M}}\\ \\Omega$, $N = {{N}}\\ \\Omega$, and $P = {{P}}\\ \\Omega$, what is the unknown resistance $X$?" },
    },
  },
};
