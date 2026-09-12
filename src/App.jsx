import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import QRCode from "qrcode";

import { s, BG, CARD, TEAL, TEAL_DIM, MUTED, BORDER, buildTheme, ThemeContext } from "./theme.js";
import { fbGet, fbSet, fbUpdate, FIREBASE, classPath, slugifyClassId, uniqueClassId, fbUpload, fbDeleteStorage, fbListStorage } from "./firebase.js";
import { flattenSubs, subsByStudentMap, submissionMergePatch, keyForSubmission } from "./student-work.js";
import { makeHash, verifyPw, verifyTotp, genTotpSecret, genDeviceToken, hashToken } from "./auth.js";
import {
  ACCEPTED_IMG,
  dueToDate, fmtDueTime, isLate, effectiveDue, fmtDate, ptsPer, detectParts,
  compressImage, checkImageReadability, evaluateAnswer,
  parseRoster,
} from "./utils.js";
import { COURSE_LABELS, COURSE_OPTIONS, quizzesForCourse, homeworksForCourse, defaultModulesForCourse } from "./courses/index.js";
import { COURSE_META } from "./course-meta.js";
import { HW_GRADING_DEFAULTS, rescoreSubmission } from "./homework.js";
import { markOnTimeParts, isAutoSubmission, closesAssignment } from "./auto-submit.js";
import { runAutoSubmitSweep } from "./auto-submit-sweep.js";
import { buildModules } from "./courses/merge.js";
import { migrateLegacyModuleConfig } from "./courses/migrate.js";
import { newId } from "./courses/ids.js";
import { unseenAnnouncements } from "./announcements.js";
import { viewRecordOf, materialTarget, isMaterialItem } from "./material-views.js";
import { partitionModules, visibleShelves, normalizeGuide, guideHasContent } from "./course-info.js";

import { SyncBadge } from "./components/SyncBadge.jsx";
import { CustomSelect } from "./components/CustomSelect.jsx";
import { MultiSelect } from "./components/MultiSelect.jsx";
import { ChatMessages } from "./components/ChatMessages.jsx";
import { DragDropQuestion } from "./components/DragDropQuestion.jsx";
import { ChoiceQuestion } from "./components/ChoiceQuestion.jsx";
import { ManualAddStudent } from "./components/ManualAddStudent.jsx";
import { BugReportModal } from "./components/BugReportModal.jsx";
import { Footer } from "./components/Footer.jsx";
import { Wordmark } from "./components/Wordmark.jsx";
import { Shell } from "./components/lms/Shell.jsx";
import { Sidebar } from "./components/lms/Sidebar.jsx";
import { TodoRail } from "./components/lms/TodoRail.jsx";
import { Home } from "./screens/student/Home.jsx";
import { HomeworkRunner } from "./screens/student/HomeworkRunner.jsx";
import { Stub } from "./screens/student/Stub.jsx";
import { StudentSyllabus } from "./screens/student/StudentSyllabus.jsx";
import { StudentResources } from "./screens/student/StudentResources.jsx";
import { CourseGuide } from "./screens/student/CourseGuide.jsx";
import { InstructorSyllabus } from "./screens/instructor/InstructorSyllabus.jsx";
import { InstructorGuide } from "./screens/instructor/InstructorGuide.jsx";
import { StudentAnnouncements } from "./screens/student/StudentAnnouncements.jsx";
import { NewAnnouncementsModal } from "./components/lms/NewAnnouncementsModal.jsx";
import { StudentCalendar } from "./screens/student/StudentCalendar.jsx";
import { Modules as InstructorModules } from "./screens/instructor/Modules.jsx";
import { Announcements as InstructorAnnouncements } from "./screens/instructor/Announcements.jsx";
import { Gradebook } from "./screens/instructor/Gradebook.jsx";
import { Analytics } from "./screens/instructor/Analytics.jsx";
import { Assignments } from "./screens/instructor/Assignments.jsx";
import { Attendance } from "./screens/instructor/Attendance.jsx";
import { StudentGrades } from "./screens/student/StudentGrades.jsx";
import { CourseEvals } from "./screens/student/CourseEvals.jsx";
import { StudentSettings } from "./screens/student/StudentSettings.jsx";
import { AnnouncementEditor } from "./components/lms/AnnouncementEditor.jsx";
import { PageEditor } from "./components/lms/PageEditor.jsx";
import { PageViewer } from "./components/lms/PageViewer.jsx";
import { LockIcon } from "./components/lms/itemIcons.jsx";
import { NICKNAME_MAX, normalizeNickname, checkNicknameFormat, altNameFor, nicknameFromAltName, nicknameAllowed } from "./nickname.js";
import { isInstructorAccount, isAuditing, instructorAccountOf, studentRoster, auditors } from "./roster-scope.js";
import { labAssignments, labWeeksFor } from "./lab-schedule.js";

// ── Grade category defaults ───────────────────────────────────────────────────
// Manual assignment ordering: module items occupy order = modIdx*100 + itemIdx.
// Module 7 HW lands at 603; Midterm at 650 slots it right after.
// Final at 1350 follows Module 14 HW (1303). Labs start at 2000.
// KNOWN, unfixed: 650 is PHY 115's midterm, which sits after module 7. PHY 215 examines after
// module 6, so its Midterm column sorts one module late in the gradebook, the assignments hub
// and the student's grades list. Display order only, no effect on any score, and the instructor
// can drag the column (assignmentOrderOverrides). Fixing it properly means making this order
// per course like the lab count below, plus a migration, since a seeded class already stored 650.
// The lab list itself (how many sessions a course's term holds, and the trim for a class seeded
// with too many) lives in src/lab-schedule.js, where it is tested.
function makeDefaultManualAssignments(courseType) {
  return {
    asgn_midterm: { id: "asgn_midterm", title: "Midterm Exam", catId: "cat_midterm", maxPts: 100, order: 650 },
    asgn_final:   { id: "asgn_final",   title: "Final Exam",   catId: "cat_final",   maxPts: 100, order: 1350 },
    ...labAssignments(labWeeksFor(courseType)),
  };
}

// Exams are graded out of 100, labs and everything else out of 10. Classes seeded before
// `maxPts` varied got exams at 10; this lifts them to 100 once. `maxPtsSet` is written
// whenever the instructor edits the points themselves, and skipping those entries is what
// keeps this from overwriting a deliberate choice on the next load.
const EXAM_CATS = new Set(["cat_midterm", "cat_final"]);
function migrateExamMaxPts(manualAsgn) {
  let changed = false;
  const next = { ...manualAsgn };
  for (const [id, ma] of Object.entries(next)) {
    if (!ma || !EXAM_CATS.has(ma.catId) || ma.maxPtsSet || ma.maxPts !== 10) continue;
    next[id] = { ...ma, maxPts: 100 };
    changed = true;
  }
  return changed ? next : null;
}

// `plannedCount` is how many assignments the TERM will hold, which is not the same as how many
// exist: labs and both exams are seeded whole above, but homework and quizzes reach the gradebook
// only as they are written. It is read by the student's grade-scenario projection, which has to
// divide a slider over the whole term rather than over the handful built so far, and it is a
// floor that real assignments consume (see plannedRemaining in src/grade-scenarios.js). 0 means
// "however many actually exist", which is right for everything already enumerated.
const DEFAULT_GRADE_CATEGORIES = {
  cat_lab:     { id: "cat_lab",     name: "Laboratory",   weight: 20, dropLowest: 1, plannedCount: 0,  order: 0 },
  cat_hw:      { id: "cat_hw",      name: "Homework",     weight: 20, dropLowest: 1, plannedCount: 13, order: 1 },
  cat_quiz:    { id: "cat_quiz",    name: "Quiz",         weight: 10, dropLowest: 1, plannedCount: 13, order: 2 },
  cat_midterm: { id: "cat_midterm", name: "Midterm Exam", weight: 20, dropLowest: 0, plannedCount: 0,  order: 3 },
  cat_final:   { id: "cat_final",   name: "Final Exam",   weight: 30, dropLowest: 0, plannedCount: 0,  order: 4 },
};

// `plannedCount` arrived after these classes were seeded, so a stored category has no value for
// it. Fill it from the default for that id on read rather than writing the node on load: the
// projection is correct immediately, and the value persists the next time the instructor saves a
// category. A category the instructor added themselves gets 0 — the app cannot know how many of
// something it was never told about are coming, and 0 means "however many exist".
function withPlannedDefaults(cats) {
  const out = {};
  for (const [id, c] of Object.entries(cats || {})) {
    out[id] = (c && typeof c === 'object' && c.plannedCount == null)
      ? { ...c, plannedCount: DEFAULT_GRADE_CATEGORIES[id]?.plannedCount ?? 0 }
      : c;
  }
  return out;
}

// ── Sidebar definitions ──────────────────────────────────────────────────────
// Syllabus, Course Guide and Resources sit together on purpose: they are the three things a
// student consults rather than completes, and they used to be scattered between a PDF page and a
// couple of module rows carrying completion circles (see course-info.js).
const STUDENT_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
  { id: "syllabus", label: "Syllabus" },
  { id: "guide", label: "Course Guide" },
  { id: "resources", label: "Resources" },
  { id: "announcements", label: "Announcements" },
  { id: "grades", label: "Grades" },
  { id: "evals", label: "Course Evals" },
];

const INSTRUCTOR_SECTIONS = [
  { id: "modules",       label: "Home" },
  { id: "assignments",  label: "Assignments" },
  { id: "gradebook",    label: "Gradebook" },
  { id: "analytics",    label: "Analytics" },
  { id: "attendance",   label: "Attendance" },
  { id: "calendar",     label: "Calendar" },
  { id: "roster",       label: "Roster" },
  { id: "announcements", label: "Announcements" },
  { id: "syllabus",     label: "Syllabus" },
  { id: "guide",        label: "Course Guide" },
  { id: "evals",        label: "Evals" },
  { id: "settings",     label: "Settings" },
];

// This app NEVER writes a default instructor password. It used to seed one on first run,
// which put the live credential of a public repo's database in the repo — and a whole-node
// PUT of it was one transient read failure away from becoming the live password for everyone.
// An unseeded `settings` node now takes the instructor through "Set the instructor password"
// at the login instead (`settingsUnseeded` → `instLoginStep === "claim"`), so the only hash
// the database ever holds is one the instructor chose.
//
// The constant survives ONLY so a database still carrying the old seeded hash is detected and
// forced to replace it: a password published in a public repo is not a password. It is never
// hashed into a write. Once no database answers to it, this can go.
const LEGACY_SEEDED_PW = "physics123";

// One rule for the one instructor credential, applied at both the places that set it (the
// login's claim step and Settings → Change Instructor Password). It was 4 at the second and
// unstated at the first, for a password that guards every student's grades behind a public URL.
const MIN_INSTRUCTOR_PW = 8;

// The settings read failed, as distinct from the node being absent. They used to collapse to
// the same `null`, so one transient hiccup reseeded the instructor password to the default:
// the real password was then rejected on that machine while a still-open session elsewhere
// kept working from its in-memory copy (nothing re-reads the node after load), which is what
// made it look like a per-computer problem.
const SETTINGS_UNREADABLE = Symbol("settings-unreadable");

// A completed quiz whose save failed, held in localStorage until it lands. Unlike homework,
// a quiz has no draft node: the sitting lives only in component state, so without this a
// failed save plus a closed tab loses the whole attempt with nothing to redo it from. One
// slot is enough — a student can only ever finish one quiz at a time.
const PENDING_SUB_KEY = "newton_pending_sub";
const stashPendingSub = (classId, sub) => { try { localStorage.setItem(PENDING_SUB_KEY, JSON.stringify({ classId, sub })); } catch { /* quota or private mode: the in-session retry still stands */ } };
const readStashedSub = () => { try { return JSON.parse(localStorage.getItem(PENDING_SUB_KEY) || "null"); } catch { return null; } };
const clearStashedSub = () => { try { localStorage.removeItem(PENDING_SUB_KEY); } catch { /* nothing to do */ } };

