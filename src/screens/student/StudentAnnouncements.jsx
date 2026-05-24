import { s, TEAL, MUTED } from "../../theme.js";
import { fmtDate } from "../../utils.js";

export function StudentAnnouncements({ announcements }) {
  return (
    <div>
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>Announcements</h2>

      {announcements.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>
          <p style={{ margin: 0, fontSize: 14 }}>No announcements yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {announcements.map(ann => (
            <div key={ann.id} style={{ ...s.card, padding: "18px 20px" }}>
              <div style={{ marginBottom: ann.body ? 8 : 6 }}>
                <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: 0 }}>{ann.title}</p>
              </div>
              {ann.body && (
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, margin: "0 0 10px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ann.body}</p>
              )}
              <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{fmtDate(ann.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
