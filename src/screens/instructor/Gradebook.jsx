import { useState, useRef, useEffect } from "react";
import { useTheme, TEAL, MUTED } from "../../theme.js";
import { buildGradebookAssignments, calcGrades } from "../../utils.js";
import { integrityState } from "../../homework.js";
import { SubViewModal } from "../../components/SubmissionView.jsx";
import { newId } from "../../courses/ids.js";
import { categoryColor } from "../../category-colors.js";
import { formatSessionDate } from "../../attendance.js";
import { buildScoreMatrix, countsTowardGrade } from "../../analytics.js";
import { readBlackboardExport, mergeImport, pairColumn, buildBlackboardCsv, isCalculatedColumn, gradebookFilename } from "../../blackboard.js";

// ── Shared helpers ────────────────────────────────────────────────────────────
function catColor(catId) { return categoryColor(catId, TEAL); }

// One place that turns a CSV string into a saved file, shared by both exports. Every filename is
// stamped with the LOCAL date and time (gradebookFilename) so a folder of downloads reads and
// sorts by when it was taken — which matters most for the Blackboard file, where uploading a
// stale one silently rolls grades back.
function download(filename, csv) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function overallColor(pct) {
  if (pct == null) return MUTED;
  if (pct >= 90) return "#4ade80"; if (pct >= 80) return "#a3e635";
  if (pct >= 70) return "#facc15"; if (pct >= 60) return "#fb923c";
  return "#f87171";
}

// Cell coloring is by PERCENTAGE, not raw points: exams are graded out of 100 and labs out
// of 10, so an 85 and an 8.5 have to shade the same green.
function pctOf(score, maxPts) {
  const max = maxPts || 10;
  return max > 0 ? (score / max) * 100 : 0;
}
function cellBg(score, maxPts, isExcused, isMissing) {
  if (isExcused) return "rgba(160,160,160,0.08)";
  if (isMissing) return "rgba(248,113,113,0.07)";
  const pct = pctOf(score, maxPts);
  if (pct >= 80) return "rgba(74,222,128,0.07)";
  if (pct >= 60) return "rgba(250,204,21,0.07)";
  if (pct >= 40) return "rgba(251,146,60,0.08)";
  return "rgba(248,113,113,0.12)";
}
function cellFg(score, maxPts, isExcused, isMissing) {
  if (isExcused) return MUTED;
  if (isMissing) return "#f87171";
  const pct = pctOf(score, maxPts);
  if (pct >= 80) return "#4ade80";
  if (pct >= 60) return "#facc15";
  if (pct >= 40) return "#fb923c";
  return "#f87171";
}

// Recompute a homework submission's /10 score using per-part earned overrides.
// partScores: { [itemId]: earnedValue } — only overridden items need be present.
// cellBorder is computed inside each component from useTheme().border

