import { useState, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { CustomSelect } from "../../components/CustomSelect.jsx";
import { categoryColor } from "../../category-colors.js";
import { CourseGuide } from "../student/CourseGuide.jsx";
import { normalizeGuide, guideHasContent } from "../../course-info.js";

// Authoring for "How this course works" — the orientation document students read on the Course
// Guide page.
//
// It mirrors the Syllabus tab's bargain: the instructor writes PROSE and Claude turns it into the
// structure the app can render well. The difference is only where the prose comes from. A syllabus
// arrives as a PDF; this text has always lived in the instructor's head and in a page inside a
// module, so it is pasted rather than uploaded. Everything Claude produces is then editable by
// hand, because a course's rhythm is the instructor's to state exactly, and an extraction is a
// first draft rather than an answer.
//
// The preview is the REAL student component, not a mock, for the same reason the quiz and homework
// previews run the real student runners: a mock drifts, and the whole point of the page is how it
// reads to a student.
const EXTRACTION_PROMPT = `You are converting a college instructor's free-text course instructions into structured JSON for a course website.

Return ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "rhythm": { "title": "", "intro": "", "steps": [{ "title": "", "kind": "", "body": "" }] },
  "policies": [{ "title": "", "body": "" }]
}

Rules:
- "rhythm.steps" is the repeating cycle of activities the student is asked to work through (for example a weekly sequence). Keep the instructor's own ordering and their own wording as closely as possible. Strip any leading numbering from "title", since the steps are numbered when displayed.
- "rhythm.title" is a short label for that cycle, such as "Your week". "rhythm.intro" is any sentence that introduces the cycle before the steps begin.
- "kind" classifies a step as one of exactly: "quiz", "homework", "reading", "lab". Use an empty string for any step that is not one of those four (for example attending class, or reviewing notes). Never guess: an empty string is correct whenever the step is not clearly one of the four.
- "policies" is everything else, rendered as titled cards: deadlines, grading rules, expectations, per-activity detail, and any greeting or introductory message addressed to the student. Give each a short title of a few words and keep the instructor's body text.
- Preserve the instructor's voice. Do not summarize, do not add advice, and do not add anything the source text does not say.
- Use plain text only: no markdown, no asterisks, and no em-dashes.`;

const STEP_KINDS = [
  { value: "", label: "No color" },
  { value: "quiz", label: "Quiz" },
  { value: "homework", label: "Homework" },
  { value: "reading", label: "Reading" },
  { value: "lab", label: "Lab" },
];

const EMPTY = { rhythm: { title: "", intro: "", steps: [] }, policies: [] };

export function InstructorGuide({ guide, onSaveGuide }) {
  const { s, text, muted, border, teal } = useTheme();
  const [draft, setDraft] = useState(() => structuredClone(guide || EMPTY));
  const [source, setSource] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  // Adopt a guide that arrived after this screen mounted: the class data load finishing, a class
  // switch, or this screen's own save. Identity is safe to key on here ONLY because
  // refreshClassContent runs in the student portal and never the instructor's — a 60s poll would
  // hand back a fresh object every minute and wipe whatever was half-typed.
  useEffect(() => { setDraft(structuredClone(guide || EMPTY)); setSaved(false); }, [guide]);

  const patch = fn => { setDraft(d => { const next = structuredClone(d); fn(next); return next; }); setSaved(false); };
  const steps = draft.rhythm?.steps || [];
  const policies = draft.policies || [];

  const structure = async () => {
    if (!source.trim()) return;
    setError(""); setExtracting(true);
    try {
      const resp = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [{ role: "user", content: [{ type: "text", text: `${EXTRACTION_PROMPT}\n\nThe instructor's text follows.\n\n${source}` }] }],
        }),
      });
      const data = await resp.json();
      const raw = (data?.content?.[0]?.text || "").trim();
      const jsonText = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
      const parsed = normalizeGuide(JSON.parse(jsonText));
      if (!parsed) throw new Error("Nothing could be read from that text.");
      // Merged into the current draft rather than replacing it: new cards are appended, and the
      // rhythm is only overwritten when the extraction actually found one. Structuring a second
      // block of text therefore cannot silently drop what is already there.
      setDraft(d => ({
        rhythm: parsed.rhythm.steps.length ? parsed.rhythm : d.rhythm,
        policies: [...(d.policies || []), ...parsed.policies],
      }));
      setSource("");
      setSaved(false);
    } catch (ex) {
      console.warn("Guide extraction failed:", ex);
      setError("That text could not be read. You can edit the fields below by hand, or try again.");
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      await onSaveGuide(guideHasContent(normalizeGuide(draft)) ? draft : null);
      setSaved(true);
    } catch (ex) {
      setError(ex.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { ...s.input, padding: "9px 12px", fontSize: 14 };
  const areaStyle = { ...fieldStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 };

  if (preview) {
    return (
      <div>
        <Header text={text} muted={muted}>
          <button onClick={() => setPreview(false)} style={{ ...s.btnGhost, width: "auto", fontSize: 13 }}>← Back to editing</button>
        </Header>
        <div style={{ ...s.card, padding: 24 }}>
          <CourseGuide guide={normalizeGuide(draft)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header text={text} muted={muted}>
        <button onClick={() => setPreview(true)} style={{ ...s.btnGhost, width: "auto", fontSize: 13 }}>Preview</button>
        <button onClick={save} disabled={saving} style={{ ...s.btnGhost, width: "auto", fontSize: 13, color: teal, borderColor: teal, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : saved ? "Saved" : "Save guide"}
        </button>
      </Header>

      {error && (
        <div style={{ ...s.card, padding: 14, marginBottom: 16, borderColor: "#f87171", color: "#f87171", fontSize: 13 }}>{error}</div>
      )}

      {/* Paste-and-structure. Kept at the top because it is how a guide starts, and it stays
          afterwards because a policy added mid-term is pasted the same way. */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <Label>Paste your instructions</Label>
        <textarea
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="Paste the weekly instructions or policies you already have. Claude will sort them into the fields below, which you can then edit."
          style={{ ...areaStyle, minHeight: 130 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button
            onClick={structure}
            disabled={extracting || !source.trim()}
            style={{ ...s.btnGhost, width: "auto", fontSize: 13, color: teal, borderColor: teal, opacity: extracting || !source.trim() ? 0.5 : 1 }}
          >{extracting ? "Reading…" : "Structure with Claude"}</button>
          <span style={{ ...s.muted, fontSize: 12 }}>Adds to what is already below. Nothing is replaced without your edit.</span>
        </div>
      </div>

      {/* Rhythm */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <Label>The repeating cycle</Label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={draft.rhythm?.title || ""}
            onChange={e => patch(d => { d.rhythm.title = e.target.value; })}
            placeholder="Section title (for example: Your week)"
            style={{ ...fieldStyle, flex: "1 1 240px" }}
          />
        </div>
        <textarea
          value={draft.rhythm?.intro || ""}
          onChange={e => patch(d => { d.rhythm.intro = e.target.value; })}
          placeholder="Optional sentence introducing the cycle."
          style={{ ...areaStyle, minHeight: 70, marginBottom: 16 }}
        />

        {steps.map((step, i) => (
          <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0, fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: categoryColor(step.kind, null) || "transparent",
                border: categoryColor(step.kind, null) ? "none" : `2px solid ${border}`,
                color: categoryColor(step.kind, null) ? "#10161a" : muted,
              }}>{i + 1}</span>
              <input
                value={step.title || ""}
                onChange={e => patch(d => { d.rhythm.steps[i].title = e.target.value; })}
                placeholder="Step title"
                style={{ ...fieldStyle, flex: 1, minWidth: 120 }}
              />
              <CustomSelect
                variant="input"
                value={step.kind || ""}
                onChange={v => patch(d => { d.rhythm.steps[i].kind = v || null; })}
                options={STEP_KINDS}
              />
              <MoveBtns i={i} n={steps.length} onMove={to => patch(d => { const a = d.rhythm.steps; [a[i], a[to]] = [a[to], a[i]]; })} />
              <RemoveBtn onClick={() => patch(d => { d.rhythm.steps.splice(i, 1); })} />
            </div>
            <textarea
              value={step.body || ""}
              onChange={e => patch(d => { d.rhythm.steps[i].body = e.target.value; })}
              placeholder="What the student does at this step."
              style={{ ...areaStyle, minHeight: 60 }}
            />
          </div>
        ))}
        <button
          onClick={() => patch(d => { d.rhythm.steps.push({ title: "", kind: null, body: "" }); })}
          style={{ ...s.btnGhost, width: "auto", fontSize: 13 }}
        >+ Add step</button>
      </div>

      {/* Policies */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <Label>Policy cards</Label>
        {policies.map((p, i) => (
          <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <input
                value={p.title || ""}
                onChange={e => patch(d => { d.policies[i].title = e.target.value; })}
                placeholder="Card title (for example: Quizzes)"
                style={{ ...fieldStyle, flex: 1, minWidth: 120 }}
              />
              <MoveBtns i={i} n={policies.length} onMove={to => patch(d => { const a = d.policies; [a[i], a[to]] = [a[to], a[i]]; })} />
              <RemoveBtn onClick={() => patch(d => { d.policies.splice(i, 1); })} />
            </div>
            <textarea
              value={p.body || ""}
              onChange={e => patch(d => { d.policies[i].body = e.target.value; })}
              placeholder="The policy, in your own words."
              style={areaStyle}
            />
          </div>
        ))}
        <button
          onClick={() => patch(d => { d.policies.push({ title: "", body: "" }); })}
          style={{ ...s.btnGhost, width: "auto", fontSize: 13 }}
        >+ Add policy card</button>
      </div>
    </div>
  );
}

function Header({ text, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: 0 }}>Course Guide</h2>
      <div style={{ display: "flex", gap: 8 }}>{children}</div>
    </div>
  );
}

function Label({ children }) {
  const { teal } = useTheme();
  return (
    <div style={{ color: teal, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function MoveBtns({ i, n, onMove }) {
  const { border, muted } = useTheme();
  const btn = { background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "4px 7px", cursor: "pointer", fontSize: 11, lineHeight: 1 };
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button title="Move up" disabled={i === 0} onClick={() => onMove(i - 1)} style={{ ...btn, opacity: i === 0 ? 0.35 : 1 }}>▲</button>
      <button title="Move down" disabled={i === n - 1} onClick={() => onMove(i + 1)} style={{ ...btn, opacity: i === n - 1 ? 0.35 : 1 }}>▼</button>
    </div>
  );
}

function RemoveBtn({ onClick }) {
  const { border, muted } = useTheme();
  return (
    <button
      title="Remove"
      onClick={onClick}
      style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, lineHeight: 1, flexShrink: 0 }}
    >✕</button>
  );
}
