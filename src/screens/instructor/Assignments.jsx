import { useState } from "react";
import { useTheme } from "../../theme.js";
import { HW_GRADING_DEFAULTS } from "../../homework.js";

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

const FIELDS = [
  { key: "freeAttempts",     label: "Free attempts",      help: "Attempts 1 – N earn full credit",                               isInt: true,  min: 1, max: null, step: 1 },
  { key: "hintAfterAttempt", label: "Hint after attempt", help: "Hint shown on failure at this attempt number",                  isInt: true,  min: 1, max: null, step: 1 },
  { key: "hintCredit",       label: "Hint credit",        help: "Credit multiplier after free attempts (e.g. 0.8 = 80%)",        isInt: false, min: 0.01, max: 1, step: 0.01 },
  { key: "maxAttempts",      label: "Max attempts",       help: "Answer revealed when attempt count reaches this value",          isInt: true,  min: 1, max: null, step: 1 },
  { key: "revealCredit",     label: "Reveal credit",      help: "Credit when answer is force-revealed (e.g. 0 = 0%, 0.5 = 50%)", isInt: false, min: 0, max: 1, step: 0.01 },
  { key: "numericTolerance", label: "Numeric tolerance",  help: "±fractional tolerance (e.g. 0.02 = 2%); per-problem overrides this", isInt: false, min: 0, max: 1, step: 0.001 },
];

function validateDraft(d) {
  const fa = Number(d.freeAttempts), ha = Number(d.hintAfterAttempt), ma = Number(d.maxAttempts);
  const hc = Number(d.hintCredit), rc = Number(d.revealCredit), nt = Number(d.numericTolerance);
  if (!Number.isInteger(fa) || fa < 1) return "Free attempts must be a whole number ≥ 1.";
  if (!Number.isInteger(ha) || ha < 1) return "Hint after attempt must be a whole number ≥ 1.";
  if (!Number.isInteger(ma) || ma < 1) return "Max attempts must be a whole number ≥ 1.";
  if (ha > ma) return "Hint after attempt must be ≤ max attempts.";
  if (fa > ma) return "Free attempts must be ≤ max attempts.";
  if (hc <= 0 || hc > 1) return "Hint credit must be between 0 (exclusive) and 1.";
  if (rc < 0 || rc > 1) return "Reveal credit must be between 0 and 1.";
  if (nt < 0 || nt > 1) return "Numeric tolerance must be between 0 and 1.";
  return null;
}

function HwGradingModal({ hwTitle, draft: initialDraft, isOverridden, onClose, onSave, onReset }) {
  const { s, text, muted, border, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  const [draft, setDraft] = useState({ ...initialDraft });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const handleSave = async () => {
    const err = validateDraft(draft);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await onSave({
        freeAttempts:     parseInt(draft.freeAttempts),
        hintAfterAttempt: parseInt(draft.hintAfterAttempt),
        hintCredit:       parseFloat(parseFloat(draft.hintCredit).toFixed(4)),
        maxAttempts:      parseInt(draft.maxAttempts),
        revealCredit:     parseFloat(parseFloat(draft.revealCredit).toFixed(4)),
        numericTolerance: parseFloat(parseFloat(draft.numericTolerance).toFixed(6)),
      });
    } catch (e) {
      setError(e?.message || "Save failed.");
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    try { await onReset(); }
    catch (e) { setError(e?.message || "Reset failed."); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>Grading Settings</h3>
          <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{hwTitle}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
          {FIELDS.map(f => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: text, fontSize: 12, fontWeight: 600 }}>{f.label}</label>
              <input
                type="number"
                value={draft[f.key]}
                onChange={e => set(f.key, f.isInt ? e.target.value : e.target.value)}
                min={f.min}
                max={f.max ?? undefined}
                step={f.step}
                style={{ ...s.input, padding: "5px 8px", fontSize: 13, height: "auto" }}
              />
              <span style={{ color: muted, fontSize: 11, lineHeight: 1.4 }}>{f.help}</span>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: 13, margin: 0, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "8px 12px" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button
            onClick={handleReset}
            disabled={saving || !isOverridden}
            style={{ ...s.btnGhost, width: "auto", padding: "8px 14px", fontSize: 13, color: "#f87171", borderColor: "#f8717155", opacity: isOverridden ? 1 : 0.4 }}
          >
            Reset to defaults
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} disabled={saving} style={{ ...s.btnSec, width: "auto", padding: "8px 16px" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...s.btnPri, width: "auto", padding: "8px 20px" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Assignments({ quizzes, homeworks = [], customQuizzes, dueDates, homeworkSettings, onSaveDueDates, onSaveHomeworkSettings, onEditCustomQuiz, onCreateQuiz, onDeleteCustomQuiz }) {
  const { s, text, muted, border } = useTheme();

  const [filterText, setFilterText] = useState("");
  const [filterTypes, setFilterTypes] = useState(new Set());
  const [sort, setSort] = useState("name-asc");
  const [editingHwSettings, setEditingHwSettings] = useState(null);
  // null | { hwId: string, title: string, draft: { ...grading fields } }

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
            gridTemplateColumns: "1fr 80px 190px 160px",
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
            const hasOverride = q._type === "homework" && !!(homeworkSettings?.[q.id]);
            return (
              <div
                key={q.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 190px 160px",
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
                  {q._type === "homework" && (
                    <button
                      onClick={() => setEditingHwSettings({ hwId: q.id, title: q.title, draft: { ...(q.grading || HW_GRADING_DEFAULTS) } })}
                      style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 12, ...(hasOverride ? { color: "#60a5fa", borderColor: "#60a5fa55" } : {}) }}
                      title={hasOverride ? "Custom grading settings active" : "Edit grading settings"}
                    >
                      {hasOverride ? "⚙ Custom" : "⚙ Settings"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingHwSettings && (
        <HwGradingModal
          hwTitle={editingHwSettings.title}
          draft={editingHwSettings.draft}
          isOverridden={!!homeworkSettings?.[editingHwSettings.hwId]}
          onClose={() => setEditingHwSettings(null)}
          onSave={async values => {
            await onSaveHomeworkSettings(editingHwSettings.hwId, values);
            setEditingHwSettings(null);
          }}
          onReset={async () => {
            await onSaveHomeworkSettings(editingHwSettings.hwId, null);
            setEditingHwSettings(null);
          }}
        />
      )}
    </div>
  );
}
