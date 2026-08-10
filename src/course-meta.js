// Course identity — the small, content-free facts about each course offering. Kept in its own
// pure, env-agnostic module (like src/grading-core.js) so BOTH the client and the Netlify grading
// function can import it without the function bundling the whole course content.
//
// `courseType` (the object key) is the canonical course identifier throughout the app: it is
// stored on each class as `metadata.courseType`, selects content via `quizzesForCourse` /
// `modulesForCourse` / `homeworksForCourse` (src/courses/index.js), keys the server-side answer
// key (`ANSWER_KEYS[courseType]` in netlify/functions/_answerKeys.js), and names the per-course
// figure directory (`public/homeworkFigures/<courseType>/HWn/`).
//
// `label` is user-facing (the class-creation dropdown and the instructor class list) AND is fed to
// Claude as grading context in src/utils.js, src/homework.js, and netlify/functions/grade.js — so
// it should read as the course a student would recognize.
export const COURSE_META = {
  physics1: { label: "PHY 115: Physics I", code: "phy115" },
  physics2: { label: "PHY 215: Physics II", code: "phy215" },
};

// Label for a courseType, with a safe fallback for an unknown/missing value. Named `courseLabelFor`
// (not `courseLabel`) because every caller assigns it to a local `courseLabel` for the Claude prompt.
export const courseLabelFor = (courseType) => COURSE_META[courseType]?.label || "Physics";
