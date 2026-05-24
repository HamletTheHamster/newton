import { s, TEAL, MUTED } from "../../theme.js";

// Generic "Coming soon" placeholder for student sidebar pages
// that aren't built yet (Calendar, Syllabus, Announcements, Grades, Course Evals).
export function Stub({ title, description }) {
  return (
    <div>
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>{title}</h2>
      <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>
        <p style={{ color: TEAL, fontWeight: 600, fontSize: 14, margin: "0 0 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Coming Soon</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  );
}
