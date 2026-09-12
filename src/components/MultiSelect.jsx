import { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme.js";

// Themed multi-select: a trigger that reads like a native <select> (so it sits beside one
// without looking like a different control) and a checkbox list that STAYS OPEN while the
// user ticks several entries. Closes on an outside click or Escape. `CustomSelect` is the
// single-value sibling; this exists because a native <select multiple> renders as a list box,
// which is the wrong shape for "pick a few names out of a roster of thirty".
//
// `values` is the selected value array; `onToggle(value, on)` fires once per tick, so a
// caller that writes one leaf per entry (the roster's `auditing` flag) needs no batching.
export function MultiSelect({ values = [], onToggle, options, placeholder = "None", title, maxWidth = 260, style }) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const containerRef = useRef(null);
  const th = useTheme();
  const solidBg = th.isLight ? "#fff" : "#252627";

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); setHoveredIdx(-1); };
  }, [open]);

  const selectedSet = new Set(values);
  const selected = options.filter(o => selectedSet.has(o.value));
  const summary = selected.length ? selected.map(o => o.label).join(", ") : placeholder;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={title}
        style={{
          background: solidBg, border: `1px solid ${open ? th.teal : th.border}`, color: selected.length ? th.text : th.muted,
          borderRadius: 6, padding: "5px 10px", fontSize: 13, cursor: "pointer", outline: "none",
          display: "flex", alignItems: "center", gap: 8, maxWidth,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
        {selected.length > 1 && <span style={{ color: th.muted, fontSize: 11, flexShrink: 0 }}>({selected.length})</span>}
        <svg width="10" height="6" viewBox="0 0 10 6" fill={th.muted} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <path d="M0 0l5 6 5-6z"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: solidBg, border: `1px solid ${th.border}`, borderRadius: 10,
          boxShadow: th.isLight ? "0 8px 24px rgba(0,0,0,0.12)" : "0 8px 24px rgba(0,0,0,0.35)",
          zIndex: 200, minWidth: 240, maxHeight: 320, overflowY: "auto",
        }}>
          {options.length === 0 && <div style={{ padding: "10px 14px", color: th.muted, fontSize: 13 }}>Nobody to list.</div>}
          {options.map((o, i) => {
            const on = selectedSet.has(o.value);
            return (
              <label
                key={o.value}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(-1)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer",
                  background: hoveredIdx === i ? th.hover : "transparent",
                  borderBottom: i < options.length - 1 ? `1px solid ${th.border}` : "none",
                  color: on || hoveredIdx === i ? th.text : th.muted, fontSize: 13, whiteSpace: "nowrap",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                <input type="checkbox" checked={on} onChange={e => onToggle(o.value, e.target.checked)}
                       style={{ accentColor: th.teal, margin: 0, cursor: "pointer", colorScheme: th.isLight ? "light" : "dark" }} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
