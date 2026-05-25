import { useState, useEffect } from "react";
import { COURSE_LABELS } from "./courses/index.js";

export const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ── Date / due-date helpers ───────────────────────────────────────────────────
export const dueToDate = due => {
  if (!due) return null;
  const datePart = due.slice(0, 10);
  const noon = new Date(datePart + 'T12:00:00Z');
  const isEDT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).format(noon).includes('EDT');
  const offset = isEDT ? '-04:00' : '-05:00';
  if (due.length === 10) return new Date(due + 'T23:59:00' + offset);
  if (due.length === 16 && due[10] === ' ') return new Date(datePart + 'T' + due.slice(11) + ':00' + offset);
  return new Date(due);
};

export const fmtDueTime = due => {
  if (!due || due.length === 10) return '11:59 PM';
  if (due.length === 16 && due[10] === ' ') {
    const [h, m] = due.slice(11).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  return '11:59 PM';
};

export const isLate = due => due && new Date() > dueToDate(due);
export const fmtDate = ts => new Date(ts).toLocaleString();

export const ptsPer = n => {
  const b = Math.floor(10 / n), r = 10 - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
};

export const detectParts = text => {
  const labels = [...new Set([...text.matchAll(/\(([a-z])\)/g)].map(m => m[1]))];
  return labels.length >= 2 ? labels : null;
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
      model: "claude-opus-4-7",
      max_tokens: 200,
      system: "You are checking whether a student's uploaded photo of a hand-drawn physics graph is legible enough to evaluate. Reply ONLY with valid JSON: {\"readable\":true} if the drawing is clear enough to assess, or {\"readable\":false,\"reason\":\"one short sentence telling the student specifically what to fix\"} if not.",
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imgData.type, data: imgData.data } }, { type: "text", text: "Is this image of a hand-drawn physics graph clear and legible enough to evaluate?" }] }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  try { return JSON.parse(text.replace(/```json\n?|```/g, "").trim()); } catch { return { readable: true }; }
}

export async function evaluateAnswer(question, answer, history, imageData, attemptNum = 1, parts = null, completedParts = [], courseType = "physics1") {
  const remaining = parts ? parts.filter(p => !completedParts.includes(p)) : null;
  const courseLabel = COURSE_LABELS[courseType] || "Physics";
  let system;
  if (remaining && remaining.length > 0) {
    const doneStr = completedParts.length > 0 ? "(" + completedParts.join("), (") + ")" : "none yet";
    const remStr = "(" + remaining.join("), (") + ")";
    const partsStr = "(" + parts.join("), (") + ")";
    system = "You are an encouraging " + courseLabel + " tutor. Your goal is to guide students to the correct understanding themselves. Celebrate progress, never shame confusion, and ask targeted questions that help the student discover the answer rather than stating it.\n\nThis is a MULTI-PART question with parts " + partsStr + ". The student has already correctly answered: " + doneStr + ". Still needed: " + remStr + ".\n\nEvaluate ONLY the parts the student EXPLICITLY addresses in their latest answer. Do NOT mark a part as complete unless the student clearly addressed it — do not infer or assume completion from related reasoning. Do not re-evaluate parts already complete.\n\nFor each remaining part the student attempted, decide whether their reasoning demonstrates conceptual understanding (informal wording is fine, but the core physics must be accurate and the key idea present).\n\nReply ONLY with valid JSON, exactly one of these forms:\n- All remaining parts now correctly addressed: {\"status\":\"correct\",\"newlyCompleted\":[\"a\",...],\"message\":\"1-2 sentences confirming what they got across all parts\"}\n- Some new parts correct, others still needed: {\"status\":\"partial\",\"newlyCompleted\":[\"a\"],\"message\":\"Acknowledge by letter what they got, then prompt by letter for the remaining part(s)\"}\n- No new parts correctly addressed (wrong, vague, or didn't address remaining parts): {\"status\":\"incorrect\",\"newlyCompleted\":[],\"message\":\"One focused Socratic question targeting the gap on the part(s) they attempted\"}";
  } else {
    system = "You are an encouraging " + courseLabel + " tutor. Your goal is to guide students to the correct understanding themselves. Celebrate progress, never shame confusion, and ask targeted questions that help the student discover the answer rather than stating it.\n\nCRITICAL RULE: Mark CORRECT only when the student's answer clearly demonstrates conceptual understanding of the key idea. Informal wording and minor gaps in detail are fine, but the core physics concept must be present and accurate. Mark INCORRECT if the answer contains a conceptual error, is missing the key idea, or is too vague to confirm any real understanding.\n\nFor image submissions (motion graphs): accept the drawing if the key features are essentially correct.\n\nReply ONLY with valid JSON:\n- If adequate: {\"status\":\"correct\",\"message\":\"1-2 sentences confirming what they got right\"}\n- If not: {\"status\":\"incorrect\",\"message\":\"One focused Socratic question targeting the gap\"}";
  }
  if (attemptNum === 4) system += "\n\nThis is the student's 4th attempt on the current part(s). Give a more direct hint — point clearly toward the key concept without stating the full answer. They have one more try after this.";
  if (attemptNum >= 5) system += "\n\nThis is the student's final (5th) attempt on the current part(s). If still incorrect, kindly tell them the correct answer directly and encourage them to review the concept before moving on.";
  const userContent = imageData
    ? [{ type: "text", text: "Physics Question: " + question + "\n\nThe student submitted a drawing." + (answer ? "\nNote: " + answer : "") }, { type: "image", source: { type: "base64", media_type: imageData.type, data: imageData.data } }]
    : "Physics Question: " + question + "\n\nStudent Answer: " + answer;
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-7", max_tokens: 1000, system, messages: [...history, { role: "user", content: userContent }] }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  try { return JSON.parse(text.replace(/```json\n?|```/g, "").trim()); }
  catch { return { status: "incorrect", message: text || "Can you elaborate a bit more?" }; }
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

export function buildGradebookAssignments(mergedModules, quizzes, assignmentCategories, manualAssignments = {}, assignmentNameOverrides = {}, assignmentOrderOverrides = {}) {
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
      const baseTitle = (item.type === "quiz" ? quizById[id]?.title : item.title) || id;
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
      manual.push({ id, title, type: "manual", catId, maxPts: ma.maxPts || 10, dueDate: null, order: (assignmentOrderOverrides || {})[id] ?? naturalOrder });
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

    const droppable = items.filter(it => !it.excused).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
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
