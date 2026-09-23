import { useState, useEffect } from "react";
import { courseLabelFor } from "./course-meta.js";

export const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ── Date / due-date helpers ───────────────────────────────────────────────────
export const dueToDate = due => {
  if (!due) return null;
  const datePart = due.slice(0, 10);
  const noon = new Date(datePart + 'T12:00:00Z');
  const isEDT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).format(noon).includes('EDT');
  const offset = isEDT ? '-04:00' : '-05:00';
  if (due.length === 10) return new Date(due + 'T23:59:00' + offset);
  // Accept both separators: assignment due dates are stored "YYYY-MM-DD HH:MM", while a
  // per-student deadline extension comes off a datetime picker as "YYYY-MM-DDTHH:MM". Falling
  // through to `new Date(due)` for the T form would read it in the VIEWER's timezone while every
  // other due date is pinned to Eastern, so the same wall-clock time would mean two things.
  if (due.length === 16 && (due[10] === ' ' || due[10] === 'T')) return new Date(datePart + 'T' + due.slice(11) + ':00' + offset);
  return new Date(due);
};

export const fmtDueTime = due => {
  if (!due || due.length === 10) return '11:59 PM';
  // Both separators, for the same reason as dueToDate: without the 'T' case an extension's own
  // time would display as the default 11:59 PM while actually falling due at another hour.
  if (due.length === 16 && (due[10] === ' ' || due[10] === 'T')) {
    const [h, m] = due.slice(11).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  return '11:59 PM';
};

export const isLate = due => due && new Date() > dueToDate(due);

// The due date that actually applies to ONE student. An instructor's per-student extension
// (`gradeOverrides[studentId][assignmentId].dueDate`, set from the Gradebook's "Extend Deadline")
// replaces the assignment's own. Without this the extension was display-only: it showed in the
// gradebook panel but every late check still read the assignment's date, so an extended student
// was still scored at half credit and still told their work was past due.
// The deadline as it applies to ONE student: a per-student extension
// (`gradeOverrides[sid][aid].dueDate`) replaces the assignment's class date. Resolved in one
// place so an extension reaches every consumer — the late penalty, on-time credit, the recorded
// zero, the To Do rail and the calendar — from a single edit.
//
// `override` is taken EITHER as the whole override object or as its `dueDate` alone, because it
// has always been called both ways and one of them silently did nothing: `"2026-12-01".dueDate`
// is undefined, so `effectiveDue(classDate, ov.dueDate)` fell back to the class date and threw
// the extension away. Seven of the ten call sites were written that way — the gradebook's
// Overall, the student's own grades list and the score matrix among them — so an extension was
// honored where the student submits but ignored everywhere a grade is read back, which marked a
// zero against exactly the student who had been granted more time. Accepting both shapes fixes
// all of them at once and leaves nothing to get wrong at the eleventh call site.
export const effectiveDue = (due, override) => {
  const ext = typeof override === "string" ? override : (override && override.dueDate);
  return ext || due || null;
};
export const fmtDate = ts => new Date(ts).toLocaleString();

export const ptsPer = n => {
  const b = Math.floor(10 / n), r = 10 - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
};

export const detectParts = text => {
  const labels = [...new Set([...text.matchAll(/\(([a-z])\)/g)].map(m => m[1]))];
  return labels.length >= 2 ? labels : null;
};

// Split a multi-part quiz question into the shared stem and one entry per part, so the quiz
// runner can pose the parts ONE AT A TIME (each graded on its own). Parts are cut at the FIRST
// occurrence of each label in `detectParts` order; a later mention of an earlier label ("how
// would your answer to (a) change") therefore stays inside the part that mentions it. Text
// before "(a)" is the stem, which may be empty. A part written inline in a list ("(b) the force
// does negative work, and (c) ...") loses its trailing ", and" so it reads as its own prompt.
//   { stem: "Two wires ...", parts: [{ label: "a", text: "Is there ..." }, ...] } | null
export const splitParts = text => {
  const labels = detectParts(text);
  if (!labels) return null;
  const cuts = [];
  let from = 0;
  for (const l of labels) {
    const at = text.indexOf("(" + l + ")", from);
    if (at < 0) return null;
    cuts.push({ label: l, at });
    from = at + 3;
  }
  const clean = t => t.replace(/[\s,;]*\band\s*$/i, "").replace(/^[\s,;:]+|[\s,;]+$/g, "").trim();
  const stem = clean(text.slice(0, cuts[0].at));
  const parts = cuts.map((c, i) => ({
    label: c.label,
    text: clean(text.slice(c.at + 3, i + 1 < cuts.length ? cuts[i + 1].at : text.length)),
  }));
  return { stem, parts };
};

// ── Image compression ────────────────────────────────────────────────────────
export function compressImage(file, maxPx = 1200, quality = 0.8) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onerror = rej;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        res({ data: canvas.toDataURL("image/jpeg", quality).split(",")[1], type: "image/jpeg" });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Claude API calls ──────────────────────────────────────────────────────────
export async function checkImageReadability(imgData) {
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 200,
      system: "You are checking whether a student's uploaded photo of a hand-drawn physics graph is legible enough to evaluate. Reply ONLY with valid JSON: {\"readable\":true} if the drawing is clear enough to assess, or {\"readable\":false,\"reason\":\"one short sentence telling the student specifically what to fix\"} if not.",
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imgData.type, data: imgData.data } }, { type: "text", text: "Is this image of a hand-drawn physics graph clear and legible enough to evaluate?" }] }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  try { return JSON.parse(text.replace(/```json\n?|```/g, "").trim()); } catch { return { readable: true }; }
}

