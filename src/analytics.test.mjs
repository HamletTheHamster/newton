// Analytics statistics tests. Run with:  node src/analytics.test.mjs
//
// Here for the same reason as hw-telemetry.test.mjs: these numbers are silently plausible when
// wrong, and an instructor may drop a problem from the course on the strength of one. The
// discrimination figures below were checked against hand arithmetic, not just pinned to
// whatever the code happened to return.
//
// Plain node, no framework and no dependencies, in keeping with the repo having no test runner.
import { buildItemAnalysis, buildFunnel, buildActivityByDay, pearson, lastActiveMap, timeOnTaskMap } from "./analytics.js";
let fails = 0;
const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) { fails++; console.log(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } else console.log(`ok   ${l}`); };
const near = (l, g, w, tol = 0.02) => { const ok = g != null && Math.abs(g - w) <= tol; if (!ok) { fails++; console.log(`FAIL ${l}: got ${g} want ~${w}`); } else console.log(`ok   ${l} (${g?.toFixed?.(3) ?? g})`); };

const homework = { id: "hw1", problems: [
  { id: "p1", prompt: "P1", answerType: "numeric" },
  { id: "p2", prompt: "P2", parts: [{ id: "p2a", prompt: "a", answerType: "numeric" }, { id: "p2b", prompt: "b", answerType: "numeric" }] },
]};

// 6 students. p1 is easy; p2a discriminates (only the strong get it); p2b is a "bad item":
// the WEAK students get it and the strong ones don't, so discrimination must come out negative.
const spec = [
  //           p1,  p2a, p2b   (earned fractions)
  ["s1", 1, 1, 0], ["s2", 1, 1, 0], ["s3", 1, 1, 0],
  ["s4", 1, 0, 1], ["s5", 0, 0, 1], ["s6", 0, 0, 1],
];
const submissions = spec.map(([studentId, a, b, c]) => ({
  studentId, quizId: "hw1", type: "homework", timestamp: "2026-09-01T10:00:00.000Z",
  problems: [
    { id: "p1", earned: a, max: 1, attempts: a ? 1 : 5, status: a ? "correct" : "revealed" },
    { id: "p2", parts: [
      { id: "p2a", earned: b * 0.5, max: 0.5, attempts: b ? 2 : 5, status: b ? "correct" : "revealed" },
      { id: "p2b", earned: c * 0.5, max: 0.5, attempts: 1, status: c ? "correct" : "open" },
    ]},
  ],
}));

const telemetryByStudent = Object.fromEntries(spec.map(([id, a], i) => [id, { items: {
  p1:  { activeMs: (i + 1) * 60000, firstSeenAt: "2026-09-01T10:00:00.000Z", firstSubmitAt: "2026-09-01T10:01:00.000Z",
         attemptLog: [{ answer: "4.9", correct: false }, ...(a ? [{ answer: "9.8", correct: true }] : [])] },
  // Repeated and whitespace-variant entries, to check dedupe-per-student and normalization.
  p2a: { activeMs: 120000, attemptLog: [{ answer: " 4.9 ", correct: false }, { answer: "4.9", correct: false }] },
}}]));

const rows = buildItemAnalysis({ homework, submissions, telemetryByStudent });
eq("one row per item", rows.map(r => r.label), ["1", "2a", "2b"]);
eq("labels come from itemsOf", rows.map(r => r.id), ["p1", "p2a", "p2b"]);
near("p1 mean pct", rows[0].meanPct, (4/6)*100, 0.01);
eq("p1 n", rows[0].n, 6);
eq("p1 first-try count", rows[0].firstTry, 4);
eq("p1 revealed count", rows[0].revealed, 2);
eq("p2a later-try count", rows[1].later, 3);
eq("p2b unresolved (open, never right)", rows[2].unresolved, 3);

// Discrimination: p2a tracks the total, p2b runs against it.
if (!(rows[1].discrimination > 0.15 && rows[1].discrimination > rows[2].discrimination + 0.5)) { fails++; console.log("FAIL p2a should discriminate positively and far above p2b, got " + rows[1].discrimination); }
else console.log(`ok   p2a discriminates (${rows[1].discrimination.toFixed(2)})`);
if (!(rows[2].discrimination < 0)) { fails++; console.log("FAIL p2b should discriminate negatively, got " + rows[2].discrimination); }
else console.log(`ok   p2b discriminates negatively (${rows[2].discrimination.toFixed(2)})`);

