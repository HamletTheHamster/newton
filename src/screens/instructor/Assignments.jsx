import { useState, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { HW_GRADING_DEFAULTS } from "../../homework.js";
import { dueToDate, useIsMobile } from "../../utils.js";
import { categoryColor } from "../../category-colors.js";
import { fbGet, classPath } from "../../firebase.js";
import { DueDateField } from "../../components/lms/DueDateField.jsx";

// Row types are "quiz", "homework", and — for manual assignments (exams, labs) — the
// assignment's gradebook category id, so each category filters and colors separately.
// Colors come from the shared palette, never redeclared here.
const QUIZ_COLOR = categoryColor("cat_quiz");
const HW_COLOR = categoryColor("cat_hw");
const BASE_TYPES = [{ id: "quiz", label: "Quiz", color: QUIZ_COLOR }, { id: "homework", label: "Homework", color: HW_COLOR }];

// Title · Type · Points · Due Date · Progress · Actions. The Due Date column holds
// DueDateField's row layout: date (128) + time (96) + "Past due"/"Active" badge, plus its 6px
// gaps — it must stay ≥ 310 or the badge wraps to a second line.
// The other four are right-sized to their widest real content: a "Midterm Exam" category
// badge, a 3-digit points input, and — this is the space that looks empty on most rows —
// an Edit + Delete pair, which only custom quizzes have but which Actions must still fit.
// Progress holds just a 44px bar + percentage, so what is left goes to the title, which needs
// ~215px to keep the longest real title ("Homework 5: Current, Resistance, & Electromotive
// Force") to two lines rather than three.
// These fixed columns total ~720px, so they only apply above the mobile breakpoint — narrower
// than that the table becomes a stacked card list (see `isMobile` below).
const GRID_COLS = "1fr 104px 56px 312px 88px 124px";
// 6, not the usual 8: the five gaps are 10px of the title's budget, and the title needs 212px
// to keep the longest real title to two lines (measured, not estimated). Header and rows read
// the same constant so the columns cannot fall out of alignment.
const GRID_GAP = 6;

// Small uppercase field label, mobile cards only (the desktop table has column headers instead).
const CARD_LABEL = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };

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

// ── Homework progress ─────────────────────────────────────────────────────────
// Reads classes/{classId}/hwProgress — a tiny per-student summary ({ done, total, pct,
// updatedAt }) that HomeworkRunner writes beside each draft. Deliberately NOT the draft
// itself: a draft carries every typed answer, every feedback string and the whole Claude
// history per item, none of which belongs in the instructor's browser to compute a
// percentage. A student who has submitted has no draft (it is cleared on final submit), so
// their submission stands in as 100%.
const DONE_COLOR = "#4ade80";
// Finished every problem but never pressed Finish & Submit — the row worth chasing, since
// nothing has been handed in and the gradebook still reads as missing.
const STALLED_COLOR = "#fbbf24";

