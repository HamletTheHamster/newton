// Run with: node src/quiz-sims.test.mjs
//
// The quiz simulations put numbers and pictures in front of students as the answer to a
// conceptual question, and each is silently plausible when wrong: a bulb circuit with the
// wrong current law still draws glowing bulbs, an RC curve with R in the plateau still rises
// smoothly, a field-line counter with a sign slip still prints a number, and a helix with the
// wrong sense still spirals. So each model is held to the closed form it must reduce to.
import assert from "node:assert/strict";
import {
  bulbs, rcCharge, rcCurrent, rcFinalCharge, rcTimeConstant,
  fieldLineCrossings, pointChargeField, K_E,
  magneticForce, cyclotronRadius, cyclotronOmega, chargeInB,
} from "./quiz-sims.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-300), `${msg}: ${a} vs ${b}`);

console.log("\nquiz-sims: bulbs (q7_1)");

test("one bulb is the same circuit either way", () => {
  const s = bulbs(1, "series", 3, 10), p = bulbs(1, "parallel", 3, 10);
  close(s.bulbPower, 0.9, 1e-12, "P = ε²/R");
  assert.equal(s.bulbPower, p.bulbPower);
  assert.equal(s.batteryCurrent, p.batteryCurrent);
});

test("series: each bulb dims as 1/N², the battery current falls as 1/N", () => {
  const one = bulbs(1, "series", 3, 10), four = bulbs(4, "series", 3, 10);
  close(four.bulbPower, one.bulbPower / 16, 1e-12, "P per bulb");
  close(four.batteryCurrent, one.batteryCurrent / 4, 1e-12, "battery current");
  close(four.totalPower, one.totalPower / 4, 1e-12, "total power");
});

test("parallel: each bulb holds its brightness, the battery current grows as N", () => {
  const one = bulbs(1, "parallel", 3, 10), four = bulbs(4, "parallel", 3, 10);
  assert.equal(four.bulbPower, one.bulbPower);
  close(four.batteryCurrent, 4 * one.batteryCurrent, 1e-12, "battery current");
});

test("energy is conserved: bulbs' power sums to the battery's", () => {
  for (const arr of ["series", "parallel"]) for (const n of [1, 2, 3, 6]) {
    const r = bulbs(n, arr, 3, 10);
    close(r.n * r.bulbPower, r.totalPower, 1e-12, `${arr} n=${n}`);
    close(r.batteryCurrent * 3, r.totalPower, 1e-12, `${arr} n=${n} I·ε`);
  }
});

test("a real cell (r > 0): parallel bulbs dim gradually, series barely notice r, and ε·I = bulbs + r·I²", () => {
  const r = 0.35;
  const p1 = bulbs(1, "parallel", 3, 10, r), p6 = bulbs(6, "parallel", 3, 10, r);
  assert.ok(p6.bulbPower < p1.bulbPower, "parallel dims with r");
  assert.ok(p6.bulbPower > 0.6 * p1.bulbPower, "but gradually");
  const s6 = bulbs(6, "series", 3, 10, r), s6i = bulbs(6, "series", 3, 10, 0);
  close(s6.bulbPower, s6i.bulbPower, 0.02, "series with r ≈ ideal");
  for (const x of [p6, s6]) close(3 * x.batteryCurrent, x.totalPower + r * x.batteryCurrent ** 2, 1e-12, `${x.arrangement} energy incl. r`);
});

console.log("\nquiz-sims: RC (q7_2)");

test("the final charge is Cε and does not contain R", () => {
  const emf = 9, C = 10e-6;
  for (const R of [1e3, 5e3, 20e3]) {
    close(rcCharge(50 * R * C, emf, R, C), rcFinalCharge(emf, C), 1e-12, `R=${R}`);
  }
  assert.equal(rcFinalCharge(emf, C), 90e-6);
});

test("R sets the time constant: 63.2% at τ, and a bigger R is slower", () => {
  const emf = 9, C = 10e-6;
  close(rcCharge(rcTimeConstant(5e3, C), emf, 5e3, C), 90e-6 * (1 - Math.exp(-1)), 1e-12, "q(τ)");
  assert.ok(rcCharge(0.02, emf, 10e3, C) < rcCharge(0.02, emf, 2e3, C));
});

test("i = dq/dt and starts at ε/R", () => {
  const emf = 9, R = 5e3, C = 10e-6, t = 0.03, h = 1e-7;
  close(rcCurrent(0, emf, R, C), emf / R, 1e-12, "i(0)");
  close(rcCurrent(t, emf, R, C), (rcCharge(t + h, emf, R, C) - rcCharge(t - h, emf, R, C)) / (2 * h), 1e-5, "dq/dt");
});

