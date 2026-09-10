// Tests for the emailed instructor password reset (`instructor-reset.js`).
//
// This exists because every failure here is silently plausible. A reset that accepts an expired
// code, a code minted against a different challenge, or a challenge whose expiry was edited in
// the browser still returns `{ ok: true }` and still lets someone set the instructor password on
// a live gradebook. Nothing about the happy path looks different when the checks are wrong.
//
// Resend is stubbed, so running this sends no email. Run with plain node:
//   node src/instructor-reset.test.mjs
//
// It lives in src/ with the other tests, NOT beside the function: Netlify bundles every file in
// netlify/functions/ as an endpoint, and a test file's top-level await fails that bundle, which
// takes down `netlify dev` and the deploy with it.

import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.EMAIL_SEND_SECRET = "shared-client-secret";
process.env.INSTRUCTOR_RESET_SECRET = "server-only-signing-key";
process.env.RESEND_API_KEY = "re_test";
process.env.EMAIL_FROM_ADDRESS = "newton@example.edu";
process.env.INSTRUCTOR_EMAIL = "joel.johnson675@example.com";

const { default: handler } = await import("../netlify/functions/instructor-reset.js");

// Every Resend call is captured rather than sent.
let mails = [];
let mailStatus = { ok: true, body: "{}" };
globalThis.fetch = async (url, opts) => {
  mails.push({ url, body: JSON.parse(opts.body) });
  return { ok: mailStatus.ok, text: async () => mailStatus.body, json: async () => JSON.parse(mailStatus.body) };
};

const post = async payload => {
  const res = await handler(new Request("https://x/.netlify/functions/instructor-reset", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }));
  return { status: res.status, body: await res.json() };
};

const SECRET = "shared-client-secret";
const request = () => post({ action: "request", secret: SECRET });
const verify = (code, challenge) => post({ action: "verify", secret: SECRET, code, challenge });
// The code only ever exists in the email, which is where the test reads it too.
const codeOf = mail => mail.body.text.match(/Code: ([0-9A-Z]+)/)[1];

let pass = 0, fail = 0;
const t = async (name, fn) => {
  mails = []; mailStatus = { ok: true, body: "{}" };
  try { await fn(); console.log(`  ok  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}\n      ${e.message}`); fail++; }
};

console.log("\ninstructor-reset\n");

await t("a request emails a code and returns a challenge that does not contain it", async () => {
  const { status, body } = await request();
  assert.equal(status, 200);
  assert.equal(mails.length, 1);
  const code = codeOf(mails[0]);
  assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/, "unambiguous alphabet, fixed length");
  assert.ok(body.challenge, "a challenge comes back");
  assert.ok(!body.challenge.includes(code), "the challenge must not carry the code");
  assert.ok(!JSON.stringify(body).includes(code), "no response field may carry the code");
});

await t("the code goes to the server's address, never one the caller supplies", async () => {
  await post({ action: "request", secret: SECRET, email: "attacker@example.com", to: "attacker@example.com" });
  assert.deepEqual(mails[0].body.to, ["joel.johnson675@example.com"]);
});

await t("the masked address is recognizable but not reusable", async () => {
  const { body } = await request();
  assert.equal(body.sentTo, "jo…75@example.com");
});

await t("the right code verifies", async () => {
  const { body } = await request();
  const { status, body: v } = await verify(codeOf(mails[0]), body.challenge);
  assert.equal(status, 200);
  assert.equal(v.ok, true);
});

await t("case and the display hyphen carry no meaning", async () => {
  const { body } = await request();
  const code = codeOf(mails[0]);
  const spelled = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
  assert.equal((await verify(spelled, body.challenge)).body.ok, true);
});

await t("a wrong code is rejected", async () => {
  const { body } = await request();
  const code = codeOf(mails[0]);
  const wrong = code.slice(0, 7) + (code[7] === "Z" ? "Y" : "Z");
  const { status, body: v } = await verify(wrong, body.challenge);
  assert.equal(status, 401);
  assert.ok(!v.ok);
});

