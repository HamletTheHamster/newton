// PHY 215 — Physics II (Young & Freedman, one chapter per week).
//
// STATUS: quizzes 1–2 and homework 1 (Ch. 21) are authored; later weeks are added as each is
// prepped. Source material (quiz documents, homework problem screenshots, the instructor answer
// key, lecture notes) lives OUTSIDE the repo in `source/phy215/{quizzes,hw/HWn,lectures}/`
// (gitignored). Figures the app actually serves go in `public/homeworkFigures/physics2/HWn/`.
//
// See src/courses/physics1.js for a fully populated example of every shape below, and
// docs/courses/phy215.md for this course's weekly plan and per-assignment notes.

// ── Quizzes ──────────────────────────────────────────────────────────────────────────────────
// Quizzes are due at the START of a week and are BACKWARD-looking: quiz N covers week N−1's
// content (so q1 is a logistics/access survey and q2 covers week 1's chapter).
//
// This class's modules were built by hand rather than seeded from MODULES_PHYSICS2 (see below),
// so quizzes are attached to a module through the instructor Modules editor (⋮ → + Quiz), not by
// a `refId` in this file.
//
// Question shape (see QUIZZES_PHYSICS1 for live examples of each):
//   { id, text }                                        // free response, graded by Claude
//   { id, text, survey: true, reply }                   // survey — no right answer, full credit
//   { id, text, yesNo: true, yesReply?, noReply? }      // yes/no
//   { id, text, choices: true, options: [{ key, label }], correct, feedback: { key: "…" },
//     correctReply? }                                   // multiple choice, graded deterministically
//   { id, text, requiresImage: true, formatLabel, acceptedFormats: [...] }   // upload a drawing
//   { id, text, dragDrop: true, displaySentence, blanksLabel: [...],
//     wordBank: [...], correctBlanks: [...] }           // fill-in-the-blank drag & drop
import { clockPoint } from "../clock-geometry.js";

export const QUIZZES_PHYSICS2 = [
  // Week 1 quiz — pure survey/logistics (nothing has been taught yet, and quizzes look backward).
  {
    id: "q1",
    title: "Quiz 1: Welcome & Course Survey",
    questions: [
      {
        id: "q1_1", survey: true,
        text: "What interests you most about this course?",
        reply: "Thanks for sharing.",
      },
      {
        id: "q1_2", survey: true,
        text: "What's something I can do to make this course more enjoyable for you?",
        reply: "Noted, and thank you.",
      },
      {
        id: "q1_3", survey: true,
        text: "What is the highest math class you've completed?",
        reply: "Good to know.",
      },
      {
        id: "q1_4", yesNo: true,
        text: "Have you purchased the course lab manual from the bookstore?",
        yesReply: "Great, you're all set. Bring it with you to every lab session.",
        noReply: "No problem. Please pick one up from the bookstore before your first lab, since you'll need it to complete the lab activities.",
      },
    ],
  },
  // Week 2 quiz — covers week 1 (Ch. 21): charge, induced polarization, and conduction on contact.
  {
    id: "q2",
    title: "Quiz 2: Electric Charge",
    questions: [
      {
        id: "q2_1", choices: true,
        text: "You have two lightweight metal spheres, each hanging from an insulating nylon thread. One of the spheres has a net negative charge, while the other sphere has no net charge.\n\nIf the spheres are close together but do not touch, will they (A) attract each other, (B) repel each other, or (C) exert no force on each other?",
        options: [
          { key: "A", label: "Attract each other" },
          { key: "B", label: "Repel each other" },
          { key: "C", label: "Exert no force on each other" },
        ],
        correct: "A",
        correctReply: "The charged sphere polarizes the neutral one: it pulls the neutral sphere's mobile electrons to the far side, leaving the near side positive. The near, opposite charge is closer than the far, like charge, so the attraction wins.",
        feedback: {
          B: "Repulsion needs two like net charges, and one of these spheres has no net charge at all. Think about what the charged sphere does to the mobile charges inside the neutral metal sphere.",
          C: "Careful: zero net charge doesn't mean the charges inside can't move. These are metal spheres, so their electrons are free to rearrange when another charge comes near. What happens to the near side of the neutral sphere?",
        },
      },
      {
        id: "q2_2", choices: true,
        text: "You now allow the two spheres to touch. Once they have touched, will the two spheres (A) attract each other, (B) repel each other, or (C) exert no force on each other?",
        options: [
          { key: "A", label: "Attract each other" },
          { key: "B", label: "Repel each other" },
          { key: "C", label: "Exert no force on each other" },
        ],
        correct: "B",
        correctReply: "On contact the two metal spheres act as one conductor, so the excess negative charge spreads across both. Each sphere now carries a net negative charge, and like charges repel.",
        feedback: {
          A: "Attraction was the answer before they touched, when one sphere was neutral and merely polarized. Contact changes things: these are conductors, so what happens to the excess charge when they touch?",
          C: "That would require at least one sphere to end up neutral. But the excess electrons are free to move across both spheres once they touch. Where do they end up?",
        },
      },
    ],
  },
];

