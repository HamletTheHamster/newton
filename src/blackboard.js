// Blackboard Grade Center interchange — pure and env-agnostic (no React/DOM), like
// category-colors.js and grading-core.js, so the format rules can be unit-tested
// (src/blackboard.test.mjs) without a browser.
//
// WHY THIS EXISTS: the instructor is required to keep a detailed gradebook in Blackboard, so
// Newton's grades have to land there without being retyped. Blackboard's own advice is to
// download the current Grade Center and upload that same shape back, because two things in a
// downloaded file are load-bearing and cannot be invented:
//
//   1. USERNAME. Blackboard matches an uploaded row to a student by the "Username" column and
//      nothing else. Newton's roster carries a name and a student ID, neither of which
//      Blackboard will match on, and a username is NOT derivable from a name — this class
//      alone contains "kunj.patel2", which no rule would produce.
//   2. COLUMN ID. A grade column header downloads as `Quiz 1 [Total Pts: 10 Score] |1281892`.
//      The `|1281892` is what routes the values into the EXISTING column. A header without one
//      makes Blackboard CREATE a column, and a created column arrives as a text column worth
//      DEFAULT points total, which will not be the one you wanted — Ultra creates it worth 100,
//      Original creates a 0-point text column that can't feed a calculated total at all. The
//      upload format carries no points field (the `[Total Pts: …]` part of a header is written on
//      download and ignored on upload), so this cannot be set from here; either fix the column in
//      Blackboard or use `scaleToColumn` below. Verified against Ultra on 2026-09-02: a column
//      created by upload came back at 100 points.
//
// Both facts live only in a Blackboard download, which is why the flow is: import the download
// once (`readBlackboardExport`) to learn usernames + column ids, then export against that link
// (`buildBlackboardCsv`) as often as you like.
//
// Deliberately NOT exported back to Blackboard:
//   · "Last Access" / "Availability" — read-only status fields, not grade data, and Newton has
//     no truthful value for them. Every uploaded column is a column Blackboard may act on, so
//     the file carries only identity + grades.
//   · Calculated columns (Total, Weighted Total, Overall Grade). Blackboard states plainly that
//     calculation formulas can be neither downloaded nor uploaded; the column recomputes itself
//     from the ones we do upload. `isCalculatedColumn` keeps them out of the link picker so a
//     mapping can never be made in the first place.

// ── CSV ──────────────────────────────────────────────────────────────────────
// RFC 4180 reader: quoted fields may contain commas, newlines and doubled quotes. Blackboard
// quotes every field of a comma-delimited export, and an assignment title with a comma in it
// ("Homework 5: Current, Resistance, & Electromotive Force") is exactly the case a naive
// line.split(",") gets wrong.
export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ",") { row.push(cur); cur = ""; continue; }
    if (ch === "\r") { if (src[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; continue; }
    if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
    cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(f => String(f).trim() !== ""));
}

