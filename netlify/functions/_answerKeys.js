// SERVER-ONLY homework answer key. The leading underscore tells Netlify to treat this as an
// importable helper, NOT a deployed function endpoint. It is imported only by grade.js — never by
// any client module — so these answers are bundled into the grading function and are NEVER shipped
// to the browser. This is the whole point of server-side grading: a student perusing the public
// repo or the client JS bundle can no longer read numeric/text/math answers.
//
// Only numeric / text / math items appear here. Graph / vector / fbd problems are graded
// deterministically and locally on the client (their `key` geometry lives in the course file), an
// accepted tradeoff — a sketch shape is far less copy-pasteable than a number.
//
// Shape: ANSWER_KEYS[courseType][hwId][itemId] = { answerType, answer, sigFigs?, unit? }
//   - numeric: `answer` is a number; `sigFigs`/`unit` format the revealed correct answer.
//   - text/math: `answer` is the reference string (text prose / LaTeX). No sigFigs/unit.
// Optional `tolerance` (numeric, a fraction) overrides the ±2% default; grading tolerance MUST
// live here, never come from the client (a forged large tolerance would pass wrong answers).
// Optional `nonNegative: true` marks a numeric item whose quantity CANNOT be negative — a
// magnitude, speed, distance/height, elapsed time, mass, weight, density, or a ratio. A negative
// entry then gets a free nudge instead of a wrong verdict: no attempt is consumed. Students
// routinely compute the signed component and type what they got, which is a convention slip,
// not a physics error. Do NOT set it where the sign IS the physics — a vector component, a
// signed acceleration, an angle (use `angle: true` instead), or any item whose `answer` here is
// negative. Rule of thumb: if a correct solution could ever produce a negative number for this
// blank, leave it off.
// Optional `angle: true` marks a numeric item measured in DEGREES. It grades with `angleMatch`,
// which accepts any coterminal spelling of the same direction — -19° ≡ 341° ≡ 701° — because a
// student who lands on -19° has named the identical direction the prompt asks for. Set it on
// every degree-valued numeric; it is mutually exclusive with `nonNegative` (a negative angle is
// correct, not a slip, so it must never be nudged).
//
// Item ids are unique within a homework (part ids for multipart problems, the problem id
// otherwise). When authoring/editing a homework, put the answer HERE and the prompt/figure/configs
// in src/courses/<course>.js — see docs/homework-roadmap.md § Authoring.

