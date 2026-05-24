import { useState } from "react";
import { s, MUTED, BORDER } from "../../theme.js";

// Instructor-side modal for creating / editing a page.
export function PageEditor({ initialTitle = "", initialContent = "", onSave, onCancel }) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) { setErr("Title is required."); return; }
    setErr(""); setSaving(true);
    try { await onSave({ title: t, content }); }
    catch (e) { setErr(e?.message || "Save failed."); setSaving(false); }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
    >
      <div style={{ ...s.card, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
          <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: 0 }}>{initialTitle ? "Edit Page" : "New Page"}</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: MUTED, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div>
            <label style={s.label}>Title</label>
            <input style={s.input} placeholder="Page title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={s.label}>Content</label>
            <textarea
              style={{ ...s.input, height: 320, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
              placeholder="Page content — plain text with line breaks. Markdown is not rendered."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onCancel} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...s.btnPri, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
