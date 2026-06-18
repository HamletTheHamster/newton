// Quizzes for Physics 1 — the canonical authored quiz content.
// Module structure below (MODULES_PHYSICS1) references quizzes by `refId` (q1..qN).
export const QUIZZES_PHYSICS1 = [
  { id: "q1", title: "Quiz 1: Course Access", questions: [{ id: "q1_1", text: "Do you have access to the course textbook (digital or physical)?", yesNo: true }, { id: "q1_2", text: "Can you access the online homework assignments?", yesNo: true }] },
  { id: "q2", title: "Quiz 2: Vectors & Measurements", questions: [{ id: "q2_1", text: "What is the difference between precision and accuracy?" }, { id: "q2_2", text: "What is a vector component?" }, { id: "q2_3", text: "Complete the sentence by dragging the correct words into the blanks:", displaySentence: "A dot product results in a ___, a cross product results in a ___.", blanksLabel: ["dot product →", "cross product →"], wordBank: ["scalar", "vector"], correctBlanks: ["scalar", "vector"], dragDrop: true }] },
  { id: "q3", title: "Quiz 3: Motion Graphs", questions: [{ id: "q3_1", requiresImage: true, formatLabel: "PNG, JPG, WEBP, or GIF", acceptedFormats: ["image/png", "image/jpeg", "image/webp", "image/gif"], text: "Draw the position, velocity, and acceleration plots that describe the following motion, then upload a photo or image of your drawing:\n\nI start at rest at the origin. I then walk forward (+ direction) slowly for 2 seconds. Then I stop for 1 second. Then I walk backward (− direction) twice as fast for 2 seconds. Then I stop again for 2 seconds. Finally, I walk forward again for 2 seconds, increasing my speed with constant acceleration until I reach my starting position at the origin." }] },
  { id: "q4", title: "Quiz 4: Projectile Motion", questions: [{ id: "q4_1", text: "An apple is tossed straight up into the air and then caught again as it falls straight back down. At the highest point in its trajectory, what is its speed (the magnitude of its velocity)?" }, { id: "q4_2", text: "A projectile is at the highest point in its trajectory and its vertical speed is momentarily zero. What is the magnitude of its acceleration?" }] },
  { id: "q5", title: "Quiz 5: Newton's Laws", questions: [{ id: "q5_1", text: "In the demonstration video about inertia and Newton's 1st law (https://www.youtube.com/watch?v=EsfKfNKSoMc&list=PL_f0JvBJjSPYL1GInMLlWZmlEA8wAd-Dd&index=20), why does the string lift the mug when I pull slowly but not when I pull rapidly?" }, { id: "q5_2", text: "If every force has an equal and opposite reaction force according to Newton's 3rd law, why does anything move at all? In other words, if every force is being \"countered\" with an equal and opposite force, why don't they just cancel each other out and result in nothing happening?" }] },
  { id: "q6", title: "Quiz 6: Friction & Normal Force", questions: [{ id: "q6_1", text: "Is the normal force of an object resting on a surface always equal to its weight? If not, when is it not and what is it equal to instead?" }, { id: "q6_2", text: "Why is the static friction force, fₛ ≤ μₛN, stated as being less than or equal to μₛN instead of just equal to?" }] },
  { id: "q7", title: "Quiz 7: Work", questions: [{ id: "q7_1", text: "A nonzero force is applied to a moving block. Describe the relationship between the force vector and the velocity vector for three scenarios: (a) the force does positive work on the block, (b) the force does negative work on the block, and (c) the force does zero work on the block." }, { id: "q7_2", text: "The sign of many physical quantities depends on the choice of coordinates. For example, aᵧ for free-fall motion can be negative or positive, depending on whether we choose upward or downward as positive. Is the same thing true of work? In other words, can we make positive work negative by a different choice of coordinates? Explain." }] },
  { id: "q8", title: "Quiz 8: Energy", questions: [{ id: "q8_1", text: "An object is released from rest at the top of a ramp. If the ramp is frictionless, does the object's speed at the bottom depend on the shape of the ramp or just on its height? Explain. What if the ramp is not frictionless?" }, { id: "q8_2", text: "Watch this demonstration: https://youtu.be/sJG-rXBbmCc?t=1414 and tell me why, in terms of energy, is it extremely important that he does not give the ball even the slightest push when releasing it." }] },
  { id: "q9", title: "Quiz 9: Momentum", questions: [{ id: "q9_1", text: "Suppose you catch a baseball and then someone invites you to catch a bowling ball with either the same momentum or the same kinetic energy as the baseball. Which would you choose and why?" }, { id: "q9_2", text: "(a) When a larger car collides with a small car, which one undergoes the greater change in momentum: the large one or the small one? Or is it the same for both?\n\n(b) In light of your answer to part (a), why are the occupants of the small car more likely to be hurt than those of the large car, assuming both cars are equally sturdy?" }] },
  { id: "q10", title: "Quiz 10: Moment of Inertia", questions: [{ id: "q10_1", text: "Rank the following objects by increasing moment of inertia: a solid sphere, a hollow cylinder of large radius, a solid cylinder, a hollow sphere, and a hollow cylinder of small radius." }, { id: "q10_2", text: "Watch this video:\n\nhttps://www.youtube.com/watch?v=lvfzdibrUFA\n\nWhich object finishes 1st, 2nd, 3rd, 4th, and 5th in this race?" }, { id: "q10_3", text: "Why does having a small moment of inertia make an object roll down a ramp faster? Explain in terms of energy." }] },
  { id: "q11", title: "Quiz 11: Torque & Work", questions: [{ id: "q11_1", text: "Suppose you could use wheels of any type in the design of a soapbox-derby racer (an unpowered, four-wheel vehicle that coasts from rest down a hill). To conform to the rules on the total weight of the vehicle and rider, should you design your soapbox-derby car with large massive wheels or small light wheels? Should you use solid wheels or wheels with most of the mass at the rim? Explain." }, { id: "q11_2", text: "The work done by a force is the product of force and distance. The torque due to a force is the product of force and distance. Does this mean that torque and work are equivalent? Explain." }] },
  { id: "q12", title: "Quiz 12: Statics", questions: [{ id: "q12_1", text: "Why is a tapered water glass with a narrow base easier to tip over than a glass with straight sides? Does it matter whether the glass is empty or full?" }, { id: "q12_2", text: "Does the center of gravity of a solid body always lie within the material of the body? If not, give a counterexample." }] },
  { id: "q13", title: "Quiz 13: Fluids", questions: [{ id: "q13_1", text: "Why do big heavy cargo ships float in water?" }, { id: "q13_2", text: "How do airplane wings generate lift to keep the plane in the air?" }] },
  { id: "q14", title: "Quiz 14: Gravitation", questions: [{ id: "q14_1", text: "A student wrote: \"The only reason an apple falls downward to meet the earth instead of the earth rising upward to meet the apple is that the earth is much more massive and so exerts a much greater pull.\" Please comment." }, { id: "q14_2", text: "As defined in lecture 7, gravitational potential energy is U = mgy (positive above Earth's surface). But in this lecture, gravitational potential energy is U = −GmₑM/r (negative above Earth's surface). How can you reconcile these seemingly incompatible descriptions of gravitational potential energy?" }] },
];

