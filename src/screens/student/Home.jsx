import { s } from "../../theme.js";
import { ModuleList } from "../../components/lms/ModuleList.jsx";
import { isMaterialItem, viewRecordOf } from "../../material-views.js";
import { closesAssignment } from "../../auto-submit.js";

// Student "Home" landing page — collapsible module list.
// Props:
//   loggedInStudent
//   modules: merged modules (from buildModules) — items may be quiz/reading/notes/page/link/etc.
//   quizzes: course quizzes WITH dueDate already merged (from App)
//   submissions: all submissions for the active class
//   onStartQuiz(quiz): called when a quiz item is clicked
//   onStartHomework(hw): called when a homework item is clicked
//   onOpenMaterial(item): opens a posted material (file / reading / notes / link / page) AND
//     records the open. App.jsx owns it because the Resources page opens the same rows, and a
//     file must not behave differently depending on which page a student met it on.
//   materialViews: this student's own `{ [itemId]: record }` map for the active class, or null
//     while it is still loading. It is what ticks a material off, so the same node that tells
//     the instructor who opened a reading is what tells the student they have.
//   modules is already the COURSEWORK half of the split (course-info.js), so the reference
//     shelves are not in this list — they have their own page.
//
//   There is deliberately nothing above the module list. A welcome card lived here briefly and was
//   removed: on Home it put something the student had already read above the work they had not.
//   A course's introductory prose is a card on the Course Guide page, like any other.
export function Home({ loggedInStudent, modules, quizzes, homeworks = [], submissions, onStartQuiz, onStartHomework, onOpenMaterial, materialViews, storageKey }) {
  // A deadline auto-submission banks a score but leaves the assignment open (see
  // closesAssignment, auto-submit.js), so it must not tick the item off here either — the
  // student still has the rest of the set and their written work to hand in.
  const completedQuizIds = new Set(
    submissions.filter(s => s.studentId === loggedInStudent?.studentId && closesAssignment(s)).map(s => s.quizId)
  );

  const latestSub = id => [...submissions].reverse().find(s => s.studentId === loggedInStudent?.studentId && s.quizId === id) || null;

  // Null while the fetch is in flight, which reads as "nothing opened yet" for the moment it
  // takes to land. The ticks appear a beat late rather than being asserted from another
  // student's or another class's records — see myMaterialViews in App.jsx.
  const openedMap = materialViews || {};

  // `tracked` is what puts an item in the module header's "n / total" and gives it a completion
  // circle. It means "there is something here the student can finish": a resolved quiz or
  // homework, or a material with an actual file/link/page behind it. An unlinked placeholder and
  // a not-yet-authored homework return null and count for nothing, so a module the instructor is
  // still filling in never reads as work the student has failed to do.
  //
  // For a material, completing it is opening it. That is a weaker fact than a graded score, and
  // deliberately wears the same tick anyway: the checklist answers "have I been through this
  // module", and an unopened reading is exactly as unfinished as an unattempted quiz. What it is
  // NOT is evidence of reading (see material-views.js) — which is why nothing here or in the
  // instructor's view ever calls it that.
  const resolveItem = item => {
    if (item.type === "quiz") {
      const quiz = quizzes.find(q => q.id === item.refId);
      if (!quiz) return null;
      const completed = completedQuizIds.has(quiz.id);
      return { quiz, completed, tracked: true, sub: completed ? latestSub(quiz.id) : null };
    }
    if (item.type === "homework") {
      const homework = homeworks.find(h => h.id === item.refId);
      if (!homework) return null; // not yet authored — falls back to placeholder
      const completed = completedQuizIds.has(homework.id);
      return { homework, completed, tracked: true, sub: completed ? latestSub(homework.id) : null };
    }
    if (isMaterialItem(item)) {
      return { completed: !!viewRecordOf(openedMap[item._key || item.id]), tracked: true };
    }
    return null;
  };

  const onItemClick = (item, meta) => {
    // A quiz and a homework are never material items, so the order here is not load-bearing —
    // but every material goes through the ONE opener in App.jsx, which is what stops a reading
    // opening one way from a module and another way from a shelf.
    if (isMaterialItem(item)) { onOpenMaterial && onOpenMaterial(item); return; }
    if (item.type === "quiz" && meta?.quiz) { onStartQuiz(meta.quiz); return; }
    if (item.type === "homework" && meta?.homework) { onStartHomework(meta.homework, meta.completed); return; }
  };

  return (
    <div>
      <ModuleList modules={modules} resolveItem={resolveItem} onItemClick={onItemClick} storageKey={storageKey} />
    </div>
  );
}