// "just now" / "14 min ago" / "3 hr ago" / "2 days ago" / "Aug 22" for older than a week.
function fmtSince(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtExact(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  return isNaN(t) ? null : t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ProgressBar({ pct, color, width = "100%", height = 5 }) {
  const { isLight } = useTheme();
  return (
    <div style={{ width, height, borderRadius: height, flexShrink: 0, overflow: "hidden", background: isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.12)" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: height, background: color, transition: "width 0.2s" }} />
    </div>
  );
}

// The Progress column cell. Clicking it opens the per-student breakdown. Quizzes and manual
// assignments have no partial progress, so their cell is the plain no-data hyphen.
function ProgressCell({ summary, loading, onClick }) {
  const { muted, teal, text } = useTheme();
  if (loading) return <span style={{ color: muted, fontSize: 11 }}>Loading…</span>;
  if (!summary) return <span style={{ color: muted, fontSize: 12 }}>-</span>;
  if (summary.count === 0) return <span style={{ color: muted, fontSize: 11 }}>No students</span>;

  const since = fmtSince(summary.lastWorked);
  const barColor = summary.avg >= 100 ? DONE_COLOR : teal;
  // Bar + percentage only. The started count and last-worked time are one hover away and laid
  // out in full in the modal, and printing them here cost three lines of row height plus the
  // column width that the title needs more.
  return (
    <button
      onClick={onClick}
      title={`${summary.started}/${summary.count} started${since ? ` · last worked ${since}` : ""} · click for each student`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", padding: 0,
        cursor: "pointer", textAlign: "left", width: "100%", font: "inherit",
      }}
    >
      <ProgressBar pct={summary.avg} color={barColor} width={44} />
      <span style={{ color: text, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{summary.avg}%</span>
    </button>
  );
}

// Per-student breakdown, least progress first: the actionable order when you are deciding
// whether to extend a deadline or spend class time on the set.
function ProgressModal({ title, rows, summary, onClose }) {
  const { s, text, muted, border, teal, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 560, maxHeight: "82vh", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>Class progress</h3>
          <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{title}</p>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}` }}>
          {[
            { label: "Average", value: `${summary.avg}%` },
            { label: "Started", value: `${summary.started} of ${summary.count}` },
            { label: "Submitted", value: `${summary.submitted} of ${summary.count}` },
            { label: "Last worked", value: fmtSince(summary.lastWorked) || "-" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ ...CARD_LABEL, color: muted }}>{f.label}</span>
              <span style={{ color: text, fontSize: 13, fontWeight: 600 }}>{f.value}</span>
            </div>
          ))}
        </div>

        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {rows.length === 0 && <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>No students enrolled.</p>}
          {rows.map((r, i) => (
            <div
              key={r.studentId}
              style={{
                display: "grid", gridTemplateColumns: "1fr 90px 44px 96px", gap: 10,
                alignItems: "center", padding: "8px 2px",
                borderBottom: i < rows.length - 1 ? `1px solid ${border}` : "none",
              }}
            >
              <span style={{ color: text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <ProgressBar pct={r.pct} color={r.submitted ? DONE_COLOR : r.pct > 0 ? teal : muted} />
              <span
                style={{ color: r.stalled ? STALLED_COLOR : r.pct > 0 ? text : muted, fontSize: 12, fontFamily: "monospace", textAlign: "right" }}
                title={r.stalled ? "Every problem finished, but not submitted yet" : ""}
              >
                {r.pct}%
              </span>
              <span style={{ color: muted, fontSize: 11, textAlign: "right" }} title={fmtExact(r.at) || ""}>
                {r.submitted ? "Submitted" : fmtSince(r.at) || "-"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...s.btnSec, width: "auto", padding: "8px 20px" }}>Close</button>
        </div>
      </div>
    </div>
  );
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

export function Assignments({ classId, roster = [], submissions = [], quizzes, homeworks = [], manualAssignments = {}, gradeCategories = {}, customQuizzes, dueDates, homeworkSettings, onSaveDueDates, onSaveHomeworkSettings, onSaveManualAssignments, onEditCustomQuiz, onCreateQuiz, onDeleteCustomQuiz }) {
  const { s, text, muted, border } = useTheme();
  const isMobile = useIsMobile();

  const [filterText, setFilterText] = useState("");
  const [filterTypes, setFilterTypes] = useState(new Set());
  const [sort, setSort] = useState("name-asc");
  const [editingHwSettings, setEditingHwSettings] = useState(null);
  // null | { hwId: string, title: string, draft: { ...grading fields } }
  const [ptsDraft, setPtsDraft] = useState({});   // { [assignmentId]: typed string }, committed on blur/Enter
  const [progress, setProgress] = useState(null); // { [studentId]: { [hwId]: { done, total, pct, updatedAt } } }; null while loading
  const [progressDetail, setProgressDetail] = useState(null); // null | { hwId, title }

  // One small read for the whole class. hwProgress is per-student, so like hwDrafts and
  // hwAttempts it stays out of the App.jsx class cache and is fetched on demand here.
  useEffect(() => {
    if (!classId) { setProgress({}); return; }
    let cancelled = false;
    setProgress(null);
    fbGet(classPath(classId, "hwProgress"))
      .then(d => { if (!cancelled) setProgress(d && typeof d === "object" ? d : {}); })
      .catch(() => { if (!cancelled) setProgress({}); });
    return () => { cancelled = true; };
  }, [classId]);

  // Per-student rows for one homework, merging the two sources of truth: a submitted student
  // is 100% (their draft, and its progress record, are cleared on final submit), everyone
  // else comes from hwProgress. A student with neither has not started.
  // Indexed once per render rather than scanned per (student, homework) pair: the lookup runs
  // roster x homework times, and a mid-term submissions list is long.
  const subByKey = {};
  (submissions || []).forEach(x => { subByKey[`${x.studentId}|${x.quizId}`] = x; });

  const progressRows = hwId => (roster || []).map(r => {
    const name = r.altName || r.fullName || r.studentId;
    const sub = subByKey[`${r.studentId}|${hwId}`];
    if (sub) return { studentId: r.studentId, name, pct: 100, submitted: true, at: sub.timestamp || null };
    const rec = (progress || {})[r.studentId]?.[hwId];
    const pct = rec && rec.total > 0 ? (rec.pct ?? Math.round((rec.done / rec.total) * 100)) : 0;
    return { studentId: r.studentId, name, pct, submitted: false, stalled: pct >= 100, at: rec?.updatedAt || null };
  }).sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));

  // "Started" counts anyone with a submission or any recorded progress. A progress record is
  // written on the first submitted attempt or on leaving with something typed, so a student
  // who has worked the set but resolved nothing still reads as started at 0%; one who merely
  // opened it and walked away does not. The average is over the WHOLE roster, unstarted
  // students included: that is the class-readiness number, not the average among the keen.
  const progressSummary = hwId => {
    const rows = progressRows(hwId);
    const count = rows.length;
    const started = rows.filter(r => r.submitted || r.at).length;
    const submitted = rows.filter(r => r.submitted).length;
    const avg = count ? Math.round(rows.reduce((sum, r) => sum + r.pct, 0) / count) : 0;
    const stamps = rows.map(r => r.at).filter(Boolean).sort();
    return { count, started, submitted, avg, lastWorked: stamps.length ? stamps[stamps.length - 1] : null, rows };
  };

  const toggleType = id => setFilterTypes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const hasFilter = filterText || filterTypes.size > 0 || sort !== "name-asc";
  const canClear = filterText || filterTypes.size > 0;

  // Manual assignments (exams, labs) live only in the gradebook — nothing to open and no
  // submission — but they still need a date so they reach the calendar and To Do rail, and
  // their own max points (exams are /100, labs /10).
  const manualList = Object.values(manualAssignments || {}).filter(Boolean)
    .map(ma => ({ id: ma.id, title: ma.title, maxPts: ma.maxPts || 10, dueDate: (dueDates || {})[ma.id] || null, _type: ma.catId || "cat_quiz", _manual: true }));

  const allAssignments = [
    ...(quizzes || []).map(q => ({ ...q, _type: "quiz", maxPts: 10 })),
    ...(homeworks || []).map(h => ({ ...h, _type: "homework", maxPts: 10 })),
    ...manualList,
  ];

  // Quiz and homework chips are fixed; every manual category present gets its own chip, so
  // 28 labs can be filtered away from the two exams.
  const manualTypeIds = [...new Set(manualList.map(m => m._type))]
    .sort((a, b) => (gradeCategories[a]?.order ?? 99) - (gradeCategories[b]?.order ?? 99));
  const TYPES = [
    ...BASE_TYPES,
    ...manualTypeIds.map(id => ({ id, label: gradeCategories[id]?.name || id, color: categoryColor(id, muted) })),
  ];
  const typeMeta = id => TYPES.find(t => t.id === id) || TYPES[0];

  const displayed = allAssignments
    .filter(q =>
      (!filterText || q.title.toLowerCase().includes(filterText.toLowerCase())) &&
      (filterTypes.size === 0 || filterTypes.has(q._type))
    )
    .sort((a, b) => {
      if (sort === "name-asc") return a.title.localeCompare(b.title, undefined, { numeric: true });
      if (sort === "name-desc") return b.title.localeCompare(a.title, undefined, { numeric: true });
      // dueToDate understands both stored shapes and the ET convention; `new Date` does not.
      const da = a.dueDate ? dueToDate(a.dueDate) : null;
      const db = b.dueDate ? dueToDate(b.dueDate) : null;
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

  // `value` is already in stored form ("YYYY-MM-DD" or "YYYY-MM-DD HH:MM"), or null to clear.
  const setDueDate = (quizId, value) => {
    const updated = { ...dueDates };
    if (value) updated[quizId] = value;
    else delete updated[quizId];
    onSaveDueDates(updated);
  };

  // Max points, manual assignments only (quizzes and homework are /10 by the grading engine).
  // `maxPtsSet` records that the instructor chose this value, so the one-time exam migration
  // in App.jsx leaves it alone from here on.
  const commitMaxPts = id => {
    const draft = ptsDraft[id];
    setPtsDraft(d => { const { [id]: _, ...rest } = d; return rest; });
    const ma = (manualAssignments || {})[id];
    const n = parseFloat(draft);
    if (!ma || draft === undefined || !isFinite(n) || n <= 0 || n === ma.maxPts) return;
    onSaveManualAssignments({ ...manualAssignments, [id]: { ...ma, maxPts: n, maxPtsSet: true } });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: 0 }}>Assignments</h2>
        <button onClick={onCreateQuiz} style={{ ...s.btnPri, width: "auto", padding: "8px 16px" }}>+ New Quiz</button>
      </div>

      {/* Filter bar — on mobile the search box takes its own row and the sort select stretches,
          so the chips have the full width to wrap into instead of being squeezed. */}
      <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Search assignments…"
          style={{ ...s.input, flex: isMobile ? "1 1 100%" : "1 1 140px", padding: isMobile ? "8px 10px" : "5px 10px", fontSize: 12, height: "auto" }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => toggleType(t.id)}
              style={{
                ...s.badge(t.color),
                cursor: "pointer",
                padding: isMobile ? "6px 12px" : "3px 10px",
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
          style={{ ...s.input, width: "auto", flex: isMobile ? "1 1 140px" : "0 0 auto", padding: isMobile ? "8px 10px" : "5px 10px", fontSize: 12, height: "auto" }}
        >
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="due-asc">Due (Earliest)</option>
          <option value="due-desc">Due (Latest)</option>
        </select>
        <button
          onClick={() => { setFilterText(""); setFilterTypes(new Set()); }}
          style={{ ...s.btnGhost, width: "auto", padding: isMobile ? "8px 14px" : "5px 12px", fontSize: 12, display: !canClear && isMobile ? "none" : undefined, opacity: canClear ? 1 : 0, pointerEvents: canClear ? "auto" : "none" }}
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
          {/* Column headers — desktop only; the mobile cards label their own fields */}
          {!isMobile && (
            <div style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              gap: GRID_GAP,
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
              <span>Points</span>
              <span>Due Date</span>
              <span>Progress</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
          )}

          {displayed.map((q, i) => {
            const isCustom = q._type === "quiz" && !!(customQuizzes && customQuizzes[q.id]);
            const tm = typeMeta(q._type);
            const hasOverride = q._type === "homework" && !!(homeworkSettings?.[q.id]);
            const rowBorder = i < displayed.length - 1 ? `1px solid ${border}` : "none";
            // One set of cells, two layouts: a grid row on desktop, a stacked card on mobile.
            const btn = { ...s.btnGhost, width: "auto", padding: isMobile ? "7px 14px" : "5px 12px", fontSize: 12 };

            const badgeEl = (
              <span style={{ ...s.badge(tm.color), fontSize: 11, justifySelf: "start", whiteSpace: "nowrap" }}>{tm.label}</span>
            );

            // Homework only: quizzes are all-or-nothing and manual assignments (exams, labs)
            // have no submission at all, so neither has partial progress to report.
            const isHw = q._type === "homework";
            const progressEl = (
              <ProgressCell
                summary={isHw && progress !== null ? progressSummary(q.id) : null}
                loading={isHw && progress === null}
                onClick={() => setProgressDetail({ hwId: q.id, title: q.title })}
              />
            );

            // Max points — editable for manual assignments, fixed at 10 for quizzes/homework
            const pointsEl = q._manual ? (
              <input
                type="number" min="1" step="1"
                value={ptsDraft[q.id] ?? String(q.maxPts)}
                onChange={e => setPtsDraft(d => ({ ...d, [q.id]: e.target.value }))}
                onBlur={() => commitMaxPts(q.id)}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                title="Points this assignment is graded out of"
                style={{ ...s.input, padding: isMobile ? "6px 8px" : "4px 6px", fontSize: 12, height: "auto", width: isMobile ? 76 : "100%" }}
              />
            ) : (
              <span style={{ color: muted, fontSize: 12 }}>10</span>
            );

            // Due date — the same control as the Modules editor on the Home tab
            const dueEl = (
              <DueDateField
                value={dueDates[q.id] || null}
                onChange={next => setDueDate(q.id, next)}
                direction="row"
              />
            );

            const actionBtns = [];
            if (isCustom) {
              actionBtns.push(
                <button key="edit" onClick={() => onEditCustomQuiz(q.id)} style={btn}>Edit</button>,
                <button
                  key="del"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
                    await onDeleteCustomQuiz(q.id);
                  }}
                  style={{ ...btn, color: "#f87171", borderColor: "#f8717144" }}
                >
                  Delete
                </button>
              );
            }
            if (q._type === "homework") {
              actionBtns.push(
                <button
                  key="settings"
                  onClick={() => setEditingHwSettings({ hwId: q.id, title: q.title, draft: { ...(q.grading || HW_GRADING_DEFAULTS) } })}
                  style={{ ...btn, ...(hasOverride ? { color: "#60a5fa", borderColor: "#60a5fa55" } : {}) }}
                  title={hasOverride ? "Custom grading settings active" : "Edit grading settings"}
                >
                  {hasOverride ? "⚙ Custom" : "⚙ Settings"}
                </button>
              );
            }

            if (isMobile) {
              return (
                <div
                  key={q.id}
                  style={{ padding: "12px 14px", borderBottom: rowBorder, display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
                    <span style={{ color: text, fontSize: 14, fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word" }}>{q.title}</span>
                    {badgeEl}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...CARD_LABEL, color: muted }}>Points</span>
                    {pointsEl}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ ...CARD_LABEL, color: muted }}>Due</span>
                    {dueEl}
                  </div>

                  {isHw && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ ...CARD_LABEL, color: muted }}>Progress</span>
                      {progressEl}
                    </div>
                  )}

                  {actionBtns.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actionBtns}</div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={q.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID_COLS,
                  gap: GRID_GAP,
                  padding: "10px 14px",
                  alignItems: "center",
                  borderBottom: rowBorder,
                }}
              >
                <span style={{ color: text, fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{q.title}</span>
                {badgeEl}
                {pointsEl}
                {dueEl}
                {progressEl}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{actionBtns}</div>
              </div>
            );
          })}
        </div>
      )}

      {progressDetail && (() => {
        const sm = progressSummary(progressDetail.hwId);
        return (
          <ProgressModal
            title={progressDetail.title}
            rows={sm.rows}
            summary={sm}
            onClose={() => setProgressDetail(null)}
          />
        );
      })()}

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
