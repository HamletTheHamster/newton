import { useState } from "react";
import { useTheme } from "../../theme.js";
import { fbSet } from "../../firebase.js";
import { dueToDate } from "../../utils.js";

const SURVEY_QUESTIONS = [
  { id: "q1", text: "Course requirements are stated clearly in the syllabus.", section: "course" },
  { id: "q2", text: "The course is organized in a way that helps me learn.", section: "course" },
  { id: "q3", text: "The grading criteria for each assignment are clear.", section: "course" },
  { id: "q4", text: "The assignments help me understand the subject more clearly.", section: "course" },
  { id: "q5", text: "The instructor answers questions and concerns in a timely manner.", section: "instructor" },
  { id: "q6", text: "The instructor provides constructive feedback on assignments.", section: "instructor" },
  { id: "q7", text: "The instructor shows respect for students.", section: "instructor" },
];

const LIKERT = ["SA", "A", "D", "SD"];
const LIKERT_LABELS = { SA: "Strongly Agree", A: "Agree", D: "Disagree", SD: "Strongly Disagree" };

function surveyIsAvailable(mergedModules) {
  const withDates = mergedModules.filter(m => m.releaseDate);
  if (withDates.length === 0) return true;
  const last = withDates.reduce((a, b) =>
    (dueToDate(a.releaseDate) || 0) > (dueToDate(b.releaseDate) || 0) ? a : b
  );
  return new Date() >= (dueToDate(last.releaseDate) || 0);
}

