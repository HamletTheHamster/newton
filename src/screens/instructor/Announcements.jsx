import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { fmtDate } from "../../utils.js";
import { fbGet, classPath } from "../../firebase.js";
import { isTracked, readReceiptsFor } from "../../announcements.js";

// Who has seen this announcement. Collapsed to a count, since the count is the whole answer
// most of the time; expanding names both sides, because "18 of 24" always prompts "which six".
function ReadReceipts({ ann, roster, reads, loading }) {
  const { s, muted, border, text, teal } = useTheme();
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => readReceiptsFor(ann.id, roster, reads), [ann.id, roster, reads]);

  if (!isTracked(ann)) {
    return <p style={{ ...s.muted, fontSize: 12, margin: "6px 0 0" }}>Posted before read tracking, so views were not recorded.</p>;
  }
  if (loading) {
    return <p style={{ ...s.muted, fontSize: 12, margin: "6px 0 0" }}>Loading views…</p>;
  }
  if (stats.total === 0) {
    return <p style={{ ...s.muted, fontSize: 12, margin: "6px 0 0" }}>No students on the roster yet.</p>;
  }

  const nameOf = stu => stu.altName || stu.fullName || stu.studentId;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: teal, fontSize: 12, fontWeight: 600 }}
      >
        Viewed by {stats.viewed.length} of {stats.total} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: text, fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>Viewed ({stats.viewed.length})</p>
            {stats.viewed.length === 0 ? (
              <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>Nobody yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {stats.viewed.map(({ student, at }) => (
                  <li key={student.studentId} style={{ color: muted, fontSize: 12 }}>
                    {nameOf(student)}
                    <span style={{ opacity: 0.7 }}>{at ? ` · ${fmtDate(at)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <p style={{ color: text, fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>Not viewed ({stats.notViewed.length})</p>
            {stats.notViewed.length === 0 ? (
              <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>Everyone has seen it.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {stats.notViewed.map(student => (
                  <li key={student.studentId} style={{ color: muted, fontSize: 12 }}>{nameOf(student)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Announcements({ classId, roster, announcements, onCompose, onEdit, onDelete }) {
  const { s, muted, text } = useTheme();
  // Whole-node read, once per visit, exactly like the Analytics tab's engagement read: the
  // receipts are per-student data App.jsx deliberately does not carry in the class cache.
  // null while unloaded; {} once a load has finished (a failed one included, so a broken read
  // reads as "nobody has viewed" rather than a spinner that never resolves).
  const [reads, setReads] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setReads(null); }, [classId]);
  useEffect(() => {
    if (!classId || reads || loading) return;
    setLoading(true);
    fbGet(classPath(classId, "announcementReads"))
      .then(d => setReads(d && typeof d === "object" ? d : {}))
      .catch(() => setReads({}))
      .finally(() => setLoading(false));
  }, [classId, reads, loading]);

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
                  <ReadReceipts ann={ann} roster={roster} reads={reads} loading={loading && !reads} />
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
