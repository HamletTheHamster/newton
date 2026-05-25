import { useTheme } from "../theme.js";

export function ChatMessages({ messages, busy = false }) {
  const { s, muted, border, teal, tealDim, text, isLight } = useTheme();

  const tutorCorrectBg = isLight ? "rgba(74,222,128,0.14)" : "rgba(74,222,128,0.08)";
  const tutorCorrectBorder = isLight ? "rgba(74,222,128,0.5)" : "rgba(74,222,128,0.25)";
  const tutorCorrectColor = isLight ? "#166534" : "#bbf7d0";
  const tutorWrongBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";

  return (
    <>
      {messages.map((msg, i) => {
        if (msg.type === "system") return (
          <div key={i} style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ ...s.card, padding: "12px 20px", color: muted, fontSize: 13, maxWidth: 480, textAlign: "center", whiteSpace: "pre-line" }}>
              {msg.text}
            </div>
          </div>
        );
        if (msg.type === "question") return (
          <div key={i} style={{ background: tealDim, border: `2px solid ${teal}44`, borderRadius: 14, padding: 20 }}>
            <div style={{ color: teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Question {msg.num} of {msg.total} · {msg.pts} {msg.pts === 1 ? "point" : "points"}
            </div>
            <p style={{ color: text, fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap", userSelect: "none" }}>{msg.q.text}</p>
            {msg.q.requiresImage && (
              <div style={{ marginTop: 12, background: `${teal}18`, border: `1px solid ${teal}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: muted }}>
                Drawing required. Accepted formats: {msg.q.formatLabel}.
              </div>
            )}
          </div>
        );
        if (msg.type === "student") return (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ background: teal, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 16px", maxWidth: 480, fontSize: 14, lineHeight: 1.6 }}>
              {msg.imageUrl && <img src={msg.imageUrl} alt="Drawing" style={{ borderRadius: 8, maxWidth: "100%", maxHeight: 220, objectFit: "contain", marginBottom: msg.text ? 8 : 0 }} />}
              {msg.text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>}
            </div>
          </div>
        );
        if (msg.type === "tutor") return (
          <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: msg.correct ? tutorCorrectBg : tutorWrongBg, border: `1px solid ${msg.correct ? tutorCorrectBorder : border}`, borderRadius: "14px 14px 14px 4px", padding: "10px 16px", maxWidth: 480, fontSize: 14, lineHeight: 1.6, color: msg.correct ? tutorCorrectColor : text }}>
              {msg.text}
            </div>
          </div>
        );
        if (msg.type === "result") {
          const pct = msg.final / 10;
          const scoreColor = pct >= 0.9 ? "#4ade80" : pct >= 0.7 ? "#a3e635" : pct >= 0.5 ? "#facc15" : "#f87171";
          return (
            <div key={i} style={{ ...s.card, padding: 28, animation: "fadeSlideUp 0.45s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h3 style={{ color: text, fontWeight: 700, fontSize: 22, margin: "0 0 4px" }}>
                  {msg.practiceMode ? "Practice Complete" : "Quiz Complete"}
                </h3>
                {msg.practiceMode && <p style={{ color: teal, fontSize: 13, margin: 0 }}>Practice run — no grade recorded.</p>}
                {!msg.practiceMode && msg.late && <p style={{ color: "#facc15", fontSize: 13, margin: 0 }}>⚠️ Late submission — half credit applied</p>}
              </div>
              <div style={{ textAlign: "center", margin: "20px 0" }}>
                <span style={{ fontSize: 64, fontWeight: 700, color: scoreColor }}>{msg.final}</span>
                <span style={{ fontSize: 24, color: muted }}>/10</span>
                {!msg.practiceMode && msg.late && <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Raw: {msg.raw}/10 → {msg.final}/10 after late penalty</p>}
              </div>
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {msg.questions.map((q, qi) => (
                  <div key={qi} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ color: muted, flex: 1, fontSize: 13, lineHeight: 1.5 }}>Q{qi + 1}: {q.text.length > 70 ? q.text.slice(0, 70) + "…" : q.text}</span>
                    <span style={{ fontFamily: "monospace", flexShrink: 0, fontWeight: 700, color: (msg.scores[qi] || 0) === msg.pts[qi] ? "#4ade80" : "#f87171" }}>{msg.scores[qi] ?? 0}/{msg.pts[qi]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
      {busy && (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{ ...s.card, padding: "10px 16px", display: "flex", gap: 4, alignItems: "center" }}>
            {[0, 200, 400].map(d => <span key={d} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: teal, animation: "pulse 1.2s infinite", animationDelay: d + "ms" }} />)}
          </div>
        </div>
      )}
    </>
  );
}
