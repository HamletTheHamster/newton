// Student-chosen preferred names. Plain node, no framework:  node src/nickname.test.mjs
//
// Worth testing because both directions fail silently and in public. A rule that is too loose puts
// a slur on the pre-login student picker, where the whole class reads it and nobody has to sign in.
// A rule that is too tight refuses a real student's real name (Siobhán, Jean-Luc, Bob) with a
// message telling them their own name is inappropriate, which is the worse of the two and the one a
// wordlist reaches by accident: leet-folding turns "boob" into "bob" and "kkk" into "k", so a single
// careless substring match refuses every student with a K in their name. Both of those were live
// bugs caught here. The altName round trip is the third silent failure: get it wrong and a student
// setting a nickname erases their surname from the gradebook.
import assert from "node:assert";
import {
  NICKNAME_MAX, normalizeNickname, checkNicknameFormat, altNameFor, nicknameFromAltName, nicknameAllowed,
} from "./nickname.js";
import { leetFold, wordlistReason } from "../netlify/functions/screen-name.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test("normalize trims and collapses whitespace", () => {
  assert.strictEqual(normalizeNickname("  Kunj  "), "Kunj");
  assert.strictEqual(normalizeNickname("Mary\n Jane"), "Mary Jane");
  assert.strictEqual(normalizeNickname(null), "");
  assert.strictEqual(normalizeNickname(undefined), "");
});

test("real names from anywhere pass the format rules", () => {
  for (const n of ["Kunj", "Wes", "Siobhán", "Jean-Luc", "Nguyễn", "Xiùlán", "O'Brien", "Mary Jane",
                   "J.J.", "Bea", "Mo", "José", "Anne-Marie", "D'Angelo"]) {
    assert.strictEqual(checkNicknameFormat(n).ok, true, `${n} should be accepted`);
  }
});

test("format rules reject shapes that are not names", () => {
  const bad = {
    "": "blank",
    "     ": "whitespace only",
    ["x".repeat(NICKNAME_MAX + 1)]: "too long",
    "123": "digits only",
    "Kunj2": "contains a digit",
    "http://x.co": "a URL",
    "@handle": "a handle",
    "Aaaaargh": "three repeated characters",
    "One Two Three": "more than two words",
    "😀": "no letter",
  };
  for (const [n, why] of Object.entries(bad)) {
    const r = checkNicknameFormat(n);
    assert.strictEqual(r.ok, false, `${JSON.stringify(n)} (${why}) should be rejected`);
    assert.ok(r.reason && !/[—*_`]/.test(r.reason), "the reason is plain student-facing text");
  }
});

test("the stored altName keeps the student's real surname", () => {
  const stu = { firstName: "Kunjkumar", lastName: "Patel", fullName: "Kunjkumar Patel" };
  assert.strictEqual(altNameFor("Kunj", stu), "Kunj Patel");
  assert.strictEqual(altNameFor("  Kunj  ", stu), "Kunj Patel");
  assert.strictEqual(altNameFor("", stu), null);
  assert.strictEqual(altNameFor("Kunj", { firstName: "Kunj" }), "Kunj");   // no surname on file
});

test("the round trip recovers exactly what the student typed", () => {
  const stu = { lastName: "Patel" };
  assert.strictEqual(nicknameFromAltName({ ...stu, altName: altNameFor("Kunj", stu) }), "Kunj");
  assert.strictEqual(nicknameFromAltName({ ...stu, altName: altNameFor("Mary Jane", stu) }), "Mary Jane");
  // A surname that is also the whole altName must not be stripped down to nothing.
  assert.strictEqual(nicknameFromAltName({ lastName: "Patel", altName: "Patel" }), "Patel");
  // An instructor-set name with no surname half comes back whole, so it can be edited.
  assert.strictEqual(nicknameFromAltName({ lastName: "Patel", altName: "JJ" }), "JJ");
  assert.strictEqual(nicknameFromAltName({ lastName: "Patel" }), "");
});

test("a surname that merely ends in the last name is not stripped", () => {
  // "Patel" is a suffix of "Rpatel" as a STRING, but not as a word — the space matters.
  assert.strictEqual(nicknameFromAltName({ lastName: "Patel", altName: "Rpatel" }), "Rpatel");
});

test("the lock is opt-out, so the feature is on until it is taken away", () => {
  assert.strictEqual(nicknameAllowed({}), true);
  assert.strictEqual(nicknameAllowed({ nicknameLocked: false }), true);
  assert.strictEqual(nicknameAllowed({ nicknameLocked: true }), false);
});

// ── the wordlist ──────────────────────────────────────────────────────────────────────────────
test("leetFold keeps three forms, and only the folded one collapses repeats", () => {
  assert.deepStrictEqual(leetFold("Fuuuck"), { plain: "fuuuck", leeted: "fuuuck", folded: "fuck" });
  assert.deepStrictEqual(leetFold("N1gga"),  { plain: "n gga",  leeted: "nigga",  folded: "niga" });
  assert.deepStrictEqual(leetFold("Jean-Luc"), { plain: "jean luc", leeted: "jean luc", folded: "jean luc" });
});

test("the wordlist blocks obvious obscenity, including padded and leet spellings", () => {
  for (const n of ["fuck", "FUCK", "F u c k", "f.u.c.k", "Fuuuck", "sh1t", "$hit", "p3n1s",
                   "N1gga", "N1ggger", "ass", "Tits", "Boobs", "kkk", "Hitler", "Nazi"]) {
    assert.ok(wordlistReason(n), `${n} should be blocked`);
  }
});

test("the wordlist never refuses a real name", () => {
  // Every one of these embeds a blocked term as a substring, or collapses onto one. They are the
  // whole reason the substring list and the whole-word list are separate.
  for (const n of ["Cassandra", "Assata", "Titus", "Bob", "Bobs", "Dickens", "Analise", "Sextus",
                   "Kunj", "Kiki", "Kade", "Jack", "Aaron", "Anna", "Matt", "Molly", "Siobhán",
                   "Xiùlán", "Jean-Luc", "Grace", "Sasha", "Bea", "Mo"]) {
    assert.strictEqual(wordlistReason(n), null, `${n} must not be blocked`);
  }
});

test("the wordlist's refusal never repeats the name back at the student", () => {
  const r = wordlistReason("fuck");
  assert.ok(r && !r.toLowerCase().includes("fuck"));
  assert.ok(!/[—*_`]/.test(r), "plain text, no markdown and no em-dashes");
});

console.log(`\n${passed} nickname tests passed.`);
