import { useState } from "react";
import { useTheme } from "../../theme.js";
import { fmtDate } from "../../utils.js";

// Pops on top of the student portal when there are announcements they have not seen yet.
// Dismissing it (either button, either way) is what records the view, so it must never be
// possible to close this without marking read — otherwise it re-pops on every render and
// the instructor's receipts stay empty for a notice the student has now read three times.
export function NewAnnouncementsModal({ announcements, onDismiss }) {
  const { s, muted, border, text, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  const [closing, setClosing] = useState(false);
  const many = announcements.length > 1;

  const dismiss = async () => {
    if (closing) return;
    setClosing(true);
    try { await onDismiss(announcements.map(a => a.id)); } catch { setClosing(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, width: "100%", maxWidth: 620, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${border}`, gap: 12 }}>
          <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: 0 }}>
            {many ? `${announcements.length} new announcements` : "New announcement"}
          </h3>
          <button onClick={dismiss} title="Dismiss" style={{ background: "none", border: "none", color: muted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          {announcements.map((ann, i) => (
            <div key={ann.id} style={{ paddingTop: i === 0 ? 0 : 14, borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
              <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 8px" }}>{ann.title}</p>
              {ann.body && (
                <p style={{ color: muted, fontSize: 14, margin: "0 0 10px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ann.body}</p>
              )}
              <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{fmtDate(ann.createdAt)}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${border}` }}>
          <button onClick={dismiss} disabled={closing} style={{ ...s.btnPri, width: "100%", opacity: closing ? 0.6 : 1 }}>
            {closing ? "Closing…" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
