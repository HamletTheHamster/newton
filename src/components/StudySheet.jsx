import { useTheme } from "../theme.js";
import { keyToValue, keyToVectorValue, keyToFBDValue } from "../homework.js";
import { MathText } from "./MathText.jsx";
import { GraphField } from "./GraphField.jsx";
import { VectorField } from "./VectorField.jsx";
import { FBDField } from "./FBDField.jsx";

// The downloadable PDF of an assignment, for studying from.
//
// It is deliberately NOT a print of the submission viewer. That screen exists to settle a grade:
// it leads with a score, and every row carries attempts, points earned, on-time/late credit and
// the student's own wrong answer. A student revising for an exam needs none of that, and the one
// thing they do need is the thing the grading screen withholds — the CORRECT answer, which it
// only prints when you got the question wrong. So this is its own document: the problems as they
// were posed, with their figures, and the right answer under each one.
//
// Where the answers come from: `row.correctAnswer` is written by the server at final submit
// (`grade.js` → `formatNumeric(answer, sigFigs, unit, sci)`) for EVERY non-graphical item, not
// just the missed ones, and it is already formatted to the problem's significant figures and
// carries its unit. That is why a study answer reads "2.0 C" where the viewer showed a bare
// "2.0": the viewer was printing what the student typed. Graphical items have no stored string —
// their answer is a shape, so the keyed diagram is rendered instead.

// Most part prompts in the course files already open with their own "(a) ", but not all of them
// do. Splitting the label off the text normalizes both, so the sheet letters every part itself
// and never prints "(a) (a) How much charge…".
//
// The source's own letters are preferred, because a student revising with the textbook open wants
// the book's numbering. They are dropped for positional letters when they do not survive it: one
// source part that asks for two quantities becomes two blanks here (hw1 21.9(b) is "the smaller"
// and "the larger"), and two rows both labelled "(b)" reads as a bug even though it is faithful.
function partLabels(parts) {
  const found = (parts || []).map((row, i) => {
    const m = /^\s*\(([a-h])\)\s*/i.exec(row.prompt || "");
    return m
      ? { label: m[1].toLowerCase(), text: (row.prompt || "").slice(m[0].length) }
      : { label: null, text: row.prompt || "" };
  });
  const labels = found.map(f => f.label);
  const usable = labels.every(Boolean) && new Set(labels).size === labels.length;
  return found.map((f, i) => ({ label: usable ? f.label : ("abcdefgh"[i] || String(i + 1)), text: f.text }));
}

const isGraphical = t => t === "graph" || t === "vector" || t === "fbd";

