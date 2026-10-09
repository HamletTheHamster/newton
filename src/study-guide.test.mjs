// Run with: node src/study-guide.test.mjs
//
// Every number here becomes a statement to a student about their own work: "these are the
// problems you did worst on". Wrong, it is silently plausible - a guide full of problems the
// student had already mastered, while the ones they failed go unmentioned, looks exactly like a
// guide that worked. It would also waste the one study session before a midterm, which is not
// recoverable. Hence: the ranking, the mastered cutoff, the no-submission fallback, and the
// stability of a built guide across sittings are all tested.
import assert from "node:assert/strict";
import {
  problemScores, classDifficulty, rankProblems, pickStudyProblems,
  buildStudyAssignment, variantSeed, studyGuideSize, isEmptyGuide,
  MIN_ATTEMPTERS_FOR_DIFFICULTY, problemAttempted, STUDY_GRADING, STUDY_PER_HW, SELECTION_NOTE,
} from "./study-guide.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

// A homework of five single-part problems, plus one multipart, mirroring the committed shape.
const hw = (id, n = 5) => ({
  id,
  title: `Homework ${id.slice(2)}`,
  problems: Array.from({ length: n }, (_, i) => ({
    id: `${id}_p${i + 1}`,
    prompt: `Problem ${i + 1} of ${id}.`,
    answerType: "numeric",
    unit: "N",
  })),
});

// A submission in the shape HomeworkRunner.buildSubmission writes. Every row it lists counts as
// attempted (one graded attempt), which is what an ordinary hand-in looks like.
const sub = (hwId, fracs) => ({
  id: "sub_1", studentId: "s1", quizId: hwId, type: "homework",
  problems: Object.entries(fracs).map(([pid, frac]) => ({ id: pid, earned: frac, max: 1, attempts: 1, status: "correct" })),
});

// The record a student leaves when they run out of time: rows for every problem in the set, but
// the ones they never reached carry no attempt, no status and no answer. A deadline
// auto-submission (src/auto-submit.js) is made almost entirely of these.
const partial = (hwId, fracs, unreached) => ({
  id: "auto_1", studentId: "s9", quizId: hwId, type: "homework",
  problems: [
    ...Object.entries(fracs).map(([pid, frac]) => ({ id: pid, earned: frac, max: 1, attempts: 2, status: "correct" })),
    ...unreached.map(pid => ({ id: pid, earned: 0, max: 1, attempts: 0, status: "open", studentAnswer: "" })),
  ],
});

console.log("\nstudy-guide: per-problem scores");

test("a problem's score is its attempt-weighted credit as a fraction", () => {
  const sc = problemScores(sub("hw1", { hw1_p1: 1, hw1_p2: 0.8, hw1_p3: 0 }));
  assert.equal(sc.hw1_p1.frac, 1);
  assert.equal(sc.hw1_p2.frac, 0.8);
  assert.equal(sc.hw1_p3.frac, 0);
});

test("a multipart problem scores by its own earned/max, not per part", () => {
  const s = { problems: [{ id: "hw1_p4", max: 1, earned: 0.3333, parts: [{ id: "a", earned: 0.3333 }] }] };
  assert.ok(Math.abs(problemScores(s).hw1_p4.frac - 0.3333) < 1e-9);
});

test("a missing or malformed record yields no scores rather than zeros", () => {
  assert.deepEqual(problemScores(null), {});
  assert.deepEqual(problemScores({ problems: [{ earned: 1 }] }), {});
});

test("max 0 cannot divide by zero", () => {
  assert.equal(problemScores({ problems: [{ id: "p", max: 0, earned: 0 }] }).p.frac, 0);
});

console.log("\nstudy-guide: ranking");

test("weakest first", () => {
  const ranked = rankProblems({
    homework: hw("hw1"),
    submission: sub("hw1", { hw1_p1: 1, hw1_p2: 0.5, hw1_p3: 0, hw1_p4: 0.8, hw1_p5: 1 }),
  });
  assert.deepEqual(ranked.map(r => r.problemId), ["hw1_p3", "hw1_p2", "hw1_p4", "hw1_p1", "hw1_p5"]);
});

