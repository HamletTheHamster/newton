import { useState } from "react";
import { useTheme } from "../../theme.js";

const QUIZ_COLOR = "#34d399";
const HW_COLOR = "#60a5fa";
const TYPE_META = { quiz: { label: "Quiz", color: QUIZ_COLOR }, homework: { label: "Homework", color: HW_COLOR } };
const TYPES = [{ id: "quiz", label: "Quiz", color: QUIZ_COLOR }, { id: "homework", label: "Homework", color: HW_COLOR }];

function formatDt(raw) {
  if (!raw) return "";
  // "YYYY-MM-DD HH:MM" → datetime-local value "YYYY-MM-DDTHH:MM"
  return raw.replace(" ", "T");
}

function parseDt(dtLocal) {
  if (!dtLocal) return "";
  // "YYYY-MM-DDTHH:MM" → "YYYY-MM-DD HH:MM"
  return dtLocal.replace("T", " ");
}

export function Assignments({ quizzes, homeworks = [], customQuizzes, dueDates, onSaveDueDates, onEditCustomQuiz, onCreateQuiz, onDeleteCustomQuiz }) {
  const { s, text, muted, border } = useTheme();

  const [filterText, setFilterText] = useState("");
  const [filterTypes, setFilterTypes] = useState(new Set());
  const [sort, setSort] = useState("name-asc");

  const toggleType = id => setFilterTypes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const hasFilter = filterText || filterTypes.size > 0 || sort !== "name-asc";
  const canClear = filterText || filterTypes.size > 0;

  const allAssignments = [
    ...(quizzes || []).map(q => ({ ...q, _type: "quiz" })),
    ...(homeworks || []).map(h => ({ ...h, _type: "homework" })),
  ];

  const displayed = allAssignments
    .filter(q =>
      (!filterText || q.title.toLowerCase().includes(filterText.toLowerCase())) &&
      (filterTypes.size === 0 || filterTypes.has(q._type))
    )
    .sort((a, b) => {
      if (sort === "name-asc") return a.title.localeCompare(b.title, undefined, { numeric: true });
      if (sort === "name-desc") return b.title.localeCompare(a.title, undefined, { numeric: true });
      const da = a.dueDate ? new Date(a.dueDate) : null;
      const db = b.dueDate ? new Date(b.dueDate) : null;
      if (sort === "due-asc") {
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      }
      if (sort === "due-desc") {
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      }
      return 0;
    });

  const setDueDate = (quizId, value) => {
    const updated = { ...dueDates };
    if (value) updated[quizId] = parseDt(value);
    else delete updated[quizId];
    onSaveDueDates(updated);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: 0 }}>Assignments</h2>
        <button onClick={onCreateQuiz} style={{ ...s.btnPri, width: "auto", padding: "8px 16px" }}>+ New Quiz</button>
      </div>

      {/* Filter bar */}
      <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Search assignments…"
          style={{ ...s.input, flex: "1 1 140px", padding: "5px 10px", fontSize: 12, height: "auto" }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => toggleType(t.id)}
              style={{
                ...s.badge(t.color),
                cursor: "pointer",
                padding: "3px 10px",
                fontSize: 11,
                border: filterTypes.has(t.id) ? `1px solid ${t.color}` : `1px solid ${t.color}44`,
                opacity: filterTypes.has(t.id) || filterTypes.size === 0 ? 1 : 0.4,
                background: "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{ ...s.input, width: "auto", padding: "5px 10px", fontSize: 12, height: "auto" }}
        >
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="due-asc">Due (Earliest)</option>
          <option value="due-desc">Due (Latest)</option>
        </select>
        <button
          onClick={() => { setFilterText(""); setFilterTypes(new Set()); }}
          style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 12, opacity: canClear ? 1 : 0, pointerEvents: canClear ? "auto" : "none" }}
        >
          Clear
        </button>
      </div>

      {/* Count */}
      {allAssignments.length > 0 && (
        <p style={{ color: muted, fontSize: 12, margin: "0 0 8px" }}>
          {displayed.length}/{allAssignments.length} assignments
        </p>
      )}

      {/* Table */}
      {displayed.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
          {allAssignments.length === 0
            ? "No assignments yet. Create your first quiz above."
            : "No assignments match your search."}
        </div>
      ) : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 190px 130px",
            gap: 8,
            padding: "8px 14px",
            borderBottom: `1px solid ${border}`,
            fontSize: 11,
            fontWeight: 600,
            color: muted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            <span>Title</span>
            <span>Type</span>
            <span>Due Date</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {displayed.map((q, i) => {
            const isCustom = q._type === "quiz" && !!(customQuizzes && customQuizzes[q.id]);
            const tm = TYPE_META[q._type] || TYPE_META.quiz;
            return (
              <div
                key={q.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 190px 130px",
                  gap: 8,
                  padding: "10px 14px",
                  alignItems: "center",
                  borderBottom: i < displayed.length - 1 ? `1px solid ${border}` : "none",
                }}
              >
                {/* Title */}
                <span style={{ color: text, fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{q.title}</span>

                {/* Type badge */}
                <span style={{ ...s.badge(tm.color), fontSize: 11 }}>{tm.label}</span>

                {/* Due date */}
                <input
                  type="datetime-local"
                  value={formatDt(dueDates[q.id] || "")}
                  onChange={e => setDueDate(q.id, e.target.value)}
                  style={{ ...s.input, padding: "4px 8px", fontSize: 12, height: "auto" }}
                />

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {isCustom && (
                    <>
                      <button
                        onClick={() => onEditCustomQuiz(q.id)}
                        style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 12 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
                          await onDeleteCustomQuiz(q.id);
                        }}
                        style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 12, color: "#f87171", borderColor: "#f8717144" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
