// Proves the `submissions` key rule in `database.rules.json` behaves as designed.
//
//   node scripts/verify-submissions-rule.mjs
//
// Run it right AFTER `firebase deploy --only database`, and before students rely on the rule. It
// could not be a normal test: the rule is enforced by Firebase, not by our code, so there is
// nothing to assert against locally, and the RTDB emulator needs Java (not installed here).
//
// THIS WRITES TO THE LIVE DATABASE. It is scoped to `submissions/_ruletest`, a studentId no roster
// entry matches, and it deletes that node at the end. It never reads or writes a real student's
// data. Reads `.env.local` for the App Check debug token, so it runs only on a dev machine.
//
// A failure means hand-ins are blocked outright: revert the rules rather than leaving it. See
// docs/environment.md § Pending, and docs/architecture.md § Stale clients.
import fs from "node:fs";
const env = {};
for (const l of fs.readFileSync("/Users/joel/Teaching/Newton/.env.local","utf8").split("\n")) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim(); }
const KEY=env.VITE_FIREBASE_API_KEY, DBG=env.VITE_FIREBASE_DEBUG_TOKEN;
const FB="https://newton-93d05-default-rtdb.firebaseio.com";
const AC="https://firebaseappcheck.googleapis.com/v1/projects/newton-93d05/apps/1%3A697007558928%3Aweb%3Ac4ff7f4bf936f340be5595";
const C="phy-215-fall-2026", SID="_ruletest";
const j=async(u,o)=>(await fetch(u,o)).json();
const a=await j(`${AC}:exchangeDebugToken?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({debug_token:DBG})});
const b=await j(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({returnSecureToken:true})});
const put = (path, body) => fetch(`${FB}/${path}.json?auth=${b.idToken}`, {
  method: "PUT", headers: { "Content-Type": "application/json", "X-Firebase-AppCheck": a.token },
  body: JSON.stringify(body),
});

let fails = 0;
const expect = (label, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`); if (!ok) fails++; };
const rec = id => ({ id, studentId: SID, type: "homework", quizId: "hw_probe", score: 1 });

// 1. The normal write every student submission makes: key === id. Must be ALLOWED.
let r = await put(`classes/${C}/submissions/${SID}/sub_probe_1`, rec("sub_probe_1"));
expect("id-keyed submission write is allowed", r.ok, `HTTP ${r.status}`);

// 2. A second, independent submission. Must be ALLOWED (this is what per-key writes buy us).
r = await put(`classes/${C}/submissions/${SID}/sub_probe_2`, rec("sub_probe_2"));
expect("a second id-keyed write is allowed", r.ok, `HTTP ${r.status}`);

// 3. THE REGRESSION. The pre-2026-09-06 whole-array PUT, which destroyed seven records on
//    2026-09-29. An array writes integer keys, so the key can never equal the record's id.
//    Must be REJECTED, and both records above must survive it.
r = await put(`classes/${C}/submissions/${SID}`, [rec("sub_probe_3")]);
expect("whole-ARRAY PUT over the student node is REJECTED", r.status === 401 || r.status === 403, `HTTP ${r.status}`);

// 4. A whole-object PUT keyed by id would also drop siblings, so confirm what survived.
const after = await (await fetch(`${FB}/classes/${C}/submissions/${SID}.json?auth=${b.idToken}`, { headers: { "X-Firebase-AppCheck": a.token } })).json();
const keys = Object.keys(after || {}).sort();
expect("both records survived the rejected write", keys.join(",") === "sub_probe_1,sub_probe_2", `node holds: ${keys.join(",") || "(empty)"}`);

// 5. A mismatched explicit key must be refused too.
r = await put(`classes/${C}/submissions/${SID}/wrong_key`, rec("sub_probe_4"));
expect("key that is not the record's id is REJECTED", r.status === 401 || r.status === 403, `HTTP ${r.status}`);

// 6. Deletion must still work, or Clear Submission / remove-student break.
r = await put(`classes/${C}/submissions/${SID}/sub_probe_1`, null);
expect("deleting one submission is allowed", r.ok, `HTTP ${r.status}`);

// Cleanup: remove the whole probe node (a null PUT, which the rule permits).
r = await put(`classes/${C}/submissions/${SID}`, null);
expect("probe node cleaned up", r.ok, `HTTP ${r.status}`);
const left = await (await fetch(`${FB}/classes/${C}/submissions/${SID}.json?auth=${b.idToken}`, { headers: { "X-Firebase-AppCheck": a.token } })).json();
expect("nothing left behind", left === null, JSON.stringify(left));

console.log(fails ? `\n${fails} CHECK(S) FAILED — do not rely on the rule yet.` : "\nAll checks passed. The rule allows every real write path and refuses the array PUT.");
process.exitCode = fails ? 1 : 0;
