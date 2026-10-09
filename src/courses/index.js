import { COURSE_META } from "../course-meta.js";
import { QUIZZES_PHYSICS1, MODULES_PHYSICS1, HOMEWORKS_PHYSICS1 } from "./physics1.js";
import { QUIZZES_PHYSICS2, MODULES_PHYSICS2, HOMEWORKS_PHYSICS2, STUDY_GUIDES_PHYSICS2 } from "./physics2.js";

// Course content, joined to the shared course identity in ../course-meta.js (which the Netlify
// grading function also imports — labels must not drift between client and server).
const COURSES = {
  physics1: { label: COURSE_META.physics1.label, quizzes: QUIZZES_PHYSICS1, modules: MODULES_PHYSICS1, homeworks: HOMEWORKS_PHYSICS1, studyGuides: [] },
  physics2: { label: COURSE_META.physics2.label, quizzes: QUIZZES_PHYSICS2, modules: MODULES_PHYSICS2, homeworks: HOMEWORKS_PHYSICS2, studyGuides: STUDY_GUIDES_PHYSICS2 },
};

export const COURSE_LABELS = Object.fromEntries(Object.entries(COURSES).map(([k, v]) => [k, v.label]));
export const COURSE_OPTIONS = Object.entries(COURSES).map(([value, v]) => ({ value, label: v.label }));

export function quizzesForCourse(courseType) {
  return COURSES[courseType]?.quizzes || [];
}

// Deprecated as a render-time source — use buildModules(modules, ...) on the
// per-class `modules` array instead. Still exported for compatibility.
export function modulesForCourse(courseType) {
  return COURSES[courseType]?.modules || [];
}

// Seed template for a new class (or for migrating an existing one). Returns
// the raw, code-defined modules — the caller assigns fresh item IDs before
// persisting.
export function defaultModulesForCourse(courseType) {
  return COURSES[courseType]?.modules || [];
}

export function homeworksForCourse(courseType) {
  return COURSES[courseType]?.homeworks || [];
}

// Personalized study guides (src/study-guide.js). A guide is a rule, not content: it names the
// homeworks it draws from and how many problems to take from each, and the problems themselves
// are chosen per student from their own submissions. PHY 115 has none authored yet.
export function studyGuidesForCourse(courseType) {
  return COURSES[courseType]?.studyGuides || [];
}

export function studyGuideById(courseType, guideId) {
  return studyGuidesForCourse(courseType).find(g => g.id === guideId) || null;
}
