// Announcement read receipts — pure and env-agnostic, like category-colors.js / attendance.js.
//
// Storage is `classes/{classId}/announcementReads/{studentId}/{annId} = "<ISO timestamp>"`.
// The student's own portal writes it (one small PUT per announcement); the instructor's
// Announcements tab reads the whole node lazily to show who has seen what.
//
// A record means "this announcement was put in front of this student and they dismissed it,
// or they opened the Announcements page" — the same thing any read receipt means. It is
// deliberately NOT reset when the instructor edits an announcement: a typo fix would
// otherwise wipe the whole class's receipts and re-pop the notice for everyone.

// The day read tracking shipped. Announcements created before it have no receipts and never
// will, so we must not report their whole class as "not viewed" (they may all have read it),
// and must not pop a term's worth of old notices at the first student who logs in after the
// deploy. Both questions are answered by this one constant; it stops mattering once every
// live announcement postdates it.
export const READ_TRACKING_SINCE = "2026-09-06";

export function isTracked(ann) {
  return !!ann?.createdAt && ann.createdAt >= READ_TRACKING_SINCE;
}

// The stored value for one (student, announcement) pair, normalized.
//   undefined = no record (not viewed)
//   null      = viewed, but at an unknown time (legacy `true`, written by the 2026 pre-6.9
//               version of this feature, which recorded a flag rather than a timestamp)
//   string    = ISO timestamp of the view
export function readAtOf(value) {
  if (value === undefined || value === null || value === false) return undefined;
  if (value === true) return null;
  return typeof value === "string" ? value : null;
}

// Announcements this student has not seen yet, newest first, limited to tracked ones.
// `reads` is that ONE student's map: { [annId]: timestamp }.
export function unseenAnnouncements(sorted, reads) {
  return (sorted || []).filter(a => isTracked(a) && readAtOf(reads?.[a.id]) === undefined);
}

// Who has seen one announcement. `reads` is the whole-class node:
// { [studentId]: { [annId]: timestamp } }.
export function readReceiptsFor(annId, roster, reads) {
  const viewed = [], notViewed = [];
  for (const stu of roster || []) {
    const at = readAtOf(reads?.[stu.studentId]?.[annId]);
    if (at === undefined) notViewed.push(stu);
    else viewed.push({ student: stu, at });
  }
  // Most recent first; a legacy record with no timestamp sorts to the end.
  viewed.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return { viewed, notViewed, total: viewed.length + notViewed.length };
}
