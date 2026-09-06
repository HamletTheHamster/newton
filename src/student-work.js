// ── The storage shapes of student work ────────────────────────────────────────
//
// Pure and env-agnostic, like `category-colors.js` / `announcements.js`, so it can be tested
// with plain `node` (see student-work.test.mjs).
//
// Everything here exists to enforce ONE rule: a write that saves a student's work must never
// be a whole-object write derived from local state. Two sessions of the same student are
// routine (a phone that did the homework, a laptop tab opened before it, a tab restored from
// the background), there is no realtime listener to keep them in step, and a last-writer-wins
// PUT of a composite value therefore deletes whatever the other session did. That is not
// theoretical: on 2026-09-06 a completed homework was destroyed an hour and a half after it
// was handed in, by the same student then submitting a quiz from a stale tab.
//
// So submissions are stored one key per submission, homework drafts are patched one leaf per
// item, and the readers below understand every shape that has ever been written.

// ── Submissions ───────────────────────────────────────────────────────────────
//
// Canonical shape: submissions/{studentId}/{submissionId} = submission.
// Legacy shape:    submissions/{studentId} = [submission, …]
//
// Both must keep reading forever. There is no migration step and none is wanted: a per-key
// write onto a legacy array simply makes RTDB re-read that student as an object (RTDB has no
// arrays, only integer-keyed objects), so each student converts on their next submission.
// Shape-sniffing is per STUDENT, not per node, because a class will sit in both shapes at once.

// Flatten the whole node into the flat array the app works with. Skips anything that isn't an
// object so a null hole in a legacy array can't become a phantom submission.
export function flattenSubs(node) {
  if (!node || typeof node !== "object") return [];
  const out = [];
  for (const perStudent of Object.values(node)) {
    if (!perStudent || typeof perStudent !== "object") continue;
    for (const sub of Object.values(perStudent)) {
      if (sub && typeof sub === "object") out.push(sub);
    }
  }
  return out;
}

// Re-index a flat array into the per-student map, for the in-memory class cache. A submission
// with no id gets a positional one rather than being dropped or colliding: losing a record to
// a missing field would be the exact failure this module exists to prevent.
export function subsByStudentMap(subs) {
  const byStudent = {};
  (subs || []).forEach((sub, i) => {
    if (!sub || typeof sub !== "object" || !sub.studentId) return;
    (byStudent[sub.studentId] ||= {})[sub.id || `sub_legacy_${i}`] = sub;
  });
  return byStudent;
}

// The KEY a submission lives under in one student's node, which is NOT always its id.
//
// In the canonical shape they match. In the legacy array shape the key is the position
// ("0", "1", …) and the id is only a field, so addressing `submissions/{sid}/{sub.id}` there
// points at nothing: a delete silently misses and the record comes back on the next load,
// and a merge writes a second copy of a submission that is already present. Every write that
// targets an EXISTING submission must resolve its key from a fresh read of the node first.
//
// Falls back to the id, which is the right answer for a submission that isn't there yet.
export function keyForSubmission(perStudentNode, subId) {
  if (perStudentNode && typeof perStudentNode === "object") {
    for (const [key, sub] of Object.entries(perStudentNode)) {
      if (sub && typeof sub === "object" && sub.id === subId) return key;
    }
  }
  return subId;
}

// Deep-path patch for a batch of submissions: `{ "studentId/submissionId": submission }`.
// Used by the backup import, which must ADD to the node and never replace it — a backup is by
// definition older than the live data, so a replacing restore would delete every submission
// handed in since it was taken.
// `node` is the live `submissions` node, used only to address a submission that already
// exists at a legacy positional key — without it an import would write a second copy of it.
export function submissionMergePatch(subs, node) {
  const patch = {};
  for (const s of (subs || [])) {
    if (!s || typeof s !== "object" || !s.studentId || !s.id) continue;
    patch[`${s.studentId}/${keyForSubmission(node?.[s.studentId], s.id)}`] = s;
  }
  return patch;
}

// ── Homework drafts ───────────────────────────────────────────────────────────

// The per-item maps a draft is made of. Each is keyed by item id, and each is only ever added
// to by the runner, which is what makes an additive patch complete rather than merely safe.
export const DRAFT_ITEM_MAPS = ["answers", "attempts", "status", "earned", "feedback", "revealed", "gradePass", "hintUsed", "history"];

// Build the deep-path patch that saves a draft: one key per item per map, plus the two
// scalars. Deliberately ADDITIVE — it never emits a null. Nothing needs deleting (the maps
// only grow), and an answer the student typed and later cleared is worth keeping: a resumed
// draft should show what they last wrote. Emitting nulls would also hand a stale session the
// power to erase items it had simply never seen, which is the whole failure being designed out.
export function buildDraftPatch(state, now = new Date().toISOString()) {
  const patch = { idx: state?.idx || 0, savedAt: now };
  for (const field of DRAFT_ITEM_MAPS) {
    const map = state?.[field];
    if (!map || typeof map !== "object") continue;
    for (const [itemId, value] of Object.entries(map)) {
      if (value === undefined) continue;
      patch[`${field}/${itemId}`] = value;
    }
  }
  return patch;
}

// Apply a patch to a stored draft the way RTDB's PATCH does, so a test can assert what a
// second session actually ends up with. Not used by the app: RTDB does this server-side.
export function applyDraftPatch(stored, patch) {
  const next = JSON.parse(JSON.stringify(stored || {}));
  for (const [key, value] of Object.entries(patch || {})) {
    const parts = key.split("/");
    let node = next;
    for (const part of parts.slice(0, -1)) {
      if (!node[part] || typeof node[part] !== "object") node[part] = {};
      node = node[part];
    }
    const leaf = parts[parts.length - 1];
    if (value === null) delete node[leaf];
    else node[leaf] = value;
  }
  return next;
}