// Module structure — topic-titled, weekly. Each module has the same 4-item template:
// quiz, reading, lecture notes, homework. Phase 1: quiz items wire to QUIZZES_PHYSICS1
// via refId; the other item types are visible placeholders ("Coming soon") that will
// gain real content in later phases.
//
// Module shape:
//   { id, title, items: [
//       { type: 'quiz',     refId: 'q1' },                  // → QUIZZES_PHYSICS1
//       { type: 'reading',  title, url? },
//       { type: 'notes',    title, url? },
//       { type: 'homework', refId: 'hw1' },                 // → future HOMEWORKS_PHYSICS1
//   ] }
const M = (n, topic) => ({
  id: `m${n}`,
  title: `Lecture ${n} | ${topic}`,
  items: [
    { type: "quiz",     refId: `q${n}` },
    { type: "file",     title: `Assigned Reading: Ch. ${n} — ${topic}`, uploadId: null },
    { type: "file",     title: `Lecture ${n} Notes — ${topic}`, uploadId: null },
    { type: "homework", refId: `hw${n}` },
  ],
});

export const MODULES_PHYSICS1 = [
  M(1, "Course Access & Logistics"),
  M(2, "Vectors & Measurements"),
  M(3, "Motion Graphs"),
  M(4, "Projectile Motion"),
  M(5, "Newton's Laws"),
  M(6, "Friction & Normal Force"),
  M(7, "Work"),
  M(8, "Energy"),
  M(9, "Momentum"),
  M(10, "Moment of Inertia"),
  M(11, "Torque & Work"),
  M(12, "Statics"),
  M(13, "Fluids"),
  M(14, "Gravitation"),
];

