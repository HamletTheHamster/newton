import { useState } from "react";
import { useTheme } from "../../theme.js";
import { isLate } from "../../utils.js";
import { MathField } from "../../components/MathField.jsx";
import { MathText } from "../../components/MathText.jsx";
import {
  HW_GRADING_DEFAULTS,
  creditForAttempt,
  phaseForAttempt,
  evaluateHomeworkAnswer,
  revealAnswerFor,
} from "../../homework.js";

// Flatten a problem into its gradable items (a single item, or one per multipart part).
// Each item carries a `weight` = its fraction of the problem's 1 point, and `_problemId`.
function itemsOf(p) {
  if (p.parts && p.parts.length) {
    return p.parts.map(pt => ({ ...pt, weight: 1 / p.parts.length, _problemId: p.id }));
  }
  return [{
    id: p.id, prompt: p.prompt, answerType: p.answerType, answer: p.answer,
    unit: p.unit, sigFigs: p.sigFigs, tolerance: p.tolerance, weight: 1, _problemId: p.id,
  }];
}

// MasteringPhysics-style homework runner. Owns all per-item state; on finish, builds a
// submission object and calls onFinish(submission) (which persists it and may throw).
export function HomeworkRunner({ homework, courseType, loggedInStudent, practice = false, onFinish, onLeave }) {
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
  const [revealed, setRevealed] = useState({});    // { itemId: revealed answer string }
  const [history, setHistory] = useState({});      // { itemId: [Claude turns] }
  const [busy, setBusy] = useState(null);          // itemId currently evaluating
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  const late = isLate(homework.dueDate);
  const runningScore = allItems.reduce((sum, it) => sum + (earned[it.id] || 0), 0);
  const allResolved = allItems.every(it => status[it.id] && status[it.id] !== "open");

  const setAns = (id, v) => setAnswers(a => ({ ...a, [id]: v }));

  const submitItem = async item => {
    if (busy) return;
    const ans = (answers[item.id] || "").trim();
    if (!ans) return;
    setBusy(item.id);
    const attemptNum = (attempts[item.id] || 0) + 1;
    const phase = phaseForAttempt(attemptNum, G);
    try {
      const result = await evaluateHomeworkAnswer({
        item, studentAnswer: ans, attemptNum, phase,
        history: history[item.id] || [], courseType,
        grading: G,
      });
      if (result._historyUser) {
        setHistory(h => ({ ...h, [item.id]: [...(h[item.id] || []), { role: "user", content: result._historyUser }, { role: "assistant", content: result._historyAssistant }] }));
      }
      setAttempts(a => ({ ...a, [item.id]: attemptNum }));
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
    } catch (err) {
      // Grader unreachable/errored — surface the reason and DON'T consume an attempt.
      setFeedback(f => ({ ...f, [item.id]: { text: "⚠️ " + (err?.message || "Couldn't reach the grader.") + " Your attempt was not counted — please try again.", kind: "wrong" } }));
    }
    setBusy(null);
  };

  const buildSubmission = () => {
    const rawScore = parseFloat(runningScore.toFixed(2));
    const pct = total > 0 ? rawScore / total : 0;
    const score = parseFloat((pct * 10 * (late ? 0.5 : 1)).toFixed(2));
    const problemsBreakdown = problems.map(p => {
      const its = itemsOf(p);
      const partRows = its.map(it => ({
        id: it.id, prompt: it.prompt, answerType: it.answerType,
        studentAnswer: answers[it.id] || "", attempts: attempts[it.id] || 0,
        status: status[it.id] || "open", earned: parseFloat((earned[it.id] || 0).toFixed(3)),
        max: it.weight, correctAnswer: revealAnswerFor(it),
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
    };
  };

  const finish = async () => {
    if (practice) { setDone(true); return; }
    setSaving(true);
    try {
      await onFinish(buildSubmission());
      setSaveError(false); setDone(true);
    } catch {
      setSaveError(true); setDone(true);
    }
    setSaving(false);
  };

  const retrySave = async () => {
    setSaving(true);
    try { await onFinish(buildSubmission()); setSaveError(false); }
    catch { setSaveError(true); }
    setSaving(false);
  };

  // ── Render an answer input for an item ────────────────────────────────────────
  const renderInput = item => {
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
    if (item.answerType === "text") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
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
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          inputMode="decimal"
          value={answers[item.id] || ""}
          onChange={e => setAns(item.id, e.target.value)}
          disabled={locked || isBusy}
          placeholder="Enter a number…"
          style={{ ...s.input, width: 200 }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitItem(item); } }}
        />
        {item.unit && <span style={{ color: muted, fontSize: 14 }}>{item.unit}</span>}
        {!locked && <button onClick={() => submitItem(item)} disabled={isBusy || !(answers[item.id] || "").trim()} style={{ ...s.btnPri, width: "auto", padding: "8px 20px", opacity: isBusy || !(answers[item.id] || "").trim() ? 0.4 : 1 }}>{isBusy ? "Checking…" : "Submit"}</button>}
      </div>
    );
  };

  const FB_COLOR = { correct: "#4ade80", hint: "#fbbf24", revealed: "#60a5fa", wrong: "#f87171" };

  const renderItem = (item, partLabel) => {
    const st = status[item.id];
    const used = attempts[item.id] || 0;
    const left = Math.max(0, G.maxAttempts - used);
    const fb = feedback[item.id];
    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: partLabel ? 12 : 0, borderTop: partLabel ? `1px solid ${border}` : "none", marginTop: partLabel ? 12 : 0 }}>
        {partLabel && <div style={{ color: text, fontWeight: 700, fontSize: 14 }}>Part ({partLabel})</div>}
        {item.prompt && <div style={{ color: text, fontSize: 15, lineHeight: 1.6 }}><MathText>{item.prompt}</MathText></div>}
        {renderInput(item)}
        {st === "open" && used > 0 && (
          <div style={{ color: muted, fontFamily: "monospace", fontSize: 12 }}>{left} attempt{left !== 1 ? "s" : ""} left{used >= G.hintAfterAttempt ? " · hint shown (max 80%)" : ""}</div>
        )}
        {fb && (
          <div style={{ background: (FB_COLOR[fb.kind] || muted) + "1f", border: `1px solid ${(FB_COLOR[fb.kind] || muted)}55`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text, lineHeight: 1.5 }}>
            {fb.kind === "correct" && <span style={{ color: FB_COLOR.correct, fontWeight: 700 }}>✓ Correct! </span>}
            {fb.text}
          </div>
        )}
        {/* Numeric: always show the correct answer in proper sig figs once resolved
            (whether the student was right or wrong), in case their value differed. */}
        {item.answerType === "numeric" && (st === "correct" || st === "revealed") && (
          <div style={{ color: muted, fontSize: 14 }}>
            Correct answer: <strong style={{ color: text }}>{revealAnswerFor(item)}</strong>
          </div>
        )}
        {item.answerType !== "numeric" && st === "revealed" && revealed[item.id] != null && (
          <div style={{ color: muted, fontSize: 14 }}>
            Correct answer: {item.answerType === "math" ? <MathText>{`$${revealed[item.id]}$`}</MathText> : <strong style={{ color: text }}>{revealed[item.id]}</strong>}
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
          <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{loggedInStudent?.fullName}</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...s.card, padding: 24, textAlign: "center" }}>
            <div style={{ color: muted, fontSize: 13, marginBottom: 6 }}>{practice ? "Practice complete — not submitted for a grade" : "Homework complete"}</div>
            <div style={{ color: text, fontWeight: 800, fontSize: 34 }}>{sub.rawScore.toFixed(2)} / {total}</div>
            {!practice && late && <div style={{ color: "#f87171", fontSize: 13, marginTop: 6 }}>⚠️ Late — 50% penalty applied to your recorded grade.</div>}
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
              <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14, margin: 0 }}>⚠️ Your submission could not be saved</p>
              <p style={{ color: muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>Check your connection and tap Retry. If it keeps failing, contact your instructor and show them this screen.</p>
              <button onClick={retrySave} disabled={saving} style={{ ...s.btnPri, background: "#b91c1c", border: "1px solid #f87171" }}>{saving ? "Retrying…" : "Retry saving"}</button>
            </div>
          )}
          {(practice || !saveError) && <button onClick={onLeave} style={{ ...s.btnPri }}>Back to Course</button>}
        </div>
      </div>
    );
  }

  // ── Active runner ─────────────────────────────────────────────────────────────
  const problem = problems[idx];
  const items = itemsOf(problem);
  const partLabels = problem.parts && problem.parts.length ? "abcdefgh".split("") : null;

  return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
      {showLeave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Leave homework?</h3>
            <p style={{ ...s.muted, marginBottom: 20 }}>{practice ? "Your progress will be lost." : "Your progress will be lost and this attempt will not be saved."}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLeave(false)} style={{ ...s.btnSec, flex: 1 }}>Keep going</button>
              <button onClick={onLeave} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Leave</button>
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
              {homework.title}{practice && <span style={s.badge(teal)}>Practice</span>}
            </div>
            <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{loggedInStudent?.fullName}{!practice && late ? " · ⚠️ past due (50% penalty)" : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <div style={{ ...s.muted, fontFamily: "monospace" }}>Problem {idx + 1}/{total}</div>
          <div style={{ color: teal, fontFamily: "monospace", fontSize: 12 }}>Score: {runningScore.toFixed(2)} / {total}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...s.card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {problem.figure && (
            <img src={problem.figure} alt="Problem figure" style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${border}`, alignSelf: "center" }} />
          )}
          {/* For multipart, render the shared prompt above the parts */}
          {problem.parts && problem.parts.length > 0 && problem.prompt && (
            <div style={{ color: text, fontSize: 15, lineHeight: 1.6 }}><MathText>{problem.prompt}</MathText></div>
          )}
          {items.map((it, i) => renderItem(it, partLabels ? partLabels[i] : null))}
        </div>
      </div>

      {/* Footer nav */}
      <div style={{ background: card, borderTop: `1px solid ${border}`, padding: 16, flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={{ ...s.btnSec, width: "auto", padding: "8px 16px", opacity: idx === 0 ? 0.4 : 1 }}>← Previous</button>
          {idx < total - 1
            ? <button onClick={() => setIdx(i => Math.min(total - 1, i + 1))} style={{ ...s.btnSec, width: "auto", padding: "8px 16px" }}>Next →</button>
            : <button onClick={finish} disabled={!allResolved || saving} title={allResolved ? "" : "Resolve every problem first"} style={{ ...s.btnPri, width: "auto", padding: "8px 20px", opacity: !allResolved || saving ? 0.4 : 1 }}>{saving ? "Submitting…" : practice ? "Finish" : "Finish & Submit"}</button>}
        </div>
      </div>
    </div>
  );
}
