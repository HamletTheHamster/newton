import { useState } from "react";
import { useTheme } from "../theme.js";
import { fbSet } from "../firebase.js";

export function BugReportModal({ bugReports, setBugReports, onClose }) {
  const { s, text, isLight } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  const [bugInput, setBugInput] = useState("");
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugSubmitMsg, setBugSubmitMsg] = useState("");

  const submit = async () => {
    if (!bugInput.trim() || bugSubmitting) return;
    setBugSubmitting(true);
    const id = Date.now().toString();
    const report = { id, message: bugInput.trim(), timestamp: new Date().toISOString(), read: false };
    const updated = { ...bugReports, [id]: report };
    try {
      await fbSet('bugReports', updated);
      setBugReports(updated);
      setBugInput("");
      setBugSubmitMsg("Report sent! Thank you.");
      setTimeout(() => { setBugSubmitMsg(""); onClose(); }, 1800);
    } catch {
      setBugSubmitMsg("Failed to send. Please try again.");
    }
    setBugSubmitting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 400 }}>
        <h3 style={{ color: text, fontWeight: 700, fontSize: 16, margin: "0 0 12px" }}>Report a Bug</h3>
        <textarea
          style={{ ...s.input, height: 100, resize: "vertical", marginBottom: 10, fontFamily: "inherit" }}
          placeholder="Describe the issue…"
          value={bugInput}
          onChange={e => setBugInput(e.target.value)}
          autoFocus
        />
        {bugSubmitMsg && <p style={{ color: bugSubmitMsg.startsWith("Failed") ? "#f87171" : "#4ade80", fontSize: 13, margin: "0 0 10px" }}>{bugSubmitMsg}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { onClose(); setBugInput(""); setBugSubmitMsg(""); }} style={{ ...s.btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={bugSubmitting || !bugInput.trim()} style={{ ...s.btnPri, flex: 1, opacity: bugSubmitting || !bugInput.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}