test("a problem absent from the submission scores zero, not full marks", () => {
  // A student who ran out of time and never opened problem 5 has not mastered it. The record
  // simply has no row for it, and reading that as "nothing wrong here" would hide the one
  // problem they most need.
  const ranked = rankProblems({ homework: hw("hw1"), submission: sub("hw1", { hw1_p1: 1, hw1_p2: 1 }) });
  assert.equal(ranked[0].frac, 0);
  assert.ok(["hw1_p3", "hw1_p4", "hw1_p5"].includes(ranked[0].problemId));
});

test("ties break by class difficulty, hardest first", () => {
  const ranked = rankProblems({
    homework: hw("hw1", 3),
    submission: sub("hw1", { hw1_p1: 0, hw1_p2: 0, hw1_p3: 0 }),
    difficulty: { hw1_p1: 0.9, hw1_p2: 0.2, hw1_p3: 0.5 },
  });
  assert.deepEqual(ranked.map(r => r.problemId), ["hw1_p2", "hw1_p3", "hw1_p1"]);
});

test("with nothing to separate them, the homework's own order decides — so a guide is stable", () => {
  const ranked = rankProblems({ homework: hw("hw1", 3), submission: sub("hw1", { hw1_p1: 0, hw1_p2: 0, hw1_p3: 0 }) });
  assert.deepEqual(ranked.map(r => r.problemId), ["hw1_p1", "hw1_p2", "hw1_p3"]);
});

console.log("\nstudy-guide: class difficulty");

test("below the floor there is no class difficulty, only null", () => {
  const subs = Array.from({ length: MIN_ATTEMPTERS_FOR_DIFFICULTY - 1 }, () => sub("hw1", { hw1_p1: 0 }));
  assert.equal(classDifficulty(subs), null);
});

test("a problem the student never reached is not an attempt", () => {
  assert.equal(problemAttempted({ id: "p", earned: 0, max: 1, attempts: 0, status: "open", studentAnswer: "" }), false);
  assert.equal(problemAttempted({ id: "p", earned: 0, max: 1, attempts: 1, status: "open" }), true);
  // A graph/vector/fbd item live-grades with no Submit, so it resolves with attempts still 0.
  assert.equal(problemAttempted({ id: "p", attempts: 0, status: "correct" }), true);
  // Typed but never submitted still counts as having worked it.
  assert.equal(problemAttempted({ id: "p", attempts: 0, status: "open", studentAnswer: "2.4" }), true);
  assert.equal(problemAttempted({ id: "p", attempts: 0, status: "open", studentAnswer: "   " }), false);
  // Multipart: any part worked means the problem was worked.
  assert.equal(problemAttempted({ id: "p", parts: [{ attempts: 0, status: "open" }, { attempts: 3, status: "open" }] }), true);
  assert.equal(problemAttempted({ id: "p", parts: [{ attempts: 0, status: "open" }] }), false);
  assert.equal(problemAttempted(null), false);
});

test("a problem nobody reached is not 'hard' — it is unknown, and left out of the map", () => {
  // THE BUG THIS FIXES. Three students: all three found p1 hard, and two simply ran out of time
  // before p2. Averaging the unreached rows in would score p2 at 0.33 and rank it alongside a
  // problem the class genuinely could not do. Because running out of time tracks POSITION, that
  // made the last problems of every set look like the hardest.
  const subs = [
    partial("hw1", { hw1_p1: 0.2 }, ["hw1_p2"]),
    partial("hw1", { hw1_p1: 0.1 }, ["hw1_p2"]),
    sub("hw1", { hw1_p1: 0.3, hw1_p2: 1 }),
  ];
  const d = classDifficulty(subs);
  assert.ok(Math.abs(d.hw1_p1 - 0.2) < 1e-9);       // averaged over the three who attempted it
  assert.equal("hw1_p2" in d, false);                // one attempter is not evidence
});

test("an attempted problem counts even when the student earned nothing on it", () => {
  // Tried and failed is exactly the evidence this average wants; only never-reached is excluded.
  const subs = [
    partial("hw1", { hw1_p1: 0 }, ["hw1_p2"]),
    partial("hw1", { hw1_p1: 0 }, ["hw1_p2"]),
    partial("hw1", { hw1_p1: 0 }, ["hw1_p2"]),
  ];
  assert.equal(classDifficulty(subs).hw1_p1, 0);
});

