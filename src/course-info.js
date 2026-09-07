// The non-coursework side of a class: the reference SHELVES a student returns to all term, and
// the GUIDE that explains how the course runs. Pure and env-agnostic like category-colors.js —
// no React, no browser APIs, no theme — so App.jsx, either portal and the tests can all import it.
//
// Both halves exist for the same reason. A course's preamble modules ("Welcome | Info &
// Resources") used to hold three unrelated kinds of thing collapsed into one shape, because
// Blackboard only had one shape to put them in:
//
//   reference   equation sheet, textbooks, video lectures   timeless, returned to, never "done"
//   orientation welcome message, "Instructions (READ ME)"   read once, explains the course
//   syllabus    the PDF                                     already has its own page
//
// The module list is a checklist THROUGH TIME: every item in it gets a completion circle and
// counts in the header's "n / total". So a reference shelf living there reads as work, and the
// module header asks the student to tick off owning a textbook. That is the mismatch this file
// resolves, by giving each of the three its own home.

import { isMaterialItem } from "./material-views.js";

// ── Resource shelves ────────────────────────────────────────────────────────
//
// A shelf is an ordinary module carrying `kind: "resources"`, NOT a separate node. That is
// deliberate and load-bearing:
//
//   - Every item type works already (file, link, page, reading, notes), with the same upload,
//     the same page editor, the same hide toggle, in the same instructor screen. There is no
//     second editor to build or keep in step.
//   - `materialViews` tracking is untouched, so Analytics -> Materials still reports open rates
//     for an equation sheet exactly as it does for a week's reading.
//   - No new RTDB node means no four-place App.jsx wiring, no rules change, and a backup keeps
//     working unchanged.
//   - Several shelves fall out for free ("Reference", "Textbooks", "Getting started"), which a
//     single dedicated node would have had to invent grouping for.
//
// The partition happens at the RENDER boundary only. `mergedModules` stays complete, because
// four other things read it and none of them care where a module is shown: `assignmentLocks`,
// `materialsOf` (the instructor's open rates), the course-evals nudge, and StudentGrades. Filter
// a shelf out of `mergedModules` itself and its files silently vanish from the instructor's
// analytics while still being clicked by students every week.
export const RESOURCE_KIND = "resources";

export const isResourceModule = m => m?.kind === RESOURCE_KIND;

// Split merged modules into the weekly coursework list and the reference shelves, preserving the
// instructor's order within each. Absent `kind` means coursework, so every module authored before
// shelves existed stays exactly where it was.
export function partitionModules(modules) {
  const course = [];
  const resources = [];
  for (const m of Array.isArray(modules) ? modules : []) {
    (isResourceModule(m) ? resources : course).push(m);
  }
  return { course, resources };
}

// The shelves worth showing, each reduced to the items worth listing.
//
// A shelf holds REFERENCE MATERIAL, so that is what it lists: `isMaterialItem` drops both the
// placeholders an instructor has not finished filling in and any coursework dropped into a shelf
// by mistake, and `_hidden` items are dropped because a student cannot open what they cannot see.
// A shelf left with nothing is dropped whole rather than rendered as an empty card.
//
// It lives here, rather than inside the Resources page, because the sidebar has to answer the same
// question to decide whether to offer the page at all — and an entry that leads to "nothing has
// been posted yet" is worse than no entry.
export function visibleShelves(shelves) {
  return (Array.isArray(shelves) ? shelves : [])
    .map(shelf => ({ ...shelf, items: (shelf.items || []).filter(it => !it._hidden && isMaterialItem(it)) }))
    .filter(shelf => shelf.items.length > 0);
}

// ── Course guide ────────────────────────────────────────────────────────────
//
// Stored at `classes/{classId}/courseGuide`. The Syllabus page does not read well because it was
// styled; it reads well because it is STRUCTURED DATA (`syllabus.fields`, which Claude extracts
// from the instructor's PDF). The same mechanism is what this node is: the instructor keeps
// writing prose, Claude gives it structure, the app renders the structure.
//
//   { rhythm:   { title, intro, steps: [{ title, kind, body }] },
//     policies: [{ title, body }],
//     updatedAt }
//
// There is deliberately no welcome/greeting field. One existed briefly and was removed: a greeting
// at the top of this page competes with the weekly sequence, which is what the page is FOR, and on
// the Home page it was a card students had already read sitting above the work they had not. A
// welcome is just a titled card, so it goes in `policies` like any other.
//
// A step's `kind` is a category key from category-colors.js. It is optional ON PURPOSE: a step
// is colored only when it names something the app actually tracks (a quiz, the homework, the
// reading), and steps that happen off-app ("come to class", "review your notes") stay neutral.
// So the color says "you will do this here" rather than decorating every row, and a student
// reading step 4 sees the homework in the same blue it wears on their To Do rail and calendar.
// Never invent a hue for an off-app step: that would imply a grading category that does not exist
// (see category-colors.js, which is the only place a color may be added).
const str = v => (typeof v === "string" ? v.trim() : "");

const normStep = st => {
  const title = str(st?.title);
  const body = str(st?.body);
  if (!title && !body) return null;
  return { title, body, kind: str(st?.kind) || null };
};

const normPolicy = p => {
  const title = str(p?.title);
  const body = str(p?.body);
  if (!title && !body) return null;
  return { title, body };
};

// Claude writes this shape and an instructor edits it, so nothing about the stored value can be
// assumed: normalize on the way in AND on the way out, and drop entries that carry no text rather
// than rendering an empty card.
export function normalizeGuide(raw) {
  if (!raw || typeof raw !== "object") return null;
  const arr = v => (Array.isArray(v) ? v : []);
  const guide = {
    rhythm: {
      title: str(raw.rhythm?.title),
      intro: str(raw.rhythm?.intro),
      steps: arr(raw.rhythm?.steps).map(normStep).filter(Boolean),
    },
    policies: arr(raw.policies).map(normPolicy).filter(Boolean),
    updatedAt: str(raw.updatedAt) || null,
  };
  return guideHasContent(guide) ? guide : null;
}

export function guideHasContent(g) {
  return !!(g?.rhythm?.steps?.length || g?.policies?.length);
}
