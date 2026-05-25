import { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme.js";
import { TEAL } from "../theme.js";

/**
 * Themed dropdown replacing native <select> elements.
 * variant="header" — compact trigger for nav headers (class picker)
 * variant="input"  — input-styled trigger for forms (course picker)
 */
export function CustomSelect({ value, onChange, options, placeholder, variant = "header", style }) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const containerRef = useRef(null);
  const th = useTheme();

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); setHoveredIdx(-1); };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label || placeholder || "Select…";
  const isInput = variant === "input";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={isInput
          ? { ...th.s.input, width: "auto", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }
          : { background: "transparent", border: "none", color: th.text, fontSize: 15, fontWeight: 600, padding: "0 4px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }
        }
      >
        <span style={!selected ? { color: th.muted } : {}}>{displayLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill={th.muted} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <path d="M0 0l5 6 5-6z"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: th.bg, border: `1px solid ${th.border}`, borderRadius: 10,
          boxShadow: th.isLight ? "0 8px 24px rgba(0,0,0,0.12)" : "0 8px 24px rgba(0,0,0,0.35)",
          zIndex: 200, minWidth: "max-content", overflow: "hidden"
        }}>
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(-1)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 16px",
                background: hoveredIdx === i
                  ? th.hover
                  : "transparent",
                border: "none",
                borderBottom: i < options.length - 1 ? `1px solid ${th.border}` : "none",
                color: hoveredIdx === i ? th.text : th.muted,
                fontSize: 14, cursor: "pointer",
                fontWeight: 400,
                whiteSpace: "nowrap",
                transition: "background 0.12s, color 0.12s"
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