test("the fallback no longer favours the end of the set", () => {
  // End to end, for the only student this ranking is ever used for. Five problems; p2 and p4 are
  // genuinely hard for everyone who reached them, while p5 was simply never reached by two of
  // the three. The guide must send them to p2 and p4, not to p5.
  const hw5 = { id: "hw1", title: "Homework 1", problems: ["hw1_p1","hw1_p2","hw1_p3","hw1_p4","hw1_p5"].map((id, i) => ({ id, prompt: `p${i+1}`, answerType: "numeric" })) };
  const classSubs = [
    partial("hw1", { hw1_p1: 1, hw1_p2: 0.2, hw1_p3: 1, hw1_p4: 0.3 }, ["hw1_p5"]),
    partial("hw1", { hw1_p1: 1, hw1_p2: 0.1, hw1_p3: 1, hw1_p4: 0.2 }, ["hw1_p5"]),
    sub("hw1", { hw1_p1: 1, hw1_p2: 0.3, hw1_p3: 1, hw1_p4: 0.4, hw1_p5: 1 }),
  ];
  const picks = pickStudyProblems({
    covers: ["hw1"], homeworks: [hw5], submissionsByHw: {},
    difficultyByHw: { hw1: classDifficulty(classSubs) },
  });
  assert.deepEqual(picks.map(p => p.problemId), ["hw1_p2", "hw1_p4", "hw1_p1"]);
  assert.equal(picks.some(p => p.problemId === "hw1_p5"), false);
});

test("ranking is a total order even when only some problems have a difficulty", () => {
  // A sparse difficulty map is now the normal case. The old comparator settled one pair by
  // difficulty and the next by position, which is not transitive: the result could depend on the
  // order the problems happened to arrive in. Same inputs shuffled must give the same guide.
  const ids = ["hw1_p1","hw1_p2","hw1_p3","hw1_p4","hw1_p5"];
  const homework = { id: "hw1", problems: ids.map(id => ({ id })) };
  const difficulty = { hw1_p2: 0.4, hw1_p4: 0.1 };   // p1, p3, p5: too few attempters
  const expected = rankProblems({ homework, submission: null, difficulty }).map(r => r.problemId);
  assert.deepEqual(expected, ["hw1_p4", "hw1_p2", "hw1_p1", "hw1_p3", "hw1_p5"]);
  const shuffled = { id: "hw1", problems: [ids[3], ids[0], ids[4], ids[1], ids[2]].map(id => ({ id })) };
  const got = rankProblems({ homework: shuffled, submission: null, difficulty })
    .map(r => r.problemId)
    .filter(id => id === "hw1_p4" || id === "hw1_p2");
  assert.deepEqual(got, ["hw1_p4", "hw1_p2"]);       // the known-difficulty pair keeps its order
});

test("at the floor it is the mean fraction earned per problem", () => {
  const subs = [
    sub("hw1", { hw1_p1: 1, hw1_p2: 0 }),
    sub("hw1", { hw1_p1: 1, hw1_p2: 0 }),
    sub("hw1", { hw1_p1: 0.4, hw1_p2: 0.3 }),
  ];
  const d = classDifficulty(subs);
  assert.ok(Math.abs(d.hw1_p1 - 0.8) < 1e-9);
  assert.ok(Math.abs(d.hw1_p2 - 0.1) < 1e-9);
});

test("an empty record is not a submission, so it cannot drag an average down", () => {
  const subs = [sub("hw1", { hw1_p1: 1 }), sub("hw1", { hw1_p1: 1 }), { problems: [] }, sub("hw1", { hw1_p1: 1 })];
  assert.equal(classDifficulty(subs).hw1_p1, 1);
});

console.log("\nstudy-guide: picks");