// Corrected, not raw: a raw item-total correlation would be inflated by self-inclusion.
const raw = pearson([[1,1],[1,1],[1,1],[1,0.5],[0,0],[0,0]]);
if (!(rows[1].discrimination < raw)) { fails++; console.log("FAIL corrected should be below raw"); }
else console.log("ok   corrected item-total is below the self-inclusive figure");

// Wrong-answer clustering: one student's repeats count once; a lone answer is not a pattern.
eq("p1 top wrong", rows[0].topWrong, [{ answer: "4.9", count: 6 }]);
eq("p2a wrong answers normalized + deduped", rows[1].topWrong, [{ answer: "4.9", count: 6 }]);

const solo = buildItemAnalysis({ homework, submissions: submissions.slice(0, 1), telemetryByStudent });
eq("a single student's wrong answer is not reported", solo[0].topWrong, []);

near("p1 median active ms", rows[0].medianActiveMs, 210000, 1);
near("p1 median time-to-first-attempt", rows[0].medianTtfMs, 60000, 1);

// Funnel.
const roster = spec.map(([studentId]) => ({ studentId, fullName: studentId }));
const f = buildFunnel({
  assignment: { id: "hw1" }, roster,
  submissions: submissions.slice(0, 2),
  progress: { s3: { hw1: { done: 5, total: 5, pct: 100 } }, s4: { hw1: { done: 2, total: 5, pct: 40 } } },
});
eq("funnel", f, { notStarted: 2, started: 1, stalled: 1, submitted: 2, total: 6 });