// One answer, whatever shape it takes. `missed` is the single piece of the student's own history
// the sheet keeps: not a score, just which ones are worth working again.
function Answer({ row, missed }) {
  const { text, muted, teal, border } = useTheme();
  const label = (
    <span style={{ color: teal, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", flexShrink: 0, paddingTop: 2 }}>
      Answer
    </span>
  );
  const review = missed && (
    <span style={{ color: "#b45309", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", flexShrink: 0, paddingTop: 2 }}>review</span>
  );
  // A `math` answer is a bare expression, and KaTeX sets an inline fraction at roughly half the
  // surrounding size - at body size the denominator of the hw1 21.30 key is close to unreadable
  // in print. Nothing else needs the bump.
  const size = row.answerType === "math" ? 16 : 13.5;
  const shell = kids => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${border}` }}>
      {label}
      <div style={{ flex: 1, color: text, fontSize: size, lineHeight: 1.55 }}>{kids}</div>
      {review}
    </div>
  );

  if (isGraphical(row.answerType)) {
    const cfg = row.graph || row.vector || row.fbd;
    if (!cfg) return shell(<span style={{ color: muted }}>Not recorded.</span>);
    const value = JSON.stringify(
      row.answerType === "graph" ? keyToValue(row.graph)
        : row.answerType === "vector" ? keyToVectorValue(row.vector)
          : keyToFBDValue(row.fbd)
    );
    return shell(
      <div style={{ maxWidth: row.answerType === "fbd" ? 420 : 340 }}>
        {row.answerType === "graph" && <GraphField config={row.graph} value={value} readOnly />}
        {row.answerType === "vector" && <VectorField config={row.vector} value={value} readOnly />}
        {row.answerType === "fbd" && <FBDField config={row.fbd} value={value} readOnly />}
      </div>
    );
  }
  if (row.correctAnswer == null || row.correctAnswer === "") {
    // An auto-submitted record can reach here: the deadline sweep writes what the draft held and
    // never calls the reveal endpoint, so an untouched item has no answer to print. Saying so is
    // better than an empty rule, which reads as a rendering bug.
    return shell(<span style={{ color: muted }}>Not recorded for this problem.</span>);
  }
  const body = row.answerType === "math" ? `$${row.correctAnswer}$` : String(row.correctAnswer);
  return shell(<MathText>{body}</MathText>);
}

// Shared with the submission viewer (SubmissionView.jsx), so a figure is sized by one rule
// wherever a recorded problem is shown. Includes its own centering wrapper.
export function ProblemFigure({ src, width }) {
  const { border } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
      <img
        src={src}
        alt="Problem figure"
        style={{
          width: width || "auto", maxWidth: "100%",
          ...(width ? {} : { maxHeight: 480 }),
          height: "auto", borderRadius: 8, border: `1px solid ${border}`, breakInside: "avoid",
        }}
      />
    </div>
  );
}

// A homework: numbered problems, each with its figure, its stem and its lettered parts.
function HomeworkBody({ submission }) {
  const { text, muted, border } = useTheme();
  const problems = submission.problems || [];
  if (problems.length === 0) {
    return <div style={{ color: muted, fontSize: 13 }}>No problems were recorded for this assignment.</div>;
  }
  return problems.map((p, i) => {
    const parts = p.parts || null;
    return (
      <div key={p.id || i} style={{ display: "flex", gap: 16, alignItems: "flex-start", breakInside: "avoid", paddingBottom: 18, marginBottom: 18, borderBottom: i < problems.length - 1 ? `1px solid ${border}` : "none" }}>
        <div style={{ color: muted, fontSize: 22, fontWeight: 700, lineHeight: 1, width: 28, flexShrink: 0, textAlign: "right", paddingTop: 1 }}>{i + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {p.figure && <ProblemFigure src={p.figure} width={p.figureWidth} />}
          {p.prompt && (
            <div style={{ color: text, fontSize: 13.5, lineHeight: 1.6 }}><MathText>{p.prompt}</MathText></div>
          )}
          {/* Single-part problem: the row IS the problem, so its prompt is the stem already
              printed above and only the answer is still owed. */}
          {!parts && <Answer row={p} missed={p.status !== "correct"} />}
          {parts && (() => {
            const labelled = partLabels(parts);
            return parts.map((row, j) => {
            const { label, text: body } = labelled[j];
            return (
              <div key={row.id || j} style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: muted, fontSize: 13, fontWeight: 700, flexShrink: 0, paddingTop: 1 }}>({label})</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: text, fontSize: 13.5, lineHeight: 1.6 }}><MathText>{body}</MathText></div>
                  <Answer row={row} missed={row.status !== "correct"} />
                </div>
              </div>
            );
            });
          })()}
        </div>
      </div>
    );
  });
}

// A quiz: the dialogue, stripped to what teaches. A quiz has no stored answer key — it is graded
// conversationally — so the tutor's reply IS the explanation, and it only makes sense beside the
// answer it is replying to. Both are kept for that reason; the score card and the housekeeping
// messages are not.
function QuizBody({ submission }) {
  const { text, muted, border, teal } = useTheme();
  const msgs = submission.dialogue || [];
  if (msgs.length === 0) {
    return <div style={{ color: muted, fontSize: 13 }}>No dialogue was recorded for this quiz.</div>;
  }
  const rows = [];
  let qn = 0;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.type === "question") {
      qn += 1;
      rows.push(
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: rows.length ? 18 : 0, paddingTop: rows.length ? 18 : 0, borderTop: rows.length ? `1px solid ${border}` : "none", breakInside: "avoid" }}>
          <div style={{ color: muted, fontSize: 22, fontWeight: 700, lineHeight: 1, width: 28, flexShrink: 0, textAlign: "right" }}>{qn}</div>
          <div style={{ flex: 1, minWidth: 0, color: text, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {m.split
              ? <>{m.split.stem && <div style={{ marginBottom: 6 }}>{m.split.stem}</div>}<div><strong style={{ color: muted }}>({m.split.parts[0].label})</strong> {m.split.parts[0].text}</div></>
              : m.q?.text}
          </div>
        </div>
      );
    } else if (m.type === "part") {
      rows.push(
        <div key={i} style={{ marginLeft: 44, marginTop: 10, color: text, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          <strong style={{ color: muted }}>({m.label})</strong> {m.text}
        </div>
      );
    } else if (m.type === "student") {
      rows.push(
        <div key={i} style={{ marginLeft: 44, marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ color: muted, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", flexShrink: 0, paddingTop: 2 }}>You</span>
          <div style={{ flex: 1, color: text, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {m.imageUrl && <img src={m.imageUrl} alt="Your drawing" style={{ display: "block", maxWidth: 320, maxHeight: 240, objectFit: "contain", borderRadius: 6, border: `1px solid ${border}`, marginBottom: m.text ? 6 : 0 }} />}
            {m.text}
          </div>
        </div>
      );
    } else if (m.type === "tutor") {
      rows.push(
        <div key={i} style={{ marginLeft: 44, marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${teal}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ color: teal, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", flexShrink: 0, paddingTop: 2 }}>Feedback</span>
          <div style={{ flex: 1, color: text, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.text}</div>
        </div>
      );
    }
    // `system` (housekeeping) and `result` (the score card) are deliberately dropped.
  }
  return rows;
}

// `studentName` is printed because the sheet keeps one personal mark (which items to work again),
// so two students' copies are not interchangeable. Nothing else about the grade appears.
export function StudySheet({ submission, assignmentTitle, studentName }) {
  const { text, muted, border } = useTheme();
  const isHomework = submission.type === "homework";
  const meta = [isHomework ? "Problems and answers" : "Questions and answers", studentName, new Date().toLocaleDateString()]
    .filter(Boolean)
    .join(" · ");
  return (
    <div style={{ color: text }}>
      <div style={{ borderBottom: `2px solid ${border}`, paddingBottom: 10, marginBottom: 20 }}>
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{assignmentTitle}</div>
        <div style={{ color: muted, fontSize: 11.5, marginTop: 5 }}>{meta}</div>
      </div>
      {isHomework ? <HomeworkBody submission={submission} /> : <QuizBody submission={submission} />}
      <div style={{ color: muted, fontSize: 10.5, marginTop: 22, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
        Newton
      </div>
    </div>
  );
}
