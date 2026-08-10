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
//
// Item ids are unique within a homework (part ids for multipart problems, the problem id
// otherwise). When authoring/editing a homework, put the answer HERE and the prompt/figure/configs
// in src/courses/<course>.js — see docs/homework-roadmap.md § Authoring.

export const ANSWER_KEYS = {
  physics1: {
    hw1: {
      hw1_p1a: { answerType: "numeric", answer: 88, sigFigs: 2, unit: "ft/s" },
      hw1_p1b: { answerType: "numeric", answer: 9.75, sigFigs: 2, unit: "m/s²" },
      hw1_p1c: { answerType: "numeric", answer: 1000, sigFigs: 2, unit: "kg/m³" },
      hw1_p2a: { answerType: "numeric", answer: -8.12, sigFigs: 3, unit: "m" },
      hw1_p2b: { answerType: "numeric", answer: 15.3, sigFigs: 3, unit: "m" },
      hw1_p3a_m: { answerType: "numeric", answer: 9.00, sigFigs: 3, unit: "m" },
      hw1_p3a_d: { answerType: "numeric", answer: 33.6, sigFigs: 3, unit: "°" },
      hw1_p3b_m: { answerType: "numeric", answer: 9.00, sigFigs: 3, unit: "m" },
      hw1_p3b_d: { answerType: "numeric", answer: 33.6, sigFigs: 3, unit: "°" },
      hw1_p3c_m: { answerType: "numeric", answer: 22.3, sigFigs: 3, unit: "m" },
      hw1_p3c_d: { answerType: "numeric", answer: 250.3, sigFigs: 4, unit: "°" },
      hw1_p3d_m: { answerType: "numeric", answer: 22.3, sigFigs: 3, unit: "m" },
      hw1_p3d_d: { answerType: "numeric", answer: 70.3, sigFigs: 3, unit: "°" },
      hw1_p4a_m: { answerType: "numeric", answer: 10.0, sigFigs: 3, unit: "cm" },
      hw1_p4a_d: { answerType: "numeric", answer: 149, sigFigs: 3, unit: "°" },
      hw1_p4b_m: { answerType: "numeric", answer: 10.0, sigFigs: 3, unit: "m" },
      hw1_p4b_d: { answerType: "numeric", answer: 194, sigFigs: 3, unit: "°" },
      hw1_p4c_m: { answerType: "numeric", answer: 8.21, sigFigs: 3, unit: "km" },
      hw1_p4c_d: { answerType: "numeric", answer: 341, sigFigs: 3, unit: "°" },
      hw1_p5_m: { answerType: "numeric", answer: 3.39, sigFigs: 3, unit: "km" },
      hw1_p5_d: { answerType: "numeric", answer: 149, sigFigs: 3, unit: "°" },
      hw1_p6a: { answerType: "numeric", answer: -6.6, sigFigs: 2, unit: "m²" },
      hw1_p6b_m: { answerType: "numeric", answer: 5.6, sigFigs: 2, unit: "m²" },
      hw1_p6b_d: { answerType: "text", answer: "Out of the page — the +z-direction." },
      hw1_p7a_A: { answerType: "numeric", answer: 5.39, sigFigs: 3 },
      hw1_p7a_B: { answerType: "numeric", answer: 4.36, sigFigs: 3 },
      hw1_p7b: { answerType: "math", answer: "-5.00\\,\\hat{\\imath} + 2.00\\,\\hat{\\jmath} + 7.00\\,\\hat{k}" },
      hw1_p7c_m: { answerType: "numeric", answer: 8.83, sigFigs: 3 },
      hw1_p7c_e: { answerType: "text", answer: "Yes — the magnitudes are equal. Since $\\vec{B}-\\vec{A} = -(\\vec{A}-\\vec{B})$, the two difference vectors point in opposite directions but have the same length (8.83)." },
      hw1_p8: { answerType: "numeric", answer: 3.30, sigFigs: 3, unit: "N" },
      hw1_p9: { answerType: "numeric", answer: 124, sigFigs: 3, unit: "°" },
      hw1_p10: { answerType: "numeric", answer: 170, sigFigs: 3, unit: "m²" },
    },
    hw2: {
      hw2_p1: { answerType: "numeric", answer: 1.17, sigFigs: 2, unit: "h" },
      hw2_p2a_a: { answerType: "numeric", answer: -1.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2a_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p2b_a: { answerType: "numeric", answer: -1.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2b_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p2c_a: { answerType: "numeric", answer: -3.0, sigFigs: 2, unit: "m/s²" },
      hw2_p2c_d: { answerType: "text", answer: "Toward the left (the $-x$-direction)." },
      hw2_p3a: { answerType: "numeric", answer: 675, sigFigs: 3, unit: "m/s²" },
      hw2_p3b: { answerType: "numeric", answer: 0.0667, sigFigs: 3, unit: "s" },
      hw2_p4a: { answerType: "numeric", answer: 250, sigFigs: 3, unit: "m" },
      hw2_p4b: { answerType: "numeric", answer: 40.0, sigFigs: 3, unit: "m/s" },
      hw2_p5a: { answerType: "numeric", answer: 2.9382, sigFigs: 3, unit: "m/s" },
      hw2_p5b: { answerType: "numeric", answer: 0.59901, sigFigs: 3, unit: "s" },
      hw2_p6: { answerType: "numeric", answer: 1796, sigFigs: 3, unit: "m" },
      hw2_p7a1: { answerType: "numeric", answer: 5.60, sigFigs: 3, unit: "m/s" },
      hw2_p7a2: { answerType: "numeric", answer: 7.20, sigFigs: 3, unit: "m/s" },
      hw2_p7a3: { answerType: "numeric", answer: 8.80, sigFigs: 3, unit: "m/s" },
      hw2_p7b: { answerType: "numeric", answer: 0.800, sigFigs: 3, unit: "m/s²" },
      hw2_p7c: { answerType: "numeric", answer: 4.80, sigFigs: 3, unit: "m/s" },
      hw2_p7d: { answerType: "numeric", answer: 6.00, sigFigs: 3, unit: "s" },
      hw2_p7e: { answerType: "numeric", answer: 25.6, sigFigs: 3, unit: "m" },
      hw2_p8: { answerType: "numeric", answer: 50, sigFigs: 2, unit: "m" },
      hw2_p9: { answerType: "numeric", answer: 3.6022, sigFigs: 3, unit: "m" },
      hw2_p10a: { answerType: "numeric", answer: 2.6442, sigFigs: 3, unit: "× H" },
      hw2_p10b: { answerType: "numeric", answer: 2.6442, sigFigs: 3, unit: "× T" },
    },
    hw3: {
      hw3_p1a_x: { answerType: "numeric", answer: 1.4, sigFigs: 2, unit: "m/s" },
      hw3_p1a_y: { answerType: "numeric", answer: -1.3, sigFigs: 2, unit: "m/s" },
      hw3_p1b_m: { answerType: "numeric", answer: 1.9105, sigFigs: 2, unit: "m/s" },
      hw3_p1b_d: { answerType: "numeric", answer: 317.12, sigFigs: 3, unit: "°" },
      hw3_p2a_x: { answerType: "numeric", answer: 6.4573, sigFigs: 2, unit: "m/s" },
      hw3_p2a_y: { answerType: "numeric", answer: 0.5177, sigFigs: 2, unit: "m/s" },
      hw3_p2b_m: { answerType: "numeric", answer: 6.478, sigFigs: 2, unit: "m/s" },
      hw3_p2b_d: { answerType: "numeric", answer: 4.584, sigFigs: 2, unit: "°" },
      hw3_p3: { answerType: "numeric", answer: 3.325, sigFigs: 3, unit: "m" },
      hw3_p4: { answerType: "numeric", answer: 1.28781, sigFigs: 3, unit: "m/s²" },
      hw3_p5a_x: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5a_y: { answerType: "numeric", answer: 43.301, sigFigs: 3, unit: "m/s" },
      hw3_p5b: { answerType: "numeric", answer: 4.41399, sigFigs: 3, unit: "s" },
      hw3_p5c: { answerType: "numeric", answer: 95.5657, sigFigs: 3, unit: "m" },
      hw3_p5d: { answerType: "numeric", answer: 220.700, sigFigs: 3, unit: "m" },
      hw3_p5e_ax: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s²" },
      hw3_p5e_ay: { answerType: "numeric", answer: -9.81, sigFigs: 3, unit: "m/s²" },
      hw3_p5e_vx: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5e_vy: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s" },
      hw3_p6a: { answerType: "numeric", answer: 53.130, sigFigs: 3, unit: "°" },
      hw3_p6b_s: { answerType: "numeric", answer: 15.0, sigFigs: 3, unit: "m/s" },
      hw3_p6b_a: { answerType: "numeric", answer: 9.81, sigFigs: 3, unit: "m/s²" },
      hw3_p6c_h: { answerType: "numeric", answer: 15.855, sigFigs: 3, unit: "m" },
      hw3_p6c_s: { answerType: "numeric", answer: 17.7179, sigFigs: 3, unit: "m/s" },
      hw3_p7a_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²" },
      hw3_p7a_d: { answerType: "text", answer: "Upward — directed toward the center of the wheel (the centripetal direction). Because the speed is constant there is no tangential acceleration, so the acceleration is purely radial." },
      hw3_p7b_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²" },
      hw3_p7b_d: { answerType: "text", answer: "Downward — directed toward the center of the wheel. The magnitude is the same as at the lowest point; only the direction (toward the center) has changed." },
      hw3_p7c: { answerType: "numeric", answer: 12.566, sigFigs: 3, unit: "s" },
      hw3_p8: { answerType: "numeric", answer: 31.0061, sigFigs: 2, unit: "m/s" },
      hw3_p9a: { answerType: "numeric", answer: 32.6593, sigFigs: 3, unit: "m/s" },
      hw3_p9b: { answerType: "text", answer: "Essentially zero — the shell lands right at the edge. With the minimum muzzle velocity from part (a), the trajectory's peak height is only about $25.3\\text{ m}$, just barely above the $25.0\\text{-m}$ cliff, and that peak occurs at a horizontal distance of about $54\\text{ m}$ — before the cliff edge at $60.0\\text{ m}$. So the shell is already descending as it reaches the edge: it passes back down through the $25.0\\text{-m}$ height essentially at the edge itself (at $x \\approx 60.0\\text{ m}$). It therefore lands at (to within rounding, $0\\text{ m}$ beyond) the edge of the cliff." },
      hw3_p10a: { answerType: "numeric", answer: 1.50115, sigFigs: 3, unit: "m/s" },
      hw3_p10b: { answerType: "numeric", answer: 4.65597, sigFigs: 3, unit: "m" },
    },
    hw4: {
      hw4_p1a: { answerType: "numeric", answer: 69.282, sigFigs: 3, unit: "N" },
      hw4_p1b: { answerType: "numeric", answer: 34.641, sigFigs: 3, unit: "N" },
      hw4_p2a: { answerType: "numeric", answer: 4.3077, sigFigs: 3, unit: "m/s²" },
      hw4_p2b: { answerType: "numeric", answer: 215.38, sigFigs: 3, unit: "m" },
      hw4_p2c: { answerType: "numeric", answer: 43.077, sigFigs: 3, unit: "m/s" },
      hw4_p3a: { answerType: "numeric", answer: 4.48522, sigFigs: 3, unit: "kg" },
      hw4_p3b_m: { answerType: "numeric", answer: 4.48522, sigFigs: 3, unit: "kg" },
      hw4_p3b_w: { answerType: "numeric", answer: 8.11825, sigFigs: 3, unit: "N" },
      hw4_p4: { answerType: "numeric", answer: 20, sigFigs: 2, unit: "N" },
      hw4_p5a_pairs: { answerType: "text", answer: "The contact forces between the crates form the only action–reaction pair shown: $\\vec F_{A\\,\\text{on}\\,B}$ (A pushing B to the right) and $\\vec F_{B\\,\\text{on}\\,A}$ (B pushing A to the left). They are equal in magnitude, opposite in direction, and act on different bodies. The applied force $\\vec F$, the weights, and the normal forces each have their third-law partners on bodies not drawn here (the hand/agent applying $\\vec F$, the earth, and the floor), so they are not pairs within these two diagrams." },
      hw4_p5b: { answerType: "text", answer: "Yes. The surface is frictionless, so there is no horizontal force opposing $\\vec F$. Newton's second law in the horizontal direction gives $a = F/(m_A+m_B)$, which is nonzero for any nonzero $F$ — no matter how small. The weight acts vertically and is fully balanced by the normal forces, so comparing $F$ to the total weight is irrelevant; the crates accelerate to the right regardless." },
      hw4_p6c: { answerType: "text", answer: "Two action–reaction pairs link the box and the truck. (1) The normal force the bed exerts $\\textit{up}$ on the box (in the box diagram) and the normal force the box exerts $\\textit{down}$ on the bed (in the truck diagram). (2) The friction force the bed exerts $\\textit{forward}$ on the box (the given blue arrow in the box diagram) and the friction force the box exerts $\\textit{backward}$ on the bed (the blue arrow in the truck diagram). Each pair is equal in magnitude, opposite in direction, and acts on two different bodies. The truck's weight, the road's normal force, and the road's traction force each have their third-law partners on bodies not drawn here (the earth and the road), so they are not pairs within these two diagrams." },
      hw4_p7a_m: { answerType: "numeric", answer: 16.603, sigFigs: 3, unit: "N" },
      hw4_p7a_d: { answerType: "text", answer: "Straight in the $-y$-direction (perpendicular to the intended direction of motion). For the cart to move along $+x$, the net $y$-component of force must be zero. The adults give a net $y$-component of $F_1\\sin 60° - F_2\\sin 30° = 86.6\\text{ N} - 70.0\\text{ N} = +16.6\\text{ N}$, so the child must supply $16.6\\text{ N}$ in the $-y$-direction to cancel it. Pushing purely along $-y$ (adding no unneeded $x$-component) makes the child's force as small as possible — its $x$-component is already in the desired direction and need not be opposed." },
      hw4_p7b: { answerType: "numeric", answer: 839.950, sigFigs: 3, unit: "N" },
      hw4_p8a: { answerType: "numeric", answer: 0.0022222, sigFigs: 2, unit: "m/s²" },
      hw4_p8b: { answerType: "numeric", answer: 0.16667, sigFigs: 2, unit: "m/s" },
      hw4_p8c: { answerType: "text", answer: "The ship does reach the reef: even decelerating the whole 500 m, its speed only drops from $1.5\\text{ m/s}$ to about $0.17\\text{ m/s}$ (it never reaches zero over that distance), so it is still moving when it arrives and strikes the reef. However, $0.17\\text{ m/s}$ is less than the $0.2\\text{ m/s}$ the hull can withstand, so the impact does not breach the hull — the oil is safe." },
      hw4_p9a: { answerType: "numeric", answer: 4340.3, sigFigs: 2, unit: "m/s²" },
      hw4_p9b: { answerType: "numeric", answer: 3689236, sigFigs: 2, unit: "N" },
      hw4_p10a: { answerType: "numeric", answer: 1.50, sigFigs: 3, unit: "m/s²" },
      hw4_p10d: { answerType: "numeric", answer: 4.33213, sigFigs: 3, unit: "kg" },
      hw4_p10e: { answerType: "numeric", answer: 5.29483, sigFigs: 3, unit: "kg" },
    },
  },
  physics2: {
    // Y&F Ch. 21. Every value independently re-derived (see docs/courses/phy215.md § Verification);
    // constants k = 8.9876e9, e = 1.602176634e-19, m_e = 9.109e-31, m_p = 1.673e-27, g = 9.81.
    // `sci: true` renders the revealed answer in scientific notation (E&M magnitudes would
    // otherwise print as twenty-digit integers or long strings of leading zeros).
    hw1: {
      // 21.2 — lightning
      hw1_p1a: { answerType: "numeric", answer: 2.0, sigFigs: 2, unit: "C" },
      hw1_p1b: { answerType: "numeric", answer: 1.2483018e19, sigFigs: 3, unit: "electrons", sci: true },
      // 21.9 — Coulomb's law solved for q  (q = r√(4πε₀F); the "4q and q" case halves it)
      hw1_p2a: { answerType: "numeric", answer: 0.7421333, sigFigs: 3, unit: "μC" },
      hw1_p2b_small: { answerType: "numeric", answer: 0.3710666, sigFigs: 3, unit: "μC" },
      hw1_p2b_large: { answerType: "numeric", answer: 1.4842665, sigFigs: 3, unit: "μC" },
      // 21.22 — 5.393 μN toward +x from q₁, 2.996 μN toward −x from q₂
      hw1_p3_m: { answerType: "numeric", answer: 2.396680, sigFigs: 3, unit: "μN" },
      hw1_p3_d: { answerType: "text", answer: "In the $+x$-direction (toward $q_1$). Both charges attract $q_3$ because $q_3$ is negative and both are positive, so $q_1$ pulls it toward $+x$ and $q_2$ pulls it toward $-x$. The pull from $q_1$ is stronger ($5.39\\ \\mu\\text{N}$ vs. $3.00\\ \\mu\\text{N}$) because it is closer ($0.200\\text{ m}$ vs. $0.300\\text{ m}$), and distance matters more than the slightly larger $q_2$, so the net force points toward $q_1$ along $+x$." },
      // 21.30 — magnitude in terms of q and a (the direction is the `vector` part, graded client-side)
      hw1_p4_m: { answerType: "math", answer: "\\frac{\\sqrt{2}\\,q}{\\pi \\epsilon_0 a^2}" },
      // 21.33 — parallel plates
      hw1_p5a: { answerType: "numeric", answer: 363.8803, sigFigs: 3, unit: "N/C" },
      hw1_p5b_y: { answerType: "numeric", answer: 2.723085, sigFigs: 3, unit: "μm" },
      hw1_p5b_d: { answerType: "text", answer: "No — the proton does not hit a plate. Its deflection is only about $2.72\\ \\mu\\text{m}$, far less than the $0.500\\text{ cm}$ available to it, so it exits the region between the plates. It is deflected **downward**, toward the lower plate: the proton's charge is positive, so the electric force $q\\vec E$ on it is in the same direction as $\\vec E$, which points vertically downward." },
      hw1_p5c: { answerType: "text", answer: "Both particles follow parabolic paths, because each feels a constant transverse force while its horizontal velocity stays constant — the same mathematics as projectile motion. The differences are direction and size. The electron is deflected **upward** (its charge is negative, so the force is opposite $\\vec E$) while the proton is deflected **downward** (positive charge, force along $\\vec E$). The electron's deflection is enormously larger: both particles feel the same magnitude of force $eE$, but $a = F/m$ and the proton is about $1840$ times more massive, so its acceleration and hence its deflection are smaller by that factor — $0.500\\text{ cm}$ for the electron versus about $2.72\\ \\mu\\text{m}$ for the proton." },
      hw1_p5d: { answerType: "text", answer: "Yes, ignoring gravity is entirely reasonable for both particles. The electric acceleration of the electron is $6.40\\times10^{13}\\text{ m/s}^2$ and that of the proton is $3.49\\times10^{10}\\text{ m/s}^2$, whereas $g = 9.81\\text{ m/s}^2$. Gravity is therefore smaller than the electric effect by a factor of roughly $10^{13}$ for the electron and $10^{9}$ for the proton — utterly negligible in both cases, though (relatively speaking) least negligible for the heavier proton." },
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
      hw1_p8: { answerType: "text", answer: "**3:30.** Pair each numeral $n$ with the numeral $n+6$ directly opposite it. The two charges of a pair produce fields at the center along the same line but in opposite senses, so the pair's net field has a magnitude set by the difference of the charges — and that difference is $6q$ for *every* pair ($7-1 = 8-2 = 9-3 = 10-4 = 11-5 = 12-6 = 6$). Because the larger charge is always the higher numeral, each pair's net field points toward the *smaller* numeral, i.e. toward the numerals $1, 2, 3, 4, 5, 6$. These six contributions are equal in magnitude and their directions are symmetric about the direction of the $3{:}30$ mark (halfway between the 3 and the 4), so all the perpendicular components cancel and the resultant points exactly at that mark. The hour hand points there at **3:30**." },
      // 21.73 — E = mg·tan(17.4°)/|q|
      hw1_p9_m: { answerType: "numeric", answer: 34066.21, sigFigs: 3, unit: "N/C", sci: true },
      hw1_p9_d: { answerType: "text", answer: "The field is **horizontal, pointing toward the wall** (in the direction from the ball back toward the wall). The string hangs away from the wall, so the horizontal electric force on the ball must push it *away* from the wall. But the ball's charge is negative, so the force $q\\vec E$ is directed **opposite** to $\\vec E$. Therefore $\\vec E$ itself points in the opposite direction to that force — that is, horizontally back toward the wall." },
      // 21.87 — symbolic then numeric ("upside-down projectile" with a = eE/m_p upward)
      hw1_p10a: { answerType: "math", answer: "h_{max} = \\frac{m_p v_0^2 \\sin^2\\alpha}{2eE}" },
      hw1_p10b: { answerType: "math", answer: "d = \\frac{m_p v_0^2 \\sin 2\\alpha}{eE}" },
      hw1_p10c_h: { answerType: "numeric", answer: 0.4175874, sigFigs: 3, unit: "m" },
      hw1_p10c_d: { answerType: "numeric", answer: 2.893130, sigFigs: 3, unit: "m" },
    },
  },
};

// Look up a single item's answer-key entry. Returns null if missing.
export function lookupAnswer(courseType, hwId, itemId) {
  return ANSWER_KEYS?.[courseType]?.[hwId]?.[itemId] || null;
}
