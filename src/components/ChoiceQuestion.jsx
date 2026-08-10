import { useState } from "react";
import { useTheme } from "../theme.js";

// Multiple-choice quiz widget. The student picks one lettered option and submits; grading is
// deterministic (no Claude), so a wrong pick can be met with an authored, misconception-specific
// nudge and a retry. Mirrors DragDropQuestion's shape: controlled locally, hands the chosen key
// up via onSubmit, and is remounted per question by a `key={qIdx}` on the caller.
//
// Question shape (see QUIZZES_PHYSICS2):
//   { id, choices: true, text,
//     options:  [{ key: "A", label: "Attract each other" }, …],
//     correct:  "A",
//     feedback: { B: "…nudge for this wrong pick…", C: "…" } }
export function ChoiceQuestion({ q, onSubmit, busy }) {
  const { s, muted, border, teal, tealDim, text, isLight } = useTheme();
  const [picked, setPicked] = useState(null);
  const hoverBg = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(q.options || []).map(opt => {
          const selected = picked === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => !busy && setPicked(opt.key)}
              disabled={busy}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                background: selected ? tealDim : hoverBg,
                border: `2px solid ${selected ? teal : border}`,
                borderRadius: 12, padding: "12px 16px", cursor: busy ? "not-allowed" : "pointer",
                color: text, fontSize: 14, transition: "all 0.15s", opacity: busy ? 0.5 : 1,
              }}
            >
              <span style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: selected ? teal : "transparent",
                border: `2px solid ${selected ? teal : border}`,
                color: selected ? "#fff" : muted, fontWeight: 700, fontSize: 13,
              }}>{opt.key}</span>
              <span style={{ fontWeight: selected ? 600 : 400 }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => picked && !busy && onSubmit(picked)}
        disabled={!picked || busy}
        style={{ ...s.btnPri, opacity: (!picked || busy) ? 0.4 : 1 }}
      >Submit Answer</button>
    </div>
  );
}
