// Telemetry accounting tests. Run with:  node src/hw-telemetry.test.mjs
//
// This is the one module in the app with non-obvious arithmetic that nothing else would catch
// getting wrong: every figure it produces is silently plausible, and an instructor may make a
// judgement about a student from it. The clock is injectable precisely so the accrual rules can
// be driven deterministically here. (These tests already caught a real bug: a segment spanning
// an idle stretch used to bank the whole stretch as time on task.)
//
// Plain node, no framework and no dependencies, in keeping with the repo having no test runner.
import { createTelemetry, IDLE_MS, totalActiveMs, formatDuration, timeToFirstAttemptMs } from "./hw-telemetry.js";

let t = 1_000_000;
const mk = () => createTelemetry({ now: () => t });
const adv = ms => { t += ms; };
let fails = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${label}`);
};
const near = (label, got, want, tol = 50) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${got} want ~${want}`); }
  else console.log(`ok   ${label} (${got})`);
};

// 1. Plain active accrual on one item.
let x = mk();
x.setItem("a");
adv(30_000); x.noteActivity();
adv(20_000);
near("active accrues while working", x.snapshot().items.a.activeMs, 50_000);

// 2. Idle stops the clock.
x = mk(); x.setItem("a");
adv(IDLE_MS + 60_000);            // no activity at all for 3 min
near("idle caps accrual at the idle threshold", x.snapshot().items.a.activeMs, IDLE_MS);

// 2b. Going idle then coming back: the pre-idle work must survive, the gap must not count.
x = mk(); x.setItem("a");
adv(40_000); x.noteActivity();          // 40s of work
adv(IDLE_MS + 300_000);                 // wanders off without leaving the tab
x.noteActivity();                       // comes back
adv(25_000); x.noteActivity();          // 25s more
near("idle gap excluded, work either side kept", x.snapshot().items.a.activeMs, 40_000 + IDLE_MS + 25_000);

// 3. Hidden excursion: not active time, counted as hidden.
x = mk(); x.setItem("a");
adv(10_000); x.noteActivity();
x.noteVisibility(false);
adv(90_000);
x.noteVisibility(true);
adv(5_000);
let s = x.snapshot().items.a;
near("hidden time is not active time", s.activeMs, 15_000);
near("hiddenMs recorded", s.hiddenMs, 90_000);
eq("hiddenCount", s.hiddenCount, 1);

// 4. Sub-2s flicker is ignored.
x = mk(); x.setItem("a");
x.noteVisibility(false); adv(800); x.noteVisibility(true);
s = x.snapshot().items.a;
eq("flicker ignored (count)", s.hiddenCount, 0);
eq("flicker ignored (ms)", s.hiddenMs, 0);

// 5. A tab switch must not also count as unfocused: the two stay disjoint.
x = mk(); x.setItem("a");
x.noteFocus(false);               // browsers fire blur then visibilitychange
x.noteVisibility(false);
adv(60_000);
x.noteVisibility(true); x.noteFocus(true);
s = x.snapshot().items.a;
near("tab switch counts as hidden", s.hiddenMs, 60_000);
eq("tab switch does NOT double count as unfocused", s.unfocusedMs, 0);

// 6. Alt-tab while the tab stays visible is unfocused, not hidden.
x = mk(); x.setItem("a");
x.noteFocus(false); adv(45_000); x.noteFocus(true);
s = x.snapshot().items.a;
near("alt-tab counts as unfocused", s.unfocusedMs, 45_000);
eq("alt-tab is not hidden", s.hiddenMs, 0);

// 7. Attempt log carries the excursion shape.
x = mk(); x.setItem("a");
adv(5_000); x.noteActivity();
x.noteVisibility(false); adv(40_000); x.noteVisibility(true);
adv(3_000);
x.noteSubmit("a", { answer: "9.81", correct: true });
const log = x.snapshot().items.a.attemptLog;
eq("one attempt logged", log.length, 1);
eq("answer kept", log[0].answer, "9.81");
near("awayMsBefore", log[0].awayMsBefore, 40_000);
near("msSinceReturn", log[0].msSinceReturn, 3_000);

// 8. Away time resets between attempts.
x.noteVisibility(false); adv(10_000); x.noteVisibility(true);
x.noteSubmit("a", { answer: "9.8", correct: false });
near("awayMsBefore is per-attempt, not cumulative", x.snapshot().items.a.attemptLog[1].awayMsBefore, 10_000);

// 9. Time follows the current item.
x = mk(); x.setItem("a"); adv(20_000); x.noteActivity();
x.setItem("b"); adv(30_000); x.noteActivity();
s = x.snapshot();
near("item a time", s.items.a.activeMs, 20_000);
near("item b time", s.items.b.activeMs, 30_000);
near("totalActiveMs", totalActiveMs(s), 50_000);

// 10. Restore accumulates across sittings.
const saved = s;
const y = createTelemetry({ now: () => t });
y.restore(saved);
y.setItem("a"); adv(15_000); y.noteActivity();
near("restored time accumulates", y.snapshot().items.a.activeMs, 35_000);

// 11. A long gap opens a new session.
x = mk(); x.setItem("a");
x.noteVisibility(false); adv(45 * 60_000); x.noteVisibility(true);
adv(1000);
eq("long gap splits the session", x.snapshot().sessions.length, 2);

// 12. Attempt log is bounded.
x = mk(); x.setItem("a");
for (let i = 0; i < 20; i++) { adv(1000); x.noteSubmit("a", { answer: `v${i}`, correct: false }); }
eq("attempt log bounded", x.snapshot().items.a.attemptLog.length, 8);

// 13. Paste counting + read helpers.
x = mk(); x.setItem("a"); x.notePaste("a"); x.notePaste("a");
eq("paste counted", x.snapshot().items.a.pasteCount, 2);
eq("formatDuration s", formatDuration(45_000), "45s");
eq("formatDuration m", formatDuration(260_000), "4m 20s");
eq("formatDuration h", formatDuration(3_960_000), "1h 06m");
eq("formatDuration none", formatDuration(0), "-");
x = mk(); x.setItem("a"); adv(22_000); x.noteSubmit("a", { answer: "1", correct: true });
near("timeToFirstAttempt", timeToFirstAttemptMs(x.snapshot().items.a), 22_000);

console.log(fails ? `\n${fails} FAILURE(S)` : "\nall passed");
process.exit(fails ? 1 : 0);
