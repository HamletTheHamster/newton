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
function EditCell({ score, isExcused, hasSubmission, onScoreChange, onToggleExcused, onViewSub, onCommit, onCancel }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 4px", minWidth: 70 }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={isExcused ? "" : score}
        disabled={isExcused}
        onChange={e => onScoreChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={onCommit}
        style={{ width: 36, background: "transparent", border: "none", color: isExcused ? MUTED : "#fff", fontSize: 13, fontFamily: "monospace", textAlign: "center", outline: "none" }}
      />
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={onToggleExcused}
        title={isExcused ? "Remove excused" : "Mark as excused"}
        style={{ background: isExcused ? TEAL : "rgba(255,255,255,0.1)", border: "none", borderRadius: 3, color: isExcused ? "#fff" : MUTED, fontSize: 9, fontWeight: 700, cursor: "pointer", padding: "2px 5px", lineHeight: 1.5, flexShrink: 0 }}
      >
        EX
      </button>
      {hasSubmission && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={onViewSub}
          title="View submission"
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 3, color: MUTED, fontSize: 11, cursor: "pointer", padding: "2px 6px", lineHeight: 1.5, flexShrink: 0 }}
        >
          →
        </button>
      )}
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
                  type="number" min="0" max="100"
                  value={cat.weight}
                  onChange={e => updateCat(cat.id, "weight", Number(e.target.value) || 0)}
                  style={{ ...s.input, width: 52, padding: "6px 6px", fontSize: 13, textAlign: "center", height: "auto" }}
                />
                <span style={{ color: MUTED, fontSize: 12 }}>%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <input
                  type="number" min="0" max="10"
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
                type="number" min="0" max="100"
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
  onSaveGradeCategories,
  onSaveOverrideForStudent,
  onSaveAssignmentCategories,
  onSaveManualAssignments,
  onSaveAssignmentNameOverrides,
}) {
  const [editingCell, setEditingCell] = useState(null); // { studentId, assignmentId }
  const [editScore, setEditScore] = useState("");
  const [editExcused, setEditExcused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewSubModal, setViewSubModal] = useState(null); // { submission, studentName, assignmentTitle }
  const [catDropdownFor, setCatDropdownFor] = useState(null); // assignmentId
  const [editingAssignmentTitle, setEditingAssignmentTitle] = useState(null);
  const [assignmentTitleDraft, setAssignmentTitleDraft] = useState("");
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState("");
  const [newAsgCat, setNewAsgCat] = useState("cat_quiz");

  const assignments = buildGradebookAssignments(modules, quizzes, assignmentCategories, manualAssignments, assignmentNameOverrides);

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
    const isExc = !!(excusedMap[studentId]?.[assignmentId]);
    const sc = scoreMap[studentId]?.[assignmentId];
    setEditingCell({ studentId, assignmentId });
    setEditScore(sc != null ? String(sc) : "");
    setEditExcused(isExc);
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { studentId, assignmentId } = editingCell;
    setEditingCell(null);
    const current = { ...(gradeOverrides[studentId] || {}) };
    if (editExcused) {
      current[assignmentId] = { excused: true };
    } else {
      const parsed = parseFloat(editScore);
      if (!isNaN(parsed)) {
        current[assignmentId] = { score: Math.max(0, Math.min(10, parsed)) };
      } else {
        delete current[assignmentId]; // clear override → revert to submission score
      }
    }
    await onSaveOverrideForStudent(studentId, current);
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

  const headerBar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0 }}>Gradebook</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {roster?.length > 0 && <span style={{ color: MUTED, fontSize: 12 }}>{roster.length} students · {assignments.length} assignments</span>}
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
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No students enrolled in this class yet.</div>
        {showSettings && <GradeSettingsModal gradeCategories={gradeCategories} onSave={onSaveGradeCategories} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return (
    <div>
      {headerBar}

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

      {/* Scrollable gradebook table */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 180px)", borderRadius: 8, border: CELL_BORDER }}>
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
              {assignments.map(a => {
                const isDropping = catDropdownFor === a.id;
                return (
                  <th key={a.id} style={{
                    position: "sticky", top: 0, zIndex: 3, background: BG,
                    padding: "6px 4px", textAlign: "center",
                    borderBottom: CELL_BORDER, borderRight: CELL_BORDER,
                    minWidth: 72, maxWidth: 72, verticalAlign: "bottom",
                  }}>
                    {editingAssignmentTitle === a.id ? (
                      <input
                        autoFocus value={assignmentTitleDraft}
                        onChange={e => setAssignmentTitleDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitAssignmentTitle(a.id); if (e.key === "Escape") setEditingAssignmentTitle(null); }}
                        onBlur={() => commitAssignmentTitle(a.id)}
                        style={{ width: 62, fontSize: 10, background: "transparent", border: `1px solid ${TEAL}`, color: "#fff", borderRadius: 3, padding: "1px 3px", outline: "none", textAlign: "center" }}
                      />
                    ) : (
                      <div onClick={() => { setEditingAssignmentTitle(a.id); setAssignmentTitleDraft(a.title); }} style={{ fontSize: 11, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 66, margin: "0 auto 2px", cursor: "text" }} title={`Click to rename · ${a.title}`}>
                        {a.title.replace(/^Quiz\s+(\d+):.*/, "Q$1").replace(/^Homework\s+(\d+):.*/, "HW$1")}
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
                        style={{ ...s.badge(catColor(a.catId)), cursor: "pointer", fontSize: 9, padding: "1px 5px", maxWidth: 66, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={`${gradeCategories[a.catId]?.name || a.catId} — click to change`}
                      >
                        {gradeCategories[a.catId]?.name || a.catId}
                      </span>
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
            {(roster || []).map((stu, rIdx) => {
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
                  {assignments.map(a => {
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
                            isExcused={editExcused}
                            hasSubmission={(submissions || []).some(s => s.studentId === stu.studentId && s.quizId === a.id)}
                            onScoreChange={setEditScore}
                            onToggleExcused={() => setEditExcused(ex => !ex)}
                            onViewSub={() => {
                              const sub = (submissions || []).find(s => s.studentId === stu.studentId && s.quizId === a.id);
                              if (sub) setViewSubModal({ submission: sub, studentName: stu.altName || stu.fullName, assignmentTitle: a.title });
                            }}
                            onCommit={commitEdit}
                            onCancel={() => setEditingCell(null)}
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
