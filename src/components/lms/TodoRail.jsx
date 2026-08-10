import { useTheme } from "../../theme.js";
import { dueToDate, useIsMobile } from "../../utils.js";

// Right rail "To Do" widget.
// `items`: [{ id, title, due (string), kind, onClick? }] — due soon, not yet done
// `overdue`: same shape, already past due and still not done. Rendered in a
//   separate lower section rather than dropped, so a missed assignment keeps
//   nagging (it can still be submitted late for partial credit).
// `kind` drives the color dot (quiz/homework/lab/midterm/final).
const KIND_COLOR = {
  quiz: "#a3e635",
  homework: "#60a5fa",
  lab: "#f472b6",
  midterm: "#fbbf24",
  final: "#f87171",
  reading: "#94a3b8",
  notes: "#94a3b8",
};

const LATE = "#f87171";

const fmtDue = due => dueToDate(due).toLocaleDateString('en-US',
  { timeZone: 'America/New_York', month: 'short', day: 'numeric' });

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
        style={{ display: "inline-flex", alignItems: "center", gap: 6,
                 background: "transparent",
                 border: `1px solid ${late ? "rgba(248,113,113,0.45)" : border}`,
                 borderRadius: 999, padding: "4px 10px",
                 cursor: it.onClick ? "pointer" : "default",
                 color: text, fontSize: 12, whiteSpace: "nowrap",
                 flexShrink: 0 }}
      >
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4,
                       background: KIND_COLOR[it.kind] || teal, flexShrink: 0 }} />
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
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={e => { if (it.onClick) { e.currentTarget.style.background = hover; e.currentTarget.style.borderColor = late ? LATE : teal; } }}
      onMouseLeave={e => { if (it.onClick) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = late ? "rgba(248,113,113,0.4)" : border; } }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: KIND_COLOR[it.kind] || teal, flexShrink: 0 }} />
        <span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{it.kind}</span>
      </div>
      <div style={{ fontWeight: 500 }}>{it.title}</div>
      {it.due && (
        <div style={{ ...s.muted, fontSize: 12, marginTop: 3, color: late ? LATE : undefined }}>
          {late ? "Was due " : "Due "}{fmtDue(it.due)}
        </div>
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