// Grade one free-response quiz answer. `part` is null for a single-part question; for a
// multi-part question it is `{ label, text, index, total, stem, full }` for the ONE part being
// asked right now (the runner poses parts sequentially, see App.jsx `submitAnswer`), and the
// grader is told to evaluate only that part. The full question rides along as context so a part
// like "how would your answer to (a) change" can be judged against what (a) asked; `history` is
// the per-question exchange, so what the student said for earlier parts is in view too.
// `simPick` marks an answer given by clicking a point on the quiz's simulation instead of in
// words (`answer` is then the runner's description of the point and the settings it was picked
// under). A pick never completes a part: the grader is told to judge the point and always ask
// for the justification in words, which is the message graded next.
export async function evaluateAnswer(question, answer, history, imageData, attemptNum = 1, part = null, courseType = "physics1", simPick = false) {
  const courseLabel = courseLabelFor(courseType);
  let system;
  if (part) {
    const done = part.index > 0 ? " Parts " + Array.from({ length: part.index }, (_, i) => "(" + String.fromCharCode(97 + i) + ")").join(", ") + " are already answered and graded; do not re-evaluate them." : "";
    system = "You are an encouraging " + courseLabel + " tutor. Your goal is to guide students to the correct understanding themselves. Celebrate progress, never shame confusion, and ask targeted questions that help the student discover the answer rather than stating it.\n\nThis is a MULTI-PART question. The parts are posed ONE AT A TIME, and the student is currently answering ONLY part (" + part.label + ") of " + part.total + "." + done + " The full question is shown for context; evaluate the student's latest answer against part (" + part.label + ") alone, and do not hold them to anything a later part asks.\n\nCRITICAL RULE: Mark CORRECT only when the student's answer clearly demonstrates conceptual understanding of the key idea of part (" + part.label + "). Informal wording and minor gaps in detail are fine, but the core physics concept must be present and accurate. Mark INCORRECT if the answer contains a conceptual error, is missing the key idea, or is too vague to confirm any real understanding.\n\nReply ONLY with valid JSON:\n- If adequate: {\"status\":\"correct\",\"message\":\"1-2 sentences confirming what they got right\"}\n- If not: {\"status\":\"incorrect\",\"message\":\"One focused Socratic question targeting the gap\"}";
  } else {
    system = "You are an encouraging " + courseLabel + " tutor. Your goal is to guide students to the correct understanding themselves. Celebrate progress, never shame confusion, and ask targeted questions that help the student discover the answer rather than stating it.\n\nCRITICAL RULE: Mark CORRECT only when the student's answer clearly demonstrates conceptual understanding of the key idea. Informal wording and minor gaps in detail are fine, but the core physics concept must be present and accurate. Mark INCORRECT if the answer contains a conceptual error, is missing the key idea, or is too vague to confirm any real understanding.\n\nFor image submissions (motion graphs): accept the drawing if the key features are essentially correct.\n\nReply ONLY with valid JSON:\n- If adequate: {\"status\":\"correct\",\"message\":\"1-2 sentences confirming what they got right\"}\n- If not: {\"status\":\"incorrect\",\"message\":\"One focused Socratic question targeting the gap\"}";
  }
  if (simPick) system += "\n\nThe student has just answered by clicking a point on the interactive simulation beside the quiz instead of writing (their message describes the point and the simulation's settings when they picked it). A picked point can NEVER complete this part on its own, because the part asks for reasoning. Reply with status \"incorrect\" regardless. In the message: if the point and the settings it was picked under match what the part asks, say so warmly in one sentence and ask them to justify in their own words WHY the field behaves that way there; if the settings do not match the case the part asks about, or the point is not what the part asks for, say what you see at that point (a number they can check on the plot) and ask one Socratic question that steers them, without giving the location. Do not count this against them.";
  if (attemptNum === 4) system += "\n\nThis is the student's 4th attempt on the current part(s). Give a more direct hint — point clearly toward the key concept without stating the full answer. They have one more try after this.";
  if (attemptNum >= 5) system += "\n\nThis is the student's final (5th) attempt on the current part(s). If still incorrect, kindly tell them the correct answer directly and encourage them to review the concept before moving on.";
  const qText = part
    ? "Physics Question (full): " + question + "\n\nThe student is now answering part (" + part.label + "): " + part.text
    : "Physics Question: " + question;
  const userContent = imageData
    ? [{ type: "text", text: qText + "\n\nThe student submitted a drawing." + (answer ? "\nNote: " + answer : "") }, { type: "image", source: { type: "base64", media_type: imageData.type, data: imageData.data } }]
    : qText + (simPick ? "\n\nStudent Answer (a point picked on the simulation): " : "\n\nStudent Answer: ") + answer;
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 1000, system, messages: [...history, { role: "user", content: userContent }] }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("The grader returned a non-JSON response. Run the app with `netlify dev` so the Claude proxy function is available."); }
  if (!res.ok || data?.error) {
    throw new Error("Grader error: " + (data?.error?.message || `HTTP ${res.status}`));
  }
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text.trim()) {
    throw new Error("The grader returned an empty response (check that ANTHROPIC_API_KEY is set in the Netlify dev environment).");
  }
  try { return JSON.parse(text.replace(/```json\n?|```/g, "").trim()); }
  catch { return { status: "incorrect", message: text }; }
}