export default function App() {
  // ── Classes & per-class state ───────────────────────────────────────────────
  const [classes, setClasses] = useState({});
  const [currentClassId, setCurrentClassIdState] = useState(() => {
    try { return localStorage.getItem("newton_current_class_id") || null; } catch { return null; }
  });
  const setCurrentClassId = id => {
    setCurrentClassIdState(id);
    try { if (id) localStorage.setItem("newton_current_class_id", id); else localStorage.removeItem("newton_current_class_id"); } catch {}
  };
  const classMeta = currentClassId ? classes[currentClassId]?.metadata || null : null;

  const [roster, setRoster] = useState([]);
  const [studentPws, setStudentPws] = useState({});
  const [dueDates, setDueDates] = useState({});
  const [submissions, setSubmissions] = useState([]);
  // Mirror of the above, so the submission helpers can compute the next array synchronously —
  // a loop of per-key deletes would otherwise see the same stale `submissions` closure on
  // every iteration and each write would undo the last. Kept current by the effect below AND
  // eagerly by each helper, since the effect only runs after the render.
  const submissionsRef = useRef([]);
  useEffect(() => { submissionsRef.current = submissions; }, [submissions]);
  const [checkedSubs, setCheckedSubs] = useState({});
  const [modules, setModules] = useState([]);
  const [moduleConfig, setModuleConfig] = useState({});
  const [pages, setPages] = useState({});
  const [customQuizzes, setCustomQuizzes] = useState({});
  const [uploads, setUploads] = useState({});
  const [syllabus, setSyllabus] = useState(null);          // { pdf, fields } or null
  const [courseGuide, setCourseGuide] = useState(null);    // { welcome, rhythm, policies } or null
  const [announcements, setAnnouncements] = useState({});  // raw { [annId]: record }
  // Announcement read receipts for the SIGNED-IN student only:
  // { classId, studentId, map: { [annId]: ISO timestamp } }, or null while unloaded.
  // It carries the class and student it was fetched for because the unread popup needs the
  // announcements and the receipts to come from the SAME class — deciding from a stale map
  // after a class switch is what made the pre-6.9 version of this feature misfire. Per-student
  // data, so like hwDrafts it is read on demand and never enters the class cache.
  const [annReads, setAnnReads] = useState(null);
  // Course-material opens for the SIGNED-IN student only:
  // { classId, studentId, map: { [itemId]: { first, last, count } } }, or null while unloaded.
  // Keyed by class and student for the same reason `annReads` is: the count written on the next
  // click is derived from this map, and a map left over from another class would restart every
  // count at 1. Per-student data, so like hwDrafts it is read on demand and never enters the
  // class cache; the instructor reads the whole node lazily in the Analytics tab.
  const [materialViews, setMaterialViews] = useState(null);
  const [gradeCategories, setGradeCategories] = useState({});
  const [gradeOverrides, setGradeOverrides] = useState({});     // { [studentId]: { [assignmentId]: { score?, excused? } } }
  const [assignmentCategories, setAssignmentCategories] = useState({});  // { [assignmentId]: catId }
  const [manualAssignments, setManualAssignments] = useState({});         // { [id]: { id, title, catId, maxPts } }
  const [attendance, setAttendance] = useState({});                      // { [date]: { date, labId, takenAt, marks: { [studentId]: status } } }
  const [assignmentNameOverrides, setAssignmentNameOverrides] = useState({}); // { [assignmentId]: string }
  const [assignmentOrderOverrides, setAssignmentOrderOverrides] = useState({}); // { [assignmentId]: number }
  const [homeworkSettings, setHomeworkSettings] = useState({});                 // { [hwId]: grading override obj }
  // Blackboard Grade Center link — { columns:[…], map:{ [assignmentId]: bbId }, usernames:{ [studentId]: username }, importedAt, sourceFile }.
  // Learned by importing a Blackboard full-Grade-Center download; see src/blackboard.js for why
  // the username and column id can't be derived. Kept OFF the roster deliberately: a roster CSV
  // re-upload replaces the whole array, which would silently drop every username.
  const [blackboard, setBlackboard] = useState(null);
  const [studentAvailableClasses, setStudentAvailableClasses] = useState([]);
  const [settings, setSettings] = useState({ passwordHash: null, passwordSalt: null });
  // Startup could not read `settings`. Kept apart from "not loaded yet" so the instructor
  // login can say which it is instead of spinning on "Settings still loading."
  const [settingsUnreadable, setSettingsUnreadable] = useState(false);
  // The read SUCCEEDED and there is no password hash: a genuinely first-run database (or one
  // whose hash was destroyed). Nothing is written on that discovery — the login asks the
  // instructor to set the password, which is the only thing that ever writes one.
  const [settingsUnseeded, setSettingsUnseeded] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [showNoClasses, setShowNoClasses] = useState(false);
  const [classDataLoading, setClassDataLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncLabel, setSyncLabel] = useState('');
  const [syncError, setSyncError] = useState('');
  const [fbConnStatus, setFbConnStatus] = useState('checking');
  const [fbConnError, setFbConnError] = useState('');

  // ── Top-level screen routing ────────────────────────────────────────────────
  const [screen, setScreen] = useState("student-search");
  const [studentSection, setStudentSection] = useState("home");
  const [instructorSection, setInstructorSection] = useState("submissions");

  // ── Student auth flow ───────────────────────────────────────────────────────
  const [nameQuery, setNameQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [pwInput, setPwInput] = useState(""); const [pwError, setPwError] = useState("");
  const [loggedInStudent, setLoggedInStudent] = useState(null);
  const [showStudentSettings, setShowStudentSettings] = useState(false);
  const [stuNickDraft, setStuNickDraft] = useState(""); const [stuNickMsg, setStuNickMsg] = useState(""); const [stuNickBusy, setStuNickBusy] = useState(false);
  const [editingAltName, setEditingAltName] = useState(null); const [altNameInput, setAltNameInput] = useState("");
  const [editingEmail, setEditingEmail] = useState(null); const [emailInput, setEmailInput] = useState("");
  const [newPw1, setNewPw1] = useState(""); const [newPw2, setNewPw2] = useState(""); const [pwChangeMsg, setPwChangeMsg] = useState("");
  const [stuEmailDraft, setStuEmailDraft] = useState(""); const [stuEmailMsg, setStuEmailMsg] = useState("");
  const [lightModeState, setLightModeStateRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("newton_light_mode");
      if (saved !== null) return saved === "1";
      return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
    } catch { return false; }
  });
  const lightMode = lightModeState;
  const setLightMode = v => {
    setLightModeStateRaw(v);
    try { localStorage.setItem("newton_light_mode", v ? "1" : "0"); } catch {}
  };
  const appTh = buildTheme(lightMode);

  // ── Quiz state ──────────────────────────────────────────────────────────────
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [activeHomework, setActiveHomework] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  // Who launched the quiz OR homework runner: "student" (the student portal) or "instructor"
  // (previewing from the Modules editor). One state serves both runners because they are separate
  // screens that are never active at once. It is the single source of truth for BOTH halves of the
  // difference — where "Back" returns to, and whether the run is an instructor preview — so the
  // two can never disagree (e.g. an instructor stranded on the student portal after previewing).
  // An instructor preview is always practice, so nothing it does is ever saved for any student.
  const [runnerFrom, setRunnerFrom] = useState("student");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [qIdx, setQIdx] = useState(0); const [apiHist, setApiHist] = useState([]);
  const [messages, setMessages] = useState([]); const [qScores, setQScores] = useState([]);
  const [input, setInput] = useState(""); const [pendingFile, setPendingFile] = useState(null);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [busy, setBusy] = useState(false); const [quizDone, setQuizDone] = useState(false); const [attemptCount, setAttemptCount] = useState(0); const [completedParts, setCompletedParts] = useState([]);
  const [subSaveError, setSubSaveError] = useState(false); const [pendingSub, setPendingSub] = useState(null);

  // ── Instructor state ────────────────────────────────────────────────────────
  const [instPw, setInstPw] = useState(""); const [instErr, setInstErr] = useState("");
  // "password" | "totp" | "claim". The claim step sets the instructor password: it is the only
  // thing that ever writes one, reached on a first-run database and on one still answering to
  // the old seeded default.
  const [instLoginStep, setInstLoginStep] = useState("password");
  const [mustReplacePw, setMustReplacePw] = useState(false);
  const [claimPw, setClaimPw] = useState(""); const [claimPw2, setClaimPw2] = useState(""); const [claimErr, setClaimErr] = useState(""); const [claimBusy, setClaimBusy] = useState(false);
  // Emailed reset. `resetChallenge` is the server's signed expiry+HMAC (never the code, which
  // only exists in the instructor's inbox) and lives in state ON PURPOSE: it dies with the tab,
  // so a code is only usable where it was asked for.
  const [instMsg, setInstMsg] = useState("");
  const [resetCode, setResetCode] = useState(""); const [resetChallenge, setResetChallenge] = useState(null);
  const [resetSentTo, setResetSentTo] = useState(""); const [resetMinutes, setResetMinutes] = useState(15);
  const [totpInput, setTotpInput] = useState(""); const [totpErr, setTotpErr] = useState(""); const [rememberDevice, setRememberDevice] = useState(false);
  const [totpSetupState, setTotpSetupState] = useState(null); const [totpSetupCode, setTotpSetupCode] = useState(""); const [totpSetupErr, setTotpSetupErr] = useState("");
  const [clearDevicesMsg, setClearDevicesMsg] = useState("");
  const [editPw, setEditPw] = useState(""); const [editPw2, setEditPw2] = useState(""); const [editPwMsg, setEditPwMsg] = useState("");
  const [openQuizzes, setOpenQuizzes] = useState({});
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerPw, setDangerPw] = useState(""); const [dangerErr, setDangerErr] = useState("");
  const [removeStudent, setRemoveStudent] = useState(null);
  const [removePw, setRemovePw] = useState(""); const [removeErr, setRemoveErr] = useState("");
  const [backupModal, setBackupModal] = useState(null);
  const [rosterMsg, setRosterMsg] = useState(""); const [backupMsg, setBackupMsg] = useState("");
  const [newClassName, setNewClassName] = useState(""); const [newClassCourse, setNewClassCourse] = useState(COURSE_OPTIONS[0]?.value || "physics1"); const [newClassMsg, setNewClassMsg] = useState("");
  const [editingClassId, setEditingClassId] = useState(null); const [editingClassNameInput, setEditingClassNameInput] = useState("");
  const [bugReports, setBugReports] = useState({});
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [instBugHover, setInstBugHover] = useState(false);
  const [courseEvals, setCourseEvals] = useState({});
  const [evalFilter, setEvalFilter] = useState("all");
  const [viewingPage, setViewingPage] = useState(null);     // { title, content } for student PageViewer
  const [editingPage, setEditingPage] = useState(null);     // { moduleId, itemId?, pageId?, title, content }
  const [editingCustomQuiz, setEditingCustomQuiz] = useState(null); // { quizId: null|string, title, text, moduleId: null|string }
  const [editingAnn, setEditingAnn] = useState(null);       // null | { annId?, title, body, createdAt? }

  const chatRef = useRef(null); const inputRef = useRef(null);
  const fileInputRef = useRef(null); const rosterInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const syncTimer = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const courseQuizzes = quizzesForCourse(classMeta?.courseType);
  // Due date for one assignment, as it applies to whoever is looking. For a signed-in student an
  // instructor's per-student extension replaces the class date; on the instructor side
  // `loggedInStudent` is null, so every instructor screen keeps seeing the class date.
  //
  // Merging it HERE rather than at each call site is deliberate: the quizzes/homeworks arrays are
  // what the module list, To Do rail, calendar, quiz screen and HomeworkRunner all read, so one
  // change makes the extension real everywhere at once — including the two late checks that
  // actually halve the score (`finishQuiz`, and HomeworkRunner's `late`).
  const myDueOverrides = loggedInStudent ? (gradeOverrides[loggedInStudent.studentId] || {}) : null;
  const dueFor = id => effectiveDue(dueDates[id] || null, myDueOverrides?.[id]);
  const quizzes = [
    ...courseQuizzes,
    ...Object.values(customQuizzes || {}).map(cq => ({
      id: cq.id, title: cq.title,
      questions: [{ id: `${cq.id}_q1`, text: cq.text }],
      isCustom: true,
    })),
  ].map(q => ({ ...q, dueDate: dueFor(q.id) }));
  const homeworks = homeworksForCourse(classMeta?.courseType).map(h => ({ ...h, dueDate: dueFor(h.id), grading: { ...HW_GRADING_DEFAULTS, ...(homeworkSettings[h.id] || {}) } }));
  // Manual assignments (exams, labs) as dated events. They live only in the gradebook — there
  // is nothing to open and no submission — but they still belong on the calendar and the To Do
  // rail, so they're dated through the same `dueDates` node keyed by assignment id.
  // `kind` is the category id minus its `cat_` prefix ("midterm", "final", "lab"), which is the
  // spelling category-colors.js keys on, so an exam is the same amber everywhere.
  const manualAssignmentList = Object.values(manualAssignments || {})
    .filter(Boolean)
    .map(ma => ({
      ...ma,
      kind: (ma.catId || "").replace(/^cat_/, "") || "assignment",
      dueDate: dueDates[ma.id] || null,
    }));
  const mergedModules = buildModules(modules, moduleConfig, pages, uploads);
  // Where each module is SHOWN, and nothing else. `mergedModules` stays complete on purpose:
  // `assignmentLocks` below, the instructor's `materialsOf` open rates, the course-evals nudge and
  // StudentGrades all read every module and none of them care which page it appears on. Filter a
  // shelf out of `mergedModules` itself and its files quietly disappear from the analytics while
  // students go on clicking them every week. See course-info.js.
  const { course: courseModules, resources: resourceShelves } = partitionModules(mergedModules);
  // A student only ever reaches a quiz/homework through its module item, so an
  // assignment is open exactly when some visible item points at it from a module
  // whose timed release has passed. An assignment no module references has
  // nothing gating it, so it stays open (it is absent from this map).
  //   { [refId]: { locked, releaseDate } }  releaseDate = the module's, when that's what locked it
  const assignmentLocks = (() => {
    const now = new Date();
    const map = {};
    for (const m of mergedModules) {
      const releaseAt = m.releaseDate ? dueToDate(m.releaseDate) : null;
      const moduleLocked = !!(releaseAt && now < releaseAt);
      for (const it of m.items || []) {
        if ((it.type !== "quiz" && it.type !== "homework") || !it.refId) continue;
        if (map[it.refId] && !map[it.refId].locked) continue;   // an already-open occurrence wins
        map[it.refId] = {
          locked: moduleLocked || !!it._hidden,
          releaseDate: moduleLocked ? m.releaseDate : null,
        };
      }
    }
    return map;
  })();
  const currentQ = activeQuiz?.questions[qIdx];
  const isImageQ = !!currentQ?.requiresImage, isYesNoQ = !!currentQ?.yesNo, isDragDropQ = !!currentQ?.dragDrop;
  const isChoiceQ = !!currentQ?.choices, isSurveyQ = !!currentQ?.survey;
  // Widget questions — anything whose answer isn't free-form prose. `detectParts` looks for
  // "(a) … (b) …" in the question text, which is meaningless for these.
  const isWidgetQ = isYesNoQ || isDragDropQ || isChoiceQ || isSurveyQ;
  // A survey question reuses the ordinary textarea (it just isn't graded), so it keeps autofocus.
  const usesTextInput = !isYesNoQ && !isDragDropQ && !isChoiceQ;
  // Multiple choice IS graded on the same 5-attempt / half-credit schedule as free response, so it
  // shows the counter; yes/no, drag-drop and survey have no attempt limit.
  const showsAttempts = !isYesNoQ && !isDragDropQ && !isSurveyQ;
  const currentParts = currentQ && !isWidgetQ ? detectParts(currentQ.text) : null;
  // "Handed in", not merely "has a record": a deadline auto-submission banks a score without
  // closing the assignment, so it must not tick the module list, drop the work off the To Do
  // rail, or make re-opening the homework launch in practice mode. See closesAssignment.
  const completedQuizIds = new Set(submissions.filter(s => s.studentId === loggedInStudent?.studentId && closesAssignment(s)).map(s => s.quizId));
  const sortedAnnouncements = Object.values(announcements).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // What the unread popup shows. Empty unless the loaded receipts belong to exactly this
  // (class, student) pair, so a class switch shows nothing at all until the new class's
  // receipts land rather than measuring one class's announcements against another's reads.
  const myAnnReads = (annReads && annReads.classId === currentClassId && annReads.studentId === loggedInStudent?.studentId) ? annReads.map : null;
  const unseenAnns = myAnnReads ? unseenAnnouncements(sortedAnnouncements, myAnnReads) : [];
  // The same pairing rule for this student's own material opens, which the module list reads to
  // tick a reading/file/link/page off. Null until the fetch lands, which the list treats as "no
  // opens yet" — the ticks fill in a moment later rather than being asserted against another
  // class's records.
  const myMaterialViews = (materialViews && materialViews.classId === currentClassId && materialViews.studentId === loggedInStudent?.studentId) ? materialViews.map : null;
  const syllabusBreakdown = syllabus?.fields?.gradingBreakdown ?? [];
  const gradeCatList = Object.values(gradeCategories ?? {});
  const syllabusMismatch = gradeCatList.length > 0 && syllabusBreakdown.length > 0 && (() => {
    const nameMatch = (a, b) => { const la = a.toLowerCase().trim(), lb = b.toLowerCase().trim(); return la === lb || la.startsWith(lb) || lb.startsWith(la); };
    return gradeCatList.length !== syllabusBreakdown.length ||
      gradeCatList.some(cat => {
        const match = syllabusBreakdown.find(g => nameMatch(g.name, cat.name));
        return !match || Number(match.weight) !== Number(cat.weight);
      });
  })();

  // Flattened student search across all active classes (used on the student-search screen).
  const allActiveStudents = [];
  for (const [cid, c] of Object.entries(classes)) {
    if (!c?.metadata?.active) continue;
    const className = c.metadata.name;
    const r = Array.isArray(c.roster) ? c.roster : [];
    for (const stu of r) allActiveStudents.push({ ...stu, classId: cid, className });
  }
  const seenStudentIds = new Set();
  // The roster as "the students I am assessing": the instructor's own entry, if they have one, is
  // not one of them. Deliberately derived here and passed to the four class views rather than
  // filtered into `roster` itself, which is the enrollment record and still has to carry that
  // entry (it logs in, it does the homework, it keeps its own grades).
  const classStudents = useMemo(() => studentRoster(roster), [roster]);

  const filteredRoster = nameQuery.trim().length === 0 ? [] : allActiveStudents.filter(st => {
    const q = nameQuery.toLowerCase();
    const matches = (st.altName && st.altName.toLowerCase().includes(q)) || st.fullName.toLowerCase().includes(q) || st.lastName.toLowerCase().includes(q) || st.firstName.toLowerCase().includes(q);
    if (!matches || seenStudentIds.has(st.studentId)) return false;
    seenStudentIds.add(st.studentId);
    return true;
  }).slice(0, 8);

  const unreadBugCount = Object.values(bugReports).filter(b => !b.read).length;
  const unreadEvalCount = Object.values(courseEvals).filter(e => !e.read).length;

  // ── To Do rail ─────────────────────────────────────────────────────────────
  // `upcoming` = due within the next 7 days, soonest first.
  // `overdue`  = already past due, most recent miss first. Kept (not dropped) so
  // the student's rail keeps nagging — late work still earns partial credit.
  // Manual assignments (exams, labs) are `manual: true`: they appear while upcoming, since a
  // date the student should see coming is exactly what the rail is for, but never in the
  // past-due section — a missed exam isn't work you can still go and submit.
  const { upcoming: upcomingAssignments, overdue: overdueAssignments } = (() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const all = [
      ...quizzes.filter(q => q.dueDate).map(q => ({ id: q.id, title: q.title, due: q.dueDate, kind: "quiz", ref: q })),
      ...homeworks.filter(h => h.dueDate).map(h => ({ id: h.id, title: h.title, due: h.dueDate, kind: "homework", ref: h })),
      ...manualAssignmentList.filter(m => m.dueDate).map(m => ({ id: m.id, title: m.title, due: m.dueDate, kind: m.kind, manual: true })),
    ].map(t => ({ t, due: dueToDate(t.due) })).filter(({ due }) => !!due);
    return {
      upcoming: all.filter(({ due }) => due >= now && due <= horizon).sort((a, b) => a.due - b.due).map(({ t }) => t),
      overdue: all.filter(({ due, t }) => due < now && !t.manual).sort((a, b) => b.due - a.due).map(({ t }) => t),
    };
  })();

  // An assignment still gated by its module's timed release stays listed (its due
  // date is real and the student should see it coming) but isn't clickable — the
  // rail shows when it opens instead. A manual assignment is never clickable either:
  // there's nothing to open, it happens in the room.
  //
  // Labs are dropped from the student rail entirely, upcoming AND past due. They run on
  // shared in-person equipment that has to be set up for the session, so there are no
  // makeups: a student can neither start one early nor do anything about one they missed.
  // The rail is for work that is still actionable; a missed lab listed there would only
  // prompt requests for a makeup that doesn't exist. Labs still appear on the calendar,
  // which is where "when does my lab meet" belongs, and in the grades list once scored.
  const toStudentTodo = list => list
    .filter(t => !completedQuizIds.has(t.id) && t.kind !== "lab")
    .map(({ ref, ...t }) => {
      if (t.manual) return t;
      const lock = assignmentLocks[t.id];
      if (lock?.locked) return { ...t, locked: true, releaseDate: lock.releaseDate };
      return { ...t, onClick: t.kind === "quiz" ? () => startQuiz(ref, false) : () => startHomework(ref) };
    });
  const todoItems = loggedInStudent ? toStudentTodo(upcomingAssignments) : [];
  const todoOverdue = loggedInStudent ? toStudentTodo(overdueAssignments) : [];

  // Instructor rail (Home tab only): what's currently open for the class — no
  // per-student completion filter and no past-due section, since a closed
  // assignment isn't "open". Clicking jumps to the Assignments hub.
  const instructorTodoItems = upcomingAssignments.map(({ ref, ...t }) => ({
    ...t,
    onClick: () => setInstructorSection("assignments"),
  }));

  // ── Load from Firebase on startup ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [classesData, settingsData, bugsData, evalsData] = await Promise.all([
          fbGet('classes').catch(() => null),
          // NOT `.catch(() => null)`: a failed read and an absent node must stay
          // distinguishable, or the seeding branch below fires on a hiccup. It does not
          // throw either — `settings` holds nothing a STUDENT needs, so a failure here
          // must not take the portal down for a class; it is surfaced at the instructor
          // login, which is the only place it means anything.
          fbGet('settings').catch(() => SETTINGS_UNREADABLE),
          fbGet('bugReports').catch(() => null),
          fbGet('courseEvals').catch(() => null),
        ]);
        setFbConnStatus('ok');
        const loadedClasses = (classesData && typeof classesData === 'object') ? classesData : {};
        setClasses(loadedClasses);
        if (settingsData === SETTINGS_UNREADABLE) {
          setSettingsUnreadable(true);
        } else if (settingsData?.passwordHash) {
          setSettings(settingsData);
        } else {
          // A SUCCESSFUL read of a node with no password hash. Write NOTHING: the old code
          // seeded a published default here and PUT it, which both handed out a known
          // credential and took `totpSecret`/`trustedDevices` with it. Keep whatever the node
          // does hold (a 2FA secret outlives a lost password) and let the login ask for a new
          // password, which `claimInstructorPw` PATCHes in.
          if (settingsData && typeof settingsData === 'object') setSettings(settingsData);
          setSettingsUnseeded(true);
        }
        if (bugsData && typeof bugsData === 'object') setBugReports(bugsData);
        if (evalsData && typeof evalsData === 'object') setCourseEvals(evalsData);
        const storedId = (() => { try { return localStorage.getItem("newton_current_class_id"); } catch { return null; } })();
        if (storedId && loadedClasses[storedId]) {
          const c = loadedClasses[storedId];
          if (Array.isArray(c.roster)) setRoster(c.roster);
          if (c.studentPws && typeof c.studentPws === 'object') setStudentPws(c.studentPws);
          if (c.dueDates && typeof c.dueDates === 'object') setDueDates(c.dueDates);
          if (c.checkedSubs && typeof c.checkedSubs === 'object') setCheckedSubs(c.checkedSubs);
          if (c.submissions && typeof c.submissions === 'object') setSubmissions(flattenSubs(c.submissions));
          if (c.moduleConfig && typeof c.moduleConfig === 'object') setModuleConfig(c.moduleConfig);
          if (c.pages && typeof c.pages === 'object') setPages(c.pages);
          if (c.uploads && typeof c.uploads === 'object') setUploads(c.uploads);
          if (c.syllabus) setSyllabus(c.syllabus);
          if (c.courseGuide !== undefined) setCourseGuide(normalizeGuide(c.courseGuide));
          if (Array.isArray(c.modules)) setModules(c.modules);
          if (c.announcements && typeof c.announcements === 'object') setAnnouncements(c.announcements);
          if (c.gradeCategories && typeof c.gradeCategories === 'object') setGradeCategories(withPlannedDefaults(c.gradeCategories));
          else setGradeCategories(DEFAULT_GRADE_CATEGORIES);
          if (c.gradeOverrides && typeof c.gradeOverrides === 'object') setGradeOverrides(c.gradeOverrides);
          if (c.assignmentCategories && typeof c.assignmentCategories === 'object') setAssignmentCategories(c.assignmentCategories);
          if (c.manualAssignments && typeof c.manualAssignments === 'object') setManualAssignments(c.manualAssignments);
          if (c.attendance && typeof c.attendance === 'object') setAttendance(c.attendance);
          if (c.customQuizzes && typeof c.customQuizzes === 'object') setCustomQuizzes(c.customQuizzes);
          if (c.homeworkSettings && typeof c.homeworkSettings === 'object') setHomeworkSettings(c.homeworkSettings);
          if (c.blackboard && typeof c.blackboard === 'object') setBlackboard(c.blackboard);
        } else if (storedId) {
          setCurrentClassId(null);
        }
      } catch (e) {
        setFbConnStatus('error');
        setFbConnError(e.message || String(e));
        console.error("Startup load error:", e);
      }
      setDataReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    const t = setTimeout(() => setShowNoClasses(true), 500);
    return () => clearTimeout(t);
  }, [dataReady]);

  // ── Load a class's full per-class data into state ──────────────────────────
  const loadClassData = async classId => {
    if (!classId) return;
    setClassDataLoading(true);
    try {
      const [rosterData, pwsData, datesData, checkedData, subsData, modulesData, moduleConfigData, pagesData, uploadsData, annsData, gradeCatsData, gradeOverridesData, assignmentCatsData, manualAsgnData, nameOverrideData, orderOverrideData, syllabusData, customQuizzesData, hwSettingsData, attendanceData, blackboardData, courseGuideData] = await Promise.all([
        fbGet(classPath(classId, 'roster')).catch(() => null),
        fbGet(classPath(classId, 'studentPws')).catch(() => null),
        fbGet(classPath(classId, 'dueDates')).catch(() => null),
        fbGet(classPath(classId, 'checkedSubs')).catch(() => null),
        fbGet(classPath(classId, 'submissions')).catch(() => null),
        fbGet(classPath(classId, 'modules')).catch(() => null),
        fbGet(classPath(classId, 'moduleConfig')).catch(() => null),
        fbGet(classPath(classId, 'pages')).catch(() => null),
        fbGet(classPath(classId, 'uploads')).catch(() => null),
        fbGet(classPath(classId, 'announcements')).catch(() => null),
        fbGet(classPath(classId, 'gradeCategories')).catch(() => null),
        fbGet(classPath(classId, 'gradeOverrides')).catch(() => null),
        fbGet(classPath(classId, 'assignmentCategories')).catch(() => null),
        fbGet(classPath(classId, 'manualAssignments')).catch(() => null),
        fbGet(classPath(classId, 'assignmentNameOverrides')).catch(() => null),
        fbGet(classPath(classId, 'assignmentOrderOverrides')).catch(() => null),
        fbGet(classPath(classId, 'syllabus')).catch(() => null),
        fbGet(classPath(classId, 'customQuizzes')).catch(() => null),
        fbGet(classPath(classId, 'homeworkSettings')).catch(() => null),
        fbGet(classPath(classId, 'attendance')).catch(() => null),
        fbGet(classPath(classId, 'blackboard')).catch(() => null),
        fbGet(classPath(classId, 'courseGuide')).catch(() => null),
      ]);
      const rosterArr = Array.isArray(rosterData) ? rosterData : [];
      const pwsObj = (pwsData && typeof pwsData === 'object') ? pwsData : {};
      const datesObj = (datesData && typeof datesData === 'object') ? datesData : {};
      const checkedObj = (checkedData && typeof checkedData === 'object') ? checkedData : {};
      const subsArr = flattenSubs(subsData);
      let moduleConfigObj = (moduleConfigData && typeof moduleConfigData === 'object') ? moduleConfigData : {};
      const pagesObj = (pagesData && typeof pagesData === 'object') ? pagesData : {};
      const uploadsObj = (uploadsData && typeof uploadsData === 'object') ? uploadsData : {};
      const annsObj = (annsData && typeof annsData === 'object') ? annsData : {};

      // Grade data — seed default categories on first class load
      let gradeCatsObj = withPlannedDefaults((gradeCatsData && typeof gradeCatsData === 'object') ? gradeCatsData : {});
      if (Object.keys(gradeCatsObj).length === 0) {
        gradeCatsObj = { ...DEFAULT_GRADE_CATEGORIES };
        try { await fbSet(classPath(classId, 'gradeCategories'), gradeCatsObj); } catch (e) { console.warn("Grade category seed failed:", e?.message); }
      }
      const gradeOverridesObj = (gradeOverridesData && typeof gradeOverridesData === 'object') ? gradeOverridesData : {};
      const assignmentCatsObj = (assignmentCatsData && typeof assignmentCatsData === 'object') ? assignmentCatsData : {};
      // The lab count is per course (PHY 215 teaches 13 lecture weeks, PHY 115 fourteen), so the
      // seed below needs to know which course this class is; the module seed uses it too.
      const courseType = classes[classId]?.metadata?.courseType;
      let manualAsgnObj = (manualAsgnData && typeof manualAsgnData === 'object') ? manualAsgnData : {};
      if (Object.keys(manualAsgnObj).length === 0) {
        manualAsgnObj = makeDefaultManualAssignments(courseType);
        try { await fbSet(classPath(classId, 'manualAssignments'), manualAsgnObj); } catch (e) { console.warn("Manual assignment seed failed:", e?.message); }
      } else {
        const migrated = migrateExamMaxPts(manualAsgnObj);
        if (migrated) {
          manualAsgnObj = migrated;
          try { await fbSet(classPath(classId, 'manualAssignments'), manualAsgnObj); } catch (e) { console.warn("Exam max-points migration failed:", e?.message); }
        }
      }
      const nameOverrideObj = (nameOverrideData && typeof nameOverrideData === 'object') ? nameOverrideData : {};
      const orderOverrideObj = (orderOverrideData && typeof orderOverrideData === 'object') ? orderOverrideData : {};

      // Auto-migrate / seed `modules` on first load. Idempotent: presence of the
      // array in RTDB is the sentinel.
      let modulesArr = Array.isArray(modulesData) ? modulesData : null;
      if (modulesArr === null) {
        const template = defaultModulesForCourse(courseType);
        const { modules: seeded, moduleConfig: migratedCfg } = migrateLegacyModuleConfig(template, moduleConfigObj);
        modulesArr = seeded;
        try {
          await fbSet(classPath(classId, 'modules'), seeded);
          // Only rewrite moduleConfig if the migration produced something different
          // (i.e. there was legacy hiddenItems/itemOverrides data to rekey).
          if (Object.keys(migratedCfg).length || Object.keys(moduleConfigObj).length) {
            await fbSet(classPath(classId, 'moduleConfig'), Object.keys(migratedCfg).length ? migratedCfg : null);
            moduleConfigObj = migratedCfg;
          }
        } catch (e) { console.warn("Module seed/migration failed:", e?.message || e); }
      }

      const syllabusObj = (syllabusData && typeof syllabusData === 'object') ? syllabusData : null;
      const courseGuideObj = normalizeGuide(courseGuideData);

      setRoster(rosterArr);
      setStudentPws(pwsObj);
      setDueDates(datesObj);
      setCheckedSubs(checkedObj);
      setSubmissions(subsArr);
      setModules(modulesArr);
      setModuleConfig(moduleConfigObj);
      setPages(pagesObj);
      const customQuizzesObj = (customQuizzesData && typeof customQuizzesData === 'object') ? customQuizzesData : {};
      setCustomQuizzes(customQuizzesObj);
      setUploads(uploadsObj);
      setSyllabus(syllabusObj);
      setCourseGuide(courseGuideObj);
      setAnnouncements(annsObj);
      setGradeCategories(gradeCatsObj);
      setGradeOverrides(gradeOverridesObj);
      setAssignmentCategories(assignmentCatsObj);
      setManualAssignments(manualAsgnObj);
      setAssignmentNameOverrides(nameOverrideObj);
      setAssignmentOrderOverrides(orderOverrideObj);
      const hwSettingsObj = (hwSettingsData && typeof hwSettingsData === 'object') ? hwSettingsData : {};
      setHomeworkSettings(hwSettingsObj);
      const attendanceObj = (attendanceData && typeof attendanceData === 'object') ? attendanceData : {};
      setAttendance(attendanceObj);
      const blackboardObj = (blackboardData && typeof blackboardData === 'object') ? blackboardData : null;
      setBlackboard(blackboardObj);
      setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), roster: rosterArr, studentPws: pwsObj, dueDates: datesObj, checkedSubs: checkedObj, submissions: subsData || {}, modules: modulesArr, moduleConfig: moduleConfigObj, pages: pagesObj, uploads: uploadsObj, syllabus: syllabusObj, courseGuide: courseGuideObj, announcements: annsObj, gradeCategories: gradeCatsObj, gradeOverrides: gradeOverridesObj, assignmentCategories: assignmentCatsObj, manualAssignments: manualAsgnObj, customQuizzes: customQuizzesObj, homeworkSettings: hwSettingsObj, attendance: attendanceObj, blackboard: blackboardObj } }));
    } finally { setClassDataLoading(false); }
  };

  // ── Live refresh of instructor-authored content ────────────────────────────
  // There is no realtime listener (the RTDB REST stream is an EventSource, which
  // can't carry the X-Firebase-AppCheck header our reads require), so a student's
  // tab otherwise renders whatever was fetched at page load — an instructor's
  // module reorder, rename, added item, visibility toggle or due-date change would
  // never reach an already-open session. This re-pulls ONLY instructor-owned nodes;
  // per-student state (submissions, drafts, attempt counts) is deliberately left
  // alone so a poll can never clobber the student's own in-flight work.
  const refreshingRef = useRef(false);
  const refreshClassContent = useCallback(async classId => {
    if (!classId || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const [modulesData, moduleConfigData, pagesData, uploadsData, customQuizzesData,
             datesData, hwSettingsData, annsData, gradeOverridesData, syllabusData,
             manualAsgnData, attendanceData, courseGuideData] = await Promise.all([
        fbGet(classPath(classId, 'modules')).catch(() => undefined),
        fbGet(classPath(classId, 'moduleConfig')).catch(() => undefined),
        fbGet(classPath(classId, 'pages')).catch(() => undefined),
        fbGet(classPath(classId, 'uploads')).catch(() => undefined),
        fbGet(classPath(classId, 'customQuizzes')).catch(() => undefined),
        fbGet(classPath(classId, 'dueDates')).catch(() => undefined),
        fbGet(classPath(classId, 'homeworkSettings')).catch(() => undefined),
        fbGet(classPath(classId, 'announcements')).catch(() => undefined),
        fbGet(classPath(classId, 'gradeOverrides')).catch(() => undefined),
        fbGet(classPath(classId, 'syllabus')).catch(() => undefined),
        fbGet(classPath(classId, 'manualAssignments')).catch(() => undefined),
        fbGet(classPath(classId, 'attendance')).catch(() => undefined),
        fbGet(classPath(classId, 'courseGuide')).catch(() => undefined),
      ]);
      // `undefined` = the fetch failed; skip that node rather than blanking it.
      // `null` = the node genuinely doesn't exist → normalize to empty, same as loadClassData.
      const patch = {};
      const take = (data, setter, key, normalize) => {
        if (data === undefined) return;
        const val = normalize(data);
        if (val === undefined) return;
        setter(val);
        patch[key] = val;
      };
      const obj = d => (d && typeof d === 'object') ? d : {};
      // Only adopt `modules` when RTDB really returned an array — a missing node means
      // "not seeded yet", which is loadClassData's job (seeding here would race it).
      take(modulesData, setModules, 'modules', d => Array.isArray(d) ? d : undefined);
      take(moduleConfigData, setModuleConfig, 'moduleConfig', obj);
      take(pagesData, setPages, 'pages', obj);
      take(uploadsData, setUploads, 'uploads', obj);
      take(customQuizzesData, setCustomQuizzes, 'customQuizzes', obj);
      take(datesData, setDueDates, 'dueDates', obj);
      take(hwSettingsData, setHomeworkSettings, 'homeworkSettings', obj);
      take(annsData, setAnnouncements, 'announcements', obj);
      take(gradeOverridesData, setGradeOverrides, 'gradeOverrides', obj);
      take(syllabusData, setSyllabus, 'syllabus', d => (d && typeof d === 'object') ? d : null);
      // Students consume manualAssignments too (exam/lab titles, points and dates feed their
      // calendar and grades list), so it has to be re-polled like any other instructor node.
      // Seeding stays loadClassData's job: a missing node normalizes to {} here, never seeds.
      take(manualAsgnData, setManualAssignments, 'manualAssignments', obj);
      // Students consume attendance indirectly: an absence zeroes that day's lab (resolveScore),
      // and their grades list labels the row. Without re-polling, a roll call taken while a
      // student had their portal open would not reach them until they reloaded.
      take(attendanceData, setAttendance, 'attendance', obj);
      // The guide is instructor-authored and students read it, so it re-polls like any other
      // such node: without this, a welcome or a corrected deadline edited mid-morning would not
      // reach a student whose portal has been open since breakfast.
      take(courseGuideData, setCourseGuide, 'courseGuide', d => normalizeGuide(d));
      if (Object.keys(patch).length) {
        setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), ...patch } }));
      }
    } catch (e) {
      console.warn("Content refresh failed:", e?.message || e);
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // Student portal only. The instructor's own edits are optimistic (state is set
  // before the PUT resolves), so polling there could momentarily revert a change
  // that is still in flight.
  const studentPortalActive = screen === "student-portal" && !!loggedInStudent && !!currentClassId;

  // Re-pull THIS student's own submissions alongside the content refresh. Their own node is
  // the one per-student exception worth polling: it is the record of what they have already
  // handed in, and a session that never refreshes it shows work they finished elsewhere as
  // still to do — which is how the same assignment gets started twice. Scoped to their own
  // key, so it neither ships the class's submissions to a student nor touches anyone else's
  // entries in state. Safe to adopt wholesale now that every write is a single-key write:
  // RTDB is always at least as fresh as this session, since saves are awaited before state.
  const refreshOwnSubmissions = useCallback(async (cid, sid) => {
    if (!cid || !sid) return;
    let node;
    try { node = await fbGet(classPath(cid, `submissions/${sid}`)); }
    catch (e) { console.warn("Own-submission refresh failed:", e?.message || e); return; }
    const mine = flattenSubs({ [sid]: node });
    setSubmissions(prev => {
      const others = prev.filter(s => s.studentId !== sid);
      const next = [...others, ...mine];
      // Only re-render when something actually changed, or the 60s poll churns the whole tree.
      const sameLength = next.length === prev.length;
      const sameIds = sameLength && next.every(s => prev.some(p => p.id === s.id));
      return sameIds ? prev : next;
    });
  }, []);

  useEffect(() => {
    if (!studentPortalActive) return;
    const cid = currentClassId, sid = loggedInStudent.studentId;
    const pull = () => {
      if (document.visibilityState !== "visible") return;
      refreshClassContent(cid);
      refreshOwnSubmissions(cid, sid);
    };
    pull();
    const timer = setInterval(pull, 60000);
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
    };
  }, [studentPortalActive, currentClassId, loggedInStudent?.studentId, refreshClassContent, refreshOwnSubmissions]);

  // The signed-in student's own read receipts, fetched once per (class, student). The cancel
  // flag matters on a class switch: a fetch still in flight for the class they just left must
  // never be adopted, or its receipts would be read against the new class's announcements.
  useEffect(() => {
    if (!studentPortalActive) return;
    const cid = currentClassId, sid = loggedInStudent.studentId;
    let cancelled = false;
    fbGet(classPath(cid, `announcementReads/${sid}`))
      .catch(() => null)
      .then(d => { if (!cancelled) setAnnReads({ classId: cid, studentId: sid, map: (d && typeof d === 'object') ? d : {} }); });
    return () => { cancelled = true; };
  }, [studentPortalActive, currentClassId, loggedInStudent?.studentId]);

  // The signed-in student's own course-material opens, fetched once per (class, student) for the
  // same reason and with the same cancel guard. Only this student's subtree is read: the whole
  // node is the instructor's to load, in the Analytics tab.
  useEffect(() => {
    if (!studentPortalActive) return;
    const cid = currentClassId, sid = loggedInStudent.studentId;
    let cancelled = false;
    fbGet(classPath(cid, `materialViews/${sid}`))
      .catch(() => null)
      .then(d => { if (cancelled) return; setMaterialViews(cur => {
        const fetched = (d && typeof d === 'object') ? d : {};
        // A click can land while this GET is in flight (the student opened a module the moment
        // the portal did). `recordMaterialView` has already written that record to state and to
        // RTDB, so the older fetched map is merged UNDER it rather than over it — otherwise the
        // tick the student just earned would vanish until the next reload.
        const optimistic = (cur && cur.classId === cid && cur.studentId === sid) ? cur.map : null;
        return { classId: cid, studentId: sid, map: optimistic ? { ...fetched, ...optimistic } : fetched };
      }); });
    return () => { cancelled = true; };
  }, [studentPortalActive, currentClassId, loggedInStudent?.studentId]);

  // ── Deadline auto-submission ────────────────────────────────────────────────
  //
  // A student who resolved problems and never pressed "Finish & Submit" is recorded as missing,
  // which the gradebook cannot tell from a student who did nothing. When a deadline passes over
  // a draft holding real work, that work becomes a submission by itself — see auto-submit.js for
  // the four rules that keep it from costing marks or bypassing the written-work step.
  //
  // There is no cron (no server-side Firebase credential exists in this app), so the sweep runs
  // when a session that would care opens the class. The instructor's pass is the one that
  // matters, because it is guaranteed to run before anyone looks at a grade; the student's own
  // pass, over their own drafts only, is what stops their grades page showing the assignment as
  // missing when they next log in. Both write the same deterministic key, so whichever runs
  // second finds the submission already there and does nothing.
  //
  // Once per (class, viewer) per session: deadlines do not pass often enough to poll for, and a
  // sweep that re-ran on the 60s content refresh would re-read drafts all afternoon.
  const sweptRef = useRef(new Set());
  const homeworksRef = useRef(homeworks); homeworksRef.current = homeworks;
  const dueForRef = useRef(dueFor); dueForRef.current = dueFor;
  useEffect(() => {
    const cid = currentClassId;
    const asStudent = studentPortalActive;
    const asInstructor = screen === "instructor" && !!cid;
    if (!cid || (!asStudent && !asInstructor)) return;
    // Wait for the class to be loaded before the guard below is armed. `dueDates` and
    // `gradeOverrides` arrive in the same `loadClassData` batch as the roster, and a sweep run
    // against an empty roster or empty due dates would find nothing, mark itself done, and never
    // run again once the data landed — the feature would simply not happen.
    if (classDataLoading || !classMeta?.courseType) return;
    const students = asStudent ? [loggedInStudent] : classStudents;
    if (!students.length || !Object.keys(dueDates || {}).length) return;

    const who = asStudent ? loggedInStudent.studentId : "class";
    const key = `${cid}|${who}`;
    if (sweptRef.current.has(key)) return;
    sweptRef.current.add(key);

    let cancelled = false;
    (async () => {
      try {
        // The student side resolves their own extension through `dueFor`, which already folds in
        // gradeOverrides; the instructor side has no `loggedInStudent`, so it must look the
        // per-student extension up itself, or an extended student would be auto-submitted at the
        // class deadline and quietly lose the extension they were given.
        const dueLookup = asStudent
          ? (_sid, hwId) => dueForRef.current(hwId)
          : (sid, hwId) => effectiveDue(dueDates[hwId] || null, gradeOverrides[sid]?.[hwId]);
        const built = await runAutoSubmitSweep({
          classId: cid,
          courseType: classMeta?.courseType,
          homeworks: homeworksRef.current,
          students,
          submissions: submissionsRef.current,
          dueFor: dueLookup,
        });
        for (const sub of built) {
          if (cancelled) return;
          try { await addSubmission(sub); }
          catch (e) { console.warn("Auto-submit failed for", sub.studentId, sub.quizId, e?.message || e); }
        }
      } catch (e) {
        // A sweep that cannot run must never block the portal it runs behind.
        console.warn("Auto-submit sweep failed:", e?.message || e);
        sweptRef.current.delete(key);
      }
    })();
    return () => { cancelled = true; };
  }, [studentPortalActive, screen, currentClassId, loggedInStudent?.studentId, classStudents, classMeta?.courseType, classDataLoading, dueDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll / focus ──────────────────────────────────────────────────────────
  const doScroll = useCallback(() => { const el = chatRef.current; if (!el) return; el.scrollTop = el.scrollHeight - el.clientHeight; }, []);
  useLayoutEffect(() => { doScroll(); }, [messages]);
  useLayoutEffect(() => { doScroll(); }, [busy]);
  useEffect(() => { if (screen === "quiz" && usesTextInput && !quizDone) requestAnimationFrame(() => inputRef.current?.focus()); }, [qIdx, screen, quizDone]);
  const navStateRef = useRef({ screen, quizDone, showStudentSettings, runnerFrom });
  useEffect(() => { navStateRef.current = { screen, quizDone, showStudentSettings, runnerFrom }; }, [screen, quizDone, showStudentSettings, runnerFrom]);
  useEffect(() => {
    const go = next => { navStateRef.current = { ...navStateRef.current, screen: next, showStudentSettings: false }; setScreen(next); };
    const onPop = () => {
      const { screen, quizDone, showStudentSettings, runnerFrom } = navStateRef.current;
      // Browser-back out of either runner returns to whoever launched it (see runnerReturnScreen).
      const runnerBack = runnerFrom === "instructor" ? "instructor" : "student-portal";
      if (screen === "quiz") { history.pushState({ newton: "quiz" }, "", ""); (quizDone || runnerFrom === "instructor") ? go(runnerBack) : setShowLeaveConfirm(true); }
      else if (screen === "homework") { go(runnerBack); }
      else if (showStudentSettings) { history.pushState({ newton: "settings" }, "", ""); navStateRef.current = { ...navStateRef.current, showStudentSettings: false }; setShowStudentSettings(false); setNewPw1(""); setNewPw2(""); setPwChangeMsg(""); setStuEmailDraft(""); setStuEmailMsg(""); setStuNickDraft(""); setStuNickMsg(""); }
      else if (screen === "student-pw") { history.pushState({ newton: "student-pw" }, "", ""); setSelectedStudent(null); go("student-search"); }
      else if (screen === "inst-login") { history.pushState({ newton: "inst-login" }, "", ""); go("student-search"); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy && screen === "quiz" && usesTextInput && !quizDone) requestAnimationFrame(() => inputRef.current?.focus());
    prevBusy.current = busy;
  }, [busy]);

  // ── Firebase save helper ───────────────────────────────────────────────────
  // `opts.merge` sends a PATCH instead of a PUT, so only the keys in `data` are written and
  // siblings are left alone. Use it wherever a write could otherwise clobber data another
  // session added between this session's load and this save.
  const fbSave = async (path, data, label, opts = {}) => {
    setSyncStatus('saving'); setSyncLabel(label || ''); setSyncError('');
    clearTimeout(syncTimer.current);
    try {
      if (opts.merge) await fbUpdate(path, data);
      else await fbSet(path, data);
      setSyncStatus('saved');
      syncTimer.current = setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      const msg = e.message || String(e);
      console.error("fbSave error:", msg);
      setSyncError(msg);
      setSyncStatus('error');
      syncTimer.current = setTimeout(() => setSyncStatus('idle'), 8000);
      throw e;
    }
  };

  // ── Persist functions ──────────────────────────────────────────────────────
  const requireClass = () => {
    if (!currentClassId) throw new Error("No class selected, so nothing can be saved.");
    return currentClassId;
  };
  const updateClassCache = (classId, key, value) => {
    setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), [key]: value } }));
  };
  const saveRoster = async r => {
    const cid = requireClass();
    // INVARIANT: studentId is the unique key for ALL of a student's per-class data
    // (submissions, grades/overrides, homework drafts & attempts, uploaded work). Two roster
    // entries sharing an ID would therefore share that data, so removing one would delete the
    // other's. Enforce uniqueness at this single chokepoint — every roster write (manual add,
    // CSV upload, backup import) flows through here — by collapsing duplicate/blank IDs
    // (keeping the first occurrence) before persisting.
    const seen = new Set();
    const unique = (Array.isArray(r) ? r : []).filter(st => {
      const id = st?.studentId;
      if (!id || seen.has(id)) return false;
      seen.add(id); return true;
    });
    const dropped = (Array.isArray(r) ? r.length : 0) - unique.length;
    if (dropped > 0) console.warn(`saveRoster: collapsed ${dropped} duplicate/blank student ID(s) to preserve the one-student-per-ID invariant.`);
    setRoster(unique); updateClassCache(cid, 'roster', unique); await fbSave(classPath(cid, 'roster'), unique);
  };
  // Edit ONE field on ONE roster entry, without rewriting the roster array.
  //
  // `saveRoster` puts the whole array, which is right for a CSV upload or an add but wrong for
  // a field edit: the array is a session-old snapshot, and a student's tab can sit open for
  // hours. A student changing their own email therefore used to re-put the roster as it looked
  // when they logged in, silently un-enrolling every student the instructor had added since —
  // the same stale-session clobber that destroyed a homework submission.
  //
  // The roster has no per-student key to write (it is an array, and a positional path is only
  // meaningful against the CURRENT array), so the index is resolved from a fresh read taken
  // immediately before the write. That closes the window from hours to milliseconds, and the
  // worst a residual race could do is mistype one field, never drop a student.
  //
  // `guard` runs against the FRESHLY READ entry, not the session's snapshot, and throws to abort.
  // That is what makes the instructor's nickname lock mean something: a student's tab can sit open
  // for hours, `refreshClassContent` deliberately never re-polls the roster, and so a student whose
  // name was locked five minutes ago still holds an entry that says otherwise.
  const saveRosterFields = async (studentId, patch, guard) => {
    const cid = requireClass();
    let live;
    try { live = await fbGet(classPath(cid, 'roster')); }
    catch { live = null; }
    const arr = Array.isArray(live) ? live : roster;
    const i = arr.findIndex(r => r?.studentId === studentId);
    if (i < 0) throw new Error("That student is no longer on the roster, so the change was not saved.");
    if (guard) { const stop = guard(arr[i]); if (stop) throw new Error(stop); }
    // PATCH the entry, so the keys this call does not name are left exactly as they are. A `null`
    // here prunes one named field on purpose (clearing an email, resetting a name); it is never a
    // whole-object rewrite built from local state.
    await fbSave(classPath(cid, `roster/${i}`), patch, '', { merge: true });
    const next = arr.map(r => {
      if (r?.studentId !== studentId) return r;
      const out = { ...r };
      for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete out[k]; else out[k] = v; }
      return out;
    });
    setRoster(next);
    updateClassCache(cid, 'roster', next);
    return next[i];
  };
  const saveRosterField = (studentId, field, value) => saveRosterFields(studentId, { [field]: value ?? null });
  // An instructor edit clears the student-set provenance: whatever it was, from now on this name is
  // the instructor's, and the roster should stop flagging it for review.
  const saveAltName = async stu => {
    const val = altNameInput.trim();
    await saveRosterFields(stu.studentId, { altName: val || null, altNameBy: null, altNameAt: null });
    setEditingAltName(null);
  };
  const resetAltName = async stu => {
    if (!window.confirm(`Reset this student's display name back to ${stu.fullName}?`)) return;
    await saveRosterFields(stu.studentId, { altName: null, altNameBy: null, altNameAt: null });
  };
  // The abuse switch. Locking does NOT rename anybody: the two are separate acts, so an instructor
  // can revoke the privilege without also deciding what the student should now be called (and can
  // reset without revoking, which is the usual case for an honest mistake).
  const toggleNicknameLock = async stu => {
    const locking = nicknameAllowed(stu);
    const msg = locking
      ? `Stop ${stu.fullName} from setting their own preferred name? You can still change it for them.`
      : `Let ${stu.fullName} set their own preferred name again?`;
    if (!window.confirm(msg)) return;
    await saveRosterFields(stu.studentId, { nicknameLocked: locking ? true : null });
  };

  // Which roster entry is the instructor's own. It is ONE fact about the class, not a property
  // each student has, so it is set by naming an entry rather than by a switch on every row; the
  // named entry is then left out of the gradebook, the analytics, the assignments hub's progress
  // column and the attendance roll. See `src/roster-scope.js` for what it deliberately does not
  // touch. Setting it clears the previous holder first, so the "at most one per class" invariant
  // is enforced at the only place that can write it.
  const setInstructorAccount = async studentId => {
    const current = instructorAccountOf(roster);
    if (current && current.studentId === studentId) return;
    if (current) await saveRosterFields(current.studentId, { instructorAccount: null });
    if (studentId) await saveRosterFields(studentId, { instructorAccount: true });
  };

  // Whether a student is AUDITING the course - following it unofficially, with no grade to earn
  // and no attendance to keep. Unlike the instructor's own account this is a property of the
  // entry, so any number can carry it: the "Auditing" multi-select beside the account picker
  // ticks any number of names, and each tick writes ONE entry's leaf. It leaves them out of the
  // same four views (gradebook, analytics, progress column, attendance roll) while they keep
  // logging in, doing the work and seeing their own grades. `null` rather than `false` clears
  // it, so an entry that is not auditing carries no field at all.
  const setAuditing = async (studentId, on) => {
    await saveRosterFields(studentId, { auditing: on ? true : null });
  };

  // ── The student's own preferred first name ────────────────────────────────
  // Writes the SAME `altName` the instructor edits, so there is one display name in the app rather
  // than two that can disagree. The student supplies a first name only and `altNameFor` pairs it
  // with their real surname, which is what keeps the gradebook and analytics reading as a roster.
  //
  // Every name is approved by netlify/functions/screen-name.js before it is written. That check is
  // server-side and fails closed, because the name is public: it is shown to the instructor
  // everywhere and to everyone on the pre-login student picker.
  const saveStudentNickname = async () => {
    const stu = loggedInStudent;
    if (!stu) return;
    const raw = normalizeNickname(stuNickDraft);
    const current = nicknameFromAltName(stu);
    const guard = live => (nicknameAllowed(live) ? null : "Your instructor manages your display name for this course.");

    const apply = async (patch, note) => {
      let saved;
      try { saved = await saveRosterFields(stu.studentId, patch, guard); }
      catch (e) { setStuNickMsg(e?.message || "Could not save your name. Please try again."); return false; }
      setLoggedInStudent(saved);
      setSelectedStudent(saved);
      setStuNickDraft(nicknameFromAltName(saved));
      setStuNickMsg(note);
      setTimeout(() => setStuNickMsg(""), 4000);
      return true;
    };

    setStuNickMsg("");
    if (!raw) {                                   // blank is the reset, not an error
      if (!current) { setStuNickMsg("You are already using your name on file."); return; }
      setStuNickBusy(true);
      await apply({ altName: null, altNameBy: null, altNameAt: null }, `✅ You are now shown as ${stu.fullName}.`);
      setStuNickBusy(false);
      return;
    }
    if (raw === current) { setStuNickMsg("That is already your preferred name."); return; }
    const format = checkNicknameFormat(raw);
    if (!format.ok) { setStuNickMsg(format.reason); return; }

    setStuNickBusy(true);
    let verdict;
    try {
      const res = await fetch("/.netlify/functions/screen-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: raw, firstName: stu.firstName, fullName: stu.fullName }),
      });
      verdict = await res.json();
    } catch {
      verdict = null;
    }
    if (!verdict || verdict.ok !== true) {
      setStuNickMsg(verdict?.reason || "The name check is unavailable right now. Please try again in a few minutes.");
      setStuNickBusy(false);
      return;
    }
    const altName = altNameFor(raw, stu);
    await apply({ altName, altNameBy: "student", altNameAt: new Date().toISOString() }, `✅ You are now shown as ${altName}.`);
    setStuNickBusy(false);
  };
  const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const saveEmail = async stu => {
    const val = emailInput.trim();
    if (val && !isValidEmail(val)) return;
    await saveRosterField(stu.studentId, 'email', val || null);
    setEditingEmail(null);
  };
  const saveStudentEmail = async () => {
    const val = stuEmailDraft.trim();
    if (val && !isValidEmail(val)) { setStuEmailMsg("Please enter a valid email address."); return; }
    try { await saveRosterField(loggedInStudent.studentId, 'email', val || null); }
    catch (e) { setStuEmailMsg(e?.message || "Could not save your email. Please try again."); return; }
    setLoggedInStudent(prev => { const { email: _, ...rest } = prev; return val ? { ...rest, email: val } : rest; });
    setStuEmailMsg("✅ Email updated.");
    setTimeout(() => setStuEmailMsg(""), 3000);
  };
  const saveStudentPws = async p => { const cid = requireClass(); setStudentPws(p); updateClassCache(cid, 'studentPws', p); await fbSave(classPath(cid, 'studentPws'), p); };
  // One student's password hash, written at its own key. Passing the whole map through
  // `saveStudentPws` meant a student's first login re-put every OTHER student's hash as this
  // session had loaded them — so two students setting a password within the same window left
  // one of them silently back on the default. `null` clears (an instructor's "Reset PW").
  const saveStudentPw = async (studentId, hash) => {
    const cid = requireClass();
    const next = { ...studentPws };
    if (hash) next[studentId] = hash; else delete next[studentId];
    setStudentPws(next);
    updateClassCache(cid, 'studentPws', next);
    await fbSave(classPath(cid, `studentPws/${studentId}`), hash || null);
  };
  const saveDueDates = async d => { const cid = requireClass(); setDueDates(d); updateClassCache(cid, 'dueDates', d); await fbSave(classPath(cid, 'dueDates'), d); };
  const saveHomeworkSettingFor = async (hwId, overrides) => {
    const cid = requireClass();
    const next = overrides
      ? { ...homeworkSettings, [hwId]: overrides }
      : (() => { const n = { ...homeworkSettings }; delete n[hwId]; return n; })();
    setHomeworkSettings(next);
    updateClassCache(cid, 'homeworkSettings', next);
    await fbSave(classPath(cid, 'homeworkSettings'), Object.keys(next).length ? next : null, 'hw settings');
  };
  // Two rules, both learned the hard way on the one node that gates instructor access.
  //
  // It PATCHES the keys it is given, never PUTs a whole object rebuilt from local state:
  // `settings` here is a snapshot from load, so a PUT of `{ ...settings, oneChangedKey }`
  // rewrites the password hash and the 2FA secret out of possibly-stale memory every time
  // anyone clears a trusted device.
  //
  // And it adopts into state only AFTER the write lands. It used to `setSettings` first, so a
  // failed write left the session believing a new password that the database had never
  // accepted: it worked until the tab was reloaded, and the OLD password was still the live
  // one everywhere else. Callers pass only the keys they are changing; `null` deletes one.
  const saveSettings = async patch => {
    await fbSave('settings', patch, 'settings', { merge: true });
    setSettings(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        // A patch key may be a deep path (`trustedDevices/<hash>`), which is what lets one
        // device be added without rewriting the map. Mirror it the same way locally.
        const segs = k.split('/').filter(Boolean);
        let node = next;
        for (const seg of segs.slice(0, -1)) { node[seg] = { ...(node[seg] || {}) }; node = node[seg]; }
        const leaf = segs[segs.length - 1];
        if (v === null) delete node[leaf]; else node[leaf] = v;
      }
      return next;
    });
  };
  // The ONE place an instructor password is written. `settingsUnseeded` (first run, or a
  // destroyed hash) and a database still answering to `LEGACY_SEEDED_PW` both land here.
  const claimInstructorPw = async pw => {
    const h = await makeHash(pw.trim());
    await saveSettings({ passwordHash: h.hash, passwordSalt: h.salt });
    setSettingsUnseeded(false); setMustReplacePw(false);
  };
  const saveChecked = async c => { const cid = requireClass(); setCheckedSubs(c); updateClassCache(cid, 'checkedSubs', c); await fbSave(classPath(cid, 'checkedSubs'), c); };
  const saveModules = async nextArr => {
    const cid = requireClass();
    const safe = Array.isArray(nextArr) ? nextArr : [];
    setModules(safe);
    updateClassCache(cid, 'modules', safe);
    await fbSave(classPath(cid, 'modules'), safe.length ? safe : null);
  };
  const saveModuleConfigFor = async (moduleId, nextCfg) => {
    const cid = requireClass();
    const empty = !nextCfg
      || (!nextCfg.releaseDate
          && (!nextCfg.hiddenItems || Object.keys(nextCfg.hiddenItems).length === 0));
    const updated = { ...moduleConfig };
    if (empty) delete updated[moduleId]; else updated[moduleId] = nextCfg;
    setModuleConfig(updated);
    updateClassCache(cid, 'moduleConfig', updated);
    await fbSave(classPath(cid, 'moduleConfig'), Object.keys(updated).length ? updated : null);
  };
  const savePage = async (pageId, page) => {
    const cid = requireClass();
    const updated = { ...pages, [pageId]: page };
    setPages(updated);
    updateClassCache(cid, 'pages', updated);
    await fbSave(classPath(cid, `pages/${pageId}`), page);
  };
  const saveCustomQuiz = async (quizId, quiz) => {
    const cid = requireClass();
    const updated = { ...customQuizzes, [quizId]: quiz };
    setCustomQuizzes(updated);
    updateClassCache(cid, 'customQuizzes', updated);
    await fbSave(classPath(cid, `customQuizzes/${quizId}`), quiz);
  };
  const deleteCustomQuiz = async quizId => {
    const cid = requireClass();
    const updatedCq = { ...customQuizzes }; delete updatedCq[quizId];
    setCustomQuizzes(updatedCq);
    updateClassCache(cid, 'customQuizzes', updatedCq);
    await fbSave(classPath(cid, `customQuizzes/${quizId}`), null);
    const updatedMa = { ...manualAssignments }; delete updatedMa[quizId];
    await saveManualAssignments(updatedMa);
  };
  const deletePage = async pageId => {
    const cid = requireClass();
    const updated = { ...pages }; delete updated[pageId];
    setPages(updated);
    updateClassCache(cid, 'pages', updated);
    await fbSave(classPath(cid, `pages/${pageId}`), null);
  };
  const saveUpload = async (uploadId, meta) => {
    const cid = requireClass();
    const updated = { ...uploads, [uploadId]: meta };
    setUploads(updated);
    updateClassCache(cid, 'uploads', updated);
    await fbSave(classPath(cid, `uploads/${uploadId}`), meta);
  };
  const deleteUpload = async uploadId => {
    const cid = requireClass();
    const existing = uploads[uploadId];
    const updated = { ...uploads }; delete updated[uploadId];
    setUploads(updated);
    updateClassCache(cid, 'uploads', updated);
    await fbSave(classPath(cid, `uploads/${uploadId}`), null);
    if (existing?.storagePath) {
      try { await fbDeleteStorage(existing.storagePath); } catch (e) { console.warn("Storage delete failed:", e?.message || e); }
    }
  };

  const saveSyllabus = async (data) => {
    const cid = requireClass();
    setSyllabus(data);
    updateClassCache(cid, 'syllabus', data);
    await fbSave(classPath(cid, 'syllabus'), data);
  };
  const deleteSyllabus = async () => {
    const cid = requireClass();
    setSyllabus(null);
    updateClassCache(cid, 'syllabus', null);
    await fbSave(classPath(cid, 'syllabus'), null);
  };

  // The course guide is a single instructor-authored document with one writer, so a whole-node
  // write is correct here (unlike anything a student can also write - see student-work.js). It is
  // normalized on the way in as well as on the way out, since Claude produces the first draft.
  const saveCourseGuide = async (data) => {
    const cid = requireClass();
    const guide = normalizeGuide(data ? { ...data, updatedAt: new Date().toISOString() } : null);
    setCourseGuide(guide);
    updateClassCache(cid, 'courseGuide', guide);
    await fbSave(classPath(cid, 'courseGuide'), guide);
  };

  const saveAnnouncement = async (ann) => {
    const cid = requireClass();
    const now = new Date().toISOString();
    const annId = ann.id || newId("ann");
    const record = { id: annId, title: ann.title.trim(), body: ann.body, createdAt: ann.createdAt || now, ...(ann.id ? { updatedAt: now } : {}) };
    const updated = { ...announcements, [annId]: record };
    setAnnouncements(updated);
    updateClassCache(cid, 'announcements', updated);
    await fbSave(classPath(cid, `announcements/${annId}`), record);
    if (ann.sendEmail) {
      // `auditing` rides along so the footer does not tell an auditor they are enrolled.
      const recipients = roster.filter(s => s.email).map(s => ({ name: s.fullName, email: s.email, auditing: isAuditing(s) }));
      if (recipients.length > 0) {
        const c = syllabus?.fields?.course;
        const prefix = [c?.term, c?.number].filter(Boolean).join(" ");
        const subject = prefix ? `${prefix}: ${record.title}` : record.title;
        fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients, subject, body: record.body,
            title: record.title, courseLabel: prefix || null,
            postedAt: record.createdAt, url: window.location.origin,
            secret: import.meta.env.VITE_EMAIL_SEND_SECRET,
          }),
        }).catch(() => {});
      }
    }
  };
  const deleteAnnouncement = async (annId) => {
    const cid = requireClass();
    const updated = { ...announcements }; delete updated[annId];
    setAnnouncements(updated);
    updateClassCache(cid, 'announcements', updated);
    await fbSave(classPath(cid, `announcements/${annId}`), null);
    // Drop the read receipts with it. Receipts are keyed student-first, so there is no single
    // node to null out; each student who has one is rewritten. Best-effort, and deliberately
    // after the announcement itself is gone: orphaned receipts are invisible either way.
    try {
      const all = await fbGet(classPath(cid, 'announcementReads'));
      const owners = Object.keys(all || {}).filter(sid => all[sid] && annId in all[sid]);
      await Promise.all(owners.map(sid => fbSet(classPath(cid, `announcementReads/${sid}/${annId}`), null)));
    } catch (e) { console.warn("Announcement read-receipt cleanup failed:", e?.message || e); }
  };
  // Record that the signed-in student has seen these announcements: dismissing the popup, or
  // opening the Announcements page. One small PUT per announcement rather than one merged write
  // of their whole map, so a receipt written in another tab can't be clobbered.
  //
  // Written with fbSet, not fbSave: this is background bookkeeping the student never asked for,
  // and a sync badge for it (or worse, a red error badge) would be noise. A failed write simply
  // means the notice pops again next time, which is self-healing.
  const markAnnouncementsRead = async ids => {
    if (!loggedInStudent || !currentClassId || !ids?.length) return;
    const cid = currentClassId, sid = loggedInStudent.studentId, at = new Date().toISOString();
    setAnnReads(prev => (prev && prev.classId === cid && prev.studentId === sid)
      ? { ...prev, map: { ...prev.map, ...Object.fromEntries(ids.map(id => [id, at])) } }
      : prev);
    await Promise.all(ids.map(id => fbSet(classPath(cid, `announcementReads/${sid}/${id}`), at).catch(() => {})));
  };
  // Record that the signed-in student clicked a posted course material (a file, reading, lecture
  // notes, link or page). Addresses ONE item's record — `materialViews/{sid}/{itemId}` — with a
  // PATCH, so a second tab's click on a different item cannot be erased by this one.
  //
  // `count` is read-modify-write from the local map, so two tabs opening the SAME file in the
  // same moment can lose one increment. That is the accepted worst case: what the instructor
  // reads is whether a student opened the material at all, and the existence of the record
  // (plus `first`/`last`) carries that whatever happens to the tally.
  //
  // Written with fbUpdate, not fbSave: like a read receipt, this is background bookkeeping the
  // student never asked for, and a sync badge (or worse a red error badge) for it would be
  // noise. A failed write means one uncounted click, which is self-healing on the next one.
  const recordMaterialView = async itemOrId => {
    const itemId = typeof itemOrId === "string" ? itemOrId : itemOrId?._key || itemOrId?.id;
    if (!loggedInStudent || !currentClassId || !itemId) return;
    const cid = currentClassId, sid = loggedInStudent.studentId, at = new Date().toISOString();
    const loaded = (materialViews && materialViews.classId === cid && materialViews.studentId === sid)
      ? materialViews.map : null;
    // A click can land before the student's own map has arrived (they expanded a module the
    // moment the portal opened). Writing from an unloaded map would reset `first` to now and the
    // count to 1, so the one leaf is read instead — one small GET, only on that race.
    const prev = loaded
      ? viewRecordOf(loaded[itemId])
      : viewRecordOf(await fbGet(classPath(cid, `materialViews/${sid}/${itemId}`)).catch(() => null));
    const next = { first: prev?.first || at, last: at, count: (prev?.count || 0) + 1 };
    setMaterialViews(cur => (cur && cur.classId === cid && cur.studentId === sid)
      ? { ...cur, map: { ...cur.map, [itemId]: next } }
      // Not loaded yet (the click beat the fetch). Seed the map anyway so the item ticks
      // immediately; the in-flight fetch merges itself under this record, never over it.
      : { classId: cid, studentId: sid, map: { [itemId]: next } });
    await fbUpdate(classPath(cid, `materialViews/${sid}/${itemId}`), next).catch(() => {});
  };

  // Opening a posted material, from EITHER place a student meets one: a row in a module on Home,
  // or a row on a reference shelf on the Resources page. One function, so a file cannot behave
  // differently depending on which page the student found it on, and so the open is recorded from
  // both (the shelves are in the instructor's open rates exactly as the weekly readings are).
  //
  // The record is written first and can never block or throw: the click's job is to open the
  // file, and bookkeeping the student never asked for must not be able to stop it.
  const openMaterial = item => {
    if (!isMaterialItem(item)) return;
    try { Promise.resolve(recordMaterialView(item)).catch(() => {}); } catch { /* bookkeeping only */ }
    if (item.type === "page") { setViewingPage({ title: item.title, content: item.pageContent || "" }); return; }
    const url = materialTarget(item);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  // Sitting on the Announcements page IS reading them, so the popup stays out of the way there
  // and the page itself records the view. Without this the modal would cover the very list the
  // student navigated to, and closing it would be the only way to read what is underneath.
  useEffect(() => {
    if (studentPortalActive && studentSection === "announcements" && unseenAnns.length) {
      markAnnouncementsRead(unseenAnns.map(a => a.id));
    }
  }, [studentPortalActive, studentSection, unseenAnns.length]);
  const saveGradeCategories = async cats => {
    const cid = requireClass();
    setGradeCategories(cats);
    updateClassCache(cid, 'gradeCategories', cats);
    await fbSave(classPath(cid, 'gradeCategories'), cats);
  };
  const saveAssignmentCategories = async cats => {
    const cid = requireClass();
    setAssignmentCategories(cats);
    updateClassCache(cid, 'assignmentCategories', cats);
    await fbSave(classPath(cid, 'assignmentCategories'), cats);
  };
  const saveManualAssignments = async next => {
    const cid = requireClass();
    setManualAssignments(next);
    updateClassCache(cid, 'manualAssignments', next);
    await fbSave(classPath(cid, 'manualAssignments'), Object.keys(next).length ? next : null);
  };
  // Attendance is written one SESSION at a time (`attendance/{date}`), never as a whole node:
  // a roll call is a single day's work, and a whole-node write would let a stale in-memory copy
  // clobber a session edited from another tab.
  const saveAttendanceSession = async session => {
    const cid = requireClass();
    const next = { ...attendance, [session.id]: session };
    setAttendance(next);
    updateClassCache(cid, 'attendance', next);
    await fbSave(classPath(cid, `attendance/${session.id}`), session, 'attendance');
  };
  const deleteAttendanceSession = async sessionId => {
    const cid = requireClass();
    const next = { ...attendance }; delete next[sessionId];
    setAttendance(next);
    updateClassCache(cid, 'attendance', next);
    await fbSave(classPath(cid, `attendance/${sessionId}`), null, 'attendance');
  };

  const saveAssignmentNameOverrides = async next => {
    const cid = requireClass();
    setAssignmentNameOverrides(next);
    await fbSave(classPath(cid, 'assignmentNameOverrides'), Object.keys(next).length ? next : null);
  };
  // The Blackboard link is instructor-only bookkeeping (no student ever reads it), so it needs
  // the three-place wiring but NOT refreshClassContent.
  const saveBlackboardLink = async next => {
    const cid = requireClass();
    setBlackboard(next);
    updateClassCache(cid, 'blackboard', next);
    await fbSave(classPath(cid, 'blackboard'), next);
  };
  const saveAssignmentOrderOverrides = async next => {
    const cid = requireClass();
    setAssignmentOrderOverrides(next);
    await fbSave(classPath(cid, 'assignmentOrderOverrides'), Object.keys(next).length ? next : null);
  };
  const saveOverrideForStudent = async (studentId, studentOverrides, label) => {
    const cid = requireClass();
    const updated = { ...gradeOverrides, [studentId]: studentOverrides };
    setGradeOverrides(updated);
    updateClassCache(cid, 'gradeOverrides', updated);
    await fbSave(classPath(cid, `gradeOverrides/${studentId}`), studentOverrides, label);
  };

  // Bulk grade entry — a whole exam or lab column at once. Deliberately NOT a loop over
  // saveOverrideForStudent: every call there rebuilds `updated` from the same stale
  // `gradeOverrides` closure, so only the last student's edit would survive in local state.
  // gradeOverrides is instructor-written only (students never touch it), so writing the whole
  // node once keeps local state and RTDB exactly in step with a single sync status.
  const saveOverridesForStudents = async (byStudent, label) => {
    const cid = requireClass();
    const updated = { ...gradeOverrides };
    for (const [sid, ov] of Object.entries(byStudent)) {
      if (ov && Object.keys(ov).length) updated[sid] = ov;
      else delete updated[sid];
    }
    setGradeOverrides(updated);
    updateClassCache(cid, 'gradeOverrides', updated);
    // One PATCH of just the students in this batch, not a PUT of the whole node: a bulk exam
    // entry must not roll back an excusal or an extension another session recorded meanwhile.
    const patch = {};
    for (const [sid, ov] of Object.entries(byStudent)) patch[sid] = (ov && Object.keys(ov).length) ? ov : null;
    await fbSave(classPath(cid, 'gradeOverrides'), patch, label, { merge: true });
  };

  // ── Submissions: one key per submission, never a whole-array rewrite ───────
  //
  // A submission is the ONLY record of work a student cannot redo, so nothing here may ever
  // write a composite value derived from local state. It used to: `submissions/{studentId}`
  // held an ARRAY, and every save rewrote the whole array from whatever this session had
  // loaded. Two sessions of the same student (a phone that submitted homework, a laptop tab
  // opened before it) meant the second one's next submission silently deleted the first's —
  // which is exactly how a completed homework was lost on 2026-09-06, an hour and a half
  // after it was handed in, by the student then taking a quiz in a stale tab.
  //
  // Writing `submissions/{studentId}/{submissionId}` makes that structurally impossible: a
  // save touches one key, so a stale session has nothing to overwrite with. Reads go through
  // `flattenSubs`, which still understands the old array shape.
  const addSubmission = async sub => {
    const cid = requireClass();
    if (!sub?.studentId || !sub?.id) throw new Error("Submission is missing its student or id, so it was not saved.");
    // A brand new submission's id is unique, so its key is its id — but a RETRY (the failure
    // banner, or the localStorage stash flushing next session) may be re-saving one that did
    // land, and under the legacy array shape that copy sits at a positional key. Resolving the
    // key means the retry updates it in place instead of adding a duplicate.
    let live = null;
    try { live = await fbGet(classPath(cid, `submissions/${sub.studentId}`)); } catch { /* fall back to the id */ }
    // Write FIRST, then adopt into local state — a failed save must not look saved. The
    // caller (quiz finish / homework finish) surfaces the throw and keeps its retry path.
    await fbSave(classPath(cid, `submissions/${sub.studentId}/${keyForSubmission(live, sub.id)}`), sub);
    const next = [...submissionsRef.current.filter(s => s.id !== sub.id), sub];
    submissionsRef.current = next;
    setSubmissions(next);
    updateClassCache(cid, 'submissions', subsByStudentMap(next));
  };

  // Delete specific submissions by id. Per-key nulls, so clearing one student's quiz can
  // never take out a submission this session hasn't heard about.
  const deleteSubmissions = async (studentId, ids) => {
    const cid = requireClass();
    // Resolve each submission's real KEY first: under the legacy array shape it is a position,
    // not the id, so deleting by id would silently miss and the record would reappear on the
    // next load. A failed read leaves `live` null and `keyForSubmission` falls back to the id.
    let live = null;
    try { live = await fbGet(classPath(cid, `submissions/${studentId}`)); } catch { /* fall back to the id */ }
    for (const id of ids) {
      const key = keyForSubmission(live, id);
      // Archive before deleting. Clearing a submission is a deliberate, password-gated act —
      // usually to let a student retake — but it is still the only copy of work they cannot
      // reproduce, and "I cleared the wrong row" has no undo otherwise. The archive is not
      // read by the app; it exists so a record can be lifted back out by hand. Best-effort:
      // a failed archive must not block the clear the instructor asked for.
      const record = live?.[key] ?? submissionsRef.current.find(s => s.studentId === studentId && s.id === id);
      if (record) {
        try { await fbSet(classPath(cid, `submissionsArchive/${studentId}/${id}`), { ...record, archivedAt: new Date().toISOString() }); }
        catch (e) { console.warn("Could not archive the submission before clearing it:", e?.message || e); }
      }
      await fbSave(classPath(cid, `submissions/${studentId}/${key}`), null);
    }
    const gone = new Set(ids);
    const next = submissionsRef.current.filter(s => !(s.studentId === studentId && gone.has(s.id)));
    submissionsRef.current = next;
    setSubmissions(next);
    updateClassCache(cid, 'submissions', subsByStudentMap(next));
  };

  // Replace the entire node. The ONLY caller is the Danger Zone's "Clear All Submissions",
  // which is password-gated and means precisely this. Never reach for it to save a submission.
  const replaceAllSubmissions = async newSubs => {
    const cid = requireClass();
    const byStudent = subsByStudentMap(newSubs);
    submissionsRef.current = newSubs;
    setSubmissions(newSubs);
    updateClassCache(cid, 'submissions', byStudent);
    await fbSave(classPath(cid, 'submissions'), Object.keys(byStudent).length ? byStudent : null);
  };

  // Merge submissions in without removing anything — used by the backup import, which
  // restores a snapshot that is by definition older than the live data. An import that
  // REPLACED the node would delete every submission made since the backup was taken, so it
  // adds and updates only. Duplicate ids resolve to the imported copy.
  const mergeSubmissions = async incoming => {
    const cid = requireClass();
    const usable = (incoming || []).filter(s => s?.studentId && s?.id);
    let live = null;
    try { live = await fbGet(classPath(cid, 'submissions')); } catch { /* fall back to ids */ }
    await fbSave(classPath(cid, 'submissions'), submissionMergePatch(usable, live), 'import submissions', { merge: true });
    const byId = new Map(submissionsRef.current.map(s => [s.id, s]));
    for (const s of usable) byId.set(s.id, s);
    const next = [...byId.values()];
    submissionsRef.current = next;
    setSubmissions(next);
    updateClassCache(cid, 'submissions', subsByStudentMap(next));
  };

  // Clear a single student's submission for one assignment (quiz or homework), gated behind
  // the password "verification of intent" modal. Deleting the record lets the student retake
  // (homework attempt counts are already cleared on submit) and removes its gradebook entry.
  const clearSubmission = (studentId, assignmentId) => {
    const removed = submissions.filter(s => s.studentId === studentId && s.quizId === assignmentId);
    if (!removed.length) return;
    const who = removed[0].studentName || studentId;
    const what = removed[0].quizTitle || assignmentId;
    confirmDanger(`clear ${who}'s submission for "${what}"`, async () => {
      const removedIds = removed.map(s => s.id);
      if (removedIds.some(id => checkedSubs[id])) {
        const nc = { ...checkedSubs };
        removedIds.forEach(id => { delete nc[id]; });
        await saveChecked(nc);
      }
      await deleteSubmissions(studentId, removedIds);
    });
  };

  // Remove a student from the roster AND delete everything attached to them FOR THIS
  // CLASS ONLY. Every per-student node lives under classes/{cid}/…/{studentId}, so scoping
  // each delete to the current class leaves the same student's data in any OTHER class they
  // are enrolled in fully intact. Covers: roster entry, password, submissions, grade
  // overrides (incl. deadline extensions & integrity reviews), homework drafts, homework
  // attempt counts, homework progress summaries, gradebook check-marks for their submissions,
  // and uploaded written work
  // in Storage. Throws on RTDB failure so the caller surfaces it; Storage cleanup is
  // best-effort (never blocks the grade-data removal).
  const removeStudentData = async studentId => {
    const cid = requireClass();
    // Local recomputation for in-memory state + class cache.
    const newRoster = roster.filter(r => r.studentId !== studentId);
    const newPws = { ...studentPws }; delete newPws[studentId];
    const newSubs = submissions.filter(s => s.studentId !== studentId);
    const removedSubIds = submissions.filter(s => s.studentId === studentId).map(s => s.id);
    const newChecked = { ...checkedSubs };
    let checkedChanged = false;
    removedSubIds.forEach(id => { if (id in newChecked) { delete newChecked[id]; checkedChanged = true; } });
    const newOverrides = { ...gradeOverrides }; delete newOverrides[studentId];
    // Attendance marks are keyed by studentId INSIDE each session, so there is no single
    // per-student node to null out — each session that mentions them is rewritten.
    const newAttendance = { ...attendance };
    const attendanceSessionIds = Object.keys(newAttendance).filter(id => newAttendance[id]?.marks?.[studentId]);
    for (const id of attendanceSessionIds) {
      const marks = { ...newAttendance[id].marks }; delete marks[studentId];
      newAttendance[id] = { ...newAttendance[id], marks };
    }
    const newSubsByStudent = subsByStudentMap(newSubs);

    // RTDB deletes — null removes the node entirely. Scoped to this class.
    await fbSave(classPath(cid, 'roster'), newRoster, 'remove student');
    await fbSave(classPath(cid, 'studentPws'), newPws);
    // Archive the whole set before it goes, for the same reason `deleteSubmissions` does.
    try {
      const live = await fbGet(classPath(cid, `submissions/${studentId}`));
      if (live) await fbSet(classPath(cid, `submissionsArchive/${studentId}`), { ...live, archivedAt: new Date().toISOString() });
    } catch (e) { console.warn("Could not archive this student's submissions before removal:", e?.message || e); }
    await fbSave(classPath(cid, `submissions/${studentId}`), null);
    await fbSave(classPath(cid, `gradeOverrides/${studentId}`), null);
    await fbSave(classPath(cid, `hwDrafts/${studentId}`), null);
    await fbSave(classPath(cid, `hwAttempts/${studentId}`), null);
    await fbSave(classPath(cid, `hwProgress/${studentId}`), null);
    await fbSave(classPath(cid, `announcementReads/${studentId}`), null);
    await fbSave(classPath(cid, `materialViews/${studentId}`), null);
    for (const id of attendanceSessionIds) await fbSave(classPath(cid, `attendance/${id}/marks/${studentId}`), null);
    if (checkedChanged) await fbSave(classPath(cid, 'checkedSubs'), newChecked);

    // In-memory state + class cache.
    setRoster(newRoster); updateClassCache(cid, 'roster', newRoster);
    setStudentPws(newPws); updateClassCache(cid, 'studentPws', newPws);
    submissionsRef.current = newSubs;
    setSubmissions(newSubs); updateClassCache(cid, 'submissions', newSubsByStudent);
    setGradeOverrides(newOverrides); updateClassCache(cid, 'gradeOverrides', newOverrides);
    if (attendanceSessionIds.length) { setAttendance(newAttendance); updateClassCache(cid, 'attendance', newAttendance); }
    if (checkedChanged) { setCheckedSubs(newChecked); updateClassCache(cid, 'checkedSubs', newChecked); }

    // Storage: delete every uploaded written-work file under this student's folder. Combine
    // a prefix-list (catches any orphaned uploads) with the storagePaths recorded on their
    // submissions (a reliable fallback if the list ever fails). Best-effort — never blocks
    // the grade-data removal above.
    try {
      const fromSubs = submissions
        .filter(s => s.studentId === studentId)
        .flatMap(s => (s.workFiles || []).map(w => w.storagePath).filter(Boolean));
      let listed = [];
      try { listed = await fbListStorage(`${classPath(cid, 'hwWork')}/${studentId}/`); }
      catch (e) { console.warn("Work-file listing failed; falling back to recorded paths:", e?.message || e); }
      const paths = [...new Set([...listed, ...fromSubs])];
      await Promise.all(paths.map(p => fbDeleteStorage(p)));
    } catch (e) { console.warn("Student work-file cleanup failed (grade data already removed):", e?.message || e); }
  };

  // ── Class management ──────────────────────────────────────────────────────
  const switchToClass = async classId => {
    if (!classId || classId === currentClassId) return;
    setCurrentClassId(classId);
    setActiveQuiz(null); setMessages([]); setQScores([]); setQIdx(0);
    setLoggedInStudent(null); setSelectedStudent(null); setNameQuery("");
    setOpenQuizzes({});
    setAnnouncements({}); setAnnReads(null);
    setCustomQuizzes({});
    setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({});
    setAttendance({});
    await loadClassData(classId);
  };
  const switchStudentClass = async (classId, student) => {
    if (!classId || classId === currentClassId) return;
    setCurrentClassId(classId);
    setActiveQuiz(null); setMessages([]); setQScores([]); setQIdx(0);
    setOpenQuizzes({});
    setAnnouncements({}); setAnnReads(null);
    setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({});
    await loadClassData(classId);
  };
  const createClass = async (name, courseType) => {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Class name is required.");
    const id = uniqueClassId(trimmed, new Set(Object.keys(classes)));
    const metadata = { name: trimmed, courseType, active: true, createdAt: new Date().toISOString() };
    await fbSave(classPath(id, 'metadata'), metadata);
    // Seed the new class's modules from the course template, assigning fresh
    // item IDs. Migration helper handles the seeding cleanly with empty config.
    const { modules: seeded } = migrateLegacyModuleConfig(defaultModulesForCourse(courseType), {});
    if (seeded.length) await fbSave(classPath(id, 'modules'), seeded);
    setClasses(prev => ({ ...prev, [id]: { metadata, roster: [], modules: seeded } }));
    return id;
  };
  const setClassActive = async (classId, active) => {
    const cur = classes[classId]?.metadata; if (!cur) return;
    const updated = { ...cur, active: !!active };
    await fbSave(classPath(classId, 'metadata'), updated);
    setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), metadata: updated } }));
  };
  const renameClass = async (classId, newName) => {
    const trimmed = (newName || "").trim();
    const cur = classes[classId]?.metadata;
    if (!cur || !trimmed || trimmed === cur.name) { setEditingClassId(null); return; }
    const updated = { ...cur, name: trimmed };
    await fbSave(classPath(classId, 'metadata'), updated);
    setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), metadata: updated } }));
    setEditingClassId(null);
  };
  const deleteClass = async classId => {
    await fbSave(`classes/${classId}`, null);
    setClasses(prev => { const n = { ...prev }; delete n[classId]; return n; });
    if (currentClassId === classId) {
      setCurrentClassId(null);
      setRoster([]); setStudentPws({}); setDueDates({}); setCheckedSubs({}); setSubmissions([]);
      setModules([]); setModuleConfig({}); setPages({}); setCustomQuizzes({}); setUploads({});
      setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({});
    }
  };

  // ── Backup export ──────────────────────────────────────────────────────────
  const exportAllData = () => {
    const snapshot = { version: 4, exportedAt: new Date().toISOString(), classId: currentClassId, classMeta, roster, studentPws, dueDates, submissions, checkedSubs, settings, modules, moduleConfig, pages, uploads };
    const json = JSON.stringify(snapshot, null, 2);
    const now = new Date(), pad = n => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const slug = classMeta?.name ? slugifyClassId(classMeta.name) : "global";
    const filename = `newton-backup-${slug}-${stamp}.json`;
    setBackupModal({ filename, json });
    try { const blob = new Blob([json], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch {}
  };

  const onBackupImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) { setBackupMsg("⚠️ Invalid backup file."); return; }
        if (!currentClassId) { setBackupMsg("⚠️ Select a class before restoring class data."); return; }
        if (data.submissions && data.checkedSubs) {
          const cids = new Set(Object.keys(data.checkedSubs));
          data.submissions = data.submissions.map(sub => cids.has(sub.id) ? { ...sub, dialogue: null } : sub);
        }
        // A restore must never overwrite the credential that is currently letting the
        // instructor in: the backup's hash, 2FA secret and trusted devices are all older than
        // the live ones, and a restore that rolls them back locks the instructor out of the
        // app with no way in from inside it. The one exception is a database with no live
        // password, where restoring the auth keys is the recovery.
        if (data.settings) {
          const restorable = settings.passwordHash
            ? Object.fromEntries(Object.entries(data.settings).filter(([k]) => !["passwordHash", "passwordSalt", "totpSecret", "trustedDevices"].includes(k)))
            : data.settings;
          if (Object.keys(restorable).length) await saveSettings(restorable);
        }
        if (data.roster) await saveRoster(data.roster);
        if (data.studentPws) await saveStudentPws(data.studentPws);
        if (data.dueDates) await saveDueDates(data.dueDates);
        if (data.checkedSubs) await saveChecked(data.checkedSubs);
        // Merge, never replace: a backup is by definition older than the live data, so
        // restoring one over the top of the node would delete every submission handed in
        // since it was taken.
        if (data.submissions) await mergeSubmissions(data.submissions);
        if (Array.isArray(data.modules)) await saveModules(data.modules);
        if (data.moduleConfig) {
          const cid = requireClass();
          setModuleConfig(data.moduleConfig);
          updateClassCache(cid, 'moduleConfig', data.moduleConfig);
          await fbSave(classPath(cid, 'moduleConfig'), Object.keys(data.moduleConfig).length ? data.moduleConfig : null);
        }
        if (data.pages) {
          const cid = requireClass();
          setPages(data.pages);
          updateClassCache(cid, 'pages', data.pages);
          await fbSave(classPath(cid, 'pages'), Object.keys(data.pages).length ? data.pages : null);
        }
        if (data.uploads) {
          const cid = requireClass();
          setUploads(data.uploads);
          updateClassCache(cid, 'uploads', data.uploads);
          await fbSave(classPath(cid, 'uploads'), Object.keys(data.uploads).length ? data.uploads : null);
        }
        setBackupMsg("✅ Restore complete!");
      } catch (err) { setBackupMsg("⚠️ Restore failed: " + (err?.message || "unknown error")); }
    };
    r.readAsText(file); e.target.value = "";
  };

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleStudentLogin = async () => {
    if (!selectedStudent) return;
    const stored = studentPws[selectedStudent.studentId]; let ok = false;
    if (!stored) { ok = pwInput === selectedStudent.studentId; if (ok) { const h = await makeHash(pwInput); await saveStudentPw(selectedStudent.studentId, h); } }
    else if (typeof stored === "string") { ok = pwInput === stored; if (ok) { const h = await makeHash(pwInput); await saveStudentPw(selectedStudent.studentId, h); } }
    else { ok = await verifyPw(pwInput, stored.hash, stored.salt); }
    if (ok) {
      const availableClasses = Object.entries(classes)
        .filter(([, c]) => c?.metadata?.active)
        .flatMap(([cid, c]) => {
          const r = Array.isArray(c.roster) ? c.roster : [];
          return r.some(row => row.studentId === selectedStudent.studentId) ? [{ classId: cid, name: c.metadata.name }] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudentAvailableClasses(availableClasses);
      setLoggedInStudent(selectedStudent); setPwInput(""); setPwError(""); setShowStudentSettings(false); setStudentSection("home");
      setScreen("student-portal");
    }
    else setPwError("Incorrect password.");
  };
  const handleChangePassword = async () => {
    setPwChangeMsg("");
    if (!newPw1.trim()) { setPwChangeMsg("Password cannot be empty."); return; }
    if (newPw1 !== newPw2) { setPwChangeMsg("Passwords do not match."); return; }
    if (newPw1.length < 4) { setPwChangeMsg("Password must be at least 4 characters."); return; }
    const h = await makeHash(newPw1); await saveStudentPw(loggedInStudent.studentId, h);
    setNewPw1(""); setNewPw2(""); setPwChangeMsg("✅ Password updated successfully!");
  };
  const handleStudentLogout = () => {
    setLoggedInStudent(null); setSelectedStudent(null); setNameQuery(""); setShowStudentSettings(false);
    setStudentAvailableClasses([]);
    setCurrentClassId(null);
    setRoster([]); setStudentPws({}); setDueDates({}); setCheckedSubs({}); setSubmissions([]);
    setModules([]); setModuleConfig({}); setPages({}); setUploads({});
    setAnnouncements({}); setAnnReads(null);
    setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({}); setCustomQuizzes({});
    setScreen("student-search");
  };
  const enterInstructor = async () => {
    const cur = currentClassId ? classes[currentClassId] : null;
    if (!cur || cur?.metadata?.active === false) {
      const firstActive = Object.entries(classes).filter(([, c]) => c?.metadata?.active !== false).sort((a, b) => (a[1]?.metadata?.name || "").localeCompare(b[1]?.metadata?.name || ""))[0];
      if (firstActive) await switchToClass(firstActive[0]);
    }
    setInstructorSection("modules");
    setScreen("instructor");
  };
  // Every route into the portal funnels through here, so a password that must be replaced
  // cannot be walked past: the claim form stands between the last gate and the portal.
  // `mustReplace` is passed rather than read off state at the two call sites inside the same
  // click as `setMustReplacePw` — that state has not re-rendered yet, so the flag would read
  // false and the claim form would be skipped.
  const finishLogin = async (mustReplace = mustReplacePw) => {
    setInstErr(""); setEditPw("");
    if (mustReplace || settingsUnseeded) { setClaimPw(""); setClaimPw2(""); setClaimErr(""); setInstLoginStep("claim"); return; }
    await enterInstructor();
  };
  const doLogin = async () => {
    if (settingsUnreadable) { setInstErr("Could not load the instructor settings on this device. Check the connection and refresh the page."); return; }
    if (!settings.passwordHash) { setInstErr("Settings still loading."); return; }
    // `.trim()` mirrors the setter (Change Instructor Password trims before hashing).
    // Without it a password saved with a stray space, or refilled with one by a
    // browser password manager, hashes to something the stored hash can never match.
    let ok;
    try { ok = await verifyPw(instPw.trim(), settings.passwordHash, settings.passwordSalt); }
    catch (e) { setInstErr(`Could not check the password on this browser: ${e.message}`); return; }
    if (!ok) { setInstErr("Incorrect password."); return; }
    // A password that is published in this repo is not a password. If the stored hash still
    // answers to the old seeded default, the login is honoured and then spends itself on
    // setting a real one — 2FA first, if it is configured, since that gate still applies.
    let legacy = false;
    try { legacy = await verifyPw(LEGACY_SEEDED_PW, settings.passwordHash, settings.passwordSalt); }
    catch { /* the check above already proved crypto.subtle works; nothing to recover from */ }
    if (legacy) setMustReplacePw(true);
    if (!settings.totpSecret) { await finishLogin(legacy); return; }
    const deviceToken = localStorage.getItem('newton_device_token');
    if (deviceToken) { const tokenHash = await hashToken(deviceToken); if (settings.trustedDevices?.[tokenHash]) { await finishLogin(legacy); return; } }
    setInstErr(""); setTotpInput(""); setTotpErr(""); setInstLoginStep("totp");
  };
  // One rule for the new password, wherever it is being set (first run, replacing the old
  // seeded default, or an emailed reset). Returns the sentence to show, or null.
  const newPwProblem = () => {
    const pw = claimPw.trim();
    if (!pw) return "Enter a password.";
    if (pw.length < MIN_INSTRUCTOR_PW) return `Use at least ${MIN_INSTRUCTOR_PW} characters.`;
    if (pw !== claimPw2.trim()) return "The two passwords do not match.";
    if (pw === LEGACY_SEEDED_PW) return "That is the setup password this replaces. Choose a different one.";
    return null;
  };
  const doClaim = async () => {
    const problem = newPwProblem();
    if (problem) { setClaimErr(problem); return; }
    setClaimBusy(true);
    try { await claimInstructorPw(claimPw); }
    catch (e) { setClaimErr(`Could not save the password: ${e.message}. Nothing was changed.`); setClaimBusy(false); return; }
    setClaimBusy(false); setClaimPw(""); setClaimPw2(""); setClaimErr("");
    setInstLoginStep("password");
    // The two claim routes are already through the gates: a first-run database has none, and
    // replacing the legacy default happens after the password and 2FA both passed.
    await enterInstructor();
  };
  const requestResetCode = async () => {
    setClaimBusy(true); setClaimErr("");
    let data;
    try {
      const res = await fetch("/.netlify/functions/instructor-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", secret: import.meta.env.VITE_EMAIL_SEND_SECRET }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e) { setClaimErr(e.message); setClaimBusy(false); return; }
    setResetChallenge(data.challenge); setResetSentTo(data.sentTo || "the instructor email");
    setResetMinutes(data.minutes || 15);
    // Only the code is cleared: "Email another code" must not throw away a new password the
    // instructor has already typed beside it.
    setResetCode(""); setClaimBusy(false); setInstLoginStep("reset-verify");
  };
  const doReset = async () => {
    const problem = newPwProblem();
    if (problem) { setClaimErr(problem); return; }
    if (!resetCode.trim()) { setClaimErr("Enter the code from the email."); return; }
    setClaimBusy(true); setClaimErr("");
    // The code is checked SERVER-side (the signing secret never reaches the browser), and only
    // then does the password get written.
    try {
      const res = await fetch("/.netlify/functions/instructor-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", secret: import.meta.env.VITE_EMAIL_SEND_SECRET, code: resetCode, challenge: resetChallenge }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e) { setClaimErr(e.message); setClaimBusy(false); return; }
    try { await claimInstructorPw(claimPw); }
    catch (e) { setClaimErr(`The code was accepted but the password could not be saved: ${e.message}. Nothing was changed.`); setClaimBusy(false); return; }
    setClaimBusy(false); setClaimPw(""); setClaimPw2(""); setClaimErr(""); setResetCode(""); setResetChallenge(null);
    // Back to the login, NOT into the portal: an emailed code has passed neither the password
    // gate nor 2FA, and logging in normally is what makes the authenticator still count.
    setInstPw(""); setInstMsg("Password updated. Log in with it now."); setInstLoginStep("password");
  };
  const doTotpVerify = async () => {
    const code = totpInput.trim();
    if (!/^\d{6}$/.test(code)) { setTotpErr("Enter the 6-digit code."); return; }
    const valid = await verifyTotp(settings.totpSecret, code);
    if (!valid) { setTotpErr("Incorrect code. Try again."); setTotpInput(""); return; }
    if (rememberDevice) {
      const token = genDeviceToken(); const tokenHash = await hashToken(token);
      localStorage.setItem('newton_device_token', token);
      // A deep-path key, so this adds ONE device without rewriting the map: two browsers
      // remembered in the same window used to leave whichever wrote first untrusted.
      // Best-effort: the code was correct, so a failed convenience write must not become a
      // failed login. The device simply is not remembered and the next login asks again.
      try { await saveSettings({ [`trustedDevices/${tokenHash}`]: { created: new Date().toISOString() } }); }
      catch { localStorage.removeItem('newton_device_token'); }
    }
    setTotpErr(""); setTotpInput(""); setInstLoginStep("password"); setRememberDevice(false); await finishLogin();
  };
  const startTotpSetup = async () => {
    const secret = genTotpSecret();
    const otpauthUrl = `otpauth://totp/Newton?secret=${secret}&issuer=Newton&digits=6&period=30`;
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 176, margin: 1, color: { dark: '#000', light: '#fff' } }); } catch (e) { console.error(e); }
    setTotpSetupState({ secret, qrDataUrl }); setTotpSetupCode(""); setTotpSetupErr("");
  };
  const confirmTotpSetup = async () => {
    if (!/^\d{6}$/.test(totpSetupCode.trim())) { setTotpSetupErr("Enter the 6-digit code."); return; }
    const valid = await verifyTotp(totpSetupState.secret, totpSetupCode);
    if (!valid) { setTotpSetupErr("Code didn't match. Check you scanned the right QR code and try again."); return; }
    // Reported, not assumed: the secret is only in this browser until the write lands, so a
    // silent failure here would leave an authenticator app holding a code nothing checks.
    try { await saveSettings({ totpSecret: totpSetupState.secret }); }
    catch (e) { setTotpSetupErr(`Could not save the secret: ${e.message}. 2FA is not enabled.`); return; }
    setTotpSetupState(null); setTotpSetupCode(""); setTotpSetupErr("");
  };
  const disableTotp = () => {
    confirmDanger("disable two-factor authentication", async () => {
      // Deliberate removal, which is what a `null` in a PATCH is for.
      await saveSettings({ totpSecret: null, trustedDevices: null });
      localStorage.removeItem('newton_device_token');
    });
  };
  const clearTrustedDevices = async () => {
    await saveSettings({ trustedDevices: null });
    localStorage.removeItem('newton_device_token');
    setClearDevicesMsg("✅ All trusted devices cleared."); setTimeout(() => setClearDevicesMsg(""), 3000);
  };
  const markBugRead = async id => {
    const updated = { ...bugReports, [id]: { ...bugReports[id], read: true } };
    setBugReports(updated);
    await fbSet('bugReports', updated);
  };
  const markEvalRead = async id => {
    const updated = { ...courseEvals, [id]: { ...courseEvals[id], read: true } };
    setCourseEvals(updated);
    await fbSet('courseEvals', updated);
  };
  const confirmDanger = (label, onConfirm) => { setDangerAction({ label, onConfirm }); setDangerPw(""); setDangerErr(""); };
  const executeDanger = async () => {
    if (settingsUnreadable) { setDangerErr("Could not load the instructor settings on this device. Refresh and try again."); return; }
    if (!settings.passwordHash) { setDangerErr("Settings not loaded."); return; }
    const ok = await verifyPw(dangerPw.trim(), settings.passwordHash, settings.passwordSalt);
    if (!ok) { setDangerErr("Incorrect password."); return; }
    dangerAction.onConfirm(); setDangerAction(null); setDangerPw(""); setDangerErr("");
  };

  // ── Quiz flow ──────────────────────────────────────────────────────────────
  const advanceOrFinish = async (quiz, nScores, afterMsgs, nextIdx) => {
    if (nextIdx >= quiz.questions.length) { await finishQuiz(quiz, nScores, afterMsgs); }
    else {
      const nPts = ptsPer(quiz.questions.length);
      setMessages([...afterMsgs, { id: Date.now() + 2, type: "question", q: quiz.questions[nextIdx], num: nextIdx + 1, total: quiz.questions.length, pts: nPts[nextIdx] }]);
      setQIdx(nextIdx); setApiHist([]); setAttemptCount(0); setCompletedParts([]);
    }
  };
  // `from` is "student" or "instructor" (a Modules-editor preview). An instructor preview is
  // FORCED to practice regardless of the caller, since there is no student to save a run for —
  // finishQuiz's submission path reads loggedInStudent, which is null on the instructor side.
  const startQuiz = (quiz, isPractice = false, from = "student") => {
    const preview = from === "instructor";
    setRunnerFrom(from);
    setPracticeMode(isPractice || preview); setActiveQuiz(quiz); setQIdx(0); setApiHist([]); setAttemptCount(0); setCompletedParts([]);
    setQScores(new Array(quiz.questions.length).fill(null));
    setQuizDone(false); setInput(""); setPendingFile(null); setBusy(false); setShowLeaveConfirm(false); setSubSaveError(false); setPendingSub(null);
    // The chat opens straight on question 1. There used to be a leading `system` message repeating
    // the quiz title, the taker's name, and the practice/preview banner — all of which the top bar
    // already shows, so it was a box of duplicated text between the student and the first question.
    // Its one piece of unique information, the past-due warning, moved to the top bar's subtitle
    // (mirroring HomeworkRunner, which already reported "past due" there rather than in the body).
    // ChatMessages KEEPS its `system` branch: submissions saved before this change still carry one
    // in their stored dialogue, and the gradebook re-renders those.
    setMessages([
      { id: 1, type: "question", q: quiz.questions[0], num: 1, total: quiz.questions.length, pts: ptsPer(quiz.questions.length)[0] },
    ]);
    setScreen("quiz");
    history.pushState({ newton: "quiz" }, "", "");
  };
  // Same contract as startQuiz: an instructor preview is FORCED to practice, which is what keeps
  // HomeworkRunner off every per-student path (drafts, attempt counts, work uploads, the
  // submission itself all read loggedInStudent, which is null on the instructor side).
  const startHomework = (hw, isPractice = false, from = "student") => {
    const preview = from === "instructor";
    setRunnerFrom(from);
    setPracticeMode(isPractice || preview);
    setActiveHomework(hw);
    setScreen("homework");
    history.pushState({ newton: "homework" }, "", "");
  };
  // Calendar → assignment, mirroring what clicking the module item does. Only
  // called for events the calendar left clickable (not completed, not locked).
  // `from` picks the launch context: "student" runs it for real, "instructor" runs the
  // same screens as a preview (forced practice — see startQuiz/startHomework).
  const openAssignment = (id, kind, from = "student") => {
    if (kind === "homework") {
      const hw = homeworks.find(h => h.id === id);
      if (hw) startHomework(hw, false, from);
      return;
    }
    const quiz = quizzes.find(q => q.id === id);
    if (quiz) startQuiz(quiz, false, from);
  };
  // The instructor calendar's click handler — the same preview the Modules editor's
  // title click opens, so a quiz/homework can be checked from whichever screen the
  // instructor happens to be on.
  const previewAssignment = (id, kind) => openAssignment(id, kind, "instructor");
  // Persist a completed-homework submission (reuses the quiz submissions array/paths).
  // Throws on failure so HomeworkRunner can show a retry affordance.
  //
  // A real submission REPLACES the deadline record for the same assignment rather than sitting
  // beside it: every consumer resolves ONE submission per (student, assignment) — a `.find` in
  // the gradebook and the grades list, last-wins in `buildScoreMatrix` — so two records for one
  // homework would show different scores on different screens. Reusing the record's id lands the
  // write on the same key, and the real submission's uploaded work is what clears `workPending`
  // and makes the assignment count at all.
  //
  // `markOnTimeParts` is what the deadline record was written FOR: it carries the `onTime` stamp
  // onto every part that was already finished at the deadline, so the late penalty spares those
  // parts from the late penalty and the student is not halved on work they did on time. The
  // score is then recomputed through `scoreFromPartOverrides` (via `rescoreSubmission`) so the
  // recorded score and any later per-part regrade come out of one function.
  //
  // The node is re-read here rather than trusted from state: this tab may have been open since
  // before the deadline the sweep acted on.
  const saveHomeworkSub = async sub => {
    const cid = requireClass();
    let prior = null;
    try {
      const live = await fbGet(classPath(cid, `submissions/${sub.studentId}`));
      prior = Object.values(live || {}).find(s => s && s.quizId === sub.quizId && isAutoSubmission(s)) || null;
    } catch { /* fall back to saving it as a new record */ }
    if (!prior) { await addSubmission(sub); return; }
    const marked = markOnTimeParts(sub, prior);
    await addSubmission({ ...marked, id: prior.id, score: rescoreSubmission(marked) });
  };
  // Leaving the quiz lands back where it was launched from, not unconditionally on the student
  // portal (an instructor previewing from Modules has no business being dropped there).
  const runnerReturnScreen = runnerFrom === "instructor" ? "instructor" : "student-portal";
  // …and the button says where that is. A preview can be launched from Modules (an item title)
  // or from the Calendar (an event), and returning restores whichever instructor section was
  // active, so the label reads off `instructorSection` rather than assuming Modules.
  const runnerBackLabel = runnerFrom !== "instructor"
    ? "Back to Course"
    : instructorSection === "calendar" ? "Back to Calendar" : "Back to Modules";
  // An instructor preview has nothing to lose by leaving: it is forced to practice, so no
  // submission, score or attempt is recorded either way. The confirmation had nothing to warn
  // about and sat between checking a question and getting back to the editor.
  const handleLeaveQuiz = () => {
    if ((quizDone && !subSaveError) || runnerFrom === "instructor") { setScreen(runnerReturnScreen); return; }
    if (!quizDone) setShowLeaveConfirm(true);
  };
  const confirmLeave = () => { setShowLeaveConfirm(false); setScreen(runnerReturnScreen); };
  const onFileSelect = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!ACCEPTED_IMG.includes(file.type)) { alert("Please upload PNG, JPG, WEBP, or GIF."); e.target.value = ""; return; }
    const b64 = await compressImage(file); const previewUrl = `data:${b64.type};base64,${b64.data}`;
    setPendingFile({ file, previewUrl, base64: b64, readability: "checking" }); e.target.value = "";
    try { const result = await checkImageReadability(b64); setPendingFile(prev => prev ? { ...prev, readability: result.readable ? "ok" : { status: "fail", reason: result.reason || "Image is not legible enough." } } : null); }
    catch { setPendingFile(prev => prev ? { ...prev, readability: "ok" } : null); }
  };
  const clearFile = () => { setPendingFile(null); };
  const submitYesNo = async answer => {
    if (busy) return; setBusy(true);
    const q = activeQuiz.questions[qIdx], pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    // Per-question replies (`yesReply`/`noReply`); the fallbacks are the original textbook-access
    // wording, so Physics 1's q1 reads exactly as before.
    const reply = answer
      ? (q.yesReply || "Great, glad you're all set! Make sure to keep it handy throughout the semester.")
      : (q.noReply || "No worries. Please contact your instructor as soon as possible to get access sorted out.");
    const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
    const newMsgs = [...messages, { id: Date.now(), type: "student", text: answer ? "Yes" : "No" }, { id: Date.now() + 1, type: "tutor", text: "✅ " + reply, correct: true }];
    await advanceOrFinish(activeQuiz, nScores, newMsgs, qIdx + 1); setBusy(false);
  };
  // Survey question — no right answer. Any substantive response earns full credit immediately:
  // no Claude call, no attempt counter, no Socratic follow-up. The answer still rides on the
  // submission so the instructor can read it in the gradebook.
  const submitSurvey = async () => {
    if (busy) return;
    const ans = input.trim();
    if (!ans) return;
    setInput(""); setBusy(true);
    const q = activeQuiz.questions[qIdx], pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
    const newMsgs = [
      ...messages,
      { id: Date.now(), type: "student", text: ans },
      { id: Date.now() + 1, type: "tutor", text: "✅ " + (q.reply || "Thanks for sharing, noted!"), correct: true },
    ];
    await advanceOrFinish(activeQuiz, nScores, newMsgs, qIdx + 1); setBusy(false);
  };
  // Multiple choice — graded deterministically here (no Claude), so a wrong pick gets that
  // option's authored misconception nudge and a retry. Same 5-attempt / half-credit rule the
  // free-response path uses.
  const submitChoice = async pick => {
    if (busy) return; setBusy(true);
    const q = activeQuiz.questions[qIdx], pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    const chosen = (q.options || []).find(o => o.key === pick);
    const currentAttempt = attemptCount + 1;
    setAttemptCount(currentAttempt);
    const newMsgs = [...messages, { id: Date.now(), type: "student", text: pick + (chosen ? ". " + chosen.label : "") }];
    if (pick === q.correct) {
      const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
      await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: "✅ " + (q.correctReply || "Exactly right."), correct: true }], qIdx + 1);
    } else if (currentAttempt >= 5) {
      const right = (q.options || []).find(o => o.key === q.correct);
      const nScores = [...qScores]; nScores[qIdx] = qPts / 2; setQScores(nScores);
      const tell = `The correct answer is ${q.correct}${right ? ": " + right.label : ""}. ${q.correctReply || ""}`.trim();
      await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: tell }], qIdx + 1);
    } else {
      setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: q.feedback?.[pick] || "Not quite. Think it through once more and try again." }]);
    }
    setBusy(false);
  };
  // The textarea path serves free-response, image, and survey questions; only the survey is
  // ungraded, so it routes to submitSurvey instead of the Claude-backed submitAnswer.
  const sendAnswer = () => (isSurveyQ ? submitSurvey() : submitAnswer());
  const submitDragDrop = async blanks => {
    if (busy) return; setBusy(true);
    const q = activeQuiz.questions[qIdx], pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    const correct = blanks[0] === q.correctBlanks[0] && blanks[1] === q.correctBlanks[1];
    const nScores = [...qScores];
    const newMsgs = [...messages, { id: Date.now(), type: "student", text: "Dot product → " + blanks[0] + ", Cross product → " + blanks[1] }];
    if (correct) {
      nScores[qIdx] = qPts; setQScores(nScores);
      await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: "✅ Exactly right! The dot product yields a scalar, while the cross product yields a vector.", correct: true }], qIdx + 1);
    } else {
      setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: blanks[0] === "vector" && blanks[1] === "scalar" ? "Those are swapped. Think about which operation gives a single number (like work = F·d) and which gives a new vector (like torque = r×F)." : "Not quite. Consider: work is calculated using a dot product and gives a single number. What does that tell you about the type of quantity it produces?" }]);
    }
    setBusy(false);
  };
  const submitAnswer = async () => {
    if (busy) return;
    if (isImageQ && !pendingFile && !input.trim()) return;
    if (!isImageQ && !input.trim()) return;
    const ans = input.trim(), imgData = pendingFile?.base64 || null, previewUrl = pendingFile?.previewUrl || null;
    setInput(""); clearFile(); setBusy(true);
    const q = activeQuiz.questions[qIdx], pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    const parts = currentParts;
    const currentAttempt = attemptCount + 1;
    setAttemptCount(currentAttempt);
    const newMsgs = [...messages, { id: Date.now(), type: "student", text: ans || null, imageUrl: previewUrl }];
    setMessages(newMsgs);
    try {
      const result = await evaluateAnswer(q.text, ans, apiHist, imgData, currentAttempt, parts, completedParts, classMeta?.courseType || "physics1");
      const histUser = imgData ? "Physics Question: " + q.text + "\n\n[Student submitted a drawing" + (ans ? ". Note: " + ans : "") + "]" : "Physics Question: " + q.text + "\n\nStudent Answer: " + ans;
      setApiHist([...apiHist, { role: "user", content: histUser }, { role: "assistant", content: JSON.stringify(result) }]);
      if (parts) {
        const newlyCompleted = Array.isArray(result.newlyCompleted) ? result.newlyCompleted.filter(p => parts.includes(p) && !completedParts.includes(p)) : [];
        const updatedCompleted = [...completedParts, ...newlyCompleted];
        const perPart = qPts / parts.length;
        const priorScore = qScores[qIdx] || 0;
        if (updatedCompleted.length >= parts.length) {
          const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
          await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: "✅ " + result.message, correct: true }], qIdx + 1);
        } else if (newlyCompleted.length > 0) {
          const earned = parseFloat((priorScore + newlyCompleted.length * perPart).toFixed(2));
          const nScores = [...qScores]; nScores[qIdx] = earned; setQScores(nScores);
          setCompletedParts(updatedCompleted);
          setAttemptCount(0);
          setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: "✅ " + result.message, correct: true }]);
        } else if (currentAttempt >= 5) {
          const remaining = parts.length - completedParts.length;
          const earned = parseFloat((priorScore + remaining * perPart / 2).toFixed(2));
          const nScores = [...qScores]; nScores[qIdx] = earned; setQScores(nScores);
          await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: result.message }], qIdx + 1);
        } else { setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: result.message }]); }
      } else if (result.status === "correct") {
        const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
        await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: "✅ " + result.message, correct: true }], qIdx + 1);
      } else if (currentAttempt >= 5) {
        const nScores = [...qScores]; nScores[qIdx] = qPts / 2; setQScores(nScores);
        await advanceOrFinish(activeQuiz, nScores, [...newMsgs, { id: Date.now() + 1, type: "tutor", text: result.message }], qIdx + 1);
      } else { setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: result.message }]); }
    } catch (err) {
      // Grader unreachable/errored — surface the reason and roll back the attempt so it isn't wasted.
      setAttemptCount(attemptCount);
      setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: "⚠️ " + (err?.message || "Error evaluating your answer.") + " Your attempt was not counted, so please try again." }]);
    }
    setBusy(false);
  };
  const finishQuiz = async (quiz, scores, curMsgs) => {
    const raw = scores.reduce((a, b) => a + (b || 0), 0), late = isLate(quiz.dueDate);
    const final = late ? parseFloat((raw * 0.5).toFixed(1)) : raw;
    const resultMsg = { id: Date.now() + 10, type: "result", raw, final, late, scores, questions: quiz.questions, pts: ptsPer(quiz.questions.length), practiceMode, preview: runnerFrom === "instructor" };
    setQuizDone(true); setMessages([...curMsgs, resultMsg]);
    if (!practiceMode) {
      const sub = { id: "sub_" + Date.now(), studentName: loggedInStudent.fullName, studentId: loggedInStudent.studentId, quizId: quiz.id, quizTitle: quiz.title, rawScore: raw, score: final, late, timestamp: new Date().toISOString(), dialogue: [...curMsgs, resultMsg].map(({ imageUrl, ...m }) => m) };
      // Stash to localStorage BEFORE the network call. A quiz has no draft node — the whole
      // sitting exists only in this component's state — so if the save fails and the student
      // closes the tab, the on-screen retry button dies with it and the work is gone. The
      // stash is picked up and flushed on the next load (see the recovery effect).
      stashPendingSub(currentClassId, sub);
      setPendingSub({ sub });
      try { await addSubmission(sub); setSubSaveError(false); setPendingSub(null); clearStashedSub(); }
      catch { setSubSaveError(true); }
    }
  };

  const retrySaveSub = async () => {
    if (!pendingSub) return;
    try { await addSubmission(pendingSub.sub); setSubSaveError(false); setPendingSub(null); clearStashedSub(); }
    catch { setSubSaveError(true); }
  };

  // Recover a quiz submission whose save failed in an earlier session (network dropped, tab
  // closed on the failure screen). Runs once per session, as soon as the class it belongs to
  // is loaded. If the submission turns out to be there after all — the save landed but the
  // response never came back — the stash is simply dropped.
  const stashFlushedRef = useRef(false);
  useEffect(() => {
    if (!dataReady || !currentClassId || stashFlushedRef.current) return;
    const stashed = readStashedSub();
    if (!stashed?.sub?.id) { stashFlushedRef.current = true; return; }
    if (stashed.classId !== currentClassId) return;   // wait for that class to be selected
    stashFlushedRef.current = true;
    if (submissions.some(s => s.id === stashed.sub.id)) { clearStashedSub(); return; }
    addSubmission(stashed.sub)
      .then(() => clearStashedSub())
      .catch(e => console.warn("Deferred submission save failed; the stash is kept for the next load:", e?.message || e));
  }, [dataReady, currentClassId, submissions]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChecked = async subId => {
    const nc = { ...checkedSubs };
    if (nc[subId]) { delete nc[subId]; } else { nc[subId] = true; }
    await saveChecked(nc);
  };
  const toggleQuizOpen = qid => setOpenQuizzes(o => ({ ...o, [qid]: !o[qid] }));
  const onRosterUpload = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = async ev => { const parsed = parseRoster(ev.target.result); const uniqueIds = new Set(parsed.map(s => s.studentId)); const dups = parsed.length - uniqueIds.size; await saveRoster(parsed); setRosterMsg("✅ " + uniqueIds.size + " students loaded." + (dups ? ` (${dups} duplicate ID${dups > 1 ? "s" : ""} skipped)` : "")); }; r.readAsText(file); e.target.value = ""; };

  const handleSelectStudent = async st => {
    setSelectedStudent(st); setPwInput(""); setPwError(""); setNameQuery("");
    if (st.classId && st.classId !== currentClassId) {
      setCurrentClassId(st.classId);
      await loadClassData(st.classId);
    }
    setScreen("student-pw"); history.pushState({ newton: "student-pw" }, "", "");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (fbConnStatus === 'error') return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, width: "100%", ...s.card, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ color: "#f87171", fontWeight: 700, fontSize: 20, margin: 0 }}>⚠️ Cannot Reach Database</h2>
        <p style={{ ...s.muted, margin: 0, lineHeight: 1.6 }}>The app could not connect to Firebase. This is usually caused by a network issue, a firewall, or a temporary Firebase outage. Check your internet connection and try refreshing.</p>
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#fca5a5", wordBreak: "break-all" }}>{fbConnError}</div>
      </div>
    </div>
  );

  if (backupModal) return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 640, width: "100%", ...s.card, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div><h2 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>Backup Ready</h2><p style={{ ...s.muted, margin: 0, fontSize: 12, fontFamily: "monospace" }}>{backupModal.filename}</p></div>
          <button onClick={() => setBackupModal(null)} style={{ background: "none", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ background: "rgba(0,130,140,0.08)", border: `1px solid ${TEAL}33`, borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          If a download didn't start automatically, use <strong style={{ color: "#fff" }}>Copy JSON</strong> below and save as <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>{backupModal.filename}</code>.
        </div>
        <textarea readOnly value={backupModal.json} style={{ ...s.input, fontFamily: "monospace", fontSize: 11, height: 220, resize: "vertical", lineHeight: 1.4, color: MUTED }} onClick={e => e.target.select()} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { const el = document.querySelector("textarea[readonly]"); if (!el) return; el.select(); el.setSelectionRange(0, 99999); document.execCommand("copy"); }} style={{ ...s.btnPri, flex: 1 }}>Copy JSON to Clipboard</button>
          <button onClick={() => setBackupModal(null)} style={{ ...s.btnGhost, flex: "0 0 auto" }}>Close</button>
        </div>
      </div>
    </div>
  );

  const bugModalJsx = bugReportOpen && <BugReportModal bugReports={bugReports} setBugReports={setBugReports} onClose={() => setBugReportOpen(false)} />;

  // ── Student Search screen ─────────────────────────────────────────────────
  if (screen === "student-search") {
    // eslint-disable-next-line no-shadow
    const s = appTh.s; const MUTED = appTh.muted; const BORDER = appTh.border; const text = appTh.text; const bg = appTh.bg;
    const recaptchaColor = appTh.isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)";
    return (
    <ThemeContext.Provider value={appTh}>
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {bugModalJsx}
      <button onClick={() => { setScreen("inst-login"); history.pushState({ newton: "inst-login" }, "", ""); }} style={{ position: "fixed", top: 16, right: 16, background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>Instructor</button>
      <Footer onBugClick={() => setBugReportOpen(true)} />
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Wordmark size={72} />
        </div>
        {showNoClasses && allActiveStudents.length === 0 && <div style={{ background: "rgba(202,138,4,0.1)", border: "1px solid rgba(202,138,4,0.3)", borderRadius: 8, padding: "10px 14px", color: "#fde047", fontSize: 13, marginBottom: 16 }}>No classes are currently available. Please contact your instructor.</div>}
        <div style={{ position: "relative" }}>
          <input
            style={s.input}
            placeholder="Begin typing your name…"
            value={nameQuery}
            onChange={e => { setNameQuery(e.target.value); setHighlightIdx(-1); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filteredRoster.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); const st = highlightIdx >= 0 ? filteredRoster[highlightIdx] : filteredRoster.length === 1 ? filteredRoster[0] : null; if (st) handleSelectStudent(st); }
            }}
            autoFocus
          />
          {filteredRoster.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: bg, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", zIndex: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
              {filteredRoster.map((st, i) => (
                <button key={st.studentId} onClick={() => handleSelectStudent(st)} style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: highlightIdx === i ? TEAL_DIM : "transparent", border: "none", borderBottom: `1px solid ${BORDER}`, color: highlightIdx === i ? TEAL : text, fontSize: 14, cursor: "pointer", fontWeight: highlightIdx === i ? 600 : 400 }} onMouseEnter={() => setHighlightIdx(i)}>
                  {st.altName || st.fullName}
                </button>
              ))}
            </div>
          )}
          {nameQuery.trim().length > 0 && filteredRoster.length === 0 && allActiveStudents.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: bg, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", color: MUTED, fontSize: 13, zIndex: 10 }}>No matches found. Check your spelling.</div>
          )}
        </div>
      </div>
      {!import.meta.env.DEV && <p style={{ position: "fixed", bottom: 8, right: 12, fontSize: 11, color: recaptchaColor, margin: 0, textAlign: "right" }}>Protected by reCAPTCHA · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: recaptchaColor }}>Privacy</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={{ color: recaptchaColor }}>Terms</a></p>}
    </div>
    </ThemeContext.Provider>
    );
  }

  // ── Student Password ──────────────────────────────────────────────────────
  if (screen === "student-pw" && selectedStudent) {
    // eslint-disable-next-line no-shadow
    const s = appTh.s; const MUTED = appTh.muted; const text = appTh.text;
    return (
    <ThemeContext.Provider value={appTh}>
    <div style={{ ...s.page, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {bugModalJsx}
      <Footer onBugClick={() => setBugReportOpen(true)} />
      <div style={{ padding: "12px 20px" }}>
        <Wordmark onClick={() => { setSelectedStudent(null); setScreen("student-search"); }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <p style={{ fontSize: 30, fontWeight: 700, color: text, margin: "0 0 28px", textAlign: "center" }}>{selectedStudent.altName || selectedStudent.fullName}</p>
          <input type="password" style={{ ...s.input, marginBottom: 10 }} placeholder="Password…" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleStudentLogin()} autoFocus />
          {pwError && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{pwError}</p>}
          <button onClick={handleStudentLogin} style={s.btnPri}>Login</button>
          {!studentPws[selectedStudent.studentId] && (
            <div style={{ marginTop: 16, background: "rgba(202,138,4,0.08)", border: "1px solid rgba(202,138,4,0.25)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "#fbbf24", fontSize: 18, flexShrink: 0 }}>💡</span>
              <div>
                <p style={{ color: "#fbbf24", fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>First time logging in?</p>
                <p style={{ color: "rgba(251,191,36,0.7)", fontSize: 13, margin: 0 }}>Your initial password is your <strong>Student ID number</strong>.</p>
              </div>
            </div>
          )}
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <button onClick={() => { setSelectedStudent(null); setScreen("student-search"); }} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>← Not me</button>
          </div>
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
    );
  }

  // ── Student Portal (LMS-style) ────────────────────────────────────────────
  if (screen === "student-portal" && loggedInStudent) {
    const th = buildTheme(lightMode);


    const STUB_COPY = {
      syllabus: "A clean visual rendering of the course syllabus plus a PDF download.",
    };
    const SECTION_TITLE = {
      syllabus: "Syllabus",
    };

    // Settings is a page in the same Shell, not a sidebar section, so picking any nav item
    // has to leave it - otherwise the sidebar highlights a section the student can't see.
    const closeStudentSettings = () => {
      setShowStudentSettings(false);
      setNewPw1(""); setNewPw2(""); setPwChangeMsg("");
      setStuEmailDraft(""); setStuEmailMsg("");
      setStuNickDraft(""); setStuNickMsg("");
    };

    const handleStudentSectionSelect = id => {
      if (showStudentSettings) closeStudentSettings();
      setStudentSection(id);
    };

    const evalNudge = (() => {
      try {
        if (localStorage.getItem(`newton_eval_survey_${currentClassId}`)) return false;
        const withDates = mergedModules.filter(m => m.releaseDate);
        if (withDates.length === 0) return true;
        const last = withDates.reduce((a, b) =>
          (dueToDate(a.releaseDate) || 0) > (dueToDate(b.releaseDate) || 0) ? a : b
        );
        return new Date() >= (dueToDate(last.releaseDate) || 0);
      } catch { return false; }
    })();
    // Course Guide and Resources are dropped from the nav until there is something behind them.
    // A class where the instructor has not written a guide or posted a shelf would otherwise carry
    // two entries whose only content is "nothing has been posted yet", which is worse than the
    // student never seeing the entry at all. Every other section always has something to show.
    const hasShelves = visibleShelves(resourceShelves).length > 0;
    const studentSidebarItems = STUDENT_SECTIONS
      .filter(item => (item.id === "guide" ? guideHasContent(courseGuide) : item.id === "resources" ? hasShelves : true))
      .map(item => (item.id === "evals" ? { ...item, badge: evalNudge ? 1 : 0 } : item));

    const header = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Wordmark onClick={() => handleStudentSectionSelect("home")} />
          {studentAvailableClasses.length > 1 ? (
            <CustomSelect
              value={currentClassId || ""}
              onChange={v => { if (v) switchStudentClass(v); }}
              options={studentAvailableClasses.map(({ classId, name }) => ({ value: classId, label: name }))}
              style={{ marginTop: 4 }}
            />
          ) : (
            classMeta && <span style={{ color: th.text, fontSize: 15, fontWeight: 600, marginTop: 4, display: "inline-block" }}>{classMeta.name}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setLightMode(!lightMode)}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", color: th.muted, fontSize: 16 }}
          >{lightMode ? "☀" : "☽"}</button>
          <button onClick={() => { setShowStudentSettings(true); setStuEmailDraft(loggedInStudent?.email || ""); setStuEmailMsg(""); setStuNickDraft(nicknameFromAltName(loggedInStudent)); setStuNickMsg(""); history.pushState({ newton: "settings" }, "", ""); }} style={{ ...th.s.btnGhost, width: "auto", padding: "6px 14px", fontSize: 13 }}>Settings</button>
        </div>
      </>
    );

    let mainContent;
    if (showStudentSettings) {
      mainContent = (
        <StudentSettings
          loggedInStudent={loggedInStudent}
          onBack={closeStudentSettings}
          nickDraft={stuNickDraft} setNickDraft={setStuNickDraft} nickMsg={stuNickMsg} nickBusy={stuNickBusy} onSaveNickname={saveStudentNickname}
          emailDraft={stuEmailDraft} setEmailDraft={setStuEmailDraft} emailMsg={stuEmailMsg} onSaveEmail={saveStudentEmail}
          newPw1={newPw1} setNewPw1={setNewPw1} newPw2={newPw2} setNewPw2={setNewPw2} pwChangeMsg={pwChangeMsg} onChangePassword={handleChangePassword}
          onLogout={handleStudentLogout}
        />
      );
    } else if (studentSection === "home") {
      mainContent = <Home loggedInStudent={loggedInStudent} modules={courseModules} quizzes={quizzes} homeworks={homeworks} submissions={submissions} onStartQuiz={q => startQuiz(q, completedQuizIds.has(q.id))} onStartHomework={startHomework} onOpenMaterial={openMaterial} materialViews={myMaterialViews} storageKey={`newton_modules_${loggedInStudent.studentId}_${currentClassId}`} />;
    } else if (studentSection === "announcements") {
      mainContent = <StudentAnnouncements announcements={sortedAnnouncements} />;
    } else if (studentSection === "calendar") {
      mainContent = <StudentCalendar quizzes={quizzes} homeworks={homeworks} manual={manualAssignmentList} completedQuizIds={completedQuizIds} locks={assignmentLocks} onOpen={openAssignment} />;
    } else if (studentSection === "grades") {
      mainContent = <StudentGrades classId={currentClassId} loggedInStudent={loggedInStudent} modules={mergedModules} quizzes={[...quizzes, ...homeworks]} submissions={submissions} gradeCategories={gradeCategories} gradeOverrides={gradeOverrides} assignmentCategories={assignmentCategories} manualAssignments={manualAssignments} attendance={attendance} dueDates={dueDates} assignmentNameOverrides={assignmentNameOverrides} />;
    } else if (studentSection === "syllabus") {
      mainContent = <StudentSyllabus syllabus={syllabus} />;
    } else if (studentSection === "guide") {
      mainContent = <CourseGuide guide={courseGuide} />;
    } else if (studentSection === "resources") {
      mainContent = <StudentResources shelves={resourceShelves} onItemClick={openMaterial} />;
    } else if (studentSection === "evals") {
      mainContent = <CourseEvals classId={currentClassId} mergedModules={mergedModules} courseEvals={courseEvals} setCourseEvals={setCourseEvals} />;
    } else {
      mainContent = <Stub title={SECTION_TITLE[studentSection]} description={STUB_COPY[studentSection]} />;
    }

    return (
      <ThemeContext.Provider value={th}>
        <>
          {bugModalJsx}
          {viewingPage && <PageViewer title={viewingPage.title} content={viewingPage.content} onClose={() => setViewingPage(null)} />}
          {unseenAnns.length > 0 && studentSection !== "announcements" && !showStudentSettings && <NewAnnouncementsModal announcements={unseenAnns} onDismiss={markAnnouncementsRead} />}
          <Shell
            header={header}
            sidebar={<Sidebar items={studentSidebarItems} activeId={showStudentSettings ? "account-settings" : studentSection} onSelect={handleStudentSectionSelect} />}
            rightRail={<TodoRail items={todoItems} overdue={todoOverdue} />}
            footer={<Footer inline onBugClick={() => setBugReportOpen(true)} />}
          >
            {mainContent}
          </Shell>
        </>
      </ThemeContext.Provider>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  if (screen === "homework" && activeHomework) {
    return (
      <ThemeContext.Provider value={appTh}>
        <HomeworkRunner
          homework={activeHomework}
          courseType={classMeta?.courseType || "physics1"}
          classId={currentClassId}
          loggedInStudent={loggedInStudent}
          practice={practiceMode}
          preview={runnerFrom === "instructor"}
          backLabel={runnerBackLabel}
          onFinish={saveHomeworkSub}
          onLeave={() => setScreen(runnerReturnScreen)}
          lightMode={lightMode}
          onToggleTheme={() => setLightMode(!lightMode)}
        />
      </ThemeContext.Provider>
    );
  }

  if (screen === "quiz") {
    // eslint-disable-next-line no-shadow
    const s = appTh.s; const MUTED = appTh.muted; const BORDER = appTh.border; const CARD = appTh.card; const text = appTh.text;
    const solidBg = appTh.isLight ? "#fff" : "#252627";
    return (
    <ThemeContext.Provider value={appTh}>
    <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
      {showLeaveConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, background: solidBg, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>{runnerFrom === "instructor" ? "Leave preview?" : "Leave quiz?"}</h3>
            <p style={{ ...s.muted, marginBottom: 20 }}>{runnerFrom === "instructor" ? "Your progress through the preview will be lost. Nothing was going to be saved either way." : "Your progress will be lost and this attempt will not be saved."}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLeaveConfirm(false)} style={{ ...s.btnSec, flex: 1 }}>Keep going</button>
              <button onClick={confirmLeave} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Leave</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={handleLeaveQuiz} disabled={subSaveError} title={subSaveError ? "Please retry saving before leaving" : ""} style={{ ...s.btnGhost, padding: "6px 12px", width: "auto", opacity: subSaveError ? 0.35 : 1, cursor: subSaveError ? "not-allowed" : "pointer" }}>← Back</button>
          <div style={{ width: 1, height: 20, background: BORDER }} />
          <div>
            <div style={{ color: text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>{activeQuiz?.title}{practiceMode && <span style={s.badge(TEAL)}>{runnerFrom === "instructor" ? "Preview" : "Practice"}</span>}</div>
            <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>
              {runnerFrom === "instructor" ? "Instructor preview · not saved" : loggedInStudent?.fullName}
              {!practiceMode && isLate(activeQuiz?.dueDate) ? " · ⚠️ past due (50% penalty)" : ""}
            </p>
          </div>
        </div>
        {/* The quiz screen is a full-screen takeover with no portal header, so it carries its own
            copy of the theme toggle (same setLightMode as everywhere else). Deliberately OUTSIDE
            the !quizDone guard: a student reading their graded results and feedback wants it as
            much as one answering questions. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setLightMode(!lightMode)}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", color: MUTED, fontSize: 16, lineHeight: 1 }}
          >{lightMode ? "☀" : "☽"}</button>
          {!quizDone && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <div style={{ ...s.muted, fontFamily: "monospace" }}>Q{qIdx + 1}/{activeQuiz?.questions.length}</div>
              {currentParts && completedParts.length > 0 && <div style={{ color: TEAL, fontFamily: "monospace", fontSize: 11 }}>Part{completedParts.length > 1 ? "s" : ""} {completedParts.join(", ")} done · {currentParts.filter(p => !completedParts.includes(p)).join(", ")} remaining</div>}
              {showsAttempts && <div style={{ ...s.muted, fontFamily: "monospace", fontSize: 11 }}>{Math.max(0, 5 - attemptCount)} attempt{Math.max(0, 5 - attemptCount) !== 1 ? "s" : ""} left</div>}
            </div>
          )}
        </div>
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <ChatMessages messages={messages} busy={busy} />
        {quizDone && subSaveError && (
          <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 12, padding: "16px 20px", marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14, margin: 0 }}>⚠️ Your submission could not be saved</p>
            <p style={{ color: MUTED, fontSize: 13, margin: 0, lineHeight: 1.5 }}>There was a network or server error. Please check your internet connection and tap Retry. If it keeps failing, contact your instructor and show them this screen.</p>
            <button onClick={retrySaveSub} style={{ ...s.btnPri, background: "#b91c1c", border: "1px solid #f87171" }}>Retry saving submission</button>
          </div>
        )}
        {quizDone && <button onClick={() => setScreen(runnerReturnScreen)} style={{ ...s.btnPri, marginTop: 8 }}>{runnerBackLabel}</button>}
      </div>
      {!quizDone && (
        <div style={{ background: CARD, borderTop: `1px solid ${BORDER}`, padding: 16, flexShrink: 0 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {isYesNoQ ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => submitYesNo(true)} disabled={busy} style={{ flex: 1, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", borderRadius: 12, padding: "14px", fontWeight: 700, fontSize: 18, cursor: "pointer", opacity: busy ? 0.4 : 1 }}>Yes</button>
                <button onClick={() => submitYesNo(false)} disabled={busy} style={{ flex: 1, ...s.btnSec, fontSize: 18, opacity: busy ? 0.4 : 1 }}>No</button>
              </div>
            ) : isDragDropQ ? (
              <DragDropQuestion key={qIdx} q={currentQ} onSubmit={submitDragDrop} busy={busy} />
            ) : isChoiceQ ? (
              <ChoiceQuestion key={qIdx} q={currentQ} onSubmit={submitChoice} busy={busy} />
            ) : (
              <>
                {pendingFile && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, ...s.card, padding: 12 }}>
                      <img src={pendingFile.previewUrl} alt="Preview" style={{ height: 72, width: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: text, fontSize: 12, fontWeight: 500, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.file.name}</p>
                        <p style={{ ...s.muted, fontSize: 12, margin: "0 0 4px" }}>{(pendingFile.file.size / 1024).toFixed(1)} KB</p>
                        {pendingFile.readability === "checking" && <p style={{ color: TEAL, fontSize: 12, margin: 0 }}>🔍 Checking image quality…</p>}
                        {pendingFile.readability === "ok" && <p style={{ color: "#4ade80", fontSize: 12, margin: 0 }}>✓ Image looks clear and readable</p>}
                        {pendingFile.readability?.status === "fail" && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ {pendingFile.readability.reason}</p>}
                      </div>
                      <button onClick={clearFile} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                    {pendingFile.readability?.status === "fail" && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>Please retake the photo and re-upload. Tips: make sure the drawing is well-lit, hold the camera steady, and ensure the full page is visible.</div>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  {isImageQ && (
                    <>
                      <input ref={fileInputRef} type="file" accept={ACCEPTED_IMG.join(",")} onChange={onFileSelect} style={{ display: "none" }} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={busy} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", borderRadius: 10, padding: "0 14px", cursor: "pointer", flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center", fontSize: 18 }}>🖼</button>
                    </>
                  )}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <textarea
                      ref={inputRef}
                      style={{ ...s.input, resize: "none", lineHeight: 1.5 }}
                      placeholder={isImageQ ? "Upload your drawing above, and optionally add a note…" : isSurveyQ ? "Type your response… (Enter to submit, Shift+Enter for new line)" : "Type your answer… (Enter to submit, Shift+Enter for new line)"}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      rows={2}
                      disabled={busy}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
                      onPaste={e => { e.preventDefault(); setPasteWarning(true); setTimeout(() => setPasteWarning(false), 3000); }}
                    />
                    {pasteWarning && <p style={{ color: "#f87171", fontSize: 12, margin: 0, textAlign: "center" }}>⚠️ Pasting is not allowed. Please type your answer.</p>}
                  </div>
                  <button onClick={sendAnswer} disabled={busy || pendingFile?.readability === "checking" || pendingFile?.readability?.status === "fail" || (isImageQ ? (!pendingFile && !input.trim()) : !input.trim())} style={{ ...s.btnPri, width: "auto", padding: "0 20px", alignSelf: "stretch", opacity: (busy || pendingFile?.readability === "checking" || pendingFile?.readability?.status === "fail" || (isImageQ ? (!pendingFile && !input.trim()) : !input.trim())) ? 0.4 : 1 }}>Send</button>
                </div>
                {isImageQ && !pendingFile && <p style={{ ...s.muted, fontSize: 12, textAlign: "center", margin: 0 }}>Click the 🖼 button to upload your drawing</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </ThemeContext.Provider>
    );
  }

  // ── Instructor Login ──────────────────────────────────────────────────────
  if (screen === "inst-login") {
    // eslint-disable-next-line no-shadow
    const s = appTh.s; const MUTED = appTh.muted;
    // An unseeded database has no password to type, so the login opens ON the claim form
    // rather than offering a field nothing can satisfy.
    const loginStep = settingsUnseeded && instLoginStep === "password" ? "claim" : instLoginStep;
    return (
    <ThemeContext.Provider value={appTh}>
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Footer />
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Wordmark size={72} />
        </div>
        {loginStep === "claim" ? (
          <>
            <p style={{ color: MUTED, fontSize: 13, textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
              {settingsUnseeded
                ? "No instructor password is set on this database yet. Choose one now."
                : "That is the setup password from this app's public source, so it is not a password. Choose a new one to continue."}
            </p>
            <input type="password" name="newton-claim-pw" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ ...s.input, marginBottom: 10 }} placeholder="New instructor password…" value={claimPw} onChange={e => { setClaimPw(e.target.value); setClaimErr(""); }} autoFocus />
            <input type="password" name="newton-claim-pw2" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ ...s.input, marginBottom: 10 }} placeholder="Confirm new password…" value={claimPw2} onChange={e => { setClaimPw2(e.target.value); setClaimErr(""); }} onKeyDown={e => e.key === "Enter" && !claimBusy && doClaim()} />
            {claimErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{claimErr}</p>}
            <button onClick={doClaim} disabled={claimBusy} style={{ ...s.btnPri, opacity: claimBusy ? 0.6 : 1, cursor: claimBusy ? "not-allowed" : "pointer" }}>{claimBusy ? "Saving…" : "Set password"}</button>
          </>
        ) : loginStep === "reset-send" ? (
          <>
            <p style={{ color: MUTED, fontSize: 13, textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
              A one-time code will be emailed to the instructor address on file. You will enter it here, in this tab, along with a new password.
            </p>
            {claimErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{claimErr}</p>}
            <button onClick={requestResetCode} disabled={claimBusy} style={{ ...s.btnPri, opacity: claimBusy ? 0.6 : 1, cursor: claimBusy ? "not-allowed" : "pointer" }}>{claimBusy ? "Sending…" : "Email me a code"}</button>
            <button onClick={() => { setInstLoginStep("password"); setClaimErr(""); }} style={{ ...s.btnSec, marginTop: 10 }}>← Back</button>
          </>
        ) : loginStep === "reset-verify" ? (
          <>
            <p style={{ color: MUTED, fontSize: 13, textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
              A code is on its way to {resetSentTo}. It works in this tab for {resetMinutes} minutes.
            </p>
            <input type="text" name="newton-reset-code" autoComplete="one-time-code" autoCorrect="off" autoCapitalize="characters" spellCheck={false} style={{ ...s.input, marginBottom: 10, textAlign: "center", letterSpacing: "0.18em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} placeholder="Code from the email" value={resetCode} onChange={e => { setResetCode(e.target.value); setClaimErr(""); }} autoFocus />
            <input type="password" name="newton-reset-pw" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ ...s.input, marginBottom: 10 }} placeholder="New instructor password…" value={claimPw} onChange={e => { setClaimPw(e.target.value); setClaimErr(""); }} />
            <input type="password" name="newton-reset-pw2" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ ...s.input, marginBottom: 10 }} placeholder="Confirm new password…" value={claimPw2} onChange={e => { setClaimPw2(e.target.value); setClaimErr(""); }} onKeyDown={e => e.key === "Enter" && !claimBusy && doReset()} />
            {claimErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{claimErr}</p>}
            <button onClick={doReset} disabled={claimBusy} style={{ ...s.btnPri, opacity: claimBusy ? 0.6 : 1, cursor: claimBusy ? "not-allowed" : "pointer" }}>{claimBusy ? "Saving…" : "Set new password"}</button>
            <button onClick={requestResetCode} disabled={claimBusy} style={{ ...s.btnSec, marginTop: 10 }}>Email another code</button>
            <button onClick={() => { setInstLoginStep("password"); setClaimErr(""); setResetCode(""); setResetChallenge(null); }} style={{ ...s.btnGhost, marginTop: 10 }}>← Back</button>
          </>
        ) : loginStep === "password" ? (
          <>
            <input type="password" name="newton-instructor-pw" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ ...s.input, marginBottom: 10 }} placeholder="Instructor password…" value={instPw} onChange={e => { setInstPw(e.target.value); setInstMsg(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} autoFocus />
            {instErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{instErr}</p>}
            {instMsg && <p style={{ color: "#4ade80", fontSize: 13, margin: "0 0 10px" }}>{instMsg}</p>}
            <button onClick={doLogin} style={s.btnPri}>Login</button>
            <button onClick={() => { setInstLoginStep("reset-send"); setInstErr(""); setInstMsg(""); setClaimErr(""); setClaimPw(""); setClaimPw2(""); }} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "10px 8px 0", width: "100%" }}>Forgot the password?</button>
          </>
        ) : (
          <>
            <p style={{ color: MUTED, fontSize: 13, textAlign: "center", margin: "0 0 16px" }}>Enter the 6-digit code from your authenticator app.</p>
            <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} style={{ ...s.input, marginBottom: 10, textAlign: "center", letterSpacing: "0.3em", fontSize: 20 }} placeholder="000000" value={totpInput} onChange={e => setTotpInput(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === "Enter" && doTotpVerify()} autoFocus />
            {totpErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{totpErr}</p>}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} style={{ accentColor: TEAL, width: 16, height: 16 }} />
              <span style={{ color: MUTED, fontSize: 13 }}>Remember this device</span>
            </label>
            <button onClick={doTotpVerify} style={s.btnPri}>Verify</button>
            <button onClick={() => { setInstLoginStep("password"); setTotpInput(""); setTotpErr(""); }} style={{ ...s.btnSec, marginTop: 10 }}>← Back</button>
          </>
        )}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <button onClick={() => setScreen("student-search")} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>← Student Login</button>
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
    );
  }

  // ── Instructor Submission Detail ──────────────────────────────────────────
  // ── Instructor Portal (LMS-style) ─────────────────────────────────────────
  if (screen === "instructor") {
    const th = buildTheme(lightMode);
    // Shadow module-level dark constants so inline styles in this block pick up the active theme.
    // eslint-disable-next-line no-shadow
    const s = th.s; const MUTED = th.muted; const BORDER = th.border; const text = th.text; const bg = th.bg; const isLight = th.isLight; // eslint-disable-line
    const header = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Wordmark onClick={() => setInstructorSection("modules")} />
          {Object.keys(classes).length > 0 ? (
            <CustomSelect
              value={currentClassId || ""}
              onChange={v => { if (v) switchToClass(v); }}
              placeholder="Select a class"
              options={Object.entries(classes).sort((a, b) => (a[1]?.metadata?.name || "").localeCompare(b[1]?.metadata?.name || "")).map(([cid, c]) => ({
                value: cid,
                label: (c?.metadata?.name || cid) + (c?.metadata?.active === false ? " (inactive)" : "")
              }))}
              style={{ marginTop: 4 }}
            />
          ) : (
            <span style={{ ...s.muted, fontSize: 13 }}>No classes yet. Create one in Settings.</span>
          )}
          {classDataLoading && <span style={{ ...s.muted, fontSize: 12 }}>Loading class data…</span>}
          <SyncBadge status={syncStatus} label={syncLabel} error={syncError} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setLightMode(!lightMode)}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", color: th.muted, fontSize: 16 }}
          >{lightMode ? "☀" : "☽"}</button>
          <button
            onClick={() => setInstructorSection("bugs")}
            onMouseEnter={() => setInstBugHover(true)}
            onMouseLeave={() => setInstBugHover(false)}
            title={`Bug Reports${unreadBugCount > 0 ? ` (${unreadBugCount})` : ""}`}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", position: "relative", display: "flex", alignItems: "center" }}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: (instructorSection === "bugs" || instBugHover) ? TEAL : MUTED, transform: (instructorSection === "bugs" || instBugHover) ? "rotate(30deg)" : "none", transition: "color 0.2s, transform 0.2s", display: "block" }}
            >
              <path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/>
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 13h16"/><path d="M4 17h16"/>
              <path d="M8 21v-8"/><path d="M16 21v-8"/>
              <path d="M3 10l2 2"/><path d="M19 10l2 2"/>
            </svg>
            {unreadBugCount > 0 && (
              <span style={{ position: "absolute", top: 0, right: 0, background: "#f87171", color: "#fff", borderRadius: "50%", fontSize: 9, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {unreadBugCount}
              </span>
            )}
          </button>
          <button onClick={() => { setInstPw(""); setScreen("student-search"); }} style={{ ...s.btnGhost, width: "auto" }}>Logout</button>
        </div>
      </>
    );

    const sidebarItems = INSTRUCTOR_SECTIONS.map(item =>
      item.id === "evals" ? { ...item, badge: unreadEvalCount || 0 } : item
    );

    return (
      <ThemeContext.Provider value={th}>
      <Shell
        header={header}
        sidebar={<Sidebar items={sidebarItems} activeId={instructorSection} onSelect={setInstructorSection} />}
        rightRail={instructorSection === "modules" ? <TodoRail items={instructorTodoItems} /> : null}
      >
        {dangerAction && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div style={{ ...s.card, background: isLight ? "#fff" : "#252627", border: `1px solid ${isLight ? "rgba(185,28,28,0.45)" : "rgba(127,29,29,0.6)"}`, padding: 24, width: "100%", maxWidth: 360 }}>
              <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Confirm Action</h3>
              <p style={{ ...s.muted, marginBottom: 16 }}>You are about to: <span style={{ color: isLight ? "#b91c1c" : "#fca5a5", fontWeight: 600 }}>{dangerAction.label}</span>. This cannot be undone.</p>
              <input type="password" style={{ ...s.input, marginBottom: 8 }} placeholder="Instructor password" value={dangerPw} onChange={e => setDangerPw(e.target.value)} onKeyDown={e => e.key === "Enter" && executeDanger()} autoFocus />
              {dangerErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>{dangerErr}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => { setDangerAction(null); setDangerPw(""); setDangerErr(""); }} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
                <button onClick={executeDanger} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {!currentClassId && instructorSection !== "settings" && instructorSection !== "bugs" && instructorSection !== "evals" && (
          <div style={{ ...s.card, padding: 32, textAlign: "center", color: MUTED }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 8px" }}>No class selected</p>
            <p style={{ margin: "0 0 16px" }}>{Object.keys(classes).length === 0 ? "Create your first class in Settings → Classes to get started." : "Choose a class from the dropdown above, or create one in Settings → Classes."}</p>
            <button onClick={() => setInstructorSection("settings")} style={{ ...s.btnPri, width: "auto", padding: "10px 20px" }}>Open Class Settings</button>
          </div>
        )}

        {currentClassId && instructorSection === "gradebook" && (
          <Gradebook
            roster={classStudents}
            modules={mergedModules}
            quizzes={[...quizzes, ...homeworks]}
            submissions={submissions}
            gradeCategories={gradeCategories}
            gradeOverrides={gradeOverrides}
            assignmentCategories={assignmentCategories}
            manualAssignments={manualAssignments}
            attendance={attendance}
            dueDates={dueDates}
            assignmentNameOverrides={assignmentNameOverrides}
            assignmentOrderOverrides={assignmentOrderOverrides}
            onSaveGradeCategories={saveGradeCategories}
            onSaveOverrideForStudent={saveOverrideForStudent}
            onSaveBulkOverrides={saveOverridesForStudents}
            onClearSubmission={clearSubmission}
            onSaveAssignmentCategories={saveAssignmentCategories}
            onSaveManualAssignments={saveManualAssignments}
            onSaveAssignmentNameOverrides={saveAssignmentNameOverrides}
            onSaveAssignmentOrderOverrides={saveAssignmentOrderOverrides}
            blackboard={blackboard}
            onSaveBlackboardLink={saveBlackboardLink}
            courseCode={COURSE_META[classMeta?.courseType]?.code || ""}
            customQuizzes={customQuizzes}
            onEditCustomQuiz={quizId => {
              const cq = customQuizzes[quizId];
              if (cq) setEditingCustomQuiz({ quizId, title: cq.title, text: cq.text, moduleId: null });
            }}
          />
        )}


        {currentClassId && instructorSection === "analytics" && (
          <Analytics
            classId={currentClassId}
            roster={classStudents}
            modules={mergedModules}
            quizzes={[...quizzes, ...homeworks]}
            submissions={submissions}
            gradeOverrides={gradeOverrides}
            assignmentCategories={assignmentCategories}
            manualAssignments={manualAssignments}
            attendance={attendance}
            dueDates={dueDates}
            gradeCategories={gradeCategories}
            assignmentLocks={assignmentLocks}
            assignmentNameOverrides={assignmentNameOverrides}
            assignmentOrderOverrides={assignmentOrderOverrides}
          />
        )}

        {currentClassId && instructorSection === "assignments" && (
          <Assignments
            classId={currentClassId}
            roster={classStudents}
            submissions={submissions}
            quizzes={quizzes}
            homeworks={homeworks}
            manualAssignments={manualAssignments}
            gradeCategories={gradeCategories}
            customQuizzes={customQuizzes}
            dueDates={dueDates}
            homeworkSettings={homeworkSettings}
            onSaveDueDates={saveDueDates}
            onSaveHomeworkSettings={saveHomeworkSettingFor}
            onSaveManualAssignments={saveManualAssignments}
            onEditCustomQuiz={quizId => {
              const cq = customQuizzes[quizId];
              if (cq) setEditingCustomQuiz({ quizId, title: cq.title, text: cq.text, moduleId: null });
            }}
            onCreateQuiz={() => setEditingCustomQuiz({ quizId: null, title: "", text: "", moduleId: null })}
            onDeleteCustomQuiz={deleteCustomQuiz}
            onPreview={previewAssignment}
          />
        )}

        {currentClassId && instructorSection === "attendance" && (
          <Attendance
            roster={classStudents}
            attendance={attendance}
            manualAssignments={manualAssignments}
            dueDates={dueDates}
            onSaveSession={saveAttendanceSession}
            onDeleteSession={deleteAttendanceSession}
          />
        )}

        {currentClassId && instructorSection === "roster" && (
          <div>
            <ManualAddStudent roster={roster} onAdd={async student => {
              // Adding genuinely rewrites the array, so base it on a fresh read rather than on
              // whatever this tab loaded — otherwise adding one student can drop another.
              let live; try { live = await fbGet(classPath(currentClassId, 'roster')); } catch { live = null; }
              const base = Array.isArray(live) ? live : roster;
              await saveRoster([...base, student].sort((a, b) => a.lastName.localeCompare(b.lastName)));
            }} />
            <div style={{ ...s.card, padding: 14, marginBottom: 20, fontSize: 13, color: MUTED, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              {/* One picker for the whole class, because the fact it records is "which of these
                  entries is me" — one answer per roster, not a setting each student carries. The
                  named entry is left out of the gradebook, the analytics, the assignments hub's
                  progress column and the attendance roll; see `src/roster-scope.js`. */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED }}>
                <span>My own account:</span>
                <select value={instructorAccountOf(roster)?.studentId || ""} onChange={e => setInstructorAccount(e.target.value || null)}
                        title="Pick your own roster entry to keep it out of the gradebook, the analytics and the attendance roll. It still logs in and does the homework as usual."
                        style={{ background: isLight ? "#fff" : "#252627", border: `1px solid ${BORDER}`, color: text, borderRadius: 6, padding: "5px 10px", fontSize: 13, outline: "none", colorScheme: isLight ? "light" : "dark", maxWidth: 260 }}>
                  <option value="">None (everyone is a student)</option>
                  {roster.map(stu => <option key={stu.studentId} value={stu.studentId}>{stu.altName || stu.fullName} ({stu.studentId})</option>)}
                </select>
              </label>
              {/* Auditing is a property any number of entries can carry, so it is a multi-select
                  rather than a second single picker, and it lives up here rather than as a
                  button on every row so the table stays a roster. The instructor's own entry is
                  already out of every class view, so it is not listed. Each tick writes one
                  entry's own `auditing` leaf; see `src/roster-scope.js`. */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED }}>
                <span>Auditing:</span>
                <MultiSelect
                  values={auditors(roster).map(a => a.studentId)}
                  onToggle={(studentId, on) => setAuditing(studentId, on)}
                  options={roster.filter(stu => !isInstructorAccount(stu)).map(stu => ({ value: stu.studentId, label: `${stu.altName || stu.fullName} (${stu.studentId})` }))}
                  placeholder="Nobody"
                  title="Tick anyone auditing the course. They keep logging in and doing the work, and keep seeing their own grades, but they leave the gradebook, the analytics, the progress columns and the attendance roll."
                />
              </label>
              <span style={{ ...s.muted, fontSize: 12, marginLeft: "auto" }}>(MyMercer roster export file)</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <label style={{ ...s.btnGhost, cursor: "pointer", display: "inline-block", padding: "8px 16px", fontSize: 13 }}>Upload Roster CSV<input ref={rosterInputRef} type="file" accept=".csv,.txt" onChange={onRosterUpload} style={{ display: "none" }} /></label>
                {rosterMsg && <p style={{ margin: 0, fontSize: 13, color: rosterMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{rosterMsg}</p>}
              </div>
            </div>
            {roster.length === 0 ? <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No roster uploaded yet.</div> : (
              <div style={{ ...s.card, overflow: "hidden" }}>
                {removeStudent && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
                    <div style={{ ...s.card, border: "1px solid rgba(127,29,29,0.6)", padding: 24, width: "100%", maxWidth: 360 }}>
                      <h3 style={{ color: text, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Remove Student</h3>
                      <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>{removeStudent.fullName}</p>
                      <p style={{ color: MUTED, fontFamily: "monospace", fontSize: 13, margin: "0 0 16px" }}>ID: {removeStudent.studentId}</p>
                      <p style={{ ...s.muted, fontSize: 13, marginBottom: 16 }}>This permanently deletes everything attached to them <strong>in this class</strong>: submissions, grades, overrides, homework progress, and uploaded work. Their data in any other class is untouched. This cannot be undone.</p>
                      <input type="password" style={{ ...s.input, marginBottom: 8 }} placeholder="Instructor password" value={removePw} onChange={e => setRemovePw(e.target.value)} autoFocus />
                      {removeErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>{removeErr}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <button onClick={() => { setRemoveStudent(null); setRemovePw(""); setRemoveErr(""); }} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
                        <button onClick={async () => {
                          if (settingsUnreadable) { setRemoveErr("Could not load the instructor settings on this device. Refresh and try again."); return; }
                          if (!settings.passwordHash) { setRemoveErr("Settings not loaded."); return; }
                          const ok = await verifyPw(removePw.trim(), settings.passwordHash, settings.passwordSalt);
                          if (!ok) { setRemoveErr("Incorrect password."); return; }
                          try {
                            await removeStudentData(removeStudent.studentId);
                          } catch (e) { setRemoveErr(`Removal failed: ${e?.message || e}`); return; }
                          setRemoveStudent(null); setRemovePw(""); setRemoveErr("");
                        }} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Remove</button>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>{["#", "Name", "Student ID", "Email", ""].map(h => <th key={h} style={{ textAlign: "left", color: MUTED, fontWeight: 500, padding: "12px 16px", fontSize: 13 }}>{h}</th>)}</tr></thead>
                    <tbody>{roster.map((stu, i) => (
                      <tr key={stu.studentId} style={{ borderBottom: i < roster.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        <td style={{ padding: "12px 16px", color: MUTED, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", color: text, fontWeight: 500 }}>{editingAltName === stu.studentId ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input value={altNameInput} onChange={e => setAltNameInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveAltName(stu); if (e.key === "Escape") setEditingAltName(null); }} placeholder="Preferred name (blank to clear)" autoFocus style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: text, borderRadius: 6, padding: "4px 10px", fontSize: 13, outline: "none", width: 200 }} />
                            <button onClick={() => saveAltName(stu)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                            <button onClick={() => setEditingAltName(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span>{stu.altName || stu.fullName}{stu.altName && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12, marginLeft: 4 }}>({stu.fullName})</span>}</span>
                            {/* A name the student chose is flagged, because it is the only one nobody
                                has looked at. Screening approved it; this is what makes it reviewable. */}
                            {stu.altNameBy === "student" && (
                              <span title={stu.altNameAt ? `Set by the student on ${new Date(stu.altNameAt).toLocaleDateString()}` : "Set by the student"}
                                    style={{ color: TEAL, background: "rgba(0,130,140,0.14)", border: `1px solid ${TEAL}`, borderRadius: 5, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>set by student</span>
                            )}
                            {!nicknameAllowed(stu) && (
                              <span title="This student cannot set their own name" style={{ color: isLight ? "#92640a" : "#fde047", background: isLight ? "rgba(202,138,4,0.12)" : "rgba(202,138,4,0.15)", border: "1px solid rgba(202,138,4,0.5)", borderRadius: 5, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>name locked</span>
                            )}
                            {/* Read-only: the picker above the table is what sets this. The row
                                still has to say which entry it is, since the difference is
                                invisible from here and shows up two tabs away. */}
                            {isInstructorAccount(stu) && (
                              <span title="Your own account. Left out of the gradebook, the analytics and the attendance roll." style={{ color: TEAL, background: "rgba(0,130,140,0.14)", border: `1px solid ${TEAL}`, borderRadius: 5, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>your account</span>
                            )}
                            {/* Same shape as "your account": read-only here, set by the Auditing
                                picker above the table. */}
                            {isAuditing(stu) && !isInstructorAccount(stu) && (
                              <span title="Auditing the course. Left out of the gradebook, the analytics, the progress columns and the attendance roll. The Auditing picker above the table is what sets this." style={{ color: isLight ? "#6d28d9" : "#c4b5fd", background: isLight ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.55)", borderRadius: 5, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>auditing</span>
                            )}
                            <button onClick={() => { setEditingAltName(stu.studentId); setAltNameInput(stu.altName || ""); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title="Set preferred name">✎</button>
                            {stu.altName && (
                              <button onClick={() => resetAltName(stu)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title={`Reset to ${stu.fullName}`}>↺</button>
                            )}
                            <button onClick={() => toggleNicknameLock(stu)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 0, display: "inline-flex", alignItems: "center" }}
                                    title={nicknameAllowed(stu) ? "Stop this student from setting their own name" : "Let this student set their own name again"}>
                              <LockIcon size={13} color={nicknameAllowed(stu) ? MUTED : (isLight ? "#92640a" : "#fde047")} strokeWidth={nicknameAllowed(stu) ? 2 : 2.4} />
                            </button>
                          </div>
                        )}</td>
                        <td style={{ padding: "12px 16px", color: MUTED, fontFamily: "monospace", fontSize: 13 }}>{stu.studentId}</td>
                        <td style={{ padding: "12px 16px" }}>{editingEmail === stu.studentId ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEmail(stu); if (e.key === "Escape") setEditingEmail(null); }} placeholder="student@example.com" autoFocus style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: text, borderRadius: 6, padding: "4px 10px", fontSize: 13, outline: "none", width: 220 }} />
                            <button onClick={() => saveEmail(stu)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                            <button onClick={() => setEditingEmail(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: stu.email ? MUTED : isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)", fontSize: 13 }}>{stu.email || "-"}</span>
                            <button onClick={() => { setEditingEmail(stu.studentId); setEmailInput(stu.email || ""); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title="Edit email">✎</button>
                          </div>
                        )}</td>
                        <td style={{ padding: "8px 16px", textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* This button carries what the "Password Status" column used to say. That
                              column spent ~140px of every row restating one bit whose only use is
                              deciding whether to press this: a student still on their Student ID has
                              nothing to reset, so the button is simply dead for them, and a dead
                              button is the same fact at the point of action. */}
                          <button disabled={!studentPws[stu.studentId]} onClick={async () => { if (!window.confirm(`Reset ${stu.fullName}'s password back to their Student ID?`)) return; await saveStudentPw(stu.studentId, null); }} title={studentPws[stu.studentId] ? `Reset ${stu.fullName}'s password back to their Student ID` : `${stu.fullName} has not set a password, so there is nothing to reset. They log in with their Student ID.`} style={{ background: studentPws[stu.studentId] ? (isLight ? "rgba(202,138,4,0.12)" : "rgba(202,138,4,0.15)") : "none", border: `1px solid ${studentPws[stu.studentId] ? "rgba(202,138,4,0.5)" : BORDER}`, color: studentPws[stu.studentId] ? (isLight ? "#92640a" : "#fde047") : MUTED, opacity: studentPws[stu.studentId] ? 1 : 0.5, borderRadius: 6, padding: "4px 12px", cursor: studentPws[stu.studentId] ? "pointer" : "default", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>Reset PW</button>
                          <button onClick={() => { setRemoveStudent(stu); setRemovePw(""); setRemoveErr(""); }} style={{ background: isLight ? "rgba(185,28,28,0.08)" : "rgba(127,29,29,0.3)", border: "1px solid rgba(185,28,28,0.4)", color: isLight ? "#b91c1c" : "#fca5a5", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>Remove</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {currentClassId && instructorSection === "modules" && (
          <InstructorModules
            classId={currentClassId}
            modules={modules}
            moduleConfig={moduleConfig}
            pages={pages}
            uploads={uploads}
            quizzes={quizzes}
            homeworks={homeworks}
            customQuizzes={customQuizzes}
            dueDates={dueDates}
            onSaveDueDates={saveDueDates}
            onSaveModules={saveModules}
            onSaveModuleConfig={saveModuleConfigFor}
            onSavePage={savePage}
            onDeletePage={deletePage}
            onSaveUpload={saveUpload}
            onDeleteUpload={deleteUpload}
            onUploadFile={fbUpload}
            onDeleteStorage={fbDeleteStorage}
            onOpenPageEditor={(moduleId, itemId, pageId) => {
              const existing = pageId ? pages[pageId] : null;
              setEditingPage({
                moduleId,
                itemId: itemId || null,
                pageId: pageId || null,
                title: existing?.title || "",
                content: existing?.content || "",
              });
            }}
            onOpenCustomQuizEditor={(moduleId, quizId) => {
              if (quizId) {
                const cq = customQuizzes[quizId];
                if (cq) setEditingCustomQuiz({ quizId, title: cq.title, text: cq.text, moduleId: null });
              } else {
                setEditingCustomQuiz({ quizId: null, title: "", text: "", moduleId });
              }
            }}
            onDeleteCustomQuiz={deleteCustomQuiz}
            // Clicking an item's title opens it the way a student would. Quiz/homework run the
            // REAL student runners in preview mode; a page opens the same PageViewer students get.
            onPreviewQuiz={q => startQuiz(q, true, "instructor")}
            onPreviewHomework={hw => startHomework(hw, true, "instructor")}
            onViewPage={p => setViewingPage({ title: p.title, content: p.content || "" })}
          />
        )}

        {editingPage && (
          <PageEditor
            initialTitle={editingPage.title}
            initialContent={editingPage.content}
            onCancel={() => setEditingPage(null)}
            onSave={async ({ title, content }) => {
              const now = new Date().toISOString();
              const isNew = !editingPage.pageId;
              const pageId = editingPage.pageId || newId("p");
              const existing = pages[pageId] || {};
              const page = { title, content, createdAt: existing.createdAt || now, updatedAt: now };
              await savePage(pageId, page);
              const next = modules.map(mod => {
                if (mod.id !== editingPage.moduleId) return mod;
                if (isNew) {
                  const items = [...(mod.items || []), { id: newId("it"), type: "page", pageId, title }];
                  return { ...mod, items };
                }
                const items = (mod.items || []).map(it => it.id === editingPage.itemId ? { ...it, title } : it);
                return { ...mod, items };
              });
              await saveModules(next);
              setEditingPage(null);
            }}
          />
        )}

        {editingCustomQuiz && (
          <PageEditor
            editorLabel={editingCustomQuiz.quizId ? "Edit Quiz" : "New Quiz"}
            contentLabel="Question prompt"
            initialTitle={editingCustomQuiz.title}
            initialContent={editingCustomQuiz.text}
            onCancel={() => setEditingCustomQuiz(null)}
            onSave={async ({ title, content }) => {
              const now = new Date().toISOString();
              const isNew = !editingCustomQuiz.quizId;
              const quizId = editingCustomQuiz.quizId || newId("cq");
              const existing = customQuizzes[quizId] || {};
              await saveCustomQuiz(quizId, { id: quizId, title, text: content, createdAt: existing.createdAt || now, updatedAt: now });
              if (isNew) {
                await saveManualAssignments({ ...(manualAssignments || {}), [quizId]: { id: quizId, title, catId: "cat_quiz", maxPts: 10 } });
                if (editingCustomQuiz.moduleId) {
                  const next = modules.map(mod =>
                    mod.id !== editingCustomQuiz.moduleId ? mod
                    : { ...mod, items: [...(mod.items || []), { id: newId("it"), type: "quiz", refId: quizId }] }
                  );
                  await saveModules(next);
                }
              } else if (manualAssignments[quizId]) {
                await saveManualAssignments({ ...(manualAssignments || {}), [quizId]: { ...manualAssignments[quizId], title } });
              }
              setEditingCustomQuiz(null);
            }}
          />
        )}

        {currentClassId && instructorSection === "announcements" && (
          <InstructorAnnouncements
            classId={currentClassId}
            roster={roster}
            announcements={sortedAnnouncements}
            onCompose={() => setEditingAnn({ title: "", body: "" })}
            onEdit={ann => setEditingAnn({ annId: ann.id, title: ann.title, body: ann.body, createdAt: ann.createdAt })}
            onDelete={async annId => {
              if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
              await deleteAnnouncement(annId);
            }}
          />
        )}
        {editingAnn && (
          <AnnouncementEditor
            initialTitle={editingAnn.title}
            initialBody={editingAnn.body}
            emailCount={roster.filter(s => s.email).length}
            onCancel={() => setEditingAnn(null)}
            onSave={async ({ title, body, sendEmail }) => {
              await saveAnnouncement({ id: editingAnn.annId || null, title, body, createdAt: editingAnn.createdAt || null, sendEmail });
              setEditingAnn(null);
            }}
          />
        )}

        {currentClassId && instructorSection === "syllabus" && (
          <InstructorSyllabus
            syllabus={syllabus}
            classId={currentClassId}
            syllabusMismatch={syllabusMismatch}
            onUploadFile={fbUpload}
            onSaveSyllabus={saveSyllabus}
            onDeleteSyllabus={deleteSyllabus}
          />
        )}

        {currentClassId && instructorSection === "guide" && (
          <InstructorGuide guide={courseGuide} onSaveGuide={saveCourseGuide} />
        )}

        {currentClassId && instructorSection === "calendar" && (
          <StudentCalendar quizzes={quizzes} homeworks={homeworks} manual={manualAssignmentList} completedQuizIds={new Set()} onOpen={previewAssignment} />
        )}

        {instructorSection === "settings" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Classes</p>
              <div style={{ ...s.card, padding: 16, marginBottom: 16 }}>
                <p style={{ ...s.muted, fontSize: 13, margin: "0 0 12px" }}>Create a new class</p>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={s.label}>Class name</label>
                    <input style={s.input} placeholder="e.g., Physics 2 Fall 2026" value={newClassName} onChange={e => setNewClassName(e.target.value)} onKeyDown={async e => { if (e.key === "Enter") { e.preventDefault(); try { setNewClassMsg(""); const id = await createClass(newClassName, newClassCourse); setNewClassName(""); setNewClassMsg("✅ Created."); await switchToClass(id); setTimeout(() => setNewClassMsg(""), 2500); } catch (err) { setNewClassMsg("⚠️ " + (err.message || "Failed to create class.")); } } }} />
                  </div>
                  <div>
                    <label style={s.label}>Course</label>
                    <CustomSelect
                      variant="input"
                      value={newClassCourse}
                      onChange={setNewClassCourse}
                      options={COURSE_OPTIONS}
                    />
                  </div>
                  <button onClick={async () => {
                    try { setNewClassMsg(""); const id = await createClass(newClassName, newClassCourse); setNewClassName(""); setNewClassMsg("✅ Created."); await switchToClass(id); setTimeout(() => setNewClassMsg(""), 2500); }
                    catch (err) { setNewClassMsg("⚠️ " + (err.message || "Failed to create class.")); }
                  }} style={{ ...s.btnPri, width: "auto", padding: "10px 20px" }}>Create</button>
                </div>
                {newClassMsg && <p style={{ margin: "10px 0 0", fontSize: 13, color: newClassMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{newClassMsg}</p>}
              </div>

              {Object.keys(classes).length === 0 ? (
                <div style={{ ...s.card, padding: 24, textAlign: "center", color: MUTED }}>No classes yet. Use the form above to create one.</div>
              ) : (
                <div style={{ ...s.card, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>{["Class", "Course", "Visibility", "Students", ""].map(h => <th key={h} style={{ textAlign: "left", color: MUTED, fontWeight: 500, padding: "12px 16px", fontSize: 13 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {Object.entries(classes).sort((a, b) => (a[1]?.metadata?.name || "").localeCompare(b[1]?.metadata?.name || "")).map(([cid, c], i, arr) => {
                          const m = c?.metadata || {};
                          const rosterCount = Array.isArray(c?.roster) ? c.roster.length : 0;
                          const isCurrent = currentClassId === cid;
                          return (
                            <tr key={cid} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none", background: isCurrent ? "rgba(0,130,140,0.08)" : "transparent" }}>
                              <td style={{ padding: "12px 16px", color: text, fontWeight: 500 }}>{editingClassId === cid ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <input value={editingClassNameInput} onChange={e => setEditingClassNameInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameClass(cid, editingClassNameInput); if (e.key === "Escape") setEditingClassId(null); }} autoFocus style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: text, borderRadius: 6, padding: "4px 10px", fontSize: 13, outline: "none", width: 240 }} />
                                  <button onClick={() => renameClass(cid, editingClassNameInput)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                                  <button onClick={() => setEditingClassId(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span>{m.name || cid}</span>
                                  <button onClick={() => { setEditingClassId(cid); setEditingClassNameInput(m.name || ""); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title="Rename class">✎</button>
                                  {isCurrent && <span style={{ ...s.badge(TEAL) }}>selected</span>}
                                </div>
                              )}</td>
                              <td style={{ padding: "12px 16px", color: MUTED }}>{COURSE_LABELS[m.courseType] || m.courseType || "-"}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                  <input type="checkbox" checked={m.active !== false} onChange={e => setClassActive(cid, e.target.checked)} style={{ accentColor: TEAL, width: 16, height: 16 }} />
                                  <span style={{ ...s.muted, fontSize: 12 }}>{m.active !== false ? "Visible to students" : "Hidden"}</span>
                                </label>
                              </td>
                              <td style={{ padding: "12px 16px", color: MUTED, fontFamily: "monospace", fontSize: 13 }}>{rosterCount}</td>
                              <td style={{ padding: "8px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                                {!isCurrent && <button onClick={() => switchToClass(cid)} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 12, marginRight: 6, width: "auto" }}>Switch to</button>}
                                <button onClick={() => confirmDanger(`delete class "${m.name || cid}" and all its data`, () => deleteClass(cid))} style={{ background: isLight ? "rgba(185,28,28,0.08)" : "rgba(127,29,29,0.3)", border: "1px solid rgba(185,28,28,0.4)", color: isLight ? "#b91c1c" : "#fca5a5", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Delete</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${BORDER}`, margin: "0 0 32px" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 36 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={FIREBASE} target="_blank" rel="noopener noreferrer" style={{ color: MUTED, display: "flex", alignItems: "center" }} title="Open Firebase console">
                    <svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.648 22.482L5.56 2.108a.484.484 0 0 1 .9-.18l3.004 5.594 1.06-2.01a.484.484 0 0 1 .862 0L19.38 22.482H2.648z" fill="#FFA000"/><path d="M12.82 14.278l-2.296-4.756L2.648 22.482H12.82v-8.204z" fill="#F57F17"/><path d="M19.596 22.482L16.97 6.716a.484.484 0 0 0-.858-.196L2.648 22.482h16.948z" fill="#FFCA28"/><path d="M19.596 22.482l-2.39-15.57a.484.484 0 0 0-.858-.196l-3.528 5.562 6.776 10.204z" fill="#FFA000"/></svg>
                  </a>
                  <span style={{ fontSize: 11, color: fbConnStatus === 'ok' ? "#4ade80" : "#f87171" }}>{fbConnStatus === 'ok' ? "● Connected" : "● Unreachable"}</span>
                  {fbConnStatus === 'error' && <p style={{ color: "#f87171", fontSize: 11, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>{fbConnError}</p>}
                </div>
                <div>
                  <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>Backup & Restore</p>
                  <p style={{ ...s.muted, fontSize: 12, margin: "0 0 12px" }}>{currentClassId && classMeta?.name ? <>Backs up <span style={{ color: TEAL }}>{classMeta.name}</span> plus instructor settings.</> : "Select a class to back up its data."}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={exportAllData} disabled={!currentClassId} style={{ ...s.btnPri, flex: 1, minWidth: 140, opacity: currentClassId ? 1 : 0.5, cursor: currentClassId ? "pointer" : "not-allowed" }}>Download Backup</button>
                    <label style={{ ...s.btnGhost, flex: 1, minWidth: 140, cursor: currentClassId ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: currentClassId ? 1 : 0.5 }}>Restore from Backup<input ref={backupInputRef} type="file" accept=".json" onChange={onBackupImport} disabled={!currentClassId} style={{ display: "none" }} /></label>
                  </div>
                  {backupMsg && <p style={{ margin: "10px 0 0", fontSize: 13, color: backupMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{backupMsg}</p>}
                </div>
              </div>
              <div>
                <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Change Instructor Password</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="password" style={s.input} placeholder="New password" value={editPw} onChange={e => { setEditPw(e.target.value); setEditPwMsg(""); }} />
                  <input type="password" style={s.input} placeholder="Confirm new password" value={editPw2} onChange={e => { setEditPw2(e.target.value); setEditPwMsg(""); }} />
                  {editPwMsg && <p style={{ fontSize: 13, margin: 0, color: editPwMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{editPwMsg}</p>}
                  <button onClick={async () => {
                    if (!editPw.trim()) { setEditPwMsg("Password cannot be empty."); return; }
                    if (editPw !== editPw2) { setEditPwMsg("Passwords do not match."); return; }
                    if (editPw.trim().length < MIN_INSTRUCTOR_PW) { setEditPwMsg(`Password must be at least ${MIN_INSTRUCTOR_PW} characters.`); return; }
                    if (editPw.trim() === LEGACY_SEEDED_PW) { setEditPwMsg("That password is published in this app's source. Choose a different one."); return; }
                    // The write is reported. It used to adopt the new password into local state
                    // and then await the save, so a failed write left this session logging in
                    // with a password the database had never accepted, while every other device
                    // still needed the old one.
                    try { await claimInstructorPw(editPw); }
                    catch (e) { setEditPwMsg(`Could not save the new password: ${e.message}. The old one is still in effect.`); return; }
                    setEditPw(""); setEditPw2(""); setEditPwMsg("✅ Password updated!");
                  }} style={s.btnPri}>Update Password</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 36 }}>
              <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Two-Factor Authentication</p>
              {!settings.totpSecret ? (
                <div>
                  <p style={{ ...s.muted, lineHeight: 1.5, margin: "0 0 14px" }}>2FA is not enabled. Protect your instructor login with a time-based one-time password.</p>
                  {!totpSetupState ? (
                    <button onClick={startTotpSetup} style={{ ...s.btnPri, width: "auto", padding: "10px 20px" }}>Enable 2FA</button>
                  ) : (
                    <div>
                      <p style={{ ...s.muted, margin: "0 0 12px" }}>Scan this QR code with Google Authenticator, Authy, or any TOTP app:</p>
                      {totpSetupState.qrDataUrl && <div style={{ background: "#fff", padding: 8, borderRadius: 8, display: "inline-block", marginBottom: 16 }}><img src={totpSetupState.qrDataUrl} alt="TOTP QR Code" style={{ display: "block" }} /></div>}
                      <p style={{ ...s.muted, fontSize: 12, margin: "0 0 14px" }}>Or enter manually: <code style={{ color: "#fff", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", userSelect: "all" }}>{totpSetupState.secret}</code></p>
                      <p style={{ ...s.muted, margin: "0 0 8px", fontSize: 13 }}>Enter the 6-digit code from your app to confirm:</p>
                      <input type="text" inputMode="numeric" maxLength={6} style={{ ...s.input, width: 160, textAlign: "center", letterSpacing: "0.3em", fontSize: 18, marginBottom: 8 }} placeholder="000000" value={totpSetupCode} onChange={e => setTotpSetupCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === "Enter" && confirmTotpSetup()} />
                      {totpSetupErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>{totpSetupErr}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button onClick={confirmTotpSetup} style={{ ...s.btnPri, width: "auto", padding: "10px 20px" }}>Confirm & Enable</button>
                        <button onClick={() => { setTotpSetupState(null); setTotpSetupCode(""); setTotpSetupErr(""); }} style={{ ...s.btnSec, width: "auto", padding: "10px 20px" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={s.badge("#4ade80")}>Enabled</span>
                    <span style={{ ...s.muted, fontSize: 13 }}>{Object.keys(settings.trustedDevices || {}).length} trusted device(s)</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={disableTotp} style={{ ...s.btnDanger, width: "auto", flex: "none" }}>Disable 2FA</button>
                    {Object.keys(settings.trustedDevices || {}).length > 0 && (
                      <button onClick={clearTrustedDevices} style={{ ...s.btnDanger, width: "auto", flex: "none" }}>Clear Trusted Devices</button>
                    )}
                  </div>
                  {clearDevicesMsg && <p style={{ fontSize: 13, margin: "10px 0 0", color: "#4ade80" }}>{clearDevicesMsg}</p>}
                </div>
              )}
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${BORDER}`, margin: "0 0 32px" }} />

            <div>
              <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>Danger Zone {currentClassId && classMeta?.name ? <span style={{ ...s.muted, fontWeight: 400 }}>(applies to <span style={{ color: TEAL }}>{classMeta.name}</span>)</span> : null}</p>
              <p style={{ ...s.muted, fontSize: 13, margin: "0 0 14px" }}>{currentClassId ? "These actions affect the currently selected class only." : "Select a class to manage its data."}</p>
              {currentClassId ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                  {[["Clear All Quiz Due Dates", async () => saveDueDates({})], ["Clear All Submissions", async () => replaceAllSubmissions([])], ["Clear Imported Grades Only", async () => { for (const sub of submissions.filter(s => s.imported)) await deleteSubmissions(sub.studentId, [sub.id]); }], ["Clear All Gradebook Check Marks", async () => saveChecked({})], ["Reset All Student Passwords", async () => saveStudentPws({})], ["Clear Roster", async () => saveRoster([])]].map(([label, action]) => (
                    <button key={label} onClick={() => confirmDanger(label, action)} style={s.btnDanger}>{label}</button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {instructorSection === "bugs" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <p style={{ ...s.muted, margin: 0 }}>{Object.values(bugReports).length} total{unreadBugCount > 0 && <span style={{ ...s.badge("#f87171"), marginLeft: 8 }}>{unreadBugCount} unread</span>}</p>
            </div>
            {Object.values(bugReports).length === 0 ? <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No bug reports yet.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.values(bugReports).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(report => (
                  <div key={report.id} style={{ ...s.card, padding: "16px 20px", opacity: report.read ? 0.55 : 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ ...s.muted, fontSize: 12 }}>{new Date(report.timestamp).toLocaleString()}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {!report.read && <span style={s.badge("#f87171")}>Unread</span>}
                        {!report.read && <button onClick={() => markBugRead(report.id)} style={{ ...s.btnGhost, padding: "4px 10px", fontSize: 12 }}>Mark read</button>}
                      </div>
                    </div>
                    <p style={{ color: text, fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{report.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {instructorSection === "evals" && (() => {
          const allEvals = Object.values(courseEvals)
            .filter(e => e.classId === currentClassId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const filtered = evalFilter === "all" ? allEvals : allEvals.filter(e => e.type === evalFilter);
          const LIKERT_LABELS = { SA: "Strongly Agree", A: "Agree", D: "Disagree", SD: "Strongly Disagree" };
          const SURVEY_QUESTIONS = [
            { id: "q1", text: "Course requirements are stated clearly in the syllabus." },
            { id: "q2", text: "The course is organized in a way that helps me learn." },
            { id: "q3", text: "The grading criteria for each assignment are clear." },
            { id: "q4", text: "The assignments help me understand the subject more clearly." },
            { id: "q5", text: "The instructor answers questions and concerns in a timely manner." },
            { id: "q6", text: "The instructor provides constructive feedback on assignments." },
            { id: "q7", text: "The instructor shows respect for students." },
          ];
          const exportEvalsCsv = () => {
            const c = syllabus?.fields?.course;
            const prefix = [c?.term, c?.number].filter(Boolean).join(" ");
            const filename = (prefix ? `${prefix} - Evaluations` : "evaluations") + ".csv";
            const headers = ["Timestamp", "Type", "Message", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Suggestions", "Most Helpful Assignment", "Liked Best"];
            const rows = allEvals.map(ev => {
              if (ev.type === "quick") {
                return [new Date(ev.timestamp).toLocaleString(), "Quick Feedback", ev.message ?? "", "", "", "", "", "", "", "", "", "", ""];
              }
              const r = ev.responses ?? {};
              const o = ev.openEnded ?? {};
              return [
                new Date(ev.timestamp).toLocaleString(), "End-of-Course Survey", "",
                LIKERT_LABELS[r.q1] ?? "", LIKERT_LABELS[r.q2] ?? "", LIKERT_LABELS[r.q3] ?? "",
                LIKERT_LABELS[r.q4] ?? "", LIKERT_LABELS[r.q5] ?? "", LIKERT_LABELS[r.q6] ?? "",
                LIKERT_LABELS[r.q7] ?? "", o.suggestions ?? "", o.assignment ?? "", o.best ?? "",
              ];
            });
            const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
          };
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <p style={{ ...s.muted, margin: 0 }}>
                  {allEvals.length} total
                  {unreadEvalCount > 0 && <span style={{ ...s.badge("#f87171"), marginLeft: 8 }}>{unreadEvalCount} unread</span>}
                </p>
                <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
                  {["all", "quick", "survey"].map(f => (
                    <button key={f} onClick={() => setEvalFilter(f)} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 12, background: evalFilter === f ? "rgba(0,130,140,0.15)" : "transparent", color: evalFilter === f ? TEAL : MUTED, border: `1px solid ${evalFilter === f ? TEAL : BORDER}` }}>
                      {f === "all" ? "All" : f === "quick" ? "Quick Feedback" : "Surveys"}
                    </button>
                  ))}
                  {allEvals.length > 0 && (
                    <button onClick={exportEvalsCsv} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 12 }}>Export CSV</button>
                  )}
                </div>
              </div>
              {filtered.length === 0 ? (
                <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No evaluations yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map(ev => (
                    <div key={ev.id} style={{ ...s.card, padding: "16px 20px", opacity: ev.read ? 0.55 : 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={s.badge(ev.type === "survey" ? "#818cf8" : TEAL)}>{ev.type === "survey" ? "End-of-Course Survey" : "Quick Feedback"}</span>
                          <span style={{ ...s.muted, fontSize: 12 }}>{new Date(ev.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {!ev.read && <span style={s.badge("#f87171")}>Unread</span>}
                          {!ev.read && <button onClick={() => markEvalRead(ev.id)} style={{ ...s.btnGhost, padding: "4px 10px", fontSize: 12 }}>Mark read</button>}
                        </div>
                      </div>
                      {ev.type === "quick" && (
                        <p style={{ color: text, fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ev.message}</p>
                      )}
                      {ev.type === "survey" && ev.responses && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {SURVEY_QUESTIONS.map(q => (
                            <div key={q.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                              <span style={{ ...s.badge(TEAL), minWidth: 110, textAlign: "center", flexShrink: 0, fontSize: 11 }}>{LIKERT_LABELS[ev.responses[q.id]] || "-"}</span>
                              <span style={{ color: text, fontSize: 13, lineHeight: 1.5 }}>{q.text}</span>
                            </div>
                          ))}
                          {ev.openEnded && (ev.openEnded.suggestions || ev.openEnded.assignment || ev.openEnded.best) && (
                            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                              {ev.openEnded.suggestions && <div><p style={{ ...s.muted, fontSize: 11, margin: "0 0 2px" }}>Suggestions to improve:</p><p style={{ color: text, fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ev.openEnded.suggestions}</p></div>}
                              {ev.openEnded.assignment && <div><p style={{ ...s.muted, fontSize: 11, margin: "0 0 2px" }}>Most helpful assignment:</p><p style={{ color: text, fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ev.openEnded.assignment}</p></div>}
                              {ev.openEnded.best && <div><p style={{ ...s.muted, fontSize: 11, margin: "0 0 2px" }}>Liked best:</p><p style={{ color: text, fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ev.openEnded.best}</p></div>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        {/* Same viewer the student portal renders, so clicking a page item's title in the
            Modules editor shows the page exactly as students read it (the ⋮ → Edit route
            shows the editor instead, which is a different thing). */}
        {viewingPage && <PageViewer title={viewingPage.title} content={viewingPage.content} onClose={() => setViewingPage(null)} />}
      </Shell>
      </ThemeContext.Provider>
    );
  }

  return null;
}