// Activity by day.
const act = buildActivityByDay({
  submissions: [{ studentId: "s1", timestamp: "2026-09-01T10:00:00.000Z" }],
  telemetryAll: { s2: { hw1: { sessions: [{ start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T09:30:00.000Z" }] } } },
  days: 3, now: new Date("2026-09-02T12:00:00"),
});
eq("activity spans the window", act.length, 3);
eq("distinct students counted once per day", act.find(d => d.date === "2026-09-01")?.students, 2);

eq("lastActive picks the newest", lastActiveMap({
  submissions: [{ studentId: "s1", timestamp: "2026-08-01T00:00:00.000Z" }],
  telemetryAll: { s1: { hw1: { updatedAt: "2026-09-01T00:00:00.000Z", sessions: [] } } },
}).s1, "2026-09-01T00:00:00.000Z");
eq("time on task sums every assignment", timeOnTaskMap({
  s1: { hw1: { items: { a: { activeMs: 1000 }, b: { activeMs: 2000 } } }, hw2: { items: { c: { activeMs: 500 } } } },
}).s1, 3500);



// ── Effort predictors (attempts to correct, time on task) ─────────────────────
{
  const { effortByStudent, buildCorrelations, PREDICTORS } = await import("./analytics.js");

  const sub = (studentId, quizId, items, telemetry) => ({
    studentId, quizId, type: "homework", timestamp: "2026-09-01T10:00:00.000Z",
    problems: items.map(([id, attempts, status]) => ({ id, attempts, status, earned: status === "correct" ? 1 : 0, max: 1 })),
    telemetry,
  });
  const tele = perItem => ({ items: Object.fromEntries(Object.entries(perItem).map(([k, v]) => [k, v])) });

  // Only items the student got RIGHT contribute an "attempts to correct": a revealed item's five
  // failed tries are the cost of giving up, not of succeeding.
  const e1 = effortByStudent({
    homeworkIds: ["hw1"],
    submissions: [sub("s1", "hw1", [["a", 1, "correct"], ["b", 3, "correct"], ["c", 5, "revealed"], ["d", 2, "correct"]],
      tele({ a: { activeMs: 60000 }, b: { activeMs: 120000 } }))],
    telemetryAll: {},
  });
  near("attempts to correct ignores revealed items", e1.s1.hw1.attempts, (1 + 3 + 2) / 3, 0.001);
  eq("resolved count", e1.s1.hw1.resolved, 3);
  near("time in ms from the submission's telemetry", e1.s1.hw1.timeMs, 180000, 1);

  // Below the floor a mean swings on one lucky problem, so it is withheld rather than reported.
  const e2 = effortByStudent({
    homeworkIds: ["hw1"],
    submissions: [sub("s1", "hw1", [["a", 1, "correct"], ["b", 4, "revealed"]], tele({ a: { activeMs: 1000 } }))],
    telemetryAll: {},
  });
  eq("too few resolved items reports null, not a number", e2.s1.hw1.attempts, null);

  // A student still working is read from telemetry; one with a submission is NOT topped up from
  // the live node, so a single student's figure is never half exact and half approximate.
  const e3 = effortByStudent({
    homeworkIds: ["hw1"],
    submissions: [sub("s1", "hw1", [["a", 2, "correct"], ["b", 2, "correct"], ["c", 2, "correct"]], tele({ a: { activeMs: 1000 } }))],
    telemetryAll: {
      s1: { hw1: { items: { z: { activeMs: 999999, attemptLog: [{ correct: true }] } } } },
      s2: { hw1: { items: {
        a: { activeMs: 30000, attemptLog: [{ correct: false }, { correct: true }] },
        b: { activeMs: 30000, attemptLog: [{ correct: true }] },
        c: { activeMs: 30000, attemptLog: [{ correct: false }, { correct: false }, { correct: true }] },
      } } },
    },
  });
  near("submitted student keeps the submission's attempts", e3.s1.hw1.attempts, 2, 0.001);
  near("submitted student's time is not double counted", e3.s1.hw1.timeMs, 1000, 1);
  near("in-progress student read from the attempt log", e3.s2.hw1.attempts, (2 + 1 + 3) / 3, 0.001);

  // Pooling across assignments.
  const e4 = effortByStudent({
    homeworkIds: ["hw1", "hw2"],
    submissions: [
      sub("s1", "hw1", [["a", 1, "correct"], ["b", 1, "correct"], ["c", 1, "correct"]], tele({ a: { activeMs: 60000 } })),
      sub("s1", "hw2", [["d", 3, "correct"], ["e", 3, "correct"], ["f", 3, "correct"]], tele({ d: { activeMs: 60000 } })),
    ],
    telemetryAll: {},
  });
  near("pooled attempts average every item across the term", e4.s1.all.attempts, 2, 0.001);
  near("pooled time sums every assignment", e4.s1.all.timeMs, 120000, 1);

  // End to end: more attempts must come out NEGATIVELY correlated with exam score.
  const rosterE = [0, 1, 2, 3, 4, 5].map(i => ({ studentId: "e" + i, fullName: "E" + i }));
  const exam = [95, 88, 80, 70, 60, 50];
  const tries = [1, 1, 2, 3, 4, 5];
  const effort = effortByStudent({
    homeworkIds: ["hw1"],
    submissions: rosterE.map((r, i) => sub(r.studentId, "hw1",
      [["a", tries[i], "correct"], ["b", tries[i], "correct"], ["c", tries[i], "correct"]],
      tele({ a: { activeMs: tries[i] * 60000 } }))),
    telemetryAll: {},
  });
  const assignmentsE = [
    { id: "hw1", title: "HW1", type: "homework", catId: "cat_hw", maxPts: 10 },
    { id: "hw2", title: "HW2", type: "homework", catId: "cat_hw", maxPts: 10 },
    { id: "mid", title: "Midterm", type: "manual", catId: "cat_midterm", maxPts: 100 },
  ];
  const matrixE = {
    scoreMap: Object.fromEntries(rosterE.map((r, i) => [r.studentId, { mid: exam[i] }])),
    excusedMap: Object.fromEntries(rosterE.map(r => [r.studentId, {}])),
    subsByStudent: Object.fromEntries(rosterE.map(r => [r.studentId, {}])),
    flaggedMap: {}, absentMap: {},
  };
  const attRows = buildCorrelations({ roster: rosterE, assignments: assignmentsE, outcomeId: "mid", matrix: matrixE, feature: "attempts", effort });
  const hw1Row = attRows.find(r => r.assignment.id === "hw1");
  if (!(hw1Row.r < -0.9)) { fails++; console.log("FAIL more attempts should predict a LOWER exam score, got r=" + hw1Row.r); }
  else console.log(`ok   more attempts predicts a lower exam score (r=${hw1Row.r.toFixed(2)})`);
  eq("attempts predictor declares its expected direction", PREDICTORS.attempts.expected, "negative");
  eq("effort rows cover homework only, plus the pooled row", attRows.map(r => r.assignment.id).sort(), ["__all_homework__", "hw1", "hw2"].sort());
  eq("pooled row is pinned first", attRows[0].assignment.id, "__all_homework__");
  eq("an assignment with no effort data still appears, uncorrelatable", attRows.find(r => r.assignment.id === "hw2").r, null);

  const timeRows = buildCorrelations({ roster: rosterE, assignments: assignmentsE, outcomeId: "mid", matrix: matrixE, feature: "time", effort });
  const t1 = timeRows.find(r => r.assignment.id === "hw1");
  near("time is paired in minutes, not milliseconds", t1.points[0].x, 1, 0.001);
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nall passed");
process.exit(fails ? 1 : 0);
