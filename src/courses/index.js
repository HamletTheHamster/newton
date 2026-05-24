import { QUIZZES_PHYSICS1, MODULES_PHYSICS1, HOMEWORKS_PHYSICS1 } from "./physics1.js";
import { QUIZZES_PHYSICS2, MODULES_PHYSICS2, HOMEWORKS_PHYSICS2 } from "./physics2.js";

const COURSES = {
  physics1: { label: "Physics 1", quizzes: QUIZZES_PHYSICS1, modules: MODULES_PHYSICS1, homeworks: HOMEWORKS_PHYSICS1 },
  physics2: { label: "Physics 2", quizzes: QUIZZES_PHYSICS2, modules: MODULES_PHYSICS2, homeworks: HOMEWORKS_PHYSICS2 },
};

export const COURSE_LABELS = Object.fromEntries(Object.entries(COURSES).map(([k, v]) => [k, v.label]));
export const COURSE_OPTIONS = Object.entries(COURSES).map(([value, v]) => ({ value, label: v.label }));

export function quizzesForCourse(courseType) {
  return COURSES[courseType]?.quizzes || [];
}

export function modulesForCourse(courseType) {
  return COURSES[courseType]?.modules || [];
}

export function homeworksForCourse(courseType) {
  return COURSES[courseType]?.homeworks || [];
}
