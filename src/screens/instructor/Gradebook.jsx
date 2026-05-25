import { useState, useRef, useEffect } from "react";
import { s, BG, CARD, TEAL, MUTED, BORDER } from "../../theme.js";
import { buildGradebookAssignments, calcGrades, dueToDate } from "../../utils.js";
import { ChatMessages } from "../../components/ChatMessages.jsx";
import { newId } from "../../courses/ids.js";

// ── Shared helpers ────────────────────────────────────────────────────────────
const CAT_COLORS = {
  cat_lab: "#818cf8", cat_hw: "#60a5fa", cat_quiz: "#34d399",
  cat_midterm: "#fbbf24", cat_final: "#f87171",
};
function catColor(catId) { return CAT_COLORS[catId] || TEAL; }

function overallColor(pct) {
  if (pct == null) return MUTED;
  if (pct >= 90) return "#4ade80"; if (pct >= 80) return "#a3e635";
  if (pct >= 70) return "#facc15"; if (pct >= 60) return "#fb923c";
  return "#f87171";
}

function cellBg(score, isExcused, isMissing) {
  if (isExcused) return "rgba(160,160,160,0.08)";
  if (isMissing) return "rgba(248,113,113,0.07)";
  if (score >= 8)  return "rgba(74,222,128,0.07)";
  if (score >= 6)  return "rgba(250,204,21,0.07)";
  if (score >= 4)  return "rgba(251,146,60,0.08)";
  return "rgba(248,113,113,0.12)";
}
function cellFg(score, isExcused, isMissing) {
  if (isExcused) return MUTED;
  if (isMissing) return "#f87171";
  if (score >= 8)  return "#4ade80";
  if (score >= 6)  return "#facc15";
  if (score >= 4)  return "#fb923c";
  return "#f87171";
}

const CELL_BORDER = `1px solid ${BORDER}`;

// ── EditCell ──────────────────────────────────────────────────────────────────
function EditCell({ score, onScoreChange, onCommit, onCancel, panelRef }) {
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
        style={{ width: 44, background: "transparent", border: "none", color: "#fff", fontSize: 13, fontFamily: "monospace", textAlign: "center", outline: "none" }}
      />
    </div>
  );
}

