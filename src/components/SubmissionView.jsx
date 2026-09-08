import { useState } from "react";
import { useTheme } from "../theme.js";
import { keyToValue, keyToVectorValue, keyToFBDValue, resolveScore, onTimeCreditIds, partIsOnTime } from "../homework.js";
import { dueToDate } from "../utils.js";
import { ChatMessages } from "./ChatMessages.jsx";
import { MathText } from "./MathText.jsx";
import { GraphField } from "./GraphField.jsx";
import { VectorField } from "./VectorField.jsx";
import { FBDField } from "./FBDField.jsx";

// One gradable item (a whole problem or a part) in a homework submission breakdown.
// When `onEditChange` is provided the earned value becomes an editable number input
// (instructor-only); otherwise it renders as a read-only badge.
function HomeworkItemRow({ row, label, editEarned, onEditChange, displayEarned, onTime = null, resolvedAt = null }) {
  const { s, muted, border, text } = useTheme();
  const correct = row.status === "correct";
  const color = correct ? "#4ade80" : row.status === "revealed" ? "#60a5fa" : "#f87171";
  const parsedEdit = editEarned !== undefined ? parseFloat(editEarned) : NaN;
  const isOverridden = !isNaN(parsedEdit) && Math.abs(parsedEdit - (row.earned ?? 0)) > 0.0001;
  // What the row is worth as displayed, so an instructor editing a late part watches the
  // half-credit figure move with the number they are typing.
  const shownEarned = editEarned !== undefined
    ? (isNaN(parsedEdit) ? (row.earned ?? 0) : Math.max(0, Math.min(row.max ?? 1, parsedEdit)))
    : (displayEarned ?? row.earned ?? 0);
  const isGraph = row.answerType === "graph";
  const isVector = row.answerType === "vector";
  const isFBD = row.answerType === "fbd";
  const isPlot = isGraph || isVector || isFBD;
  return (
    <div style={{ paddingTop: label ? 10 : 0, borderTop: label ? `1px solid ${border}` : "none", marginTop: label ? 10 : 0 }}>
      {label && <div style={{ color: text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Part ({label})</div>}
      {row.prompt && <div style={{ color: text, fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}><MathText>{row.prompt}</MathText></div>}
      {isGraph && row.graph && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 8 }}>
          <div style={{ maxWidth: 360 }}>
            <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Student's sketch</div>
            <GraphField config={row.graph} value={row.studentAnswer} readOnly />
          </div>
          {!correct && (
            <div style={{ maxWidth: 360 }}>
              <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Expected</div>
              <GraphField config={row.graph} value={JSON.stringify(keyToValue(row.graph))} readOnly />
            </div>
          )}
        </div>
      )}
      {isVector && row.vector && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 8 }}>
          <div style={{ maxWidth: 360 }}>
            <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Student's diagram</div>
            <VectorField config={row.vector} value={row.studentAnswer} readOnly />
          </div>
          {!correct && (
            <div style={{ maxWidth: 360 }}>
              <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Expected</div>
              <VectorField config={row.vector} value={JSON.stringify(keyToVectorValue(row.vector))} readOnly />
            </div>
          )}
        </div>
      )}
      {isFBD && row.fbd && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 8 }}>
          <div style={{ maxWidth: 460 }}>
            <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Student's free-body diagram</div>
            <FBDField config={row.fbd} value={row.studentAnswer} readOnly />
          </div>
          {!correct && (
            <div style={{ maxWidth: 460 }}>
              <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Expected</div>
              <FBDField config={row.fbd} value={JSON.stringify(keyToFBDValue(row.fbd))} readOnly />
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: muted, alignItems: "center" }}>
        {!isPlot && <span>Answer: {row.answerType === "math" ? <MathText>{`$${row.studentAnswer}$`}</MathText> : <strong style={{ color: text }}>{row.studentAnswer || "-"}</strong>}</span>}
        <span style={{ color }}>{correct ? "Correct" : row.status === "revealed" ? "Answer revealed" : "Open"}</span>
        <span>{row.attempts} attempt{row.attempts !== 1 ? "s" : ""}</span>
        {onEditChange ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              value={editEarned !== undefined ? editEarned : String(row.earned ?? 0)}
              onChange={e => onEditChange(e.target.value)}
              min={0}
              max={row.max ?? 1}
              step={0.01}
              style={{ width: 58, background: "transparent", border: `1px solid ${isOverridden ? "#60a5fa" : border}`, borderRadius: 4, color: isOverridden ? "#60a5fa" : text, fontSize: 13, fontFamily: "monospace", textAlign: "center", padding: "2px 4px" }}
            />
            <span style={{ color: muted, fontSize: 11 }}>/ {(row.max ?? 1).toFixed(2)} pt</span>
          </div>
        ) : (
          <span style={{ ...s.badge(color), fontSize: 11 }}>{(displayEarned ?? row.earned ?? 0).toFixed(2)} / {(row.max ?? 1).toFixed(2)} pt</span>
        )}
        {/* Which side of the deadline THIS part fell on. The score badge beside it is the RAW
            earned value: `scoreFromPartOverrides` buckets the parts and halves the late bucket at
            the total, so a late part showing "1.00 / 1.00" contributes 0.50 and nothing on the row
            said so. Only rendered for a late submission, where the distinction exists. */}
        {onTime != null && (
          <span
            title={resolvedAt ? `Answered ${new Date(resolvedAt).toLocaleString()}` : undefined}
            style={{ ...s.badge(onTime ? "#60a5fa" : "#fbbf24"), fontSize: 11 }}>
            {onTime ? "On time, full credit" : `Late, counts ${(shownEarned * 0.5).toFixed(2)} pt`}
          </span>
        )}
        {!correct && !isPlot && row.correctAnswer != null && <span>Key: {row.answerType === "math" ? <MathText>{`$${row.correctAnswer}$`}</MathText> : <strong style={{ color: text }}>{row.correctAnswer}</strong>}</span>}
      </div>
    </div>
  );
}

