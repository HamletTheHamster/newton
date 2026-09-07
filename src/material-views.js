// Course-material open tracking — pure and env-agnostic, like `announcements.js` / `attendance.js`.
//
// Storage is `classes/{classId}/materialViews/{studentId}/{itemId} = { first, last, count }`,
// where `itemId` is the module item's stable `id` (assigned by `courses/ids.js` and never
// rewritten, so a record survives a module rename, a reorder, and a file replacement). The
// signed-in student's own portal writes one leaf per item; the instructor's Analytics tab reads
// the whole node lazily, exactly like `hwTelemetry`.
//
// WHAT A RECORD MEANS, AND WHAT IT DOES NOT. It means this student clicked the item and the
// browser was handed the file, the link or the page. It is NOT evidence of reading: a click can
// open a PDF that is never scrolled, and a student can equally read the same chapter from the
// textbook on paper and never click anything here. So the honest reading of a low open rate is
// "this material was not opened THROUGH THE COURSE SITE", and every figure derived from it is
// presented as opens, never as "read". The correlation view exists to ask whether opening even
// correlates with performance; it cannot show that opening caused it.

// The day open tracking shipped. Materials posted earlier have no records and never will, so a
// 0% open rate on them is an absence of instrumentation, not an absence of students. The
// instructor UI states this date rather than quietly reporting a term of zeros. It stops
// mattering once every posted material postdates it.
export const MATERIAL_TRACKING_SINCE = "2026-09-07";

// Module item types that are "material" — something posted for students to open, as opposed to
// work they submit (quiz, homework), which is already tracked far more richly by submissions and
// telemetry.
export const MATERIAL_TYPES = new Set(["file", "reading", "notes", "link", "page"]);

// What a click on this item actually opens, or null when nothing is behind it yet. A seeded
// placeholder (`{ type: "file", uploadId: null }`) renders as plain text with no click target, so
// it must never sit in the denominator — otherwise every module the instructor has not finished
// filling in drags the class's open rate down.
export function materialTarget(item) {
  if (!item) return null;
  if (item.type === "file") return item.downloadUrl || null;
  if (item.type === "page") return item.pageId || null;
  return item.url || null;
}

export function isMaterialItem(item) {
  return !!item && MATERIAL_TYPES.has(item.type) && !!materialTarget(item);
}

// Flatten merged modules into the openable materials, in module then item order.
//   [{ id, type, title, moduleId, moduleTitle }]
// Hidden items are dropped by default: a student cannot open what they cannot see, so counting
// one would report the whole class as having ignored it. Any records an item collected before it
// was hidden simply stop being listed.
export function materialsOf(modules, { includeHidden = false } = {}) {
  const out = [];
  for (const mod of modules || []) {
    for (const item of mod.items || []) {
      if (!isMaterialItem(item)) continue;
      if (!includeHidden && item._hidden) continue;
      out.push({
        id: item._key || item.id,
        type: item.type,
        title: item.title || item.fileName || "Untitled",
        moduleId: mod.id,
        moduleTitle: mod.title,
      });
    }
  }
  return out;
}

// The stored value for one (student, item) pair, normalized to { first, last, count } or
// undefined when there is no record.
//   undefined / null / false → never opened
//   true                     → opened, time unknown (a shape this has never written, tolerated
//                              so a hand-edited or imported node cannot read as "never opened")
//   "<ISO>"                  → opened once at that time
//   { first, last, count }   → the written shape
export function viewRecordOf(value) {
  if (value === undefined || value === null || value === false) return undefined;
  if (value === true) return { first: null, last: null, count: 1 };
  if (typeof value === "string") return { first: value, last: value, count: 1 };
  if (typeof value !== "object") return undefined;
  const count = Number.isFinite(value.count) && value.count > 0 ? Math.floor(value.count) : 1;
  const first = typeof value.first === "string" ? value.first : null;
  const last = typeof value.last === "string" ? value.last : first;
  return { first, last, count };
}

// Who opened one material, and who did not. `views` is the whole-class node
// { [studentId]: { [itemId]: record } }. Mirrors `readReceiptsFor` in announcements.js.
export function openersOf(itemId, roster, views) {
  const opened = [], notOpened = [];
  for (const stu of roster || []) {
    const rec = viewRecordOf(views?.[stu.studentId]?.[itemId]);
    if (!rec) notOpened.push(stu);
    else opened.push({ student: stu, ...rec });
  }
  // Most recent first; a record with no timestamp sorts to the end.
  opened.sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  const total = opened.length + notOpened.length;
  return { opened, notOpened, total, pct: total ? (opened.length / total) * 100 : null };
}

// One row per material, in posting order, for the instructor's Materials view.
export function materialStats({ materials, roster, views }) {
  return (materials || []).map(m => ({ material: m, ...openersOf(m.id, roster, views) }));
}

// Per-student open counts per module, plus a pooled `all` entry. Shaped like `effortByStudent`
// in analytics.js so the correlation view can read either through one accessor.
//
//   { [studentId]: { [moduleId]: { opened, total, pct, lastAt }, all: { … } } }
//
// Built over the ROSTER, not over the views node, so a student with no records at all appears
// with `opened: 0` rather than as missing data. That distinction is the whole point here: unlike
// attempts or time on task, where absence means "not measured", a material was posted to
// everyone, so a student with no record genuinely opened none of it and belongs in the
// correlation as a zero.
export function materialOpensByStudent({ materials, roster, views }) {
  const byModule = new Map();
  for (const m of materials || []) {
    if (!byModule.has(m.moduleId)) byModule.set(m.moduleId, []);
    byModule.get(m.moduleId).push(m);
  }

  const out = {};
  for (const stu of roster || []) {
    const mine = views?.[stu.studentId] || {};
    const entry = {};
    let allOpened = 0, allTotal = 0, allLast = null;
    for (const [moduleId, list] of byModule) {
      let opened = 0, lastAt = null;
      for (const m of list) {
        const rec = viewRecordOf(mine[m.id]);
        if (!rec) continue;
        opened += 1;
        if (rec.last && (!lastAt || rec.last > lastAt)) lastAt = rec.last;
      }
      entry[moduleId] = { opened, total: list.length, pct: list.length ? (opened / list.length) * 100 : null, lastAt };
      allOpened += opened; allTotal += list.length;
      if (lastAt && (!allLast || lastAt > allLast)) allLast = lastAt;
    }
    entry.all = { opened: allOpened, total: allTotal, pct: allTotal ? (allOpened / allTotal) * 100 : null, lastAt: allLast };
    out[stu.studentId] = entry;
  }
  return out;
}

// The modules that have any openable material, with their totals — the row list the correlation
// view ranks. A module with nothing posted is dropped rather than shown as an empty row.
export function materialModules(materials) {
  const seen = new Map();
  for (const m of materials || []) {
    const e = seen.get(m.moduleId) || { id: m.moduleId, title: m.moduleTitle, total: 0 };
    e.total += 1;
    seen.set(m.moduleId, e);
  }
  return [...seen.values()];
}