// ── GradeDetailPanel ──────────────────────────────────────────────────────────
function GradeDetailPanel({ panelRef, editingCell, roster, assignments, submissions, gradeOverrides,
    excusedMap, onExcuse, onUnexcuse, onViewSub, onSaveDueDate, setEditingCell }) {
  const { studentId, assignmentId } = editingCell;
  const stu = (roster || []).find(r => r.studentId === studentId);
  const asgn = (assignments || []).find(a => a.id === assignmentId);
  const ov = (gradeOverrides[studentId] || {})[assignmentId] || {};
  const isExcused = !!excusedMap[studentId]?.[assignmentId];
  const sub = (submissions || []).find(s => s.studentId === studentId && s.quizId === assignmentId);
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
        width: 220, flexShrink: 0, background: CARD, border: CELL_BORDER,
        borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16,
        outline: "none", alignSelf: "flex-start",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
          {stu?.altName || stu?.fullName || "Student"}
        </div>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{asgn?.title || "Assignment"}</div>
      </div>

      {/* View Submission */}
      {sub && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={onViewSub}
          style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`, borderRadius: 6,
            color: "#fff", fontSize: 12, cursor: "pointer", padding: "7px 12px", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span>View Submission</span>
          <span style={{ color: MUTED }}>→</span>
        </button>
      )}

      {/* Excuse / Unexcuse */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Excuse Grade</div>
        {isExcused ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: TEAL }}>Currently excused</div>
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
            style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`,
              borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
          >
            Excuse Grade
          </button>
        )}
      </div>

      {/* Deadline Extension */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Deadline Extension</div>
        {asgn?.dueDate && (
          <div style={{ fontSize: 11, color: MUTED }}>Default: {asgn.dueDate}</div>
        )}
        {ov.dueDate && (
          <div style={{ fontSize: 11, color: TEAL }}>
            Extended: {new Date(ov.dueDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={openPicker}
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`,
              borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer", padding: "7px 8px" }}
          >
            Extend Deadline
          </button>
          {ov.dueDate && (
            <button
              onClick={() => onSaveDueDate(studentId, assignmentId, "")}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`, borderRadius: 6,
                color: MUTED, fontSize: 12, cursor: "pointer", padding: "7px 8px" }}
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
              style={{ width: "100%", background: "#1c1d1f", border: `1px solid ${BORDER}`, borderRadius: 6,
                color: localDate ? "#fff" : MUTED, fontSize: 12, padding: "6px 10px",
                boxSizing: "border-box", colorScheme: "dark" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { val: localHour, set: setLocalHour, opts: ["Hr", ...Array.from({length:12},(_,i)=>String(12-i))], key: "h" },
                { val: localMinute, set: setLocalMinute, opts: ["Min", ...Array.from({length:60},(_,i)=>String(59-i).padStart(2,"0"))], key: "m" },
                { val: localAmPm, set: setLocalAmPm, opts: ["—","PM","AM"], key: "ap" },
              ].map(({ val, set, opts, key }) => (
                <select
                  key={key}
                  value={val}
                  onChange={e => {
                    set(e.target.value);
                    const upd = { h: localHour, m: localMinute, ap: localAmPm, [key]: e.target.value };
                    tryAutoSave(localDate, upd.h, upd.m, upd.ap);
                  }}
                  style={{ flex: 1, background: "#1c1d1f", border: `1px solid ${BORDER}`, borderRadius: 6,
                    color: val ? "#fff" : MUTED, fontSize: 12, padding: "6px 4px",
                    colorScheme: "dark", cursor: "pointer" }}
                >
                  {opts.map(o => <option key={o} value={o === opts[0] ? "" : o} style={{ background: "#1c1d1f" }}>{o}</option>)}
                </select>
              ))}
            </div>
            <button
              onClick={() => setShowExtendPicker(false)}
              style={{ background: "none", border: "none", color: MUTED, fontSize: 11,
                cursor: "pointer", padding: "2px 0", textAlign: "left" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GradeSettingsModal ────────────────────────────────────────────────────────
function GradeSettingsModal({ gradeCategories, onSave, onClose }) {
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
      <div style={{ ...s.card, width: "100%", maxWidth: 580, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: CELL_BORDER, flexShrink: 0 }}>
          <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: 0 }}>Grade Categories</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 22px", flex: 1 }}>
          {/* Column labels */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 4px", marginBottom: 2 }}>
            <div style={{ width: 10, flexShrink: 0 }} />
            <span style={{ flex: 1, color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Name</span>
            <span style={{ width: 52, textAlign: "center", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Weight</span>
            <span style={{ width: 8 }} />
            <span style={{ width: 100, textAlign: "center", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Drop lowest</span>
            <span style={{ width: 34 }} />
          </div>
          {sorted.map(cat => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: CELL_BORDER }}>
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
                <span style={{ color: MUTED, fontSize: 12 }}>%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <input
                  type="text" inputMode="numeric"
                  value={cat.dropLowest}
                  onChange={e => updateCat(cat.id, "dropLowest", Number(e.target.value) || 0)}
                  style={{ ...s.input, width: 44, padding: "6px 4px", fontSize: 13, textAlign: "center", height: "auto" }}
                />
                <span style={{ color: MUTED, fontSize: 11, whiteSpace: "nowrap" }}>lowest</span>
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
              <span style={{ color: MUTED, fontSize: 12 }}>%</span>
            </div>
            <div style={{ width: 100 }} />
            <button onClick={addCat} style={{ ...s.btnSec, width: "auto", padding: "6px 14px", fontSize: 13, flexShrink: 0 }}>Add</button>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: CELL_BORDER, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: MUTED }}>
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

// ── SubViewModal ──────────────────────────────────────────────────────────────
function SubViewModal({ submission, studentName, assignmentTitle, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", flexDirection: "column", zIndex: 60 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: CARD, borderBottom: CELL_BORDER, padding: "14px 20px", flexShrink: 0 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{studentName} — {assignmentTitle}</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
            Score: {submission.score}/10{submission.late ? " (late, 50% penalty)" : ""} · {new Date(submission.timestamp).toLocaleString()}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 28, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {submission.dialogue?.length > 0
          ? <ChatMessages messages={submission.dialogue} />
          : <div style={{ ...s.card, padding: 32, textAlign: "center", color: MUTED }}>No dialogue saved for this submission.</div>}
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
  assignmentNameOverrides,
  assignmentOrderOverrides,
  onSaveGradeCategories,
  onSaveOverrideForStudent,
  onSaveAssignmentCategories,
  onSaveManualAssignments,
  onSaveAssignmentNameOverrides,
  onSaveAssignmentOrderOverrides,
  customQuizzes,
  onEditCustomQuiz,
}) {
  const [editingCell, setEditingCell] = useState(null); // { studentId, assignmentId }
  const [editScore, setEditScore] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef(null);
  const [viewSubModal, setViewSubModal] = useState(null); // { submission, studentName, assignmentTitle }
  const [catDropdownFor, setCatDropdownFor] = useState(null); // assignmentId
  const [editingAssignmentTitle, setEditingAssignmentTitle] = useState(null);
  const [assignmentTitleDraft, setAssignmentTitleDraft] = useState("");
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState("");
  const [newAsgCat, setNewAsgCat] = useState("cat_quiz");

  // Column drag/drop
  const [dragColId, setDragColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Filters
  const [filterStudent, setFilterStudent] = useState("");
  const [filterCatIds, setFilterCatIds] = useState(new Set());
  const [filterAssignment, setFilterAssignment] = useState("");

  const assignments = buildGradebookAssignments(modules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides, assignmentOrderOverrides);

  const displayedStudents = (roster || []).filter(stu =>
    !filterStudent || (stu.altName || stu.fullName).toLowerCase().includes(filterStudent.toLowerCase())
  );
  const displayedAssignments = assignments.filter(a =>
    (filterCatIds.size === 0 || filterCatIds.has(a.catId)) &&
    (!filterAssignment || a.title.toLowerCase().includes(filterAssignment.toLowerCase()))
  );
  const hasFilter = filterStudent || filterCatIds.size > 0 || filterAssignment;

  // Build per-student score and excused maps (override > submission > null)
  const scoreMap = {};
  const excusedMap = {};
  for (const stu of (roster || [])) {
    scoreMap[stu.studentId] = {};
    excusedMap[stu.studentId] = {};
    for (const a of assignments) {
      const ov = (gradeOverrides[stu.studentId] || {})[a.id];
      if (ov?.excused) {
        excusedMap[stu.studentId][a.id] = true;
      } else if (ov?.score != null) {
        scoreMap[stu.studentId][a.id] = ov.score;
      } else {
        const sub = (submissions || []).find(s => s.studentId === stu.studentId && s.quizId === a.id);
        scoreMap[stu.studentId][a.id] = sub != null ? sub.score : null;
      }
    }
  }

  const overallGrades = {};
  const now = new Date();
  for (const stu of (roster || [])) {
    const submittedIds = new Set(
      (submissions || []).filter(s => s.studentId === stu.studentId).map(s => s.quizId)
    );
    const activeAssignments = assignments.filter(a =>
      submittedIds.has(a.id) || (a.dueDate && dueToDate(a.dueDate) < now)
    );
    overallGrades[stu.studentId] = calcGrades({
      assignments: activeAssignments,
      categories: gradeCategories,
      scores: scoreMap[stu.studentId] || {},
      excused: excusedMap[stu.studentId] || {},
    });
  }

  const handleCellClick = (studentId, assignmentId) => {
    const sc = scoreMap[studentId]?.[assignmentId];
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
      // Typing a score clears excused status
      const { excused: _e, previousScore: _p, ...rest } = existing;
      current[assignmentId] = { ...rest, score: Math.max(0, Math.min(10, parsed)) };
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

  const submitNewAssignment = async () => {
    const t = newAsgTitle.trim();
    if (!t) return;
    const id = newId("asgn");
    const next = { ...(manualAssignments || {}), [id]: { id, title: t, catId: newAsgCat, maxPts: 10 } };
    await onSaveManualAssignments(next);
    setAddingAssignment(false); setNewAsgTitle(""); setNewAsgCat("cat_quiz");
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
      ["Student", ...assignments.map(a => a.title), "Overall %"],
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
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gradebook.csv";
    a.click();
    URL.revokeObjectURL(a.href);
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
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0 }}>Gradebook</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {roster?.length > 0 && <span style={{ color: MUTED, fontSize: 12 }}>{displayedStudents.length}/{roster.length} students · {displayedAssignments.length}/{assignments.length} assignments</span>}
        <button onClick={exportCsv} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px" }}>Export CSV</button>
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
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No students enrolled in this class yet.</div>
        {showSettings && <GradeSettingsModal gradeCategories={gradeCategories} onSave={onSaveGradeCategories} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return (
    <div>
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
              <option key={c.id} value={c.id} style={{ background: "#252627" }}>{c.name}</option>
            ))}
          </select>
          <button onClick={submitNewAssignment} style={{ ...s.btnPri, width: "auto", padding: "6px 14px" }}>Add</button>
          <button onClick={() => setAddingAssignment(false)} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      )}

      {/* Table + right panel */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

      {/* Scrollable gradebook table */}
      <div style={{ flex: 1, minWidth: 0, overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 180px)", borderRadius: 8, border: CELL_BORDER }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content" }}>
          <thead>
            <tr>
              {/* Student column header — sticky top-left */}
              <th style={{
                position: "sticky", top: 0, left: 0, zIndex: 4, background: BG,
                padding: "10px 14px", textAlign: "left", fontSize: 11, color: MUTED,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                borderBottom: CELL_BORDER, borderRight: CELL_BORDER, whiteSpace: "nowrap", minWidth: 164,
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
                      position: "sticky", top: 0, zIndex: 3, background: BG,
                      padding: "6px 8px", textAlign: "center",
                      borderBottom: CELL_BORDER, borderRight: CELL_BORDER,
                      minWidth: 72, verticalAlign: "bottom",
                      boxShadow: isColDragTarget ? `inset 3px 0 0 ${TEAL}` : "none",
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
                        style={{ width: "100%", minWidth: 64, fontSize: 10, background: "transparent", border: `1px solid ${TEAL}`, color: "#fff", borderRadius: 3, padding: "1px 3px", outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div onClick={() => { setEditingAssignmentTitle(a.id); setAssignmentTitleDraft(a.title); }} style={{ fontSize: 11, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", margin: "0 auto 2px", cursor: "text" }} title={`Click to rename · ${a.title}`}>
                        {a.title}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>/ {a.maxPts}</div>
                    {isDropping ? (
                      <select
                        autoFocus
                        value={a.catId}
                        onChange={async e => {
                          await onSaveAssignmentCategories({ ...assignmentCategories, [a.id]: e.target.value });
                          setCatDropdownFor(null);
                        }}
                        onBlur={() => setCatDropdownFor(null)}
                        style={{ fontSize: 10, background: "#1c1d1f", color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px", cursor: "pointer", maxWidth: 66 }}
                      >
                        {Object.values(gradeCategories).sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        onClick={() => setCatDropdownFor(a.id)}
                        style={{ ...s.badge(catColor(a.catId)), cursor: "pointer", fontSize: 9, padding: "1px 5px", display: "inline-block", whiteSpace: "nowrap" }}
                        title={`${gradeCategories[a.catId]?.name || a.catId} — click to change`}
                      >
                        {gradeCategories[a.catId]?.name || a.catId}
                      </span>
                    )}
                    {customQuizzes?.[a.id] && (
                      <button
                        onClick={e => { e.stopPropagation(); onEditCustomQuiz?.(a.id); }}
                        title="Edit quiz prompt"
                        style={{ display: "block", margin: "3px auto 0", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, color: MUTED, fontSize: 9, cursor: "pointer", padding: "1px 6px", lineHeight: 1.5 }}
                      >
                        edit
                      </button>
                    )}
                  </th>
                );
              })}

              {/* Overall header — sticky top-right */}
              <th style={{
                position: "sticky", top: 0, right: 0, zIndex: 4, background: BG,
                padding: "10px 14px", textAlign: "center", fontSize: 11, color: MUTED,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                borderBottom: CELL_BORDER, borderLeft: CELL_BORDER, whiteSpace: "nowrap", minWidth: 80,
              }}>
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedStudents.map((stu, rIdx) => {
              const overall = overallGrades[stu.studentId]?.overall;
              const oc = overallColor(overall);
              const stickyBg = rIdx % 2 === 0 ? BG : "#1e1f21";
              return (
                <tr key={stu.studentId} style={{ background: rIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  {/* Student name — sticky left */}
                  <td style={{
                    position: "sticky", left: 0, zIndex: 2, background: stickyBg,
                    padding: "8px 14px", fontSize: 13, color: "#fff", fontWeight: 500,
                    borderRight: CELL_BORDER, borderBottom: CELL_BORDER, whiteSpace: "nowrap",
                  }}>
                    {stu.altName || stu.fullName}
                  </td>

                  {/* Score cells */}
                  {displayedAssignments.map(a => {
                    const score = scoreMap[stu.studentId]?.[a.id];
                    const isExcused = !!excusedMap[stu.studentId]?.[a.id];
                    const isMissing = score == null && !isExcused;
                    const isEditing = editingCell?.studentId === stu.studentId && editingCell?.assignmentId === a.id;

                    if (isEditing) {
                      return (
                        <td key={a.id} style={{
                          padding: 0, borderRight: CELL_BORDER, borderBottom: CELL_BORDER,
                          background: `${TEAL}1a`, outline: `2px solid ${TEAL}`, outlineOffset: -2,
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

                    return (
                      <td
                        key={a.id}
                        onClick={() => handleCellClick(stu.studentId, a.id)}
                        title={isExcused ? "Excused — click to edit" : isMissing ? "No submission — click to override" : `${score}/10 — click to edit`}
                        style={{
                          background: cellBg(score, isExcused, isMissing),
                          color: cellFg(score, isExcused, isMissing),
                          borderRight: CELL_BORDER, borderBottom: CELL_BORDER,
                          textAlign: "center", padding: "8px 4px",
                          fontSize: 13, fontFamily: "monospace", cursor: "pointer",
                        }}
                      >
                        {isExcused ? "EX" : isMissing ? "–" : score}
                      </td>
                    );
                  })}

                  {/* Overall % — sticky right */}
                  <td style={{
                    position: "sticky", right: 0, zIndex: 2, background: stickyBg,
                    padding: "8px 14px", textAlign: "center",
                    fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: oc,
                    borderLeft: CELL_BORDER, borderBottom: CELL_BORDER,
                  }}>
                    {overall != null ? overall.toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          onExcuse={excuseCell}
          onUnexcuse={unexcuseCell}
          onViewSub={() => {
            const { studentId, assignmentId } = editingCell;
            const stu = (roster || []).find(r => r.studentId === studentId);
            const asgn = (assignments || []).find(a => a.id === assignmentId);
            const sub = (submissions || []).find(s => s.studentId === studentId && s.quizId === assignmentId);
            if (sub) setViewSubModal({ submission: sub, studentName: stu?.altName || stu?.fullName, assignmentTitle: asgn?.title });
          }}
          onSaveDueDate={saveDueDate}
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
      {viewSubModal && (
        <SubViewModal
          submission={viewSubModal.submission}
          studentName={viewSubModal.studentName}
          assignmentTitle={viewSubModal.assignmentTitle}
          onClose={() => setViewSubModal(null)}
        />
      )}
    </div>
  );
}
