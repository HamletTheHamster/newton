import { useTheme } from "../../theme.js";
import { dueToDate, useIsMobile } from "../../utils.js";
import { LockIcon } from "./itemIcons.jsx";
import { categoryColor } from "../../category-colors.js";

// Right rail "To Do" widget.
// `items`: [{ id, title, due (string), kind, onClick?, locked?, releaseDate? }] —
//   due soon, not yet done
// `overdue`: same shape, already past due and still not done. Rendered in a
//   separate lower section rather than dropped, so a missed assignment keeps
//   nagging (it can still be submitted late for partial credit).
// `locked`: the assignment's module hasn't released yet (or its item is hidden),
//   so it can't be opened. It stays listed — the due date is real and worth
//   seeing coming — but has no `onClick` and shows when it opens instead.
// `manual`: a gradebook-only assignment (exam, lab). Never clickable and never in the
//   past-due section, and its date reads bare — "Due" is wrong for a date you show up on.
// `kind` drives the color dot, via the shared category palette (src/category-colors.js) that the
// calendar, gradebook, grades list and syllabus all read — so a quiz is the same green everywhere.

const LATE = "#f87171";

const fmtDue = due => dueToDate(due).toLocaleDateString('en-US',
  { timeZone: 'America/New_York', month: 'short', day: 'numeric' });

const unlockText = it => it.releaseDate ? "Unlocks " + fmtDue(it.releaseDate) : "Not open yet";

export function TodoRail({ items, overdue = [] }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const isMobile = useIsMobile();
  const isEmpty = items.length === 0 && overdue.length === 0;

  if (isMobile) {
    // Horizontal chip strip — parent (Shell) provides the scroll container
    const chip = (it, late) => (
      <button
        key={it.id}
        onClick={it.onClick}
        disabled={!it.onClick}
        title={it.locked ? unlockText(it) : undefined}
        style={{ display: "inline-flex", alignItems: "center", gap: 6,
                 background: "transparent",
                 border: `1px solid ${late ? "rgba(248,113,113,0.45)" : border}`,
                 borderRadius: 999, padding: "4px 10px",
                 cursor: it.onClick ? "pointer" : "default",
                 color: text, fontSize: 12, whiteSpace: "nowrap",
                 opacity: it.locked ? 0.6 : 1,
                 flexShrink: 0 }}
      >
        {it.locked
          ? <LockIcon size={11} color={muted} strokeWidth={2.5} />
          : <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4,
                           background: categoryColor(it.kind, teal), flexShrink: 0 }} />}
        <span style={{ fontWeight: 500 }}>{it.title}</span>
        {it.due && (
          <span style={{ color: late ? LATE : muted, fontSize: 11 }}>
            {late ? "was due " : ""}{fmtDue(it.due)}
          </span>
        )}
      </button>
    );

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", minWidth: "max-content" }}>
        <span style={{ color: text, fontWeight: 700, fontSize: 12,
                       whiteSpace: "nowrap", marginRight: 4 }}>To Do</span>
        {isEmpty && <span style={{ ...s.muted, fontSize: 12 }}>Nothing due soon</span>}
        {items.map(it => chip(it, false))}
        {overdue.length > 0 && (
          <span style={{ color: LATE, fontWeight: 700, fontSize: 12,
                         whiteSpace: "nowrap", margin: "0 4px" }}>Past due</span>
        )}
        {overdue.map(it => chip(it, true))}
      </div>
    );
  }

  // Desktop vertical aside
  const card = (it, late) => (
    <button
      key={it.id}
      onClick={it.onClick}
      disabled={!it.onClick}
      style={{
        background: "transparent",
        border: `1px solid ${late ? "rgba(248,113,113,0.4)" : border}`,
        borderRadius: 10,
        padding: "10px 12px",
        cursor: it.onClick ? "pointer" : "default",
        color: text,
        textAlign: "left",
        fontSize: 13,
        lineHeight: 1.4,
        opacity: it.locked ? 0.7 : 1,
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={e => { if (it.onClick) { e.currentTarget.style.background = hover; e.currentTarget.style.borderColor = late ? LATE : teal; } }}
      onMouseLeave={e => { if (it.onClick) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = late ? "rgba(248,113,113,0.4)" : border; } }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: categoryColor(it.kind, teal), flexShrink: 0 }} />
        <span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{it.kind}</span>
        {it.locked && <LockIcon size={11} color={muted} strokeWidth={2.5} />}
      </div>
      <div style={{ fontWeight: 500 }}>{it.title}</div>
      {it.due && (
        <div style={{ ...s.muted, fontSize: 12, marginTop: 3, color: late ? LATE : undefined }}>
          {it.manual ? "" : late ? "Was due " : "Due "}{fmtDue(it.due)}
        </div>
      )}
      {it.locked && (
        <div style={{ ...s.muted, fontSize: 12, marginTop: 2 }}>{unlockText(it)}</div>
      )}
    </button>
  );

  return (
    <aside style={{ padding: "20px 16px 24px", minWidth: 220, flexShrink: 0, overflowY: "auto" }}>
      <p style={{ color: text, fontWeight: 700, fontSize: 14, margin: "0 0 12px", letterSpacing: "0.02em" }}>To Do</p>
      {isEmpty ? (
        <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>Nothing for now</p>
      ) : (
        <>
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(it => card(it, false))}
            </div>
          )}
          {items.length === 0 && (
            <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>Nothing due soon</p>
          )}
          {overdue.length > 0 && (
            <>
              <p style={{ color: LATE, fontWeight: 700, fontSize: 13,
                          margin: "18px 0 10px", paddingTop: 14,
                          borderTop: `1px solid ${border}`, letterSpacing: "0.02em" }}>
                Past due
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {overdue.map(it => card(it, true))}
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}
