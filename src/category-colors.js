// Assignment-category colors — the SINGLE source of truth for the color that identifies a
// category (quiz, homework, lab, …) anywhere in the app: the gradebook's category headers, the
// student grades list, the syllabus grading bar/legend, the calendar event pills, and the To Do
// rail's kind dots.
//
// This exists because the same five colors used to be redeclared in four files under two
// different key spellings, and they drifted: `quiz` was mint green (#34d399) in the gradebook and
// syllabus but lime (#a3e635) in the calendar and To Do rail, and `lab` was indigo in one pair and
// pink in the other — so the same assignment changed color depending on which screen you were
// looking at. One map, imported everywhere, is what stops that happening again.
//
// Pure and env-agnostic (like course-meta.js / grading-core.js): no React, no browser APIs, no
// theme dependency, so any module can import it.
//
// Canonical keys are the calendar/To Do `kind` spelling. The gradebook's category ids (`cat_quiz`)
// and the short `hw` are resolved through ALIASES, so callers pass whichever key they already have.
export const CATEGORY_COLORS = {
  lab:      "#818cf8",
  homework: "#60a5fa",
  quiz:     "#34d399",
  midterm:  "#fbbf24",
  final:    "#f87171",
  // Not gradebook categories — To Do rail item kinds that need a dot color.
  reading:  "#94a3b8",
  notes:    "#94a3b8",
};

const ALIASES = {
  hw:          "homework",
  cat_lab:     "lab",
  cat_hw:      "homework",
  cat_quiz:    "quiz",
  cat_midterm: "midterm",
  cat_final:   "final",
};

// Color for a category key — a `kind` ("quiz"), a gradebook category id ("cat_quiz"), or "hw".
// `fallback` is the caller's own default (usually its theme teal) for a category we don't color.
export function categoryColor(key, fallback) {
  if (!key) return fallback;
  return CATEGORY_COLORS[key] || CATEGORY_COLORS[ALIASES[key]] || fallback;
}

// Color for a free-text category NAME, as typed in a syllabus's grading breakdown ("Quizzes",
// "Homework & Problem Sets", "Midterm Exam"). Substring matching, since the wording is the
// instructor's and varies per course.
export function categoryColorForName(name, fallback) {
  const n = (name || "").toLowerCase();
  if (n.includes("lab")) return CATEGORY_COLORS.lab;
  if (n.includes("homework") || n === "hw") return CATEGORY_COLORS.homework;
  if (n.includes("quiz")) return CATEGORY_COLORS.quiz;
  if (n.includes("midterm") || n.includes("mid")) return CATEGORY_COLORS.midterm;
  if (n.includes("final")) return CATEGORY_COLORS.final;
  return fallback;
}