console.log("\nquiz-sims: Gauss (q3)");

test("an enclosed charge: every line leaves once, whatever the radius and wherever the charge is", () => {
  for (const radius of [0.03, 0.06, 0.12]) for (const [cx, cy] of [[0, 0], [0.02, 0.01], [-0.025, 0.0], [0.0, -0.028]]) {
    if (cx * cx + cy * cy >= radius * radius) continue;
    const r = fieldLineCrossings(cx, cy, 16, radius);
    assert.equal(r.enclosed, true);
    assert.equal(r.out, 16, `out r=${radius} at ${cx},${cy}`);
    assert.equal(r.in, 0);
    assert.equal(r.net, 16);
    for (const l of r.lines) assert.equal(l.hits.length, 1);
  }
});

test("a charge outside: lines that enter also leave, net zero", () => {
  const r = fieldLineCrossings(0.10, 0.0, 16, 0.04);
  assert.equal(r.enclosed, false);
  assert.equal(r.net, 0);
  assert.ok(r.in > 0, "some lines pass through the surface");
  for (const l of r.lines) assert.ok(l.hits.length === 0 || l.hits.length === 2);
});

test("the count scales with the charge: twice the lines, twice the net", () => {
  assert.equal(fieldLineCrossings(0.01, 0.005, 32, 0.05).net, 2 * fieldLineCrossings(0.01, 0.005, 16, 0.05).net);
});

test("the field at a surface point changes when the charge moves; Coulomb's law at the marker", () => {
  const q = 2e-9, R = 0.05;
  const centred = pointChargeField(q, 0, 0, 0, R);
  close(centred.E, (K_E * q) / (R * R), 1e-12, "kq/r²");
  const moved = pointChargeField(q, 0, 0.02, 0, R);
  assert.ok(moved.E > centred.E, "closer to the top of the surface: stronger there");
  close(moved.E, (K_E * q) / (0.03 * 0.03), 1e-12, "kq/r² at r = 3 cm");
});

console.log("\nquiz-sims: a charge in B (q8)");

const qp = 1.602e-19, mp = 1.673e-27;

test("no force along B: θ = 0 and 180° give a straight line at constant speed", () => {
  for (const th of [0, Math.PI]) {
    assert.equal(magneticForce(qp, 2e6, 0.05, th) < 1e-30, true);
    const p = chargeInB(qp, mp, 2e6, 0.05, th, 1e-6);
    close(Math.abs(p.x), 2e6 * 1e-6, 1e-9, "x = v t");
    assert.equal(p.z, 0);
    close(p.speed, 2e6, 1e-12, "speed");
  }
});

test("perpendicular launch: a circle of radius mv/|q|B, speed constant all the way round", () => {
  const v = 2e6, B = 0.05;
  const r = cyclotronRadius(qp, mp, v, B, Math.PI / 2);
  close(r, (mp * v) / (qp * B), 1e-12, "r");
  const w = cyclotronOmega(qp, mp, B);
  for (const f of [0.1, 0.25, 0.5, 0.9]) {
    const p = chargeInB(qp, mp, v, B, Math.PI / 2, (f * 2 * Math.PI) / w);
    close(p.speed, v, 1e-9, `speed at ${f} period`);
    // distance from the circle's centre (0, 0, −r) is r
    close(Math.sqrt(p.y * p.y + (p.z + r) * (p.z + r)), r, 1e-9, `on the circle at ${f}`);
    assert.equal(p.x, 0);
  }
});

test("the force is always perpendicular to the velocity: v · (v × B) = 0 along the path", () => {
  const v = 2e6, B = 0.05, th = 1.1;
  for (const t of [0, 1e-7, 3e-7, 7e-7]) {
    const p = chargeInB(qp, mp, v, B, th, t);
    // B = (B, 0, 0); F ∝ v × B = (0, vz B, −vy B)
    const dot = p.vy * (p.vz * B) + p.vz * (-p.vy * B);
    assert.ok(Math.abs(dot) < 1e-3 * v * v * B, `t=${t}`);
    close(p.speed, v, 1e-9, `speed t=${t}`);
  }
});

test("a negative charge circles the other way", () => {
  const w = cyclotronOmega(qp, mp, 0.05), t = (0.25 * 2 * Math.PI) / w;
  const plus = chargeInB(qp, mp, 2e6, 0.05, Math.PI / 2, t), minus = chargeInB(-qp, mp, 2e6, 0.05, Math.PI / 2, t);
  assert.ok(plus.z < 0 && minus.z > 0);
  close(plus.y, minus.y, 1e-12, "same y");
});

console.log(`\n${passed} passed\n`);
