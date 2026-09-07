import { useTheme } from "../../theme.js";
import { categoryColor } from "../../category-colors.js";
import { renderWithLinks } from "../../components/AutoLink.jsx";
import { guideHasContent } from "../../course-info.js";

// "How this course works" — the orientation document, rendered as structure rather than as a wall
// of text in a modal.
//
// This is the Syllabus page's trick applied to prose the instructor already had. The syllabus does
// not read well because it was styled; it reads well because `syllabus.fields` is STRUCTURED DATA
// that Claude extracted from the PDF. The weekly instructions were structured all along too (a
// numbered rhythm, then per-activity policy) and were merely flattened into `white-space: pre-wrap`
// by the page editor. The instructor still writes prose; `courseGuide` is the structure.
//
// The one rule that makes the rhythm more than decoration: a step is COLORED only when it names
// something the app actually tracks, via the shared `categoryColor`. So step 1 "Quiz" wears the
// same green a quiz wears on the To Do rail, the calendar and the grades list, and step 4
// "Homework" the same blue — the page teaches the app's own vocabulary instead of describing it.
// Steps that happen off-app ("come to class", "review your notes") stay neutral rather than taking
// a hue of their own, which would imply a grading category that does not exist. A new color for a
// step belongs in category-colors.js or nowhere (see that file).
export function CourseGuide({ guide }) {
  const { s, text, muted, border, teal } = useTheme();

  if (!guideHasContent(guide)) {
    return (
      <div>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>How this course works</h2>
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
          <p style={{ margin: 0, fontSize: 14 }}>The course guide has not been posted yet.</p>
        </div>
      </div>
    );
  }

  const steps = guide.rhythm?.steps || [];

  return (
    <div>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>How this course works</h2>

      {steps.length > 0 && (
        <div style={{ ...s.card, padding: 24, marginBottom: 16 }}>
          <CardLabel label={guide.rhythm.title || "Your week"} />
          {guide.rhythm.intro && (
            <p style={{ color: text, fontSize: 14, lineHeight: 1.75, margin: "0 0 20px", whiteSpace: "pre-wrap" }}>
              {renderWithLinks(guide.rhythm.intro, teal)}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((step, i) => {
              const color = categoryColor(step.kind, null);
              const last = i === steps.length - 1;
              return (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                  {/* The disc and the thread below it. The thread is what makes the list read as
                      one repeating cycle rather than five unrelated instructions. */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 30, flexShrink: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      background: color || "transparent",
                      border: color ? "none" : `2px solid ${border}`,
                      color: color ? "#10161a" : muted,
                    }}>{i + 1}</div>
                    {!last && <div style={{ flex: 1, width: 2, background: border, marginTop: 6 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 22 }}>
                    <div style={{ color: text, fontWeight: 600, fontSize: 15, marginTop: 4 }}>{step.title}</div>
                    {step.body && (
                      <p style={{ ...s.muted, fontSize: 14, lineHeight: 1.7, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                        {renderWithLinks(step.body, teal)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(guide.policies || []).map((p, i) => (
        <div key={i} style={{ ...s.card, padding: 24, marginBottom: 16 }}>
          <CardLabel label={p.title} />
          <p style={{ color: text, fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
            {renderWithLinks(p.body, teal)}
          </p>
        </div>
      ))}
    </div>
  );
}

// Same uppercase teal card label the syllabus cards use, so the two orientation pages read as one
// pair rather than as two designs.
function CardLabel({ label }) {
  const { teal } = useTheme();
  if (!label) return null;
  return (
    <div style={{ color: teal, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
      {label}
    </div>
  );
}