// ── Modules ──────────────────────────────────────────────────────────────────────────────────
// One module per week, each with the same 4-item template: quiz, assigned reading, lecture notes,
// homework. Quiz and homework items wire to the arrays in this file via `refId`; the two `file`
// items are placeholders until the instructor uploads the reading excerpt / notes PDF in the
// Modules editor (which fills in `uploadId`).
//
// NOTE the extra `ch` argument versus the physics1 helper: in PHY 215 the week number is NOT the
// textbook chapter number (Physics II picks up mid-volume), so the reading title takes the real
// Y&F chapter separately.
//
// ⚠️ INTENTIONALLY EMPTY — do not populate. The live PHY 215 class's modules were built BY HAND in
// the instructor Modules editor (17 modules: Welcome, Introduction, Lecture 1–13, Midterm, Final),
// and the seed template is only copied into a class's RTDB `modules` node when that node is ABSENT
// (App.jsx ~line 396). Since the node is populated, this template can never apply to that class —
// filling it in would have no effect there while silently diverging from what students actually
// see. Wire new quizzes/homework into a module through the editor instead (⋮ → + Quiz / + Homework).
//
// The helper below is kept for a future PHY 215 section created from scratch. Note the extra `ch`
// argument versus the physics1 helper: in PHY 215 the week number is NOT the textbook chapter
// number (Physics II picks up mid-volume), so the reading title takes the real Y&F chapter.
// eslint-disable-next-line no-unused-vars
const M = (n, ch, topic) => ({
  id: `m${n}`,
  title: `Lecture ${n} | ${topic}`,
  items: [
    { type: "quiz",     refId: `q${n}` },
    { type: "file",     title: `Assigned Reading: Ch. ${ch} · ${topic}`, uploadId: null },
    { type: "file",     title: `Lecture ${n} Notes: ${topic}`, uploadId: null },
    { type: "homework", refId: `hw${n}` },
  ],
});

export const MODULES_PHYSICS2 = [];