// ── Roster CSV parsing ───────────────────────────────────────────────────────
export function parseRoster(text) {
  const stripped = text.replace(/^﻿/, "");
  const lines = stripped.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const parseLine = line => {
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
      else cur += line[i];
    }
    fields.push(cur.trim());
    return fields.map(f => f.replace(/^"|"$/g, "").trim());
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  const hasHeaders = headers.some(h => h === "student name" || h === "last name" || h === "first name" || h === "student id");
  const splitFullName = full => {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    return { firstName: parts[0], lastName: parts[parts.length - 1].replace(/\.$/, "") };
  };
  let rows;
  if (hasHeaders) {
    const nameIdx = headers.findIndex(h => h === "student name");
    const idIdx = headers.findIndex(h => h === "student id" || h === "studentid" || h === "id");
    const lastIdx = headers.findIndex(h => h === "last name");
    const firstIdx = headers.findIndex(h => h === "first name");
    const emailIdx = headers.findIndex(h => h === "preferred email" || h === "email" || h === "e-mail");
    rows = lines.slice(1).reduce((acc, line) => {
      const cols = parseLine(line);
      let firstName, lastName, studentId;
      if (nameIdx >= 0) {
        const split = splitFullName(cols[nameIdx] || "");
        if (!split) return acc;
        firstName = split.firstName; lastName = split.lastName;
      } else if (firstIdx >= 0 && lastIdx >= 0) {
        firstName = cols[firstIdx]; lastName = cols[lastIdx];
      } else return acc;
      studentId = (idIdx >= 0 ? cols[idIdx] : cols[2]) || "";
      if (!firstName || !lastName || !studentId) return acc;
      const email = (emailIdx >= 0 ? cols[emailIdx] : "") || "";
      return [...acc, { studentId, firstName, lastName, fullName: firstName + " " + lastName, ...(email ? { email } : {}) }];
    }, []);
  } else {
    rows = lines.reduce((acc, line) => {
      const cols = parseLine(line);
      const [lastName, firstName, studentId] = cols;
      if (!lastName || !firstName || !studentId) return acc;
      return [...acc, { studentId, firstName, lastName, fullName: firstName + " " + lastName }];
    }, []);
  }
  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName));
}

