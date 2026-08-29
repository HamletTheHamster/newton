// PHY 215 — Physics II (Young & Freedman, one chapter per week).
//
// STATUS: quizzes 1–7, homework 1 (Ch. 21), 2 (Ch. 22), 3 (Ch. 23), 4 (Ch. 24) and 5 (Ch. 25) are
// authored; later weeks are added as each is prepped. Source material (quiz documents, problem screenshots, the
// instructor answer key, lecture notes) lives OUTSIDE the repo in
// `source/phy215/{quizzes,hw/HWn,lectures}/` (gitignored). Figures the app actually serves go in
// `public/homeworkFigures/physics2/HWn/` — usually textbook screenshots, but HW2's figP22-43.png
// is drawn for this app (its SVG source sits beside it) because the textbook's figure is wrong.
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
  // Week 3 quiz — covers week 2 (Ch. 22): Gauss's law and electric flux. All four questions are
  // free response (the default type, graded conceptually by Claude with Socratic follow-ups):
  // every one of them asks for a definition or an explanation, so the answer IS the prose. The
  // two that hinge on a yes/no verdict (3 and 4) deliberately do NOT use the `yesNo` type, since
  // that type just posts a canned reply and never reads the reasoning, which is the whole point
  // here. Q4 labels its two halves (a)/(b) so `detectParts` splits it and awards per-part credit:
  // the field at a point on the surface DOES change while the total flux does NOT, and a student
  // who gets one of those and not the other should keep the half they earned.
  {
    id: "q3",
    title: "Quiz 3: Gauss's Law",
    questions: [
      {
        id: "q3_1",
        text: "In words, what is Gauss's law?",
      },
      {
        id: "q3_2",
        text: "In words, what is electric flux?",
      },
      {
        id: "q3_3",
        text: "A rubber balloon has a single point charge in its interior. Does the electric flux through the balloon depend on whether or not it is fully inflated? Explain your reasoning.",
      },
      {
        id: "q3_4",
        // No $…$ math here: quiz question text renders as PLAIN TEXT (ChatMessages.jsx), unlike
        // homework prompts, which go through MathText. A "$q$" would reach students literally.
        text: "A spherical Gaussian surface encloses a point charge q. The point charge is now moved from the center of the sphere to a point away from the center.\n\n(a) Does the electric field at a point on the surface change? Explain.\n\n(b) Does the total flux through the Gaussian surface change? Explain.",
      },
    ],
  },
  // Week 4 quiz — covers week 3 (Ch. 23): electric potential. Both questions are free response,
  // for the same reason as q3: each opens on a yes/no verdict but the graded content is the
  // justification, which `yesNo`/`choices` would never read. Neither is split into labelled parts
  // (unlike q3_4) — see docs/courses/phy215.md for why the halves of Q2 are one idea, not two.
  {
    id: "q4",
    title: "Quiz 4: Electric Potential",
    questions: [
      {
        id: "q4_1",
        text: "The potential (relative to a point at infinity) midway between two charges of equal magnitude and opposite sign is zero. Is it possible to bring a test charge from infinity to this midpoint in such a way that no work is done in any part of the displacement? If so, describe how it can be done. If it is not possible, explain why.",
      },
      {
        id: "q4_2",
        // Plain text, no LaTeX: the source document writes this one with \vec{E} and \textit{can},
        // neither of which a quiz question renders (ChatMessages.jsx posts the text raw), so the
        // field is named in words and the emphasis is dropped per the house no-emphasis style.
        text: "If the electric field is zero throughout a certain region of space, is the potential necessarily also zero in this region? Why or why not? If not, what can be said about the potential?",
      },
    ],
  },
  // Week 5 quiz — covers week 4 (Ch. 24): capacitance and dielectrics. Both free response again:
  // Q1 asks "explain your reasoning" about three comparisons and Q2 asks for a mechanism, so the
  // prose IS the answer in both cases. Q1 is labelled (a)/(b)/(c) so `detectParts` splits it into
  // three graded parts — all three name the SAME capacitor, but by three different relations
  // (E = V/d, Q = CV with C proportional to 1/d, u proportional to E squared), and a student can
  // genuinely get one without the others. See docs/courses/phy215.md for the worked answers.
  {
    id: "q5",
    title: "Quiz 5: Capacitance & Dielectrics",
    questions: [
      {
        id: "q5_1",
        text: "Two parallel plate capacitors are identical except that one has twice the plate separation of the other. Both are charged by the same voltage source.\n\n(a) Which capacitor has a stronger electric field between the plates? Explain your reasoning.\n\n(b) Which capacitor has a greater charge? Explain your reasoning.\n\n(c) Which capacitor has a greater energy density between the plates? Explain your reasoning.",
      },
      {
        id: "q5_2",
        // Bare "K" rather than "$K$": quiz text renders raw (see the note on q3_4 above).
        text: "The freshness of fish can be measured by placing a fish between the plates of a capacitor and measuring the capacitance. How does this work? The dielectric constant K is about 1 for air and about 80 for water. (Hint: as time passes, the fish dries out.)",
      },
    ],
  },
  // Week 6 quiz — covers week 5 (Ch. 25): current, resistance, and electromotive force. All three
  // are free response, for the same reason as q3/q4/q5: Q1 and Q2 each open on a verdict
  // ("is there a contradiction", "would it be appropriate") whose entire content is the
  // justification, which `yesNo`/`choices` would post a canned reply to without ever reading, and
  // Q3 asks for a chain of reasoning outright. None is split into labelled parts: each asks for
  // one argument, not a contrast between two (compare q3_4, whose halves have opposite answers).
  // Symbols are Unicode (rho, not "$\rho$"): quiz text renders raw, so LaTeX would reach students
  // literally, while a Unicode glyph displays correctly — see the note on q3_4.
  {
    id: "q6",
    title: "Quiz 6: Current, Resistance, & Electromotive Force",
    questions: [
      {
        id: "q6_1",
        text: "The definition of resistivity (ρ = E/J) implies that an electric field exists inside a conductor. Yet in week 1 we said that there can be no electric field inside a conductor. Is there a contradiction here? Explain.",
      },
      {
        id: "q6_2",
        text: "Batteries are always labeled with their emf; for instance, an AA flashlight battery is labeled \"1.5 volts.\" Would it also be appropriate to put a label on batteries stating how much current they provide? Why or why not?",
      },
      {
        id: "q6_3",
        text: "Small aircraft often have 24-V electrical systems rather than the 12-V systems in automobiles, even though the electrical power requirements are roughly the same in both applications. The explanation given by aircraft designers is that a 24-V system weighs less than a 12-V system because thinner wires can be used. Explain why this is so.",
      },
    ],
  },
  // Week 7 quiz — covers week 6 (Ch. 26): direct-current circuits. Both free response, for the same
  // reason as q3/q4/q5/q6: Q1 says "explain your reasoning" and Q2 asks "why or why not", so the
  // prose is the entire answer. Both are split into labelled parts (see docs/courses/phy215.md for
  // the worked answers and why each split earns its place).
  {
    id: "q7",
    title: "Quiz 7: Direct-Current Circuits",
    questions: [
      {
        id: "q7_1",
        // The source asks the brightness half as "(i) in series and (ii) in parallel". Those are
        // relabelled (a)/(b) here — beyond reading better as separate parts, "(i)" is a single
        // lowercase letter in parens, so detectParts (utils.js) would have counted it as a THIRD
        // part label alongside (a)/(b) while "(ii)" went unmatched, splitting the question wrong.
        text: "You connect a number of identical light bulbs to a flashlight battery.\n\n(a) What happens to the brightness of each bulb as more and more bulbs are added to the circuit if you connect them in series? Explain your reasoning.\n\n(b) What happens to the brightness of each bulb as more and more bulbs are added to the circuit if you connect them in parallel? Explain your reasoning.\n\n(c) Will the battery last longer if the bulbs are in series or in parallel? Explain your reasoning.",
      },
      {
        id: "q7_2",
        text: "A capacitor, a battery, and a resistor are connected in series.\n\n(a) Does the resistor affect the maximum charge stored on the capacitor? Why or why not?\n\n(b) What purpose does the resistor serve? Explain your reasoning.",
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
//                      origin?:[x,y], bodyLabel?, bank:["F","T","N","w","f"], angleSymbol?,
//                      forces:[{ type, dir:[x,y], angleTol?, angleSymbol? }],
//                      prefill?:[{ type, dir }],        // app-supplied, counts as satisfied
//                      accel:{ dir:[x,y], angleTol? } | { none: true } }`
//   instead of `answer`. Forces are matched as a MULTISET by type+direction (any draw order;
//   missing/extra flagged without naming them); the acceleration arrow is graded by direction;
//   the positive-axes orientation is a required but UNGRADED step.
//   `angleSymbol` (on the config, e.g. "θ") labels off-axis angles by NAME instead of measuring
//   them, for a problem where that angle is the unknown; on a FORCE it additionally keeps
//   snapFBDDirections off that arrow, since the key direction is then only a sketch angle.
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
          { id: "hw1_p1b", prompt: "(b) How many electrons flow during this time?", answerType: "numeric", unit: "electrons" },
        ],
      },
      // 21.9 — Coulomb's law solved for the charges
      {
        id: "hw1_p2",
        prompt: "Two small plastic spheres are given positive electrical charges. When they are $15.0\\text{ cm}$ apart, the repulsive force between them has magnitude $0.220\\text{ N}$.",
        parts: [
          { id: "hw1_p2a", prompt: "(a) What is the charge on each sphere if the two charges are equal?", answerType: "numeric", unit: "μC" },
          { id: "hw1_p2b_small", prompt: "(b) If one sphere has four times the charge of the other, what is the smaller of the two charges?", answerType: "numeric", unit: "μC" },
          { id: "hw1_p2b_large", prompt: "(b) If one sphere has four times the charge of the other, what is the larger of the two charges?", answerType: "numeric", unit: "μC" },
        ],
      },
      // 21.22 — superposition of two Coulomb forces along a line
      {
        id: "hw1_p3",
        prompt: "Two point charges are placed on the $x$-axis as follows: charge $q_1 = +4.00\\text{ nC}$ is located at $x = 0.200\\text{ m}$, and charge $q_2 = +5.00\\text{ nC}$ is at $x = -0.300\\text{ m}$. What are the magnitude and direction of the total force exerted by these two charges on a negative point charge $q_3 = -6.00\\text{ nC}$ that is placed at the origin?",
        parts: [
          { id: "hw1_p3_m", prompt: "(a) What is the magnitude of the total force exerted by these two charges on $q_3$?", answerType: "numeric", unit: "μN" },
          { id: "hw1_p3_d", prompt: "(b) What is the direction of the total force exerted by these two charges on $q_3$?", answerType: "text" },
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
        prompt: "An electron is projected with an initial speed $v_0 = 1.60\\times10^6\\text{ m/s}$ into the uniform field between the parallel plates in the figure. Assume that the field between the plates is uniform and directed vertically downward, and that the field outside the plates is zero. The electron enters the field at a point midway between the plates.",
        parts: [
          { id: "hw1_p5a", prompt: "(a) If the electron just misses the upper plate as it emerges from the field, find the magnitude of the electric field.", answerType: "numeric", unit: "N/C" },
          { id: "hw1_p5b_d", prompt: "(b) Suppose that in the figure the electron is replaced by a proton with the same initial speed $v_0$. Would the proton hit one of the plates? If the proton would not hit one of the plates, what would be the direction of its vertical displacement as it exits the region between the plates?", answerType: "text" },
          { id: "hw1_p5b_y", prompt: "(b) What would be the magnitude of its vertical displacement as it exits the region between the plates?", answerType: "numeric", unit: "μm" },
          { id: "hw1_p5c", prompt: "(c) Compare the paths traveled by the electron and the proton and explain the differences.", answerType: "text" },
          { id: "hw1_p5d", prompt: "(d) Discuss whether it is reasonable to ignore the effects of gravity for each particle.", answerType: "text" },
        ],
      },
      // 21.34 — vector superposition of two fields, answered in unit-vector form
      {
        id: "hw1_p6",
        prompt: "Point charge $q_1 = -5.00\\text{ nC}$ is at the origin and point charge $q_2 = +3.00\\text{ nC}$ is on the $x$-axis at $x = 3.00\\text{ cm}$. Point $P$ is on the $y$-axis at $y = 4.00\\text{ cm}$. Express your results in terms of unit vectors. (Enter each answer in N/C, for example $(-1.20\\times10^{3})\\,\\hat{\\imath} + (4.50\\times10^{3})\\,\\hat{\\jmath}$.)",
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
        prompt: "A small $12.3\\text{-g}$ plastic ball is tied to a very light $28.6\\text{-cm}$ string that is attached to the vertical wall of a room (see figure). A uniform horizontal electric field exists in this room. When the ball has been given an excess charge of $-1.11\\ \\mu\\text{C}$, you observe that it remains suspended, with the string making an angle of $17.4°$ with the wall.",
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
          { id: "hw1_p9_d", prompt: "(c) Find the direction of the electric field in the room.", answerType: "text" },
        ],
      },
      // 21.87 — symbolic "electric projectile", then numbers, then the sketch
      {
        id: "hw1_p10",
        prompt: "A proton is projected into a uniform electric field that points vertically upward and has magnitude $E$. The initial velocity of the proton has a magnitude $v_0$ and is directed at an angle $\\alpha$ below the horizontal. You can ignore gravitational forces.\n\n(Note: parts are ordered so that you derive the symbolic results first, then evaluate them, and finally sketch the trajectory using your numbers.)",
        parts: [
          { id: "hw1_p10a", prompt: "(a) Find the maximum distance $h_{max}$ that the proton descends vertically below its initial elevation. Give an expression in terms of $m_p$, $v_0$, $\\alpha$, $e$ and $E$.", answerType: "math" },
          { id: "hw1_p10b", prompt: "(b) After what horizontal distance $d$ does the proton return to its original elevation? Give an expression in terms of $m_p$, $v_0$, $\\alpha$, $e$ and $E$.", answerType: "math" },
          { id: "hw1_p10c_h", prompt: "(c) Find the numerical value of $h_{max}$ if $E = 500\\text{ N/C}$, $v_0 = 4.00\\times10^5\\text{ m/s}$, and $\\alpha = 30.0°$.", answerType: "numeric", unit: "m" },
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
  {
    id: "hw2",
    title: "Homework 2: Gauss's Law",
    problems: [
      // 22.1 — flux through a flat sheet in a uniform field
      {
        id: "hw2_p1",
        prompt: "A flat sheet of paper of area $0.250\\text{ m}^2$ is oriented so that the normal to the sheet is at an angle of $60°$ to a uniform electric field of magnitude $14\\text{ N/C}$.",
        parts: [
          { id: "hw2_p1a", prompt: "(a) Find the magnitude of the electric flux through the sheet.", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p1b", prompt: "(b) Does the answer to part (a) depend on the shape of the sheet? Why or why not?", answerType: "text" },
          { id: "hw2_p1c", prompt: "(c) For what angle $\\phi$ between the normal to the sheet and the electric field is the magnitude of the flux through the sheet (i) largest and (ii) smallest? Explain your answers.", answerType: "text" },
        ],
      },
      // 22.3 — flux through a sphere around a point charge, then the charge itself
      {
        id: "hw2_p2",
        prompt: "You measure an electric field of $1.25\\times10^{6}\\text{ N/C}$ at a distance of $0.150\\text{ m}$ from a point charge. There is no other source of electric field in the region other than this point charge.",
        parts: [
          { id: "hw2_p2a", prompt: "(a) What is the magnitude of the electric flux through the surface of a sphere that has this charge at its center and that has radius $0.150\\text{ m}$?", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p2b", prompt: "(b) What is the magnitude of this charge?", answerType: "numeric", unit: "μC" },
        ],
      },
      // 22.4 — flux through a cylinder around an infinite line, then the two "what if" variations
      {
        id: "hw2_p3",
        prompt: "It was shown in Example 21.11 (Section 21.5) that the electric field due to an infinite line of charge is perpendicular to the line and has magnitude $E = \\lambda/2\\pi\\epsilon_0 r$. Consider an imaginary cylinder with radius $r = 0.250\\text{ m}$ and length $l = 0.400\\text{ m}$ that has an infinite line of positive charge running along its axis. The charge per unit length on the line is $\\lambda = 3.00\\ \\mu\\text{C/m}$.",
        parts: [
          { id: "hw2_p3a", prompt: "(a) What is the electric flux through the cylinder due to this infinite line of charge?", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p3b", prompt: "(b) What is the flux through the cylinder if its radius is increased to $r = 0.500\\text{ m}$?", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p3c", prompt: "(c) What is the flux through the cylinder if its length is increased to $l = 0.800\\text{ m}$ (with the radius back at $0.250\\text{ m}$)?", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p3d", prompt: "(d) Explain why changing the radius does not change the flux, while changing the length does.", answerType: "text" },
        ],
      },
      // 22.10 — flux through three spheres enclosing different subsets of two point charges.
      // Deliberately SIGNED (no nonNegative in the key): which charges are enclosed, and the sign
      // that results, is the whole question.
      {
        id: "hw2_p4",
        prompt: "A point charge $q_1 = 4.00\\text{ nC}$ is located on the $x$-axis at $x = 2.00\\text{ m}$, and a second point charge $q_2 = -6.00\\text{ nC}$ is on the $y$-axis at $y = 1.00\\text{ m}$. What is the total electric flux due to these two point charges through a spherical surface centered at the origin with the radius given in each part?\n\nElectric flux is a signed quantity: give each answer with its sign, where a negative value means a net flux inward.",
        parts: [
          { id: "hw2_p4a", prompt: "(a) Radius $0.500\\text{ m}$.", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p4b", prompt: "(b) Radius $1.50\\text{ m}$.", answerType: "numeric", unit: "N·m²/C" },
          { id: "hw2_p4c", prompt: "(c) Radius $2.50\\text{ m}$.", answerType: "numeric", unit: "N·m²/C" },
        ],
      },
      // 22.14 — field outside and inside a charged conductor
      {
        id: "hw2_p5",
        prompt: "A solid metal sphere with radius $0.450\\text{ m}$ carries a net charge of $0.250\\text{ nC}$.",
        parts: [
          { id: "hw2_p5a", prompt: "(a) Find the magnitude of the electric field at a point $0.100\\text{ m}$ outside the surface of the sphere.", answerType: "numeric", unit: "N/C" },
          { id: "hw2_p5b", prompt: "(b) Find the magnitude of the electric field at a point inside the sphere, $0.100\\text{ m}$ below the surface.", answerType: "numeric", unit: "N/C" },
          { id: "hw2_p5c", prompt: "(c) Justify your answer to part (b) using Gauss's law.", answerType: "text" },
        ],
      },
      // 22.15 — force between two parallel line charges
      {
        id: "hw2_p6",
        prompt: "Two very long uniform lines of charge are parallel and are separated by $0.300\\text{ m}$. Each line of charge has charge per unit length $+5.20\\ \\mu\\text{C/m}$. What magnitude of force does one line of charge exert on a $0.0500\\text{-m}$ section of the other line of charge?",
        answerType: "numeric", unit: "N",
      },
      // 22.26 — work-energy theorem in the (distance-independent) field of a charged sheet
      {
        id: "hw2_p7",
        prompt: "An electron is released from rest at a distance of $0.300\\text{ m}$ from a large insulating sheet of charge that has uniform surface charge density $+2.90\\times10^{-12}\\text{ C/m}^2$.",
        parts: [
          { id: "hw2_p7a", prompt: "(a) How much work is done on the electron by the electric field of the sheet as the electron moves from its initial position to a point $0.050\\text{ m}$ from the sheet?", answerType: "numeric", unit: "J" },
          { id: "hw2_p7b", prompt: "(b) What is the speed of the electron when it is $0.050\\text{ m}$ from the sheet?", answerType: "numeric", unit: "m/s" },
        ],
      },
      // 22.42 — uniformly charged solid cylinder: symbolic inside/outside fields, the match at the
      // surface, and the sketch. No numbers anywhere in this problem, so no numeric parts.
      {
        id: "hw2_p8",
        prompt: "A very long, solid cylinder with radius $R$ has positive charge uniformly distributed throughout it, with charge per unit volume $\\rho$.",
        parts: [
          { id: "hw2_p8a", prompt: "(a) Derive the expression for the electric field inside the volume at a distance $r$ from the axis of the cylinder, in terms of the charge density $\\rho$. Enter your expression for $E$ (you may use $\\epsilon_0$ or $k$).", answerType: "math" },
          { id: "hw2_p8b", prompt: "(b) What is the electric field at a point outside the volume, in terms of the charge per unit length $\\lambda$ in the cylinder? Enter your expression for $E$.", answerType: "math" },
          { id: "hw2_p8c", prompt: "(c) Compare the answers to parts (a) and (b) for $r = R$.", answerType: "text" },
          {
            id: "hw2_p8d",
            prompt: "(d) Graph the electric-field magnitude as a function of $r$ from $r = 0$ to $r = 3R$.\n\nThe axes are scaled so no numbers are needed: measure $r$ in units of $R$ (so the surface is at $1$), and measure $E$ in units of its value at the surface, $\\rho R/2\\epsilon_0$ (so the field at the surface is $1$). Sketch the inside and the outside pieces as two separate curves.",
            answerType: "graph",
            graph: {
              xLabel: "r  (in units of R)", yLabel: "E  (in units of ρR/2ε₀)",
              xMin: 0, xMax: 3, yMin: 0, yMax: 1.2, xTick: 0.5, yTick: 0.2,
              curves: [
                { id: "inside", label: "Inside (r ≤ R)", color: "#60a5fa" },
                { id: "outside", label: "Outside (r ≥ R)", color: "#f59e0b" },
              ],
              // Inside: E = ρr/2ε₀, so E/E_R = r/R — a straight line from the origin to (1, 1).
              // Outside: E = λ/2πε₀r with λ = ρπR², so E/E_R = R/r — a 1/r decay through
              // (1.5, 0.667), (2, 0.5), (3, 0.333), convex (concave up).
              key: {
                inside: { points: [[0, 0], [0.5, 0.5], [1, 1]], shape: "line", yTolFrac: 0.08 },
                outside: { points: [[1, 1], [1.5, 0.6667], [2, 0.5], [3, 0.3333]], shape: "curveUp", yTolFrac: 0.08 },
              },
              guide: {
                title: "How to plot it",
                steps: [
                  {
                    curve: "inside", minPoints: 2, shape: "line",
                    label: "From the axis out to the surface: place the value at $r = 0$ and at $r = R$; shape “Straight”.",
                    note: "Use your part (a) result. A Gaussian cylinder of radius $r < R$ encloses only the fraction of the charge that lies inside it, and that enclosed charge grows as $r^2$ while the area it is spread over grows as $r$.",
                  },
                  {
                    curve: "outside", minPoints: 3, shape: "curveUp",
                    label: "From the surface out to $3R$: place the value at $r = R$, at $r = 2R$ and at $r = 3R$; shape “Curve ↑”.",
                    note: "Use your part (b) result. Outside the cylinder the whole charge is enclosed no matter how large the Gaussian surface is, so only the area it is spread over changes. Your part (c) comparison fixes where this curve has to start.",
                  },
                ],
              },
            },
          },
        ],
      },
      // 22.43 — charged ball on a thread beside a charged sheet.
      // FIGURE NOTE: Y&F's Fig. P22.43 is WRONG — it draws the positive ball deflected TOWARD the
      // positively charged sheet, i.e. attracted. The figure served here is drawn for this app
      // (source SVG alongside the PNG) with the ball pushed AWAY from the sheet, and marks the
      // sheet's charge as positive so the direction is checkable rather than asserted.
      // Opens with an `fbd` part, like 21.73, but with the tension's angle SYMBOLIC (`angleSymbol`).
      // The difference between the two problems is which quantities are given: 21.73 states the
      // string angle, so the tension direction can be keyed at ±5° and annotated with its number.
      // Here that angle is the unknown, so the diagram names it θ and the tension is graded on the
      // qualitative fact the FBD actually establishes — that it leans back along the string, up and
      // toward the sheet. See the wide angleTol below.
      {
        id: "hw2_p9",
        figure: "/homeworkFigures/physics2/HW2/figP22-43.png", figureWidth: 260,  // natural 920×1080 (drawn at 2x for retina)
        prompt: "A small sphere with a mass of $4.00\\times10^{-6}\\text{ kg}$ and carrying a charge of $5.00\\times10^{-8}\\text{ C}$ hangs from a thread near a very large, charged insulating sheet, as shown in the figure. The charge density on the surface of the sheet is uniform and equal to $2.50\\times10^{-9}\\text{ C/m}^2$.\n\nIn the figure the sheet is on the left and the sphere hangs to the right of the vertical.",
        parts: [
          {
            id: "hw2_p9_fbd", answerType: "fbd",
            prompt: "(a) Draw a complete, labeled free-body diagram for the sphere. Add every force from the bank, assign your positive axes, and show the sphere's acceleration. You do not know the thread's angle yet, so draw the tension roughly along the thread as pictured; the diagram will mark that angle $\\theta$ for you to solve for in part (b).",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "sphere",
              bank: ["F", "T", "N", "w"],
              // Label the off-axis angle rather than measuring it: it is this problem's unknown.
              angleSymbol: "θ",
              forces: [
                // Tension runs from the sphere back up the thread toward the support, so it leans
                // TOWARD the sheet (up and to the left) while the electric force pushes away.
                //
                // The key direction is 25° from vertical, [-sin 25°, cos 25°], which is the figure's
                // schematic thread angle, and the tolerance is deliberately wide (±22°, accepting
                // roughly 3° to 47° from the vertical) rather than the house ±5°. That is not
                // laxness: at FBD time the given data have not yet fixed this angle, so a tight
                // window would grade an answer the student is not yet in a position to have. What
                // the FBD does establish is graded, and the band enforces it — the arrow must lean
                // toward the sheet, so a straight-up tension (25° away, outside the band) is
                // rejected, which is the real error: with no horizontal component nothing balances
                // the electric force. `angleSymbol` also keeps snapFBDDirections off this arrow, so
                // it stays exactly where the student drew it.
                { type: "T", dir: [-0.42262, 0.90631], angleTol: 22, angleSymbol: "θ" },
                { type: "F", dir: [1, 0], angleTol: 5 },
                { type: "w", dir: [0, -1], angleTol: 5 },
              ],
              accel: { none: true },   // the sphere hangs in equilibrium
            },
          },
          { id: "hw2_p9_ang", prompt: "(b) Find the angle $\\theta$ of the thread, measured from the vertical.", answerType: "numeric", unit: "°" },
          { id: "hw2_p9_why", prompt: "(c) Would the angle change if the thread were made longer, or if the sphere started out closer to the sheet? Explain.", answerType: "text" },
        ],
      },
      // 22.51 — force from a uniformly charged spherical shell, outside and inside. Symbolic, so
      // the magnitude is `math` and the direction (the part worth justifying) is `text`.
      {
        id: "hw2_p10",
        prompt: "Negative charge $-Q$ is distributed uniformly over the surface of a thin spherical insulating shell with radius $R$. Calculate the force (magnitude and direction) that the shell exerts on a positive point charge $q$ located as described in each part. Give your expressions in terms of $q$, $Q$, $r$ and $R$ (you may use $\\epsilon_0$ or $k$).",
        parts: [
          { id: "hw2_p10a_m", prompt: "(a) The point charge is a distance $r > R$ from the center of the shell (outside the shell). Enter an expression for the magnitude $F$ of the force.", answerType: "math" },
          { id: "hw2_p10a_d", prompt: "(a) In what direction does that force point?", answerType: "text" },
          { id: "hw2_p10b", prompt: "(b) The point charge is a distance $r < R$ from the center of the shell (inside the shell). Calculate the force (magnitude and direction) that the shell exerts on it.", answerType: "text" },
        ],
      },
    ],
  },
  {
    id: "hw3",
    title: "Homework 3: Electric Potential",
    problems: [
      // 23.1 — work done by the electric force on a charge moving between two points.
      // Deliberately SIGNED (no nonNegative in the key): the charges are opposite, the separation
      // grows, and the resulting negative sign is the physics the problem is testing.
      {
        id: "hw3_p1",
        prompt: "A point charge $q_1 = +2.40\\ \\mu\\text{C}$ is held stationary at the origin. A second point charge $q_2 = -4.30\\ \\mu\\text{C}$ moves from the point $x = 0.150\\text{ m}$, $y = 0$ to the point $x = 0.250\\text{ m}$, $y = 0.250\\text{ m}$. How much work is done by the electric force on $q_2$?\n\nWork is a signed quantity: give your answer with its sign.",
        answerType: "numeric", unit: "J",
      },
      // 23.4 — pushing two protons together, then letting them fly apart.
      // (a) asks for the work the EXTERNAL agent does, which is positive. The instructor key boxes
      // the negative of this (the work done by the electric force), so the prompt names the agent
      // explicitly and the key entry carries nonNegative so a sign slip is nudged, not penalized.
      {
        id: "hw3_p2",
        prompt: "Two protons are pushed together, then released.",
        parts: [
          { id: "hw3_p2a", prompt: "(a) How much work would it take to push the two protons very slowly from a separation of $2.00\\times10^{-10}\\text{ m}$ (a typical atomic distance) to $3.00\\times10^{-15}\\text{ m}$ (a typical nuclear distance)?", answerType: "numeric", unit: "J" },
          { id: "hw3_p2b", prompt: "(b) If the protons are both released from rest at the closer distance in part (a), how fast is each one moving when they reach their original separation?", answerType: "numeric", unit: "m/s" },
        ],
      },
      // 23.8 — U of three equal charges at the corners of an equilateral triangle: three identical
      // pairs, so U = 3kq^2/r. The instructor key's boxed value is off by a factor of 10.
      {
        id: "hw3_p3",
        prompt: "Three equal $1.20\\ \\mu\\text{C}$ point charges are placed at the corners of an equilateral triangle whose sides are $0.500\\text{ m}$ long. What is the potential energy of the system? (Take as zero the potential energy of the three charges when they are infinitely far apart.)",
        answerType: "numeric", unit: "J",
      },
      // 23.13 — energy conservation with U = qV. The "faster or slower" half is the real content
      // (a negative charge speeding up as it moves to HIGHER potential), so it is a text part.
      {
        id: "hw3_p4",
        prompt: "A small particle has charge $-5.00\\ \\mu\\text{C}$ and mass $2.00\\times10^{-4}\\text{ kg}$. It moves from point $A$, where the electric potential is $V_A = +200\\text{ V}$, to point $B$, where the electric potential is $V_B = +800\\text{ V}$. The electric force is the only force acting on the particle. The particle has speed $5.00\\text{ m/s}$ at point $A$.",
        parts: [
          { id: "hw3_p4a", prompt: "(a) What is its speed at point $B$?", answerType: "numeric", unit: "m/s" },
          { id: "hw3_p4b", prompt: "(b) Is it moving faster or slower at $B$ than at $A$? Explain.", answerType: "text" },
        ],
      },
      // 23.19 — potential from two point charges, then work from the potential difference.
      // NOTE the direction in (c): the charge travels from B to A, so W = q(V_B - V_A) and the
      // result is POSITIVE. The instructor key computed A -> B and boxed the opposite sign.
      {
        id: "hw3_p5",
        figure: "/homeworkFigures/physics2/HW3/figE23-19.png", figureWidth: 400,  // natural 484×316
        prompt: "Two point charges $q_1 = +2.40\\text{ nC}$ and $q_2 = -6.50\\text{ nC}$ are $0.100\\text{ m}$ apart. Point $A$ is midway between them; point $B$ is $0.080\\text{ m}$ from $q_1$ and $0.060\\text{ m}$ from $q_2$, as shown in the figure. Take the electric potential to be zero at infinity.\n\nElectric potential and work are both signed quantities: give each answer with its sign.",
        parts: [
          { id: "hw3_p5a", prompt: "(a) Find the potential at point $A$.", answerType: "numeric", unit: "V" },
          { id: "hw3_p5b", prompt: "(b) Find the potential at point $B$.", answerType: "numeric", unit: "V" },
          { id: "hw3_p5c", prompt: "(c) Find the work done by the electric field on a charge of $2.50\\text{ nC}$ that travels from point $B$ to point $A$.", answerType: "numeric", unit: "J" },
        ],
      },
      // 23.40 — E = V/d rearranged. The point of the problem is the absurdity of the number, so
      // the interpretation is a second, text part rather than being left implicit.
      {
        id: "hw3_p6",
        prompt: "Electrical Sensitivity of Sharks. Certain sharks can detect an electric field as weak as $1.0\\ \\mu\\text{V/m}$. To grasp how weak this field is, imagine producing it between two parallel metal plates by connecting an ordinary $1.5\\text{-V}$ AA battery across these plates.",
        parts: [
          { id: "hw3_p6a", prompt: "(a) How far apart would the plates have to be?", answerType: "numeric", unit: "m" },
          { id: "hw3_p6b", prompt: "(b) Comment on your answer: compare the separation you found to something familiar.", answerType: "text" },
        ],
      },
      // 23.50 — energy conservation gives the separation, then Coulomb's law gives the acceleration
      // there. Split into two parts: the distance is a genuine intermediate result, and asking for
      // it separately keeps a rounding slip in the first step from silently poisoning the second.
      {
        id: "hw3_p7",
        prompt: "A point charge $q_1 = +5.00\\ \\mu\\text{C}$ is held fixed in space. From a horizontal distance of $6.00\\text{ cm}$, a small sphere with mass $4.00\\times10^{-3}\\text{ kg}$ and charge $q_2 = +2.00\\ \\mu\\text{C}$ is fired toward the fixed charge with an initial speed of $40.0\\text{ m/s}$. Gravity can be neglected.",
        parts: [
          { id: "hw3_p7a", prompt: "(a) How far is the sphere from the fixed charge at the instant its speed is $25.0\\text{ m/s}$?", answerType: "numeric", unit: "m" },
          { id: "hw3_p7b", prompt: "(b) What is the acceleration of the sphere at the instant when its speed is $25.0\\text{ m/s}$?", answerType: "numeric", unit: "m/s²" },
        ],
      },
      // 23.56 — the Bohr atom, entirely symbolic until the last two parts. (c) is the "show that"
      // step, which is reasoning rather than a formula, so it is text between two math parts.
      {
        id: "hw3_p8",
        prompt: "In the Bohr model of the hydrogen atom, a single electron revolves around a single proton in a circle of radius $r$. Assume that the proton remains at rest.\n\nGive your symbolic answers in terms of $e$, $\\epsilon_0$, $m_e$ and $r$ (you may use $k$ in place of $\\epsilon_0$).",
        parts: [
          { id: "hw3_p8a", prompt: "(a) By equating the electric force to the electron mass times its acceleration, derive an expression for the electron's speed $v$.", answerType: "math" },
          { id: "hw3_p8b", prompt: "(b) Obtain an expression for the electron's kinetic energy $K$.", answerType: "math" },
          { id: "hw3_p8c", prompt: "(b) Show that the magnitude of the kinetic energy is just half that of the electric potential energy.", answerType: "text" },
          { id: "hw3_p8d", prompt: "(c) Obtain an expression for the total energy $E$ of the atom.", answerType: "math" },
          { id: "hw3_p8e", prompt: "(c) Evaluate the total energy using $r = 5.29\\times10^{-11}\\text{ m}$. Give your numerical result in joules.", answerType: "numeric", unit: "J" },
          { id: "hw3_p8f", prompt: "(c) Give the same numerical result in electron volts.", answerType: "numeric", unit: "eV" },
        ],
      },
      // 23.59 — an eight-charge cube. Purely symbolic (no value of q or d is given), so (a) is a
      // math expression rather than a number; the sum has 28 pairs falling into three shells:
      // 12 edges at d (opposite sign), 12 face diagonals at d*sqrt2 (same sign), 4 body diagonals
      // at d*sqrt3 (opposite sign).
      {
        id: "hw3_p9",
        figure: "/homeworkFigures/physics2/HW3/figP23-59.png", figureWidth: 360,  // natural 454×464
        prompt: "An Ionic Crystal. The figure shows eight point charges arranged at the corners of a cube with sides of length $d$. The values of the charges are $+q$ and $-q$, as shown. This is a model of one cell of a cubic ionic crystal. In sodium chloride (NaCl), for instance, the positive ions are $\\text{Na}^+$ and the negative ions are $\\text{Cl}^-$.",
        parts: [
          { id: "hw3_p9a", prompt: "(a) Calculate the potential energy $U$ of this arrangement. (Take as zero the potential energy of the eight charges when they are infinitely far apart.) Give your answer as a numerical coefficient times $q^2/\\pi\\epsilon_0 d$, or equivalently as a numerical coefficient times $kq^2/d$.", answerType: "math" },
          { id: "hw3_p9b", prompt: "(b) In part (a) you should have found that $U < 0$. Explain the relationship between this result and the observation that such ionic crystals exist in nature.", answerType: "text" },
        ],
      },
      // 23.62 — charged sphere hanging between parallel plates. Same shape as 22.43, but here the
      // thread's angle is GIVEN, so (like 21.73) the tension is keyed at the house-standard +/-5 deg
      // and the field is what gets solved for. (c) makes the plates' polarity an explicit deduction
      // rather than something the figure quietly asserts.
      {
        id: "hw3_p10",
        figure: "/homeworkFigures/physics2/HW3/figP23-62.png", figureWidth: 320,  // natural 474×404
        prompt: "A small sphere with mass $1.50\\text{ g}$ hangs by a thread between two parallel vertical plates $5.00\\text{ cm}$ apart, as shown in the figure. The plates are insulating and have uniform surface charge densities $+\\sigma$ and $-\\sigma$. The charge on the sphere is $q = 8.90\\times10^{-6}\\text{ C}$. In the figure the sphere is displaced toward the right-hand plate.",
        parts: [
          {
            id: "hw3_p10_fbd", answerType: "fbd",
            prompt: "(a) Draw a complete, labeled free-body diagram for the sphere. Add every force from the bank, assign your positive axes, and show the sphere's acceleration.",
            fbd: {
              xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, xTick: 1, yTick: 1, snapDiv: 30,
              origin: [0, 0], bodyLabel: "sphere",
              bank: ["F", "T", "N", "w"],
              forces: [
                // The thread runs from the sphere back up to the support, and the sphere hangs to
                // the RIGHT of vertical, so the tension leans up and to the LEFT: 30.0 deg from
                // vertical, [-sin 30, cos 30]. The angle is given here (unlike 22.43), so the
                // standard +/-5 deg applies and the field's arc annotation states the real 30 deg.
                { type: "T", dir: [-0.5, 0.86603], angleTol: 5 },
                // The sphere is pushed toward the right-hand plate, so the electric force is +x.
                { type: "F", dir: [1, 0], angleTol: 5 },
                { type: "w", dir: [0, -1], angleTol: 5 },
              ],
              accel: { none: true },   // the sphere hangs in equilibrium
            },
          },
          { id: "hw3_p10_v", prompt: "(b) What potential difference between the plates will cause the thread to assume an angle of $30.0°$ with the vertical?", answerType: "numeric", unit: "V" },
          { id: "hw3_p10_p", prompt: "(c) Which plate is at the higher potential, the left one or the right one? Explain.", answerType: "text" },
        ],
      },
    ],
  },
  {
    id: "hw4",
    title: "Homework 4: Capacitance & Dielectrics",
    // WORDING: every prompt below is the Y&F problem text VERBATIM. The only adaptations are the
    // two the app forces: "Fig. E24.16" etc. becomes "the figure" (the served crops carry no
    // caption, and there is no figure numbering in the runner), and a part the textbook asks once
    // about "each capacitor" becomes one blank per capacitor, naming it by its label or its
    // printed value. Nothing is added: no unit instructions (the `unit` label renders beside the
    // input field, which is the affordance), no method hints, and no parts beyond the textbook's.
    problems: [
      // 24.1 — parallel-plate basics: V = Ed, then C = Q/V and A from C = eps0 A/d
      {
        id: "hw4_p1",
        prompt: "The plates of a parallel-plate capacitor are $2.50\\text{ mm}$ apart, and each carries a charge of magnitude $80.0\\text{ nC}$. The plates are in vacuum. The electric field between the plates has a magnitude of $4.00\\times10^{6}\\text{ V/m}$.",
        parts: [
          { id: "hw4_p1a", prompt: "(a) What is the potential difference between the plates?", answerType: "numeric", unit: "V" },
          { id: "hw4_p1b", prompt: "(b) What is the area of each plate?", answerType: "numeric", unit: "cm²" },
          { id: "hw4_p1c", prompt: "(c) What is the capacitance?", answerType: "numeric", unit: "pF" },
        ],
      },
      // 24.10 — cylindrical capacitor: invert C = 2 pi eps0 L / ln(rb/ra) for the outer radius
      {
        id: "hw4_p2",
        prompt: "A cylindrical capacitor consists of a solid inner conducting core with radius $0.250\\text{ cm}$, surrounded by an outer hollow conducting tube. The two conductors are separated by air, and the length of the cylinder is $12.0\\text{ cm}$. The capacitance is $36.7\\text{ pF}$.",
        parts: [
          { id: "hw4_p2a", prompt: "(a) Calculate the inner radius of the hollow tube.", answerType: "numeric", unit: "mm" },
          { id: "hw4_p2b", prompt: "(b) When the capacitor is charged to $125\\text{ V}$, what is the charge per unit length $\\lambda$ on the capacitor?", answerType: "numeric", unit: "nC/m" },
        ],
      },
      // 24.16 — one parallel pair, then that pair in series with a third
      {
        id: "hw4_p3",
        figure: "/homeworkFigures/physics2/HW4/figE24-16.png", figureWidth: 220,  // natural 470x606 (tall/narrow)
        prompt: "For the system of capacitors shown in the figure, find the equivalent capacitance.",
        parts: [
          { id: "hw4_p3a", prompt: "(a) Between $b$ and $c$.", answerType: "numeric", unit: "pF" },
          { id: "hw4_p3b", prompt: "(b) Between $a$ and $c$.", answerType: "numeric", unit: "pF" },
        ],
      },
      // 24.17 — the set's fullest network: series inside parallel inside series. Every capacitor is
      // the same 4.00 uF, so nothing can be read off by size; the bookkeeping is the whole problem.
      // "the charge on each capacitor" / "the potential difference across each capacitor" become
      // one blank per capacitor. C1 and C2 each get their own blank rather than sharing one with a
      // note that they match, since "they are in series so their charges are equal" is exactly what
      // the problem is testing and must not be handed over in the prompt.
      {
        id: "hw4_p4",
        figure: "/homeworkFigures/physics2/HW4/figE24-17.png", figureWidth: 340,  // natural 470x414
        prompt: "In the figure, each capacitor has $C = 4.00\\ \\mu\\text{F}$ and $V_{ab} = +28.0\\text{ V}$.",
        parts: [
          { id: "hw4_p4a_q1", prompt: "(a) Calculate the charge on $C_1$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p4a_q2", prompt: "(a) Calculate the charge on $C_2$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p4a_q3", prompt: "(a) Calculate the charge on $C_3$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p4a_q4", prompt: "(a) Calculate the charge on $C_4$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p4b_v1", prompt: "(b) Calculate the potential difference across $C_1$.", answerType: "numeric", unit: "V" },
          { id: "hw4_p4b_v2", prompt: "(b) Calculate the potential difference across $C_2$.", answerType: "numeric", unit: "V" },
          { id: "hw4_p4b_v3", prompt: "(b) Calculate the potential difference across $C_3$.", answerType: "numeric", unit: "V" },
          { id: "hw4_p4b_v4", prompt: "(b) Calculate the potential difference across $C_4$.", answerType: "numeric", unit: "V" },
          { id: "hw4_p4c", prompt: "(c) Calculate the potential difference between points $a$ and $d$.", answerType: "numeric", unit: "V" },
        ],
      },
      // 24.21 — two capacitors straight across ab, plus a three-capacitor series branch
      {
        id: "hw4_p5",
        figure: "/homeworkFigures/physics2/HW4/figE24-21.png", figureWidth: 340,  // natural 470x414
        prompt: "For the system of capacitors shown in the figure, a potential difference of $25\\text{ V}$ is maintained across $ab$.",
        parts: [
          { id: "hw4_p5a", prompt: "(a) What is the equivalent capacitance of this system between $a$ and $b$?", answerType: "numeric", unit: "nF" },
          { id: "hw4_p5b", prompt: "(b) How much charge is stored by this system?", answerType: "numeric", unit: "nC" },
          { id: "hw4_p5c", prompt: "(c) How much charge does the $6.5\\text{-nF}$ capacitor store?", answerType: "numeric", unit: "nC" },
          { id: "hw4_p5d", prompt: "(d) What is the potential difference across the $7.5\\text{-nF}$ capacitor?", answerType: "numeric", unit: "V" },
        ],
      },
      // 24.25 — energy density. The stated 5.80 uF is not needed (u = eps0 E^2 / 2 with E = V/d);
      // the textbook leaves that unremarked, so the app does too. Single blank, no parts.
      {
        id: "hw4_p6",
        prompt: "A $5.80\\text{-}\\mu\\text{F}$, parallel-plate, air capacitor has a plate separation of $5.00\\text{ mm}$ and is charged to a potential difference of $400\\text{ V}$. Calculate the energy density in the region between the plates, in units of $\\text{J/m}^3$.",
        answerType: "numeric", unit: "J/m³",
      },
      // 24.30 — two capacitors in SERIES. Deliberately paired with the next problem (24.31), the
      // same five questions asked of a PARALLEL network, so the two contrast directly.
      {
        id: "hw4_p7",
        figure: "/homeworkFigures/physics2/HW4/figE24-30.png", figureWidth: 400,  // natural 464x138 (wide/short)
        prompt: "For the capacitor network shown in the figure, the potential difference across $ab$ is $36\\text{ V}$.",
        parts: [
          { id: "hw4_p7a", prompt: "(a) Find the total charge stored in this network.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p7b_150", prompt: "(b) Find the charge on the $150\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p7b_120", prompt: "(b) Find the charge on the $120\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p7c", prompt: "(c) Find the total energy stored in the network.", answerType: "numeric", unit: "μJ" },
          { id: "hw4_p7d_150", prompt: "(d) Find the energy stored in the $150\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μJ" },
          { id: "hw4_p7d_120", prompt: "(d) Find the energy stored in the $120\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μJ" },
          { id: "hw4_p7e_150", prompt: "(e) Find the potential difference across the $150\\text{-nF}$ capacitor.", answerType: "numeric", unit: "V" },
          { id: "hw4_p7e_120", prompt: "(e) Find the potential difference across the $120\\text{-nF}$ capacitor.", answerType: "numeric", unit: "V" },
        ],
      },
      // 24.31 — the same five questions as 24.30, now for a PARALLEL network: the charges differ
      // and the voltages are equal, exactly the reverse of the series case.
      {
        id: "hw4_p8",
        figure: "/homeworkFigures/physics2/HW4/figE24-31.png", figureWidth: 340,  // natural 478x290
        prompt: "For the capacitor network shown in the figure, the potential difference across $ab$ is $220\\text{ V}$.",
        parts: [
          { id: "hw4_p8a", prompt: "(a) Find the total charge stored in this network.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p8b_35", prompt: "(b) Find the charge on the $35\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p8b_75", prompt: "(b) Find the charge on the $75\\text{-nF}$ capacitor.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p8c", prompt: "(c) Find the total energy stored in the network.", answerType: "numeric", unit: "mJ" },
          { id: "hw4_p8d_35", prompt: "(d) Find the energy stored in the $35\\text{-nF}$ capacitor.", answerType: "numeric", unit: "mJ" },
          { id: "hw4_p8d_75", prompt: "(d) Find the energy stored in the $75\\text{-nF}$ capacitor.", answerType: "numeric", unit: "mJ" },
          { id: "hw4_p8e_35", prompt: "(e) Find the potential difference across the $35\\text{-nF}$ capacitor.", answerType: "numeric", unit: "V" },
          { id: "hw4_p8e_75", prompt: "(e) Find the potential difference across the $75\\text{-nF}$ capacitor.", answerType: "numeric", unit: "V" },
        ],
      },
      // 24.36 — the set's only dielectric problem
      {
        id: "hw4_p9",
        prompt: "A parallel-plate capacitor has capacitance $C_0 = 5.00\\text{ pF}$ when there is air between the plates. The separation between the plates is $1.50\\text{ mm}$.",
        parts: [
          { id: "hw4_p9a", prompt: "(a) What is the maximum magnitude of charge $Q$ that can be placed on each plate if the electric field in the region between the plates is not to exceed $3.00\\times10^{4}\\text{ V/m}$?", answerType: "numeric", unit: "pC" },
          { id: "hw4_p9b", prompt: "(b) A dielectric with $K = 2.70$ is inserted between the plates of the capacitor, completely filling the volume between the plates. Now what is the maximum magnitude of charge on each plate if the electric field between the plates is not to exceed $3.00\\times10^{4}\\text{ V/m}$?", answerType: "numeric", unit: "pC" },
        ],
      },
      // 24.63 — a repeating ladder. It is not solvable by one series/parallel step: the network has
      // to be collapsed from the far end inward, one rung at a time, and each rung happens to
      // return the same 6.9 uF, which is what makes the reduction terminate cleanly. The textbook
      // says "the three capacitors nearest a and b" — the two C1 rails and the C2 bridging them.
      {
        id: "hw4_p10",
        figure: "/homeworkFigures/physics2/HW4/figP24-63.png", figureWidth: 400,  // natural 424x270
        prompt: "In the figure, each capacitance $C_1$ is $6.9\\ \\mu\\text{F}$, and each capacitance $C_2$ is $4.6\\ \\mu\\text{F}$.",
        parts: [
          { id: "hw4_p10a", prompt: "(a) Compute the equivalent capacitance of the network between points $a$ and $b$.", answerType: "numeric", unit: "μF" },
          { id: "hw4_p10b_c1a", prompt: "(b) When $V_{ab} = 420\\text{ V}$, compute the charge on the $C_1$ nearest $a$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p10b_c1b", prompt: "(b) When $V_{ab} = 420\\text{ V}$, compute the charge on the $C_1$ nearest $b$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p10b_c2", prompt: "(b) When $V_{ab} = 420\\text{ V}$, compute the charge on the $C_2$ nearest $a$ and $b$.", answerType: "numeric", unit: "μC" },
          { id: "hw4_p10c", prompt: "(c) With $420\\text{ V}$ across $a$ and $b$, compute $V_{cd}$.", answerType: "numeric", unit: "V" },
        ],
      },
    ],
  },
  {
    id: "hw5",
    title: "Homework 5: Current, Resistance, & Electromotive Force",
    // WORDING: every prompt below is the Y&F problem text VERBATIM, with only the adaptations the
    // app forces:
    //   - "Fig. E25.38" / "Fig. P25.83" becomes "the figure" (the served crops carry no caption).
    //   - 25.77's "The table below shows..." becomes "The table shows...": the runner renders the
    //     figure ABOVE the prompt, so "below" would point the wrong way.
    //   - 25.40's "(see Problem 25.39)" becomes "(see the previous problem)" — 25.39 IS the
    //     previous problem here, but the runner has no problem numbering to point at.
    //   - A part asking one question about two objects ("How much current does each bulb draw")
    //     becomes one blank per object, named by the source's own label.
    //   - "magnitude and direction" splits into a numeric magnitude + a text direction, since a
    //     numeric item holds one value (same treatment as hw1 21.29).
    //   - Units live in `unit`, which renders beside the input box.
    // Deliberate instructor edits, requested for this set (NOT wording drift):
    //   - 25.40 and 25.41 are condensed into ONE multipart problem (hw5_p5). They are the same
    //     bulb-rating idea run twice (a US bulb in Europe, then a European bulb in the US), and
    //     25.41 already opens by citing 25.40. The shared European-voltage sentence is 25.41's
    //     own stem text, so nothing is invented: (a) is 25.40, (b)/(c) are 25.41(a)/(b).
    //   - 25.77 part (a) is SKIPPED and the surviving parts are RELABELLED (b)/(c)/(d) -> (a)/(b)/(c),
    //     so the student reads "(a)" under the heading "Part 1 of 3" instead of a stray "(b)".
    //     The two internal back-references are rewritten to match: what the textbook calls "the
    //     gauge found in part (b)" is "the gauge found in part (a)" here, in both (b) and (c).
    //     Item ids follow the NEW letters (hw5_p8a/b/c). When cross-checking against the
    //     instructor key PDF, note it still uses the textbook letters: app (a)/(b)/(c) = key
    //     (b)/(c)/(d).
    //   - 25.83 and 25.84 carry an authored `freeHint` (always visible, no credit cost). Both
    //     problems hinge on one circuit reading that is not what the problem is assessing: a
    //     fully charged capacitor branch carries no current, and elements in parallel share a
    //     voltage. Without it the problem tests noticing rather than the physics.
    problems: [
      // 25.5 — drift velocity. t = L/v_d with v_d = I/(n|q|A), so t scales as the AREA: the
      // 6-gauge wire's diameter is 2.01x the 12-gauge one, so (b) is 4.04x (a). That ratio is
      // exactly what (c) asks the student to state in words.
      {
        id: "hw5_p1",
        prompt: "Copper has $8.5\\times10^{28}$ free electrons per cubic meter. A $71.0\\text{-cm}$ length of 12-gauge copper wire that is $2.05\\text{ mm}$ in diameter carries $4.85\\text{ A}$ of current.",
        parts: [
          { id: "hw5_p1a", prompt: "(a) How much time does it take for an electron to travel the length of the wire?", answerType: "numeric", unit: "min" },
          { id: "hw5_p1b", prompt: "(b) Repeat part (a) for 6-gauge copper wire (diameter $4.12\\text{ mm}$) of the same length that carries the same current.", answerType: "numeric", unit: "min" },
          { id: "hw5_p1c", prompt: "(c) Generally speaking, how does changing the diameter of a wire that carries a given amount of current affect the drift velocity of the electrons in the wire?", answerType: "text" },
        ],
      },
      // 25.14 — rho = RA/L = 1.47e-8 ohm*m, which is silver. The figure is Table 25.1, without
      // which the problem is unanswerable: it asks the student to match a computed resistivity
      // against the tabulated values.
      {
        id: "hw5_p2",
        figure: "/homeworkFigures/physics2/HW5/table25-1.png", figureWidth: 700,  // natural 1724x629 (wide reference table; needs the extra width to stay legible)
        prompt: "A wire $6.50\\text{ m}$ long with diameter of $2.05\\text{ mm}$ has a resistance of $0.0290\\ \\Omega$. What material is the wire most likely made of?",
        answerType: "text",
      },
      // 25.38 — two opposing batteries in one loop. Both + terminals face left in the figure, so
      // around the loop they oppose: V_net = 16.0 - 8.0 = 8.0 V and I = 8.0/17 = 0.47 A. The
      // 16.0-V battery wins, so it discharges (V_ab = eps - Ir) and the 8.0-V one is charged.
      {
        id: "hw5_p3",
        figure: "/homeworkFigures/physics2/HW5/figE25-38.png", figureWidth: 400,  // natural 484x259
        prompt: "The circuit shown in the figure contains two batteries, each with an emf and an internal resistance, and two resistors.",
        parts: [
          { id: "hw5_p3a_m", prompt: "(a) Find the magnitude of the current in the circuit.", answerType: "numeric", unit: "A" },
          { id: "hw5_p3a_d", prompt: "(a) Find the direction of the current in the circuit.", answerType: "text" },
          { id: "hw5_p3b", prompt: "(b) Find the terminal voltage $V_{ab}$ of the $16.0\\text{-V}$ battery.", answerType: "numeric", unit: "V" },
        ],
      },
      // 25.39 — the definition of a power rating. R = V^2/P and I = P/V at the rated 120 V.
      // "each bulb" in (c) becomes one blank per bulb, named by its printed wattage.
      {
        id: "hw5_p4",
        prompt: "Light Bulbs. The power rating of a light bulb (such as a $100\\text{-W}$ bulb) is the power it dissipates when connected across a $120\\text{-V}$ potential difference.",
        parts: [
          { id: "hw5_p4a", prompt: "(a) What is the resistance of a $100\\text{-W}$ bulb?", answerType: "numeric", unit: "Ω" },
          { id: "hw5_p4b", prompt: "(b) What is the resistance of a $60\\text{-W}$ bulb?", answerType: "numeric", unit: "Ω" },
          { id: "hw5_p4c_100", prompt: "(c) How much current does the $100\\text{-W}$ bulb draw in normal use?", answerType: "numeric", unit: "A" },
          { id: "hw5_p4c_60", prompt: "(c) How much current does the $60\\text{-W}$ bulb draw in normal use?", answerType: "numeric", unit: "A" },
        ],
      },
      // 25.40 + 25.41, condensed into one problem at the instructor's request. The point of both
      // is that the RESISTANCE is the fixed property and the rating is not: a bulb run off its
      // rated voltage dissipates V^2/R at the new voltage. (a) runs a US bulb hot in Europe
      // (75 W -> 252 W); (b)/(c) run a European bulb cool in the US (100 W -> 29.8 W).
      {
        id: "hw5_p5",
        prompt: "European Light Bulb. In Europe the standard voltage in homes is $220\\text{ V}$ instead of the $120\\text{ V}$ used in the United States. Therefore a \"$100\\text{-W}$\" European bulb would be intended for use with a $220\\text{-V}$ potential difference.",
        parts: [
          { id: "hw5_p5a", prompt: "(a) If a \"$75\\text{-W}$\" bulb (see the previous problem) is connected across a $220\\text{-V}$ potential difference (as is used in Europe), how much power does it dissipate?", answerType: "numeric", unit: "W" },
          { id: "hw5_p5b", prompt: "(b) If you bring a \"$100\\text{-W}$\" European bulb home to the United States, what should be its U.S. power rating?", answerType: "numeric", unit: "W" },
          { id: "hw5_p5c", prompt: "(c) How much current will the $100\\text{-W}$ European bulb draw in normal use in the United States?", answerType: "numeric", unit: "A" },
        ],
      },
      // 25.68 — the same opposing-battery idea as 25.38, now with four resistors and a follow-up
      // that reverses the current. In (a)/(b) the 8.00-V battery drives 1/6 A clockwise against
      // the 4.00-V one, which is therefore being CHARGED (terminal voltage eps + Ir = 4.08 V).
      // In (c) the inserted 10.30-V battery is tied negative-to-negative with the 8.00-V one, so
      // it opposes the 8.00 V and AIDS the 4.00 V: the net emf becomes 10.30 + 4.00 - 8.00 =
      // 6.30 V counterclockwise, and the 4.00-V battery now discharges (eps - Ir = 3.87 V).
      // There is no shared stem sentence in the source; part (a) names the figure itself.
      {
        id: "hw5_p6",
        figure: "/homeworkFigures/physics2/HW5/figP25-68.png", figureWidth: 400,  // natural 472x277
        parts: [
          { id: "hw5_p6a", prompt: "(a) What is the potential difference $V_{ad}$ in the circuit of the figure?", answerType: "numeric", unit: "V" },
          { id: "hw5_p6b", prompt: "(b) What is the terminal voltage of the $4.00\\text{-V}$ battery?", answerType: "numeric", unit: "V" },
          { id: "hw5_p6c", prompt: "(c) A battery with emf $10.30\\text{ V}$ and internal resistance $0.50\\ \\Omega$ is inserted in the circuit at $d$, with its negative terminal connected to the negative terminal of the $8.00\\text{-V}$ battery. What is the difference of potential $V_{bc}$ between the terminals of the $4.00\\text{-V}$ battery now?", answerType: "numeric", unit: "V" },
        ],
      },
      // 25.73 — the set's only non-ohmic element. Kirchhoff gives 12.6 = 3.2I + 3.8I + 1.3I^2,
      // i.e. 1.3I^2 + 7.0I - 12.6 = 0, whose positive root is 1.42 A (the negative root, -6.81 A,
      // is discarded: it would mean current running backward through the battery).
      {
        id: "hw5_p7",
        prompt: "A $12.6\\text{-V}$ car battery with negligible internal resistance is connected to a series combination of a $3.2\\text{-}\\Omega$ resistor that obeys Ohm's law and a thermistor that does not obey Ohm's law but instead has a current–voltage relationship $V = \\alpha I + \\beta I^2$, with $\\alpha = 3.8\\ \\Omega$ and $\\beta = 1.3\\ \\Omega/\\text{A}$. What is the current through the $3.2\\text{-}\\Omega$ resistor?",
        answerType: "numeric", unit: "A",
      },
      // 25.77 — household wiring. The textbook's part (a) is skipped per the instructor, and the
      // rest are relabelled (b)/(c)/(d) -> (a)/(b)/(c); the letters below are the APP's.
      // (a) I = P/V = 35 A, and the table's thinnest wire rated at or above that is 8-gauge
      // (40 A); 10-gauge tops out at 30 A. (b)/(c) then need rho for COPPER, so the figure stacks
      // the problem's own wire-gauge table on top of Table 25.1 — one figure slot, both required.
      {
        id: "hw5_p8",
        figure: "/homeworkFigures/physics2/HW5/figP25-77-tables.png", figureWidth: 700,  // natural 1748x1001 (wire-gauge table + Table 25.1 stacked)
        prompt: "According to the U.S. National Electrical Code, copper wire used for interior wiring of houses, hotels, office buildings, and industrial plants is permitted to carry no more than a specified maximum amount of current. The table shows the maximum current $I_{max}$ for several common sizes of wire with varnished cambric insulation. The \"wire gauge\" is a standard used to describe the diameter of wires. Note that the larger the diameter of the wire, the smaller the wire gauge.",
        parts: [
          { id: "hw5_p8a", prompt: "(a) A total of $4200\\text{ W}$ of power is to be supplied through the wires of a house to the household electrical appliances. If the potential difference across the group of appliances is $120\\text{ V}$, determine the gauge of the thinnest permissible wire that can be used.", answerType: "numeric", unit: "gauge" },
          { id: "hw5_p8b", prompt: "(b) Suppose the wire used in this house is of the gauge found in part (a) and has total length $42.0\\text{ m}$. At what rate is energy dissipated in the wires?", answerType: "numeric", unit: "W" },
          // NOTE: this prompt contains a literal "$0.11" and therefore must contain NO other "$".
          // MathText treats $...$ as math delimiters, so a second dollar anywhere in the string
          // would pair with this one and swallow the text between them as LaTeX. A single
          // unpaired "$" is rendered literally, which is exactly what is wanted here.
          { id: "hw5_p8c", prompt: "(c) The house is built in a community where the consumer cost of electric energy is $0.11 per kilowatt-hour. If the house were built with wire of the next larger diameter than that found in part (a), what would be the savings in electricity costs in one year? Assume that the appliances are kept on for an average of 12 hours a day.", answerType: "numeric", unit: "dollars" },
        ],
      },
      // 25.83 — Q fixes V_C = Q/C = 4.00 V; the capacitor is parallel to R_1, so V_1 = 4.00 V and
      // I = 0.667 A runs through R_2 and R_1 in series, giving eps = I(R_1 + R_2) = 6.67 V.
      // The freeHint supplies the two circuit readings the problem is not trying to assess.
      {
        id: "hw5_p9",
        figure: "/homeworkFigures/physics2/HW5/figP25-83.png", figureWidth: 400,  // natural 466x212
        prompt: "Consider the circuit shown in the figure. The emf source has negligible internal resistance. The resistors have resistances $R_1 = 6.00\\ \\Omega$ and $R_2 = 4.00\\ \\Omega$. The capacitor has capacitance $C = 9.00\\ \\mu\\text{F}$. When the capacitor is fully charged, the magnitude of the charge on its plates is $Q = 36.0\\ \\mu\\text{C}$. Calculate the emf $\\mathcal{E}$.",
        freeHint: "The capacitor and $R_1$ are connected in parallel, so the voltage across $R_1$ is the same as the voltage across the capacitor. Also, once the capacitor is fully charged, no current flows in the capacitor branch, so the current through $R_2$ is the same as the current through $R_1$.",
        answerType: "numeric", unit: "V",
      },
      // 25.84 — the same two readings as 25.83, one step further: R_2, C_1 and C_2 are all in
      // parallel, so Q_1 fixes 6.00 V across all three. (a) Q_2 = C_2 V = 36.0 uC. (b) the only
      // current in the circuit is 6.00 V / 2.00 ohm = 3.00 A through R_2, so R_1 drops the
      // remaining 54.0 V and is 18.0 ohm.
      {
        id: "hw5_p10",
        figure: "/homeworkFigures/physics2/HW5/figP25-84.png", figureWidth: 400,  // natural 477x213
        prompt: "Consider the circuit shown in the figure. The battery has emf $60.0\\text{ V}$ and negligible internal resistance. $R_2 = 2.00\\ \\Omega$, $C_1 = 3.00\\ \\mu\\text{F}$, and $C_2 = 6.00\\ \\mu\\text{F}$. After the capacitors have attained their final charges, the charge on $C_1$ is $Q_1 = 18.0\\ \\mu\\text{C}$.",
        freeHint: "$R_2$, $C_1$ and $C_2$ are all connected in parallel, so the same voltage appears across all three. Also, once the capacitors have attained their final charges, no current flows in either capacitor branch, so the current through $R_2$ is the same as the current through $R_1$.",
        parts: [
          { id: "hw5_p10a", prompt: "(a) What is the final charge on $C_2$?", answerType: "numeric", unit: "μC" },
          { id: "hw5_p10b", prompt: "(b) What is the resistance $R_1$?", answerType: "numeric", unit: "Ω" },
        ],
      },
    ],
  },
];