// Homework assignments — MasteringPhysics-style problem sets. Module items reference
// these by `refId` (hw1..hwN). Each homework has `problems`; each problem is worth 1 point
// (multipart `parts` split that point equally). `answerType` ∈ { numeric, text, math }.
//
// Problem shape:
//   { id, prompt, figure?, answerType, answer,
//     unit?, sigFigs?, tolerance?,                 // numeric options
//     parts?: [{ id, prompt, answerType, answer, ... }] }   // multipart
//
// - numeric: graded deterministically within ±2% (sig figs not penalized; correct answer
//   shown in its proper sig figs on reveal).
// - text:    graded generously by Claude.
// - math:    LaTeX, graded by Claude for math/vector equivalence.
export const HOMEWORKS_PHYSICS1 = [
  {
    id: "hw1",
    title: "Homework 1: Units & Vectors",
    problems: [
      // 1.10 — unit conversions
      {
        id: "hw1_p1",
        prompt: "The following conversions occur frequently in physics and are very useful.",
        parts: [
          { id: "hw1_p1a", prompt: "(a) Use $1\\text{ mi} = 5280\\text{ ft}$ and $1\\text{ h} = 3600\\text{ s}$ to convert $60\\text{ mph}$ to units of ft/s.", answerType: "numeric", answer: 88, unit: "ft/s" },
          { id: "hw1_p1b", prompt: "(b) The acceleration of a freely falling object is $32\\text{ ft/s}^2$. Use $1\\text{ ft} = 30.48\\text{ cm}$ to express this acceleration in units of m/s².", answerType: "numeric", answer: 9.75, unit: "m/s²" },
          { id: "hw1_p1c", prompt: "(c) The density of water is $1.0\\text{ g/cm}^3$. Convert this density to units of kg/m³.", answerType: "numeric", answer: 1000, unit: "kg/m³" },
        ],
      },
      // 1.33 — component from magnitude/angle
      {
        id: "hw1_p2",
        prompt: "Vector $\\vec{A}$ has $y$-component $A_y = +13.0\\text{ m}$. $\\vec{A}$ makes an angle of $32.0°$ counterclockwise from the $+y$-axis.",
        parts: [
          { id: "hw1_p2a", prompt: "(a) What is the $x$-component of $\\vec{A}$?", answerType: "numeric", answer: -8.12, unit: "m" },
          { id: "hw1_p2b", prompt: "(b) What is the magnitude of $\\vec{A}$?", answerType: "numeric", answer: 15.3, unit: "m" },
        ],
      },
      // 1.35 — sums & differences from Fig E1.28
      {
        id: "hw1_p3",
        figure: "/homeworkFigures/HW1/figE1-28.png",
        prompt: "For the vectors $\\vec{A}$ and $\\vec{B}$ shown in the figure, use the method of components to find the magnitude and direction of each vector below. Give every direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p3a_m", prompt: "(a) Magnitude of the vector sum $\\vec{A}+\\vec{B}$.", answerType: "numeric", answer: 9.00, unit: "m" },
          { id: "hw1_p3a_d", prompt: "(a) Direction of $\\vec{A}+\\vec{B}$ (degrees CCW from $+x$).", answerType: "numeric", answer: 33.6, unit: "°" },
          { id: "hw1_p3b_m", prompt: "(b) Magnitude of the vector sum $\\vec{B}+\\vec{A}$.", answerType: "numeric", answer: 9.00, unit: "m" },
          { id: "hw1_p3b_d", prompt: "(b) Direction of $\\vec{B}+\\vec{A}$ (degrees CCW from $+x$).", answerType: "numeric", answer: 33.6, unit: "°" },
          { id: "hw1_p3c_m", prompt: "(c) Magnitude of the vector difference $\\vec{A}-\\vec{B}$.", answerType: "numeric", answer: 22.3, unit: "m" },
          { id: "hw1_p3c_d", prompt: "(c) Direction of $\\vec{A}-\\vec{B}$ (degrees CCW from $+x$).", answerType: "numeric", answer: 250, unit: "°" },
          { id: "hw1_p3d_m", prompt: "(d) Magnitude of the vector difference $\\vec{B}-\\vec{A}$.", answerType: "numeric", answer: 22.3, unit: "m" },
          { id: "hw1_p3d_d", prompt: "(d) Direction of $\\vec{B}-\\vec{A}$ (degrees CCW from $+x$).", answerType: "numeric", answer: 70.4, unit: "°" },
        ],
      },
      // 1.36 — magnitude/direction from components
      {
        id: "hw1_p4",
        prompt: "Find the magnitude and direction of the vector represented by each of the following pairs of components. Give every direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p4a_m", prompt: "(a) $A_x = -8.60\\text{ cm}$, $A_y = 5.20\\text{ cm}$ — magnitude.", answerType: "numeric", answer: 10.0, unit: "cm" },
          { id: "hw1_p4a_d", prompt: "(a) Direction (degrees CCW from $+x$).", answerType: "numeric", answer: 149, unit: "°" },
          { id: "hw1_p4b_m", prompt: "(b) $A_x = -9.70\\text{ m}$, $A_y = -2.45\\text{ m}$ — magnitude.", answerType: "numeric", answer: 10.0, unit: "m" },
          { id: "hw1_p4b_d", prompt: "(b) Direction (degrees CCW from $+x$).", answerType: "numeric", answer: 194, unit: "°" },
          { id: "hw1_p4c_m", prompt: "(c) $A_x = 7.75\\text{ km}$, $A_y = -2.70\\text{ km}$ — magnitude.", answerType: "numeric", answer: 8.21, unit: "km" },
          { id: "hw1_p4c_d", prompt: "(c) Direction (degrees CCW from $+x$).", answerType: "numeric", answer: 341, unit: "°" },
        ],
      },
      // 1.37 — resultant displacement
      {
        id: "hw1_p5",
        prompt: "A disoriented physics professor drives $3.25\\text{ km}$ north, then $2.90\\text{ km}$ west, and then $1.50\\text{ km}$ south. Find the magnitude and direction of the resultant displacement, using the method of components. Take east as the $+x$-direction and north as the $+y$-direction, and give the direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p5_m", prompt: "Magnitude of the resultant displacement.", answerType: "numeric", answer: 3.39, unit: "km" },
          { id: "hw1_p5_d", prompt: "Direction of the resultant displacement (degrees CCW from $+x$).", answerType: "numeric", answer: 149, unit: "°" },
        ],
      },
      // 1.51 — scalar & vector product from Fig E1.43
      {
        id: "hw1_p6",
        figure: "/homeworkFigures/HW1/figE1-43.png",
        prompt: "For the two vectors $\\vec{A}$ and $\\vec{B}$ shown in the figure, find the scalar product and the vector product.",
        parts: [
          { id: "hw1_p6a", prompt: "(a) Find the scalar product $\\vec{A}\\cdot\\vec{B}$ (in m²).", answerType: "numeric", answer: -6.6, unit: "m²" },
          { id: "hw1_p6b_m", prompt: "(b) Find the magnitude of the vector product $\\vec{A}\\times\\vec{B}$ (in m²).", answerType: "numeric", answer: 5.6, unit: "m²" },
          { id: "hw1_p6b_d", prompt: "(b) Using the right-hand rule, what is the direction of $\\vec{A}\\times\\vec{B}$?", answerType: "text", answer: "Out of the page — the +z-direction." },
        ],
      },
      // 1.53 — unit-vector arithmetic
      {
        id: "hw1_p7",
        prompt: "Given two vectors $\\vec{A} = -2.00\\,\\hat{\\imath} + 3.00\\,\\hat{\\jmath} + 4.00\\,\\hat{k}$ and $\\vec{B} = 3.00\\,\\hat{\\imath} + 1.00\\,\\hat{\\jmath} - 3.00\\,\\hat{k}$, do the following.",
        parts: [
          { id: "hw1_p7a_A", prompt: "(a) Find the magnitude of $\\vec{A}$.", answerType: "numeric", answer: 5.39 },
          { id: "hw1_p7a_B", prompt: "(a) Find the magnitude of $\\vec{B}$.", answerType: "numeric", answer: 4.36 },
          { id: "hw1_p7b", prompt: "(b) Write an expression for the vector difference $\\vec{A}-\\vec{B}$ using unit vectors.", answerType: "math", answer: "-5.00\\,\\hat{\\imath} + 2.00\\,\\hat{\\jmath} + 7.00\\,\\hat{k}" },
          { id: "hw1_p7c_m", prompt: "(c) Find the magnitude of the vector difference $\\vec{A}-\\vec{B}$.", answerType: "numeric", answer: 8.83 },
          { id: "hw1_p7c_e", prompt: "(c) Is this the same as the magnitude of $\\vec{B}-\\vec{A}$? Explain.", answerType: "text", answer: "Yes — the magnitudes are equal. Since $\\vec{B}-\\vec{A} = -(\\vec{A}-\\vec{B})$, the two difference vectors point in opposite directions but have the same length (8.83)." },
        ],
      },
      // 1.73 — dislocated shoulder (Fig P1.73)
      {
        id: "hw1_p8",
        figure: "/homeworkFigures/HW1/figP1-73.png",
        prompt: "Dislocated Shoulder. A patient with a dislocated shoulder is put into a traction apparatus as shown in the figure. The pulls $\\vec{A}$ and $\\vec{B}$ have equal magnitudes and must combine to produce an outward traction force of $5.60\\text{ N}$ on the patient's arm. How large should these pulls be?",
        answerType: "numeric",
        answer: 3.30,
        unit: "N",
      },
      // 1.87 — angle from scalar & vector product
      {
        id: "hw1_p9",
        prompt: "Vectors $\\vec{A}$ and $\\vec{B}$ have scalar product $-6.00$ and their vector product has magnitude $+9.00$. What is the angle between these two vectors?",
        answerType: "numeric",
        answer: 124,
        unit: "°",
      },
      // 1.89 — magnitude of vector product
      {
        id: "hw1_p10",
        prompt: "Vector $\\vec{A}$ has magnitude $12.0\\text{ m}$ and vector $\\vec{B}$ has magnitude $16.0\\text{ m}$. The scalar product $\\vec{A}\\cdot\\vec{B}$ is $90.0\\text{ m}^2$. What is the magnitude of the vector product between these two vectors?",
        answerType: "numeric",
        answer: 170,
        unit: "m²",
      },
    ],
  },
];
