import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../theme.js";
import { isLate } from "../../utils.js";
import { fbGet, fbSet, fbUpload, classPath } from "../../firebase.js";
import { MathField, hideMathKeyboard } from "../../components/MathField.jsx";
import { MathText } from "../../components/MathText.jsx";
import { GraphField } from "../../components/GraphField.jsx";
import { VectorField } from "../../components/VectorField.jsx";
import { FBDField } from "../../components/FBDField.jsx";
import { VectorBuildup } from "../../components/VectorBuildup.jsx";
import {
  HW_GRADING_DEFAULTS,
  creditForAttempt,
  phaseForAttempt,
  evaluateHomeworkAnswer,
  revealHomeworkAnswers,
  revealAnswerFor,
  checkWorkIntegrity,
  graphHasInput,
  keyToValue,
  vectorHasInput,
  keyToVectorValue,
  fbdHasInput,
  describeFBDDiagram,
  keyToFBDValue,
  gradeGraph,
  gradeVectors,
  gradeFBD,
  snapVectorMagnitudes,
  snapFBDDirections,
  graphHint,
  vectorHint,
  fbdHint,
  parseNumber,
  sigFigsOf,
  toSciString,
} from "../../homework.js";

const GRAPHICAL = new Set(["graph", "vector", "fbd"]);

// Every problem statement the runner shows — the shared multipart stem and each part's
// prompt — goes through here so it renders identically AND non-copyable (`.hw-no-copy`
// in index.css). The copy/cut handlers are belt-and-braces for a browser that still lets
// unselectable text into a Select All range; they can only fire if one does.
function Prompt({ children }) {
  const { text } = useTheme();
  const block = e => e.preventDefault();
  return (
    <div className="hw-no-copy" onCopy={block} onCut={block} style={{ color: text, fontSize: 15, lineHeight: 1.6 }}>
      <MathText>{children}</MathText>
    </div>
  );
}

// Feedback palette, shared by the per-item feedback callout and the always-visible `freeHint`
// box. Module-level because it is theme-independent and two renderers need the same amber.
// `retry` is a no-cost nudge (blue, like `revealed`) — deliberately NOT the red of a wrong
// answer, since it costs the student nothing.
const FB_COLOR = { correct: "#4ade80", hint: "#fbbf24", revealed: "#60a5fa", wrong: "#f87171", retry: "#60a5fa" };

// An instructor-authored hint that is shown from the start, costs nothing, and never touches
// credit — distinct from the `hintAfterAttempt` hint the grader produces and from the graphical
// `Hint` button (both of which cap the item). It exists for a problem whose intended first
// move is a single non-obvious circuit reading (e.g. "the capacitor branch carries no current
// once it is fully charged"), where without it the problem tests noticing rather than the
// physics being assessed. Authored per problem in the course file as `freeHint`; carried on the
// problem for a multipart (shown under the shared stem) or on the item for a single-part one.
// Non-copyable for the same reason prompts are: it is problem-specific reasoning.
function FreeHint({ children }) {
  const { text } = useTheme();
  const block = e => e.preventDefault();
  return (
    <div
      className="hw-no-copy"
      onCopy={block}
      onCut={block}
      style={{ background: FB_COLOR.hint + "1f", border: `1px solid ${FB_COLOR.hint}55`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text, lineHeight: 1.5 }}
    >
      <span style={{ color: FB_COLOR.hint, fontWeight: 700 }}>💡 Hint: </span>
      <MathText>{children}</MathText>
    </div>
  );
}

const ACCEPTED_WORK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
const HW_INTEGRITY_MODEL = "claude-opus-4-8";

// Flatten a problem into its gradable items (a single item, or one per multipart part).
// Each item carries a `weight` = its fraction of the problem's 1 point, `_problemId`, and the
// problem-level context the grader needs: `_figure` (image) and, for multipart parts,
// `_problemPrompt` (the shared stem shown above the parts). These let evaluateHomeworkAnswer
// give Claude the FULL problem + figure, not just an isolated part prompt.
function itemsOf(p) {
  if (p.parts && p.parts.length) {
    return p.parts.map(pt => ({
      ...pt, weight: 1 / p.parts.length, _problemId: p.id,
      _figure: p.figure || null, _problemPrompt: p.prompt || null,
    }));
  }
  return [{
    id: p.id, prompt: p.prompt, answerType: p.answerType, freeHint: p.freeHint,
    unit: p.unit, graph: p.graph, vector: p.vector, weight: 1, _problemId: p.id,
    _figure: p.figure || null, _problemPrompt: null,
  }];
}