await t("a code from one challenge cannot be used against another", async () => {
  const first = await request();
  const firstCode = codeOf(mails[0]);
  mails = [];
  const second = await request();
  assert.notEqual(first.body.challenge, second.body.challenge);
  assert.equal((await verify(firstCode, second.body.challenge)).status, 401);
  // ...and each still works against its own.
  assert.equal((await verify(firstCode, first.body.challenge)).body.ok, true);
  assert.equal((await verify(codeOf(mails[0]), second.body.challenge)).body.ok, true);
});

await t("an expired challenge is refused even with the right code", async () => {
  const { body } = await request();
  const code = codeOf(mails[0]);
  const [expires, mac] = body.challenge.split(".");
  // Re-sign an already-elapsed expiry the way only the server can, so this tests the clock
  // check and not the signature.
  const past = Date.now() - 1000;
  const forged = `${past}.${crypto.createHmac("sha256", process.env.INSTRUCTOR_RESET_SECRET).update(`${code}.${past}`).digest("hex")}`;
  const { status, body: v } = await verify(code, forged);
  assert.equal(status, 400);
  assert.match(v.error, /expired/i);
  assert.ok(Number(expires) > Date.now() && mac, "the real challenge was in the future and signed");
});

await t("extending the expiry in the browser invalidates the challenge", async () => {
  const { body } = await request();
  const code = codeOf(mails[0]);
  const [, mac] = body.challenge.split(".");
  const stretched = `${Date.now() + 30 * 24 * 3600 * 1000}.${mac}`;
  assert.equal((await verify(code, stretched)).status, 401);
});

await t("a challenge signed with a different key is refused", async () => {
  const { body } = await request();
  const code = codeOf(mails[0]);
  const expires = body.challenge.split(".")[0];
  const forged = `${expires}.${crypto.createHmac("sha256", "guessed-key").update(`${code}.${expires}`).digest("hex")}`;
  assert.equal((await verify(code, forged)).status, 401);
});

await t("a missing or malformed challenge is refused, not treated as absent-and-fine", async () => {
  for (const challenge of [undefined, "", "nonsense", "123", ".abc", "abc.def"]) {
    const { status, body } = await verify("ABCD2345", challenge);
    assert.ok(status >= 400, `challenge ${JSON.stringify(challenge)} must not pass`);
    assert.ok(!body.ok);
  }
});

await t("a code of the wrong length never reaches the comparison", async () => {
  const { body } = await request();
  for (const code of ["", "A", "ABCD234", "ABCD23456"]) {
    const { status } = await verify(code, body.challenge);
    assert.equal(status, 400);
  }
});

await t("the shared client secret gates both actions", async () => {
  for (const action of ["request", "verify"]) {
    assert.equal((await post({ action, secret: "wrong" })).status, 401);
    assert.equal((await post({ action })).status, 401);
  }
  assert.equal(mails.length, 0, "an unauthorized request sends no email");
});

await t("an unset signing key fails closed", async () => {
  const saved = process.env.INSTRUCTOR_RESET_SECRET;
  delete process.env.INSTRUCTOR_RESET_SECRET;
  try {
    assert.equal((await request()).status, 500);
    assert.equal((await verify("ABCD2345", "1.2")).status, 500);
    assert.equal(mails.length, 0);
  } finally { process.env.INSTRUCTOR_RESET_SECRET = saved; }
});

await t("no challenge is handed out when the email did not go", async () => {
  mailStatus = { ok: false, body: "domain not verified" };
  const { status, body } = await request();
  assert.equal(status, 502);
  assert.ok(!body.challenge, "a failed send must not leave a usable challenge behind");
});

await t("only POST is answered", async () => {
  const res = await handler(new Request("https://x/.netlify/functions/instructor-reset", { method: "GET" }));
  assert.equal(res.status, 405);
});

await t("codes do not repeat", async () => {
  const seen = new Set();
  for (let i = 0; i < 40; i++) { mails = []; await request(); seen.add(codeOf(mails[0])); }
  assert.equal(seen.size, 40);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
