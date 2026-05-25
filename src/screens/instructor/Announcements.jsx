import { useTheme } from "../../theme.js";
import { fmtDate } from "../../utils.js";

export function Announcements({ announcements, onCompose, onEdit, onDelete }) {
  const { s, muted, text } = useTheme();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: 0 }}>Announcements</h2>
        <button onClick={onCompose} style={{ ...s.btnPri, width: "auto", padding: "8px 16px" }}>+ New Announcement</button>
      </div>

      {announcements.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
          <p style={{ margin: 0, fontSize: 14 }}>No announcements yet. Create one to notify your students.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {announcements.map(ann => (
            <div key={ann.id} style={{ ...s.card, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>{ann.title}</p>
                  {ann.body && (
                    <p style={{ color: muted, fontSize: 13, margin: "0 0 8px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ann.body}</p>
                  )}
                  <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>
                    {fmtDate(ann.createdAt)}{ann.updatedAt ? ` · edited ${fmtDate(ann.updatedAt)}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => onEdit(ann)} style={{ ...s.btnGhost, width: "auto", padding: "5px 12px", fontSize: 13 }}>Edit</button>
                  <button onClick={() => onDelete(ann.id)} style={{ ...s.btnDanger, width: "auto", padding: "5px 12px", fontSize: 13 }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
