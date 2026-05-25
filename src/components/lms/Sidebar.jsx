import { useTheme } from "../../theme.js";

// Generic vertical sidebar nav.
// `items`: [{ id, label, icon? }]
// `activeId`: currently selected item id
// `onSelect(id)`: click handler
export function Sidebar({ items, activeId, onSelect }) {
  const { teal, muted, text } = useTheme();
  return (
    <nav style={{ display: "flex", flexDirection: "column", padding: "12px 8px", gap: 2, minWidth: 200, flexShrink: 0 }}>
      {items.map(item => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              border: "none",
              background: "transparent",
              color: isActive ? teal : text,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              textAlign: "left",
              borderRadius: 6,
              transition: "color 0.12s",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = teal; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = text; }}
          >
            {item.icon && <span style={{ width: 18, display: "inline-flex", justifyContent: "center", color: isActive ? teal : muted }}>{item.icon}</span>}
            <span>{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span style={{ marginLeft: "auto", background: "#f87171", color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px", lineHeight: 1.4 }}>{item.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
