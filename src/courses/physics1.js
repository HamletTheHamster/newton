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
    title: "Homework 1: Test Assignment",
    problems: [
      {
        id: "hw1_p1",
        figure: "/homeworkFigures/HW1/fig1.png",
        prompt: "Question 1",
        answerType: "numeric",
        answer: 1,
      },
      {
        id: "hw1_p2",
        figure: "/homeworkFigures/HW1/fig1.png",
        prompt: "What color is my red hat?",
        answerType: "text",
        answer: "the hat is red",
      },
      {
        id: "hw1_p3",
        figure: "/homeworkFigures/HW1/fig1.png",
        prompt: "Enter the force vector $\\vec{A}$ using correct math/LaTeX.",
        answerType: "math",
        answer: "\\vec{A} = 3\\hat{i} + 4\\hat{j}",
      },
    ],
  },
];
