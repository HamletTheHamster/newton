import { useState } from "react";
import { useTheme } from "../theme.js";

// Small circled-"i" button that toggles a compact popover of concise help. Keeps verbose
// "how it works" instructions out of the way until a student actually wants them, so the
// surrounding UI stays clean. `align` is "left" | "right" — which edge the popover hangs from.
export function InfoDot({ children, title, size = 18, align = "left" }) {
  const { text, muted, border, isLight } = useTheme();
  const [open, setOpen] = useState(false);
  const solidBg = isLight ? "#fff" : "#252627";
  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={title || "More info"}
        title={title || "More info"}
        style={{
          width: size, height: size, borderRadius: "50%", flexShrink: 0, padding: 0,
          border: `1.5px solid ${open ? text : muted}`, background: open ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)") : "transparent",
          color: open ? text : muted, fontSize: Math.round(size * 0.64), fontWeight: 700,
          fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif",
          cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >i</button>
      {open && (
        <>
          {/* invisible full-screen catcher so a click anywhere else dismisses the popover */}
          <span onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <span
            role="tooltip"
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: "calc(100% + 8px)", [align === "right" ? "right" : "left"]: 0, zIndex: 61,
              width: 270, maxWidth: "78vw", boxSizing: "border-box",
              background: solidBg, border: `1px solid ${border}`, borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)", padding: "11px 13px",
              color: text, fontSize: 13, lineHeight: 1.5, fontWeight: 400, textAlign: "left", cursor: "default",
            }}
          >
            {title && <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}>{title}</div>}
            {children}
          </span>
        </>
      )}
    </span>
  );
}