export const ANSWER_KEYS = {
  physics1: {
    hw1: {
      hw1_p1a: { answerType: "numeric", answer: 88, sigFigs: 2, unit: "ft/s", nonNegative: true },
      hw1_p1b: { answerType: "numeric", answer: 9.75, sigFigs: 2, unit: "m/s²", nonNegative: true },
      hw1_p1c: { answerType: "numeric", answer: 1000, sigFigs: 2, unit: "kg/m³", nonNegative: true },
      hw1_p2a: { answerType: "numeric", answer: -8.12, sigFigs: 3, unit: "m" },
      hw1_p2b: { answerType: "numeric", answer: 15.3, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p3a_m: { answerType: "numeric", answer: 9.00, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p3a_d: { answerType: "numeric", answer: 33.6, sigFigs: 3, unit: "°", angle: true },
      hw1_p3b_m: { answerType: "numeric", answer: 9.00, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p3b_d: { answerType: "numeric", answer: 33.6, sigFigs: 3, unit: "°", angle: true },
      hw1_p3c_m: { answerType: "numeric", answer: 22.3, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p3c_d: { answerType: "numeric", answer: 250.3, sigFigs: 4, unit: "°", angle: true },
      hw1_p3d_m: { answerType: "numeric", answer: 22.3, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p3d_d: { answerType: "numeric", answer: 70.3, sigFigs: 3, unit: "°", angle: true },
      hw1_p4a_m: { answerType: "numeric", answer: 10.0, sigFigs: 3, unit: "cm", nonNegative: true },
      hw1_p4a_d: { answerType: "numeric", answer: 149, sigFigs: 3, unit: "°", angle: true },
      hw1_p4b_m: { answerType: "numeric", answer: 10.0, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p4b_d: { answerType: "numeric", answer: 194, sigFigs: 3, unit: "°", angle: true },
      hw1_p4c_m: { answerType: "numeric", answer: 8.21, sigFigs: 3, unit: "km", nonNegative: true },
      hw1_p4c_d: { answerType: "numeric", answer: 341, sigFigs: 3, unit: "°", angle: true },
      hw1_p5_m: { answerType: "numeric", answer: 3.39, sigFigs: 3, unit: "km", nonNegative: true },
      hw1_p5_d: { answerType: "numeric", answer: 149, sigFigs: 3, unit: "°", angle: true },
      hw1_p6a: { answerType: "numeric", answer: -6.6, sigFigs: 2, unit: "m²" },
      hw1_p6b_m: { answerType: "numeric", answer: 5.6, sigFigs: 2, unit: "m²", nonNegative: true },
      hw1_p6b_d: { answerType: "text", answer: "Out of the page: the +z-direction." },
      hw1_p7a_A: { answerType: "numeric", answer: 5.39, sigFigs: 3, nonNegative: true },
      hw1_p7a_B: { answerType: "numeric", answer: 4.36, sigFigs: 3, nonNegative: true },
      hw1_p7b: { answerType: "math", answer: "-5.00\\,\\hat{\\imath} + 2.00\\,\\hat{\\jmath} + 7.00\\,\\hat{k}" },
      hw1_p7c_m: { answerType: "numeric", answer: 8.83, sigFigs: 3, nonNegative: true },
      hw1_p7c_e: { answerType: "text", answer: "Yes, the magnitudes are equal. Since $\\vec{B}-\\vec{A} = -(\\vec{A}-\\vec{B})$, the two difference vectors point in opposite directions but have the same length (8.83)." },
      hw1_p8: { answerType: "numeric", answer: 3.30, sigFigs: 3, unit: "N", nonNegative: true },
      hw1_p9: { answerType: "numeric", answer: 124, sigFigs: 3, unit: "°", angle: true },
      hw1_p10: { answerType: "numeric", answer: 170, sigFigs: 3, unit: "m²", nonNegative: true },
    },
    hw2: {
      hw2_p1: { answerType: "numeric", answer: 1.17, sigFigs: 2, unit: "h", nonNegative: true },
      hw2_p2a_a: { answerType: "numeric", answer: -1.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2a_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p2b_a: { answerType: "numeric", answer: -1.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2b_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p2c_a: { answerType: "numeric", answer: -3.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2c_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p3a: { answerType: "numeric", answer: 675, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw2_p3b: { answerType: "numeric", answer: 0.0667, sigFigs: 3, unit: "s", nonNegative: true },
      hw2_p4a: { answerType: "numeric", answer: 250, sigFigs: 3, unit: "m", nonNegative: true },
      hw2_p4b: { answerType: "numeric", answer: 40.0, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p5a: { answerType: "numeric", answer: 2.9382, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p5b: { answerType: "numeric", answer: 0.59901, sigFigs: 3, unit: "s", nonNegative: true },
      hw2_p6: { answerType: "numeric", answer: 1796, sigFigs: 3, unit: "m", nonNegative: true },
      hw2_p7a1: { answerType: "numeric", answer: 5.60, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p7a2: { answerType: "numeric", answer: 7.20, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p7a3: { answerType: "numeric", answer: 8.80, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p7b: { answerType: "numeric", answer: 0.800, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw2_p7c: { answerType: "numeric", answer: 4.80, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw2_p7d: { answerType: "numeric", answer: 6.00, sigFigs: 3, unit: "s", nonNegative: true },
      hw2_p7e: { answerType: "numeric", answer: 25.6, sigFigs: 3, unit: "m", nonNegative: true },
      hw2_p8: { answerType: "numeric", answer: 50, sigFigs: 2, unit: "m", nonNegative: true },
      hw2_p9: { answerType: "numeric", answer: 3.6022, sigFigs: 3, unit: "m", nonNegative: true },
      hw2_p10a: { answerType: "numeric", answer: 2.6442, sigFigs: 3, unit: "× H", nonNegative: true },
      hw2_p10b: { answerType: "numeric", answer: 2.6442, sigFigs: 3, unit: "× T", nonNegative: true },
    },
    hw3: {
      hw3_p1a_x: { answerType: "numeric", answer: 1.4, sigFigs: 2, unit: "m/s" },
      hw3_p1a_y: { answerType: "numeric", answer: -1.3, sigFigs: 2, unit: "m/s" },
      hw3_p1b_m: { answerType: "numeric", answer: 1.9105, sigFigs: 2, unit: "m/s", nonNegative: true },
      hw3_p1b_d: { answerType: "numeric", answer: 317.12, sigFigs: 3, unit: "°", angle: true },
      hw3_p2a_x: { answerType: "numeric", answer: 6.4573, sigFigs: 2, unit: "m/s" },
      hw3_p2a_y: { answerType: "numeric", answer: 0.5177, sigFigs: 2, unit: "m/s" },
      hw3_p2b_m: { answerType: "numeric", answer: 6.478, sigFigs: 2, unit: "m/s", nonNegative: true },
      hw3_p2b_d: { answerType: "numeric", answer: 4.584, sigFigs: 2, unit: "°", angle: true },
      hw3_p3: { answerType: "numeric", answer: 3.325, sigFigs: 3, unit: "m", nonNegative: true },
      hw3_p4: { answerType: "numeric", answer: 1.28781, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw3_p5a_x: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5a_y: { answerType: "numeric", answer: 43.301, sigFigs: 3, unit: "m/s" },
      hw3_p5b: { answerType: "numeric", answer: 4.41399, sigFigs: 3, unit: "s", nonNegative: true },
      hw3_p5c: { answerType: "numeric", answer: 95.5657, sigFigs: 3, unit: "m", nonNegative: true },
      hw3_p5d: { answerType: "numeric", answer: 220.700, sigFigs: 3, unit: "m", nonNegative: true },
      hw3_p5e_ax: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s²" },
      hw3_p5e_ay: { answerType: "numeric", answer: -9.81, sigFigs: 3, unit: "m/s²" },
      hw3_p5e_vx: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5e_vy: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s" },
      hw3_p6a: { answerType: "numeric", answer: 53.130, sigFigs: 3, unit: "°", angle: true },
      hw3_p6b_s: { answerType: "numeric", answer: 15.0, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw3_p6b_a: { answerType: "numeric", answer: 9.81, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw3_p6c_h: { answerType: "numeric", answer: 15.855, sigFigs: 3, unit: "m", nonNegative: true },
      hw3_p6c_s: { answerType: "numeric", answer: 17.7179, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw3_p7a_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw3_p7a_d: { answerType: "text", answer: "Upward, directed toward the center of the wheel (the centripetal direction). Because the speed is constant there is no tangential acceleration, so the acceleration is purely radial." },
      hw3_p7b_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw3_p7b_d: { answerType: "text", answer: "Downward, directed toward the center of the wheel. The magnitude is the same as at the lowest point; only the direction (toward the center) has changed." },
      hw3_p7c: { answerType: "numeric", answer: 12.566, sigFigs: 3, unit: "s", nonNegative: true },
      hw3_p8: { answerType: "numeric", answer: 31.0061, sigFigs: 2, unit: "m/s", nonNegative: true },
      hw3_p9a: { answerType: "numeric", answer: 32.6593, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw3_p9b: { answerType: "text", answer: "Essentially zero: the shell lands right at the edge. With the minimum muzzle velocity from part (a), the trajectory's peak height is only about $25.3\\text{ m}$, just barely above the $25.0\\text{-m}$ cliff, and that peak occurs at a horizontal distance of about $54\\text{ m}$, before the cliff edge at $60.0\\text{ m}$. So the shell is already descending as it reaches the edge: it passes back down through the $25.0\\text{-m}$ height essentially at the edge itself (at $x \\approx 60.0\\text{ m}$). It therefore lands at (to within rounding, $0\\text{ m}$ beyond) the edge of the cliff." },
      hw3_p10a: { answerType: "numeric", answer: 1.50115, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw3_p10b: { answerType: "numeric", answer: 4.65597, sigFigs: 3, unit: "m", nonNegative: true },
    },
    hw4: {
      hw4_p1a: { answerType: "numeric", answer: 69.282, sigFigs: 3, unit: "N", nonNegative: true },
      hw4_p1b: { answerType: "numeric", answer: 34.641, sigFigs: 3, unit: "N", nonNegative: true },
      hw4_p2a: { answerType: "numeric", answer: 4.3077, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw4_p2b: { answerType: "numeric", answer: 215.38, sigFigs: 3, unit: "m", nonNegative: true },
      hw4_p2c: { answerType: "numeric", answer: 43.077, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw4_p3a: { answerType: "numeric", answer: 4.48522, sigFigs: 3, unit: "kg", nonNegative: true },
      hw4_p3b_m: { answerType: "numeric", answer: 4.48522, sigFigs: 3, unit: "kg", nonNegative: true },
      hw4_p3b_w: { answerType: "numeric", answer: 8.11825, sigFigs: 3, unit: "N", nonNegative: true },
      hw4_p4: { answerType: "numeric", answer: 20, sigFigs: 2, unit: "N", nonNegative: true },
      hw4_p5a_pairs: { answerType: "text", answer: "The contact forces between the crates form the only action–reaction pair shown: $\\vec F_{A\\,\\text{on}\\,B}$ (A pushing B to the right) and $\\vec F_{B\\,\\text{on}\\,A}$ (B pushing A to the left). They are equal in magnitude, opposite in direction, and act on different bodies. The applied force $\\vec F$, the weights, and the normal forces each have their third-law partners on bodies not drawn here (the hand/agent applying $\\vec F$, the earth, and the floor), so they are not pairs within these two diagrams." },
      hw4_p5b: { answerType: "text", answer: "Yes. The surface is frictionless, so there is no horizontal force opposing $\\vec F$. Newton's second law in the horizontal direction gives $a = F/(m_A+m_B)$, which is nonzero for any nonzero $F$, no matter how small. The weight acts vertically and is fully balanced by the normal forces, so comparing $F$ to the total weight is irrelevant; the crates accelerate to the right regardless." },
      hw4_p6c: { answerType: "text", answer: "Two action–reaction pairs link the box and the truck. (1) The normal force the bed exerts up on the box (in the box diagram) and the normal force the box exerts down on the bed (in the truck diagram). (2) The friction force the bed exerts forward on the box (the given blue arrow in the box diagram) and the friction force the box exerts backward on the bed (the blue arrow in the truck diagram). Each pair is equal in magnitude, opposite in direction, and acts on two different bodies. The truck's weight, the road's normal force, and the road's traction force each have their third-law partners on bodies not drawn here (the earth and the road), so they are not pairs within these two diagrams." },
      hw4_p7a_m: { answerType: "numeric", answer: 16.603, sigFigs: 3, unit: "N", nonNegative: true },
      hw4_p7a_d: { answerType: "text", answer: "Straight in the $-y$-direction (perpendicular to the intended direction of motion). For the cart to move along $+x$, the net $y$-component of force must be zero. The adults give a net $y$-component of $F_1\\sin 60° - F_2\\sin 30° = 86.6\\text{ N} - 70.0\\text{ N} = +16.6\\text{ N}$, so the child must supply $16.6\\text{ N}$ in the $-y$-direction to cancel it. Pushing purely along $-y$ (adding no unneeded $x$-component) makes the child's force as small as possible: its $x$-component is already in the desired direction and need not be opposed." },
      hw4_p7b: { answerType: "numeric", answer: 839.950, sigFigs: 3, unit: "N", nonNegative: true },
      hw4_p8a: { answerType: "numeric", answer: 0.0022222, sigFigs: 2, unit: "m/s²", nonNegative: true },
      hw4_p8b: { answerType: "numeric", answer: 0.16667, sigFigs: 2, unit: "m/s", nonNegative: true },
      hw4_p8c: { answerType: "text", answer: "The ship does reach the reef: even decelerating the whole 500 m, its speed only drops from $1.5\\text{ m/s}$ to about $0.17\\text{ m/s}$ (it never reaches zero over that distance), so it is still moving when it arrives and strikes the reef. However, $0.17\\text{ m/s}$ is less than the $0.2\\text{ m/s}$ the hull can withstand, so the impact does not breach the hull, and the oil is safe." },
      hw4_p9a: { answerType: "numeric", answer: 4340.3, sigFigs: 2, unit: "m/s²", nonNegative: true },
      hw4_p9b: { answerType: "numeric", answer: 3689236, sigFigs: 2, unit: "N", nonNegative: true },
      hw4_p10a: { answerType: "numeric", answer: 1.50, sigFigs: 3, unit: "m/s²", nonNegative: true },
      hw4_p10d: { answerType: "numeric", answer: 4.33213, sigFigs: 3, unit: "kg", nonNegative: true },
      hw4_p10e: { answerType: "numeric", answer: 5.29483, sigFigs: 3, unit: "kg", nonNegative: true },
    },
  },
  physics2: {
    // Y&F Ch. 21. Every value independently re-derived (see docs/courses/phy215.md § Verification);
    // constants k = 8.9876e9, e = 1.602176634e-19, m_e = 9.109e-31, m_p = 1.673e-27, g = 9.81.
    // `sci: true` renders the revealed answer in scientific notation (E&M magnitudes would
    // otherwise print as twenty-digit integers or long strings of leading zeros).
    hw1: {
      // 21.2 — lightning
      hw1_p1a: { answerType: "numeric", answer: 2.0, sigFigs: 2, unit: "C", nonNegative: true },
      hw1_p1b: { answerType: "numeric", answer: 1.2483018e19, sigFigs: 3, unit: "electrons", sci: true, nonNegative: true },
      // 21.9 — Coulomb's law solved for q  (q = r√(4πε₀F); the "4q and q" case halves it)
      hw1_p2a: { answerType: "numeric", answer: 0.7421333, sigFigs: 3, unit: "μC" },
      hw1_p2b_small: { answerType: "numeric", answer: 0.3710666, sigFigs: 3, unit: "μC" },
      hw1_p2b_large: { answerType: "numeric", answer: 1.4842665, sigFigs: 3, unit: "μC" },
      // 21.22 — 5.393 μN toward +x from q₁, 2.996 μN toward −x from q₂
      hw1_p3_m: { answerType: "numeric", answer: 2.396680, sigFigs: 3, unit: "μN", nonNegative: true },
      hw1_p3_d: { answerType: "text", answer: "In the $+x$-direction (toward $q_1$). Both charges attract $q_3$ because $q_3$ is negative and both are positive, so $q_1$ pulls it toward $+x$ and $q_2$ pulls it toward $-x$. The pull from $q_1$ is stronger ($5.39\\ \\mu\\text{N}$ vs. $3.00\\ \\mu\\text{N}$) because it is closer ($0.200\\text{ m}$ vs. $0.300\\text{ m}$), and distance matters more than the slightly larger $q_2$, so the net force points toward $q_1$ along $+x$." },
      // 21.30 — magnitude in terms of q and a (the direction is the `vector` part, graded client-side)
      hw1_p4_m: { answerType: "math", answer: "\\frac{\\sqrt{2}\\,q}{\\pi \\epsilon_0 a^2}" },
      // 21.33 — parallel plates
      hw1_p5a: { answerType: "numeric", answer: 363.8803, sigFigs: 3, unit: "N/C", nonNegative: true },
      hw1_p5b_y: { answerType: "numeric", answer: 2.723085, sigFigs: 3, unit: "μm", nonNegative: true },
      hw1_p5b_d: { answerType: "text", answer: "No, the proton does not hit a plate. Its deflection is only about $2.72\\ \\mu\\text{m}$, far less than the $0.500\\text{ cm}$ available to it, so it exits the region between the plates. It is deflected downward, toward the lower plate: the proton's charge is positive, so the electric force $q\\vec E$ on it is in the same direction as $\\vec E$, which points vertically downward." },
      hw1_p5c: { answerType: "text", answer: "Both particles follow parabolic paths, because each feels a constant transverse force while its horizontal velocity stays constant, the same mathematics as projectile motion. The differences are direction and size. The electron is deflected upward (its charge is negative, so the force is opposite $\\vec E$) while the proton is deflected downward (positive charge, force along $\\vec E$). The electron's deflection is enormously larger: both particles feel the same magnitude of force $eE$, but $a = F/m$ and the proton is about $1840$ times more massive, so its acceleration and hence its deflection are smaller by that factor: $0.500\\text{ cm}$ for the electron versus about $2.72\\ \\mu\\text{m}$ for the proton." },
      hw1_p5d: { answerType: "text", answer: "Yes, ignoring gravity is entirely reasonable for both particles. The electric acceleration of the electron is $6.40\\times10^{13}\\text{ m/s}^2$ and that of the proton is $3.49\\times10^{10}\\text{ m/s}^2$, whereas $g = 9.81\\text{ m/s}^2$. Gravity is therefore smaller than the electric effect by a factor of roughly $10^{13}$ for the electron and $10^{9}$ for the proton, utterly negligible in both cases, though (relatively speaking) least negligible for the heavier proton." },
      // 21.34 — unit-vector superposition. E₁ points from P toward the origin (q₁ negative) = −y;
      // E₂ points away from q₂ along (−3/5, +4/5).
      hw1_p6a_E1: { answerType: "math", answer: "-2.81\\times10^{4}\\,\\hat{\\jmath}\\ \\text{N/C}" },
      hw1_p6a_E2: { answerType: "math", answer: "(-6.47\\times10^{3})\\,\\hat{\\imath} + (8.63\\times10^{3})\\,\\hat{\\jmath}\\ \\text{N/C}" },
      hw1_p6b: { answerType: "math", answer: "(-6.47\\times10^{3})\\,\\hat{\\imath} + (-1.95\\times10^{4})\\,\\hat{\\jmath}\\ \\text{N/C}" },
      // 21.45 — signed x-components (everything is collinear)
      hw1_p7a_i: { answerType: "numeric", answer: 574.2047, sigFigs: 3, unit: "N/C" },
      hw1_p7a_ii: { answerType: "numeric", answer: -268.3783, sigFigs: 3, unit: "N/C" },
      hw1_p7a_iii: { answerType: "numeric", answer: -404.4398, sigFigs: 3, unit: "N/C" },
      hw1_p7b_i: { answerType: "numeric", answer: -9.199771e-17, sigFigs: 3, unit: "N", sci: true },
      hw1_p7b_ii: { answerType: "numeric", answer: 4.299888e-17, sigFigs: 3, unit: "N", sci: true },
      hw1_p7b_iii: { answerType: "numeric", answer: 6.479844e-17, sigFigs: 3, unit: "N", sci: true },
      // Clock — the pairing/symmetry argument is the substance, so the reference states it
      // The Clock problem is now a four-part walkthrough; (a)-(c) are `vector` parts graded
      // client-side from their key geometry in physics2.js, so only the closing prose lives here.
      hw1_p8d: { answerType: "text", answer: "3:30. Pairing each numeral $n$ with the numeral $n+6$ opposite it, the two fields of a pair lie along one line pointing opposite ways, so the pair's net field is set by the difference of the charges, and that difference is $6q$ for every pair ($7-1 = 8-2 = 9-3 = 10-4 = 11-5 = 12-6 = 6$). Because the larger charge is always the higher numeral, each pair's net field points toward the smaller numeral, i.e. toward the numerals $1, 2, 3, 4, 5, 6$. Those six contributions are equal in magnitude and their directions are spread symmetrically about the $3{:}30$ mark (halfway between the 3 and the 4), so every component perpendicular to that mark cancels in pairs and the resultant points exactly along it. The hour hand points there at 3:30." },
      // 21.73 — E = mg·tan(17.4°)/|q|
      hw1_p9_m: { answerType: "numeric", answer: 34066.21, sigFigs: 3, unit: "N/C", sci: true, nonNegative: true },
      hw1_p9_d: { answerType: "text", answer: "The field is horizontal, pointing toward the wall (in the direction from the ball back toward the wall). The string hangs away from the wall, so the horizontal electric force on the ball must push it away from the wall. But the ball's charge is negative, so the force $q\\vec E$ is directed opposite to $\\vec E$. Therefore $\\vec E$ itself points in the opposite direction to that force: horizontally back toward the wall." },
      // 21.87 — symbolic then numeric ("upside-down projectile" with a = eE/m_p upward)
      hw1_p10a: { answerType: "math", answer: "h_{max} = \\frac{m_p v_0^2 \\sin^2\\alpha}{2eE}" },
      hw1_p10b: { answerType: "math", answer: "d = \\frac{m_p v_0^2 \\sin 2\\alpha}{eE}" },
      hw1_p10c_h: { answerType: "numeric", answer: 0.4175874, sigFigs: 3, unit: "m", nonNegative: true },
      hw1_p10c_d: { answerType: "numeric", answer: 2.893130, sigFigs: 3, unit: "m", nonNegative: true },
    },
    // Y&F Ch. 22 (Gauss's law). Same constants; eps0 = 8.8541878e-12 C²/(N·m²) throughout.
    // 22.42 and 22.51 are entirely symbolic (math/text/graph) — 22.42's graph key lives in
    // physics2.js, so neither problem contributes a numeric entry here.
    hw2: {
      // 22.1 — Phi = EA cos(60 deg) = 1.75 exactly; 14 N/C limits it to 2 sig figs, so the
      // reveal reads "1.8" (which is also what the instructor key boxes).
      hw2_p1a: { answerType: "numeric", answer: 1.75, sigFigs: 2, unit: "N·m²/C", nonNegative: true },
      hw2_p1b: { answerType: "text", answer: "No. For a flat sheet in a uniform field the flux is $\\Phi_E = \\vec E \\cdot \\vec A = EA\\cos\\phi$, which depends only on the magnitude of the field, the area of the sheet, and the angle between the field and the normal to the sheet. The outline of the sheet appears nowhere in that expression, so a square, a circle, a triangle or any other shape of the same $0.250\\text{ m}^2$ held at the same $60°$ orientation intercepts the same number of field lines and gives the same flux, $1.8\\text{ N}\\cdot\\text{m}^2/\\text{C}$." },
      hw2_p1c: { answerType: "text", answer: "The magnitude of the flux is largest at $\\phi = 0°$ and smallest at $\\phi = 90°$. Since $\\Phi_E = EA\\cos\\phi$, the flux is proportional to $\\cos\\phi$, whose magnitude runs from 1 down to 0 as $\\phi$ goes from $0°$ to $90°$. At $\\phi = 0°$ the normal is parallel to the field, so the sheet is face-on to the field and intercepts as many field lines as it possibly can: $\\Phi_E = EA$, the maximum. At $\\phi = 90°$ the normal is perpendicular to the field, so the sheet is edge-on and the field lines skim along its surface without passing through it: $\\cos 90° = 0$ and the flux is zero." },
      // 22.3 — Phi = E(4 pi r^2); q = Phi eps0 = 4 pi eps0 r^2 E = 3.13 microcoulombs
      hw2_p2a: { answerType: "numeric", answer: 353429.17, sigFigs: 3, unit: "N·m²/C", sci: true, nonNegative: true },
      hw2_p2b: { answerType: "numeric", answer: 3.129329, sigFigs: 3, unit: "μC", nonNegative: true },
      // 22.4 — Phi = Q_encl/eps0 = lambda*l/eps0. (b) is deliberately the SAME number as (a).
      hw2_p3a: { answerType: "numeric", answer: 135528.9, sigFigs: 3, unit: "N·m²/C", sci: true, nonNegative: true },
      hw2_p3b: { answerType: "numeric", answer: 135528.9, sigFigs: 3, unit: "N·m²/C", sci: true, nonNegative: true },
      hw2_p3c: { answerType: "numeric", answer: 271057.8, sigFigs: 3, unit: "N·m²/C", sci: true, nonNegative: true },
      hw2_p3d: { answerType: "text", answer: "Gauss's law says the flux depends only on the charge enclosed, $\\Phi_E = Q_{encl}/\\epsilon_0$, so the flux changes only if the change puts a different amount of the line inside the cylinder. Widening the cylinder from $r = 0.250\\text{ m}$ to $r = 0.500\\text{ m}$ encloses exactly the same $0.400\\text{ m}$ of line, so the enclosed charge, and hence the flux, is unchanged at $1.36\\times10^{5}\\text{ N}\\cdot\\text{m}^2/\\text{C}$. Working it out the long way through $\\Phi_E = EA$ shows the same thing from the other side: doubling the radius doubles the area of the curved surface, $A = 2\\pi r l$, but the field there, $E = \\lambda/2\\pi\\epsilon_0 r$, drops to half its former value, and the two changes cancel exactly. Doubling the length from $0.400\\text{ m}$ to $0.800\\text{ m}$ is different: it puts twice as much of the line inside the cylinder, so the enclosed charge doubles and the flux doubles with it, to $2.71\\times10^{5}\\text{ N}\\cdot\\text{m}^2/\\text{C}$." },
      // 22.10 — signed flux. (a) encloses neither charge, (b) only q2, (c) both.
      hw2_p4a: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "N·m²/C" },
      hw2_p4b: { answerType: "numeric", answer: -677.6452, sigFigs: 3, unit: "N·m²/C" },
      hw2_p4c: { answerType: "numeric", answer: -225.8817, sigFigs: 3, unit: "N·m²/C" },
      // 22.14 — outside: r = 0.450 + 0.100 = 0.550 m. Inside a conductor: exactly zero.
      hw2_p5a: { answerType: "numeric", answer: 7.427729, sigFigs: 3, unit: "N/C", nonNegative: true },
      hw2_p5b: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "N/C", nonNegative: true },
      hw2_p5c: { answerType: "text", answer: "Any net charge on a conductor in electrostatic equilibrium sits entirely on its outer surface. The charges in a conductor are free to move and they repel one another, so they spread as far apart as they can get, which puts all of them on the surface. A spherical Gaussian surface drawn inside the metal, at radius $0.350\\text{ m}$, therefore encloses no charge at all, so Gauss's law gives $\\oint \\vec E \\cdot d\\vec A = Q_{encl}/\\epsilon_0 = 0$. By the spherical symmetry the field has the same magnitude everywhere on that surface and is radial, so $4\\pi r^2 E = 0$ and $E = 0$ at every point inside. Equivalently: if the field inside were not zero it would push the free charges around, and the conductor would not be in equilibrium." },
      // 22.15 — F = (lambda*L) * E where E = lambda/(2 pi eps0 d) is the field of the other line
      hw2_p6: { answerType: "numeric", answer: 0.08100776, sigFigs: 3, unit: "N", nonNegative: true },
      // 22.26 — E = sigma/2eps0 = 0.1638 N/C (independent of distance), so W = eE(0.250 m).
      // The work is POSITIVE: the electron is negative and the sheet positive, so the force on it
      // points toward the sheet, the same way it moves.
      hw2_p7a: { answerType: "numeric", answer: 6.559477e-21, sigFigs: 3, unit: "J", sci: true, nonNegative: true },
      hw2_p7b: { answerType: "numeric", answer: 120008.6, sigFigs: 3, unit: "m/s", sci: true, nonNegative: true },
      // 22.42 — symbolic. (d)'s sketch is graded client-side from the `graph` key in physics2.js.
      hw2_p8a: { answerType: "math", answer: "E = \\frac{\\rho r}{2\\epsilon_0}" },
      hw2_p8b: { answerType: "math", answer: "E = \\frac{\\lambda}{2\\pi\\epsilon_0 r}" },
      hw2_p8c: { answerType: "text", answer: "They agree. Putting $r = R$ in the part (a) result gives $E = \\rho R/2\\epsilon_0$. The charge per unit length of the cylinder is the charge density times its cross-sectional area, $\\lambda = \\rho\\pi R^2$, so putting $r = R$ in the part (b) result gives $E = \\lambda/2\\pi\\epsilon_0 R = \\rho\\pi R^2/2\\pi\\epsilon_0 R = \\rho R/2\\epsilon_0$, the same value. (Equivalently, multiplying the part (b) expression by $\\pi R^2$ in the right place, or substituting $\\lambda = \\pi R^2\\rho$, turns one into the other.) So the two models agree at the boundary: the field is continuous at the surface of the cylinder, which is what must happen for a charge distribution with no infinitely thin surface layer of charge. The field rises linearly to its maximum $\\rho R/2\\epsilon_0$ at the surface and then falls off as $1/r$ beyond it." },
      // 22.43 — theta = arctan(q*sigma / (2 m g eps0)). Degree-valued, so `angle: true`.
      // (a) is the free-body diagram, graded client-side from the `fbd` key in physics2.js.
      hw2_p9_ang: { answerType: "numeric", answer: 10.19783, sigFigs: 3, unit: "°", angle: true },
      hw2_p9_why: { answerType: "text", answer: "No, the angle would not change in either case. Gauss's law gives the field of a very large uniformly charged sheet as $E = \\sigma/2\\epsilon_0$, which contains no distance: the field has the same magnitude everywhere near the sheet. (Applying Gauss's law to a box straddling the sheet, the flux $2EA$ equals $\\sigma A/\\epsilon_0$, and the area cancels.) So the horizontal electric force on the sphere, $F = qE = q\\sigma/2\\epsilon_0$, is the same no matter how far from the sheet it hangs. Equilibrium requires $T\\sin\\theta = qE$ and $T\\cos\\theta = mg$, so $\\tan\\theta = qE/mg = q\\sigma/2mg\\epsilon_0$, which depends only on the charge, the surface charge density, and the weight. Lengthening the thread or starting the sphere nearer the sheet moves where the sphere ends up, but the thread still settles at the same $10.2°$ from the vertical." },
      // 22.51 — outside, the shell acts exactly like a point charge -Q at its center; inside, a
      // concentric Gaussian sphere encloses nothing, so the field and the force are exactly zero.
      hw2_p10a_m: { answerType: "math", answer: "F = \\frac{qQ}{4\\pi\\epsilon_0 r^2}" },
      hw2_p10a_d: { answerType: "text", answer: "The force is directed radially inward, toward the center of the shell: it is attractive. A concentric spherical Gaussian surface of radius $r > R$ encloses the whole charge $-Q$, and by the spherical symmetry the field on it is radial with a single magnitude, so $4\\pi r^2 E = -Q/\\epsilon_0$ and the field points inward, exactly as if a point charge $-Q$ sat at the center. The point charge $q$ is positive, so the force $q\\vec E$ on it is in the same direction as $\\vec E$, that is, straight in toward the center of the shell. This also follows from the signs alone: opposite charges attract." },
      hw2_p10b: { answerType: "text", answer: "The force is zero. Draw a concentric spherical Gaussian surface of radius $r < R$. All of the charge $-Q$ lies on the shell at radius $R$, which is outside this surface, so the surface encloses no charge at all: $Q_{encl} = 0$. By the spherical symmetry the field on that surface is radial and of a single magnitude, so Gauss's law gives $\\oint \\vec E \\cdot d\\vec A = 4\\pi r^2 E = Q_{encl}/\\epsilon_0 = 0$, and therefore $E = 0$. Since this holds for every radius $r < R$, the field vanishes everywhere inside the shell, and the force on the point charge is $\\vec F = q\\vec E = 0$." },
    },
    // Y&F Ch. 23 (electric potential energy and electric potential). Same constants.
    // 23.62's free-body diagram is graded client-side from the `fbd` key in physics2.js, so that
    // part contributes no entry here.
    hw3: {
      // 23.1 — W = kq1q2(1/r_a - 1/r_b) with r_b = sqrt(2)(0.250) = 0.353553 m. Negative because
      // the charges attract and the separation grows. SIGNED: no nonNegative.
      hw3_p1: { answerType: "numeric", answer: -0.3560053, sigFigs: 3, unit: "J" },
      // 23.4 — (a) is the work the EXTERNAL agent does, W = dU = ke^2(1/r_f - 1/r_i) > 0. The
      // instructor key boxes the negative of this (the work done by the electric force); the prompt
      // names the agent, and nonNegative turns a sign slip into a free nudge.
      hw3_p2a: { answerType: "numeric", answer: 7.690181e-14, sigFigs: 3, unit: "J", sci: true, nonNegative: true },
      // (b) both protons share the released energy equally, so 2*(1/2 m v^2) = W  ->  v = sqrt(W/m_p)
      hw3_p2b: { answerType: "numeric", answer: 6779864, sigFigs: 3, unit: "m/s", sci: true, nonNegative: true },
      // 23.8 — three identical pairs: U = 3kq^2/r = 0.0777 J. The instructor key boxes 7.77 mJ,
      // a factor of 10 low (its own working line gives 7.77e-3 where 7.77e-2 is correct).
      hw3_p3: { answerType: "numeric", answer: 0.07765286, sigFigs: 3, unit: "J", nonNegative: true },
      // 23.13 — v_B = sqrt(v_A^2 + (2q/m)(V_A - V_B)) = sqrt(55)
      hw3_p4a: { answerType: "numeric", answer: 7.416198, sigFigs: 3, unit: "m/s", nonNegative: true },
      hw3_p4b: { answerType: "text", answer: "Faster: it speeds up from $5.00\\text{ m/s}$ to $7.42\\text{ m/s}$. The particle's charge is negative, so its potential energy $U = qV$ runs opposite to the potential, and moving to the higher potential at $B$ therefore lowers its potential energy: $U_A = (-5.00\\times10^{-6}\\text{ C})(200\\text{ V}) = -1.00\\times10^{-3}\\text{ J}$ falls to $U_B = (-5.00\\times10^{-6}\\text{ C})(800\\text{ V}) = -4.00\\times10^{-3}\\text{ J}$, a drop of $3.00\\times10^{-3}\\text{ J}$. The electric force is the only force acting, so mechanical energy is conserved and that lost potential energy reappears as kinetic energy: $K$ rises from $2.50\\times10^{-3}\\text{ J}$ to $5.50\\times10^{-3}\\text{ J}$, and the speed rises with it. Equivalently, the force on a negative charge points from low potential toward high potential, so here it pushes the particle along its way from $A$ to $B$ and does positive work on it. A positive charge making the same trip would have slowed down instead." },
      // 23.19 — V = k*sum(q_i/r_i) at each point. Both potentials are negative (q2 dominates).
      hw3_p5a: { answerType: "numeric", answer: -736.9832, sigFigs: 3, unit: "V" },
      hw3_p5b: { answerType: "numeric", answer: -704.0294, sigFigs: 3, unit: "V" },
      // (c) the charge travels B -> A, so W = q(V_B - V_A) = +8.24e-8 J. The instructor key
      // computed A -> B and boxed -82.5 nJ; the direction stated in the problem is B -> A.
      hw3_p5c: { answerType: "numeric", answer: 8.238457e-8, sigFigs: 3, unit: "J", sci: true },
      // 23.40 — d = V/E = 1.5 V / 1.0e-6 V/m
      hw3_p6a: { answerType: "numeric", answer: 1.5e6, sigFigs: 2, unit: "m", sci: true, nonNegative: true },
      hw3_p6b: { answerType: "text", answer: "The plates would have to be $1.5\\times10^{6}\\text{ m}$, or $1500\\text{ km}$, apart. That is roughly the distance from New York to Miami, and about one eighth of the diameter of the Earth. Building a parallel-plate capacitor on that scale is out of the question, which is exactly the point of the comparison: an ordinary AA battery across plates any realistic distance apart produces a field enormously stronger than $1.0\\ \\mu\\text{V/m}$. At a normal laboratory spacing of $1.0\\text{ cm}$, for instance, the same $1.5\\text{-V}$ battery gives $E = 150\\text{ V/m}$, about $10^{8}$ times the field the shark can detect. The sharks' electroreceptors are therefore extraordinarily sensitive, able to pick up the very faint fields produced by the muscle activity of nearby prey." },
      // 23.50 — (a) energy conservation: 1/2 m(v1^2 - v2^2) = kq1q2(1/r2 - 1/r1). The instructor
      // key rounds this to 0.026 m and carries the rounded value into (b), giving 3.32e4 m/s^2;
      // carried at full precision the acceleration is 3.31e4 m/s^2 (a 0.4% difference).
      hw3_p7a: { answerType: "numeric", answer: 0.02606662, sigFigs: 3, unit: "m", nonNegative: true },
      hw3_p7b: { answerType: "numeric", answer: 33068.47, sigFigs: 3, unit: "m/s²", sci: true, nonNegative: true },
      // 23.56 — the Bohr atom. m_e v^2/r = ke^2/r^2 gives (a); K = 1/2 m_e v^2 gives (b);
      // U = -ke^2/r, so K = |U|/2 and E = K + U = -ke^2/2r.
      hw3_p8a: { answerType: "math", answer: "v = \\frac{e}{\\sqrt{4\\pi\\epsilon_0 m_e r}}" },
      hw3_p8b: { answerType: "math", answer: "K = \\frac{e^2}{8\\pi\\epsilon_0 r}" },
      hw3_p8c: { answerType: "text", answer: "Setting the electric force equal to the mass times the centripetal acceleration gives $\\dfrac{1}{4\\pi\\epsilon_0}\\dfrac{e^2}{r^2} = \\dfrac{m_e v^2}{r}$, so $m_e v^2 = \\dfrac{e^2}{4\\pi\\epsilon_0 r}$ and the kinetic energy is $K = \\tfrac12 m_e v^2 = \\dfrac{e^2}{8\\pi\\epsilon_0 r}$. The electric potential energy of the proton and electron, taking $U = 0$ at infinite separation, is $U = \\dfrac{1}{4\\pi\\epsilon_0}\\dfrac{(+e)(-e)}{r} = -\\dfrac{e^2}{4\\pi\\epsilon_0 r}$, so its magnitude is $|U| = \\dfrac{e^2}{4\\pi\\epsilon_0 r}$. Comparing the two, $K = \\tfrac12 |U|$: the kinetic energy is exactly half the magnitude of the potential energy, or equivalently $K = -U/2$, since $K$ is positive while $U$ is negative. The factor of two is not an accident of hydrogen; it is the virial theorem for an inverse-square attractive force, and it is what makes the total energy $E = K + U = -|U|/2$ negative, so the atom is bound." },
      hw3_p8d: { answerType: "math", answer: "E = -\\frac{e^2}{8\\pi\\epsilon_0 r}" },
      hw3_p8e: { answerType: "numeric", answer: -2.180598e-18, sigFigs: 3, unit: "J", sci: true },
      hw3_p8f: { answerType: "numeric", answer: -13.61033, sigFigs: 3, unit: "eV" },
      // 23.59 — 28 pairs in three shells: 12 edges at d (opposite sign), 12 face diagonals at
      // d*sqrt2 (same sign), 4 body diagonals at d*sqrt3 (opposite sign), so the sum is
      // (-12 + 12/sqrt2 - 4/sqrt3) q^2/d = -5.8241 q^2/d, i.e. U = -5.8241 kq^2/d = -1.456 q^2/pi eps0 d.
      hw3_p9a: { answerType: "math", answer: "U = -\\frac{1.46\\,q^2}{\\pi\\epsilon_0 d} = -5.82\\,\\frac{kq^2}{d}" },
      hw3_p9b: { answerType: "text", answer: "A negative $U$ means the assembled cube has less energy than the same eight ions have when they are infinitely far apart, because that fully separated state is the zero of potential energy. To pull the ions apart to infinity you would have to supply that energy, $|U| = 1.46q^2/\\pi\\epsilon_0 d$ per cell, from outside. The arrangement is therefore bound, or stable: it will not fly apart on its own, and there is a real energy barrier against pulling it apart. That is why ionic crystals such as NaCl exist in nature, hold together as solids at ordinary temperatures, and have high melting points. The reason the sum comes out negative is geometric: every ion's nearest neighbors are of the opposite sign, and those closest pairs (12 of them, at the edge distance $d$) attract, while the like-sign pairs that repel sit farther away, on the face diagonals at $d\\sqrt2$ and the body diagonals at $d\\sqrt3$. Since each contribution goes as $1/r$, the nearby attractions outweigh the more distant repulsions." },
      // 23.62 — equilibrium gives F_E = mg tan(30 deg), then E = F_E/q and dV = Ed.
      // (a) is the free-body diagram, graded client-side from the `fbd` key in physics2.js.
      hw3_p10_v: { answerType: "numeric", answer: 47.72865, sigFigs: 3, unit: "V", nonNegative: true },
      hw3_p10_p: { answerType: "text", answer: "The left-hand plate is at the higher potential. The sphere's charge is positive, $q = +8.90\\times10^{-6}\\text{ C}$, so the electric force $q\\vec E$ on it points in the same direction as $\\vec E$. The thread hangs toward the right-hand plate, so that force points to the right, and therefore $\\vec E$ between the plates points to the right as well, from the left plate toward the right plate. The electric field always points from higher potential toward lower potential (it is the direction in which $V$ decreases most steeply), so the left plate is the high-potential plate, carrying the $+\\sigma$ surface charge, while the right plate carries $-\\sigma$. The same conclusion follows from the signs alone: a positive sphere is repelled by the positive plate and attracted toward the negative one, which is exactly the deflection shown in the figure." },
    },
    // Y&F Ch. 24 (capacitance and dielectrics). eps0 = 8.8541878e-12 C^2/(N*m^2) throughout.
    // Every quantity in this set is a capacitance, a charge magnitude, a potential difference, an
    // energy, an energy density, an area or a radius, so EVERY item is `nonNegative: true` and
    // none is an angle. The set is entirely numeric: the Y&F wording is used verbatim and none of
    // its parts asks for prose, so there is no text/math entry here.
    // Sig figs follow the given data: 3 sf where the data are 3 sf (24.1, 24.10, 24.17, 24.21,
    // 24.25, 24.30, 24.36) and 2 sf where they are not (24.16's 9.0/11/15 pF, 24.31's 35/75 nF).
    hw4: {
      // 24.1 — V = Ed = 1.00e4 V; A = Qd/(eps0 V) = 2.2588e-3 m^2 = 22.6 cm^2; C = Q/V = 8.00 pF
      hw4_p1a: { answerType: "numeric", answer: 10000, sigFigs: 3, unit: "V", sci: true, nonNegative: true },
      hw4_p1b: { answerType: "numeric", answer: 22.588181, sigFigs: 3, unit: "cm²", nonNegative: true },
      hw4_p1c: { answerType: "numeric", answer: 8.00, sigFigs: 3, unit: "pF", nonNegative: true },
      // 24.10 — ln(rb/ra) = 2 pi eps0 L / C = 0.181905, so rb = ra e^0.181905 = 3.00 mm.
      // lambda = Q/L = CV/L = 3.8229e-8 C/m (identical to 2 pi eps0 V / ln(rb/ra)).
      hw4_p2a: { answerType: "numeric", answer: 2.9987495, sigFigs: 3, unit: "mm", nonNegative: true },
      hw4_p2b: { answerType: "numeric", answer: 38.229167, sigFigs: 3, unit: "nC/m", nonNegative: true },
      // 24.16 — C_bc = 9.0 + 11 = 20 pF; C_ac = (1/15 + 1/20)^-1 = 8.57 pF
      hw4_p3a: { answerType: "numeric", answer: 20, sigFigs: 2, unit: "pF", nonNegative: true },
      hw4_p3b: { answerType: "numeric", answer: 8.5714286, sigFigs: 2, unit: "pF", nonNegative: true },
      // 24.17 — C12 = 2.00, C_ad = 6.00, C_ab = 2.40 uF. Q4 = C_ab V_ab = 67.2 uC (the whole
      // network's charge, since C4 is in series with the group); V4 = 16.8 V; V_ad = 11.2 V;
      // Q3 = 44.8 uC; Q1 = Q2 = 22.4 uC; V1 = V2 = 5.60 V. C1/C2 and V1/V2 each get their own
      // blank: that they come out equal is the result, not something the prompt may give away.
      // (c) is deliberately the same 11.2 V as V3 — C3 is wired straight from a to d, and the
      // textbook asks both, so it stands as its own blank and doubles as a consistency check.
      hw4_p4a_q1: { answerType: "numeric", answer: 22.4, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p4a_q2: { answerType: "numeric", answer: 22.4, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p4a_q3: { answerType: "numeric", answer: 44.8, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p4a_q4: { answerType: "numeric", answer: 67.2, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p4b_v1: { answerType: "numeric", answer: 5.60, sigFigs: 3, unit: "V", nonNegative: true },
      hw4_p4b_v2: { answerType: "numeric", answer: 5.60, sigFigs: 3, unit: "V", nonNegative: true },
      hw4_p4b_v3: { answerType: "numeric", answer: 11.2, sigFigs: 3, unit: "V", nonNegative: true },
      hw4_p4b_v4: { answerType: "numeric", answer: 16.8, sigFigs: 3, unit: "V", nonNegative: true },
      hw4_p4c: { answerType: "numeric", answer: 11.2, sigFigs: 3, unit: "V", nonNegative: true },
      // 24.21 — series branch (18.0, 30.0, 10.0) = 5.294 nF; C_ab = 7.5 + 6.5 + 5.294 = 19.3 nF.
      // Q = C_ab V = 482 nC. The 6.5-nF and 7.5-nF branches sit straight across ab, so the 6.5-nF
      // charge is (6.5 nF)(25 V) and (d) is the full 25 V restated.
      hw4_p5a: { answerType: "numeric", answer: 19.294118, sigFigs: 3, unit: "nF", nonNegative: true },
      hw4_p5b: { answerType: "numeric", answer: 482.35294, sigFigs: 3, unit: "nC", nonNegative: true },
      hw4_p5c: { answerType: "numeric", answer: 162.5, sigFigs: 3, unit: "nC", nonNegative: true },
      hw4_p5d: { answerType: "numeric", answer: 25, sigFigs: 2, unit: "V", nonNegative: true },
      // 24.25 — E = V/d = 8.00e4 V/m; u = (1/2) eps0 E^2 = 2.83e-2 J/m^3. The 5.80 uF is not needed.
      hw4_p6: { answerType: "numeric", answer: 0.028333401, sigFigs: 3, unit: "J/m³", sci: true, nonNegative: true },
      // 24.30 — SERIES: C_eq = 66.67 nF; Q = C_eq V = 2.40 uC on BOTH; U = (1/2)QV = 43.2 uJ;
      // U = Q^2/2C gives 19.2 and 24.0 uJ; V = Q/C gives 16.0 and 20.0 V (summing to 36 V).
      hw4_p7a: { answerType: "numeric", answer: 2.40, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p7b_150: { answerType: "numeric", answer: 2.40, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p7b_120: { answerType: "numeric", answer: 2.40, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p7c: { answerType: "numeric", answer: 43.2, sigFigs: 3, unit: "μJ", nonNegative: true },
      hw4_p7d_150: { answerType: "numeric", answer: 19.2, sigFigs: 3, unit: "μJ", nonNegative: true },
      hw4_p7d_120: { answerType: "numeric", answer: 24.0, sigFigs: 3, unit: "μJ", nonNegative: true },
      hw4_p7e_150: { answerType: "numeric", answer: 16.0, sigFigs: 3, unit: "V", nonNegative: true },
      hw4_p7e_120: { answerType: "numeric", answer: 20.0, sigFigs: 3, unit: "V", nonNegative: true },
      // 24.31 — PARALLEL: C_eq = 110 nF; Q = 24.2 uC total, 7.7 and 16.5 uC individually;
      // U = (1/2)CV^2 = 2.662 mJ total, 0.847 and 1.815 mJ individually; 220 V across each.
      // 2 sig figs throughout (35 nF, 75 nF), which is what the instructor key boxes.
      hw4_p8a: { answerType: "numeric", answer: 24.2, sigFigs: 2, unit: "μC", nonNegative: true },
      hw4_p8b_35: { answerType: "numeric", answer: 7.7, sigFigs: 2, unit: "μC", nonNegative: true },
      hw4_p8b_75: { answerType: "numeric", answer: 16.5, sigFigs: 2, unit: "μC", nonNegative: true },
      hw4_p8c: { answerType: "numeric", answer: 2.662, sigFigs: 2, unit: "mJ", nonNegative: true },
      hw4_p8d_35: { answerType: "numeric", answer: 0.847, sigFigs: 2, unit: "mJ", nonNegative: true },
      hw4_p8d_75: { answerType: "numeric", answer: 1.815, sigFigs: 2, unit: "mJ", nonNegative: true },
      hw4_p8e_35: { answerType: "numeric", answer: 220, sigFigs: 2, unit: "V", nonNegative: true },
      hw4_p8e_75: { answerType: "numeric", answer: 220, sigFigs: 2, unit: "V", nonNegative: true },
      // 24.36 — the field cap fixes V = Ed = 45.0 V in both parts. (a) Q = C0 V = 225 pC;
      // (b) Q = K C0 V = 2.70 x 225 = 608 pC.
      hw4_p9a: { answerType: "numeric", answer: 225, sigFigs: 3, unit: "pC", nonNegative: true },
      hw4_p9b: { answerType: "numeric", answer: 607.5, sigFigs: 3, unit: "pC", nonNegative: true },
      // 24.63 — the ladder collapses one rung at a time, and every rung returns 6.9 uF:
      // C_eq1 = C1/3 = 2.3; C_eq2 = C_eq1 + C2 = 6.9; C_eq3 = (2/C1 + 1/6.9)^-1 = 2.3;
      // C_eq4 = 6.9; C_eq = 2.3 uF. Then Q = C_eq(420) = 966 uC on each outer C1, each dropping
      // 140 V, so the first C2 has 140 V across it and 644 uC on it; the remaining 322 uC drives
      // the next rung, and V_cd = 140/3 = 46.7 V (each rung divides the voltage by three).
      //
      // sigFigs here is set so each reveal reads as the value a correct reduction actually
      // produces. The data are 2 sf (6.9 / 4.6 uF), and at 2 sf (b) would reveal "970 uC" — a
      // number matching neither the exact 966 nor the instructor key's 960, so it would read as a
      // third answer to a student who got it right. 3 sf on (b)/(c) is not a precision claim
      // (the third figure is not significant); it just keeps the reveal recognizable. (a) stays
      // at 2 sf because C1/3 = 2.3 exactly, and "2.30" would be the overstatement.
      hw4_p10a: { answerType: "numeric", answer: 2.3, sigFigs: 2, unit: "μF", nonNegative: true },
      hw4_p10b_c1a: { answerType: "numeric", answer: 966, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p10b_c1b: { answerType: "numeric", answer: 966, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p10b_c2: { answerType: "numeric", answer: 644, sigFigs: 3, unit: "μC", nonNegative: true },
      hw4_p10c: { answerType: "numeric", answer: 46.666667, sigFigs: 3, unit: "V", nonNegative: true },
    },
  },
};

// Look up a single item's answer-key entry. Returns null if missing.
export function lookupAnswer(courseType, hwId, itemId) {
  return ANSWER_KEYS?.[courseType]?.[hwId]?.[itemId] || null;
}
