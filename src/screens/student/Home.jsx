import { s } from "../../theme.js";
import { ModuleList } from "../../components/lms/ModuleList.jsx";

// Student "Home" landing page — collapsible module list.
// Props:
//   loggedInStudent
//   modules: merged modules (from buildModules) — items may be quiz/reading/notes/page/link/etc.
//   quizzes: course quizzes WITH dueDate already merged (from App)
//   submissions: all submissions for the active class
//   onStartQuiz(quiz): called when a quiz item is clicked
//   onOpenPage(item): called when a page item is clicked
export function Home({ loggedInStudent, modules, quizzes, submissions, onStartQuiz, onOpenPage }) {
  const completedQuizIds = new Set(
    submissions.filter(s => s.studentId === loggedInStudent?.studentId).map(s => s.quizId)
  );

  const resolveItem = item => {
    if (item.type === "quiz") {
      const quiz = quizzes.find(q => q.id === item.refId);
      if (!quiz) return null;
      const completed = completedQuizIds.has(quiz.id);
      const sub = completed
        ? [...submissions].reverse().find(s => s.studentId === loggedInStudent?.studentId && s.quizId === quiz.id)
        : null;
      return { quiz, completed, sub };
    }
    return null;
  };

  const onItemClick = (item, meta) => {
    if (item.type === "quiz" && meta?.quiz) { onStartQuiz(meta.quiz); return; }
    if ((item.type === "reading" || item.type === "notes" || item.type === "link") && item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.type === "file" && item.downloadUrl) {
      window.open(item.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.type === "page" && item.pageId && onOpenPage) { onOpenPage(item); return; }
  };

  return (
    <div>
      <ModuleList modules={modules} resolveItem={resolveItem} onItemClick={onItemClick} />
    </div>
  );
}