// ── Gradebook utilities ───────────────────────────────────────────────────────
const DEFAULT_GRADEBOOK_CAT_BY_TYPE = { quiz: "cat_quiz", homework: "cat_hw" };

// `dueDates` is the same node quizzes and homework read: a manual assignment (exam, lab)
// is dated by its own id, so it reaches the calendar and To Do rail exactly like the rest.
// Its `maxPts` is per-assignment (exams are /100, labs and quizzes /10), so every reader
// must scale by `a.maxPts` rather than assuming 10.
export function buildGradebookAssignments(mergedModules, quizzes, assignmentCategories, manualAssignments = {}, assignmentNameOverrides = {}, assignmentOrderOverrides = {}, dueDates = {}) {
  const gradableTypes = new Set(["quiz", "homework"]);
  const quizById = Object.fromEntries((quizzes || []).map(q => [q.id, q]));
  const seen = new Set();
  const result = [];
  for (const [modIdx, mod] of (mergedModules || []).entries()) {
    for (const [itemIdx, item] of (mod.items || []).entries()) {
      if (!gradableTypes.has(item.type)) continue;
      const id = item.refId || item.id;
      if (seen.has(id)) continue;
      seen.add(id);
      const baseTitle = ((item.type === "quiz" || item.type === "homework") ? quizById[id]?.title : item.title) || id;
      const title = (assignmentNameOverrides || {})[id] || baseTitle;
      const catId = (assignmentCategories || {})[id] || DEFAULT_GRADEBOOK_CAT_BY_TYPE[item.type] || "cat_quiz";
      const naturalOrder = modIdx * 100 + itemIdx;
      result.push({ id, title, type: item.type, catId, maxPts: 10, dueDate: quizById[id]?.dueDate || null, order: (assignmentOrderOverrides || {})[id] ?? naturalOrder });
    }
  }
  const manual = [];
  for (const [id, ma] of Object.entries(manualAssignments || {})) {
    if (!seen.has(id)) {
      seen.add(id);
      const title = (assignmentNameOverrides || {})[id] || ma.title || id;
      const catId = (assignmentCategories || {})[id] || ma.catId || "cat_quiz";
      const naturalOrder = ma.order ?? 9999;
      manual.push({ id, title, type: "manual", catId, maxPts: ma.maxPts || 10, dueDate: (dueDates || {})[id] || null, order: (assignmentOrderOverrides || {})[id] ?? naturalOrder });
    }
  }
  return [...result, ...manual].sort((a, b) => a.order - b.order);
}

