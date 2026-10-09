// Variant specs per course. Client-safe: a spec holds a prompt template and the range its given
// numbers move over, never an answer (those are in netlify/functions/_variantSolvers.js).
//
// Imported by BOTH sides on purpose - the browser renders the prompt from the spec and the
// grading function recomputes the same params from the same seed - which is what makes it
// impossible for a student to be graded against an instance they were not shown. Kept in its own
// module so the grading function can import the specs without pulling in course CONTENT (the
// quizzes, modules and homework problems), exactly as it imports course-meta.js for the label.
import { VARIANTS_PHYSICS2 } from "./physics2.js";

const VARIANTS = {
  physics1: {},   // PHY 115: none authored yet — every problem is served with its own numbers.
  physics2: VARIANTS_PHYSICS2,
};

export function variantsForCourse(courseType) {
  return VARIANTS[courseType] || {};
}

export function variantSpec(courseType, problemId) {
  return VARIANTS[courseType]?.[problemId] || null;
}