export function CourseEvals({ classId, mergedModules, courseEvals, setCourseEvals }) {
  const { s, text, muted } = useTheme();
  const [quickMsg, setQuickMsg] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickStatus, setQuickStatus] = useState("");

  const [likert, setLikert] = useState({});
  const [surveyText, setSurveyText] = useState({ suggestions: "", assignment: "", best: "" });
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyStatus, setSurveyStatus] = useState("");

  const quickSubmitted = (() => { try { return !!localStorage.getItem(`newton_eval_quick_${classId}`); } catch { return false; } })();
  const surveySubmitted = (() => { try { return !!localStorage.getItem(`newton_eval_survey_${classId}`); } catch { return false; } })();
  const surveyAvailable = surveyIsAvailable(mergedModules);

  const submitQuick = async () => {
    if (!quickMsg.trim() || quickSubmitting) return;
    setQuickSubmitting(true);
    const id = Date.now().toString();
    const record = { id, type: "quick", classId, message: quickMsg.trim(), timestamp: new Date().toISOString(), read: false };
    const updated = { ...courseEvals, [id]: record };
    try {
      await fbSet("courseEvals", updated);
      setCourseEvals(updated);
      try { localStorage.setItem(`newton_eval_quick_${classId}`, "1"); } catch {}
      setQuickStatus("done");
      setQuickMsg("");
    } catch {
      setQuickStatus("error");
    }
    setQuickSubmitting(false);
  };

  const allAnswered = SURVEY_QUESTIONS.every(q => likert[q.id]);

  const submitSurvey = async () => {
    if (!allAnswered || surveySubmitting) return;
    setSurveySubmitting(true);
    const id = (Date.now() + 1).toString();
    const record = { id, type: "survey", classId, responses: likert, openEnded: surveyText, timestamp: new Date().toISOString(), read: false };
    const updated = { ...courseEvals, [id]: record };
    try {
      await fbSet("courseEvals", updated);
      setCourseEvals(updated);
      try { localStorage.setItem(`newton_eval_survey_${classId}`, "1"); } catch {}
      setSurveyStatus("done");
    } catch {
      setSurveyStatus("error");
    }
    setSurveySubmitting(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: "0 0 6px" }}>Course Evaluations</h2>
        <p style={{ ...s.muted, margin: 0, fontSize: 13 }}>
          Your feedback helps improve this course. All submissions are completely anonymous — your name is never stored with your responses.
        </p>
      </div>

      {/* Quick Feedback */}
      <div style={{ ...s.card, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>Quick Feedback</h3>
          <span style={s.badge("#00828c")}>Always open</span>
        </div>
        <p style={{ ...s.muted, fontSize: 13, margin: "0 0 16px" }}>
          Share anything — suggestions, concerns, or thoughts. You can submit as many times as you like throughout the semester.
        </p>
        {quickStatus === "done" ? (
          <p style={{ color: "#4ade80", fontSize: 14, margin: 0 }}>Thank you for your feedback!</p>
        ) : (
          <>
            <textarea
              style={{ ...s.input, height: 100, resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
              placeholder="What's on your mind? Any suggestions, concerns, or thoughts are welcome…"
              value={quickMsg}
              onChange={e => setQuickMsg(e.target.value)}
            />
            {quickStatus === "error" && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>Failed to submit. Please try again.</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={submitQuick}
                disabled={!quickMsg.trim() || quickSubmitting}
                style={{ ...s.btnPri, width: "auto", opacity: !quickMsg.trim() || quickSubmitting ? 0.5 : 1 }}
              >
                {quickSubmitting ? "Submitting…" : "Submit Feedback"}
              </button>
              {quickSubmitted && <span style={{ ...s.muted, fontSize: 12 }}>You've submitted before — feel free to submit again anytime.</span>}
            </div>
          </>
        )}
      </div>

      {/* End-of-Course Survey */}
      <div style={{ ...s.card, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>End-of-Course Survey</h3>
          {!surveyAvailable && <span style={s.badge(muted)}>Available at semester's end</span>}
        </div>

        {!surveyAvailable ? (
          <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>
            This survey opens when the last lecture module is released. Check back near the end of the semester.
          </p>
        ) : (surveySubmitted || surveyStatus === "done") ? (
          <p style={{ color: "#4ade80", fontSize: 14, margin: 0 }}>Thank you for completing the end-of-course survey!</p>
        ) : (
          <>
            <p style={{ ...s.muted, fontSize: 13, margin: "0 0 24px" }}>
              Please rate each statement below. All responses are completely anonymous.
            </p>

            <SectionLabel>Course</SectionLabel>
            {SURVEY_QUESTIONS.filter(q => q.section === "course").map(q => (
              <LikertRow key={q.id} q={q} value={likert[q.id]} onChange={v => setLikert(p => ({ ...p, [q.id]: v }))} />
            ))}

            <SectionLabel style={{ marginTop: 20 }}>Instructor</SectionLabel>
            {SURVEY_QUESTIONS.filter(q => q.section === "instructor").map(q => (
              <LikertRow key={q.id} q={q} value={likert[q.id]} onChange={v => setLikert(p => ({ ...p, [q.id]: v }))} />
            ))}

            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <OpenEndedField
                label="What suggestions do you have to improve this course?"
                value={surveyText.suggestions}
                onChange={v => setSurveyText(p => ({ ...p, suggestions: v }))}
              />
              <OpenEndedField
                label="The assignment that most contributed to my learning:"
                value={surveyText.assignment}
                onChange={v => setSurveyText(p => ({ ...p, assignment: v }))}
              />
              <OpenEndedField
                label="What did you like best about this course?"
                value={surveyText.best}
                onChange={v => setSurveyText(p => ({ ...p, best: v }))}
              />
            </div>

            {surveyStatus === "error" && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>Failed to submit. Please try again.</p>}

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={submitSurvey}
                disabled={!allAnswered || surveySubmitting}
                style={{ ...s.btnPri, width: "auto", opacity: !allAnswered || surveySubmitting ? 0.5 : 1 }}
              >
                {surveySubmitting ? "Submitting…" : "Submit Survey"}
              </button>
              {!allAnswered && <span style={{ ...s.muted, fontSize: 12 }}>Please answer all rating questions to submit.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  const { teal } = useTheme();
  return (
    <p style={{ color: teal, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px", ...style }}>
      {children}
    </p>
  );
}

function LikertRow({ q, value, onChange }) {
  const { text, muted, border, teal } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${border}` }}>
      <p style={{ color: text, fontSize: 14, flex: 1, margin: 0, lineHeight: 1.5 }}>{q.text}</p>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {LIKERT.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            title={LIKERT_LABELS[opt]}
            style={{
              padding: "5px 14px",
              border: `1px solid ${value === opt ? teal : border}`,
              borderRadius: 6,
              background: value === opt ? "rgba(0,130,140,0.2)" : "transparent",
              color: value === opt ? teal : muted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: value === opt ? 700 : 400,
              transition: "all 0.1s",
              minWidth: 110,
              whiteSpace: "nowrap",
            }}
          >
            {LIKERT_LABELS[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

function OpenEndedField({ label, value, onChange }) {
  const { s } = useTheme();
  return (
    <div>
      <label style={{ ...s.label, marginBottom: 6, display: "block", fontSize: 13 }}>{label}</label>
      <textarea
        style={{ ...s.input, height: 80, resize: "vertical", fontFamily: "inherit" }}
        placeholder="Optional"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
