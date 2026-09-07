// Which roster entries are actually students. Plain node, no framework:  node src/roster-scope.test.mjs
//
// Worth testing because both directions of failure are silent, and they are not symmetric. Scope
// too little and a test account the instructor drove through every problem sits in the gradebook,
// the class average, the attendance roll and every correlation, as an extra student who is not
// one. Scope too much and a REAL student vanishes from the class the instructor is reading about,
// with no error and no empty row to notice. The default therefore has to be "is a student", and
// the marking has to be something only a deliberate pick can do.
import assert from "node:assert";
import {
  isInstructorAccount, instructorAccountOf, studentRoster, studentIds, scopeSubmissions, scopeByStudent,
} from "./roster-scope.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

const ROSTER = [
  { studentId: "1001", fullName: "Ada Lovelace" },
  { studentId: "0000", fullName: "Joel Johnson", instructorAccount: true },
  { studentId: "1002", fullName: "Blaise Pascal", instructorAccount: false },
];

test("an entry is a student unless it is marked", () => {
  assert.equal(isInstructorAccount(ROSTER[0]), false);
  assert.equal(isInstructorAccount(ROSTER[1]), true);
  // An explicit false is the same as an absent field: a stale write must never remove a student.
  assert.equal(isInstructorAccount(ROSTER[2]), false);
  assert.equal(isInstructorAccount(null), false);
  assert.equal(isInstructorAccount({}), false);
});

test("studentRoster drops only the marked entry", () => {
  assert.deepEqual(studentRoster(ROSTER).map(r => r.studentId), ["1001", "1002"]);
  assert.deepEqual(studentRoster([]), []);
  assert.deepEqual(studentRoster(undefined), []);
});

test("studentRoster does not mutate or reorder the roster", () => {
  const before = JSON.stringify(ROSTER);
  studentRoster(ROSTER);
  assert.equal(JSON.stringify(ROSTER), before);
});

test("instructorAccountOf finds the entry, or nothing", () => {
  assert.equal(instructorAccountOf(ROSTER).studentId, "0000");
  assert.equal(instructorAccountOf([{ studentId: "1001" }]), null);
  assert.equal(instructorAccountOf([]), null);
  assert.equal(instructorAccountOf(undefined), null);
});

test("a hand-edited roster with two marked entries drops both", () => {
  // The picker clears the previous holder before setting the new one, so this cannot happen
  // through the UI. A restored backup or a hand edit can, and the safe reading of "two entries
  // claim to be the instructor" is that neither is a student to be graded.
  const two = [...ROSTER, { studentId: "0001", fullName: "Second Account", instructorAccount: true }];
  assert.deepEqual(studentRoster(two).map(r => r.studentId), ["1001", "1002"]);
});

test("submissions are scoped by both rules at once", () => {
  const ids = studentIds(ROSTER);
  const subs = [
    { studentId: "1001", quizId: "hw1" },
    { studentId: "0000", quizId: "hw1" },   // the instructor's own account
    { studentId: "9999", quizId: "hw1" },   // removed from the roster, still in the node
    { studentId: "1002", quizId: "hw1" },
  ];
  assert.deepEqual(scopeSubmissions(subs, ids).map(x => x.studentId), ["1001", "1002"]);
  assert.deepEqual(scopeSubmissions([], ids), []);
  assert.deepEqual(scopeSubmissions(undefined, ids), []);
});

test("a per-student node is scoped by the same ids", () => {
  const ids = studentIds(ROSTER);
  const node = { 1001: { hw1: { activeMs: 60 } }, "0000": { hw1: { activeMs: 9999 } }, 9999: { hw1: {} } };
  assert.deepEqual(Object.keys(scopeByStudent(node, ids)), ["1001"]);
  // The read can fail, or land before the roster does; neither may throw.
  assert.deepEqual(scopeByStudent(null, ids), {});
  assert.deepEqual(scopeByStudent(node, new Set()), {});
});

test("scopeByStudent copies rather than edits the node it was handed", () => {
  const ids = studentIds(ROSTER);
  const node = { 1001: { hw1: { activeMs: 60 } }, "0000": { hw1: {} } };
  const out = scopeByStudent(node, ids);
  assert.equal(Object.keys(node).length, 2);
  assert.notEqual(out, node);
  // Values are shared by reference on purpose: this scopes a read, it does not clone a tree.
  assert.equal(out["1001"], node["1001"]);
});

console.log(`\n${passed} tests passed`);
