import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import {
  ATT_PRESENT, ATT_ABSENT, ATT_EXCUSED, ATT_CYCLE, ATT_LABEL, ATT_SHORT, ATT_COLOR,
  sessionList, unmarkedCount, sessionCounts, labLinkMap, formatSessionDate, todayKey,
} from "../../attendance.js";

// ── Instructor attendance ─────────────────────────────────────────────────────
// Two panels over one `attendance` node (see src/attendance.js for the storage shape):
//
//   Take roll  TODAY's session, and nothing else. Every student must be marked explicitly, so there is
//              deliberately no "mark all present" shortcut: that is the same one-click
//              all-present default in a different coat, and it is what would let a
//              distracted day be recorded as full attendance. Marks auto-save as they are
//              tapped (debounced) so a closed tab never loses a half-finished roll, but the
//              session stays UNTAKEN, and therefore zeroes nobody, until "Save roll call"
//              stamps takenAt.
//
//   History    the same sessions as an editable grid. Clicking a cell opens a small menu of
//              the statuses and writes the pick immediately, which is the correction path for
//              a past record; a whole past session can also be reopened in Take roll to change
//              its date or its lab.
//
// Take roll deliberately has NO day picker. It used to carry one pill per recorded session,
// which is ~30 by the end of a term, and it opened on the LAST recorded session — so days
// after a class it still showed that day's marks as though they were the roll in progress.
// It now always opens on today, and a past day is reached the one way that already scales:
// clicking its column header in History.

const AUTOSAVE_MS = 700;

function studentName(stu) { return stu.altName || stu.fullName || stu.studentId; }

