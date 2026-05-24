import { s, TEAL, TEAL_DIM, MUTED, BORDER } from "../../theme.js";

// Matches CAT_COLORS in Gradebook.jsx
const CAT_COLORS = {
  lab:     "#818cf8",
  hw:      "#60a5fa",
  quiz:    "#34d399",
  midterm: "#fbbf24",
  final:   "#f87171",
};

function gradingColor(name) {
  const n = name.toLowerCase();
  if (n.includes("lab"))                        return CAT_COLORS.lab;
  if (n.includes("homework") || n === "hw")     return CAT_COLORS.hw;
  if (n.includes("quiz"))                       return CAT_COLORS.quiz;
  if (n.includes("midterm") || n.includes("mid")) return CAT_COLORS.midterm;
  if (n.includes("final"))                      return CAT_COLORS.final;
  return TEAL;
}

export function StudentSyllabus({ syllabus }) {
  const fields = syllabus?.fields;
  const pdf = syllabus?.pdf;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: 0 }}>Syllabus</h2>
        {pdf?.downloadUrl && (
          <button
            style={{ ...s.btnGhost, color: TEAL, borderColor: TEAL, fontSize: 13 }}
            onClick={() => window.open(pdf.downloadUrl, "_blank", "noopener,noreferrer")}
          >
            Open PDF ↗
          </button>
        )}
      </div>

      {!fields ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>
          No syllabus has been posted yet.
        </div>
      ) : (
        <>
          {/* Course info */}
          {fields.course && (
            <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                {fields.course.number && (
                  <span style={{ color: TEAL, fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{fields.course.number}</span>
                )}
                {fields.course.title && (
                  <span style={{ color: "#fff", fontWeight: 600, fontSize: 18 }}>{fields.course.title}</span>
                )}
                {fields.course.credits > 0 && (
                  <span style={s.badge(TEAL)}>{fields.course.credits} credits</span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
                {fields.course.term && <InfoPair label="Term" value={fields.course.term} />}
                {fields.course.section && <InfoPair label="Section" value={fields.course.section} />}
                {fields.course.schedule && <InfoPair label="Schedule" value={fields.course.schedule} />}
                {fields.course.location && <InfoPair label="Location" value={fields.course.location} />}
              </div>
            </div>
          )}

          {/* Instructor */}
          {fields.instructor && (
            <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <CardLabel>Instructor</CardLabel>
              {fields.instructor.name && (
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 17, marginBottom: 14 }}>{fields.instructor.name}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields.instructor.email && <ContactRow label="Email" value={fields.instructor.email} />}
                {fields.instructor.phone && <ContactRow label="Phone" value={fields.instructor.phone} />}
                {fields.instructor.office && <ContactRow label="Office" value={fields.instructor.office} />}
              </div>
              {fields.instructor.officeHours?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 8 }}>
                    Office Hours
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fields.instructor.officeHours.map((h, i) => (
                      <span key={i} style={{ background: TEAL_DIM, color: TEAL, border: `1px solid rgba(0,130,140,0.35)`, borderRadius: 6, padding: "4px 12px", fontSize: 13 }}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {fields.description && (
            <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <CardLabel>Course Description</CardLabel>
              <p style={{ color: "#fff", fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{fields.description}</p>
            </div>
          )}

          {/* Materials */}
          {fields.materials?.length > 0 && (
            <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <CardLabel>Required Materials</CardLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fields.materials.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ ...s.badge(m.required !== false ? TEAL : MUTED), flexShrink: 0, marginTop: 2 }}>
                      {m.label || (m.required !== false ? "Required" : "Optional")}
                    </span>
                    <div>
                      <span style={{ color: "#fff", fontSize: 14 }}>{m.title}</span>
                      {m.author && <span style={{ color: MUTED, fontSize: 13 }}> — {m.author}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grading */}
          {fields.gradingBreakdown?.length > 0 && (
            <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <CardLabel>Grading</CardLabel>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px" }}>
                  {/* Stacked bar */}
                  <div style={{ display: "flex", height: 22, borderRadius: 8, overflow: "hidden", marginBottom: 14, gap: 2 }}>
                    {fields.gradingBreakdown.map((g, i) => (
                      <div
                        key={i}
                        title={`${g.name}: ${g.weight}%`}
                        style={{ flex: `0 0 ${g.weight}%`, background: gradingColor(g.name), height: "100%" }}
                      />
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                    {fields.gradingBreakdown.map((g, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: gradingColor(g.name), flexShrink: 0 }} />
                        <span style={{ color: "#fff", fontSize: 13 }}>{g.name}</span>
                        <span style={{ color: MUTED, fontSize: 13 }}>{g.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {fields.gradingScale?.length > 0 && (
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ color: MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 10 }}>
                      Grade Scale
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 20, rowGap: 5 }}>
                      {fields.gradingScale.map((g, i) => (
                        <div key={i} style={{ display: "contents" }}>
                          <span style={{ color: TEAL, fontWeight: 700, fontSize: 13 }}>{g.grade}</span>
                          <span style={{ color: MUTED, fontSize: 13 }}>{g.min}%+</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Policies */}
          {fields.policies?.length > 0 && fields.policies.map((p, i) => (
            <div key={i} style={{ ...s.card, padding: 24, marginBottom: 16 }}>
              <CardLabel>{p.title}</CardLabel>
              <p style={{ color: "#fff", fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{p.body}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CardLabel({ children }) {
  return (
    <div style={{ color: TEAL, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function InfoPair({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>{label}:</span>
      <span style={{ color: "#fff", fontSize: 14 }}>{value}</span>
    </div>
  );
}

function ContactRow({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: MUTED, fontSize: 13, width: 46, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#fff", fontSize: 14 }}>{value}</span>
    </div>
  );
}
