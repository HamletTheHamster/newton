import { useTheme } from "../../theme.js";

// Student-side modal for viewing instructor-authored pages.
// Plain text with line breaks preserved (no markdown).
export function PageViewer({ title, content, onClose }) {
  const { s, text, muted, border, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ ...s.card, background: solidBg, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${border}`, gap: 12 }}>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Untitled"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: muted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", overflowY: "auto", color: text, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {content || <span style={{ color: muted, fontStyle: "italic" }}>This page is empty.</span>}
        </div>
      </div>
    </div>
  );
}
