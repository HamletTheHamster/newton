import { useState, useRef } from "react";
import { TEAL, useTheme } from "../../theme.js";
import { fbDeleteStorage } from "../../firebase.js";
import { StudentSyllabus } from "../student/StudentSyllabus.jsx";

function fmtBytes(b) {
  if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
  if (b >= 1024) return Math.round(b / 1024) + " KB";
  return b + " B";
}

const EXTRACTION_PROMPT = `You are extracting structured information from a college course syllabus PDF.
Return ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "course": { "number":"","title":"","credits":0,"term":"","section":"","schedule":"","location":"" },
  "instructor": { "name":"","email":"","phone":"","office":"","officeHours":[] },
  "description": "",
  "materials": [{ "label":"","title":"","author":"","required":true }],
  "gradingBreakdown": [{ "name":"","weight":0 }],
  "gradingScale": [{ "grade":"","min":0 }],
  "policies": [{ "title":"","body":"" }]
}
Use empty string or 0 for any fields not found in the document. officeHours should be an array of strings like ["Mon 2–3 PM", "By appointment"].`;

export function InstructorSyllabus({ syllabus, classId, syllabusMismatch, onUploadFile, onSaveSyllabus, onDeleteSyllabus }) {
  const { s, muted, text } = useTheme();
  const [progress, setProgress] = useState(null);  // 0–1 while uploading, null otherwise
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const hasPdf = !!syllabus?.pdf?.downloadUrl;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }
    if (file.size >= 25 * 1024 * 1024) {
      setError("File is too large (max 25 MB).");
      return;
    }

    setError("");
    setProgress(0);

    try {
      // Delete old Storage file if replacing
      if (syllabus?.pdf?.storagePath) {
        try { await fbDeleteStorage(syllabus.pdf.storagePath); } catch (ex) { console.warn("Old syllabus delete failed:", ex); }
      }

      // Upload new file
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `classes/${classId}/syllabus/${safeName}`;
      const result = await onUploadFile(storagePath, file, p => setProgress(p));

      const pdfMeta = {
        storagePath: result.storagePath,
        downloadUrl: result.downloadUrl,
        name: file.name,
        size: result.size,
        mime: result.mime,
        uploadedAt: new Date().toISOString(),
      };

      // Extract fields via Claude
      setProgress(null);
      setExtracting(true);

      let fields = null;
      try {
        const resp = await fetch("/.netlify/functions/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            messages: [{
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "url", url: pdfMeta.downloadUrl },
                },
                { type: "text", text: EXTRACTION_PROMPT },
              ],
            }],
          }),
        });

        const data = await resp.json();
        const raw = (data?.content?.[0]?.text || "").trim();
        const jsonText = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
        fields = JSON.parse(jsonText);
      } catch (ex) {
        console.warn("Syllabus extraction failed:", ex);
        setError("PDF uploaded, but field extraction failed. You can re-upload to try again.");
      }

      await onSaveSyllabus({ pdf: pdfMeta, fields });
      setExtracting(false);
    } catch (ex) {
      setError(ex.message || "Upload failed.");
      setProgress(null);
      setExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Remove the syllabus PDF? Students will no longer see any syllabus content.")) return;
    try {
      if (syllabus?.pdf?.storagePath) {
        await fbDeleteStorage(syllabus.pdf.storagePath);
      }
      await onDeleteSyllabus();
    } catch (ex) {
      setError(ex.message || "Delete failed.");
    }
  };

  return (
    <div>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>Syllabus</h2>

      {!hasPdf ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center" }}>
          <p style={{ color: muted, fontSize: 14, margin: "0 0 8px", lineHeight: 1.6 }}>
            Upload the course syllabus PDF. Newton will automatically extract key information
            and display it to students on the Syllabus page.
          </p>
          <p style={{ color: muted, fontSize: 12, margin: "0 0 24px" }}>Max 25 MB · PDF only</p>
          <label style={{ ...s.btnPri, display: "inline-block", width: "auto", padding: "10px 28px", cursor: "pointer" }}>
            Upload Syllabus PDF
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
        </div>
      ) : (
        <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: text, fontWeight: 600, fontSize: 15, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {syllabus.pdf.name}
              </div>
              <div style={{ color: muted, fontSize: 13 }}>
                {fmtBytes(syllabus.pdf.size)} · Uploaded {new Date(syllabus.pdf.uploadedAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
              <button
                onClick={() => window.open(syllabus.pdf.downloadUrl, "_blank", "noopener,noreferrer")}
                style={{ ...s.btnGhost, color: TEAL, borderColor: TEAL, fontSize: 13 }}
              >
                Open ↗
              </button>
              <label style={{ ...s.btnGhost, cursor: "pointer", display: "inline-block", fontSize: 13, textAlign: "center" }}>
                Replace
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{ display: "none" }} />
              </label>
              <button onClick={handleDelete} style={{ ...s.btnDanger, width: "auto", padding: "8px 14px", fontSize: 13 }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {progress !== null && (
        <div style={{ ...s.card, padding: 16, marginBottom: 12 }}>
          <div style={{ color: muted, fontSize: 13, marginBottom: 8 }}>Uploading…</div>
          <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ background: TEAL, width: `${Math.round(progress * 100)}%`, height: "100%", borderRadius: 4, transition: "width 0.15s" }} />
          </div>
        </div>
      )}

      {/* Extraction in progress */}
      {extracting && (
        <div style={{ ...s.card, padding: 16, marginBottom: 12, color: TEAL, fontSize: 14, textAlign: "center" }}>
          Extracting syllabus fields…
        </div>
      )}

      {/* Error */}
      {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 14px" }}>{error}</p>}

      {/* Grade weight mismatch warning */}
      {syllabusMismatch && (
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <p style={{ color: "#fbbf24", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            <strong>Grade weights out of sync:</strong> The grade category weights in Grade Settings differ from the values in the syllabus PDF. Students see the PDF values. Replace the PDF above to keep the syllabus accurate.
          </p>
        </div>
      )}

      {/* Full syllabus content (matches student view) */}
      {hasPdf && syllabus.fields && !extracting && (
        <StudentSyllabus syllabus={syllabus} showHeader={false} />
      )}
    </div>
  );
}