test("up to three per homework, weakest first", () => {
  const picks = pickStudyProblems({
    covers: ["hw1", "hw2"],
    homeworks: [hw("hw1"), hw("hw2")],
    submissionsByHw: {
      hw1: sub("hw1", { hw1_p1: 0, hw1_p2: 0.2, hw1_p3: 0.5, hw1_p4: 0.9, hw1_p5: 1 }),
      hw2: sub("hw2", { hw2_p1: 0.1, hw2_p2: 1, hw2_p3: 1, hw2_p4: 1, hw2_p5: 0.4 }),
    },
  });
  assert.deepEqual(picks.map(p => p.problemId), ["hw1_p1", "hw1_p2", "hw1_p3", "hw2_p1", "hw2_p5"]);
  assert.equal(picks.every(p => p.source === "own"), true);
});

test("a fully correct problem is never served — nobody is sent to re-do what they aced", () => {
  const picks = pickStudyProblems({
    covers: ["hw1"],
    homeworks: [hw("hw1")],
    submissionsByHw: { hw1: sub("hw1", { hw1_p1: 1, hw1_p2: 1, hw1_p3: 1, hw1_p4: 1, hw1_p5: 1 }) },
  });
  assert.deepEqual(picks, []);
});

test("rounding does not make a perfect multipart problem look imperfect", () => {
  const s = { problems: [{ id: "hw1_p1", max: 1, earned: 0.3333 + 0.3333 + 0.3333 }] };
  const picks = pickStudyProblems({ covers: ["hw1"], homeworks: [hw("hw1", 1)], submissionsByHw: { hw1: s } });
  assert.deepEqual(picks, []);
});

test("nothing handed in: the class's hardest stand in, and the reason is recorded", () => {
  const picks = pickStudyProblems({
    covers: ["hw1"],
    homeworks: [hw("hw1")],
    submissionsByHw: {},
    difficultyByHw: { hw1: { hw1_p1: 0.9, hw1_p2: 0.1, hw1_p3: 0.8, hw1_p4: 0.2, hw1_p5: 0.3 } },
  });
  assert.deepEqual(picks.map(p => p.problemId), ["hw1_p2", "hw1_p4", "hw1_p5"]);
  assert.equal(picks.every(p => p.source === "missed"), true);
});

test("nothing handed in and no class difficulty yet: the first three, never an empty guide", () => {
  const picks = pickStudyProblems({ covers: ["hw1"], homeworks: [hw("hw1")], submissionsByHw: {} });
  assert.deepEqual(picks.map(p => p.problemId), ["hw1_p1", "hw1_p2", "hw1_p3"]);
});

test("a homework that is covered but not yet authored contributes nothing", () => {
  const picks = pickStudyProblems({ covers: ["hw1", "hw9"], homeworks: [hw("hw1"), { id: "hw9", problems: [] }], submissionsByHw: {} });
  assert.equal(picks.every(p => p.hwId === "hw1"), true);
});

test("perHw is honored", () => {
  const picks = pickStudyProblems({ covers: ["hw1"], homeworks: [hw("hw1")], submissionsByHw: {}, perHw: 1 });
  assert.equal(picks.length, 1);
  assert.equal(STUDY_PER_HW, 3);
});

console.log("\nstudy-guide: the built assignment");

const GUIDE = { id: "study_midterm", title: "Midterm Study Guide", covers: ["hw1", "hw2"] };
const SPECS = {
  hw1_p2: {
    params: { F: { base: 5, min: 1, max: 9, step: 1, decimals: 0 } },
    prompt: "Problem 2 of hw1 with force {{F}} N.",
  },
};

const build = (studentId = "s1") => buildStudyAssignment({
  guide: GUIDE,
  homeworks: [hw("hw1"), hw("hw2")],
  picks: [
    { hwId: "hw1", problemId: "hw1_p2", source: "own", frac: 0.2 },
    { hwId: "hw1", problemId: "hw1_p3", source: "own", frac: 0.5 },
    { hwId: "hw2", problemId: "hw2_p1", source: "missed", frac: null },
  ],
  studentId,
  specs: SPECS,
});

test("it is homework-shaped, so the runner needs to know nothing about study guides", () => {
  const a = build();
  assert.equal(a.id, "study_midterm");
  assert.equal(a.title, "Midterm Study Guide");
  assert.equal(a.problems.length, 3);
  assert.equal(a.problems[0].answerType, "numeric");
});

