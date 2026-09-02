// Homework engagement telemetry — the accumulator behind `classes/{classId}/hwTelemetry`.
//
// This measures how a student spent their time on an assignment: attention per problem, trips
// away from the tab, pasted input, and a bounded log of what they actually typed on each
// attempt. It exists so the instructor's Analytics tab can say something about effort and
// difficulty rather than only about final scores, and so an assignment's real cost in student
// hours is knowable.
//
// No React and no direct DOM access: the caller feeds it browser events and reads `snapshot()`.
// That keeps the accounting rules (below) in one testable place instead of scattered through
// HomeworkRunner's effects.
//
// ── Three rules that make the numbers mean anything ──────────────────────────────
//
// 1. ACTIVE TIME EXCLUDES TIME AWAY. Wall-clock between two events is not time spent. A student
//    who opens problem 3 at 9pm, eats dinner, and submits at 11pm did not spend 120 minutes on
//    it. Accrual runs only while the tab is visible AND the window is focused AND the student
//    has done something in the last IDLE_MS. Without this every figure here is fiction.
//
// 2. "HIDDEN" AND "UNFOCUSED" ARE DIFFERENT THINGS AND ARE NEVER SUMMED. `hiddenMs` comes from
//    the Page Visibility API and means the tab was genuinely backgrounded — a reliable signal.
//    `unfocusedMs` means the window lost OS focus while the tab was still on screen (alt-tab, a
//    second monitor), and is noisy: an OS notification, a screenshot tool, devtools and the
//    app's own file picker all trigger it. They are kept disjoint on purpose — unfocused time
//    only accrues while the document is still visible — so neither is double-counted, and the
//    caller must never add them together and present the total as "time away".
//
// 3. EXCURSION SHAPE BEATS EXCURSION TOTAL. Total away-time cannot tell dinner from Discord
//    from the textbook. What carries signal is the pattern relative to submits, so each attempt
//    records `awayMsBefore` (time away since the previous attempt on this item) and
//    `msSinceReturn` (how quickly the answer followed a return to the tab). A short excursion
//    that repeatedly precedes a correct answer by seconds is a shape; one long gap mid-set is a
//    meal.
//
// ── What this cannot do, and what follows from that ──────────────────────────────
//
// It does not see a phone next to the laptop, and it cannot tell a textbook tab from a chatbot
// tab — no browser API exposes other tabs, and none should. Leaving the tab is also completely
// normal: the syllabus, a unit converter and Desmos all live elsewhere. So these numbers
// support "who might be worth a conversation" and "which problem is costing the class an hour",
// never a verdict. Present away-time inside a student's own timeline or as a class aggregate,
// never as a ranked leaderboard column. See docs/analytics.md.

// No activity for this long and the clock stops. Generous, because reading a physics problem
// and working it on paper are both legitimately input-free.
export const IDLE_MS = 120_000;
// Excursions shorter than this are notification flicker and alt-tab bounce, not trips away.
const MIN_EXCURSION_MS = 2_000;
// A gap longer than this is a new sitting, not an excursion within one.
const SESSION_GAP_MS = 30 * 60_000;
// A single accrual segment is capped so a wedged timer or a sleeping laptop that never fired a
// visibility event cannot dump hours onto one problem.
const MAX_SEGMENT_MS = 10 * 60_000;

const MAX_ATTEMPT_LOG = 8;   // maxAttempts is 5; the slack absorbs a grading config change
const MAX_SESSIONS = 20;
const MAX_ANSWER_CHARS = 120; // enough for any typed answer, bounded against a pasted essay

const blankItem = () => ({
  activeMs: 0, hiddenMs: 0, hiddenCount: 0, unfocusedMs: 0, unfocusedCount: 0,
  pasteCount: 0, firstSeenAt: null, firstSubmitAt: null, resolvedAt: null, attemptLog: [],
});