// ── Session bar: date, lab link, taken badge ─────────────────────────────────
function SessionBar({ draft, setDraft, savedSession, labs, linkMap, dateTaken, onDelete, isMobile }) {
  const { s, text, muted, border, teal, isLight, card } = useTheme();
  const fieldStyle = {
    background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
    border: `1px solid ${border}`, color: text, borderRadius: 8,
    padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box",
    colorScheme: isLight ? "light" : "dark",
  };
  return (
    <div style={{
      display: "flex", flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-end", gap: 12, flexWrap: "wrap",
      padding: "14px 16px", background: card, border: `1px solid ${border}`, borderRadius: 12,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Class date</label>
        <input
          type="date"
          value={draft.date}
          onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
          style={{ ...fieldStyle, width: isMobile ? "100%" : 150 }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : 1, minWidth: 200 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lab gated by this lecture</label>
        <select
          value={draft.labId || ""}
          onChange={e => setDraft(d => ({ ...d, labId: e.target.value || null }))}
          style={{ ...fieldStyle, width: "100%", cursor: "pointer" }}
        >
          <option value="">No lab (attendance only)</option>
          {labs.map(lab => {
            const linkedTo = linkMap[lab.id];
            const takenElsewhere = linkedTo && linkedTo !== draft.id;
            return (
              <option key={lab.id} value={lab.id}>
                {lab.title}
                {lab.dueDate ? ` (${formatSessionDate(String(lab.dueDate).slice(0, 10))})` : ""}
                {takenElsewhere ? ` [already on ${formatSessionDate(linkedTo)}]` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...s.badge(dateTaken ? teal : muted), fontSize: 11 }}>
          {dateTaken ? `Roll taken ${dateTaken}` : "Not taken yet"}
        </span>
        {savedSession && (
          <button
            onClick={onDelete}
            title="Delete this session and its attendance record"
            style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, color: "#f87171", fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── One roster row in the take-roll list ─────────────────────────────────────
function RollRow({ stu, mark, onMark, isMobile }) {
  const { text, muted, border, isLight } = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: isMobile ? "12px 14px" : "9px 14px",
      borderBottom: `1px solid ${border}`,
    }}>
      <span style={{ color: mark ? text : muted, fontSize: isMobile ? 15 : 14, fontWeight: mark ? 500 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {studentName(stu)}
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {ATT_CYCLE.map(st => {
          const active = mark === st;
          const c = ATT_COLOR[st];
          return (
            <button
              key={st}
              onClick={() => onMark(stu.studentId, st)}
              title={ATT_LABEL[st]}
              style={{
                minWidth: isMobile ? 62 : 54,
                padding: isMobile ? "10px 8px" : "6px 10px",
                borderRadius: 8, cursor: "pointer",
                fontSize: isMobile ? 13 : 12, fontWeight: active ? 700 : 500,
                background: active ? c + (isLight ? "28" : "22") : "transparent",
                border: `1px solid ${active ? c + (isLight ? "90" : "66") : border}`,
                color: active ? c : muted,
              }}
            >
              {isMobile ? ATT_LABEL[st] : ATT_SHORT[st]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Attendance({ roster = [], attendance = {}, manualAssignments = {}, dueDates = {},
    onSaveSession, onDeleteSession }) {
  const { s, text, muted, border, teal, card, bg, isLight } = useTheme();
  const isMobile = useIsMobile();

  const sessions = sessionList(attendance);
  const linkMap = labLinkMap(attendance);
  const labs = Object.values(manualAssignments || {})
    .filter(ma => ma && ma.catId === "cat_lab")
    .map(ma => ({ ...ma, dueDate: dueDates[ma.id] || null }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const labTitle = id => labs.find(l => l.id === id)?.title || (id ? "Deleted lab" : null);

  const [view, setView] = useState("take");
  const [activeId, setActiveId] = useState(todayKey);
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load the active session into the local draft whenever it changes. A date with no saved
  // session yields a fresh, untaken one.
  useEffect(() => {
    const saved = attendance[activeId];
    setDraft(saved
      ? { ...saved, id: activeId, date: saved.date || activeId, marks: { ...(saved.marks || {}) } }
      : { id: activeId, date: activeId, labId: null, takenAt: null, marks: {} });
    setErr(""); setConfirmDelete(false); setShowUnmarkedOnly(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Debounced autosave of the draft. Marks must survive a closed tab mid-roll, but the
  // session is only ever written UNTAKEN here: `takenAt` is stamped by the Save button, and
  // nothing is zeroed until it is. Skips the date-change case, which is a move (below).
  const saveTimer = useRef(null);
  const pendingRef = useRef(null);
  // The saver is held in a ref, not a dependency: App.jsx rebuilds its handlers on every
  // render, so a `flush` that closed over the prop would change identity constantly and the
  // unmount cleanup below would fire on every render, defeating the debounce entirely.
  const saveRef = useRef(onSaveSession);
  saveRef.current = onSaveSession;
  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) saveRef.current(pending);
  }, []);
  useEffect(() => flush, [flush]);   // flush is stable, so this is unmount-only

  const queueSave = next => {
    if (next.id !== next.date) return;   // a move is committed explicitly, not by autosave
    pendingRef.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const updateDraft = updater => {
    setDraft(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      queueSave(next);
      return next;
    });
  };

  const setMark = (studentId, status) =>
    updateDraft(d => ({ ...d, marks: { ...d.marks, [studentId]: status } }));

  if (!draft) return null;

  const today = todayKey();
  const unmarked = unmarkedCount(draft, roster);
  const counts = sessionCounts(draft, roster);
  const dateChanged = draft.date && draft.date !== draft.id;
  const dateTaken = draft.takenAt
    ? new Date(draft.takenAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  // Save roll call. Stamps takenAt (this is what makes absences count), and commits a date
  // change as a move: write the new id, delete the old, so a session never exists twice.
  const saveRoll = async () => {
    setErr("");
    if (unmarked > 0) return;
    if (dateChanged && attendance[draft.date]) {
      setErr(`There is already a session on ${formatSessionDate(draft.date)}. Pick another date.`);
      return;
    }
    clearTimeout(saveTimer.current); pendingRef.current = null;
    const oldId = draft.id;
    const next = { ...draft, id: draft.date, takenAt: draft.takenAt || Date.now() };
    try {
      await onSaveSession(next);
      // Only a session that was actually persisted needs removing at its old key.
      if (dateChanged && attendance[oldId]) await onDeleteSession(oldId);
      setDraft(next);
      setActiveId(next.id);
    } catch (e) { setErr(`Save failed: ${e?.message || e}`); }
  };

  const removeSession = async () => {
    clearTimeout(saveTimer.current); pendingRef.current = null;
    try {
      await onDeleteSession(draft.id);
      setConfirmDelete(false);
      // Back to today, never to some other old session: with no day picker, an older session
      // left on screen would be one the instructor has no visible way to have chosen.
      setActiveId(todayKey());
    } catch (e) { setErr(`Delete failed: ${e?.message || e}`); }
  };

  // History-grid edit: set one cell to the status picked from its menu and write straight
  // through. Editing a past record is a single correction, so it commits on the pick rather
  // than waiting for a Save press. A null status clears the mark back to unmarked (the
  // session is written as a whole node, so dropping the key removes it).
  const setCellMark = (session, studentId, status) => {
    const marks = { ...(session.marks || {}) };
    if (status) marks[studentId] = status; else delete marks[studentId];
    const next = { ...session, marks };
    onSaveSession(next);
    if (session.id === draft.id) setDraft(d => ({ ...d, marks }));
  };

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => { flush(); if (id === "take") setActiveId(todayKey()); setView(id); }}
      style={{
        background: view === id ? teal + (isLight ? "20" : "1a") : "transparent",
        border: `1px solid ${view === id ? teal + "66" : border}`,
        color: view === id ? teal : muted,
        borderRadius: 8, padding: "8px 16px", fontSize: 13,
        fontWeight: view === id ? 700 : 500, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const visibleRoster = showUnmarkedOnly ? roster.filter(stu => !draft.marks[stu.studentId]) : roster;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + view toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ color: text, fontSize: 20, fontWeight: 700, margin: 0 }}>Attendance</h2>
          <p style={{ ...s.muted, margin: "4px 0 0", fontSize: 13 }}>
            A student marked absent gets a zero on the lab linked to that day's lecture. Excused absences do not.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("take", "Take roll")}
          {tabBtn("history", "History")}
        </div>
      </div>

      {err && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
          {err}
        </div>
      )}

      {view === "take" ? (
        <>
          {/* Opened from History: say which day this is, and offer the way back to today. */}
          {draft.id !== today && (
            <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#60a5fa", fontSize: 13 }}>
                Editing the roll from {formatSessionDate(draft.id, { weekday: true })}.
              </span>
              <button
                onClick={() => { flush(); setActiveId(today); }}
                style={{ background: "transparent", border: "1px solid rgba(96,165,250,0.45)", borderRadius: 8, color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "6px 12px" }}
              >
                Take today's roll
              </button>
            </div>
          )}

          <SessionBar
            draft={draft} setDraft={updateDraft} savedSession={attendance[draft.id]}
            labs={labs} linkMap={linkMap} dateTaken={dateTaken}
            onDelete={() => setConfirmDelete(true)} isMobile={isMobile}
          />

          {confirmDelete && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: text, fontSize: 13 }}>
                Delete the {formatSessionDate(draft.date)} session and its attendance record? Any lab zeros it caused will be removed.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ ...s.btnSec, width: "auto", padding: "8px 14px", fontSize: 13 }}>Cancel</button>
                <button onClick={removeSession} style={{ ...s.btnPri, width: "auto", padding: "8px 14px", fontSize: 13, background: "#b91c1c" }}>Delete</button>
              </div>
            </div>
          )}

          {dateChanged && (
            <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8, padding: "10px 14px", color: "#60a5fa", fontSize: 12 }}>
              {attendance[draft.id]
                ? `This session will move from ${formatSessionDate(draft.id)} to ${formatSessionDate(draft.date)} when you save.`
                : `This roll will be recorded for ${formatSessionDate(draft.date)}.`}
            </div>
          )}

          {/* Roll list */}
          {roster.length === 0 ? (
            <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
              No students on the roster yet.
            </div>
          ) : (
            <div style={{ ...s.card, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${border}`, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: text, fontSize: 13, fontWeight: 600 }}>
                    {roster.length - unmarked} of {roster.length} marked
                  </span>
                  <span style={{ ...s.badge(ATT_COLOR[ATT_PRESENT]), fontSize: 11 }}>{counts.present} present</span>
                  <span style={{ ...s.badge(ATT_COLOR[ATT_ABSENT]), fontSize: 11 }}>{counts.absent} absent</span>
                  {counts.excused > 0 && <span style={{ ...s.badge(ATT_COLOR[ATT_EXCUSED]), fontSize: 11 }}>{counts.excused} excused</span>}
                </div>
                {unmarked > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: muted, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={showUnmarkedOnly} onChange={e => setShowUnmarkedOnly(e.target.checked)} style={{ cursor: "pointer" }} />
                    Show unmarked only
                  </label>
                )}
              </div>

              {visibleRoster.map(stu => (
                <RollRow key={stu.studentId} stu={stu} mark={draft.marks[stu.studentId]} onMark={setMark} isMobile={isMobile} />
              ))}
              {visibleRoster.length === 0 && (
                <div style={{ padding: "20px 16px", textAlign: "center", color: muted, fontSize: 13 }}>
                  Everyone is marked.
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
                <span style={{ color: muted, fontSize: 12 }}>
                  {unmarked > 0
                    ? `${unmarked} student${unmarked === 1 ? "" : "s"} still unmarked. Marks are saved as you go.`
                    : draft.takenAt ? "Roll call recorded. Any change you make here saves automatically." : "Everyone is marked and ready to record."}
                </span>
                <button
                  onClick={saveRoll}
                  disabled={unmarked > 0}
                  style={{
                    ...s.btnPri, width: "auto", padding: "10px 20px", fontSize: 14,
                    opacity: unmarked > 0 ? 0.45 : 1,
                    cursor: unmarked > 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {unmarked > 0 ? `${unmarked} unmarked` : draft.takenAt ? "Save changes" : "Save roll call"}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <HistoryGrid
          sessions={sessions} roster={roster} labTitle={labTitle}
          onSetMark={setCellMark}
          onOpen={id => { flush(); setActiveId(id); setView("take"); }}
        />
      )}
    </div>
  );
}

// ── The status menu one History cell opens ───────────────────────────────────
// Fixed-positioned rather than absolute inside the cell: the grid scrolls horizontally, and
// a popover inside that container would be clipped by it. Anchored to the cell's rect, it is
// closed by a pick, a click anywhere else, Escape, or any scroll (which would detach it).
function MarkMenu({ anchor, current, onPick, onClose }) {
  const { muted, border, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const W = 158;
  const rows = ATT_CYCLE.length + (current ? 1 : 0);
  const H = 10 + rows * 34;
  const left = Math.min(Math.max(8, anchor.x - W / 2), Math.max(8, window.innerWidth - W - 8));
  const top = anchor.bottom + H + 8 > window.innerHeight
    ? Math.max(8, anchor.top - H - 6)
    : anchor.bottom + 6;

  const row = (label, color, onClick, active) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        background: active ? color + (isLight ? "22" : "1e") : "transparent",
        border: "none", borderRadius: 6, cursor: "pointer",
        padding: "7px 10px", fontSize: 13, textAlign: "left",
        color: color, fontWeight: active ? 700 : 500,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {label}
      {active && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
    </button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div style={{
        position: "fixed", top, left, width: W, zIndex: 61,
        background: solidBg, border: `1px solid ${border}`, borderRadius: 10,
        boxShadow: "0 10px 28px rgba(0,0,0,0.28)", padding: 5,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {ATT_CYCLE.map(st => row(ATT_LABEL[st], ATT_COLOR[st], () => onPick(st), current === st))}
        {current && row("Clear mark", muted, () => onPick(null), false)}
      </div>
    </>
  );
}

// ── History grid ──────────────────────────────────────────────────────────────
// Students down, sessions across. Every cell is editable in place: this is the correction
// path for a past record, so it commits on the pick. A cell opens a menu of the statuses
// rather than cycling through them, since a correction usually knows which status it wants
// and cycling makes reaching it a guess at how many clicks. Untaken sessions are dimmed and
// labelled, since they are exactly the ones NOT applying their zeros yet.
function HistoryGrid({ sessions, roster, labTitle, onSetMark, onOpen }) {
  const { s, text, muted, border, teal, bg, isLight } = useTheme();
  const cellBorder = `1px solid ${border}`;
  // { sessionId, studentId, anchor } — the cell whose menu is open.
  const [menu, setMenu] = useState(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  if (sessions.length === 0) {
    return (
      <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
        No attendance recorded yet. Take a roll call to start the record.
      </div>
    );
  }

  const absencesFor = studentId =>
    sessions.filter(sess => sess.takenAt && sess.marks?.[studentId] === ATT_ABSENT).length;

  const exportCsv = () => {
    const head = ["Student", ...sessions.map(x => x.date), "Absences"];
    const rows = roster.map(stu => [
      studentName(stu),
      ...sessions.map(sess => ATT_SHORT[sess.marks?.[stu.studentId]] || ""),
      String(absencesFor(stu.studentId)),
    ]);
    const csv = [head, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "attendance.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ ...s.card, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: cellBorder, flexWrap: "wrap" }}>
        <span style={{ color: muted, fontSize: 12 }}>
          Click any cell to pick present, absent or excused. Changes save immediately.
        </span>
        <button
          onClick={exportCsv}
          style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.07)", border: cellBorder, borderRadius: 8, color: text, fontSize: 12, cursor: "pointer", padding: "7px 12px" }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* width:auto, not minWidth:100% — with only a session or two, stretching to fill the
            card blows one date column up to half the page. Overflow scrolls once there are many. */}
        <table style={{ borderCollapse: "collapse", fontSize: 13, width: "auto" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, zIndex: 2, background: bg, padding: "10px 14px", textAlign: "left", fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: cellBorder, borderRight: cellBorder, whiteSpace: "nowrap" }}>
                Student
              </th>
              {sessions.map(sess => (
                <th key={sess.id} style={{ padding: "8px 6px", textAlign: "center", borderBottom: cellBorder, borderRight: cellBorder, minWidth: 66, opacity: sess.takenAt ? 1 : 0.5 }}>
                  <button
                    onClick={() => onOpen(sess.id)}
                    title={`${formatSessionDate(sess.date, { weekday: true, withYear: true })}${sess.labId ? ` gates ${labTitle(sess.labId)}` : " (no lab)"}${sess.takenAt ? "" : " (not taken)"} · click to edit this session`}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: text, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {formatSessionDate(sess.date)}
                  </button>
                  <div style={{ fontSize: 9, color: muted, margin: "2px auto 0", whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sess.takenAt ? (sess.labId ? labTitle(sess.labId) : "no lab") : "not taken"}
                  </div>
                </th>
              ))}
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: cellBorder, whiteSpace: "nowrap" }}>
                Absences
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((stu, rIdx) => {
              const rowBg = rIdx % 2 === 0 ? bg : (isLight ? "#EEEAE5" : "#1e1f21");
              const total = absencesFor(stu.studentId);
              return (
                <tr key={stu.studentId} style={{ background: rowBg }}>
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: rowBg, padding: "8px 14px", color: text, fontWeight: 500, borderRight: cellBorder, borderBottom: cellBorder, whiteSpace: "nowrap" }}>
                    {studentName(stu)}
                  </td>
                  {sessions.map(sess => {
                    const mark = sess.marks?.[stu.studentId];
                    const c = mark ? ATT_COLOR[mark] : muted;
                    const open = menu && menu.sessionId === sess.id && menu.studentId === stu.studentId;
                    return (
                      <td
                        key={sess.id}
                        onClick={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu(open ? null : {
                            sessionId: sess.id, studentId: stu.studentId,
                            anchor: { x: r.left + r.width / 2, top: r.top, bottom: r.bottom },
                          });
                        }}
                        title={mark
                          ? `${ATT_LABEL[mark]} on ${formatSessionDate(sess.date)}${!sess.takenAt ? " (session not taken)" : ""} · click to change`
                          : "Unmarked (counts as present, no lab penalty) · click to set"}
                        style={{
                          textAlign: "center", padding: "8px 4px", cursor: "pointer",
                          borderRight: cellBorder, borderBottom: cellBorder,
                          fontFamily: "monospace", fontWeight: 700, fontSize: 13,
                          color: c, opacity: sess.takenAt ? 1 : 0.45,
                          background: open
                            ? teal + (isLight ? "22" : "1e")
                            : mark === ATT_ABSENT ? "rgba(248,113,113,0.08)" : "transparent",
                        }}
                      >
                        {mark ? ATT_SHORT[mark] : "-"}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", padding: "8px 12px", borderBottom: cellBorder, fontFamily: "monospace", fontWeight: 700, color: total > 0 ? "#f87171" : muted }}>
                    {total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {menu && (
        <MarkMenu
          anchor={menu.anchor}
          current={sessions.find(x => x.id === menu.sessionId)?.marks?.[menu.studentId]}
          onPick={status => {
            const sess = sessions.find(x => x.id === menu.sessionId);
            if (sess) onSetMark(sess, menu.studentId, status);
            setMenu(null);
          }}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