// Blackboard's own export quotes every field and is UTF-8 with a BOM. Match it exactly: the
// BOM is what stops Excel mangling a non-ASCII name on the round trip, and quoting everything
// is what Blackboard recommends for comma-delimited uploads.
export function toCsv(rows) {
  return "﻿" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ── Column headers ───────────────────────────────────────────────────────────
// `Quiz 1 [Total Pts: 10 Score] |1281892` → { title, points, display, bbId }
// `Overall Grade [Total Pts: up to 55 Letter] |1281890` → points null (varies ⇒ calculated)
const HEADER_RE = /^(.*?)\s*\[Total Pts:\s*(.+?)\s+([A-Za-z/ ]+)\]\s*\|\s*(\d+)\s*$/;

export function parseColumnHeader(header) {
  const m = HEADER_RE.exec(String(header || "").trim());
  if (!m) return null;
  const [, title, ptsRaw, display, bbId] = m;
  const pts = /up to/i.test(ptsRaw) ? null : Number(ptsRaw);
  return {
    title: title.trim(),
    points: Number.isFinite(pts) ? pts : null,
    variablePoints: /up to/i.test(ptsRaw),
    display: display.trim(),
    bbId,
  };
}

// The header for a column Blackboard has NEVER SEEN: the bare title, with no `[Total Pts: …]`
// suffix and no id. Blackboard does not parse that suffix on the way in (its docs say the points
// total has to be set by hand afterwards), so including it would most likely name the column
// "Quiz 2 [Total Pts: 10 Score]" verbatim. The bare title is also what makes the NEXT import
// re-link automatically: normalizeTitle matches Newton's title to the column Blackboard just
// created from it.
export function newColumnHeader(assignment) {
  return String(assignment?.title || "").trim();
}

// Rebuild the exact header string Blackboard downloaded, so an upload routes into that column.
export function formatColumnHeader(col) {
  const pts = col.variablePoints ? `up to ${col.points ?? ""}`.trim() : String(col.points ?? "");
  return `${col.title} [Total Pts: ${pts} ${col.display || "Score"}] |${col.bbId}`;
}

// Identity/status columns that carry no grade. Compared case-insensitively on the raw header.
const IDENTITY_HEADERS = new Set(["last name", "first name", "username", "student id", "last access", "availability", "child course id"]);

// Calculated columns can't be uploaded (Blackboard: "Calculation formulas cannot be downloaded
// or uploaded in such columns as Total and Weighted Total"). Two independent tells: a
// well-known name, or "up to N" points, which is how a running total downloads.
const CALCULATED_NAMES = new Set(["total", "weighted total", "overall grade", "running total", "average"]);
export function isCalculatedColumn(col) {
  return !!col && (col.variablePoints || CALCULATED_NAMES.has(col.title.trim().toLowerCase()));
}

// ── Title matching ───────────────────────────────────────────────────────────
// Newton titles the full thing ("Homework 1: Electric Charge & Electric Field"); Blackboard
// columns are typed by hand and get abbreviated ("HW1"). Normalizing to a comparable key means
// the common case links itself and the instructor only hand-pairs the leftovers.
//   "Homework 1: Electric Charge & Electric Field" → "homework1"
//   "HW1"                                          → "homework1"
//   "Quiz 1: Welcome & Course Survey"              → "quiz1"
//   "Lab 1a" / "Lab 1A"                            → "lab1a"
export function normalizeTitle(title) {
  return String(title || "")
    .split(":")[0]                       // drop Newton's descriptive tail
    .toLowerCase()
    // `\bhw\b` would NOT match "HW1" — there is no word boundary between "w" and "1" — so the
    // digit case has to be spelled out, and it is the common one.
    .replace(/\bhw\s*(\d)/g, "homework$1")
    .replace(/\bhw\b/g, "homework")
    .replace(/\bhomeworks\b/g, "homework")
    .replace(/\bquizzes\b/g, "quiz")
    .replace(/\blabs\b/g, "lab")
    .replace(/\bexams?\b/g, "exam")
    .replace(/[^a-z0-9]/g, "");
}

// ── Reading a Blackboard full-Grade-Center download ──────────────────────────
// Returns everything the link needs: the grade columns Blackboard already has, the username for
// each roster student it can identify, and an honest account of what it could NOT match.
// Matching is by Student ID first (both systems carry it and it is stable), then by name — but
// never by name alone when the IDs disagree, since "Wes Gnandt" here is "Wesley Gnandt" there
// and a wrong pairing would post one student's grades under another's name.
export function readBlackboardExport(text, roster = []) {
  const rows = parseCsv(text);
  if (!rows.length) return { columns: [], links: [], unmatchedStudents: [], unmatchedRows: [], error: "The file is empty." };

  const headers = rows[0].map(h => h.trim());
  const idx = name => headers.findIndex(h => h.toLowerCase() === name);
  const userIdx = idx("username");
  if (userIdx < 0) {
    return { columns: [], links: [], unmatchedStudents: [], unmatchedRows: [], error: "No \"Username\" column found. Export the FULL Grade Center from Blackboard (Work Offline > Download), not a single column." };
  }
  const lastIdx = idx("last name"), firstIdx = idx("first name"), sidIdx = idx("student id");

  const columns = [];
  headers.forEach(h => {
    if (IDENTITY_HEADERS.has(h.toLowerCase())) return;
    const col = parseColumnHeader(h);
    if (col) columns.push(col);
  });

  // Roster lookups. A student ID may be stored with or without its leading zeros depending on
  // which system exported the roster, so index both spellings.
  const byId = new Map(), byName = new Map();
  const nameKey = (f, l) => `${String(f || "").trim().toLowerCase()}|${String(l || "").trim().toLowerCase()}`;
  for (const stu of roster || []) {
    const id = String(stu.studentId || "").trim();
    if (id) { byId.set(id, stu); byId.set(id.replace(/^0+/, ""), stu); }
    byName.set(nameKey(stu.firstName, stu.lastName), stu);
  }

  const links = [], unmatchedRows = [], claimed = new Set();
  for (const row of rows.slice(1)) {
    const username = String(row[userIdx] || "").trim();
    if (!username) continue;
    const sid = sidIdx >= 0 ? String(row[sidIdx] || "").trim() : "";
    const first = firstIdx >= 0 ? String(row[firstIdx] || "").trim() : "";
    const last = lastIdx >= 0 ? String(row[lastIdx] || "").trim() : "";
    const stu = (sid && (byId.get(sid) || byId.get(sid.replace(/^0+/, "")))) || byName.get(nameKey(first, last));
    if (stu && !claimed.has(stu.studentId)) {
      claimed.add(stu.studentId);
      links.push({ studentId: stu.studentId, username, bbName: `${first} ${last}`.trim(), studentId_bb: sid });
    } else {
      unmatchedRows.push({ username, name: `${first} ${last}`.trim(), studentId: sid });
    }
  }
  const unmatchedStudents = (roster || []).filter(stu => !claimed.has(stu.studentId));
  return { columns, links, unmatchedStudents, unmatchedRows, error: null };
}

// Suggest a Newton-assignment → Blackboard-column pairing by normalized title. Calculated
// columns are excluded, and each Blackboard column is claimed at most once so two Newton
// assignments can never both post into it.
export function suggestColumnMap(assignments = [], columns = []) {
  const usable = columns.filter(c => !isCalculatedColumn(c));
  const byKey = new Map();
  for (const col of usable) {
    const k = normalizeTitle(col.title);
    if (!byKey.has(k)) byKey.set(k, col); else byKey.set(k, null); // ambiguous ⇒ no suggestion
  }
  const map = {}, taken = new Set();
  for (const a of assignments) {
    const col = byKey.get(normalizeTitle(a.title));
    if (col && !taken.has(col.bbId)) { map[a.id] = col.bbId; taken.add(col.bbId); }
  }
  return map;
}

// Fold a fresh Blackboard download into an existing link. A re-import happens every time the
// instructor creates a column in Blackboard and comes back for its id, so it must be a MERGE:
// pairings already made by hand are kept (as long as the column is still in the file), and
// auto-matching only runs on what is still unpaired, against columns nothing has claimed.
// Usernames likewise accumulate — a student missing from one download keeps the username an
// earlier one gave them rather than silently dropping out of every future upload.
export function mergeImport(prev, result, assignments = [], sourceFile = "", now = new Date()) {
  const prevMap = (prev && prev.map) || {};
  const kept = {};
  for (const [aId, bbId] of Object.entries(prevMap)) {
    if (result.columns.some(c => c.bbId === bbId)) kept[aId] = bbId;
  }
  const claimed = new Set(Object.values(kept));
  const fresh = suggestColumnMap(
    assignments.filter(a => !kept[a.id]),
    result.columns.filter(c => !claimed.has(c.bbId)),
  );
  const usernames = { ...((prev && prev.usernames) || {}) };
  for (const l of result.links) usernames[l.studentId] = l.username;
  return {
    link: { columns: result.columns, map: { ...kept, ...fresh }, usernames, importedAt: now.toISOString(), sourceFile },
    newlyMatched: Object.keys(fresh).length,
    keptMatches: Object.keys(kept).length,
  };
}

// Pair one assignment with one Blackboard column. A column may back at most ONE assignment: two
// assignments pointing at the same column would write the same cell twice in a single upload and
// whichever row came last would win, silently discarding a grade.
export function pairColumn(map = {}, assignmentId, bbId) {
  const next = {};
  for (const [k, v] of Object.entries(map)) if (v !== bbId && k !== assignmentId) next[k] = v;
  if (bbId) next[assignmentId] = bbId;
  return next;
}

// ── Building the upload file ─────────────────────────────────────────────────
// Blackboard's "Score" display wants a bare number. Newton stores fractional homework credit
// (per-part overrides land on 8.33), so round to 2dp and drop trailing zeros — "8.5", not
// "8.50", and "10", not "10.00".
export function formatScore(n) {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return String(Math.round(Number(n) * 100) / 100);
}

// scoreMap / excusedMap are the shared [studentId][assignmentId] grids from analytics.js, so an
// exported value is the same effective score the gradebook cell and the student's grades list
// show — one derivation, no third opinion.
//
// An EXCUSED assignment exports as an empty cell. Blackboard's exempt flag is a per-cell
// property that a grade upload cannot set, so the honest options are "blank" or "a number that
// isn't true"; blank it is, and the caller is told to exempt those cells in Blackboard by hand.
export function buildBlackboardCsv({ roster = [], assignments = [], link = {}, scoreMap = {}, excusedMap = {}, createMissing = false, scaleToColumn = false }) {
  const columns = link.columns || [];
  const map = link.map || {};
  const usernames = link.usernames || {};
  const byBbId = new Map(columns.map(c => [c.bbId, c]));

  const anyScore = a => (roster || []).some(stu =>
    usernames[stu.studentId] && !excusedMap[stu.studentId]?.[a.id] && scoreMap[stu.studentId]?.[a.id] != null);

  // Three fates for an assignment.
  //  · LINKED   — routes into an existing Blackboard column via its id. Always exported.
  //  · CREATED  — no column yet, and `createMissing` is on: exported under its bare title so
  //               Blackboard creates the column. It arrives at Blackboard's DEFAULT points total
  //               (Ultra: 100; Original: a 0-point text column), never Newton's, because the
  //               upload format has no points field. Scores go up RAW here — the column's real
  //               points are unknowable until the next download, and guessing "it'll be 100"
  //               would multiply every grade by ten the day that default changes.
  //  · EMPTY    — no column yet and nobody has a score. Blackboard only creates a column if at
  //               least one student has a grade in it, so exporting this one would do nothing
  //               while looking like it did. Held back and reported instead of quietly ignored.
  const exported = [], skippedAssignments = [], created = [], skippedEmpty = [], pointMismatches = [], scaled = [];
  for (const a of assignments) {
    const col = byBbId.get(map[a.id]);
    if (col) {
      const mismatch = col.points != null && Number(col.points) > 0 && Number(col.points) !== Number(a.maxPts);
      if (mismatch) pointMismatches.push({ assignment: a, col });
      // `scale` converts Newton's raw points into the linked column's scale, so an 8/10 quiz
      // lands as 80 in a column Blackboard created at 100 and the PERCENTAGE — which is what
      // feeds the Overall Grade — comes out right without anyone editing the column. The factor
      // is only ever taken from a points total Blackboard itself reported on a download; a
      // column Newton has not seen the points of is never scaled by a guess.
      const scale = scaleToColumn && mismatch && Number(a.maxPts) > 0 ? Number(col.points) / Number(a.maxPts) : 1;
      exported.push({ assignment: a, col, header: formatColumnHeader(col), scale });
      if (scale !== 1) scaled.push({ assignment: a, col, scale });
    } else if (!createMissing) {
      skippedAssignments.push(a);
    } else if (anyScore(a)) {
      created.push(a);
      exported.push({ assignment: a, col: null, header: newColumnHeader(a), scale: 1 });
    } else {
      skippedEmpty.push(a);
    }
  }

  const students = [...roster].sort((a, b) =>
    String(a.lastName || "").localeCompare(String(b.lastName || "")) ||
    String(a.firstName || "").localeCompare(String(b.firstName || "")));
  const withUser = students.filter(stu => usernames[stu.studentId]);
  const skippedStudents = students.filter(stu => !usernames[stu.studentId]);

  const header = ["Last Name", "First Name", "Username", "Student ID", ...exported.map(e => e.header)];
  const body = withUser.map(stu => [
    stu.lastName || "", stu.firstName || "", usernames[stu.studentId], stu.studentId || "",
    ...exported.map(({ assignment, scale }) => {
      if (excusedMap[stu.studentId]?.[assignment.id]) return "";
      const raw = scoreMap[stu.studentId]?.[assignment.id];
      return raw == null ? "" : formatScore(Number(raw) * scale);
    }),
  ]);

  return {
    csv: toCsv([header, ...body]),
    exportedCount: exported.length,
    studentCount: withUser.length,
    linkedCount: exported.length - created.length,
    created,
    skippedAssignments,
    skippedEmpty,
    skippedStudents,
    pointMismatches,
    scaled,
  };
}

// ── Filenames ────────────────────────────────────────────────────────────────
// Local time, not ISO/UTC: the instructor reads this stamp against the clock on the wall to tell
// which of several downloads in an afternoon is the newest, and a UTC stamp reads hours off.
export function timeStamp(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
export function gradebookFilename(prefix, kind, d = new Date()) {
  const base = String(prefix || "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  return `${base ? base + "-" : ""}${kind}-${timeStamp(d)}.csv`;
}
