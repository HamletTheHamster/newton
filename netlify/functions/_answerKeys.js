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
      hw2_p5a: { answerType: "numeric", answer: 2.94, sigFigs: 3, unit: "m/s" },
      hw2_p5b: { answerType: "numeric", answer: 0.600, sigFigs: 3, unit: "s" },
      hw2_p6: { answerType: "numeric", answer: 1796, sigFigs: 3, unit: "m" },
      hw2_p7a1: { answerType: "numeric", answer: 5.60, sigFigs: 3, unit: "m/s" },
      hw2_p7a2: { answerType: "numeric", answer: 7.20, sigFigs: 3, unit: "m/s" },
      hw2_p7a3: { answerType: "numeric", answer: 8.80, sigFigs: 3, unit: "m/s" },
      hw2_p7b: { answerType: "numeric", answer: 0.800, sigFigs: 3, unit: "m/s²" },
      hw2_p7c: { answerType: "numeric", answer: 4.80, sigFigs: 3, unit: "m/s" },
      hw2_p7d: { answerType: "numeric", answer: 6.00, sigFigs: 3, unit: "s" },
      hw2_p7e: { answerType: "numeric", answer: 25.6, sigFigs: 3, unit: "m" },
      hw2_p8: { answerType: "numeric", answer: 50, sigFigs: 2, unit: "m" },
      hw2_p9: { answerType: "numeric", answer: 3.60, sigFigs: 3, unit: "m" },
      hw2_p10a: { answerType: "numeric", answer: 2.64, sigFigs: 3, unit: "× H" },
      hw2_p10b: { answerType: "numeric", answer: 2.64, sigFigs: 3, unit: "× T" },
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
      hw3_p4: { answerType: "numeric", answer: 1.2865, sigFigs: 3, unit: "m/s²" },
      hw3_p5a_x: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5a_y: { answerType: "numeric", answer: 43.301, sigFigs: 3, unit: "m/s" },
      hw3_p5b: { answerType: "numeric", answer: 4.4185, sigFigs: 3, unit: "s" },
      hw3_p5c: { answerType: "numeric", answer: 95.663, sigFigs: 3, unit: "m" },
      hw3_p5d: { answerType: "numeric", answer: 220.92, sigFigs: 3, unit: "m" },
      hw3_p5e_ax: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s²" },
      hw3_p5e_ay: { answerType: "numeric", answer: -9.80, sigFigs: 3, unit: "m/s²" },
      hw3_p5e_vx: { answerType: "numeric", answer: 25.0, sigFigs: 3, unit: "m/s" },
      hw3_p5e_vy: { answerType: "numeric", answer: 0, sigFigs: 1, unit: "m/s" },
      hw3_p6a: { answerType: "numeric", answer: 53.130, sigFigs: 3, unit: "°" },
      hw3_p6b_s: { answerType: "numeric", answer: 15.0, sigFigs: 3, unit: "m/s" },
      hw3_p6b_a: { answerType: "numeric", answer: 9.80, sigFigs: 3, unit: "m/s²" },
      hw3_p6c_h: { answerType: "numeric", answer: 15.90, sigFigs: 3, unit: "m" },
      hw3_p6c_s: { answerType: "numeric", answer: 17.702, sigFigs: 3, unit: "m/s" },
      hw3_p7a_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²" },
      hw3_p7a_d: { answerType: "text", answer: "Upward — directed toward the center of the wheel (the centripetal direction). Because the speed is constant there is no tangential acceleration, so the acceleration is purely radial." },
      hw3_p7b_m: { answerType: "numeric", answer: 3.50, sigFigs: 3, unit: "m/s²" },
      hw3_p7b_d: { answerType: "text", answer: "Downward — directed toward the center of the wheel. The magnitude is the same as at the lowest point; only the direction (toward the center) has changed." },
      hw3_p7c: { answerType: "numeric", answer: 12.566, sigFigs: 3, unit: "s" },
      hw3_p8: { answerType: "numeric", answer: 30.99, sigFigs: 2, unit: "m/s" },
      hw3_p9a: { answerType: "numeric", answer: 32.643, sigFigs: 3, unit: "m/s" },
      hw3_p9b: { answerType: "text", answer: "Essentially zero — the shell lands right at the edge. With the minimum muzzle velocity from part (a), the trajectory's peak height is only about $25.3\\text{ m}$, just barely above the $25.0\\text{-m}$ cliff, and that peak occurs at a horizontal distance of about $54\\text{ m}$ — before the cliff edge at $60.0\\text{ m}$. So the shell is already descending as it reaches the edge: it passes back down through the $25.0\\text{-m}$ height essentially at the edge itself (at $x \\approx 60.0\\text{ m}$). It therefore lands at (to within rounding, $0\\text{ m}$ beyond) the edge of the cliff." },
      hw3_p10a: { answerType: "numeric", answer: 1.5004, sigFigs: 3, unit: "m/s" },
      hw3_p10b: { answerType: "numeric", answer: 4.656, sigFigs: 3, unit: "m" },
    },
    hw4: {
      hw4_p1a: { answerType: "numeric", answer: 69.282, sigFigs: 3, unit: "N" },
      hw4_p1b: { answerType: "numeric", answer: 34.641, sigFigs: 3, unit: "N" },
      hw4_p2a: { answerType: "numeric", answer: 4.3077, sigFigs: 3, unit: "m/s²" },
      hw4_p2b: { answerType: "numeric", answer: 215.38, sigFigs: 3, unit: "m" },
      hw4_p2c: { answerType: "numeric", answer: 43.077, sigFigs: 3, unit: "m/s" },
      hw4_p3a: { answerType: "numeric", answer: 4.4898, sigFigs: 3, unit: "kg" },
      hw4_p3b_m: { answerType: "numeric", answer: 4.4898, sigFigs: 3, unit: "kg" },
      hw4_p3b_w: { answerType: "numeric", answer: 8.1266, sigFigs: 3, unit: "N" },
      hw4_p4: { answerType: "numeric", answer: 20, sigFigs: 2, unit: "N" },
      hw4_p5a_pairs: { answerType: "text", answer: "The contact forces between the crates form the only action–reaction pair shown: $\\vec F_{A\\,\\text{on}\\,B}$ (A pushing B to the right) and $\\vec F_{B\\,\\text{on}\\,A}$ (B pushing A to the left). They are equal in magnitude, opposite in direction, and act on different bodies. The applied force $\\vec F$, the weights, and the normal forces each have their third-law partners on bodies not drawn here (the hand/agent applying $\\vec F$, the earth, and the floor), so they are not pairs within these two diagrams." },
      hw4_p5b: { answerType: "text", answer: "Yes. The surface is frictionless, so there is no horizontal force opposing $\\vec F$. Newton's second law in the horizontal direction gives $a = F/(m_A+m_B)$, which is nonzero for any nonzero $F$ — no matter how small. The weight acts vertically and is fully balanced by the normal forces, so comparing $F$ to the total weight is irrelevant; the crates accelerate to the right regardless." },
      hw4_p6c: { answerType: "text", answer: "Two action–reaction pairs link the box and the truck. (1) The normal force the bed exerts $\\textit{up}$ on the box (in the box diagram) and the normal force the box exerts $\\textit{down}$ on the bed (in the truck diagram). (2) The friction force the bed exerts $\\textit{forward}$ on the box (the given blue arrow in the box diagram) and the friction force the box exerts $\\textit{backward}$ on the bed (the blue arrow in the truck diagram). Each pair is equal in magnitude, opposite in direction, and acts on two different bodies. The truck's weight, the road's normal force, and the road's traction force each have their third-law partners on bodies not drawn here (the earth and the road), so they are not pairs within these two diagrams." },
      hw4_p7a_m: { answerType: "numeric", answer: 16.603, sigFigs: 3, unit: "N" },
      hw4_p7a_d: { answerType: "text", answer: "Straight in the $-y$-direction (perpendicular to the intended direction of motion). For the cart to move along $+x$, the net $y$-component of force must be zero. The adults give a net $y$-component of $F_1\\sin 60° - F_2\\sin 30° = 86.6\\text{ N} - 70.0\\text{ N} = +16.6\\text{ N}$, so the child must supply $16.6\\text{ N}$ in the $-y$-direction to cancel it. Pushing purely along $-y$ (adding no unneeded $x$-component) makes the child's force as small as possible — its $x$-component is already in the desired direction and need not be opposed." },
      hw4_p7b: { answerType: "numeric", answer: 839.09, sigFigs: 3, unit: "N" },
      hw4_p8a: { answerType: "numeric", answer: 0.0022222, sigFigs: 2, unit: "m/s²" },
      hw4_p8b: { answerType: "numeric", answer: 0.16667, sigFigs: 2, unit: "m/s" },
      hw4_p8c: { answerType: "text", answer: "The ship does reach the reef: even decelerating the whole 500 m, its speed only drops from $1.5\\text{ m/s}$ to about $0.17\\text{ m/s}$ (it never reaches zero over that distance), so it is still moving when it arrives and strikes the reef. However, $0.17\\text{ m/s}$ is less than the $0.2\\text{ m/s}$ the hull can withstand, so the impact does not breach the hull — the oil is safe." },
      hw4_p9a: { answerType: "numeric", answer: 4340.3, sigFigs: 2, unit: "m/s²" },
      hw4_p9b: { answerType: "numeric", answer: 3689236, sigFigs: 2, unit: "N" },
      hw4_p10a: { answerType: "numeric", answer: 1.50, sigFigs: 3, unit: "m/s²" },
      hw4_p10d: { answerType: "numeric", answer: 4.3373, sigFigs: 3, unit: "kg" },
      hw4_p10e: { answerType: "numeric", answer: 5.3012, sigFigs: 3, unit: "kg" },
    },
  },
  physics2: {},
};

// Look up a single item's answer-key entry. Returns null if missing.
export function lookupAnswer(courseType, hwId, itemId) {
  return ANSWER_KEYS?.[courseType]?.[hwId]?.[itemId] || null;
}