export function calcGrades({ assignments, categories, scores, excused }) {
  const cats = Object.values(categories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byCategory = {};

  for (const cat of cats) {
    const catItems = (assignments || []).filter(a => a.catId === cat.id);
    const items = catItems.map(a => {
      const isExcused = !!(excused || {})[a.id];
      const rawScore = isExcused ? null : ((scores || {})[a.id] ?? null);
      return { id: a.id, score: rawScore, maxPts: a.maxPts, excused: isExcused, dropped: false };
    });

    // Drop the lowest by PERCENTAGE, not raw points: a category can hold assignments with
    // different maxPts, and raw points would call a 40/100 worse than a 3/10.
    const pctOf = it => ((it.score ?? 0) / (it.maxPts || 10)) * 100;
    const droppable = items.filter(it => !it.excused).sort((a, b) => pctOf(a) - pctOf(b));
    const numToDrop = Math.min(cat.dropLowest || 0, Math.max(0, droppable.length - 1));
    const droppedIds = new Set(droppable.slice(0, numToDrop).map(it => it.id));
    items.forEach(it => { if (droppedIds.has(it.id)) it.dropped = true; });

    let earned = 0, possible = 0;
    for (const it of items) {
      if (it.excused || it.dropped) continue;
      possible += it.maxPts;
      earned += it.score ?? 0;
    }

    byCategory[cat.id] = {
      earned,
      possible,
      pct: possible > 0 ? (earned / possible) * 100 : null,
      weightedContrib: 0,
      dropped: [...droppedIds],
      assignments: items,
    };
  }

  let totalUsedWeight = 0;
  for (const cat of cats) {
    if ((byCategory[cat.id]?.possible ?? 0) > 0) totalUsedWeight += cat.weight;
  }

  let overall = null;
  if (totalUsedWeight > 0) {
    overall = 0;
    for (const cat of cats) {
      const data = byCategory[cat.id];
      if (!data || data.pct == null || data.possible === 0) continue;
      const contrib = data.pct * (cat.weight / totalUsedWeight);
      data.weightedContrib = contrib;
      overall += contrib;
    }
  }

  return { overall, byCategory };
}

export function parseGradesCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { students: [], quizColCount: 0, detectedHeaders: "" };
  const isTab = lines[0].includes("\t");
  const parseLine = line => {
    if (isTab) return line.split("\t").map(f => f.trim().replace(/^"|"$/g, ""));
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
      else cur += line[i];
    }
    fields.push(cur.trim());
    return fields;
  };
  const headers = parseLine(lines[0]);
  const quizCols = [];
  for (let i = 0; i < headers.length; i++) {
    const m = headers[i].match(/\bquiz\s*(\d+)/i);
    if (m) quizCols.push({ colIdx: i, quizNum: parseInt(m[1]) });
  }
  const students = lines.slice(1).reduce((acc, line) => {
    const cols = parseLine(line);
    const lastName = cols[0]?.trim(), firstName = cols[1]?.trim();
    if (!lastName || !firstName) return acc;
    let studentId = "";
    for (let i = 2; i <= 4 && i < cols.length; i++) {
      const v = cols[i]?.trim();
      if (v && /^\d+$/.test(v)) { studentId = v; break; }
    }
    if (!studentId) return acc;
    studentId = studentId.padStart(7, "0");
    const scores = quizCols.reduce((s, { colIdx, quizNum }) => {
      const v = cols[colIdx]?.trim();
      if (v !== "" && v !== undefined && v !== null) {
        const n = parseFloat(v);
        if (!isNaN(n)) s.push({ quizNum, score: n });
      }
      return s;
    }, []);
    return [...acc, { lastName, firstName, studentId, fullName: firstName + " " + lastName, scores }];
  }, []);
  return { students, quizColCount: quizCols.length, detectedHeaders: headers.slice(0, 8).join(" | ") };
}

// ── Responsive hook ────────────────────────────────────────────────────────────
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = e => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}