// MasteringPhysics-style homework runner. Owns all per-item state; on finish, builds a
// submission object and calls onFinish(submission) (which persists it and may throw).
// `preview` = an instructor is running this (from the Modules editor or the Calendar). It is a
// labelling flag ONLY:
// the caller always pairs it with `practice`, and `practice` is what actually keeps the runner off
// every per-student path (drafts, attempt counts, work upload, submission), all of which read
// `loggedInStudent` — null on the instructor side. Never gate behaviour on `preview` alone.
//
// `lightMode` / `onToggleTheme` put the app's theme switch in the runner's top bar. The runner is
// a full-screen takeover with no portal header, so without it a student who needs the other mode
// mid-assignment would have to leave the homework to get it. That matters more here than on most
// screens: homework figures are white-background textbook screenshots, and the drawing fields
// (graph / vector / FBD) are the finest-detail thing in the app.
export function HomeworkRunner({ homework, courseType, classId, loggedInStudent, practice = false, preview = false, backLabel: backLabelProp, onFinish, onLeave, lightMode = false, onToggleTheme }) {
  const whoLabel = preview ? "Instructor preview · not saved" : (loggedInStudent?.fullName || "");
  // The caller names the return destination (a preview can be launched from Modules or the
  // Calendar); fall back to the generic wording when it doesn't.
  const backLabel = backLabelProp || (preview ? "Back to Modules" : "Back to Course");
  const { s, text, muted, border, teal, card, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  const G = homework.grading || HW_GRADING_DEFAULTS;

  const problems = homework.problems || [];
  const allItems = problems.flatMap(itemsOf);
  const total = problems.length;

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});      // { itemId: string }
  const [attempts, setAttempts] = useState({});    // { itemId: number }
  const [status, setStatus] = useState({});        // { itemId: "open"|"correct"|"revealed" }
  const [earned, setEarned] = useState({});        // { itemId: credit (points) }
  const [feedback, setFeedback] = useState({});    // { itemId: { text, kind } }
  const [submitNonce, setSubmitNonce] = useState(0); // bumps per submit → triggers scroll-to-feedback
  const [glow, setGlow] = useState(false);          // green "burst" on the advance button when a problem completes
  const [revealed, setRevealed] = useState({});    // { itemId: revealed answer string }
  const [gradePass, setGradePass] = useState({});  // { itemId: { [curveId|vectorId]: bool } } — per-piece verdict from the last graph/vector grade
  const [hintUsed, setHintUsed] = useState({});    // { itemId: true } — graphical item where a hint was taken (drops self-solve to hintCredit)
  const [history, setHistory] = useState({});      // { itemId: [Claude turns] }
  const [busy, setBusy] = useState(null);          // itemId currently evaluating
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [navWarn, setNavWarn] = useState(null);    // { go } — pending Next/Finish while a diagram is unfinished
  const [confirmReveal, setConfirmReveal] = useState(null); // graphical item pending a "Show answer" confirm
  const [showGrading, setShowGrading] = useState(true);  // grading-policy explainer, expanded by default
  // Written-work acknowledgment gate (non-practice). Session-only (not persisted), so the
  // student must re-confirm every time they begin or resume — see the gate screen below.
  const [acked, setAcked] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);   // the "I understand" checkbox state

  // Written-work integrity step (skipped in practice mode).
  const [submitStep, setSubmitStep] = useState(false);   // showing the upload-your-work step
  const [workFiles, setWorkFiles] = useState([]);        // [{ file, name, mime, previewUrl|null }]
  const [uploadedWork, setUploadedWork] = useState(null);// cached Storage results so retry doesn't re-upload
  const [integrityResult, setIntegrityResult] = useState(null); // cached Claude verdict so retry doesn't re-check

  // Draft + attempt persistence (skipped in practice mode).
  // hwAttempts is a separate node from the draft: it is written on every submission attempt
  // and seeded into local state unconditionally on mount, so students cannot reset attempt
  // counts by logging out or leaving without resuming.
  const draftPath = !practice && classId
    ? classPath(classId, `hwDrafts/${loggedInStudent.studentId}/${homework.id}`)
    : null;
  const attemptsPath = !practice && classId
    ? classPath(classId, `hwAttempts/${loggedInStudent.studentId}/${homework.id}`)
    : null;
  // Instructor-facing completion summary — see progressSnapshot below.
  const progressPath = !practice && classId
    ? classPath(classId, `hwProgress/${loggedInStudent.studentId}/${homework.id}`)
    : null;
  const [draftLoading, setDraftLoading] = useState(!!draftPath);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [savedAttempts, setSavedAttempts] = useState({});

  useEffect(() => {
    if (!draftPath) return;
    Promise.all([
      fbGet(draftPath).catch(() => null),
      fbGet(attemptsPath).catch(() => null),
    ]).then(([d, att]) => {
      const sa = att && typeof att === "object" ? att : {};
      setSavedAttempts(sa);
      // Seed local attempts from the authoritative node ALWAYS — not just when a resume
      // modal is shown. Otherwise a student who made wrong-but-unresolved attempts (which
      // never set `status`, so no draft is written) would return with attempts reset to 0
      // and overwrite the saved count on their next submit, defeating the anti-gaming guard.
      setAttempts(sa);
      // Offer to resume whenever there is any saved progress: resolved items, in-progress
      // attempts, attempt counts on the authoritative node, or typed/drawn-but-unresolved work
      // (graphical items live-lock without attempts, so their partial progress lives in answers/gradePass).
      const hasDraftProgress = d && (Object.keys(d.status || {}).length > 0 || Object.keys(d.attempts || {}).length > 0 || Object.keys(d.answers || {}).length > 0 || Object.keys(d.gradePass || {}).length > 0);
      if (d && (hasDraftProgress || Object.keys(sa).length > 0)) setPendingDraft(d);
    }).finally(() => setDraftLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // applyDraft uses savedAttempts (authoritative) instead of the draft's copy.
  const applyDraft = d => {
    setAnswers(d.answers || {}); setAttempts(savedAttempts); setStatus(d.status || {});
    setEarned(d.earned || {}); setFeedback(d.feedback || {}); setRevealed(d.revealed || {});
    setGradePass(d.gradePass || {}); setHintUsed(d.hintUsed || {}); setHistory(d.history || {}); setIdx(d.idx || 0);
  };

  // Clearing the draft clears its progress summary too: from final submission on, the
  // submission itself is the record of a completed assignment.
  const clearDraft = () => {
    if (!draftPath) return;
    fbSet(draftPath, null).catch(() => {});
    fbSet(progressPath, null).catch(() => {});
  };

  // One source of truth for the draft snapshot shape, reused by the auto-save effect, the
  // leave-confirm handler, and the save-failure exit so the student's work is preserved
  // identically in every exit path.
  const draftSnapshot = () => ({ answers, attempts, status, earned, feedback, revealed, gradePass, hintUsed, history, idx, savedAt: new Date().toISOString() });

  // Instructor-facing progress summary, written beside the draft on every save path. It is a
  // tiny derived node so the Assignments hub can show how far the class has got WITHOUT
  // reading the draft itself, which carries every typed answer, every feedback string and the
  // whole Claude history per item. Weighted by problem rather than by item, so 50% means half
  // the assignment the same way the /10 score does; a `revealed` item counts as done, since
  // this measures how far through they are, not how much credit they earned.
  const progressSnapshot = () => {
    const done = allItems.reduce((sum, it) => {
      const st = status[it.id];
      return sum + (st === "correct" || st === "revealed" ? (it.weight || 1) : 0);
    }, 0);
    return {
      done: parseFloat(done.toFixed(2)),
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      updatedAt: new Date().toISOString(),
    };
  };

  const persistDraft = () => draftPath
    ? Promise.all([
        fbSet(draftPath, draftSnapshot()).catch(() => {}),
        fbSet(progressPath, progressSnapshot()).catch(() => {}),
      ]).then(() => {})
    : Promise.resolve();

  // Auto-save the full draft after every submit (attempts increments on each one) and
  // whenever an item is resolved. Both `attempts` and `status` are fresh object references
  // per submit, and the effect fires after all of submitItem's state updates are committed,
  // so feedback/hints/history for still-open items are persisted across sessions too.
  useEffect(() => {
    if (!draftPath || draftLoading || pendingDraft) return;
    if (!Object.keys(attempts).length && !Object.keys(status).length) return;
    persistDraft();
  }, [attempts, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // After every submission, scroll the deepest visible item into view. This is the newly
  // revealed part when a correct answer unlocks the next one, and otherwise the item just
  // submitted — so its feedback (correct answer + credit earned) is seen even for the final
  // part of a problem, single-part problems, and wrong attempts, none of which reveal a new
  // part. Without this the feedback can populate below the fold, behind the footer.
  // `submitNonce` bumps once per submit so the scroll fires even when the target is unchanged.
  const revealRef = useRef(null);
  const bodyRef = useRef(null); // the scrollable body — scrolled fully to the bottom when a buildup reveals
  // Input element of the deepest visible item (the part the student should answer next).
  // Auto-focused so the cursor lands in the next field without a click — on entry, on
  // navigation, and after a submit reveals a new part. Numeric/text inputs only (the common
  // cases); MathField/GraphField aren't focusable from here, so they fall through harmlessly.
  const inputRef = useRef(null);
  const focusInput = () => {
    const el = inputRef.current;
    if (el && !el.disabled) el.focus({ preventScroll: true }); // preventScroll: don't fight the smooth scroll
  };
  useEffect(() => {
    if (submitNonce === 0) return; // skip initial mount
    // When a buildup illustration just appeared, scroll the whole body to the bottom so the full
    // animation + caption are in view; otherwise center the freshly revealed item.
    const its = itemsOf(problems[idx]);
    const firstOpen = its.findIndex(it => status[it.id] !== "correct" && status[it.id] !== "revealed");
    const lastVisible = (problems[idx]?.parts?.length ? (firstOpen === -1 ? its.length - 1 : firstOpen) : its.length - 1);
    const deep = its[lastVisible];
    const showsBuildup = deep && deep.answerType === "vector" && deep.vector?.buildup && (status[deep.id] === "correct" || status[deep.id] === "revealed");
    if (showsBuildup && bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
    } else {
      revealRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    focusInput();
  }, [submitNonce]);

  // Focus the first open input when entering the runner or navigating to another problem.
  // No-ops while the resume modal / ack gate / loading screens are up (inputRef is unset).
  useEffect(() => {
    if (!practice && !acked) return;
    focusInput();
  }, [idx, acked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Green "burst" on the advance (Next / Finish) button once the current problem is fully
  // resolved, to invite the student onward. Armed once per problem (tracked in glowedRef) and
  // delayed 3s so the student first reads the result of their last part; then the button
  // glows in a repeating double-burst (the 5s-looped `hwGlowBurst` keyframe) until they leave
  // the problem. The pending arm-timer lives in a ref so navigation can cancel it before it fires.
  const glowedRef = useRef(new Set());
  const glowTimerRef = useRef(null);
  useEffect(() => {
    if (submitNonce === 0) return;
    const its = itemsOf(problems[idx]);
    const resolved = its.every(it => { const st = status[it.id]; return st && st !== "open"; });
    if (resolved && !glowedRef.current.has(idx)) {
      glowedRef.current.add(idx);
      glowTimerRef.current = setTimeout(() => setGlow(true), 3000);
    }
    return () => clearTimeout(glowTimerRef.current); // also clears on unmount
  }, [submitNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the glow (and cancel a pending arm) when navigating to another problem, so it only
  // ever shows on the problem the student just completed.
  useEffect(() => {
    clearTimeout(glowTimerRef.current);
    setGlow(false);
  }, [idx]);

  const late = isLate(homework.dueDate);
  const runningScore = allItems.reduce((sum, it) => sum + (earned[it.id] || 0), 0);
  const allResolved = allItems.every(it => status[it.id] && status[it.id] !== "open");

  const setAns = (id, v) => setAnswers(a => ({ ...a, [id]: v }));

  // ── Graphical items (graph / vector): no Submit button ────────────────────────
  // Grading is deterministic and local (gradeGraph / gradeVectors — no Claude, free, instant),
  // so we grade on EVERY placement. Each piece that lands in tolerance turns green and freezes
  // (the field locks pieces whose id is in `grade.pass`). When all pieces pass, the part resolves
  // at full credit. A stuck student uses "Show answer" (reveal at G.revealCredit) instead.
  const gradeGraphical = (item, raw) =>
    item.answerType === "graph" ? gradeGraph(raw, item.graph)
      : item.answerType === "fbd" ? gradeFBD(raw, item.fbd)
      : gradeVectors(raw, item.vector);
  const graphicalHasInput = (item, raw) =>
    item.answerType === "graph" ? graphHasInput(raw)
      : item.answerType === "fbd" ? fbdHasInput(raw)
      : vectorHasInput(raw);
  const graphicalNoun = item => item.answerType === "graph" ? "sketch" : item.answerType === "fbd" ? "free-body diagram" : "diagram";

  const onGraphicalChange = (item, v) => {
    const res = gradeGraphical(item, v);
    // Direction-graded vector questions may opt into `snapMagnitude`: an arrow that lands in the
    // right direction is rescaled to the key's length (angle untouched), so the finished diagram
    // shows the relative magnitudes the question never asked them to measure. Grading runs on
    // what they drew; only the stored/redisplayed value is corrected.
    // Two different snaps, for two different reasons:
    //   vector — corrects an UNGRADED magnitude the question withheld (the clock's E_n ∝ n)
    //   fbd    — corrects the graded DIRECTION, because off-axis forces display their angle and
    //            a within-tolerance arrow would otherwise label a wrong one. Lengths are left
    //            exactly as drawn in both cases.
    const stored = item.answerType === "vector" ? snapVectorMagnitudes(v, item.vector, res.pass)
      : item.answerType === "fbd" ? snapFBDDirections(v, item.fbd, res)
      : v;
    setAnswers(a => ({ ...a, [item.id]: stored }));
    setGradePass(g => ({ ...g, [item.id]: res.pass }));
    const st = status[item.id];
    if (res.correct && st !== "correct" && st !== "revealed") {
      // Full credit when self-solved; if a hint was taken, drop to hintCredit (consistent with
      // the rest of the homework's grading schedule).
      const credit = hintUsed[item.id] ? G.hintCredit : 1;
      setEarned(e => ({ ...e, [item.id]: credit * item.weight }));
      setStatus(s2 => ({ ...s2, [item.id]: "correct" }));
      setFeedback(f => ({ ...f, [item.id]: { text: `Your ${graphicalNoun(item)} matches.` + (hintUsed[item.id] ? ` (Hint used, ${Math.round(G.hintCredit * 100)}% credit.)` : ""), kind: "correct" } }));
      setSubmitNonce(n => n + 1);                                       // scroll + unlock next part / play buildup
    }
  };

  const showGraphicalHint = item => {
    setHintUsed(h => ({ ...h, [item.id]: true }));                      // taking a hint caps this part at hintCredit
    const res = gradeGraphical(item, answers[item.id] || "");
    const r0 = res.reasons[0];
    const text = r0 ? (item.answerType === "graph" ? graphHint(r0) : item.answerType === "fbd" ? fbdHint(r0) : vectorHint(r0)) : "Place each piece where the steps describe. It locks in green when it's in the right spot.";
    setFeedback(f => ({ ...f, [item.id]: { text: "💡 " + text, kind: "hint" } }));
  };

  const revealGraphical = item => {
    setConfirmReveal(null);
    setStatus(s2 => ({ ...s2, [item.id]: "revealed" }));
    setEarned(e => ({ ...e, [item.id]: G.revealCredit * item.weight }));
    setFeedback(f => ({ ...f, [item.id]: { text: `Here is the correct ${graphicalNoun(item)}.`, kind: "revealed" } }));
    setSubmitNonce(n => n + 1);
  };

  const submitItem = async item => {
    if (busy) return;
    const ans = (answers[item.id] || "").trim();
    if (!ans) return;
    // MathLive's virtual keyboard is a page-level singleton that nothing closes on its own; a
    // submitted answer means the student is done typing it, so dismiss it rather than leaving
    // it covering the next part.
    if (item.answerType === "math") hideMathKeyboard();
    setBusy(item.id);
    const attemptNum = (attempts[item.id] || 0) + 1;
    const phase = phaseForAttempt(attemptNum, G);
    // For a written part (text/math), tell Claude how the student labeled the FBD(s) they drew
    // earlier in this same problem, so labels like "N_1" are read by the student's own diagram
    // (e.g. their box-box contact normal) rather than by a conventional default.
    let diagramContext = null;
    if (item.answerType === "text" || item.answerType === "math") {
      const descs = allItems
        .filter(it => it._problemId === item._problemId && it.answerType === "fbd" && fbdHasInput(answers[it.id] || ""))
        .map(it => describeFBDDiagram(answers[it.id] || "", it.fbd, it.fbd?.bodyLabel))
        .filter(Boolean);
      if (descs.length) diagramContext = descs.join("\n");
    }
    try {
      const result = await evaluateHomeworkAnswer({
        item, hwId: homework.id, studentAnswer: ans, attemptNum, phase,
        history: history[item.id] || [], courseType,
        grading: G, diagramContext,
      });
      if (result.retry) {
        // A no-cost nudge, not a verdict: the entry was malformed for what the question asks
        // (e.g. a negative value in a magnitude blank) rather than physically wrong, so it
        // leaves the attempt counter and status untouched. The message is deliberately
        // independent of whether their number was right, so it reveals nothing.
        setFeedback(f => ({ ...f, [item.id]: { text: result.message, kind: "retry" } }));
      } else {
        // The server returns the formatted correct answer once the item is resolved (correct OR
        // revealed) — store it so the "Correct answer:" line and the submission key have it.
        if (result.revealedAnswer != null) setRevealed(r => ({ ...r, [item.id]: result.revealedAnswer }));
        if (result._historyUser) {
          setHistory(h => ({ ...h, [item.id]: [...(h[item.id] || []), { role: "user", content: result._historyUser }, { role: "assistant", content: result._historyAssistant }] }));
        }
        // Per-piece verdict (graph curves / vector arrows) — drives the checklist greening so a
        // drawn-but-unverified piece never shows as correct until it's actually been submitted right.
        if (result._gradePass) setGradePass(g => ({ ...g, [item.id]: result._gradePass }));
        setAttempts(a => ({ ...a, [item.id]: attemptNum }));
        // Persist attempt count immediately — written even for wrong-but-still-open items so
        // the count survives a logout or leaving without resuming.
        if (attemptsPath) fbSet(attemptsPath, { ...attempts, [item.id]: attemptNum }).catch(() => {});
        if (result.correct) {
          setEarned(e => ({ ...e, [item.id]: creditForAttempt(attemptNum, G) * item.weight }));
          setStatus(st => ({ ...st, [item.id]: "correct" }));
          setFeedback(f => ({ ...f, [item.id]: { text: result.message, kind: "correct" } }));
        } else if (attemptNum >= G.maxAttempts) {
          setEarned(e => ({ ...e, [item.id]: G.revealCredit * item.weight }));
          setStatus(st => ({ ...st, [item.id]: "revealed" }));
          setRevealed(r => ({ ...r, [item.id]: result.revealedAnswer || revealAnswerFor(item) }));
          setFeedback(f => ({ ...f, [item.id]: { text: result.message, kind: "revealed" } }));
        } else {
          setFeedback(f => ({ ...f, [item.id]: { text: result.message, kind: attemptNum >= G.hintAfterAttempt ? "hint" : "wrong" } }));
        }
      }
    } catch (err) {
      // Grader unreachable/errored — surface the reason and DON'T consume an attempt.
      setFeedback(f => ({ ...f, [item.id]: { text: "⚠️ " + (err?.message || "Couldn't reach the grader.") + " Your attempt was not counted, so please try again.", kind: "wrong" } }));
    }
    setBusy(null);
    // Bump after the feedback/status updates above so the scroll effect runs once the
    // result (and any newly revealed part) has rendered.
    setSubmitNonce(n => n + 1);
  };

  const buildSubmission = (workFilesMeta = [], integrity = null, serverAnswers = {}) => {
    const rawScore = parseFloat(runningScore.toFixed(2));
    const pct = total > 0 ? rawScore / total : 0;
    const score = parseFloat((pct * 10 * (late ? 0.5 : 1)).toFixed(2));
    const problemsBreakdown = problems.map(p => {
      const its = itemsOf(p);
      const partRows = its.map(it => ({
        id: it.id, prompt: it.prompt, answerType: it.answerType,
        studentAnswer: answers[it.id] || "", attempts: attempts[it.id] || 0,
        status: status[it.id] || "open", earned: parseFloat((earned[it.id] || 0).toFixed(3)),
        max: it.weight,
        // Graphical answers are graded locally (placeholder string). Numeric/text/math correct
        // answers live server-side — use the value the grader returned, or the submit-time reveal.
        correctAnswer: GRAPHICAL.has(it.answerType) ? revealAnswerFor(it) : (revealed[it.id] ?? serverAnswers[it.id] ?? null),
        ...(it.answerType === "graph" ? { graph: it.graph } : {}),
        ...(it.answerType === "vector" ? { vector: it.vector } : {}),
        ...(it.answerType === "fbd" ? { fbd: it.fbd } : {}),
      }));
      const pEarned = parseFloat(partRows.reduce((s2, r) => s2 + r.earned, 0).toFixed(3));
      if (p.parts && p.parts.length) {
        return { id: p.id, prompt: p.prompt, figure: p.figure || null, parts: partRows, earned: pEarned, max: 1 };
      }
      return { ...partRows[0], id: p.id, prompt: p.prompt, figure: p.figure || null, max: 1, earned: pEarned };
    });
    return {
      id: "sub_" + Date.now(),
      studentName: loggedInStudent.fullName,
      studentId: loggedInStudent.studentId,
      quizId: homework.id,
      quizTitle: homework.title,
      type: "homework",
      rawScore, nativeTotal: total, score, late,
      timestamp: new Date().toISOString(),
      problems: problemsBreakdown,
      workFiles: workFilesMeta || [],
      integrity: integrity || null,
    };
  };

  // Practice has no submission/proof step; graded homework goes through the work-upload step.
  const finish = () => { if (practice) { setDone(true); return; } setSubmitStep(true); };

  // ── Work-file handling (graded submit step) ───────────────────────────────────
  const addWorkFiles = e => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    // New files invalidate any cached upload/integrity result from a prior attempt.
    setUploadedWork(null); setIntegrityResult(null);
    files.forEach(file => {
      if (!ACCEPTED_WORK_TYPES.includes(file.type)) return;
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = ev => setWorkFiles(w => [...w, { file, name: file.name, mime: file.type, previewUrl: ev.target.result }]);
        reader.readAsDataURL(file);
      } else {
        setWorkFiles(w => [...w, { file, name: file.name, mime: file.type, previewUrl: null }]);
      }
    });
  };
  const removeWorkFile = i => { setWorkFiles(w => w.filter((_, j) => j !== i)); setUploadedWork(null); setIntegrityResult(null); };

  // Upload the work files (once, cached), run the integrity sniff-check (once, cached), then
  // build + persist the submission. On a save failure, retrySave reuses the cached results.
  const submitWork = async () => {
    setSaving(true);
    try {
      let uploaded = uploadedWork;
      if (!uploaded) {
        uploaded = [];
        for (const wf of workFiles) {
          const safeName = (wf.name || "work").replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = classPath(classId, `hwWork/${loggedInStudent.studentId}/${homework.id}/${Date.now()}_${safeName}`);
          const res = await fbUpload(path, wf.file);
          uploaded.push({ storagePath: res.storagePath, downloadUrl: res.downloadUrl, mime: res.mime, size: res.size, name: wf.name });
        }
        setUploadedWork(uploaded);
      }
      let integ = integrityResult;
      if (!integ) {
        const verdict = await checkWorkIntegrity({ problems, answers, files: workFiles.map(w => w.file), courseType });
        integ = { ...verdict, checkedAt: new Date().toISOString(), model: HW_INTEGRITY_MODEL };
        setIntegrityResult(integ);
      }
      // Fetch the correct answers for numeric/text/math items (server-held) to bake into the
      // submission's gradebook key — including items the student never resolved. Best-effort.
      const revealIds = allItems.filter(it => !GRAPHICAL.has(it.answerType)).map(it => it.id);
      const serverAnswers = await revealHomeworkAnswers({ courseType, hwId: homework.id, itemIds: revealIds }).catch(() => ({}));
      await onFinish(buildSubmission(uploaded, integ, serverAnswers));
      clearDraft();
      if (attemptsPath) fbSet(attemptsPath, null).catch(() => {});
      setSaveError(false); setSubmitStep(false); setDone(true);
    } catch {
      setSaveError(true); setSubmitStep(false); setDone(true);
    }
    setSaving(false);
  };

  // Retry from the result screen reruns the whole pipeline (workFiles state is still held;
  // uploads/integrity are reused from cache, so only the failed step is re-attempted).
  const retrySave = async () => {
    setSaveError(false);
    await submitWork();
  };

  // Hint + Show-answer controls shown under a graphical (graph/vector) item — there is no Submit
  // button; pieces grade and lock live as they're placed.
  const graphicalControls = item => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button onClick={() => showGraphicalHint(item)} className="hw-hint-btn" style={{ ...s.btnPri, width: "auto", padding: "7px 16px" }}>💡 Hint</button>
      <button onClick={() => setConfirmReveal(item)} className="hw-reveal-btn" style={{ ...s.btnGhost, width: "auto", padding: "7px 16px", color: muted }}>Show answer</button>
    </div>
  );

  // Quiet echo of what a numeric entry parsed to, shown only once the entry uses an exponent
  // form (an `e`, a caret, a ×, or a unicode superscript). Deliberately not an instruction:
  // every scientific-notation spelling already just works, so this is only the confirmation a
  // student can't get any other way before spending an attempt. A plain "3.7" shows nothing.
  const numericEcho = raw => {
    const t = (raw || "").trim();
    if (!t || !/[eE]\s*[-+]?\d|\^|[⁰¹²³⁴⁵⁶⁷⁸⁹]|[×·⋅]/.test(t)) return null;
    const v = parseNumber(t);
    return (
      <div style={{ color: muted, fontSize: 12.5, fontFamily: "monospace" }}>
        {Number.isFinite(v) ? `= ${toSciString(v, Math.max(sigFigsOf(t), 1))}` : "= ?"}
      </div>
    );
  };

  // ── Render an answer input for an item ────────────────────────────────────────
  // `focusable` (true only for the deepest visible item) wires inputRef so the cursor can be
  // auto-advanced into it. Only numeric/text inputs accept the ref.
  const renderInput = (item, focusable = false) => {
    const st = status[item.id];
    const locked = st === "correct" || st === "revealed";
    const isBusy = busy === item.id;
    if (item.answerType === "math") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MathField value={answers[item.id] || ""} onChange={v => setAns(item.id, v)} onEnter={() => submitItem(item)} disabled={locked || isBusy} />
          {!locked && <button onClick={() => submitItem(item)} disabled={isBusy || !(answers[item.id] || "").trim()} style={{ ...s.btnPri, width: "auto", alignSelf: "flex-start", padding: "8px 20px", opacity: isBusy || !(answers[item.id] || "").trim() ? 0.4 : 1 }}>{isBusy ? "Checking…" : "Submit"}</button>}
        </div>
      );
    }
    if (item.answerType === "graph") {
      const val = answers[item.id] || "";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <GraphField config={item.graph} value={val} onChange={v => onGraphicalChange(item, v)} disabled={locked || isBusy} grade={{ pass: gradePass[item.id] || null }} />
          {!locked && graphicalControls(item)}
        </div>
      );
    }
    if (item.answerType === "vector") {
      const val = answers[item.id] || "";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <VectorField config={item.vector} value={val} onChange={v => onGraphicalChange(item, v)} disabled={locked || isBusy} grade={{ pass: gradePass[item.id] || null }} />
          {!locked && graphicalControls(item)}
        </div>
      );
    }
    if (item.answerType === "fbd") {
      const val = answers[item.id] || "";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FBDField config={item.fbd} value={val} onChange={v => onGraphicalChange(item, v)} disabled={locked || isBusy} grade={{ pass: gradePass[item.id] || null }} />
          {!locked && graphicalControls(item)}
        </div>
      );
    }
    if (item.answerType === "text") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            ref={focusable ? inputRef : undefined}
            value={answers[item.id] || ""}
            onChange={e => setAns(item.id, e.target.value)}
            disabled={locked || isBusy}
            rows={2}
            placeholder="Type your answer…"
            style={{ ...s.input, resize: "none", lineHeight: 1.5 }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitItem(item); } }}
          />
          {!locked && <button onClick={() => submitItem(item)} disabled={isBusy || !(answers[item.id] || "").trim()} style={{ ...s.btnPri, width: "auto", alignSelf: "flex-start", padding: "8px 20px", opacity: isBusy || !(answers[item.id] || "").trim() ? 0.4 : 1 }}>{isBusy ? "Checking…" : "Submit"}</button>}
        </div>
      );
    }
    // numeric
    const raw = answers[item.id] || "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={focusable ? inputRef : undefined}
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={e => setAns(item.id, e.target.value)}
            disabled={locked || isBusy}
            placeholder="Enter a number…"
            style={{ ...s.input, width: 200 }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitItem(item); } }}
          />
          {item.unit && <span style={{ color: muted, fontSize: 14 }}>{item.unit}</span>}
          {!locked && <button onClick={() => submitItem(item)} disabled={isBusy || !raw.trim()} style={{ ...s.btnPri, width: "auto", padding: "8px 20px", opacity: isBusy || !raw.trim() ? 0.4 : 1 }}>{isBusy ? "Checking…" : "Submit"}</button>}
        </div>
        {/* Echo the parsed value whenever the entry uses an exponent form, so a student
            typing "1.25x10^19" can see it was understood before spending an attempt. */}
        {!locked && numericEcho(raw)}
      </div>
    );
  };

  const renderItem = (item, partLabel, rootRef, focusable = false) => {
    const st = status[item.id];
    const used = attempts[item.id] || 0;
    const left = Math.max(0, G.maxAttempts - used);
    const fb = feedback[item.id];
    return (
      <div key={item.id} ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: partLabel ? 12 : 0, borderTop: partLabel ? `1px solid ${border}` : "none", marginTop: partLabel ? 12 : 0 }}>
        {partLabel && <div style={{ color: text, fontWeight: 700, fontSize: 14 }}>Part {partLabel}</div>}
        {item.prompt && <Prompt>{item.prompt}</Prompt>}
        {item.freeHint && <FreeHint>{item.freeHint}</FreeHint>}
        {renderInput(item, focusable)}
        {st !== "correct" && st !== "revealed" && GRAPHICAL.has(item.answerType) && (
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.4 }}>
            Receive <strong style={{ color: text }}>full credit</strong> by completing it yourself, or take a hint for <span style={{ color: FB_COLOR.hint, fontWeight: 700 }}>{Math.round(G.hintCredit * 100)}%</span>, or <span style={{ color: FB_COLOR.wrong, fontWeight: 700 }}>click Show Answer for {G.revealCredit === 0 ? "no credit" : `${Math.round(G.revealCredit * 100)}%`}</span>.
          </div>
        )}
        {st !== "correct" && st !== "revealed" && !GRAPHICAL.has(item.answerType) && (() => {
          const credit = creditForAttempt(used + 1, G);
          const cColor = credit >= 1 ? FB_COLOR.correct : FB_COLOR.hint;
          return (
            <div style={{ color: muted, fontFamily: "monospace", fontSize: 12 }}>
              Attempt {Math.min(used + 1, G.maxAttempts)} of {G.maxAttempts} · correct now earns <span style={{ color: cColor, fontWeight: 700 }}>{Math.round(credit * 100)}%</span>
              {used > 0 ? ` · ${left} attempt${left !== 1 ? "s" : ""} left` : ""}
              {used >= G.hintAfterAttempt ? " · hint shown" : ""}
            </div>
          );
        })()}
        {fb && (
          <div style={{ background: (FB_COLOR[fb.kind] || muted) + "1f", border: `1px solid ${(FB_COLOR[fb.kind] || muted)}55`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text, lineHeight: 1.5 }}>
            {fb.kind === "correct" && <span style={{ color: FB_COLOR.correct, fontWeight: 700 }}>✓ Correct! </span>}
            {fb.text}
          </div>
        )}
        {/* Numeric: always show the correct answer in proper sig figs once resolved
            (whether the student was right or wrong), in case their value differed. */}
        {item.answerType === "numeric" && (st === "correct" || st === "revealed") && revealed[item.id] != null && (
          <div style={{ color: muted, fontSize: 14 }}>
            Correct answer: <strong style={{ color: text }}>{revealed[item.id]}</strong>
          </div>
        )}
        {!["numeric", "graph", "vector", "fbd"].includes(item.answerType) && st === "revealed" && revealed[item.id] != null && (
          <div style={{ color: muted, fontSize: 14 }}>
            Correct answer: {item.answerType === "math" ? <MathText>{`$${revealed[item.id]}$`}</MathText> : <strong style={{ color: text }}>{revealed[item.id]}</strong>}
          </div>
        )}
        {item.answerType === "fbd" && st === "revealed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: muted, fontSize: 13 }}>Correct free-body diagram:</div>
            <FBDField config={item.fbd} value={JSON.stringify(keyToFBDValue(item.fbd))} readOnly />
          </div>
        )}
        {item.answerType === "graph" && st === "revealed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: muted, fontSize: 13 }}>Correct sketch:</div>
            <GraphField config={item.graph} value={JSON.stringify(keyToValue(item.graph))} readOnly />
          </div>
        )}
        {item.answerType === "vector" && st === "revealed" && !item.vector?.buildup && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: muted, fontSize: 13 }}>Correct diagram:</div>
            <VectorField config={item.vector} value={JSON.stringify(keyToVectorValue(item.vector))} readOnly />
          </div>
        )}
        {item.answerType === "vector" && item.vector?.buildup && (st === "correct" || st === "revealed") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: text, fontSize: 15.5, fontWeight: 600 }}>How acceleration rebuilds the velocity:</div>
            <VectorBuildup vector={item.vector} />
          </div>
        )}
        {st && st !== "open" && (
          <div style={{ color: muted, fontSize: 12 }}>Earned {(earned[item.id] || 0).toFixed(2)} / {item.weight.toFixed(2)} pt{item.weight !== 1 ? " (part)" : ""}</div>
        )}
      </div>
    );
  };

  // ── Result screen ─────────────────────────────────────────────────────────────
  if (done) {
    const sub = { rawScore: parseFloat(runningScore.toFixed(2)) };
    return (
      <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: "14px 24px", flexShrink: 0 }}>
          <div style={{ color: text, fontWeight: 700, fontSize: 14 }}>{homework.title}</div>
          <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{whoLabel}</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...s.card, padding: 24, textAlign: "center" }}>
            <div style={{ color: muted, fontSize: 13, marginBottom: 6 }}>{preview ? "Preview complete, nothing saved or graded" : practice ? "Practice complete, not submitted for a grade" : "Homework complete"}</div>
            <div style={{ color: text, fontWeight: 800, fontSize: 34 }}>{sub.rawScore.toFixed(2)} / {total}</div>
            {!practice && late && <div style={{ color: "#f87171", fontSize: 13, marginTop: 6 }}>⚠️ Late: 50% penalty applied to your recorded grade.</div>}
          </div>
          {problems.map((p, i) => {
            const its = itemsOf(p);
            const pe = its.reduce((sum, it) => sum + (earned[it.id] || 0), 0);
            return (
              <div key={p.id} style={{ ...s.card, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: text, fontSize: 14 }}>Problem {i + 1}</span>
                <span style={{ color: muted, fontFamily: "monospace", fontSize: 13 }}>{pe.toFixed(2)} / 1.00</span>
              </div>
            );
          })}
          {!practice && saveError && (
            <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14, margin: 0 }}>⚠️ Your submission couldn't be sent</p>
              <p style={{ color: muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>Don't worry, <strong style={{ color: text }}>your work is saved</strong>. All your answers and progress are stored, so you can tap Retry now, or leave and come back later to finish submitting. If it keeps failing, contact your instructor and show them this screen.</p>
              <button onClick={retrySave} disabled={saving} style={{ ...s.btnPri, background: "#b91c1c", border: "1px solid #f87171" }}>{saving ? "Retrying…" : "Retry saving"}</button>
              <button onClick={async () => { await persistDraft(); onLeave(); }} disabled={saving} style={{ ...s.btnSec, opacity: saving ? 0.4 : 1 }}>Leave, my work is saved</button>
            </div>
          )}
          {(practice || !saveError) && <button onClick={onLeave} style={{ ...s.btnPri }}>{backLabel}</button>}
        </div>
      </div>
    );
  }

  // ── Draft loading screen ──────────────────────────────────────────────────────
  if (draftLoading) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: muted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // ── Resume modal (shown before the runner renders) ────────────────────────────
  if (pendingDraft) {
    const savedAt = pendingDraft.savedAt ? new Date(pendingDraft.savedAt).toLocaleString() : "earlier";
    const completedCount = Object.values(pendingDraft.status || {}).filter(v => v !== "open").length;
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ ...s.card, background: solidBg, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ color: text, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{homework.title}</div>
            <div style={{ color: muted, fontSize: 13 }}>You have unfinished work from {savedAt}.</div>
            {completedCount > 0 && <div style={{ color: muted, fontSize: 13, marginTop: 4 }}>{completedCount} of {allItems.length} item{allItems.length !== 1 ? "s" : ""} completed.</div>}
          </div>
          {/* No "Start fresh" for graded homework: used attempts can't be reset (anti-gaming)
              and resolved items are locked, so a do-over only exists via practice retakes. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => { applyDraft(pendingDraft); setPendingDraft(null); }} style={{ ...s.btnPri }}>Resume where I left off</button>
          </div>
          <button onClick={onLeave} style={{ ...s.btnGhost, fontSize: 13, padding: "6px 0" }}>← Back to course</button>
        </div>
      </div>
    );
  }

  // ── Submit step: upload your written work ─────────────────────────────────────
  if (submitStep) {
    return (
      <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
        <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <button onClick={() => { if (!saving) setSubmitStep(false); }} disabled={saving} style={{ ...s.btnGhost, padding: "6px 12px", width: "auto", opacity: saving ? 0.4 : 1 }}>← Back</button>
          <div style={{ width: 1, height: 20, background: border }} />
          <div>
            <div style={{ color: text, fontWeight: 700, fontSize: 14 }}>{homework.title}</div>
            <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>Submit your written work</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...s.card, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: text, fontWeight: 700, fontSize: 16 }}>Upload your handwritten work</div>
            <div style={{ color: muted, fontSize: 14, lineHeight: 1.6 }}>
              Upload photos or a PDF of your handwritten work for these problems, your proof that you solved them yourself.
            </div>

            <label style={{ ...s.btnSec, width: "auto", alignSelf: "flex-start", padding: "8px 18px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.4 : 1 }}>
              + Add photos / PDF
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple disabled={saving} onChange={addWorkFiles} style={{ display: "none" }} />
            </label>

            {workFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {workFiles.map((wf, i) => (
                  <div key={i} style={{ position: "relative", width: 110 }}>
                    {wf.previewUrl
                      ? <img src={wf.previewUrl} alt={wf.name} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: `1px solid ${border}` }} />
                      : <div style={{ width: 110, height: 110, borderRadius: 8, border: `1px solid ${border}`, background: solidBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: muted, fontSize: 12 }}><span style={{ fontSize: 28 }}>📄</span>PDF</div>}
                    {!saving && (
                      <button onClick={() => removeWorkFile(i)} title="Remove" style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#b91c1c", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    )}
                    <div style={{ color: muted, fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wf.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={submitWork}
            disabled={saving || workFiles.length === 0}
            title={workFiles.length === 0 ? "Attach at least one file" : ""}
            style={{ ...s.btnPri, opacity: saving || workFiles.length === 0 ? 0.4 : 1 }}
          >
            {saving ? "Submitting & checking your work…" : "Submit homework"}
          </button>
          {workFiles.length === 0 && <div style={{ color: muted, fontSize: 12, textAlign: "center" }}>Attach at least one photo or PDF of your work to submit.</div>}
        </div>
      </div>
    );
  }

  // ── Acknowledgment gate (non-practice) ────────────────────────────────────────
  // Must confirm understanding of the written-work upload requirement before the problem
  // flow unlocks. `acked` is session-only (never persisted), and this check sits after the
  // resume-modal/submit-step returns, so it re-appears every time a student begins OR returns
  // to resume. Once acknowledged, the runner looks exactly as before (notice lives in the
  // collapsible grading card).
  if (!practice && !acked) {
    const resuming = Object.keys(status).length > 0 || Object.keys(attempts).length > 0;
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ ...s.card, background: solidBg, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: text, fontWeight: 700, fontSize: 18 }}>{homework.title}</div>
          <div style={{ borderLeft: `3px solid ${teal}`, background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", borderRadius: 8, padding: "14px 16px", color: text, fontSize: 14, lineHeight: 1.6 }}>
            <strong>Keep your written work.</strong> To finish and submit this assignment you'll upload photos or a PDF of your handwritten work for these problems, your proof that you solved them yourself. Hold onto your scratch paper as you work through the problems.
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", color: text, fontSize: 14, lineHeight: 1.5 }}>
            <input type="checkbox" checked={ackChecked} onChange={e => setAckChecked(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, cursor: "pointer", flexShrink: 0 }} />
            <span>I understand that I'll need to upload photos or a PDF of my handwritten work before I can submit.</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => setAcked(true)} disabled={!ackChecked} style={{ ...s.btnPri, opacity: ackChecked ? 1 : 0.4, cursor: ackChecked ? "pointer" : "default" }}>{resuming ? "Continue homework" : "Begin homework"}</button>
            <button onClick={onLeave} style={{ ...s.btnGhost, fontSize: 13, padding: "6px 0" }}>← Back to course</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active runner ─────────────────────────────────────────────────────────────
  const problem = problems[idx];
  const items = itemsOf(problem);
  const partLabels = problem.parts && problem.parts.length ? "abcdefgh".split("") : null;
  // Intercept Next/Finish when the current problem has a graph/vector answer that's been started
  // but isn't fully resolved (some pieces not yet locked green) — so a student doesn't wander off
  // from a half-finished diagram thinking it counts.
  const hasUnfinishedDrawing = items.some(it => {
    if (!GRAPHICAL.has(it.answerType)) return false;
    const st = status[it.id];
    if (st === "correct" || st === "revealed") return false;
    const v = answers[it.id] || "";
    return graphicalHasInput(it, v);
  });
  const guardedNav = go => { if (hasUnfinishedDrawing) setNavWarn({ go }); else go(); };
  // Outline needs a transparent base so the keyframe's outline-color can animate in.
  const glowStyle = glow ? { animation: "hwGlowBurst 5s ease-in-out infinite", outline: "2px solid transparent", outlineOffset: 2 } : {};

  const handleLeaveConfirm = async () => {
    // Save progress before leaving. The answers guard ensures even a typed-but-not-yet-submitted
    // answer is persisted, so the "your progress will be saved" promise always holds.
    if (draftPath && (Object.keys(status).length > 0 || Object.keys(attempts).length > 0 || Object.keys(answers).length > 0)) {
      await persistDraft();
    }
    onLeave();
  };

  return (
    // Fixed viewport height (not just s.page's minHeight) so the footer nav stays pinned and
    // the body scrolls internally — otherwise added feedback pushes the Prev/Next buttons
    // below the fold. 100dvh keeps the footer clear of mobile browser chrome.
    <div style={{ ...s.page, height: "100dvh", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {showLeave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>{preview ? "Leave preview?" : "Leave homework?"}</h3>
            <p style={{ ...s.muted, marginBottom: 20 }}>{preview ? "This is an instructor preview. Nothing is graded or saved, and you can open it again anytime." : practice ? "This is a practice session. Nothing is graded, and you can start it again anytime. Your practice progress won't be saved." : "Your progress will be saved, so you can resume later."}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLeave(false)} style={{ ...s.btnSec, flex: 1 }}>Keep going</button>
              <button onClick={handleLeaveConfirm} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {navWarn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>This diagram isn't finished</h3>
            <p style={{ ...s.muted, marginBottom: 20, lineHeight: 1.5 }}>Some pieces on this problem aren't <strong style={{ color: "#4ade80" }}>green</strong> yet. A piece only earns credit once it locks in green (or use <strong style={{ color: text }}>Show answer</strong>). If you move on now, the unfinished pieces won't count.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setNavWarn(null)} style={{ ...s.btnPri, flex: 1 }}>Keep working</button>
              <button onClick={() => { const g = navWarn.go; setNavWarn(null); g(); }} style={{ ...s.btnSec, flex: 1 }}>Leave it unfinished</button>
            </div>
          </div>
        </div>
      )}

      {confirmReveal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Show the answer?</h3>
            <p style={{ ...s.muted, marginBottom: 20, lineHeight: 1.5 }}>This will reveal the correct {confirmReveal.answerType === "graph" ? "sketch" : "diagram"} and mark this part at <strong style={{ color: "#f87171" }}>{G.revealCredit === 0 ? "no credit" : `${Math.round(G.revealCredit * 100)}%`}</strong>. You won't be able to earn full credit on it.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmReveal(null)} style={{ ...s.btnPri, flex: 1 }}>Keep trying</button>
              <button onClick={() => revealGraphical(confirmReveal)} style={{ ...s.btnSec, flex: 1 }}>Show answer</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setShowLeave(true)} style={{ ...s.btnGhost, padding: "6px 12px", width: "auto" }}>← Back</button>
          <div style={{ width: 1, height: 20, background: border }} />
          <div>
            <div style={{ color: text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              {homework.title}{practice && <span style={s.badge(teal)}>{preview ? "Preview" : "Practice"}</span>}
            </div>
            <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{whoLabel}{!practice && late ? " · ⚠️ past due (50% penalty)" : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", color: muted, fontSize: 16, lineHeight: 1 }}
            >{lightMode ? "☀" : "☽"}</button>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <div style={{ ...s.muted, fontFamily: "monospace" }}>Problem {idx + 1}/{total}</div>
            <div style={{ color: teal, fontFamily: "monospace", fontSize: 12 }}>Score: {runningScore.toFixed(2)} / {total}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Grading-policy explainer — transparent, upfront, collapsible */}
        <div style={{ ...s.card, padding: "12px 16px" }}>
          <button
            onClick={() => setShowGrading(v => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", color: text, fontWeight: 700, fontSize: 14, padding: 0 }}
          >
            <span>ⓘ How this homework is graded</span>
            <span style={{ color: muted, fontSize: 12 }}>{showGrading ? "▲ Hide" : "▼ Show"}</span>
          </button>
          {showGrading && (() => {
            const pct = x => `${Math.round(x * 100)}%`;
            const C = ({ color, children }) => <strong style={{ color }}>{children}</strong>;
            return (
              <>
                <div style={{ margin: "8px 0 6px", color: muted, fontSize: 13 }}>Each part of a problem is graded separately on this schedule:</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: muted, fontSize: 13, lineHeight: 1.7 }}>
                  <li>Attempts <C color={FB_COLOR.correct}>1–{G.freeAttempts}</C>: <C color={FB_COLOR.correct}>full credit</C> if correct.</li>
                  {G.maxAttempts > G.freeAttempts && (
                    <li>A hint appears after attempt {G.hintAfterAttempt}. A correct answer on attempts <C color={FB_COLOR.hint}>{G.freeAttempts + 1}–{G.maxAttempts}</C> earns <C color={FB_COLOR.hint}>{pct(G.hintCredit)}</C>.</li>
                  )}
                  <li>After <C color={FB_COLOR.wrong}>{G.maxAttempts}</C> incorrect attempts the answer is shown and that part earns <C color={FB_COLOR.wrong}>{pct(G.revealCredit)}</C>.</li>
                  <li>Numeric answers count as correct within <C color={FB_COLOR.revealed}>±{+(G.numericTolerance * 100).toFixed(2)}%</C> of the exact value.</li>
                  {allItems.some(it => GRAPHICAL.has(it.answerType)) && (
                    <li><C color={text}>Sketch / diagram parts</C> are different: each piece <C color={FB_COLOR.correct}>locks in green</C> the moment it's in the right place: <C color={FB_COLOR.correct}>full credit</C> when you complete it yourself, <C color={FB_COLOR.hint}>{pct(G.hintCredit)}</C> if you take a hint, or <C color={FB_COLOR.wrong}>{G.revealCredit === 0 ? "no credit" : pct(G.revealCredit)}</C> with “Show answer”.</li>
                  )}
                </ul>
                {!practice && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}`, color: muted, fontSize: 13, lineHeight: 1.6 }}>
                    <strong style={{ color: text }}>Before you submit</strong>, you'll upload a photo or PDF of your handwritten work for these problems, your proof that you solved them yourself.
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div style={{ ...s.card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {problem.figure && (
            // `figureWidth` (CSS px) scales a figure whose natural pixel size reads too
            // large on the page — e.g. a 2x screenshot from the textbook. Without it the
            // image renders at natural size, capped only by the 960px column.
            <img
              src={problem.figure}
              alt="Problem figure"
              style={{
                width: problem.figureWidth || "auto",
                maxWidth: "100%",
                height: "auto",
                borderRadius: 10,
                border: `1px solid ${border}`,
                alignSelf: "center",
              }}
            />
          )}
          {/* For multipart, render the shared prompt above the parts */}
          {problem.parts && problem.parts.length > 0 && problem.prompt && (
            <Prompt>{problem.prompt}</Prompt>
          )}
          {/* A multipart problem's free hint belongs to the whole problem, so it sits under the
              shared stem. (A single-part problem carries its hint on the item instead, since the
              statement itself is rendered inside renderItem.) */}
          {problem.parts && problem.parts.length > 0 && problem.freeHint && (
            <FreeHint>{problem.freeHint}</FreeHint>
          )}
          {(() => {
            // Sequential reveal: a part appears only once every earlier part is resolved
            // (correct or revealed). The first unresolved part is the deepest one shown —
            // no "Next" click needed; later parts surface on this same page as each resolves.
            const firstOpen = items.findIndex(it => status[it.id] !== "correct" && status[it.id] !== "revealed");
            const lastVisible = !partLabels ? items.length - 1 : (firstOpen === -1 ? items.length - 1 : firstOpen);
            return items.map((it, i) => {
              if (partLabels && i > lastVisible) return null;
              // Tag the deepest visible part so a freshly revealed one can be scrolled into view
              // and auto-focused.
              const isDeepest = i === lastVisible;
              return renderItem(it, partLabels ? `${i + 1} of ${items.length}` : null, isDeepest ? revealRef : null, isDeepest);
            });
          })()}
        </div>
      </div>

      {/* Footer nav */}
      <div style={{ background: card, borderTop: `1px solid ${border}`, padding: 16, flexShrink: 0 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={{ ...s.btnSec, width: "auto", padding: "8px 16px", opacity: idx === 0 ? 0.4 : 1 }}>← Previous</button>
          {idx < total - 1
            ? <button onClick={() => guardedNav(() => setIdx(i => Math.min(total - 1, i + 1)))} className="hw-advance-btn" style={{ ...s.btnSec, width: "auto", padding: "8px 16px", ...glowStyle }}>Next →</button>
            : <button onClick={() => guardedNav(finish)} disabled={!allResolved || saving} title={allResolved ? "" : "Resolve every problem first"} className="hw-advance-btn" style={{ ...s.btnPri, width: "auto", padding: "8px 20px", opacity: !allResolved || saving ? 0.4 : 1, ...glowStyle }}>{saving ? "Submitting…" : practice ? "Finish" : "Finish & Submit"}</button>}
        </div>
      </div>
    </div>
  );
}