// Full-screen read/edit view of a single submission. Shared by the instructor Gradebook
// (with part-score editing + integrity Clear/Uphold actions) and the student Grades page
// (read-only — no edit/review callbacks, and `showIntegrity={false}` hides the AI verdict).
// Renders the per-problem/per-part breakdown for homework (`submission.type === "homework"`)
// or the graded chat dialogue for quizzes.
// `due` is the deadline as it applies to THIS student (effectiveDue of the assignment date and
// any extension). It is what tells a late homework which of its parts were finished on time, so
// the header score here matches the gradebook cell and the student's grades row.
export function SubViewModal({ submission, studentName, assignmentTitle, onClose, override = {}, onSavePartScores, onSetIntegrityReview, showIntegrity = true, audience = "instructor", due = null }) {
  const { s, muted, border, text, card, bg, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  const isHomework = submission.type === "homework";
  // No breakdown means nothing to score part by part, so the editing controls would be a
  // button that saves an empty map. A reconstructed record is the case that has none.
  const canEdit = isHomework && !!onSavePartScores && (submission.problems || []).length > 0;
  // Derived from the instructor's override so the score the student sees here matches
  // their grades list exactly (whole-assignment score > per-part scores > submission).
  const partOverrides = override.partScores || {};
  const integrityReview = override.integrityReview || null;
  const resolved = resolveScore(submission, override, null, due);
  // The same derivation the score went through, so the banner below is right for a record whose
  // parts carry no stamps (anything submitted before on-time credit existed) as well as one
  // whose do. Counted over the rows actually in this breakdown.
  const onTimeIds = onTimeCreditIds(submission, due);
  const onTimeParts = onTimeIds
    ? (submission.problems || []).reduce((n, p) => n + (p.parts || [p]).filter(r => r?.id && onTimeIds.has(r.id)).length, 0)
    : 0;
  // Per-part deadline labelling. Only meaningful on a LATE submission: on an on-time one every
  // part is on time and a badge on every row would say nothing. `partIsOnTime` is the SAME
  // predicate `scoreFromPartOverrides` buckets with, so a row's badge and the credit it
  // contributes cannot drift apart. `resolvedAt` comes from the telemetry carried on the record,
  // which is what dates a part in the first place; a record without it still labels correctly
  // from the `onTime` stamps, just with no time to show.
  const showPartDeadline = isHomework && !!submission.late;
  const resolvedAtOf = id => (id ? submission.telemetry?.items?.[id]?.resolvedAt || null : null);
  const dueAt = due ? dueToDate(due) : null;
  const hasOverrides = Object.keys(partOverrides).length > 0;
  // Per-item earned to display read-only (instructor edit mode uses the draft inputs instead).
  const earnedFor = row => (partOverrides[row.id] != null ? Number(partOverrides[row.id]) : (row.earned ?? 0));
  const integrity = submission.integrity || null;
  const workFiles = submission.workFiles || [];
  // A record the deadline sweep wrote (auto-submit.js). It has no work files and no integrity
  // verdict by construction, so without the banner below the empty written-work section reads as
  // a student who skipped the step rather than one who was never asked for it.
  const auto = submission.autoSubmitted || null;
  const toStudent = audience === "student";
  const [reviewSaving, setReviewSaving] = useState(false);
  const setReview = async decision => {
    if (!onSetIntegrityReview) return;
    setReviewSaving(true);
    try { await onSetIntegrityReview(decision); } finally { setReviewSaving(false); }
  };

  // Flat list of all gradable items (parts or whole problems)
  const allItems = isHomework ? (submission.problems || []).flatMap(p => p.parts || [p]) : [];

  // draftParts: { [itemId]: string } — initialized from existing overrides; undefined means untouched
  const [draftParts, setDraftParts] = useState(() => {
    const init = {};
    for (const [id, val] of Object.entries(partOverrides)) init[id] = String(val);
    return init;
  });
  const [saving, setSaving] = useState(false);

  const setItemDraft = (itemId, val) => setDraftParts(d => ({ ...d, [itemId]: val }));

  // Build partScores from draft: only include items where value differs from submission's earned
  const buildPartScores = () => {
    const result = {};
    for (const item of allItems) {
      const raw = draftParts[item.id];
      if (raw === undefined) continue;
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      const clamped = parseFloat(Math.max(0, Math.min(item.max ?? 1, val)).toFixed(4));
      if (Math.abs(clamped - (item.earned ?? 0)) > 0.0001) result[item.id] = clamped;
    }
    return result;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSavePartScores(buildPartScores()); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await onSavePartScores({});
      setDraftParts({});
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: bg, display: "flex", flexDirection: "column", zIndex: 60 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: card, borderBottom: cellBorder, padding: "14px 20px", flexShrink: 0 }}>
        <div>
          <div style={{ color: text, fontWeight: 700, fontSize: 15 }}>{studentName} · {assignmentTitle}</div>
          <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>
            Score: {resolved.excused ? "Excused" : `${resolved.effective != null ? resolved.effective : submission.score}/10`}
            {!resolved.excused && resolved.effective != null && Math.abs(resolved.effective - submission.score) > 0.0001 ? " · adjusted by instructor" : ""}
            {isHomework && submission.rawScore != null ? ` (${submission.rawScore}/${submission.nativeTotal} pts)` : ""}{submission.late ? (isHomework ? " (late)" : " (late, 50% penalty)") : ""} · Handed in {new Date(submission.timestamp).toLocaleString()}{submission.late && dueAt && !isNaN(dueAt.getTime()) ? ` · Due ${dueAt.toLocaleString()}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canEdit && hasOverrides && (
            <button onClick={handleReset} disabled={saving}
              style={{ ...s.btnGhost, width: "auto", padding: "6px 14px", fontSize: 12, color: "#f87171", borderColor: "#f8717155" }}>
              Reset scores
            </button>
          )}
          {canEdit && (
            <button onClick={handleSave} disabled={saving}
              style={{ ...s.btnPri, width: "auto", padding: "6px 16px", fontSize: 12 }}>
              {saving ? "Saving…" : "Save part scores"}
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: muted, fontSize: 28, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* A record rebuilt by hand after the original was lost. Says so plainly, and says
            which parts are real: without this the missing per-problem breakdown below reads
            as a bug, and the fields that ARE genuine look no different from invented ones. */}
        {submission.reconstructed && (
          <div style={{ ...s.card, padding: "12px 16px", border: "1px solid rgba(96,165,250,0.4)", background: isLight ? "rgba(96,165,250,0.07)" : "rgba(96,165,250,0.09)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13 }}>Reconstructed record</span>
            <span style={{ color: text, fontSize: 13, lineHeight: 1.5 }}>{submission.reconstructed.note}</span>
            {submission.reconstructed.at && (
              <span style={{ color: muted, fontSize: 11 }}>Rebuilt {new Date(submission.reconstructed.at).toLocaleString()}</span>
            )}
          </div>
        )}
        {/* Written by the deadline sweep because the student never pressed Finish & Submit. The
            banner has to carry three facts that nothing else on this screen can: why a record
            exists that the student did not make, that it is worth nothing until the written work
            is handed in, and that handing it in keeps full credit on the parts already finished
            (which is the whole reason the record was written down rather than the work being
            lost at midnight). */}
        {auto && (
          <div style={{ ...s.card, padding: "12px 16px", border: "1px solid rgba(251,191,36,0.4)", background: isLight ? "rgba(251,191,36,0.07)" : "rgba(251,191,36,0.09)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>
              {toStudent ? "Saved at the deadline: your written work is still needed" : "Auto-submitted at the deadline: no written work"}
            </span>
            <span style={{ color: text, fontSize: 13, lineHeight: 1.5 }}>
              {auto.resolved != null && auto.totalItems != null ? `${auto.resolved} of ${auto.totalItems} parts were finished when the deadline passed, and ` : ""}
              {toStudent
                ? "this record was saved so that work would not be lost. It does not count towards your grade yet: homework counts once you upload your handwritten work. Open the assignment again, finish anything you still want to answer, and upload your written work. The parts you finished before the deadline keep full credit."
                : "this record was saved so the work would not be lost. Nothing was uploaded and the integrity check never ran, so it scores 0 until the written work is handed in. The assignment is still open, and the parts finished before the deadline keep full credit when it is."}
            </span>
            <span style={{ color: muted, fontSize: 11 }}>Recorded {new Date(auto.at || submission.timestamp).toLocaleString()}</span>
          </div>
        )}
        {/* A late submission carrying on-time parts. The banner exists because the score is not
            simply "half of what you earned" any more, and an unexplained number invites email. */}
        {onTimeParts > 0 && (
          <div style={{ ...s.card, padding: "12px 16px", border: "1px solid rgba(96,165,250,0.4)", background: isLight ? "rgba(96,165,250,0.07)" : "rgba(96,165,250,0.09)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13 }}>
              {onTimeParts} part{onTimeParts === 1 ? "" : "s"} kept full credit
            </span>
            <span style={{ color: text, fontSize: 13, lineHeight: 1.5 }}>
              {onTimeParts === 1 ? "This part was" : "These parts were"} already finished when the deadline passed, so the late penalty does not apply to {onTimeParts === 1 ? "it" : "them"}. Everything answered afterwards is at half credit.
            </span>
          </div>
        )}
        {/* Submitted written work + (instructor-only) integrity review (homework only) */}
        {isHomework && (
          <div style={{ ...s.card, padding: 16, display: "flex", flexDirection: "column", gap: 12, border: showIntegrity && integrity?.flagged ? "1px solid rgba(251,191,36,0.45)" : cellBorder }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: text, fontWeight: 700, fontSize: 14 }}>Submitted written work</span>
              {showIntegrity && (integrity ? (
                integrity.flagged
                  ? <span style={{ ...s.badge("#fbbf24"), fontSize: 11 }}>Flagged{integrityReview === "cleared" ? " · cleared" : integrityReview === "upheld" ? " · upheld (50%)" : " · full credit"}</span>
                  : integrity.error
                    ? <span style={{ ...s.badge(muted), fontSize: 11 }}>Not checked</span>
                    : <span style={{ ...s.badge("#4ade80"), fontSize: 11 }}>✓ Looks legitimate</span>
              ) : <span style={{ color: muted, fontSize: 12 }}>No integrity check on record</span>)}
            </div>

            {showIntegrity && integrity?.flagged && integrity.reason && (
              <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "8px 12px", color: text, fontSize: 13, lineHeight: 1.5 }}>
                <strong style={{ color: "#fbbf24" }}>Why it was flagged: </strong>{integrity.reason}
              </div>
            )}
            {showIntegrity && integrity?.error && (
              <div style={{ color: muted, fontSize: 12 }}>The automatic check could not run ({integrity.error}). Review the work manually.</div>
            )}

            {workFiles.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {workFiles.map((wf, i) => (
                  <a key={i} href={wf.downloadUrl} target="_blank" rel="noopener noreferrer" title={wf.name} style={{ textDecoration: "none", width: 120 }}>
                    {(wf.mime || "").startsWith("image/")
                      ? <img src={wf.downloadUrl} alt={wf.name} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: cellBorder }} />
                      : <div style={{ width: 120, height: 120, borderRadius: 8, border: cellBorder, background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: muted, fontSize: 12 }}><span style={{ fontSize: 30 }}>📄</span>Open PDF</div>}
                    <div style={{ color: muted, fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wf.name}</div>
                  </a>
                ))}
              </div>
            ) : <div style={{ color: muted, fontSize: 13 }}>{auto ? "Nothing was uploaded: this record was created by the deadline, not by the student." : "No work files were submitted with this homework."}</div>}

            {showIntegrity && integrity?.flagged && onSetIntegrityReview && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: cellBorder, paddingTop: 10 }}>
                <span style={{ color: muted, fontSize: 12, marginRight: 4 }}>After reviewing:</span>
                <button onClick={() => setReview("cleared")} disabled={reviewSaving}
                  style={{ ...s.btnPri, width: "auto", padding: "6px 14px", fontSize: 12, background: integrityReview === "cleared" ? "#15803d" : undefined }}>
                  {integrityReview === "cleared" ? "✓ Cleared (full credit)" : "Clear flag (full credit)"}
                </button>
                <button onClick={() => setReview("upheld")} disabled={reviewSaving}
                  style={{ ...s.btnGhost, width: "auto", padding: "6px 14px", fontSize: 12, color: "#f87171", borderColor: "#f8717155", background: integrityReview === "upheld" ? "rgba(248,113,113,0.15)" : undefined }}>
                  {integrityReview === "upheld" ? "✓ Upheld (50% penalty)" : "Uphold flag (50%)"}
                </button>
              </div>
            )}
          </div>
        )}
        {isHomework ? (
          (submission.problems || []).map((p, i) => {
            const parts = p.parts || [p];
            const labels = p.parts ? "abcdefgh".split("") : [null];
            // Recompute displayed problem earned from drafts
            const problemEarned = canEdit
              ? parts.reduce((sum, row) => {
                  const raw = draftParts[row.id];
                  const val = raw !== undefined ? parseFloat(raw) : NaN;
                  return sum + (!isNaN(val) ? Math.max(0, Math.min(row.max ?? 1, val)) : (row.earned ?? 0));
                }, 0)
              : parts.reduce((sum, row) => sum + earnedFor(row), 0);
            return (
              <div key={p.id || i} style={{ ...s.card, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: text, fontWeight: 700, fontSize: 14 }}>Problem {i + 1}</span>
                  <span style={{ color: muted, fontFamily: "monospace", fontSize: 13 }}>{problemEarned.toFixed(2)} / {(p.max ?? 1).toFixed(2)}</span>
                </div>
                {p.parts && p.prompt && <div style={{ color: text, fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}><MathText>{p.prompt}</MathText></div>}
                {parts.map((row, j) => (
                  <HomeworkItemRow
                    key={row.id || j}
                    row={row}
                    label={labels[j]}
                    editEarned={canEdit ? (draftParts[row.id] !== undefined ? draftParts[row.id] : String(row.earned ?? 0)) : undefined}
                    onEditChange={canEdit ? val => setItemDraft(row.id, val) : undefined}
                    displayEarned={canEdit ? undefined : earnedFor(row)}
                    onTime={showPartDeadline ? partIsOnTime(row, onTimeIds) : null}
                    resolvedAt={showPartDeadline ? resolvedAtOf(row.id) : null}
                  />
                ))}
              </div>
            );
          })
        ) : submission.dialogue?.length > 0
          ? <ChatMessages messages={submission.dialogue} />
          : <div style={{ ...s.card, padding: 32, textAlign: "center", color: muted }}>No dialogue saved for this submission.</div>}
      </div>
    </div>
  );
}
