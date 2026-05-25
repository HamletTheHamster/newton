import { s, TEAL, MUTED, BORDER } from "../../theme.js";
import { dueToDate, useIsMobile } from "../../utils.js";

// Right rail "To Do" widget.
// `items`: [{ id, title, due (string), kind, onClick? }]
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

export function TodoRail({ items }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Horizontal chip strip — parent (Shell) provides the scroll container
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", minWidth: "max-content" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 12,
                       whiteSpace: "nowrap", marginRight: 4 }}>To Do</span>
        {items.length === 0 ? (
          <span style={{ ...s.muted, fontSize: 12 }}>Nothing due soon</span>
        ) : (
          items.map(it => (
            <button
              key={it.id}
              onClick={it.onClick}
              disabled={!it.onClick}
              style={{ display: "inline-flex", alignItems: "center", gap: 6,
                       background: "transparent", border: `1px solid ${BORDER}`,
                       borderRadius: 999, padding: "4px 10px",
                       cursor: it.onClick ? "pointer" : "default",
                       color: "#fff", fontSize: 12, whiteSpace: "nowrap",
                       flexShrink: 0 }}
            >
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4,
                             background: KIND_COLOR[it.kind] || TEAL, flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{it.title}</span>
              {it.due && (
                <span style={{ color: MUTED, fontSize: 11 }}>
                  {dueToDate(it.due).toLocaleDateString('en-US',
                    { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    );
  }

  // Desktop vertical aside (unchanged)
  return (
    <aside style={{ padding: "20px 16px 24px", minWidth: 220, flexShrink: 0, overflowY: "auto" }}>
      <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: "0 0 12px", letterSpacing: "0.02em" }}>To Do</p>
      {items.length === 0 ? (
        <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>Nothing for now</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(it => (
            <button
              key={it.id}
              onClick={it.onClick}
              disabled={!it.onClick}
              style={{
                background: "transparent",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "10px 12px",
                cursor: it.onClick ? "pointer" : "default",
                color: "#fff",
                textAlign: "left",
                fontSize: 13,
                lineHeight: 1.4,
                transition: "background 0.12s, border-color 0.12s",
              }}
              onMouseEnter={e => { if (it.onClick) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = TEAL; } }}
              onMouseLeave={e => { if (it.onClick) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = BORDER; } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: KIND_COLOR[it.kind] || TEAL, flexShrink: 0 }} />
                <span style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{it.kind}</span>
              </div>
              <div style={{ fontWeight: 500 }}>{it.title}</div>
              {it.due && (
                <div style={{ ...s.muted, fontSize: 12, marginTop: 3 }}>
                  Due {dueToDate(it.due).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
