// Run with: node src/twisted-pair.test.mjs
//
// The twisted-pair simulation puts numbers in front of students as the answer to "why twist the
// wires", and every one of them is silently plausible when wrong: a Biot–Savart sum with a sign
// slip still draws a smooth falling curve, a lens chain with the wrong parity still alternates,
// and a pair computed at its drawn length shows a far field that is really the open ends. So
// the model is checked here against the closed forms it must reduce to.
import assert from "node:assert/strict";
import {
  lensArea, lensDipoles, netDipole,
  singleWireField, straightPairField, twistedPairField, twistedPairFieldMax,
} from "./twisted-pair.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b}`);

const I = 3, d = 0.01, L = 0.4;

console.log("\ntwisted-pair: the lens chain");

test("N lenses of area 2dL/πN, the straight pair one rectangle d·L", () => {
  close(lensArea(d, L, 8), (2 * d * L) / (Math.PI * 8), 1e-12, "lens area");
  assert.equal(lensArea(d, L, 0), d * L);
  assert.equal(lensDipoles(I, d, L, 8).length, 8);
  assert.equal(lensDipoles(I, d, L, 0).length, 1);
});

test("the lens areas tile the length exactly", () => {
  const ls = lensDipoles(I, d, L, 7);
  assert.equal(ls[0].z0, 0);
  close(ls[ls.length - 1].z1, L, 1e-12, "last lens ends at L");
  for (let k = 1; k < ls.length; k++) assert.equal(ls[k].z0, ls[k - 1].z1);
});

test("dipoles alternate, the first (wire 1 on top) pointing into the page", () => {
  const ls = lensDipoles(I, d, L, 6);
  assert.ok(ls[0].mu < 0);
  for (let k = 1; k < ls.length; k++) assert.ok(Math.sign(ls[k].mu) === -Math.sign(ls[k - 1].mu));
  for (const l of ls) close(Math.abs(l.mu), I * lensArea(d, L, 6), 1e-12, "|μ| = I A");
});

test("an even number of half-twists has no net dipole; an odd one leaves one lens", () => {
  assert.equal(netDipole(lensDipoles(I, d, L, 8)), 0);
  close(Math.abs(netDipole(lensDipoles(I, d, L, 9))), I * lensArea(d, L, 9), 1e-12, "odd N leftover");
});

console.log("\ntwisted-pair: the field");

test("closed forms: one wire μ0I/2πr, the straight pair ≈ μ0 I d / 2π r²", () => {
  close(singleWireField(I, 0.05), 2e-7 * I / 0.05, 1e-12, "single wire");
  close(straightPairField(I, d, 1.0), 2e-7 * I * d / 1.0, 1e-4, "pair far field");
  // ...and the pair is one wire's field minus the other's, both in the plane
  close(straightPairField(I, d, 0.05), singleWireField(I, 0.05 - d / 2) - singleWireField(I, 0.05 + d / 2), 1e-12, "pair = difference");
});

test("N = 0 is the straight pair, and one gentle half-twist is nearly the same close in", () => {
  assert.equal(twistedPairFieldMax(I, d, L, 0, 0.05), straightPairField(I, d, 0.05));
  close(twistedPairField(I, d, L, 1, 0.01, L / 2), straightPairField(I, d, 0.01), 0.02, "N = 1 at r = 1 cm");
});

test("the far field falls with twist, and falls far below the straight pair once the pitch is shorter than r", () => {
  const r = 0.05;
  const straight = straightPairField(I, d, r);
  const b = [4, 8, 16, 32].map(N => twistedPairFieldMax(I, d, L, N, r));
  for (let i = 1; i < b.length; i++) assert.ok(b[i] < b[i - 1], `field must fall from N=${[4, 8, 16, 32][i - 1]} to N=${[4, 8, 16, 32][i]}`);
  assert.ok(b[2] < straight / 10, `N = 16 (pitch 5 cm) at 5 cm should be well under a tenth of the straight pair: ${b[2]} vs ${straight}`);
});

test("the computed pair is long enough that its ends do not floor the far field", () => {
  // Computed at its drawn 40 cm the pair's open ends alone give ~1e-7 T at 10 cm; the model
  // must be well below that for a tight twist.
  assert.ok(twistedPairFieldMax(I, d, L, 16, 0.10) < 2e-8);
  // ...and insensitive to the computational length, which is what says the ends are gone.
  const a = twistedPairFieldMax(I, d, L, 8, 0.05, { compLength: 2.0 });
  const b = twistedPairFieldMax(I, d, L, 8, 0.05, { compLength: 4.0 });
  close(a, b, 0.02, "compLength 2 m vs 4 m");
});

test("the plot's coarser segment count agrees with a fine one", () => {
  for (const [N, r] of [[4, 0.01], [16, 0.03], [24, 0.10]]) {
    close(twistedPairFieldMax(I, d, L, N, r, { segments: 1500 }), twistedPairFieldMax(I, d, L, N, r, { segments: 6000 }), 0.02, `N=${N} r=${r}`);
  }
});

console.log(`\n${passed} passed\n`);