// ── EditCell ──────────────────────────────────────────────────────────────────
function EditCell({ score, onScoreChange, onCommit, onCancel, panelRef }) {
  const { text } = useTheme();
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  return (
    <div style={{ padding: "2px 4px", minWidth: 60 }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={score}
        onChange={e => onScoreChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={e => {
          if (panelRef?.current?.contains(e.relatedTarget)) return;
          onCommit();
        }}
        data-grade-input="true"
        style={{ width: 44, background: "transparent", border: "none", color: text, fontSize: 13, fontFamily: "monospace", textAlign: "center", outline: "none" }}
      />
    </div>
  );
}

// ── GradeDetailPanel ──────────────────────────────────────────────────────────
function GradeDetailPanel({ panelRef, editingCell, roster, assignments, submissions, gradeOverrides,
    excusedMap, absentMap, onExcuse, onUnexcuse, onViewSub, onSaveDueDate, onClearSubmission,
    onSetAttendanceWaived, setEditingCell }) {
  const { s, muted, border, text, teal, card, bg, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  const { studentId, assignmentId } = editingCell;
  const stu = (roster || []).find(r => r.studentId === studentId);
  const asgn = (assignments || []).find(a => a.id === assignmentId);
  const ov = (gradeOverrides[studentId] || {})[assignmentId] || {};
  const isExcused = !!excusedMap[studentId]?.[assignmentId];
  const absence = absentMap?.[studentId]?.[assignmentId] || null;   // { date, base } when the lecture-absence policy applies
  const sub = (submissions || []).find(s => s.studentId === studentId && s.quizId === assignmentId);
  const ist = integrityState(sub, ov);
  const [showExtendPicker, setShowExtendPicker] = useState(false);
  const [localDate, setLocalDate] = useState("");
  const [localHour, setLocalHour] = useState("");
  const [localMinute, setLocalMinute] = useState("");
  const [localAmPm, setLocalAmPm] = useState("");

  const openPicker = () => {
    setLocalDate(""); setLocalHour(""); setLocalMinute(""); setLocalAmPm("");
    setShowExtendPicker(true);
  };

  const tryAutoSave = (d, h, m, ap) => {
    if (!d || !h || m === "" || !ap) return;
    const h24 = ap === "PM" && h !== "12" ? +h + 12 : ap === "AM" && h === "12" ? 0 : +h;
    onSaveDueDate(studentId, assignmentId, `${d}T${String(h24).padStart(2, "0")}:${m}`);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onBlur={e => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        if (e.relatedTarget?.dataset?.gradeInput) return;
        setEditingCell(null);
      }}
      style={{
        width: 220, flexShrink: 0, background: card, border: cellBorder,
        borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16,
        outline: "none", alignSelf: "flex-start",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>
          {stu?.altName || stu?.fullName || "Student"}
        </div>
        <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{asgn?.title || "Assignment"}</div>
      </div>

      {/* View Submission */}
      {sub && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={onViewSub}
            style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: `1px solid ${border}`, borderRadius: 6,
              color: text, fontSize: 12, cursor: "pointer", padding: "7px 12px", textAlign: "left",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>{sub.type === "homework" ? "View / Edit Submission" : "View Submission"}</span>
            <span style={{ color: muted }}>→</span>
          </button>
          {sub.type === "homework" && ov.partScores && Object.keys(ov.partScores).length > 0 && (
            <div style={{ fontSize: 11, color: "#60a5fa" }}>✎ Part scores overridden</div>
          )}
        </div>
      )}

      {/* Integrity flag status (homework written-work check) */}
      {ist.flagged && (
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
            {ist.review === "upheld" ? "Flag upheld: 50% penalty" : ist.review === "cleared" ? "Flag cleared: full credit" : "Work flagged: full credit (review to uphold)"}
          </div>
          {sub?.integrity?.reason && <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{sub.integrity.reason}</div>}
          <div style={{ fontSize: 10, color: muted }}>Open the submission to review the work and clear or uphold the flag.</div>
        </div>
      )}

      {/* Lecture-absence policy (labs). The zero is derived from the attendance record, never
          stored, so waiving is a flag rather than an edit and un-waiving restores the zero. */}
      {(absence || ov.attendanceWaived) && (
        <div style={{ background: absence ? "rgba(248,113,113,0.1)" : "rgba(96,165,250,0.1)",
          border: `1px solid ${absence ? "rgba(248,113,113,0.35)" : "rgba(96,165,250,0.35)"}`,
          borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: absence ? "#f87171" : "#60a5fa" }}>
            {absence ? `Absent ${formatSessionDate(absence.date)}: lab scored 0` : "Attendance policy waived"}
          </div>
          <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>
            {absence
              ? absence.base != null
                ? `Course policy overrides the entered score of ${absence.base}.`
                : "Course policy: no credit for the lab after an absence from lecture."
              : "This lab is graded normally despite the absence."}
          </div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onSetAttendanceWaived(studentId, assignmentId, !ov.attendanceWaived)}
            style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: `1px solid ${border}`,
              borderRadius: 6, color: text, fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
          >
            {ov.attendanceWaived ? "Reapply attendance policy" : "Waive attendance policy"}
          </button>
        </div>
      )}

      {/* Excuse / Unexcuse */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Excuse Grade</div>
        {isExcused ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: teal }}>Currently excused</div>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => onUnexcuse(studentId, assignmentId)}
              style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 6, color: "#f87171", fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
            >
              Unexcuse
            </button>
          </div>
        ) : (
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onExcuse(studentId, assignmentId)}
            style={{ width: "100%", background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: `1px solid ${border}`,
              borderRadius: 6, color: text, fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
          >
            Excuse Grade
          </button>
        )}
      </div>

      {/* Deadline Extension */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Deadline Extension</div>
        {asgn?.dueDate && (
          <div style={{ fontSize: 11, color: muted }}>Default: {asgn.dueDate}</div>
        )}
        {ov.dueDate && (
          <div style={{ fontSize: 11, color: teal }}>
            Extended: {new Date(ov.dueDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={openPicker}
            style={{ flex: 1, background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: `1px solid ${border}`,
              borderRadius: 6, color: text, fontSize: 12, cursor: "pointer", padding: "7px 8px" }}
          >
            Extend Deadline
          </button>
          {ov.dueDate && (
            <button
              onClick={() => onSaveDueDate(studentId, assignmentId, "")}
              style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: `1px solid ${border}`, borderRadius: 6,
                color: muted, fontSize: 12, cursor: "pointer", padding: "7px 8px" }}
            >
              Clear
            </button>
          )}
        </div>
        {showExtendPicker && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="date"
              value={localDate}
              onChange={e => { setLocalDate(e.target.value); tryAutoSave(e.target.value, localHour, localMinute, localAmPm); }}
              style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 6,
                color: localDate ? text : muted, fontSize: 12, padding: "6px 10px",
                boxSizing: "border-box", colorScheme: isLight ? "light" : "dark" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { val: localHour, set: setLocalHour, opts: ["Hr", ...Array.from({length:12},(_,i)=>String(12-i))], key: "h" },
                { val: localMinute, set: setLocalMinute, opts: ["Min", ...Array.from({length:60},(_,i)=>String(59-i).padStart(2,"0"))], key: "m" },
                { val: localAmPm, set: setLocalAmPm, opts: ["-","PM","AM"], key: "ap" },
              ].map(({ val, set, opts, key }) => (
                <select
                  key={key}
                  value={val}
                  onChange={e => {
                    set(e.target.value);
                    const upd = { h: localHour, m: localMinute, ap: localAmPm, [key]: e.target.value };
                    tryAutoSave(localDate, upd.h, upd.m, upd.ap);
                  }}
                  style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 6,
                    color: val ? text : muted, fontSize: 12, padding: "6px 4px",
                    colorScheme: isLight ? "light" : "dark", cursor: "pointer" }}
                >
                  {opts.map(o => <option key={o} value={o === opts[0] ? "" : o} style={{ background: bg }}>{o}</option>)}
                </select>
              ))}
            </div>
            <button
              onClick={() => setShowExtendPicker(false)}
              style={{ background: "none", border: "none", color: muted, fontSize: 11,
                cursor: "pointer", padding: "2px 0", textAlign: "left" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Clear Submission — destructive, password-gated via confirmDanger in App.jsx */}
      {sub && onClearSubmission && (
        <div style={{ borderTop: cellBorder, paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Clear Submission</div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onClearSubmission(studentId, assignmentId)}
            style={{ width: "100%", background: "rgba(185,28,28,0.12)", border: "1px solid rgba(185,28,28,0.4)",
              borderRadius: 6, color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "7px 12px" }}
          >
            Clear Submission
          </button>
          <div style={{ fontSize: 10, color: muted, marginTop: 6, lineHeight: 1.4 }}>
            Permanently deletes this submission (lets the student retake). Requires your password.
          </div>
        </div>
      )}
    </div>
  );
}

// ── GradeSettingsModal ────────────────────────────────────────────────────────
function GradeSettingsModal({ gradeCategories, onSave, onClose }) {
  const { s, muted, border, text, teal, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  const solidBg = isLight ? "#fff" : "#252627";
  const [drafts, setDrafts] = useState(() => ({ ...gradeCategories }));
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState(0);
  const [saveError, setSaveError] = useState("");

  const sorted = Object.values(drafts).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const weightSum = sorted.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const updateCat = (id, field, value) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const deleteCat = id =>
    setDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });

  const addCat = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = newId("cat");
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map(c => c.order ?? 0)) : -1;
    setDrafts(prev => ({ ...prev, [id]: { id, name: trimmed, weight: Number(newWeight) || 0, dropLowest: 0, order: maxOrder + 1 } }));
    setNewName(""); setNewWeight(0);
  };

  const handleSave = async () => {
    setSaveError("");
    if (Math.round(weightSum) !== 100) {
      setSaveError(`Weights must sum to 100% (currently ${weightSum.toFixed(1)}%).`);
      return;
    }
    await onSave(drafts);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, width: "100%", maxWidth: 580, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: cellBorder, flexShrink: 0 }}>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: 0 }}>Grade Categories</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: muted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 22px", flex: 1 }}>
          {/* Column labels */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 4px", marginBottom: 2 }}>
            <div style={{ width: 10, flexShrink: 0 }} />
            <span style={{ flex: 1, color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Name</span>
            <span style={{ width: 52, textAlign: "center", color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Weight</span>
            <span style={{ width: 8 }} />
            <span style={{ width: 100, textAlign: "center", color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Drop lowest</span>
            <span style={{ width: 34 }} />
          </div>
          {sorted.map(cat => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: cellBorder }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: catColor(cat.id), flexShrink: 0 }} />
              <input
                value={cat.name}
                onChange={e => updateCat(cat.id, "name", e.target.value)}
                style={{ ...s.input, flex: 1, padding: "6px 10px", fontSize: 13, height: "auto" }}
                placeholder="Category name"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <input
                  type="text" inputMode="numeric"
                  value={cat.weight}
                  onChange={e => updateCat(cat.id, "weight", Number(e.target.value) || 0)}
                  style={{ ...s.input, width: 52, padding: "6px 6px", fontSize: 13, textAlign: "center", height: "auto" }}
                />
                <span style={{ color: muted, fontSize: 12 }}>%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <input
                  type="text" inputMode="numeric"
                  value={cat.dropLowest}
                  onChange={e => updateCat(cat.id, "dropLowest", Number(e.target.value) || 0)}
                  style={{ ...s.input, width: 44, padding: "6px 4px", fontSize: 13, textAlign: "center", height: "auto" }}
                />
                <span style={{ color: muted, fontSize: 11, whiteSpace: "nowrap" }}>lowest</span>
              </div>
              <button onClick={() => deleteCat(cat.id)} style={{ ...s.btnDanger, width: "auto", padding: "5px 10px", fontSize: 12, flexShrink: 0 }}>✕</button>
            </div>
          ))}

          {/* Add new category */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0" }}>
            <div style={{ width: 10, flexShrink: 0 }} />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCat()}
              placeholder="New category name…"
              style={{ ...s.input, flex: 1, padding: "6px 10px", fontSize: 13, height: "auto" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <input
                type="text" inputMode="numeric"
                value={newWeight}
                onChange={e => setNewWeight(Number(e.target.value) || 0)}
                style={{ ...s.input, width: 52, padding: "6px 6px", fontSize: 13, textAlign: "center", height: "auto" }}
              />
              <span style={{ color: muted, fontSize: 12 }}>%</span>
            </div>
            <div style={{ width: 100 }} />
            <button onClick={addCat} style={{ ...s.btnSec, width: "auto", padding: "6px 14px", fontSize: 13, flexShrink: 0 }}>Add</button>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: cellBorder, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: muted }}>
              Total: <span style={{ fontWeight: 700, color: Math.round(weightSum) === 100 ? "#4ade80" : "#f87171" }}>{weightSum.toFixed(1)}%</span>
              {Math.round(weightSum) !== 100 && <span style={{ color: "#f87171", fontSize: 12, marginLeft: 6 }}>(must equal 100%)</span>}
            </span>
          </div>
          {saveError && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{saveError}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
            <button onClick={handleSave} style={{ ...s.btnPri, flex: 1 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BulkScoreModal ────────────────────────────────────────────────────────────
// One input per student for a single assignment. This is how a paper exam or lab actually
// gets entered — a whole column in one pass, Enter stepping to the next student — rather
// than clicking cell by cell across a horizontally scrolling table.
// Reports `{ [studentId]: number | null }` for CHANGED students only (null = clear the
// score); the caller owns how that becomes a grade override.
function BulkScoreModal({ assignment, students, scoreMap, excusedMap, onClose, onSave }) {
  const { s, text, muted, border, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  const inputsRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initial = {};
  for (const stu of students) {
    const sc = scoreMap[stu.studentId]?.[assignment.id];
    initial[stu.studentId] = sc == null ? "" : String(sc);
  }
  const [draft, setDraft] = useState(initial);

  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  const maxPts = assignment.maxPts || 10;
  const entered = students.filter(stu => String(draft[stu.studentId] ?? "").trim() !== "").length;
  const invalid = students.filter(stu => {
    const raw = String(draft[stu.studentId] ?? "").trim();
    if (raw === "") return false;
    const n = parseFloat(raw);
    return !isFinite(n) || n < 0 || n > maxPts;
  });

  const handleSave = async () => {
    if (invalid.length) { setError(`Scores must be between 0 and ${maxPts}.`); return; }
    const changes = {};
    for (const stu of students) {
      const raw = String(draft[stu.studentId] ?? "").trim();
      if (raw === initial[stu.studentId]) continue;
      changes[stu.studentId] = raw === "" ? null : parseFloat(raw);
    }
    if (!Object.keys(changes).length) { onClose(); return; }
    setSaving(true);
    try { await onSave(changes); onClose(); }
    catch (e) { setError(e?.message || "Save failed."); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, padding: 0, width: "100%", maxWidth: 460, maxHeight: "86vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${border}` }}>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>Enter Scores</h3>
          <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{assignment.title} · out of {maxPts}</p>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 22px" }}>
          {students.length === 0 && (
            <p style={{ ...s.muted, fontSize: 13, padding: "16px 0", margin: 0 }}>No students in the roster yet.</p>
          )}
          {students.map((stu, i) => {
            const isExcused = !!excusedMap[stu.studentId]?.[assignment.id];
            const raw = String(draft[stu.studentId] ?? "").trim();
            const n = parseFloat(raw);
            const bad = raw !== "" && (!isFinite(n) || n < 0 || n > maxPts);
            return (
              <div key={stu.studentId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < students.length - 1 ? `1px solid ${border}` : "none" }}>
                <span style={{ color: text, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {stu.altName || stu.fullName}
                </span>
                {isExcused && <span style={{ ...s.badge(muted), fontSize: 10 }}>Excused</span>}
                <input
                  ref={el => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="decimal"
                  value={draft[stu.studentId] ?? ""}
                  onChange={e => { setError(""); setDraft(d => ({ ...d, [stu.studentId]: e.target.value })); }}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); inputsRef.current[i + 1]?.focus(); }
                    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
                  }}
                  placeholder="–"
                  style={{ ...s.input, width: 62, flexShrink: 0, padding: "4px 8px", fontSize: 13, height: "auto",
                           textAlign: "center", fontFamily: "monospace",
                           borderColor: bad ? "#f87171" : undefined }}
                />
                <span style={{ color: muted, fontSize: 11, width: 30, flexShrink: 0 }}>/{maxPts}</span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "14px 22px", borderTop: `1px solid ${border}` }}>
          {error && <p style={{ color: "#f87171", fontSize: 12, margin: "0 0 10px" }}>{error}</p>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: muted, fontSize: 12 }}>{entered} of {students.length} entered</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} disabled={saving} style={{ ...s.btnSec, width: "auto", padding: "8px 16px" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...s.btnPri, width: "auto", padding: "8px 20px" }}>
                {saving ? "Saving…" : "Save Scores"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BlackboardModal ───────────────────────────────────────────────────────────
// Links Newton's gradebook to a Blackboard Grade Center, then downloads a file that Grade
// Center will accept. The two facts the link exists to capture — each student's Blackboard
// USERNAME and each column's COLUMN ID — can only come from a Blackboard download; the reasons
// are spelled out at the top of src/blackboard.js.
//
// The link is deliberately explicit rather than automatic. An assignment with no Blackboard
// column is LEFT OUT of the upload instead of being invented: a header without a column id makes
// Blackboard create a zero-point text column that can't feed a calculated total, and undoing 37
// of those inside Blackboard is far worse than being told which ones to make first.
function BlackboardModal({ roster, assignments, scoreMap, excusedMap, blackboard, onSave, courseCode, onClose }) {
  const { s, muted, border, text, teal, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  const solidBg = isLight ? "#fff" : "#252627";
  const fileRef = useRef(null);

  const [link, setLink] = useState(() => blackboard || { columns: [], map: {}, usernames: {} });
  const [importMsg, setImportMsg] = useState(null);   // { tone: "ok"|"warn"|"err", lines: [] }
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Default ON: hand-creating a column per assignment is the thing this is meant to avoid.
  const [createMissing, setCreateMissing] = useState(true);
  // Default OFF, and it stays off for PHY 215: the instructor matches points possible by hand in
  // Blackboard so the raw marks read identically on both platforms. Scaling is the fallback for
  // anyone who would rather not, not the house route.
  const [scaleToColumn, setScaleToColumn] = useState(false);

  const columns = link.columns || [];
  const map = link.map || {};
  const usernames = link.usernames || {};
  const usable = columns.filter(c => !isCalculatedColumn(c));
  const colById = Object.fromEntries(columns.map(c => [c.bbId, c]));

  const unlinkedStudents = roster.filter(st => !usernames[st.studentId]);
  const unusedColumns = usable.filter(c => !Object.values(map).includes(c.bbId));

  const onFile = e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const res = readBlackboardExport(String(ev.target.result || ""), roster);
      if (res.error) { setImportMsg({ tone: "err", lines: [res.error] }); return; }
      // Merge, never replace — mergeImport (blackboard.js) keeps hand-made pairings and
      // accumulates usernames, which is what makes "add a column in Blackboard, download, import
      // again" safe to repeat all term.
      const { link: next, newlyMatched } = mergeImport(link, res, assignments, file.name);
      setLink(next);
      setDirty(true);
      const lines = [
        `${res.links.length} of ${roster.length} students matched to a Blackboard username.`,
        `${res.columns.filter(c => !isCalculatedColumn(c)).length} gradable Blackboard columns found, ${newlyMatched} newly matched by name.`,
      ];
      if (res.unmatchedStudents.length) lines.push(`Not in the Blackboard file: ${res.unmatchedStudents.map(st => st.fullName).join(", ")}.`);
      if (res.unmatchedRows.length) lines.push(`In Blackboard but not on the Newton roster: ${res.unmatchedRows.map(r => r.name || r.username).join(", ")}.`);
      setImportMsg({ tone: res.unmatchedStudents.length || res.unmatchedRows.length ? "warn" : "ok", lines });
    };
    reader.readAsText(file);
  };

  const setPair = (assignmentId, bbId) => {
    setLink(prev => ({ ...prev, map: pairColumn(prev.map || {}, assignmentId, bbId) }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(columns.length || Object.keys(usernames).length ? link : null); setDirty(false); }
    finally { setSaving(false); }
  };

  // Built on every render so the counts under the toggle are the real contents of the file the
  // button would download, not a second estimate that could disagree with it.
  const preview = buildBlackboardCsv({ roster, assignments, link, scoreMap, excusedMap, createMissing, scaleToColumn });

  const handleDownload = async () => {
    if (dirty) await handleSave();
    download(gradebookFilename(courseCode, "blackboard"), preview.csv);
  };

  const ready = preview.exportedCount > 0 && preview.studentCount > 0;

  const noteColor = tone => tone === "err" ? "#f87171" : tone === "warn" ? "#facc15" : "#4ade80";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: cellBorder, flexShrink: 0 }}>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: 0 }}>Blackboard</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: muted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 22px", flex: 1 }}>
          {/* Step 1 — import */}
          <h4 style={{ color: text, fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>1. Import a Blackboard download</h4>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 10px" }}>
            In Blackboard, go to Grade Center, then Work Offline, then Download, and choose the full Grade Center as a comma-delimited file. Import that file here. It is the only place Blackboard publishes each student's username and each column's ID, and Blackboard matches an upload on the username alone. Nothing is sent to Blackboard by this step.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ ...s.btnSec, width: "auto", padding: "7px 16px", fontSize: 13 }}>
              {columns.length ? "Import a newer download…" : "Choose Blackboard file…"}
            </button>
            {link.importedAt && (
              <span style={{ color: muted, fontSize: 12 }}>
                Last imported {new Date(link.importedAt).toLocaleString()}{link.sourceFile ? ` from ${link.sourceFile}` : ""}
              </span>
            )}
          </div>
          {importMsg && (
            <div style={{ border: `1px solid ${noteColor(importMsg.tone)}55`, background: `${noteColor(importMsg.tone)}12`, borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
              {importMsg.lines.map((l, i) => (
                <p key={i} style={{ color: i === 0 ? text : muted, fontSize: 12.5, lineHeight: 1.5, margin: i ? "4px 0 0" : 0 }}>{l}</p>
              ))}
            </div>
          )}

          {columns.length > 0 && (
            <>
              {/* Step 2 — pair the columns */}
              <h4 style={{ color: text, fontWeight: 700, fontSize: 14, margin: "18px 0 6px" }}>2. Match assignments to Blackboard columns</h4>
              <p style={{ color: muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 10px" }}>
                A matched assignment writes into that exact Blackboard column. An unmatched one is created by Blackboard on upload if the box below is ticked. Matches are suggested by name and you can change any of them. Calculated columns such as Overall Grade are not listed, because Blackboard recomputes those and will not accept them in an upload.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 4px" }}>
                <span style={{ flex: 1, color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Newton assignment</span>
                <span style={{ width: 270, color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Blackboard column</span>
              </div>
              {assignments.map(a => {
                const col = colById[map[a.id]];
                const bad = col && col.points != null && Number(col.points) !== Number(a.maxPts);
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: cellBorder }}>
                    <span style={{ flex: 1, color: col ? text : muted, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.title}>
                      {a.title} <span style={{ color: muted, fontSize: 11 }}>/{a.maxPts}</span>
                    </span>
                    <select
                      value={map[a.id] || ""}
                      onChange={e => setPair(a.id, e.target.value)}
                      // colorScheme is required, not cosmetic: the option list a native <select>
                      // drops is browser chrome, not our DOM, so no CSS of ours reaches inside it
                      // — without the hint it renders white over the dark app. Same reason
                      // DueDateField sets it on its date/time inputs.
                      style={{ ...s.input, width: 270, flexShrink: 0, padding: "5px 8px", fontSize: 12.5, height: "auto", color: col ? text : muted, borderColor: bad ? "#facc15" : undefined, colorScheme: isLight ? "light" : "dark" }}
                    >
                      <option value="">Not in Blackboard</option>
                      {usable.map(c => (
                        <option key={c.bbId} value={c.bbId}>{c.title} (/{c.points ?? "?"})</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {preview.pointMismatches.length > 0 && (
                <div style={{ border: "1px solid #facc1555", background: "#facc1512", borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
                  <p style={{ color: text, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                    Points differ on {preview.pointMismatches.length} matched assignment{preview.pointMismatches.length > 1 ? "s" : ""}: {preview.pointMismatches.map(m => `${m.assignment.title} is /${m.assignment.maxPts} here and /${m.col.points} in Blackboard`).join("; ")}.
                  </p>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 8 }}>
                    <input type="checkbox" checked={scaleToColumn} onChange={e => setScaleToColumn(e.target.checked)} style={{ marginTop: 2, accentColor: teal, cursor: "pointer" }} />
                    <span style={{ fontSize: 12.5, lineHeight: 1.5, color: text }}>
                      Scale the scores to match Blackboard's points
                      <span style={{ display: "block", color: muted, marginTop: 3 }}>
                        An 8/10 uploads as 80 into a column Blackboard made worth 100, so the percentage behind the Overall Grade is right without editing the column. Leave this off if you would rather the raw marks match Newton, and set each column's points in Blackboard instead. Either way the numbers agree again the moment the points do.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {unusedColumns.length > 0 && (
                <p style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, margin: "10px 0 0" }}>
                  Blackboard columns not matched to anything here: {unusedColumns.map(c => c.title).join(", ")}. They are left untouched by the upload.
                </p>
              )}

              {/* Missing-column policy. Stated in full at the point of choosing, because the
                  consequence lands inside Blackboard where it is tedious to undo. */}
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 14, padding: "10px 12px", border: cellBorder, borderRadius: 8 }}>
                <input type="checkbox" checked={createMissing} onChange={e => setCreateMissing(e.target.checked)} style={{ marginTop: 2, accentColor: teal, cursor: "pointer" }} />
                <span style={{ fontSize: 13, lineHeight: 1.5, color: text }}>
                  Let Blackboard create the columns it does not have yet
                  <span style={{ display: "block", color: muted, marginTop: 3 }}>
                    An unmatched assignment is uploaded under its plain title and Blackboard makes a column for it. Two things to know: the upload cannot set the points total, so the new column arrives at <strong>Blackboard's own default</strong> (100 in Ultra) rather than yours, and Blackboard only creates a column that has <strong>at least one grade</strong> in it, so assignments nobody has done yet are held back until they do. Download and import the Grade Center again afterwards: every new column links itself, and Newton then knows its real points total.
                  </span>
                </span>
              </label>

              {/* Step 3 — download */}
              <h4 style={{ color: text, fontWeight: 700, fontSize: 14, margin: "18px 0 6px" }}>3. Download and upload it</h4>
              <p style={{ color: muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 10px" }}>
                In Blackboard, go to Grade Center, then Work Offline, then Upload, and choose the file this button saves. Excused assignments are left blank, since a grade upload cannot set Blackboard's exempt flag; mark those exempt in Blackboard by hand.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: muted, marginBottom: 10 }}>
                <span>{preview.studentCount} of {roster.length} students</span>
                <span>{preview.exportedCount} of {assignments.length} assignments</span>
                {preview.created.length > 0 && <span style={{ color: teal }}>{preview.created.length} new column{preview.created.length > 1 ? "s" : ""} for Blackboard to create</span>}
              </div>
              {preview.created.length > 0 && (
                <p style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" }}>
                  Blackboard will create: {preview.created.map(a => a.title).join(", ")}. Set each one's points total in Blackboard afterwards, then download and import the Grade Center again so they link for next time.
                </p>
              )}
              {preview.scaled.length > 0 && (
                <p style={{ color: teal, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" }}>
                  Scaled to Blackboard's points: {preview.scaled.map(x => `${x.assignment.title} (/${x.assignment.maxPts} to /${x.col.points})`).join(", ")}.
                </p>
              )}
              {preview.skippedEmpty.length > 0 && (
                <p style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" }}>
                  Waiting on a first grade before Blackboard can create a column for them: {preview.skippedEmpty.length} assignment{preview.skippedEmpty.length > 1 ? "s" : ""}, including {preview.skippedEmpty.slice(0, 4).map(a => a.title).join(", ")}{preview.skippedEmpty.length > 4 ? ", and others" : ""}. They will go up on a later upload on their own.
                </p>
              )}
              {preview.skippedAssignments.length > 0 && (
                <p style={{ color: "#facc15", fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" }}>
                  Left out because they have no Blackboard column and the box above is unticked: {preview.skippedAssignments.length} assignment{preview.skippedAssignments.length > 1 ? "s" : ""}.
                </p>
              )}
              {unlinkedStudents.length > 0 && (
                <p style={{ color: "#facc15", fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" }}>
                  No Blackboard username for {unlinkedStudents.map(st => st.fullName).join(", ")}, so they are left out of the file. If they are enrolled in Blackboard, download the Grade Center again and re-import it.
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: cellBorder, flexShrink: 0, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1, color: muted, fontSize: 12 }}>{dirty ? "Unsaved changes" : ""}</span>
          <button onClick={onClose} style={{ ...s.btnSec, width: "auto", padding: "9px 18px" }}>Close</button>
          <button onClick={handleSave} disabled={!dirty || saving} style={{ ...s.btnSec, width: "auto", padding: "9px 18px", opacity: !dirty || saving ? 0.5 : 1, cursor: !dirty || saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save link"}
          </button>
          <button onClick={handleDownload} disabled={!ready} style={{ ...s.btnPri, width: "auto", padding: "9px 18px", opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "default" }}>
            Download for Blackboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gradebook ─────────────────────────────────────────────────────────────────
export function Gradebook({
  roster,
  modules,
  quizzes,
  submissions,
  gradeCategories,
  gradeOverrides,
  assignmentCategories,
  manualAssignments,
  attendance,
  dueDates,
  assignmentNameOverrides,
  assignmentOrderOverrides,
  onSaveGradeCategories,
  onSaveOverrideForStudent,
  onSaveBulkOverrides,
  onClearSubmission,
  onSaveAssignmentCategories,
  onSaveManualAssignments,
  onSaveAssignmentNameOverrides,
  onSaveAssignmentOrderOverrides,
  customQuizzes,
  onEditCustomQuiz,
  blackboard,
  onSaveBlackboardLink,
  courseCode,
}) {
  const { s, muted, border, text, teal, bg, card, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  const [editingCell, setEditingCell] = useState(null); // { studentId, assignmentId }
  const [editScore, setEditScore] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showBlackboard, setShowBlackboard] = useState(false);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const thumbDragRef = useRef(null);
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, width: 0, clientWidth: 0 });
  const [scrollbarVisible, setScrollbarVisible] = useState(false);
  const scrollFadeTimer = useRef(null);
  const STUDENT_W = 164, OVERALL_W = 80;
  const [viewSubModal, setViewSubModal] = useState(null); // { submission, studentName, assignmentTitle }
  const [catDropdownFor, setCatDropdownFor] = useState(null); // assignmentId
  const [editingAssignmentTitle, setEditingAssignmentTitle] = useState(null);
  const [assignmentTitleDraft, setAssignmentTitleDraft] = useState("");
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState("");
  const [newAsgCat, setNewAsgCat] = useState("cat_quiz");
  const [newAsgPts, setNewAsgPts] = useState("10");
  const [bulkEntryFor, setBulkEntryFor] = useState(null);   // assignmentId — opens BulkScoreModal

  // Column drag/drop
  const [dragColId, setDragColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Filters
  const [filterStudent, setFilterStudent] = useState("");
  const [filterCatIds, setFilterCatIds] = useState(new Set());
  const [filterAssignment, setFilterAssignment] = useState("");

  const assignments = buildGradebookAssignments(modules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, assignmentOrderOverrides, dueDates);

  const displayedStudents = (roster || []).filter(stu =>
    !filterStudent || (stu.altName || stu.fullName).toLowerCase().includes(filterStudent.toLowerCase())
  );
  const displayedAssignments = assignments.filter(a =>
    (filterCatIds.size === 0 || filterCatIds.has(a.catId)) &&
    (!filterAssignment || a.title.toLowerCase().includes(filterAssignment.toLowerCase()))
  );
  const hasFilter = filterStudent || filterCatIds.size > 0 || filterAssignment;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setScrollMetrics({ left: el.scrollLeft, width: el.scrollWidth, clientWidth: el.clientWidth });
      setScrollbarVisible(true);
      clearTimeout(scrollFadeTimer.current);
      scrollFadeTimer.current = setTimeout(() => setScrollbarVisible(false), 500);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!thumbDragRef.current || !scrollRef.current) return;
      const el = scrollRef.current;
      const { startX, startScroll } = thumbDragRef.current;
      const trackW = el.clientWidth - STUDENT_W - OVERALL_W;
      const thumbW = Math.max(40, (el.clientWidth / el.scrollWidth) * trackW);
      const maxThumb = trackW - thumbW;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxThumb <= 0) return;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScroll + (e.clientX - startX) / maxThumb * maxScroll));
    };
    const onUp = () => {
      if (!thumbDragRef.current) return;
      thumbDragRef.current = null;
      scrollFadeTimer.current = setTimeout(() => setScrollbarVisible(false), 500);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  // Per-student score / excused / integrity / absence maps, built by the shared
  // `buildScoreMatrix` (analytics.js) so the gradebook grid and the Analytics tab's correlations
  // are computed from ONE derivation and cannot drift. See that file for the map shapes and the
  // rule that an integrity flag never withholds credit until the instructor upholds it.
  const { scoreMap, excusedMap, flaggedMap, absentMap } = buildScoreMatrix({
    roster, assignments, submissions, gradeOverrides, attendance,
  });

  const overallGrades = {};
  const now = new Date();
  for (const stu of (roster || [])) {
    const submittedIds = new Set(
      (submissions || []).filter(s => s.studentId === stu.studentId).map(s => s.quizId)
    );
    // Which assignments count yet — a past-due unsubmitted quiz is a real zero, an unmarked
    // exam is not. The rule lives in `countsTowardGrade` (analytics.js) because StudentGrades
    // and the Analytics tab's missing-work policy must apply the identical test, and that is
    // what keeps every Overall figure in the app in agreement.
    const activeAssignments = assignments.filter(a => countsTowardGrade(a, {
      hasScore: scoreMap[stu.studentId]?.[a.id] != null,
      isExcused: !!excusedMap[stu.studentId]?.[a.id],
      hasSubmission: submittedIds.has(a.id),
      now,
    }));
    overallGrades[stu.studentId] = calcGrades({
      assignments: activeAssignments,
      categories: gradeCategories,
      scores: scoreMap[stu.studentId] || {},
      excused: excusedMap[stu.studentId] || {},
    });
  }

  const handleCellClick = (studentId, assignmentId) => {
    // Seed the editor with the score the instructor ENTERED, not the effective one. On a cell
    // the attendance policy zeroed those differ, and seeding the 0 would mean clicking the
    // cell and pressing Enter silently overwrites the real mark with a stored 0 — which a
    // later waiver could then never restore.
    const absence = absentMap[studentId]?.[assignmentId];
    const sc = absence ? absence.base : scoreMap[studentId]?.[assignmentId];
    setEditingCell({ studentId, assignmentId });
    setEditScore(sc != null ? String(sc) : "");
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { studentId, assignmentId } = editingCell;
    setEditingCell(null);
    const current = { ...(gradeOverrides[studentId] || {}) };
    const existing = current[assignmentId] || {};
    const parsed = parseFloat(editScore);
    if (!isNaN(parsed)) {
      // Typing a score clears excused status. Clamp to the assignment's own maximum —
      // exams are out of 100, labs and quizzes out of 10.
      const maxPts = assignments.find(a => a.id === assignmentId)?.maxPts || 10;
      const { excused: _e, previousScore: _p, ...rest } = existing;
      current[assignmentId] = { ...rest, score: Math.max(0, Math.min(maxPts, parsed)) };
    } else {
      // No score entered — preserve existing override as-is (keeps excused, dueDate, etc.)
      const { score: _, ...rest } = existing;
      if (Object.keys(rest).length) current[assignmentId] = rest;
      else delete current[assignmentId];
    }
    await onSaveOverrideForStudent(studentId, current);
  };

  const excuseCell = async (studentId, assignmentId) => {
    setEditingCell(null);
    const current = { ...(gradeOverrides[studentId] || {}) };
    const prevOv = current[assignmentId] || {};
    current[assignmentId] = {
      excused: true,
      previousScore: prevOv.score ?? null,
      ...(prevOv.dueDate ? { dueDate: prevOv.dueDate } : {}),
    };
    await onSaveOverrideForStudent(studentId, current);
  };

  const unexcuseCell = async (studentId, assignmentId) => {
    setEditingCell(null);
    const current = { ...(gradeOverrides[studentId] || {}) };
    const ov = current[assignmentId] || {};
    const { excused: _e, previousScore: _p, ...rest } = ov;
    if (ov.previousScore != null) {
      current[assignmentId] = { ...rest, score: ov.previousScore };
    } else if (Object.keys(rest).length) {
      current[assignmentId] = rest;
    } else {
      delete current[assignmentId];
    }
    await onSaveOverrideForStudent(studentId, current);
  };

  const savePartScoresForCell = async (studentId, assignmentId, partScores) => {
    const current = { ...(gradeOverrides[studentId] || {}) };
    const existing = current[assignmentId] || {};
    // Part scores replace any whole-assignment score override; preserve excused and dueDate
    const { score: _s, previousScore: _p, ...rest } = existing;
    if (Object.keys(partScores).length > 0) {
      current[assignmentId] = { ...rest, partScores };
    } else {
      const { partScores: _ps, ...restNoPs } = rest;
      if (Object.keys(restNoPs).length) current[assignmentId] = restNoPs;
      else delete current[assignmentId];
    }
    await onSaveOverrideForStudent(studentId, current,
      Object.keys(partScores).length ? "✓ Part scores saved" : "✓ Part score overrides cleared");
  };

  // Record the instructor's review of a flagged homework: "cleared" (full credit) or
  // "upheld" (50% penalty). Stored at gradeOverrides[studentId][assignmentId].integrityReview.
  const saveIntegrityReview = async (studentId, assignmentId, decision) => {
    const current = { ...(gradeOverrides[studentId] || {}) };
    const existing = current[assignmentId] || {};
    if (decision) {
      current[assignmentId] = { ...existing, integrityReview: decision };
    } else {
      const { integrityReview: _ir, ...rest } = existing;
      if (Object.keys(rest).length) current[assignmentId] = rest;
      else delete current[assignmentId];
    }
    await onSaveOverrideForStudent(studentId, current,
      decision === "cleared" ? "✓ Integrity flag cleared: full credit" : "✓ Integrity flag upheld: 50% penalty");
  };

  const saveDueDate = async (studentId, assignmentId, dateStr) => {
    setEditingCell(null);
    const current = { ...(gradeOverrides[studentId] || {}) };
    const existing = current[assignmentId] || {};
    let label;
    if (dateStr) {
      current[assignmentId] = { ...existing, dueDate: dateStr };
      const fmt = new Date(dateStr).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      label = `✓ Deadline extended to ${fmt}`;
    } else {
      const { dueDate: _, ...rest } = existing;
      if (Object.keys(rest).length) current[assignmentId] = rest;
      else delete current[assignmentId];
      label = "✓ Extension cleared";
    }
    await onSaveOverrideForStudent(studentId, current, label);
  };

  const commitAssignmentTitle = async id => {
    const draft = assignmentTitleDraft.trim();
    setEditingAssignmentTitle(null);
    if (!draft) return;
    await onSaveAssignmentNameOverrides({ ...(assignmentNameOverrides || {}), [id]: draft });
  };

  // Waive (or reapply) the lecture-absence policy for one lab cell. A flag on the override,
  // never a written score: the zero stays derived from the attendance record, so correcting
  // that record later still does the right thing and there is no stale 0 to clean up.
  const setAttendanceWaived = async (studentId, assignmentId, waived) => {
    const current = { ...(gradeOverrides[studentId] || {}) };
    const existing = current[assignmentId] || {};
    if (waived) current[assignmentId] = { ...existing, attendanceWaived: true };
    else {
      const { attendanceWaived: _w, ...rest } = existing;
      if (Object.keys(rest).length) current[assignmentId] = rest;
      else delete current[assignmentId];
    }
    await onSaveOverrideForStudent(studentId, current);
  };

  // Apply a whole column of scores from BulkScoreModal. `byStudent` is { studentId: number|null }
  // for changed students only; a null clears that student's score but preserves the rest of the
  // override (deadline extension, integrity review), exactly like clearing a single cell does.
  const saveBulkScores = async (assignmentId, byStudent) => {
    const asgn = assignments.find(a => a.id === assignmentId);
    const maxPts = asgn?.maxPts || 10;
    const next = {};
    for (const [studentId, value] of Object.entries(byStudent)) {
      const current = { ...(gradeOverrides[studentId] || {}) };
      const existing = current[assignmentId] || {};
      if (value == null) {
        const { score: _s, ...rest } = existing;
        if (Object.keys(rest).length) current[assignmentId] = rest;
        else delete current[assignmentId];
      } else {
        // Entering a score clears excused status, same rule as the single-cell editor.
        const { excused: _e, previousScore: _p, ...rest } = existing;
        current[assignmentId] = { ...rest, score: Math.max(0, Math.min(maxPts, value)) };
      }
      next[studentId] = current;
    }
    const n = Object.keys(next).length;
    if (!n) return;
    await onSaveBulkOverrides(next, `✓ ${n} score${n === 1 ? "" : "s"} saved: ${asgn?.title || "assignment"}`);
  };

  const submitNewAssignment = async () => {
    const t = newAsgTitle.trim();
    if (!t) return;
    const pts = parseFloat(newAsgPts);
    const id = newId("asgn");
    // maxPtsSet: the instructor chose these points, so the exam migration never rewrites them.
    const next = { ...(manualAssignments || {}), [id]: { id, title: t, catId: newAsgCat, maxPts: isFinite(pts) && pts > 0 ? pts : 10, maxPtsSet: true } };
    await onSaveManualAssignments(next);
    setAddingAssignment(false); setNewAsgTitle(""); setNewAsgCat("cat_quiz"); setNewAsgPts("10");
  };

  const dropColumn = async (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const arr = [...assignments];
    const from = arr.findIndex(a => a.id === fromId);
    const to = arr.findIndex(a => a.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(from < to ? to - 1 : to, 0, moved);
    const overrides = {};
    arr.forEach((a, i) => { overrides[a.id] = i * 10; });
    await onSaveAssignmentOrderOverrides(overrides);
  };

  const exportCsv = () => {
    const sorted = [...(roster || [])].sort((a, b) => a.lastName.localeCompare(b.lastName));
    const rows = [
      // Points vary per assignment (exams /100, labs and quizzes /10), so the header says which.
      ["Student", ...assignments.map(a => `${a.title} (/${a.maxPts})`), "Overall %"],
      ...sorted.map(stu => [
        stu.altName || stu.fullName,
        ...assignments.map(a =>
          excusedMap[stu.studentId]?.[a.id] ? "EX"
          : scoreMap[stu.studentId]?.[a.id] != null ? scoreMap[stu.studentId][a.id]
          : ""
        ),
        overallGrades[stu.studentId]?.overall != null
          ? overallGrades[stu.studentId].overall.toFixed(1) + "%"
          : "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(gradebookFilename(courseCode, "gradebook"), csv);
  };

  // Blackboard upload file. The shape rules and the reasons behind them live in
  // src/blackboard.js; this only gathers the inputs and hands the result to the browser.
  const exportBlackboard = () => {
    const res = buildBlackboardCsv({ roster, assignments, link: blackboard || {}, scoreMap, excusedMap });
    download(gradebookFilename(courseCode, "blackboard"), res.csv);
    return res;
  };

  const toggleCat = catId => setFilterCatIds(prev => {
    const next = new Set(prev);
    if (next.has(catId)) next.delete(catId); else next.add(catId);
    return next;
  });

  const filterBar = (
    <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={filterStudent} onChange={e => setFilterStudent(e.target.value)}
        placeholder="Filter students…"
        style={{ ...s.input, flex: "1 1 140px", padding: "5px 10px", fontSize: 12, height: "auto" }}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {Object.values(gradeCategories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(cat => (
          <button
            key={cat.id}
            onClick={() => toggleCat(cat.id)}
            style={{ ...s.badge(catColor(cat.id)), cursor: "pointer", padding: "3px 10px", fontSize: 11, border: filterCatIds.has(cat.id) ? `1px solid ${catColor(cat.id)}` : `1px solid ${catColor(cat.id)}44`, opacity: filterCatIds.has(cat.id) || filterCatIds.size === 0 ? 1 : 0.4, background: "none" }}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <input
        value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}
        placeholder="Filter assignments…"
        style={{ ...s.input, flex: "1 1 140px", padding: "5px 10px", fontSize: 12, height: "auto" }}
      />
      {hasFilter && (
        <button onClick={() => { setFilterStudent(""); setFilterCatIds(new Set()); setFilterAssignment(""); }} style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 12 }}>Clear</button>
      )}
    </div>
  );

  const headerBar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: 0 }}>Gradebook</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {roster?.length > 0 && <span style={{ color: muted, fontSize: 12 }}>{displayedStudents.length}/{roster.length} students · {displayedAssignments.length}/{assignments.length} assignments</span>}
        <button onClick={exportCsv} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px" }}>Export CSV</button>
        <button onClick={() => setShowBlackboard(true)} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px" }}>Blackboard</button>
        <button onClick={() => setAddingAssignment(true)} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px" }}>+ Assignment</button>
        <button onClick={() => setShowSettings(true)} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px" }}>Grade Settings</button>
      </div>
    </div>
  );

  if (!roster || roster.length === 0) {
    return (
      <div>
        {headerBar}
        {filterBar}
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>No students enrolled in this class yet.</div>
        {showSettings && <GradeSettingsModal gradeCategories={gradeCategories} onSave={onSaveGradeCategories} onClose={() => setShowSettings(false)} />}
        {showBlackboard && <BlackboardModal roster={roster || []} assignments={assignments} scoreMap={scoreMap} excusedMap={excusedMap} blackboard={blackboard} onSave={onSaveBlackboardLink} courseCode={courseCode} onClose={() => setShowBlackboard(false)} />}
      </div>
    );
  }

  const canScroll = scrollMetrics.width > scrollMetrics.clientWidth;
  const trackW = Math.max(0, scrollMetrics.clientWidth - STUDENT_W - OVERALL_W);
  const thumbW = canScroll ? Math.max(40, (scrollMetrics.clientWidth / scrollMetrics.width) * trackW) : trackW;
  const maxScroll = scrollMetrics.width - scrollMetrics.clientWidth;
  const thumbLeft = canScroll && maxScroll > 0 ? (scrollMetrics.left / maxScroll) * (trackW - thumbW) : 0;

  return (
    <div>
      <style>{`.gb-scroll::-webkit-scrollbar:horizontal { display: none; }`}</style>
      {headerBar}
      {filterBar}

      {addingAssignment && (
        <div style={{ ...s.card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            autoFocus value={newAsgTitle} onChange={e => setNewAsgTitle(e.target.value)}
            placeholder="Assignment title…"
            onKeyDown={e => { if (e.key === "Enter") submitNewAssignment(); if (e.key === "Escape") setAddingAssignment(false); }}
            style={{ ...s.input, flex: "1 1 200px", padding: "6px 10px", fontSize: 13 }}
          />
          <select value={newAsgCat} onChange={e => setNewAsgCat(e.target.value)} style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 13 }}>
            {Object.values(gradeCategories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(c => (
              <option key={c.id} value={c.id} style={{ background: bg }}>{c.name}</option>
            ))}
          </select>
          <input
            type="number" min="1" step="1"
            value={newAsgPts} onChange={e => setNewAsgPts(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitNewAssignment(); if (e.key === "Escape") setAddingAssignment(false); }}
            title="Points this assignment is graded out of"
            style={{ ...s.input, width: 78, padding: "6px 10px", fontSize: 13 }}
          />
          <span style={{ color: muted, fontSize: 12 }}>points</span>
          <button onClick={submitNewAssignment} style={{ ...s.btnPri, width: "auto", padding: "6px 14px" }}>Add</button>
          <button onClick={() => setAddingAssignment(false)} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      )}

      {/* Table + right panel */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

      {/* Scrollable gradebook table + custom scrollbar */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div ref={scrollRef} className="gb-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 180px)", borderRadius: 8, border: cellBorder, scrollbarWidth: "none" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content" }}>
          <thead>
            <tr>
              {/* Student column header — sticky top-left */}
              <th style={{
                position: "sticky", top: 0, left: 0, zIndex: 4, background: bg,
                padding: "10px 14px", textAlign: "left", fontSize: 11, color: muted,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                borderBottom: cellBorder, borderRight: cellBorder, whiteSpace: "nowrap", minWidth: 164,
              }}>
                Student
              </th>

              {/* Assignment column headers */}
              {displayedAssignments.map(a => {
                const isDropping = catDropdownFor === a.id;
                const isColDragTarget = dragOverColId === a.id && dragColId !== a.id;
                return (
                  <th
                    key={a.id}
                    draggable
                    onDragStart={e => { setDragColId(a.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", a.id); }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColId(a.id); }}
                    onDragLeave={() => setDragOverColId(null)}
                    onDrop={async e => { e.preventDefault(); await dropColumn(dragColId, a.id); setDragColId(null); setDragOverColId(null); }}
                    onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}
                    style={{
                      position: "sticky", top: 0, zIndex: 3, background: bg,
                      padding: "6px 8px", textAlign: "center",
                      borderBottom: cellBorder, borderRight: cellBorder,
                      minWidth: 72, verticalAlign: "bottom",
                      boxShadow: isColDragTarget ? `inset 3px 0 0 ${teal}` : "none",
                      cursor: dragColId ? "grabbing" : "grab",
                      opacity: dragColId === a.id ? 0.5 : 1,
                    }}
                  >
                    {editingAssignmentTitle === a.id ? (
                      <input
                        autoFocus value={assignmentTitleDraft}
                        onChange={e => setAssignmentTitleDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitAssignmentTitle(a.id); if (e.key === "Escape") setEditingAssignmentTitle(null); }}
                        onBlur={() => commitAssignmentTitle(a.id)}
                        style={{ width: "100%", minWidth: 64, fontSize: 10, background: "transparent", border: `1px solid ${teal}`, color: text, borderRadius: 3, padding: "1px 3px", outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div onClick={() => { setEditingAssignmentTitle(a.id); setAssignmentTitleDraft(a.title); }} style={{ fontSize: 11, color: text, fontWeight: 600, whiteSpace: "nowrap", margin: "0 auto 2px", cursor: "text" }} title={`Click to rename · ${a.title}`}>
                        {a.title}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: muted, marginBottom: 3 }}>/ {a.maxPts}</div>
                    {isDropping ? (
                      <select
                        autoFocus
                        value={a.catId}
                        onChange={async e => {
                          await onSaveAssignmentCategories({ ...assignmentCategories, [a.id]: e.target.value });
                          setCatDropdownFor(null);
                        }}
                        onBlur={() => setCatDropdownFor(null)}
                        style={{ fontSize: 10, background: bg, color: text, border: `1px solid ${border}`, borderRadius: 4, padding: "2px", cursor: "pointer", maxWidth: 66 }}
                      >
                        {Object.values(gradeCategories).sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        onClick={() => setCatDropdownFor(a.id)}
                        style={{ ...s.badge(catColor(a.catId)), cursor: "pointer", fontSize: 9, padding: "1px 5px", display: "inline-block", whiteSpace: "nowrap" }}
                        title={`${gradeCategories[a.catId]?.name || a.catId} · click to change`}
                      >
                        {gradeCategories[a.catId]?.name || a.catId}
                      </span>
                    )}
                    {customQuizzes?.[a.id] && (
                      <button
                        onClick={e => { e.stopPropagation(); onEditCustomQuiz?.(a.id); }}
                        title="Edit quiz prompt"
                        style={{ display: "block", margin: "3px auto 0", background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, color: muted, fontSize: 9, cursor: "pointer", padding: "1px 6px", lineHeight: 1.5 }}
                      >
                        edit
                      </button>
                    )}
                    {/* Manual assignments (exams, labs) have no submission to grade, so their
                        scores are typed in — offer the whole column at once. */}
                    {a.type === "manual" && (
                      <button
                        onClick={e => { e.stopPropagation(); setEditingCell(null); setBulkEntryFor(a.id); }}
                        title={`Enter ${a.title} scores for every student`}
                        style={{ display: "block", margin: "3px auto 0", background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, color: muted, fontSize: 9, cursor: "pointer", padding: "1px 6px", lineHeight: 1.5 }}
                      >
                        enter scores
                      </button>
                    )}
                  </th>
                );
              })}

              {/* Overall header — sticky top-right */}
              <th style={{
                position: "sticky", top: 0, right: 0, zIndex: 4, background: bg,
                padding: "10px 14px", textAlign: "center", fontSize: 11, color: muted,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                borderBottom: cellBorder, borderLeft: cellBorder, whiteSpace: "nowrap", minWidth: 80,
              }}>
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedStudents.map((stu, rIdx) => {
              const overall = overallGrades[stu.studentId]?.overall;
              const oc = overallColor(overall);
              const altBg = isLight ? "#EEEAE5" : "#1e1f21";
              const stickyBg = rIdx % 2 === 0 ? bg : altBg;
              return (
                <tr key={stu.studentId} style={{ background: stickyBg }}>
                  {/* Student name — sticky left */}
                  <td style={{
                    position: "sticky", left: 0, zIndex: 2, background: stickyBg,
                    padding: "8px 14px", fontSize: 13, color: text, fontWeight: 500,
                    borderRight: cellBorder, borderBottom: cellBorder, whiteSpace: "nowrap",
                  }}>
                    {stu.altName || stu.fullName}
                  </td>

                  {/* Score cells */}
                  {displayedAssignments.map(a => {
                    const score = scoreMap[stu.studentId]?.[a.id];
                    const isExcused = !!excusedMap[stu.studentId]?.[a.id];
                    const isFlagged = !!flaggedMap[stu.studentId]?.[a.id];
                    const absence = absentMap[stu.studentId]?.[a.id];
                    const isMissing = score == null && !isExcused;
                    const isEditing = editingCell?.studentId === stu.studentId && editingCell?.assignmentId === a.id;

                    if (isEditing) {
                      return (
                        <td key={a.id} style={{
                          padding: 0, borderRight: cellBorder, borderBottom: cellBorder,
                          backgroundColor: stickyBg,
                          backgroundImage: `linear-gradient(${teal}1a, ${teal}1a)`,
                          outline: `2px solid ${teal}`, outlineOffset: -2,
                          textAlign: "center",
                        }}>
                          <EditCell
                            score={editScore}
                            onScoreChange={setEditScore}
                            onCommit={commitEdit}
                            onCancel={() => setEditingCell(null)}
                            panelRef={panelRef}
                          />
                        </td>
                      );
                    }

                    const cellTitle = absence
                        ? `Absent from lecture ${formatSessionDate(absence.date)}: 0 by course policy${absence.base != null ? ` (entered score ${absence.base})` : ""} · click to waive`
                      : isFlagged ? "Integrity flag: full credit. Click to review the submitted work."
                      : isExcused ? "Excused · click to edit"
                      : isMissing ? (a.type === "manual" ? "No score yet · click to enter" : "No submission · click to override")
                      : `${score}/${a.maxPts} · click to edit`;
                    return (
                      <td
                        key={a.id}
                        onClick={() => handleCellClick(stu.studentId, a.id)}
                        title={cellTitle}
                        style={{
                          backgroundColor: stickyBg,
                          backgroundImage: `linear-gradient(${cellBg(score, a.maxPts, isExcused, isMissing)}, ${cellBg(score, a.maxPts, isExcused, isMissing)})`,
                          color: cellFg(score, a.maxPts, isExcused, isMissing),
                          borderRight: cellBorder, borderBottom: cellBorder,
                          textAlign: "center", padding: "8px 4px",
                          fontSize: 13, fontFamily: "monospace", cursor: "pointer",
                        }}
                      >
                        {isFlagged && <span title="Integrity flag" style={{ color: "#f87171" }}>* </span>}
                        {absence && <span title="Absent from lecture" style={{ color: "#f87171" }}>A </span>}
                        {isExcused ? "EX" : isMissing ? "–" : score}
                        {/* The entered score is kept visible, struck through: the instructor needs
                            to see that a lab WAS marked, and that policy is what zeroed it. */}
                        {absence?.base != null && absence.base !== 0 && (
                          <span style={{ marginLeft: 3, fontSize: 11, opacity: 0.55, textDecoration: "line-through" }}>{absence.base}</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Overall % — sticky right */}
                  <td style={{
                    position: "sticky", right: 0, zIndex: 2, background: stickyBg,
                    padding: "8px 14px", textAlign: "center",
                    fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: oc,
                    borderLeft: cellBorder, borderBottom: cellBorder,
                  }}>
                    {overall != null ? overall.toFixed(1) + "%" : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canScroll && (
        <div style={{ marginLeft: 165, marginRight: 81, height: 8, marginTop: 4, position: "relative", borderRadius: 4, background: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)", opacity: scrollbarVisible ? 1 : 0, transition: scrollbarVisible ? "none" : "opacity 0.2s ease" }}>
          <div
            style={{ position: "absolute", left: thumbLeft, width: thumbW, top: 0, bottom: 0, borderRadius: 4, background: isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.3)", cursor: "grab" }}
            onMouseDown={(e) => {
              thumbDragRef.current = { startX: e.clientX, startScroll: scrollMetrics.left };
              setScrollbarVisible(true);
              clearTimeout(scrollFadeTimer.current);
              e.preventDefault();
            }}
          />
        </div>
      )}
      </div>

      {/* Right panel */}
      {editingCell && (
        <GradeDetailPanel
          panelRef={panelRef}
          editingCell={editingCell}
          roster={roster}
          assignments={assignments}
          submissions={submissions}
          gradeOverrides={gradeOverrides}
          excusedMap={excusedMap}
          absentMap={absentMap}
          onSetAttendanceWaived={setAttendanceWaived}
          onExcuse={excuseCell}
          onUnexcuse={unexcuseCell}
          onViewSub={() => {
            const { studentId, assignmentId } = editingCell;
            const stu = (roster || []).find(r => r.studentId === studentId);
            const asgn = (assignments || []).find(a => a.id === assignmentId);
            const sub = (submissions || []).find(s => s.studentId === studentId && s.quizId === assignmentId);
            if (sub) setViewSubModal({ submission: sub, studentName: stu?.altName || stu?.fullName, assignmentTitle: asgn?.title, studentId, assignmentId });
          }}
          onSaveDueDate={saveDueDate}
          onClearSubmission={onClearSubmission}
          setEditingCell={setEditingCell}
        />
      )}

      </div>{/* end Table + right panel flex wrapper */}

      {showSettings && (
        <GradeSettingsModal
          gradeCategories={gradeCategories}
          onSave={onSaveGradeCategories}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showBlackboard && (
        <BlackboardModal
          roster={roster}
          assignments={assignments}
          scoreMap={scoreMap}
          excusedMap={excusedMap}
          blackboard={blackboard}
          onSave={onSaveBlackboardLink}
          courseCode={courseCode}
          onClose={() => setShowBlackboard(false)}
        />
      )}
      {bulkEntryFor && (
        <BulkScoreModal
          assignment={assignments.find(a => a.id === bulkEntryFor)}
          students={displayedStudents}
          scoreMap={scoreMap}
          excusedMap={excusedMap}
          onClose={() => setBulkEntryFor(null)}
          onSave={changes => saveBulkScores(bulkEntryFor, changes)}
        />
      )}
      {viewSubModal && (
        <SubViewModal
          submission={viewSubModal.submission}
          studentName={viewSubModal.studentName}
          assignmentTitle={viewSubModal.assignmentTitle}
          onClose={() => setViewSubModal(null)}
          override={(gradeOverrides[viewSubModal.studentId] || {})[viewSubModal.assignmentId] || {}}
          onSavePartScores={viewSubModal.submission.type === "homework"
            ? ps => savePartScoresForCell(viewSubModal.studentId, viewSubModal.assignmentId, ps)
            : undefined}
          onSetIntegrityReview={viewSubModal.submission.type === "homework"
            ? decision => saveIntegrityReview(viewSubModal.studentId, viewSubModal.assignmentId, decision)
            : undefined}
        />
      )}
    </div>
  );
}
