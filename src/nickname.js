// Student-chosen preferred first names ("nicknames"), and the rules that keep them safe to show.
//
// A student can set their own preferred first name from Account Settings; it lands in the SAME
// `altName` field on their roster entry that the instructor edits by hand, so there is one display
// name and not two competing ones. `altName` is a whole display name (every consumer reads
// `stu.altName || stu.fullName`), so a student's first-name-only entry is combined with their real
// last name here rather than replacing the lot: "Kunj" on Kunjkumar Patel stores "Kunj Patel", and
// the instructor's roster still reads as a roster.
//
// This module is pure and env-agnostic (like category-colors.js) because BOTH ends need it: the
// browser, for instant format feedback while typing, and netlify/functions/screen-name.js, which is
// the authority that actually approves a name. Only the STRUCTURAL rules live here. The wordlist and
// the Claude judgment live in the function, so the client bundle is not a map of what to type
// around.
//
// Why this needs screening at all: the display name is not private. It is shown to the instructor
// across the gradebook and analytics, and it is shown to EVERYONE on the pre-login student picker
// (App.jsx's student-search list renders `altName || fullName`), so an abusive entry would be
// visible to the whole class without anyone signing in.
//
// Three fields on the roster entry carry this, all optional:
//   altName        the display name (shared with the instructor's own edit)
//   altNameBy      "student" when the student set it; absent when the instructor did
//   altNameAt      ISO timestamp of the student's set
//   nicknameLocked true = this student may no longer set their own name (the abuse switch)

export const NICKNAME_MAX = 20;

// Trim, and collapse any run of whitespace to one space. Leading/trailing space is invisible in the
// roster and would make two names look identical while sorting apart.
export function normalizeNickname(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

// Structural rules only: shape, not meaning. Returns { ok } or { ok: false, reason }, where `reason`
// is shown to the student verbatim, so it is plain text with no markdown and no em-dashes.
//
// The rules are deliberately loose about WHICH letters. A name filter that rejects Siobhán, Jean-Luc
// or Nguyễn is a worse failure than one that lets an odd string through to the screen behind it, so
// this accepts any Unicode letter and leaves judgment to that screen.
export function checkNicknameFormat(raw) {
  const name = normalizeNickname(raw);
  if (!name) return { ok: false, reason: "Enter a name, or leave it blank to use your name on file." };
  if (name.length > NICKNAME_MAX) return { ok: false, reason: `Please keep it to ${NICKNAME_MAX} characters or fewer.` };
  if (!/\p{L}/u.test(name)) return { ok: false, reason: "A name needs at least one letter." };
  if (/[0-9]/.test(name)) return { ok: false, reason: "Names cannot contain numbers." };
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(name)) return { ok: false, reason: "Use letters only, plus hyphens, apostrophes and periods." };
  if (name.split(" ").length > 2) return { ok: false, reason: "This is your first name only, so please use at most two words." };
  // "Aaaaaargh" and "J-----" are not names; three identical characters in a row never occur in one.
  if (/(.)\1\1/u.test(name)) return { ok: false, reason: "That does not look like a name. Please try another." };
  return { ok: true };
}

// The display name to store: the chosen first name plus the student's real last name, so the roster,
// gradebook and analytics all keep showing a full name. Falls back to the nickname alone if the
// roster entry somehow has no last name.
export function altNameFor(nickname, student) {
  const first = normalizeNickname(nickname);
  if (!first) return null;
  const last = normalizeNickname(student?.lastName);
  return last ? `${first} ${last}` : first;
}

// The inverse, for pre-filling the student's own field: strip the trailing real last name back off.
// An instructor-set altName that is not "<something> <lastName>" (a bare "JJ", say) has no first-name
// half to recover, so the whole thing comes back and the student can edit or replace it.
export function nicknameFromAltName(student) {
  const alt = normalizeNickname(student?.altName);
  if (!alt) return "";
  const last = normalizeNickname(student?.lastName);
  if (last && alt.length > last.length + 1 && alt.slice(-(last.length + 1)) === ` ${last}`) {
    return alt.slice(0, -(last.length + 1));
  }
  return alt;
}

// The instructor's per-student off switch. Absent means allowed, so the feature is on by default and
// is taken away only deliberately.
export function nicknameAllowed(student) {
  return !student?.nicknameLocked;
}