// ── Homework ─────────────────────────────────────────────────────────────────────────────────
// MasteringPhysics-style problem sets. Module items reference these by `refId` (hw1..hwN). Each
// homework has `problems`; each problem is worth 1 point (multipart `parts` split that point
// equally).
//
// Problem shape:
//   { id, prompt, figure?, figureWidth?, answerType,
//     unit?,                                       // numeric: shown next to the input field
//     graph?, vector?, fbd?,                       // graphical options (see below)
//     parts?: [{ id, prompt, answerType, unit?, ... }] }   // multipart
//
// `figureWidth` is the rendered width in CSS px. A figure with no `figureWidth` renders at its
// natural pixel size (capped at the 960px column), which is almost never right for a textbook
// screenshot — always check the figure's natural size and set a width appropriate for the page.
// See docs/homework-roadmap.md § Authoring → Figures.
//
// IMPORTANT — for numeric / text / math problems the ANSWER does NOT live here. Answers (and
// their sigFigs / tolerance) are stored server-side in netlify/functions/_answerKeys.js, keyed
// by hwId → itemId under `physics2`, and graded by netlify/functions/grade.js, so they are never
// shipped to the client. When authoring a new problem, put the prompt/figure/unit/configs here
// and the answer in _answerKeys.js (matching the item id exactly). Set an explicit `sigFigs` on
// EVERY numeric answer — a bare number literal silently drops significant trailing zeros
// (9.00 → "9"). See docs/homework-roadmap.md § Authoring for the required verify-first procedure.
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
//   instead of `answer`. Each keyed curve must span the key x-values, pass within tolerance of
//   every key point, and match the shape flag. The optional `guide` renders a checklist beside
//   the plot (steps tick off as points/shape are set) to scaffold tricky sketches.
// - vector:  student draws arrows from a common origin in VectorField; graded deterministically
//   by gradeVectors. Carries `vector: { xLabel?,yLabel?,xMin,xMax,yMin,yMax,xTick,yTick,
//                      origin?:[x,y], vectors:[{id,label,color,freeTail?}],
//                      key:{ [vecId]: { tip:[x,y], tail?:[x,y], angleTol?:deg=15, magTol?:frac } },
//                      snapDiv?, hideTicks?, guide?, buildup? }`
//   instead of `answer`. Grading is by the arrow's displacement (tip − tail): direction always
//   (within angleTol), magnitude only when the key gives magTol. Well suited to E&M field /
//   force-direction questions. An optional `buildup` config plays the VectorBuildup animation
//   once the part resolves.
// - fbd:     student builds a free-body diagram from a force bank in FBDField; graded
//   deterministically by gradeFBD. Carries `fbd: { xMin,xMax,yMin,yMax,xTick,yTick,snapDiv?,
//                      origin?:[x,y], bodyLabel?, bank:["F","T","N","w","f"],
//                      forces:[{ type, dir:[x,y], angleTol? }],
//                      prefill?:[{ type, dir }],        // app-supplied, counts as satisfied
//                      accel:{ dir:[x,y], angleTol? } | { none: true } }`
//   instead of `answer`. Forces are matched as a MULTISET by type+direction (any draw order;
//   missing/extra flagged without naming them); the acceleration arrow is graded by direction;
//   the positive-axes orientation is a required but UNGRADED step.
//
// Graph / vector / fbd keys stay in this file (they are graded client-side — an accepted
// tradeoff, since a sketch shape is far less copy-pasteable than a number) and have NO
// _answerKeys.js entry.
//
// Physics 2 convention: constants are $k = 1/4\pi\epsilon_0 = 8.99\times10^9\ \text{N·m}^2/\text{C}^2$,
// $e = 1.602\times10^{-19}\ \text{C}$, $m_e = 9.109\times10^{-31}\ \text{kg}$,
// $m_p = 1.673\times10^{-27}\ \text{kg}$, $g = 9.81\ \text{m/s}^2$. Answers whose magnitude is
// inherently exponential carry `sci: true` in _answerKeys.js so the revealed value reads as
// "1.25 × 10¹⁹" rather than a twenty-digit integer.
// ── Clock problem (hw1_p8) shared config ─────────────────────────────────────
// A scale-free square plane with a clockface backdrop. `square` keeps the dial round; the grid,
// ticks and axes are hidden because the dial itself is the reference frame.
const FIELD_BLUE = "#3b82f6";
const CLOCK_NUMERALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CLOCK_PAIRS = [[12, 6], [11, 5], [10, 4], [9, 3], [8, 2], [7, 1]];  // [larger, smaller]
// Plot units per unit of charge. Every charge sits the same distance from the center, so
// E_n = k(nq)/r^2 is exactly PROPORTIONAL to n — and since correct arrows are auto-scaled to
// these lengths (`snapMagnitude`), the drawing asserts that ratio and must get it right:
// E_12 has to come out twice E_6, not merely longer. One shared scale across (a) and (b) also
// makes each pair's net field the same length as E_6, which is the 6q result made visible.
const CLOCK_SCALE = 0.75;
const CLOCK_PLANE = {
  xMin: -14, xMax: 14, yMin: -14, yMax: 14, xTick: 2, yTick: 2, snapDiv: 20,
  square: true, hideGrid: true, hideTicks: true,
  dial: { radius: 10, labelRadius: 11.9, labels: CLOCK_NUMERALS.map(n => `${n}q`) },
};