// `now` is injectable so the accounting can be driven deterministically in a test.
export function createTelemetry({ now = () => Date.now() } = {}) {
  const items = {};
  let sessions = [];
  let currentId = null;
  let activeSince = null;      // start of the current accruing segment, or null
  let lastActivityAt = now();
  let visible = true;
  let focused = true;
  let hiddenSince = null;
  let unfocusedSince = null;
  let lastReturnAt = null;     // when the student last came back to the tab
  let sessionStart = now();
  // Away time banked against the current item since its last recorded attempt, so an attempt
  // can report what happened just before it rather than over the whole assignment.
  let awaySinceAttempt = {};

  const item = id => (items[id] ||= blankItem());
  const idle = () => now() - lastActivityAt > IDLE_MS;
  const shouldAccrue = () => visible && focused && !idle();

  // Bank whatever active time has run since the last commit, then restart the segment if the
  // student is still working. Called before every state change, so no transition can lose or
  // double-count a slice.
  const commitActive = () => {
    if (activeSince != null && currentId) {
      // The segment ends at the idle cutoff, not at `now`. A student who stops typing does not
      // keep accruing until the next event happens to fire, so a segment that ran through an
      // idle stretch banks only the part before the student went quiet.
      const end = Math.min(now(), Math.max(activeSince, lastActivityAt + IDLE_MS));
      const elapsed = Math.min(Math.max(0, end - activeSince), MAX_SEGMENT_MS);
      if (elapsed > 0) item(currentId).activeMs += elapsed;
    }
    activeSince = shouldAccrue() ? now() : null;
  };

  const api = {
    // The item time is being attributed to: the deepest part the student can currently see.
    setItem(id) {
      if (id === currentId) return;
      commitActive();
      currentId = id || null;
      if (currentId) {
        const it = item(currentId);
        if (!it.firstSeenAt) it.firstSeenAt = new Date(now()).toISOString();
        awaySinceAttempt[currentId] ??= 0;
      }
      activeSince = shouldAccrue() && currentId ? now() : null;
    },

    // Any pointer or key event. Restarts a segment that idle() had stopped.
    noteActivity() {
      const wasIdle = idle();
      // Bank the pre-idle portion BEFORE the timestamp moves: commitActive reads lastActivityAt
      // to find the cutoff, so updating it first would silently discard the active stretch that
      // ran up to the moment the student went quiet.
      if (wasIdle) commitActive();
      lastActivityAt = now();
      if (wasIdle && currentId && shouldAccrue()) activeSince = now();
    },

    noteVisibility(isVisible) {
      if (isVisible === visible) return;
      commitActive();
      visible = isVisible;
      if (!visible) {
        hiddenSince = now();
        // Leaving the page also ends any unfocused stretch: the two are kept disjoint so a
        // single excursion is never counted under both headings.
        if (unfocusedSince != null) { unfocusedSince = null; }
      } else {
        if (hiddenSince != null) {
          const away = now() - hiddenSince;
          hiddenSince = null;
          if (away >= MIN_EXCURSION_MS && currentId) {
            const it = item(currentId);
            it.hiddenMs += away; it.hiddenCount += 1;
            awaySinceAttempt[currentId] = (awaySinceAttempt[currentId] || 0) + away;
          }
          lastReturnAt = now();
          // A long enough gap is a new sitting rather than a trip away.
          if (away >= SESSION_GAP_MS) {
            sessions.push({ start: new Date(sessionStart).toISOString(), end: new Date(sessionStart + (now() - away - sessionStart)).toISOString() });
            sessions = sessions.slice(-MAX_SESSIONS);
            sessionStart = now();
          }
        }
        lastActivityAt = now();
      }
      activeSince = shouldAccrue() && currentId ? now() : null;
    },

    noteFocus(isFocused) {
      if (isFocused === focused) return;
      commitActive();
      focused = isFocused;
      if (!focused) {
        // Only track unfocused stretches while the tab is still on screen; a tab-switch is
        // already counted as hidden time and must not be recorded twice.
        unfocusedSince = visible ? now() : null;
      } else {
        if (unfocusedSince != null) {
          const away = now() - unfocusedSince;
          unfocusedSince = null;
          if (away >= MIN_EXCURSION_MS && currentId) {
            const it = item(currentId);
            it.unfocusedMs += away; it.unfocusedCount += 1;
            awaySinceAttempt[currentId] = (awaySinceAttempt[currentId] || 0) + away;
          }
          lastReturnAt = now();
        }
        lastActivityAt = now();
      }
      activeSince = shouldAccrue() && currentId ? now() : null;
    },

    // Paste is counted, never blocked. Blocking a numeric field is user-hostile and trivially
    // defeated; a count is free evidence and costs the honest student nothing.
    notePaste(id) {
      if (!id) return;
      item(id).pasteCount += 1;
    },

    // One graded attempt. `answer` is kept (truncated) because the distribution of WRONG answers
    // on an item is the most useful teaching signal in the whole dataset: "9 of 24 first
    // answered 4.9 where the key is 9.8" is a dropped factor of 2 and a lecture slide.
    noteSubmit(id, { answer = "", correct = false } = {}) {
      if (!id) return;
      commitActive();
      const it = item(id);
      const iso = new Date(now()).toISOString();
      if (!it.firstSubmitAt) it.firstSubmitAt = iso;
      it.attemptLog.push({
        at: iso,
        answer: String(answer).slice(0, MAX_ANSWER_CHARS),
        correct: !!correct,
        awayMsBefore: Math.round(awaySinceAttempt[id] || 0),
        msSinceReturn: lastReturnAt == null ? null : now() - lastReturnAt,
      });
      it.attemptLog = it.attemptLog.slice(-MAX_ATTEMPT_LOG);
      awaySinceAttempt[id] = 0;
      lastActivityAt = now();
    },

    noteResolved(id) {
      if (!id) return;
      const it = item(id);
      if (!it.resolvedAt) it.resolvedAt = new Date(now()).toISOString();
    },

    // Close the open sitting. Called on leave and unmount so a session has an end.
    endSession() {
      commitActive();
      activeSince = null;
      sessions.push({ start: new Date(sessionStart).toISOString(), end: new Date(now()).toISOString() });
      sessions = sessions.slice(-MAX_SESSIONS);
      sessionStart = now();
    },

    // The persistable object. Banks the running segment first so a snapshot taken mid-problem
    // includes the time spent on it so far.
    snapshot() {
      commitActive();
      return {
        items,
        sessions: [...sessions, { start: new Date(sessionStart).toISOString(), end: new Date(now()).toISOString() }].slice(-MAX_SESSIONS),
        updatedAt: new Date(now()).toISOString(),
      };
    },

    // Seed from a previously saved node so a student who works across several sittings has
    // cumulative time rather than a fresh clock each visit.
    restore(saved) {
      if (!saved || typeof saved !== "object") return;
      for (const [id, v] of Object.entries(saved.items || {})) {
        if (!v || typeof v !== "object") continue;
        items[id] = { ...blankItem(), ...v, attemptLog: Array.isArray(v.attemptLog) ? v.attemptLog.slice(-MAX_ATTEMPT_LOG) : [] };
      }
      if (Array.isArray(saved.sessions)) sessions = saved.sessions.slice(-MAX_SESSIONS);
    },
  };
  return api;
}

// ── Reading a saved telemetry node ────────────────────────────────────────────
// Pure helpers over `snapshot()` output, for the instructor views.

export function totalActiveMs(tele) {
  return Object.values(tele?.items || {}).reduce((sum, it) => sum + (it.activeMs || 0), 0);
}

// "4m 20s" / "1h 06m" / "18s". Returns the no-data hyphen for nothing recorded.
export function formatDuration(ms) {
  if (!ms || ms < 1000) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

// Seconds between an item first appearing and the student's first submitted attempt on it.
// The sharpest single number for "did they actually work this problem": a correct three
// significant figure answer twenty seconds after the problem first rendered was not derived
// here. Read it as a percentile against the class on the SAME item, never against a fixed
// threshold, and never on its own.
export function timeToFirstAttemptMs(itemTele) {
  if (!itemTele?.firstSeenAt || !itemTele?.firstSubmitAt) return null;
  const d = new Date(itemTele.firstSubmitAt) - new Date(itemTele.firstSeenAt);
  return Number.isFinite(d) && d >= 0 ? d : null;
}