test("it is ungraded and undated: no deadline to be late against", () => {
  const a = build();
  assert.equal(a.study, true);
  assert.equal(a.dueDate, null);
});

test("the grading policy is unlimited tries, unlimited hints, answer on demand", () => {
  const a = build();
  assert.equal(a.grading.maxAttempts, Infinity);
  assert.equal(a.grading.unlimitedHints, true);
  assert.equal(a.grading.revealOnDemand, true);
  // A revealed answer still earns nothing, so the summary cannot call it mastery.
  assert.equal(a.grading.revealCredit, 0);
  assert.equal(STUDY_GRADING.freeAttempts, Infinity);
});

test("every problem says which homework it came from — the premise of the whole guide", () => {
  const a = build();
  assert.deepEqual(a.problems.map(p => p._sourceHw), ["hw1", "hw1", "hw2"]);
  assert.equal(a.problems[0]._sourceTitle, "Homework 1");
  assert.deepEqual(a.problems.map(p => p._pickSource), ["own", "own", "missed"]);
});

test("a problem with a spec is re-numbered; one without is served as committed", () => {
  const a = build();
  assert.equal(a.problems[0]._variant.varied, true);
  assert.notEqual(a.problems[0].prompt, "Problem 2 of hw1 with force 5 N.");
  assert.match(a.problems[0].prompt, /^Problem 2 of hw1 with force \d N\.$/);
  assert.equal(a.problems[1]._variant.varied, false);
  assert.equal(a.problems[1].prompt, "Problem 3 of hw1.");
});

test("the same student rebuilds the identical guide — reopening it must not re-number it", () => {
  assert.deepEqual(build("s1").problems.map(p => p.prompt), build("s1").problems.map(p => p.prompt));
});

test("two students get different numbers on the same problem", () => {
  assert.notEqual(build("s1").problems[0].prompt, build("s2").problems[0].prompt);
});

test("the seed is per student AND per problem, so one problem's numbers cannot shift another's", () => {
  assert.equal(variantSeed("s1", "study_midterm", "hw1_p2"), "s1|study_midterm|hw1_p2");
  assert.notEqual(variantSeed("s1", "study_midterm", "hw1_p2"), variantSeed("s1", "study_midterm", "hw1_p3"));
});

test("a pick whose problem no longer exists is dropped, not rendered as a blank problem", () => {
  const a = buildStudyAssignment({
    guide: GUIDE, homeworks: [hw("hw1")], studentId: "s1",
    picks: [{ hwId: "hw1", problemId: "hw1_p99", source: "own" }, { hwId: "hw1", problemId: "hw1_p1", source: "own" }],
  });
  assert.deepEqual(a.problems.map(p => p.id), ["hw1_p1"]);
});

test("size counts problems and blanks the way the runner grades them", () => {
  const multi = {
    id: "hwX", title: "X",
    problems: [{ id: "hwX_p1", prompt: "stem", parts: [{ id: "a", answerType: "numeric" }, { id: "b", answerType: "text" }] }],
  };
  const a = buildStudyAssignment({ guide: GUIDE, homeworks: [multi], studentId: "s1", picks: [{ hwId: "hwX", problemId: "hwX_p1", source: "own" }] });
  assert.deepEqual(studyGuideSize(a), { problems: 1, items: 2 });
});

test("an empty guide is detectable, so the portal can say so instead of opening the runner", () => {
  assert.equal(isEmptyGuide(buildStudyAssignment({ guide: GUIDE, homeworks: [], picks: [], studentId: "s1" })), true);
  assert.equal(isEmptyGuide(build()), false);
});

test("the student-facing note says the guide is generated from their own work, not chosen for the class", () => {
  // The copy is asserted because it is the one thing stopping a student reading a short guide as
  // a short midterm. House style: plain text, no markdown, no em-dashes.
  assert.match(SELECTION_NOTE, /automatically/);
  assert.match(SELECTION_NOTE, /your own homework/);
  assert.match(SELECTION_NOTE, /not a review set the instructor chose/);
  assert.equal(/[—*_#]/.test(SELECTION_NOTE), false);
});

console.log(`\n${passed} passed\n`);