export const HOMEWORKS_PHYSICS2 = [
  {
    id: "hw1",
    title: "Homework 1: Electric Charge & Electric Field",
    problems: [
      // 21.2 — charge and electron count in a lightning bolt
      {
        id: "hw1_p1",
        prompt: "Lightning occurs when there is a flow of electric charge (principally electrons) between the ground and a thundercloud. The maximum rate of charge flow in a lightning bolt is about $20{,}000\\text{ C/s}$; this lasts for $100\\ \\mu\\text{s}$ or less.",
        parts: [
          { id: "hw1_p1a", prompt: "(a) How much charge flows between the ground and the cloud in this time?", answerType: "numeric", unit: "C" },
          { id: "hw1_p1b", prompt: "(b) How many electrons flow during this time? Use $e = 1.602\\times10^{-19}\\text{ C}$.", answerType: "numeric", unit: "electrons" },
        ],
      },
      // 21.9 — Coulomb's law solved for the charges
      {
        id: "hw1_p2",
        prompt: "Two small plastic spheres are given positive electrical charges. When they are $15.0\\text{ cm}$ apart, the repulsive force between them has magnitude $0.220\\text{ N}$. Give each charge in microcoulombs ($\\mu\\text{C}$).",
        parts: [
          { id: "hw1_p2a", prompt: "(a) What is the charge on each sphere if the two charges are equal?", answerType: "numeric", unit: "μC" },
          { id: "hw1_p2b_small", prompt: "(b) If one sphere has four times the charge of the other, what is the smaller of the two charges?", answerType: "numeric", unit: "μC" },
          { id: "hw1_p2b_large", prompt: "(b) And what is the larger of the two charges?", answerType: "numeric", unit: "μC" },
        ],
      },
      // 21.22 — superposition of two Coulomb forces along a line
      {
        id: "hw1_p3",
        prompt: "Two point charges are placed on the $x$-axis as follows: charge $q_1 = +4.00\\text{ nC}$ is located at $x = 0.200\\text{ m}$, and charge $q_2 = +5.00\\text{ nC}$ is at $x = -0.300\\text{ m}$. What are the magnitude and direction of the total force exerted by these two charges on a negative point charge $q_3 = -6.00\\text{ nC}$ that is placed at the origin?",
        parts: [
          { id: "hw1_p3_m", prompt: "(a) Magnitude of the total force on $q_3$, in micronewtons ($\\mu\\text{N}$).", answerType: "numeric", unit: "μN" },
          { id: "hw1_p3_d", prompt: "(b) In what direction does this total force point? Briefly justify your answer.", answerType: "text" },
        ],
      },
      // 21.30 — field at the center of a square (symmetry + an algebraic magnitude)
      {
        id: "hw1_p4",
        figure: "/homeworkFigures/physics2/HW1/figE21-30.png", figureWidth: 400,  // natural 518×522
        prompt: "A point charge is placed at each corner of a square with side length $a$. The charges all have the same magnitude $q$. Two of the charges are positive and two are negative, as shown in the figure.",
        parts: [
          {
            id: "hw1_p4_d",
            prompt: "(a) What is the direction of the net electric field at the center of the square due to the four charges? Draw the net field vector $\\vec E_{net}$ at the center. (Only its direction is graded; the length doesn't matter.)",
            answerType: "vector",
            vector: {
              xMin: -2, xMax: 2, yMin: -2, yMax: 2, xTick: 1, yTick: 1, snapDiv: 20,
              hideTicks: true, origin: [0, 0],
              vectors: [{ id: "Enet", label: "E_{net}", color: "#60a5fa" }],
              // Each corner contributes q/(2 pi eps0 a^2); the x-components cancel in pairs and all
              // four y-components point -y (away from the +q pair, toward the -q pair).
              // Direction only — no magTol, since the magnitude is asked algebraically in part (b).
              key: { Enet: { tip: [0, -1.5], angleTol: 5 } },
              guide: {
                title: "How to draw it",
                steps: [
                  { vector: "Enet", label: "One arrow from the center, pointing along the net field.",
                    note: "Take the four contributions one at a time. A field points AWAY from a positive charge and TOWARD a negative one. Add the four arrows head-to-tail and see which components survive." },
                ],
              },
            },
          },
          {
            id: "hw1_p4_m",
            prompt: "(b) What is the magnitude of the net electric field at the center, in terms of $q$ and $a$? Enter an expression (you may use $\\epsilon_0$ or $k$).",
            answerType: "math",
          },
        ],
      },
      // 21.33 — charged particles launched between parallel plates ("upside-down projectile")
      {
        id: "hw1_p5",
        figure: "/homeworkFigures/physics2/HW1/figE21-33.png", figureWidth: 400,  // natural 506×292
        prompt: "An electron is projected with an initial speed $v_0 = 1.60\\times10^6\\text{ m/s}$ into the uniform field between the parallel plates in the figure. Assume that the field between the plates is uniform and directed vertically downward, and that the field outside the plates is zero. The electron enters the field at a point midway between the plates. Use $m_e = 9.109\\times10^{-31}\\text{ kg}$, $m_p = 1.673\\times10^{-27}\\text{ kg}$, and $e = 1.602\\times10^{-19}\\text{ C}$.",
        parts: [
          { id: "hw1_p5a", prompt: "(a) If the electron just misses the upper plate as it emerges from the field, find the magnitude of the electric field.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p5b_y", prompt: "(b) Suppose the electron is replaced by a proton with the same initial speed $v_0$. What is the magnitude of the proton's vertical displacement as it exits the region between the plates? Give your answer in micrometres ($\\mu\\text{m}$).", answerType: "numeric", unit: "μm" },
          { id: "hw1_p5b_d", prompt: "(b) Would the proton hit one of the plates? In which direction is it deflected?", answerType: "text" },
          { id: "hw1_p5c", prompt: "(c) Compare the paths traveled by the electron and the proton and explain the differences.", answerType: "text" },
          { id: "hw1_p5d", prompt: "(d) Discuss whether it is reasonable to ignore the effects of gravity for each particle.", answerType: "text" },
        ],
      },
      // 21.34 — vector superposition of two fields, answered in unit-vector form
      {
        id: "hw1_p6",
        prompt: "Point charge $q_1 = -5.00\\text{ nC}$ is at the origin and point charge $q_2 = +3.00\\text{ nC}$ is on the $x$-axis at $x = 3.00\\text{ cm}$. Point $P$ is on the $y$-axis at $y = 4.00\\text{ cm}$. Give each answer in unit-vector form, in N/C (for example, $(-1.20\\times10^{3})\\,\\hat{\\imath} + (4.50\\times10^{3})\\,\\hat{\\jmath}$).",
        parts: [
          { id: "hw1_p6a_E1", prompt: "(a) Calculate the electric field $\\vec E_1$ at point $P$ due to charge $q_1$.", answerType: "math" },
          { id: "hw1_p6a_E2", prompt: "(a) Calculate the electric field $\\vec E_2$ at point $P$ due to charge $q_2$.", answerType: "math" },
          { id: "hw1_p6b", prompt: "(b) Use the results of part (a) to obtain the resultant field at $P$, expressed in unit-vector form.", answerType: "math" },
        ],
      },
      // 21.45 — field and force at three points on the axis (everything collinear ⇒ signed values)
      {
        id: "hw1_p7",
        prompt: "A $+2.00\\text{-nC}$ point charge is at the origin, and a second $-5.00\\text{-nC}$ point charge is on the $x$-axis at $x = 0.800\\text{ m}$.\n\nEverything here lies along the $x$-axis, so give each answer as a signed $x$-component: a positive value means the $+x$-direction, a negative value means the $-x$-direction.",
        parts: [
          { id: "hw1_p7a_i", prompt: "(a)(i) Find the electric field at $x = 0.200\\text{ m}$.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p7a_ii", prompt: "(a)(ii) Find the electric field at $x = 1.20\\text{ m}$.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p7a_iii", prompt: "(a)(iii) Find the electric field at $x = -0.200\\text{ m}$.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p7b_i", prompt: "(b)(i) Find the net electric force the two charges would exert on an electron placed at $x = 0.200\\text{ m}$.", answerType: "numeric", unit: "N" },
          { id: "hw1_p7b_ii", prompt: "(b)(ii) Find the net electric force on an electron placed at $x = 1.20\\text{ m}$.", answerType: "numeric", unit: "N" },
          { id: "hw1_p7b_iii", prompt: "(b)(iii) Find the net electric force on an electron placed at $x = -0.200\\text{ m}$.", answerType: "numeric", unit: "N" },
        ],
      },
      // Clock — instructor-authored symmetry problem, walked through as a diagram instead of a
      // single prose blank: draw the twelve fields, collapse opposite pairs, find the symmetry
      // axis, then state the time. Every key tip is built from clockPoint(numeral, length), the
      // same helper that draws the dial, so the answer can't drift from what students see.
      {
        id: "hw1_p8",
        prompt: "A clockface has positive charges $q$, $2q$, $3q$, $\\ldots$, $12q$ fixed at the position of the corresponding numerals of the dial. The clock hands do not disturb the net field due to the point charges.\n\nAt what time does the hour hand point in the same direction as the electric field at the center of the dial?",
        parts: [
          {
            id: "hw1_p8a", answerType: "vector",
            prompt: "(a) Draw all twelve field vectors $\\vec E_1 \\ldots \\vec E_{12}$ at the center of the dial.",
            vector: {
              ...CLOCK_PLANE, snapMagnitude: true,
              vectors: CLOCK_NUMERALS.map(n => ({ id: `E${n}`, label: `E_{${n}}`, color: FIELD_BLUE })),
              // E_n points away from numeral n, i.e. straight at the numeral opposite it (n+6),
              // with length proportional to n.
              key: Object.fromEntries(CLOCK_NUMERALS.map(n =>
                [`E${n}`, { tip: clockPoint(n + 6, CLOCK_SCALE * n), angleTol: 5 }])),
            },
          },
          {
            id: "hw1_p8b", answerType: "vector",
            prompt: "(b) Now take the numerals in opposite pairs. The two fields of a pair lie along the same line pointing opposite ways, so what survives is set by the difference of the two charges. Work that difference out for each of the six pairs, then draw the six net fields.",
            vector: {
              ...CLOCK_PLANE, snapMagnitude: true,
              vectors: CLOCK_PAIRS.map(([big, small]) => ({ id: `P${big}`, label: `E_{${big},${small}}`, color: FIELD_BLUE })),
              // Every pair differs by 6q, and the larger charge is always the higher numeral, so
              // each net field points at the SMALLER numeral — all six the same length, and on
              // the shared scale that length is exactly E_6's.
              key: Object.fromEntries(CLOCK_PAIRS.map(([big, small]) =>
                [`P${big}`, { tip: clockPoint(small, CLOCK_SCALE * 6), angleTol: 5 }])),
              guide: {
                title: "The six opposite pairs",
                steps: CLOCK_PAIRS.map(([big, small]) => ({ vector: `P${big}`, label: `$${big}q$ opposite $${small}q$` })),
              },
            },
          },
          {
            id: "hw1_p8c", answerType: "vector",
            prompt: "(c) Those six net fields are all the same size, and their directions are evenly spread. Draw the axis of symmetry of the six: the line about which they are mirror images.",
            vector: {
              ...CLOCK_PLANE,
              // The six net fields from (b) carry over as faded context — the student is finding
              // the symmetry axis OF those arrows, so they have to be on the diagram. Ungraded,
              // and drawn from (b)'s key: `snapMagnitude` means a correct drawing in (b) is
              // exactly this, and a student who revealed (b) should still see the right picture.
              staticVectors: CLOCK_PAIRS.map(([big, small]) =>
                ({ id: `P${big}`, tip: clockPoint(small, CLOCK_SCALE * 6), color: FIELD_BLUE })),
              // axisRadius matches the key's length so the committed handle lands where the
              // revealed "correct diagram" puts it.
              vectors: [{ id: "axis", label: "axis", color: "#f59e0b", render: "axis", axisRadius: 9.5 }],
              // The mean of the six directions is the 3:30 mark — numeral 3.5. `mod180` because an
              // axis is the same line drawn either way.
              key: { axis: { tip: clockPoint(3.5, 9.5), angleTol: 5, mod180: true } },
            },
          },
          {
            id: "hw1_p8d", answerType: "text",
            prompt: "(d) The resultant field at the center points along that axis. At what time does the hour hand point in the same direction? State the time and justify it.",
          },
        ],
      },
      // 21.73 — charged pendulum in equilibrium in a horizontal field
      {
        id: "hw1_p9",
        figure: "/homeworkFigures/physics2/HW1/figP21-73.png", figureWidth: 180,  // natural 230×498 (tall/narrow)
        prompt: "A small $12.3\\text{-g}$ plastic ball is tied to a very light $28.6\\text{-cm}$ string that is attached to the vertical wall of a room (see figure). A uniform horizontal electric field exists in this room. When the ball has been given an excess charge of $-1.11\\ \\mu\\text{C}$, you observe that it remains suspended, with the string making an angle of $17.4°$ with the wall. Use $g = 9.81\\text{ m/s}^2$.",
        parts: [
          {
            id: "hw1_p9_fbd", answerType: "fbd",
            prompt: "(a) Draw a complete, labeled free-body diagram for the ball. Add every force from the bank, assign your positive axes, and show the ball's acceleration.",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "ball",
              bank: ["F", "T", "N", "w"],
              // Tension runs from the ball back up the string toward the wall: 17.4 deg from
              // vertical, tilted toward the wall (up and to the left, matching figP21-73). The
              // standard +/-5 deg matters here: a straight-up arrow is only 17.4 deg away, and
              // "the tension lies along the string" is the whole point of the problem.
              forces: [
                { type: "T", dir: [-0.299, 0.954], angleTol: 5 },
                { type: "F", dir: [1, 0], angleTol: 5 },
                { type: "w", dir: [0, -1], angleTol: 5 },
              ],
              accel: { none: true },   // the ball hangs in equilibrium
            },
          },
          { id: "hw1_p9_m", prompt: "(b) Find the magnitude of the electric field in the room.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p9_d", prompt: "(c) Find the direction of the electric field in the room. Justify your answer, being careful about the sign of the ball's charge.", answerType: "text" },
        ],
      },
      // 21.87 — symbolic "electric projectile", then numbers, then the sketch
      {
        id: "hw1_p10",
        prompt: "A proton is projected into a uniform electric field that points vertically upward and has magnitude $E$. The initial velocity of the proton has a magnitude $v_0$ and is directed at an angle $\\alpha$ below the horizontal. You can ignore gravitational forces.\n\n(Note: parts are ordered so that you derive the symbolic results first, then evaluate them, and finally sketch the trajectory using your numbers.)",
        parts: [
          { id: "hw1_p10a", prompt: "(a) Find the maximum distance $h_{max}$ that the proton descends vertically below its initial elevation. Give an expression in terms of $m_p$, $v_0$, $\\alpha$, $e$ and $E$.", answerType: "math" },
          { id: "hw1_p10b", prompt: "(b) After what horizontal distance $d$ does the proton return to its original elevation? Give an expression in terms of $m_p$, $v_0$, $\\alpha$, $e$ and $E$.", answerType: "math" },
          { id: "hw1_p10c_h", prompt: "(c) Find the numerical value of $h_{max}$ if $E = 500\\text{ N/C}$, $v_0 = 4.00\\times10^5\\text{ m/s}$, and $\\alpha = 30.0°$. Use $m_p = 1.673\\times10^{-27}\\text{ kg}$ and $e = 1.602\\times10^{-19}\\text{ C}$.", answerType: "numeric", unit: "m" },
          { id: "hw1_p10c_d", prompt: "(c) Find the numerical value of $d$ for the same values.", answerType: "numeric", unit: "m" },
          {
            id: "hw1_p10d",
            prompt: "(d) Sketch the trajectory of the proton, using the numerical values from part (c). Take the launch point as the origin, $x$ horizontal and $y$ vertical (positive upward).",
            answerType: "graph",
            graph: {
              xLabel: "x (m)", yLabel: "y (m)",
              xMin: 0, xMax: 3.0, yMin: -0.6, yMax: 0.2, xTick: 0.5, yTick: 0.2,
              curves: [{ id: "path", label: "Proton path", color: "#f59e0b" }],
              // Launch at the origin heading down-right; the upward field decelerates the downward
              // motion, so the path is a parabola opening UPWARD: lowest at x = d/2, back to y = 0 at x = d.
              key: {
                path: { points: [[0, 0], [1.4466, -0.4176], [2.8931, 0]], shape: "curveUp", yTolFrac: 0.10 },
              },
              guide: {
                title: "How to plot it",
                steps: [
                  {
                    curve: "path", minPoints: 3, shape: "curveUp",
                    label: "the launch point, the lowest point, and the point where it returns to its starting height; shape “Curve ↑”.",
                    note: "The proton starts at the origin moving downward and to the right, and the electric force on it is upward, so this is projectile motion turned upside down. The lowest point is reached halfway along the horizontal distance you found in part (c).",
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  },
];
