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
//   { id, prompt, figure?, answerType,
//     unit?,                                       // numeric: shown next to the input field
//     graph?,                                      // graph option (see below)
//     vector?,                                     // vector option (see below)
//     parts?: [{ id, prompt, answerType, unit?, ... }] }   // multipart
//
// IMPORTANT — for numeric / text / math problems the ANSWER does NOT live here. Answers (and
// their sigFigs / tolerance) are stored server-side in netlify/functions/_answerKeys.js, keyed
// by hwId → itemId, and graded by netlify/functions/grade.js, so they are never shipped to the
// client. When authoring a new problem, put the prompt/figure/unit/configs here and the answer in
// _answerKeys.js (matching the item id). See docs/homework-roadmap.md § Authoring.
//
// - numeric: graded deterministically server-side within ±2% (sig figs not penalized; correct
//   answer shown in its proper sig figs on reveal). `unit` stays here for the input-field label.
// - text:    graded generously by Claude (server-side).
// - math:    LaTeX, graded by Claude for math/vector equivalence (server-side).
// - graph:   student sketches curves in GraphField; graded deterministically by gradeGraph.
//   Carries `graph: { xLabel,yLabel,xMin,xMax,yMin,yMax,xTick,yTick,
//                      curves:[{id,label,color}],
//                      key:{ [curveId]: { points:[[x,y],…], shape:"line"|"curveUp"|"curveDown", yTolFrac? } },
//                      snapDiv?, guide?:{ title, steps:[{ curve, minPoints?, shape?, label, note? }] } }`
//   instead of `answer`. Each keyed curve must span the key x-values, pass within tolerance
//   of every key point, and match the shape flag. The optional `guide` renders a checklist
//   beside the plot (steps tick off as points/shape are set) to scaffold tricky sketches.
// - vector:  student draws arrows from a common origin in VectorField; graded deterministically
//   by gradeVectors. Carries `vector: { xLabel?,yLabel?,xMin,xMax,yMin,yMax,xTick,yTick,
//                      origin?:[x,y], vectors:[{id,label,color}],
//                      key:{ [vecId]: { tip:[x,y], angleTol?:deg=15, magTol?:frac } },
//                      snapDiv?, hideTicks?, guide?:{ title, steps:[{ vector, label, note? }] } }`
//   instead of `answer`. Direction is always graded (within angleTol); magnitude is graded only
//   when the key gives magTol — so free-body diagrams (set hideTicks, omit magTol) grade on
//   direction alone, while scaled vectors (velocity components, etc.) also require the right length.
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
          { id: "hw1_p1a", prompt: "(a) Use $1\\text{ mi} = 5280\\text{ ft}$ and $1\\text{ h} = 3600\\text{ s}$ to convert $60\\text{ mph}$ to units of ft/s.", answerType: "numeric", unit: "ft/s" },
          { id: "hw1_p1b", prompt: "(b) The acceleration of a freely falling object is $32\\text{ ft/s}^2$. Use $1\\text{ ft} = 30.48\\text{ cm}$ to express this acceleration in units of m/s².", answerType: "numeric", unit: "m/s²" },
          { id: "hw1_p1c", prompt: "(c) The density of water is $1.0\\text{ g/cm}^3$. Convert this density to units of kg/m³.", answerType: "numeric", unit: "kg/m³" },
        ],
      },
      // 1.33 — component from magnitude/angle
      {
        id: "hw1_p2",
        prompt: "Vector $\\vec{A}$ has $y$-component $A_y = +13.0\\text{ m}$. $\\vec{A}$ makes an angle of $32.0°$ counterclockwise from the $+y$-axis.",
        parts: [
          { id: "hw1_p2a", prompt: "(a) What is the $x$-component of $\\vec{A}$?", answerType: "numeric", unit: "m" },
          { id: "hw1_p2b", prompt: "(b) What is the magnitude of $\\vec{A}$?", answerType: "numeric", unit: "m" },
        ],
      },
      // 1.35 — sums & differences from Fig E1.28
      {
        id: "hw1_p3",
        figure: "/homeworkFigures/HW1/figE1-28.png",
        prompt: "For the vectors $\\vec{A}$ and $\\vec{B}$ shown in the figure, use the method of components to find the magnitude and direction of each vector below. Give every direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p3a_m", prompt: "(a) Magnitude of the vector sum $\\vec{A}+\\vec{B}$.", answerType: "numeric", unit: "m" },
          { id: "hw1_p3a_d", prompt: "(a) Direction of $\\vec{A}+\\vec{B}$ (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          { id: "hw1_p3b_m", prompt: "(b) Magnitude of the vector sum $\\vec{B}+\\vec{A}$.", answerType: "numeric", unit: "m" },
          { id: "hw1_p3b_d", prompt: "(b) Direction of $\\vec{B}+\\vec{A}$ (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          { id: "hw1_p3c_m", prompt: "(c) Magnitude of the vector difference $\\vec{A}-\\vec{B}$.", answerType: "numeric", unit: "m" },
          { id: "hw1_p3c_d", prompt: "(c) Direction of $\\vec{A}-\\vec{B}$ (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          { id: "hw1_p3d_m", prompt: "(d) Magnitude of the vector difference $\\vec{B}-\\vec{A}$.", answerType: "numeric", unit: "m" },
          { id: "hw1_p3d_d", prompt: "(d) Direction of $\\vec{B}-\\vec{A}$ (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
        ],
      },
      // 1.36 — magnitude/direction from components
      {
        id: "hw1_p4",
        prompt: "Find the magnitude and direction of the vector represented by each of the following pairs of components. Give every direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p4a_m", prompt: "(a) $A_x = -8.60\\text{ cm}$, $A_y = 5.20\\text{ cm}$ — magnitude.", answerType: "numeric", unit: "cm" },
          { id: "hw1_p4a_d", prompt: "(a) Direction (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          { id: "hw1_p4b_m", prompt: "(b) $A_x = -9.70\\text{ m}$, $A_y = -2.45\\text{ m}$ — magnitude.", answerType: "numeric", unit: "m" },
          { id: "hw1_p4b_d", prompt: "(b) Direction (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          { id: "hw1_p4c_m", prompt: "(c) $A_x = 7.75\\text{ km}$, $A_y = -2.70\\text{ km}$ — magnitude.", answerType: "numeric", unit: "km" },
          { id: "hw1_p4c_d", prompt: "(c) Direction (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
        ],
      },
      // 1.37 — resultant displacement
      {
        id: "hw1_p5",
        prompt: "A disoriented physics professor drives $3.25\\text{ km}$ north, then $2.90\\text{ km}$ west, and then $1.50\\text{ km}$ south. Find the magnitude and direction of the resultant displacement, using the method of components. Take east as the $+x$-direction and north as the $+y$-direction, and give the direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw1_p5_m", prompt: "Magnitude of the resultant displacement.", answerType: "numeric", unit: "km" },
          { id: "hw1_p5_d", prompt: "Direction of the resultant displacement (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
        ],
      },
      // 1.51 — scalar & vector product from Fig E1.43
      {
        id: "hw1_p6",
        figure: "/homeworkFigures/HW1/figE1-43.png",
        prompt: "For the two vectors $\\vec{A}$ and $\\vec{B}$ shown in the figure, find the scalar product and the vector product.",
        parts: [
          { id: "hw1_p6a", prompt: "(a) Find the scalar product $\\vec{A}\\cdot\\vec{B}$ (in m²).", answerType: "numeric", unit: "m²" },
          { id: "hw1_p6b_m", prompt: "(b) Find the magnitude of the vector product $\\vec{A}\\times\\vec{B}$ (in m²).", answerType: "numeric", unit: "m²" },
          { id: "hw1_p6b_d", prompt: "(b) Using the right-hand rule, what is the direction of $\\vec{A}\\times\\vec{B}$?", answerType: "text" },
        ],
      },
      // 1.53 — unit-vector arithmetic
      {
        id: "hw1_p7",
        prompt: "Given two vectors $\\vec{A} = -2.00\\,\\hat{\\imath} + 3.00\\,\\hat{\\jmath} + 4.00\\,\\hat{k}$ and $\\vec{B} = 3.00\\,\\hat{\\imath} + 1.00\\,\\hat{\\jmath} - 3.00\\,\\hat{k}$, do the following.",
        parts: [
          { id: "hw1_p7a_A", prompt: "(a) Find the magnitude of $\\vec{A}$.", answerType: "numeric" },
          { id: "hw1_p7a_B", prompt: "(a) Find the magnitude of $\\vec{B}$.", answerType: "numeric" },
          { id: "hw1_p7b", prompt: "(b) Write an expression for the vector difference $\\vec{A}-\\vec{B}$ using unit vectors.", answerType: "math" },
          { id: "hw1_p7c_m", prompt: "(c) Find the magnitude of the vector difference $\\vec{A}-\\vec{B}$.", answerType: "numeric" },
          { id: "hw1_p7c_e", prompt: "(c) Is this the same as the magnitude of $\\vec{B}-\\vec{A}$? Explain.", answerType: "text" },
        ],
      },
      // 1.73 — dislocated shoulder (Fig P1.73)
      {
        id: "hw1_p8",
        figure: "/homeworkFigures/HW1/figP1-73.png",
        prompt: "Dislocated Shoulder. A patient with a dislocated shoulder is put into a traction apparatus as shown in the figure. The pulls $\\vec{A}$ and $\\vec{B}$ have equal magnitudes and must combine to produce an outward traction force of $5.60\\text{ N}$ on the patient's arm. How large should these pulls be?",
        answerType: "numeric",
        unit: "N",
      },
      // 1.87 — angle from scalar & vector product
      {
        id: "hw1_p9",
        prompt: "Vectors $\\vec{A}$ and $\\vec{B}$ have scalar product $-6.00$ and their vector product has magnitude $+9.00$. What is the angle between these two vectors?",
        answerType: "numeric",
        unit: "°",
      },
      // 1.89 — magnitude of vector product
      {
        id: "hw1_p10",
        prompt: "Vector $\\vec{A}$ has magnitude $12.0\\text{ m}$ and vector $\\vec{B}$ has magnitude $16.0\\text{ m}$. The scalar product $\\vec{A}\\cdot\\vec{B}$ is $90.0\\text{ m}^2$. What is the magnitude of the vector product between these two vectors?",
        answerType: "numeric",
        unit: "m²",
      },
    ],
  },
  {
    id: "hw2",
    title: "Homework 2: Motion Along a Straight Line",
    problems: [
      // 2.3 — Trip Home
      {
        id: "hw2_p1",
        prompt: "Trip Home. You normally drive on the freeway between San Diego and Los Angeles at an average speed of $105\\text{ km/h}$, and the trip takes $2\\text{ h}$ and $20\\text{ min}$. On a Friday afternoon, however, heavy traffic slows you down and you drive the same distance at an average speed of only $70\\text{ km/h}$. How much longer does the trip take?",
        answerType: "numeric",
        unit: "h",
      },
      // 2.16 — average acceleration over a 10.0-s interval
      {
        id: "hw2_p2",
        prompt: "An astronaut has left the International Space Station to test a new space scooter. Her partner measures the following velocity changes, each taking place in a $10.0\\text{-s}$ interval. For each case, take the positive direction (the $+x$-axis) to be toward the right. Give each average acceleration **with its algebraic sign** (a negative value means it points toward the left), then state its direction.",
        parts: [
          { id: "hw2_p2a_a", prompt: "(a) At the beginning of the interval she is moving toward the right at $15.0\\text{ m/s}$, and at the end she is moving toward the right at $5.0\\text{ m/s}$. Average acceleration ($+$ = right):", answerType: "numeric", unit: "m/s²" },
          { id: "hw2_p2a_d", prompt: "(a) In which direction does this average acceleration point?", answerType: "text" },
          { id: "hw2_p2b_a", prompt: "(b) At the beginning she is moving toward the left at $5.0\\text{ m/s}$, and at the end she is moving toward the left at $15.0\\text{ m/s}$. Average acceleration ($+$ = right):", answerType: "numeric", unit: "m/s²" },
          { id: "hw2_p2b_d", prompt: "(b) In which direction does this average acceleration point?", answerType: "text" },
          { id: "hw2_p2c_a", prompt: "(c) At the beginning she is moving toward the right at $15.0\\text{ m/s}$, and at the end she is moving toward the left at $15.0\\text{ m/s}$. Average acceleration ($+$ = right):", answerType: "numeric", unit: "m/s²" },
          { id: "hw2_p2c_d", prompt: "(c) In which direction does this average acceleration point?", answerType: "text" },
        ],
      },
      // 2.21 — A Fast Pitch
      {
        id: "hw2_p3",
        prompt: "A Fast Pitch. The fastest measured pitched baseball left the pitcher's hand at a speed of $45.0\\text{ m/s}$. If the pitcher was in contact with the ball over a distance of $1.50\\text{ m}$ and produced constant acceleration, do the following. Assume the ball starts from rest.",
        parts: [
          { id: "hw2_p3a", prompt: "(a) What acceleration did he give the ball?", answerType: "numeric", unit: "m/s²" },
          { id: "hw2_p3b", prompt: "(b) How much time did it take him to pitch it?", answerType: "numeric", unit: "s" },
        ],
      },
      // 2.34 — car overtakes truck at a traffic light (parts c/d are sketched in-app)
      {
        id: "hw2_p4",
        prompt: "At the instant the traffic light turns green, a car that has been waiting at an intersection starts ahead with a constant acceleration of $3.20\\text{ m/s}^2$. At the same instant a truck, traveling with a constant speed of $20.0\\text{ m/s}$, overtakes and passes the car. Take $x = 0$ at the intersection.",
        parts: [
          { id: "hw2_p4a", prompt: "(a) How far beyond its starting point does the car overtake the truck?", answerType: "numeric", unit: "m" },
          { id: "hw2_p4b", prompt: "(b) How fast is the car traveling when it overtakes the truck?", answerType: "numeric", unit: "m/s" },
          {
            id: "hw2_p4c",
            prompt: "(c) Sketch an $x$-$t$ graph of the motion of both vehicles, from $t = 0$ to the moment the car overtakes the truck. For each curve place a point at the start, at the point where they meet, and at least one point in between so its shape is clear; then set each curve to a straight line or a curve.",
            answerType: "graph",
            graph: {
              xLabel: "t (s)", yLabel: "x (m)",
              xMin: 0, xMax: 15, yMin: 0, yMax: 400, xTick: 5, yTick: 100,
              curves: [
                { id: "car", label: "Car", color: "#ef4444" },
                { id: "truck", label: "Truck", color: "#3b82f6" },
              ],
              key: {
                car:   { points: [[0, 0], [5, 40], [12.5, 250]], shape: "curveUp", yTolFrac: 0.12 },
                truck: { points: [[0, 0], [5, 100], [12.5, 250]], shape: "line", yTolFrac: 0.12 },
              },
              guide: {
                title: "How to plot it",
                steps: [
                  {
                    curve: "car", minPoints: 3, shape: "curveUp",
                    label: "start ($t=0$), an in-between point, and the overtake point; shape “Curve ↑”.",
                    note: "The car speeds up, so its x–t graph curves. For the in-between point, pick a time (say t = 5 s) and use x = ½at². For the overtake point, use the distance from part (a) at the catch-up time.",
                  },
                  {
                    curve: "truck", minPoints: 2, shape: "line",
                    label: "start ($t=0$) and the overtake point; straight line (constant velocity).",
                  },
                ],
              },
            },
          },
          {
            id: "hw2_p4d",
            prompt: "(d) Sketch a $v_x$-$t$ graph of the motion of both vehicles over the same interval. Place points and set each curve's shape as before.",
            answerType: "graph",
            graph: {
              xLabel: "t (s)", yLabel: "vₓ (m/s)",
              xMin: 0, xMax: 15, yMin: 0, yMax: 50, xTick: 5, yTick: 10,
              curves: [
                { id: "car", label: "Car", color: "#ef4444" },
                { id: "truck", label: "Truck", color: "#3b82f6" },
              ],
              key: {
                car:   { points: [[0, 0], [5, 16], [12.5, 40]], shape: "line", yTolFrac: 0.12 },
                truck: { points: [[0, 20], [5, 20], [12.5, 20]], shape: "line", yTolFrac: 0.12 },
              },
              guide: {
                title: "How to plot it",
                steps: [
                  {
                    curve: "car", minPoints: 2, shape: "line",
                    label: "from rest ($v=0$ at $t=0$) up to your part-(b) speed at the catch-up time; straight line.",
                    note: "Constant acceleration ⇒ a straight line on a v–t graph.",
                  },
                  {
                    curve: "truck", minPoints: 2, shape: "line",
                    label: "horizontal line at a constant $v = 20.0\\text{ m/s}$.",
                  },
                ],
              },
            },
          },
        ],
      },
      // 2.35 — flea jump (free fall)
      {
        id: "hw2_p5",
        prompt: "Use $g = 9.80\\text{ m/s}^2$ and neglect air resistance.",
        parts: [
          { id: "hw2_p5a", prompt: "(a) If a flea can jump straight up to a height of $0.440\\text{ m}$, what is its initial speed as it leaves the ground?", answerType: "numeric", unit: "m/s" },
          { id: "hw2_p5b", prompt: "(b) How long is it in the air?", answerType: "numeric", unit: "s" },
        ],
      },
      // 2.64 — subway train, three phases
      {
        id: "hw2_p6",
        prompt: "A subway train starts from rest at a station and accelerates at a rate of $1.60\\text{ m/s}^2$ for $14.0\\text{ s}$. It runs at constant speed for $70.0\\text{ s}$ and slows down at a rate of $3.50\\text{ m/s}^2$ until it stops at the next station. Find the total distance covered.",
        answerType: "numeric",
        unit: "m",
      },
      // 2.66 — sled with constant acceleration
      {
        id: "hw2_p7",
        prompt: "A sled starts from rest at the top of a hill and slides down with a constant acceleration. At some later time it is $14.4\\text{ m}$ from the top; $2.00\\text{ s}$ after that it is $25.6\\text{ m}$ from the top; $2.00\\text{ s}$ after that, $40.0\\text{ m}$ from the top; and $2.00\\text{ s}$ after that, $57.6\\text{ m}$ from the top.",
        parts: [
          { id: "hw2_p7a1", prompt: "(a) What is the magnitude of the average velocity of the sled during the first $2.00\\text{-s}$ interval after passing the $14.4\\text{-m}$ point (from $14.4\\text{ m}$ to $25.6\\text{ m}$)?", answerType: "numeric", unit: "m/s" },
          { id: "hw2_p7a2", prompt: "(a) Average velocity during the second $2.00\\text{-s}$ interval (from $25.6\\text{ m}$ to $40.0\\text{ m}$)?", answerType: "numeric", unit: "m/s" },
          { id: "hw2_p7a3", prompt: "(a) Average velocity during the third $2.00\\text{-s}$ interval (from $40.0\\text{ m}$ to $57.6\\text{ m}$)?", answerType: "numeric", unit: "m/s" },
          { id: "hw2_p7b", prompt: "(b) What is the acceleration of the sled?", answerType: "numeric", unit: "m/s²" },
          { id: "hw2_p7c", prompt: "(c) What is the speed of the sled as it passes the $14.4\\text{-m}$ point?", answerType: "numeric", unit: "m/s" },
          { id: "hw2_p7d", prompt: "(d) How much time did it take to go from the top to the $14.4\\text{-m}$ point?", answerType: "numeric", unit: "s" },
          { id: "hw2_p7e", prompt: "(e) How far did the sled go from the start (the top) during the first $2.00\\text{ s}$ after passing the $14.4\\text{-m}$ point?", answerType: "numeric", unit: "m" },
        ],
      },
      // 2.69 — ball rolls down a hill
      {
        id: "hw2_p8",
        prompt: "A ball starts from rest and rolls down a hill with uniform acceleration, traveling $150\\text{ m}$ during the second $5.0\\text{ s}$ of its motion. How far did it roll during the first $5.0\\text{ s}$ of motion?",
        answerType: "numeric",
        unit: "m",
      },
      // 2.80 — Egg Drop (Fig. P2.80)
      {
        id: "hw2_p9",
        figure: "/homeworkFigures/HW2/figP2-80.png",
        prompt: "Egg Drop. You are on the roof of the physics building, $46.0\\text{ m}$ above the ground (see figure). Your physics professor, who is $1.80\\text{ m}$ tall, is walking alongside the building at a constant speed of $1.20\\text{ m/s}$. If you wish to drop an egg on your professor's head, where should the professor be when you release the egg? Assume that the egg is in free fall ($g = 9.80\\text{ m/s}^2$). Give the professor's horizontal distance from the point directly below you (the egg's release point) at the moment of release.",
        answerType: "numeric",
        unit: "m",
      },
      // 2.81 — volcano on Mars vs. Earth
      {
        id: "hw2_p10",
        prompt: "A certain volcano on earth can eject rocks vertically to a maximum height $H$. The acceleration due to gravity on Mars is $3.71\\text{ m/s}^2$ (use $g = 9.80\\text{ m/s}^2$ on earth), and you can neglect air resistance on both planets. Give each answer as a numerical multiple of the earth quantity.",
        parts: [
          { id: "hw2_p10a", prompt: "(a) How high (in terms of $H$) would these rocks go if a volcano on Mars ejected them with the same initial velocity? Enter the numerical factor (height $= $ factor $\\times H$).", answerType: "numeric", unit: "× H" },
          { id: "hw2_p10b", prompt: "(b) If the rocks are in the air for a time $T$ on earth, for how long (in terms of $T$) will they be in the air on Mars? Enter the numerical factor (time $= $ factor $\\times T$).", answerType: "numeric", unit: "× T" },
        ],
      },
    ],
  },
  {
    id: "hw3",
    title: "Homework 3: Motion in Two Dimensions",
    problems: [
      // 3.1 — squirrel average velocity
      {
        id: "hw3_p1",
        prompt: "A squirrel has $x$- and $y$-coordinates $(1.1\\text{ m},\\ 3.4\\text{ m})$ at time $t_1 = 0$ and coordinates $(5.3\\text{ m},\\ -0.5\\text{ m})$ at time $t_2 = 3.0\\text{ s}$. For this time interval, find the average velocity. Give the direction as an angle measured counterclockwise from the $+x$-axis (between $0°$ and $360°$).",
        parts: [
          { id: "hw3_p1a_x", prompt: "(a) $x$-component of the average velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p1a_y", prompt: "(a) $y$-component of the average velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p1b_m", prompt: "(b) Magnitude of the average velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p1b_d", prompt: "(b) Direction of the average velocity (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
        ],
      },
      // 3.6 — dog, average acceleration over 10.0 s
      {
        id: "hw3_p2",
        prompt: "A dog running in an open field has components of velocity $v_x = 2.6\\text{ m/s}$ and $v_y = -1.8\\text{ m/s}$ at $t_1 = 10.0\\text{ s}$. For the time interval from $t_1 = 10.0\\text{ s}$ to $t_2 = 20.0\\text{ s}$, the average acceleration of the dog has magnitude $0.45\\text{ m/s}^2$ and direction $31.0°$ measured from the $+x$-axis toward the $+y$-axis. At $t_2 = 20.0\\text{ s}$, find the velocity of the dog. Give the direction as an angle measured counterclockwise from the $+x$-axis.",
        parts: [
          { id: "hw3_p2a_x", prompt: "(a) $x$-component of the velocity at $t_2$.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p2a_y", prompt: "(a) $y$-component of the velocity at $t_2$.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p2b_m", prompt: "(b) Magnitude of the velocity at $t_2$.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p2b_d", prompt: "(b) Direction of the velocity at $t_2$ (degrees CCW from $+x$).", answerType: "numeric", unit: "°" },
          {
            id: "hw3_p2c",
            prompt: "(c) Sketch the dog's velocity vectors at $t_1$ and $t_2$. Then draw the change in velocity for this interval $\\Delta\\vec v = \\vec v_2 - \\vec v_1$.",
            answerType: "vector",
            vector: {
              xLabel: "v_x (m/s)", yLabel: "v_y (m/s)",
              xMin: -2, xMax: 8, yMin: -4, yMax: 3, xTick: 2, yTick: 1, snapDiv: 100, // snapDiv 100 ⇒ 0.02 in x, 0.01 in y, so v₂ sits exactly at its components (6.5, 0.52); yMax 3 fits the origin-drawn Δv (tip ≈ (3.86, 2.32))
              origin: [0, 0],
              vectors: [
                { id: "v1", label: "v₁", color: "#3b82f6" },
                { id: "v2", label: "v₂", color: "#ef4444" },
                { id: "a", label: "Δv", color: "#10b981", freeTail: true },
              ],
              key: {
                v1: { tip: [2.6, -1.8], angleTol: 14, magTol: 0.2 },
                v2: { tip: [6.4573, 0.5177], angleTol: 14, magTol: 0.2 },
                // a ∥ Δv = v₂ − v₁ = (3.857, 2.318). Graded by (tip − tail), so the same arrow
                // works drawn from v₁'s tip to v₂'s tip OR from the origin. Key is the subtraction form.
                a:  { tail: [2.6, -1.8], tip: [6.4573, 0.5177], angleTol: 16, magTol: 0.25 },
              },
              // After the part resolves, auto-play the conceptual payoff: ten ā·(1 s) steps laid
              // tip-to-tail equal Δv and carry v₁ to v₂ (each step = Δv/10, derived from key.a).
              buildup: {
                vectorId: "a", count: 10, base: ["v1", "v2"],
                stepColor: "#eab308", runningColor: "#14b8a6",
                caption: "Watch the average acceleration transform the velocity second-by-second over the ten-second interval. Each second it adds $\\textcolor{#eab308}{\\vec{a}}$ to the velocity, and after ten seconds of this applied acceleration $\\textcolor{#3b82f6}{\\vec{v}_1}$ $\\textit{becomes}$ $\\textcolor{#ef4444}{\\vec{v}_2}$!",
              },
              guide: {
                title: "How to draw it",
                steps: [
                  { vector: "v1", label: "tip at $(v_x, v_y) = (2.6, -1.8)\\text{ m/s}$." },
                  { vector: "v2", label: "tip at the components you found in part (a)." },
                  { vector: "a", label: "$\\Delta\\vec v = \\vec v_2 - \\vec v_1$ — from the tip of $\\vec v_1$ to the tip of $\\vec v_2$." },
                ],
              },
            },
          },
        ],
      },
      // 3.11 — crickets jump from a cliff
      {
        id: "hw3_p3",
        prompt: "Two crickets, Chirpy and Milada, jump from the top of a vertical cliff. Chirpy just drops and reaches the ground in $3.50\\text{ s}$, while Milada jumps horizontally with an initial speed of $95.0\\text{ cm/s}$. How far from the base of the cliff will Milada hit the ground?",
        answerType: "numeric",
        unit: "m",
      },
      // 3.15 — starship on Planet X
      {
        id: "hw3_p4",
        prompt: "Inside a starship at rest on the earth, a ball rolls off the top of a horizontal table and lands a distance $D$ from the foot of the table. This starship now lands on the unexplored Planet X. The commander, Captain Curious, rolls the same ball off the same table with the same initial speed as on earth and finds that it lands a distance $2.76D$ from the foot of the table. What is the acceleration due to gravity on Planet X? (Use $g = 9.80\\text{ m/s}^2$ on earth.)",
        answerType: "numeric",
        unit: "m/s²",
      },
      // 3.16 — shell fired on level ground
      {
        id: "hw3_p5",
        prompt: "On level ground a shell is fired with an initial velocity of $50.0\\text{ m/s}$ at $60.0°$ above the horizontal and feels no appreciable air resistance. Use $g = 9.80\\text{ m/s}^2$.",
        parts: [
          { id: "hw3_p5a_x", prompt: "(a) Horizontal component of the shell's initial velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p5a_y", prompt: "(a) Vertical component of the shell's initial velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p5b", prompt: "(b) How long does it take the shell to reach its highest point?", answerType: "numeric", unit: "s" },
          { id: "hw3_p5c", prompt: "(c) Find its maximum height above the ground.", answerType: "numeric", unit: "m" },
          { id: "hw3_p5d", prompt: "(d) How far from its firing point does the shell land?", answerType: "numeric", unit: "m" },
          { id: "hw3_p5e_ax", prompt: "(e) At its highest point, find the horizontal component of its acceleration.", answerType: "numeric", unit: "m/s²" },
          { id: "hw3_p5e_ay", prompt: "(e) At its highest point, find the vertical component of its acceleration (take up as positive).", answerType: "numeric", unit: "m/s²" },
          { id: "hw3_p5e_vx", prompt: "(e) At its highest point, find the horizontal component of its velocity.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p5e_vy", prompt: "(e) At its highest point, find the vertical component of its velocity.", answerType: "numeric", unit: "m/s" },
        ],
      },
      // 3.22 — firemen's hose
      {
        id: "hw3_p6",
        prompt: "Firemen are shooting a stream of water at a burning building using a high-pressure hose that shoots the water with a speed of $25.0\\text{ m/s}$ as it leaves the end of the hose. Once it leaves the hose, the water moves in projectile motion. The firemen adjust the angle of elevation $\\alpha$ of the hose until the water takes $3.00\\text{ s}$ to reach a building $45.0\\text{ m}$ away. You can ignore air resistance; assume that the end of the hose is at ground level. Use $g = 9.80\\text{ m/s}^2$.",
        parts: [
          { id: "hw3_p6a", prompt: "(a) Find the angle of elevation $\\alpha$ (degrees above the horizontal).", answerType: "numeric", unit: "°" },
          { id: "hw3_p6b_s", prompt: "(b) Find the speed of the water at the highest point in its trajectory.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p6b_a", prompt: "(b) Find the magnitude of the water's acceleration at the highest point (its direction is straight down).", answerType: "numeric", unit: "m/s²" },
          { id: "hw3_p6c_h", prompt: "(c) How high above the ground does the water strike the building?", answerType: "numeric", unit: "m" },
          { id: "hw3_p6c_s", prompt: "(c) How fast is the water moving just before it hits the building?", answerType: "numeric", unit: "m/s" },
        ],
      },
      // 3.29 — Ferris wheel (uniform circular motion)
      {
        id: "hw3_p7",
        figure: "/homeworkFigures/HW3/figE3-29.png",
        prompt: "A Ferris wheel with radius $14.0\\text{ m}$ is turning about a horizontal axis through its center (see figure). The linear speed of a passenger on the rim is constant and equal to $7.00\\text{ m/s}$.",
        parts: [
          { id: "hw3_p7a_m", prompt: "(a) What is the magnitude of the passenger's acceleration as she passes through the lowest point in her circular motion?", answerType: "numeric", unit: "m/s²" },
          { id: "hw3_p7a_d", prompt: "(a) What is the direction of that acceleration?", answerType: "text" },
          { id: "hw3_p7b_m", prompt: "(b) What is the magnitude of the passenger's acceleration at the highest point in her circular motion?", answerType: "numeric", unit: "m/s²" },
          { id: "hw3_p7b_d", prompt: "(b) What is the direction of that acceleration?", answerType: "text" },
          { id: "hw3_p7c", prompt: "(c) How much time does it take the Ferris wheel to make one revolution?", answerType: "numeric", unit: "s" },
        ],
      },
      // 3.51 — monkey and hunter
      {
        id: "hw3_p8",
        prompt: "A jungle veterinarian with a blow-gun loaded with a tranquilizer dart and a sly $1.5\\text{-kg}$ monkey are each $25\\text{ m}$ above the ground in trees $70\\text{ m}$ apart. Just as the hunter shoots horizontally at the monkey, the monkey drops from the tree in a vain attempt to escape being hit. What must the minimum muzzle velocity of the dart have been for the hunter to have hit the monkey before it reached the ground? Use $g = 9.80\\text{ m/s}^2$.",
        answerType: "numeric",
        unit: "m/s",
      },
      // 3.54 — cannon firing over a cliff
      {
        id: "hw3_p9",
        prompt: "A cannon, located $60.0\\text{ m}$ from the base of a vertical $25.0\\text{-m}$-tall cliff, shoots a $15\\text{-kg}$ shell at $43.0°$ above the horizontal toward the cliff. Use $g = 9.80\\text{ m/s}^2$.",
        parts: [
          { id: "hw3_p9a", prompt: "(a) What must the minimum muzzle velocity be for the shell to clear the top of the cliff?", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p9b", prompt: "(b) The ground at the top of the cliff is level, with a constant elevation of $25.0\\text{ m}$ above the cannon. Under the conditions of part (a), how far does the shell land past the edge of the cliff? Explain your reasoning.", answerType: "text" },
        ],
      },
      // 3.63 — grasshopper leaping from a cliff
      {
        id: "hw3_p10",
        figure: "/homeworkFigures/HW3/figP3-63.png",
        prompt: "A grasshopper leaps into the air from the edge of a vertical cliff, as shown in the figure. It rises $6.74\\text{ cm}$ above the launch point while moving a horizontal distance of $1.06\\text{ m}$ to where it lands at the base of the cliff; its initial velocity is directed $50.0°$ above the horizontal. Use information from the figure to find the following. Use $g = 9.80\\text{ m/s}^2$.",
        parts: [
          { id: "hw3_p10a", prompt: "(a) Find the initial speed of the grasshopper.", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p10b", prompt: "(b) Find the height of the cliff.", answerType: "numeric", unit: "m" },
        ],
      },
    ],
  },
  {
    id: "hw4",
    title: "Homework 4: Newton's Laws of Motion",
    problems: [
      // 4.4 — dragging a trunk up a ramp (force components along/perpendicular to the ramp)
      {
        id: "hw4_p1",
        figure: "/homeworkFigures/HW4/figE4-4.png",
        prompt: "A man is dragging a trunk up the loading ramp of a mover's truck. The ramp has a slope angle of $20.0°$, and the man pulls upward with a force $\\vec F$ whose direction makes an angle of $30.0°$ with the ramp (see figure). The components $F_x$ and $F_y$ here are taken parallel and perpendicular to the ramp surface, respectively.",
        parts: [
          { id: "hw4_p1a", prompt: "(a) How large a force $\\vec F$ is necessary for the component $F_x$ parallel to the ramp to be $60.0\\text{ N}$?", answerType: "numeric", unit: "N" },
          { id: "hw4_p1b", prompt: "(b) How large will the component $F_y$ perpendicular to the ramp then be?", answerType: "numeric", unit: "N" },
        ],
      },
      // 4.12 — crate pushed by a net horizontal force (Newton's second law + kinematics)
      {
        id: "hw4_p2",
        prompt: "A crate with mass $32.5\\text{ kg}$ initially at rest on a warehouse floor is acted on by a net horizontal force of $140\\text{ N}$.",
        parts: [
          { id: "hw4_p2a", prompt: "(a) What acceleration is produced?", answerType: "numeric", unit: "m/s²" },
          { id: "hw4_p2b", prompt: "(b) How far does the crate travel in $10.0\\text{ s}$?", answerType: "numeric", unit: "m" },
          { id: "hw4_p2c", prompt: "(c) What is its speed at the end of $10.0\\text{ s}$?", answerType: "numeric", unit: "m/s" },
        ],
      },
      // 4.19 — mass vs. weight on Io (distinguishing m and w)
      {
        id: "hw4_p3",
        prompt: "At the surface of Jupiter's moon Io, the acceleration due to gravity is $g = 1.81\\text{ m/s}^2$. A watermelon weighs $44.0\\text{ N}$ at the surface of the earth. Use $g = 9.80\\text{ m/s}^2$ on earth.",
        parts: [
          { id: "hw4_p3a", prompt: "(a) What is the watermelon's mass on the earth's surface?", answerType: "numeric", unit: "kg" },
          { id: "hw4_p3b_m", prompt: "(b) What is its mass on the surface of Io?", answerType: "numeric", unit: "kg" },
          { id: "hw4_p3b_w", prompt: "(b) What is its weight on the surface of Io?", answerType: "numeric", unit: "N" },
        ],
      },
      // 4.23 — two boxes in contact, contact force (system + single-body Newton's 2nd law)
      {
        id: "hw4_p4",
        figure: "/homeworkFigures/HW4/figE4-23.png",
        prompt: "Boxes $A$ and $B$ are in contact on a horizontal, frictionless surface, as shown in the figure. Box $A$ has mass $20.0\\text{ kg}$ and box $B$ has mass $5.0\\text{ kg}$. A horizontal force of $100\\text{ N}$ is exerted on box $A$. What is the magnitude of the force that box $A$ exerts on box $B$?",
        answerType: "numeric",
        unit: "N",
      },
      // 4.27 — free-body diagrams for two crates pushed across a frictionless surface
      {
        id: "hw4_p5",
        prompt: "Two crates, $A$ and $B$, sit at rest side by side on a frictionless horizontal surface. The crates have masses $m_A$ and $m_B$. A horizontal force $\\vec F$ is applied to crate $A$ (pushing toward the right, the $+x$-direction) and the two crates move off to the right.",
        parts: [
          {
            id: "hw4_p5a_A",
            prompt: "(a) Draw a complete, labeled free-body diagram for crate $A$. Use the force bank to add every force that acts on it, assign your positive axes, and show the direction of its acceleration. Think about what is touching crate $A$ (the floor, your hand/the applied push, and crate $B$).",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "A", bank: ["F", "T", "N", "w"],
              // Forces on A: applied push F (right), normal from floor N (up), weight w (down),
              // and the contact (normal) force from B pushing back on A (left).
              forces: [
                { type: "F", dir: [1, 0], angleTol: 18 },
                { type: "N", dir: [0, 1], angleTol: 18 },
                { type: "N", dir: [-1, 0], angleTol: 18 },
                { type: "w", dir: [0, -1], angleTol: 18 },
              ],
              accel: { dir: [1, 0], angleTol: 20 }, // the crates accelerate to the right
            },
          },
          {
            id: "hw4_p5a_B",
            prompt: "(a) Now draw a complete, labeled free-body diagram for crate $B$. Again add every force acting on it from the bank, assign your axes, and show its acceleration. Think about what is touching crate $B$ (the floor and crate $A$).",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "B", bank: ["F", "T", "N", "w"],
              // Forces on B: normal from floor N (up), weight w (down), and the contact (normal)
              // force from A pushing B forward (right). There is NO applied force directly on B.
              forces: [
                { type: "N", dir: [0, 1], angleTol: 18 },
                { type: "N", dir: [1, 0], angleTol: 18 },
                { type: "w", dir: [0, -1], angleTol: 18 },
              ],
              accel: { dir: [1, 0], angleTol: 20 },
            },
          },
          { id: "hw4_p5a_pairs", prompt: "(a) Among the forces in your two diagrams, identify any third-law action–reaction pair.", answerType: "text" },
          { id: "hw4_p5b", prompt: "(b) If the magnitude of force $\\vec F$ is less than the total weight of the two crates, will it cause the crates to move? Explain.", answerType: "text" },
        ],
      },
      // 4.34 — free-body diagram for a box sliding on an accelerating truck bed
      {
        id: "hw4_p6",
        prompt: "A large box containing your new computer sits on the bed of your pickup truck. You are stopped at a red light. The light turns green and you stomp on the gas and the truck accelerates forward (the $+x$-direction). To your horror, the box starts to slide toward the back of the truck. The bed of the truck is $\\textit{not}$ frictionless.",
        parts: [
          {
            id: "hw4_p6a",
            prompt: "(a) Draw a complete, labeled free-body diagram for the box. Add every force from the bank, assign your positive axes, and show the direction of the box's acceleration. The friction force $\\vec f$ from the bed has been drawn in for you in $\\textit{blue}$ (you'll study friction next assignment) — notice it points forward, in the direction the truck accelerates, because the bed slides forward beneath the box. Add the rest of the forces yourself.",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "box", bank: ["F", "T", "N", "w"],
              // Forces on the box: normal from the bed N (up), weight w (down), and friction f
              // (forward, +x). Friction is prefilled (given) since friction is a HW5 topic.
              forces: [
                { type: "N", dir: [0, 1], angleTol: 18 },
                { type: "w", dir: [0, -1], angleTol: 18 },
                { type: "f", dir: [1, 0], angleTol: 18 },
              ],
              prefill: [{ type: "f", dir: [1, 0] }], // app draws & locks the friction arrow
              accel: { dir: [1, 0], angleTol: 20 },   // the box accelerates forward (with the truck, just less)
            },
          },
          {
            id: "hw4_p6b",
            prompt: "(b) Now draw a complete, labeled free-body diagram for the truck. Add every force from the bank, assign your positive axes, and show the direction of the truck's acceleration. Think about everything touching the truck — the road (under its tires) and the box (sitting on the bed) — plus gravity. The two friction forces are drawn in for you in $\\textit{blue}$ (friction is next assignment's topic): the road's forward driving (traction) force on the drive wheels ($+x$), and the box's backward drag on the bed ($-x$, the reaction to the bed pushing the box forward). Add the remaining forces yourself — and remember the box presses $\\textit{down}$ on the bed with its own normal force, separate from the truck's weight.",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "truck", bank: ["F", "T", "N", "w"],
              // Forces on the truck: weight w (down); normal from the road N (up); the normal the
              // box presses down on the bed N (down); the road's traction friction f (forward, +x)
              // and the box's friction on the bed f (backward, -x). Both frictions are prefilled
              // (friction is a HW5 topic). Student supplies w (down), N-road (up), N-box (down).
              forces: [
                { type: "N", dir: [0, 1], angleTol: 18 },   // road pushes truck up
                { type: "N", dir: [0, -1], angleTol: 18 },  // box presses down on the bed
                { type: "w", dir: [0, -1], angleTol: 18 },  // truck's weight
                { type: "f", dir: [1, 0], angleTol: 18 },   // road traction (prefilled)
                { type: "f", dir: [-1, 0], angleTol: 18 },  // box drags bed backward (prefilled)
              ],
              prefill: [{ type: "f", dir: [1, 0] }, { type: "f", dir: [-1, 0] }],
              accel: { dir: [1, 0], angleTol: 20 },          // truck accelerates forward
            },
          },
          { id: "hw4_p6c", prompt: "(c) Among the forces in your two diagrams — the box and the truck — identify any third-law action–reaction pairs.", answerType: "text" },
        ],
      },
      // 4.37 — smallest force for a cart to move along +x (equilibrium of the perpendicular component)
      {
        id: "hw4_p7",
        figure: "/homeworkFigures/HW4/figP4-37.png",
        prompt: "Two adults and a child want to push a wheeled cart in the direction of $+x$ in the figure. The two adults push with horizontal forces $\\vec F_1$ and $\\vec F_2$ as shown: $F_1 = 100\\text{ N}$ directed $60.0°$ above the $+x$-axis, and $F_2 = 140\\text{ N}$ directed $30.0°$ below the $+x$-axis.",
        parts: [
          { id: "hw4_p7a_m", prompt: "(a) Find the magnitude of the smallest force that the child should exert. (You can ignore the effects of friction.)", answerType: "numeric", unit: "N" },
          { id: "hw4_p7a_d", prompt: "(a) In what direction should the child push?", answerType: "text" },
          { id: "hw4_p7b", prompt: "(b) If the child exerts the minimum force found in part (a), the cart accelerates at $2.0\\text{ m/s}^2$ in the $+x$-direction. What is the weight of the cart? Use $g = 9.80\\text{ m/s}^2$.", answerType: "numeric", unit: "N" },
        ],
      },
      // 4.38 — oil tanker decelerating toward a reef (kinematics with no time)
      {
        id: "hw4_p8",
        figure: "/homeworkFigures/HW4/figP4-38.png",
        prompt: "An oil tanker's engines have broken down, and the wind is blowing the tanker straight toward a reef at a constant speed of $1.5\\text{ m/s}$ (see figure). When the tanker is $500\\text{ m}$ from the reef, the wind dies down just as the engineer gets the engines going again. The rudder is stuck, so the only choice is to try to accelerate straight backward away from the reef. The mass of the tanker and cargo is $3.6\\times10^7\\text{ kg}$, and the engines produce a net horizontal force of $8.0\\times10^4\\text{ N}$ on the tanker. The hull can withstand an impact at a speed of $0.2\\text{ m/s}$ or less. You can ignore the retarding force of the water on the tanker's hull.",
        parts: [
          { id: "hw4_p8a", prompt: "(a) What is the magnitude of the tanker's acceleration?", answerType: "numeric", unit: "m/s²" },
          { id: "hw4_p8b", prompt: "(b) How fast is the tanker moving when it reaches the reef?", answerType: "numeric", unit: "m/s" },
          { id: "hw4_p8c", prompt: "(c) Will the ship hit the reef? If it does, will the oil be safe? Explain.", answerType: "text" },
        ],
      },
      // 4.40 — net force to "stop on a dime" (kinematics with no time + Newton's 2nd law)
      {
        id: "hw4_p9",
        prompt: "An advertisement claims that a particular automobile can \"stop on a dime.\" What net force would actually be necessary to stop a $850\\text{-kg}$ automobile traveling initially at $45.0\\text{ km/h}$ in a distance equal to the diameter of a dime, which is $1.8\\text{ cm}$?",
        parts: [
          { id: "hw4_p9a", prompt: "(a) What is the magnitude of the car's acceleration? (Hint: first convert the speed to m/s.)", answerType: "numeric", unit: "m/s²" },
          { id: "hw4_p9b", prompt: "(b) What is the magnitude of the net force required? (You may enter it in scientific notation, e.g. 3.7e6.)", answerType: "numeric", unit: "N" },
        ],
      },
      // 4.57 — two boxes on a vertical rope (kinematics → acceleration → two single-body 2nd-law equations)
      {
        id: "hw4_p10",
        figure: "/homeworkFigures/HW4/figP4-57.png",
        prompt: "Two boxes, $A$ and $B$, are connected to each end of a light vertical rope, as shown in the figure. A constant upward force $F = 80.0\\text{ N}$ is applied to box $A$. Starting from rest, box $B$ descends $12.0\\text{ m}$ in $4.00\\text{ s}$. The tension in the rope connecting the two boxes is $36.0\\text{ N}$. Use $g = 9.80\\text{ m/s}^2$.",
        parts: [
          { id: "hw4_p10a", prompt: "(a) What is the magnitude of the system's acceleration? (Box $B$ falls $12.0\\text{ m}$ from rest in $4.00\\text{ s}$.)", answerType: "numeric", unit: "m/s²" },
          {
            id: "hw4_p10b_fbdA",
            prompt: "(b) Draw a complete, labeled free-body diagram for box $A$ (the upper box). Use the force bank to add every force that acts on it, assign your positive axes, and show the direction of its acceleration. Think about what touches box $A$: the applied force $\\vec F$ pulling up, and the rope below connecting it to box $B$. (There is no surface and no normal force — the boxes hang on the rope.)",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "A", bank: ["F", "T", "N", "w"],
              // Forces on A: applied force F up (+y), rope tension T down (-y, rope runs down to B),
              // and weight w down (-y). The system accelerates downward (B descends), so a is down.
              forces: [
                { type: "F", dir: [0, 1], angleTol: 18 },
                { type: "T", dir: [0, -1], angleTol: 18 },
                { type: "w", dir: [0, -1], angleTol: 18 },
              ],
              accel: { dir: [0, -1], angleTol: 20 },
            },
          },
          {
            id: "hw4_p10c_fbdB",
            prompt: "(c) Now draw a complete, labeled free-body diagram for box $B$ (the lower box). Add every force acting on it from the bank, assign your axes, and show its acceleration. Think about what touches box $B$: only the rope above, connecting it to box $A$. (No force $\\vec F$ acts directly on $B$.)",
            answerType: "fbd",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "B", bank: ["F", "T", "N", "w"],
              // Forces on B: rope tension T up (+y, rope runs up to A) and weight w down (-y).
              // B descends, so its acceleration is downward.
              forces: [
                { type: "T", dir: [0, 1], angleTol: 18 },
                { type: "w", dir: [0, -1], angleTol: 18 },
              ],
              accel: { dir: [0, -1], angleTol: 20 },
            },
          },
          { id: "hw4_p10d", prompt: "(d) What is the mass of box $B$?", answerType: "numeric", unit: "kg" },
          { id: "hw4_p10e", prompt: "(e) What is the mass of box $A$?", answerType: "numeric", unit: "kg" },
        ],
      },
    ],
  },
];
