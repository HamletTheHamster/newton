import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";

import { s, BG, CARD, TEAL, TEAL_DIM, MUTED, BORDER } from "./theme.js";
import { fbGet, fbSet, fbConnectTest, FIREBASE, classPath, slugifyClassId, uniqueClassId, fbUpload, fbDeleteStorage } from "./firebase.js";
import { makeHash, verifyPw, verifyTotp, genTotpSecret, genDeviceToken, hashToken } from "./auth.js";
import {
  ACCEPTED_IMG,
  dueToDate, fmtDueTime, isLate, fmtDate, ptsPer, detectParts,
  compressImage, checkImageReadability, evaluateAnswer,
  parseRoster,
} from "./utils.js";
import { COURSE_LABELS, COURSE_OPTIONS, quizzesForCourse, defaultModulesForCourse } from "./courses/index.js";
import { buildModules } from "./courses/merge.js";
import { migrateLegacyModuleConfig } from "./courses/migrate.js";
import { newId } from "./courses/ids.js";

import { SyncBadge } from "./components/SyncBadge.jsx";
import { ChatMessages } from "./components/ChatMessages.jsx";
import { DragDropQuestion } from "./components/DragDropQuestion.jsx";
import { ManualAddStudent } from "./components/ManualAddStudent.jsx";
import { BugReportModal } from "./components/BugReportModal.jsx";
import { Footer } from "./components/Footer.jsx";
import { Shell } from "./components/lms/Shell.jsx";
import { Sidebar } from "./components/lms/Sidebar.jsx";
import { TodoRail } from "./components/lms/TodoRail.jsx";
import { Home } from "./screens/student/Home.jsx";
import { Stub } from "./screens/student/Stub.jsx";
import { StudentSyllabus } from "./screens/student/StudentSyllabus.jsx";
import { InstructorSyllabus } from "./screens/instructor/InstructorSyllabus.jsx";
import { StudentAnnouncements } from "./screens/student/StudentAnnouncements.jsx";
import { StudentCalendar } from "./screens/student/StudentCalendar.jsx";
import { Modules as InstructorModules } from "./screens/instructor/Modules.jsx";
import { Announcements as InstructorAnnouncements } from "./screens/instructor/Announcements.jsx";
import { Gradebook } from "./screens/instructor/Gradebook.jsx";
import { StudentGrades } from "./screens/student/StudentGrades.jsx";
import { AnnouncementEditor } from "./components/lms/AnnouncementEditor.jsx";
import { PageEditor } from "./components/lms/PageEditor.jsx";
import { PageViewer } from "./components/lms/PageViewer.jsx";

// ── Grade category defaults ───────────────────────────────────────────────────
// Manual assignment ordering: module items occupy order = modIdx*100 + itemIdx.
// Module 7 HW lands at 603; Midterm at 650 slots it right after.
// Final at 1350 follows Module 14 HW (1303). Labs start at 2000.
function makeDefaultManualAssignments() {
  const labs = {};
  for (let w = 1; w <= 14; w++) {
    for (const s of ["a", "b"]) {
      const id = `asgn_lab${w}${s}`;
      labs[id] = { id, title: `Lab ${w}${s}`, catId: "cat_lab", maxPts: 10, order: 2000 + (w - 1) * 2 + (s === "a" ? 0 : 1) };
    }
  }
  return {
    asgn_midterm: { id: "asgn_midterm", title: "Midterm Exam", catId: "cat_midterm", maxPts: 10, order: 650 },
    asgn_final:   { id: "asgn_final",   title: "Final Exam",   catId: "cat_final",   maxPts: 10, order: 1350 },
    ...labs,
  };
}
const DEFAULT_MANUAL_ASSIGNMENTS = makeDefaultManualAssignments();

const DEFAULT_GRADE_CATEGORIES = {
  cat_lab:     { id: "cat_lab",     name: "Laboratory",   weight: 20, dropLowest: 1, order: 0 },
  cat_hw:      { id: "cat_hw",      name: "Homework",     weight: 20, dropLowest: 1, order: 1 },
  cat_quiz:    { id: "cat_quiz",    name: "Quiz",         weight: 10, dropLowest: 1, order: 2 },
  cat_midterm: { id: "cat_midterm", name: "Midterm Exam", weight: 20, dropLowest: 0, order: 3 },
  cat_final:   { id: "cat_final",   name: "Final Exam",   weight: 30, dropLowest: 0, order: 4 },
};

// ── Sidebar definitions ──────────────────────────────────────────────────────
const STUDENT_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
  { id: "syllabus", label: "Syllabus" },
  { id: "announcements", label: "Announcements" },
  { id: "grades", label: "Grades" },
  { id: "evals", label: "Course Evals" },
];

const INSTRUCTOR_SECTIONS = [
  { id: "modules",       label: "Home" },
  { id: "gradebook",    label: "Gradebook" },
  { id: "calendar",     label: "Calendar" },
  { id: "roster",       label: "Roster" },
  { id: "announcements", label: "Announcements" },
  { id: "syllabus",     label: "Syllabus" },
  { id: "settings",     label: "Settings" },
];

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
  const [checkedSubs, setCheckedSubs] = useState({});
  const [modules, setModules] = useState([]);
  const [moduleConfig, setModuleConfig] = useState({});
  const [pages, setPages] = useState({});
  const [uploads, setUploads] = useState({});
  const [syllabus, setSyllabus] = useState(null);          // { pdf, fields } or null
  const [announcements, setAnnouncements] = useState({});  // raw { [annId]: record }
  const [gradeCategories, setGradeCategories] = useState({});
  const [gradeOverrides, setGradeOverrides] = useState({});     // { [studentId]: { [assignmentId]: { score?, excused? } } }
  const [assignmentCategories, setAssignmentCategories] = useState({});  // { [assignmentId]: catId }
  const [manualAssignments, setManualAssignments] = useState({});         // { [id]: { id, title, catId, maxPts } }
  const [assignmentNameOverrides, setAssignmentNameOverrides] = useState({}); // { [assignmentId]: string }
  const [assignmentOrderOverrides, setAssignmentOrderOverrides] = useState({}); // { [assignmentId]: number }
  const [studentAvailableClasses, setStudentAvailableClasses] = useState([]);
  const [settings, setSettings] = useState({ passwordHash: null, passwordSalt: null });
  const [ready, setReady] = useState(false);
  const [classDataLoading, setClassDataLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
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
  const [editingAltName, setEditingAltName] = useState(null); const [altNameInput, setAltNameInput] = useState("");
  const [newPw1, setNewPw1] = useState(""); const [newPw2, setNewPw2] = useState(""); const [pwChangeMsg, setPwChangeMsg] = useState("");

  // ── Quiz state ──────────────────────────────────────────────────────────────
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [qIdx, setQIdx] = useState(0); const [apiHist, setApiHist] = useState([]);
  const [messages, setMessages] = useState([]); const [qScores, setQScores] = useState([]);
  const [input, setInput] = useState(""); const [pendingFile, setPendingFile] = useState(null);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [busy, setBusy] = useState(false); const [quizDone, setQuizDone] = useState(false); const [attemptCount, setAttemptCount] = useState(0); const [completedParts, setCompletedParts] = useState([]);
  const [subSaveError, setSubSaveError] = useState(false); const [pendingSub, setPendingSub] = useState(null);

  // ── Instructor state ────────────────────────────────────────────────────────
  const [instPw, setInstPw] = useState(""); const [instErr, setInstErr] = useState("");
  const [instLoginStep, setInstLoginStep] = useState("password");
  const [totpInput, setTotpInput] = useState(""); const [totpErr, setTotpErr] = useState(""); const [rememberDevice, setRememberDevice] = useState(false);
  const [totpSetupState, setTotpSetupState] = useState(null); const [totpSetupCode, setTotpSetupCode] = useState(""); const [totpSetupErr, setTotpSetupErr] = useState("");
  const [clearDevicesMsg, setClearDevicesMsg] = useState("");
  const [editPw, setEditPw] = useState(""); const [editPw2, setEditPw2] = useState(""); const [editPwMsg, setEditPwMsg] = useState("");
  const [openQuizzes, setOpenQuizzes] = useState({});
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerPw, setDangerPw] = useState(""); const [dangerErr, setDangerErr] = useState("");
  const [removeStudent, setRemoveStudent] = useState(null);
  const [removePw, setRemovePw] = useState(""); const [removeErr, setRemoveErr] = useState("");
  const [viewingSub, setViewingSub] = useState(null);
  const [backupModal, setBackupModal] = useState(null);
  const [rosterMsg, setRosterMsg] = useState(""); const [backupMsg, setBackupMsg] = useState("");
  const [newClassName, setNewClassName] = useState(""); const [newClassCourse, setNewClassCourse] = useState(COURSE_OPTIONS[0]?.value || "physics1"); const [newClassMsg, setNewClassMsg] = useState("");
  const [editingClassId, setEditingClassId] = useState(null); const [editingClassNameInput, setEditingClassNameInput] = useState("");
  const [bugReports, setBugReports] = useState({});
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [instBugHover, setInstBugHover] = useState(false);
  const [viewingPage, setViewingPage] = useState(null);     // { title, content } for student PageViewer
  const [editingPage, setEditingPage] = useState(null);     // { moduleId, itemId?, pageId?, title, content }
  const [editingAnn, setEditingAnn] = useState(null);       // null | { annId?, title, body, createdAt? }

  const chatRef = useRef(null); const detailRef = useRef(null); const inputRef = useRef(null);
  const fileInputRef = useRef(null); const rosterInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const syncTimer = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const courseQuizzes = quizzesForCourse(classMeta?.courseType);
  const quizzes = courseQuizzes.map(q => ({ ...q, dueDate: dueDates[q.id] || null }));
  const mergedModules = buildModules(modules, moduleConfig, pages, uploads);
  const currentQ = activeQuiz?.questions[qIdx];
  const isImageQ = !!currentQ?.requiresImage, isYesNoQ = !!currentQ?.yesNo, isDragDropQ = !!currentQ?.dragDrop;
  const currentParts = currentQ && !isYesNoQ && !isDragDropQ ? detectParts(currentQ.text) : null;
  const completedQuizIds = new Set(submissions.filter(s => s.studentId === loggedInStudent?.studentId).map(s => s.quizId));
  const sortedAnnouncements = Object.values(announcements).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Flattened student search across all active classes (used on the student-search screen).
  const allActiveStudents = [];
  for (const [cid, c] of Object.entries(classes)) {
    if (!c?.metadata?.active) continue;
    const className = c.metadata.name;
    const r = Array.isArray(c.roster) ? c.roster : [];
    for (const stu of r) allActiveStudents.push({ ...stu, classId: cid, className });
  }
  const seenStudentIds = new Set();
  const filteredRoster = nameQuery.trim().length === 0 ? [] : allActiveStudents.filter(st => {
    const q = nameQuery.toLowerCase();
    const matches = (st.altName && st.altName.toLowerCase().includes(q)) || st.fullName.toLowerCase().includes(q) || st.lastName.toLowerCase().includes(q) || st.firstName.toLowerCase().includes(q);
    if (!matches || seenStudentIds.has(st.studentId)) return false;
    seenStudentIds.add(st.studentId);
    return true;
  }).slice(0, 8);

  const unreadBugCount = Object.values(bugReports).filter(b => !b.read).length;

  // ── To Do (quizzes due in next 7 days, not yet completed) ──────────────────
  const todoItems = (() => {
    if (!loggedInStudent) return [];
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return quizzes
      .filter(q => q.dueDate && !completedQuizIds.has(q.id))
      .map(q => ({ q, due: dueToDate(q.dueDate) }))
      .filter(({ due }) => due && due >= now && due <= horizon)
      .sort((a, b) => a.due - b.due)
      .map(({ q }) => ({ id: q.id, title: q.title, due: q.dueDate, kind: "quiz", onClick: () => startQuiz(q, false) }));
  })();

  // ── Load from Firebase on startup ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await fbConnectTest();
        setFbConnStatus('ok');
      } catch (e) {
        setFbConnStatus('error');
        setFbConnError(e.message || String(e));
        setReady(true);
        return;
      }
      try {
        const [classesData, settingsData, bugsData] = await Promise.all([
          fbGet('classes').catch(() => null),
          fbGet('settings').catch(() => null),
          fbGet('bugReports').catch(() => null),
        ]);
        const loadedClasses = (classesData && typeof classesData === 'object') ? classesData : {};
        setClasses(loadedClasses);
        if (settingsData?.passwordHash) {
          setSettings(settingsData);
        } else {
          const h = await makeHash("physics123");
          const ns = { passwordHash: h.hash, passwordSalt: h.salt };
          setSettings(ns);
          await fbSet('settings', ns);
        }
        if (bugsData && typeof bugsData === 'object') setBugReports(bugsData);
        const storedId = (() => { try { return localStorage.getItem("newton_current_class_id"); } catch { return null; } })();
        if (storedId && loadedClasses[storedId]) {
          const c = loadedClasses[storedId];
          if (Array.isArray(c.roster)) setRoster(c.roster);
          if (c.studentPws && typeof c.studentPws === 'object') setStudentPws(c.studentPws);
          if (c.dueDates && typeof c.dueDates === 'object') setDueDates(c.dueDates);
          if (c.checkedSubs && typeof c.checkedSubs === 'object') setCheckedSubs(c.checkedSubs);
          if (c.submissions && typeof c.submissions === 'object') {
            const allSubs = Object.values(c.submissions).flat().filter(Boolean);
            setSubmissions(allSubs);
          }
          if (c.moduleConfig && typeof c.moduleConfig === 'object') setModuleConfig(c.moduleConfig);
          if (c.pages && typeof c.pages === 'object') setPages(c.pages);
          if (c.uploads && typeof c.uploads === 'object') setUploads(c.uploads);
          if (c.syllabus) setSyllabus(c.syllabus);
          if (Array.isArray(c.modules)) setModules(c.modules);
          if (c.announcements && typeof c.announcements === 'object') setAnnouncements(c.announcements);
          if (c.gradeCategories && typeof c.gradeCategories === 'object') setGradeCategories(c.gradeCategories);
          else setGradeCategories(DEFAULT_GRADE_CATEGORIES);
          if (c.gradeOverrides && typeof c.gradeOverrides === 'object') setGradeOverrides(c.gradeOverrides);
          if (c.assignmentCategories && typeof c.assignmentCategories === 'object') setAssignmentCategories(c.assignmentCategories);
        } else if (storedId) {
          setCurrentClassId(null);
        }
      } catch (e) { console.error("Startup load error:", e); }
      setReady(true);
    })();
  }, []);

  // ── Load a class's full per-class data into state ──────────────────────────
  const loadClassData = async classId => {
    if (!classId) return;
    setClassDataLoading(true);
    try {
      const [rosterData, pwsData, datesData, checkedData, subsData, modulesData, moduleConfigData, pagesData, uploadsData, annsData, gradeCatsData, gradeOverridesData, assignmentCatsData, manualAsgnData, nameOverrideData, orderOverrideData, syllabusData] = await Promise.all([
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
      ]);
      const rosterArr = Array.isArray(rosterData) ? rosterData : [];
      const pwsObj = (pwsData && typeof pwsData === 'object') ? pwsData : {};
      const datesObj = (datesData && typeof datesData === 'object') ? datesData : {};
      const checkedObj = (checkedData && typeof checkedData === 'object') ? checkedData : {};
      const subsArr = (subsData && typeof subsData === 'object') ? Object.values(subsData).flat().filter(Boolean) : [];
      let moduleConfigObj = (moduleConfigData && typeof moduleConfigData === 'object') ? moduleConfigData : {};
      const pagesObj = (pagesData && typeof pagesData === 'object') ? pagesData : {};
      const uploadsObj = (uploadsData && typeof uploadsData === 'object') ? uploadsData : {};
      const annsObj = (annsData && typeof annsData === 'object') ? annsData : {};

      // Grade data — seed default categories on first class load
      let gradeCatsObj = (gradeCatsData && typeof gradeCatsData === 'object') ? gradeCatsData : {};
      if (Object.keys(gradeCatsObj).length === 0) {
        gradeCatsObj = { ...DEFAULT_GRADE_CATEGORIES };
        try { await fbSet(classPath(classId, 'gradeCategories'), gradeCatsObj); } catch (e) { console.warn("Grade category seed failed:", e?.message); }
      }
      const gradeOverridesObj = (gradeOverridesData && typeof gradeOverridesData === 'object') ? gradeOverridesData : {};
      const assignmentCatsObj = (assignmentCatsData && typeof assignmentCatsData === 'object') ? assignmentCatsData : {};
      let manualAsgnObj = (manualAsgnData && typeof manualAsgnData === 'object') ? manualAsgnData : {};
      if (Object.keys(manualAsgnObj).length === 0) {
        manualAsgnObj = { ...DEFAULT_MANUAL_ASSIGNMENTS };
        try { await fbSet(classPath(classId, 'manualAssignments'), manualAsgnObj); } catch (e) { console.warn("Manual assignment seed failed:", e?.message); }
      }
      const nameOverrideObj = (nameOverrideData && typeof nameOverrideData === 'object') ? nameOverrideData : {};
      const orderOverrideObj = (orderOverrideData && typeof orderOverrideData === 'object') ? orderOverrideData : {};

      // Auto-migrate / seed `modules` on first load. Idempotent: presence of the
      // array in RTDB is the sentinel.
      let modulesArr = Array.isArray(modulesData) ? modulesData : null;
      if (modulesArr === null) {
        const meta = classes[classId]?.metadata;
        const template = defaultModulesForCourse(meta?.courseType);
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

      setRoster(rosterArr);
      setStudentPws(pwsObj);
      setDueDates(datesObj);
      setCheckedSubs(checkedObj);
      setSubmissions(subsArr);
      setModules(modulesArr);
      setModuleConfig(moduleConfigObj);
      setPages(pagesObj);
      setUploads(uploadsObj);
      setSyllabus(syllabusObj);
      setAnnouncements(annsObj);
      setGradeCategories(gradeCatsObj);
      setGradeOverrides(gradeOverridesObj);
      setAssignmentCategories(assignmentCatsObj);
      setManualAssignments(manualAsgnObj);
      setAssignmentNameOverrides(nameOverrideObj);
      setAssignmentOrderOverrides(orderOverrideObj);
      setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), roster: rosterArr, studentPws: pwsObj, dueDates: datesObj, checkedSubs: checkedObj, submissions: subsData || {}, modules: modulesArr, moduleConfig: moduleConfigObj, pages: pagesObj, uploads: uploadsObj, syllabus: syllabusObj, announcements: annsObj, gradeCategories: gradeCatsObj, gradeOverrides: gradeOverridesObj, assignmentCategories: assignmentCatsObj } }));
    } finally { setClassDataLoading(false); }
  };

  // ── Scroll / focus ──────────────────────────────────────────────────────────
  const doScroll = useCallback(() => { const el = chatRef.current; if (!el) return; el.scrollTop = el.scrollHeight - el.clientHeight; }, []);
  useLayoutEffect(() => { doScroll(); }, [messages]);
  useLayoutEffect(() => { doScroll(); }, [busy]);
  useEffect(() => { if (screen === "quiz" && !isYesNoQ && !isDragDropQ && !quizDone) requestAnimationFrame(() => inputRef.current?.focus()); }, [qIdx, screen, quizDone]);
  const navStateRef = useRef({ screen, quizDone, showStudentSettings });
  useEffect(() => { navStateRef.current = { screen, quizDone, showStudentSettings }; }, [screen, quizDone, showStudentSettings]);
  useEffect(() => {
    const go = next => { navStateRef.current = { ...navStateRef.current, screen: next, showStudentSettings: false }; setScreen(next); };
    const onPop = () => {
      const { screen, quizDone, showStudentSettings } = navStateRef.current;
      if (screen === "quiz") { history.pushState({ newton: "quiz" }, "", ""); quizDone ? go("student-portal") : setShowLeaveConfirm(true); }
      else if (showStudentSettings) { history.pushState({ newton: "settings" }, "", ""); navStateRef.current = { ...navStateRef.current, showStudentSettings: false }; setShowStudentSettings(false); setNewPw1(""); setNewPw2(""); setPwChangeMsg(""); }
      else if (screen === "inst-sub-detail") { history.pushState({ newton: "inst-sub-detail" }, "", ""); go("instructor"); setViewingSub(null); }
      else if (screen === "student-pw") { history.pushState({ newton: "student-pw" }, "", ""); setSelectedStudent(null); go("student-search"); }
      else if (screen === "inst-login") { history.pushState({ newton: "inst-login" }, "", ""); go("student-search"); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy && screen === "quiz" && !isYesNoQ && !isDragDropQ && !quizDone) requestAnimationFrame(() => inputRef.current?.focus());
    prevBusy.current = busy;
  }, [busy]);

  // ── Firebase save helper ───────────────────────────────────────────────────
  const fbSave = async (path, data) => {
    setSyncStatus('saving'); setSyncError('');
    clearTimeout(syncTimer.current);
    try {
      await fbSet(path, data);
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
    if (!currentClassId) throw new Error("No class selected — cannot save.");
    return currentClassId;
  };
  const updateClassCache = (classId, key, value) => {
    setClasses(prev => ({ ...prev, [classId]: { ...(prev[classId] || {}), [key]: value } }));
  };
  const saveRoster = async r => { const cid = requireClass(); setRoster(r); updateClassCache(cid, 'roster', r); await fbSave(classPath(cid, 'roster'), r); };
  const saveAltName = async stu => { const val = altNameInput.trim(); const updated = roster.map(r => r.studentId === stu.studentId ? { ...r, altName: val || undefined } : r); await saveRoster(updated); setEditingAltName(null); };
  const saveStudentPws = async p => { const cid = requireClass(); setStudentPws(p); updateClassCache(cid, 'studentPws', p); await fbSave(classPath(cid, 'studentPws'), p); };
  const saveDueDates = async d => { const cid = requireClass(); setDueDates(d); updateClassCache(cid, 'dueDates', d); await fbSave(classPath(cid, 'dueDates'), d); };
  const saveSettings = async ns => { setSettings(ns); await fbSave('settings', ns); };
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

  const saveAnnouncement = async (ann) => {
    const cid = requireClass();
    const now = new Date().toISOString();
    const annId = ann.id || newId("ann");
    const record = { id: annId, title: ann.title.trim(), body: ann.body, createdAt: ann.createdAt || now, ...(ann.id ? { updatedAt: now } : {}) };
    const updated = { ...announcements, [annId]: record };
    setAnnouncements(updated);
    updateClassCache(cid, 'announcements', updated);
    await fbSave(classPath(cid, `announcements/${annId}`), record);
  };
  const deleteAnnouncement = async (annId) => {
    const cid = requireClass();
    const updated = { ...announcements }; delete updated[annId];
    setAnnouncements(updated);
    updateClassCache(cid, 'announcements', updated);
    await fbSave(classPath(cid, `announcements/${annId}`), null);
  };
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
    await fbSave(classPath(cid, 'manualAssignments'), Object.keys(next).length ? next : null);
  };
  const saveAssignmentNameOverrides = async next => {
    const cid = requireClass();
    setAssignmentNameOverrides(next);
    await fbSave(classPath(cid, 'assignmentNameOverrides'), Object.keys(next).length ? next : null);
  };
  const saveAssignmentOrderOverrides = async next => {
    const cid = requireClass();
    setAssignmentOrderOverrides(next);
    await fbSave(classPath(cid, 'assignmentOrderOverrides'), Object.keys(next).length ? next : null);
  };
  const saveOverrideForStudent = async (studentId, studentOverrides) => {
    const cid = requireClass();
    const updated = { ...gradeOverrides, [studentId]: studentOverrides };
    setGradeOverrides(updated);
    updateClassCache(cid, 'gradeOverrides', updated);
    await fbSave(classPath(cid, `gradeOverrides/${studentId}`), studentOverrides);
  };

  const saveSubs = async (newSubs, studentId = null) => {
    const cid = requireClass();
    setSubmissions(newSubs);
    const byStudent = {};
    newSubs.forEach(sub => { if (!byStudent[sub.studentId]) byStudent[sub.studentId] = []; byStudent[sub.studentId].push(sub); });
    updateClassCache(cid, 'submissions', byStudent);
    if (studentId) {
      await fbSave(classPath(cid, `submissions/${studentId}`), byStudent[studentId] || []);
    } else {
      await fbSave(classPath(cid, 'submissions'), byStudent);
    }
  };

  // ── Class management ──────────────────────────────────────────────────────
  const switchToClass = async classId => {
    if (!classId || classId === currentClassId) return;
    setCurrentClassId(classId);
    setActiveQuiz(null); setMessages([]); setQScores([]); setQIdx(0);
    setLoggedInStudent(null); setSelectedStudent(null); setNameQuery("");
    setOpenQuizzes({}); setViewingSub(null);
    setAnnouncements({});
    setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({});
    await loadClassData(classId);
  };
  const switchStudentClass = async (classId, student) => {
    if (!classId || classId === currentClassId) return;
    setCurrentClassId(classId);
    setActiveQuiz(null); setMessages([]); setQScores([]); setQIdx(0);
    setOpenQuizzes({}); setViewingSub(null);
    setAnnouncements({});
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
      setModules([]); setModuleConfig({}); setPages({}); setUploads({});
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
        if (data.settings) await saveSettings(data.settings);
        if (data.roster) await saveRoster(data.roster);
        if (data.studentPws) await saveStudentPws(data.studentPws);
        if (data.dueDates) await saveDueDates(data.dueDates);
        if (data.checkedSubs) await saveChecked(data.checkedSubs);
        if (data.submissions) await saveSubs(data.submissions);
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
    if (!stored) { ok = pwInput === selectedStudent.studentId; if (ok) { const h = await makeHash(pwInput); await saveStudentPws({ ...studentPws, [selectedStudent.studentId]: h }); } }
    else if (typeof stored === "string") { ok = pwInput === stored; if (ok) { const h = await makeHash(pwInput); await saveStudentPws({ ...studentPws, [selectedStudent.studentId]: h }); } }
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
    const h = await makeHash(newPw1); await saveStudentPws({ ...studentPws, [loggedInStudent.studentId]: h });
    setNewPw1(""); setNewPw2(""); setPwChangeMsg("✅ Password updated successfully!");
  };
  const handleStudentLogout = () => {
    setLoggedInStudent(null); setSelectedStudent(null); setNameQuery(""); setShowStudentSettings(false);
    setStudentAvailableClasses([]);
    setCurrentClassId(null);
    setRoster([]); setStudentPws({}); setDueDates({}); setCheckedSubs({}); setSubmissions([]);
    setModules([]); setModuleConfig({}); setPages({}); setUploads({});
    setAnnouncements({});
    setGradeCategories({}); setGradeOverrides({}); setAssignmentCategories({});
    setScreen("student-search");
  };
  const enterInstructor = async () => {
    const cur = currentClassId ? classes[currentClassId] : null;
    if (!cur || cur?.metadata?.active === false) {
      const firstActive = Object.entries(classes).filter(([, c]) => c?.metadata?.active !== false).sort((a, b) => (a[1]?.metadata?.name || "").localeCompare(b[1]?.metadata?.name || ""))[0];
      if (firstActive) await switchToClass(firstActive[0]);
    }
    setInstructorSection("gradebook");
    setScreen("instructor");
  };
  const doLogin = async () => {
    if (!settings.passwordHash) { setInstErr("Settings still loading."); return; }
    const ok = await verifyPw(instPw, settings.passwordHash, settings.passwordSalt);
    if (!ok) { setInstErr("Incorrect password."); return; }
    if (!settings.totpSecret) { setInstErr(""); setEditPw(""); await enterInstructor(); return; }
    const deviceToken = localStorage.getItem('newton_device_token');
    if (deviceToken) { const tokenHash = await hashToken(deviceToken); if (settings.trustedDevices?.[tokenHash]) { setInstErr(""); setEditPw(""); await enterInstructor(); return; } }
    setInstErr(""); setTotpInput(""); setTotpErr(""); setInstLoginStep("totp");
  };
  const doTotpVerify = async () => {
    const code = totpInput.trim();
    if (!/^\d{6}$/.test(code)) { setTotpErr("Enter the 6-digit code."); return; }
    const valid = await verifyTotp(settings.totpSecret, code);
    if (!valid) { setTotpErr("Incorrect code. Try again."); setTotpInput(""); return; }
    if (rememberDevice) {
      const token = genDeviceToken(); const tokenHash = await hashToken(token);
      localStorage.setItem('newton_device_token', token);
      await saveSettings({ ...settings, trustedDevices: { ...(settings.trustedDevices || {}), [tokenHash]: { created: new Date().toISOString() } } });
    }
    setTotpErr(""); setTotpInput(""); setInstLoginStep("password"); setRememberDevice(false); await enterInstructor();
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
    await saveSettings({ ...settings, totpSecret: totpSetupState.secret });
    setTotpSetupState(null); setTotpSetupCode(""); setTotpSetupErr("");
  };
  const disableTotp = () => {
    confirmDanger("disable two-factor authentication", async () => {
      await saveSettings({ ...settings, totpSecret: null, trustedDevices: {} });
      localStorage.removeItem('newton_device_token');
    });
  };
  const clearTrustedDevices = async () => {
    await saveSettings({ ...settings, trustedDevices: {} });
    localStorage.removeItem('newton_device_token');
    setClearDevicesMsg("✅ All trusted devices cleared."); setTimeout(() => setClearDevicesMsg(""), 3000);
  };
  const markBugRead = async id => {
    const updated = { ...bugReports, [id]: { ...bugReports[id], read: true } };
    setBugReports(updated);
    await fbSet('bugReports', updated);
  };
  const confirmDanger = (label, onConfirm) => { setDangerAction({ label, onConfirm }); setDangerPw(""); setDangerErr(""); };
  const executeDanger = async () => {
    if (!settings.passwordHash) { setDangerErr("Settings not loaded."); return; }
    const ok = await verifyPw(dangerPw, settings.passwordHash, settings.passwordSalt);
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
  const startQuiz = (quiz, isPractice = false) => {
    setPracticeMode(isPractice); setActiveQuiz(quiz); setQIdx(0); setApiHist([]); setAttemptCount(0); setCompletedParts([]);
    setQScores(new Array(quiz.questions.length).fill(null));
    setQuizDone(false); setInput(""); setPendingFile(null); setBusy(false); setShowLeaveConfirm(false); setSubSaveError(false); setPendingSub(null);
    const late = isLate(quiz.dueDate);
    setMessages([
      { id: 0, type: "system", text: (isPractice ? "Practice Mode — this run will not be submitted for a grade\n\n" : "") + "📚 " + quiz.title + "  •  " + (loggedInStudent.altName || loggedInStudent.fullName) + (late && !isPractice ? "\n\n⚠️ This quiz is past the due date. Your score will be halved." : "") },
      { id: 1, type: "question", q: quiz.questions[0], num: 1, total: quiz.questions.length, pts: ptsPer(quiz.questions.length)[0] },
    ]);
    setScreen("quiz");
    history.pushState({ newton: "quiz" }, "", "");
  };
  const handleLeaveQuiz = () => { if (quizDone && !subSaveError) { setScreen("student-portal"); return; } if (!quizDone) setShowLeaveConfirm(true); };
  const confirmLeave = () => { setShowLeaveConfirm(false); setScreen("student-portal"); };
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
    const pts = ptsPer(activeQuiz.questions.length), qPts = pts[qIdx];
    const reply = answer ? "Great — glad you're all set! Make sure to keep it handy throughout the semester." : "No worries — please contact your instructor as soon as possible to get access sorted out.";
    const nScores = [...qScores]; nScores[qIdx] = qPts; setQScores(nScores);
    const newMsgs = [...messages, { id: Date.now(), type: "student", text: answer ? "Yes" : "No" }, { id: Date.now() + 1, type: "tutor", text: "✅ " + reply, correct: true }];
    await advanceOrFinish(activeQuiz, nScores, newMsgs, qIdx + 1); setBusy(false);
  };
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
      setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: blanks[0] === "vector" && blanks[1] === "scalar" ? "Those are swapped — think about which operation gives a single number (like work = F·d) and which gives a new vector (like torque = r×F)." : "Not quite. Consider: work is calculated using a dot product and gives a single number — what does that tell you about the type of quantity it produces?" }]);
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
    } catch { setMessages([...newMsgs, { id: Date.now() + 1, type: "tutor", text: "⚠️ Error evaluating your answer. Please try again." }]); }
    setBusy(false);
  };
  const finishQuiz = async (quiz, scores, curMsgs) => {
    const raw = scores.reduce((a, b) => a + (b || 0), 0), late = isLate(quiz.dueDate);
    const final = late ? parseFloat((raw * 0.5).toFixed(1)) : raw;
    const resultMsg = { id: Date.now() + 10, type: "result", raw, final, late, scores, questions: quiz.questions, pts: ptsPer(quiz.questions.length), practiceMode };
    setQuizDone(true); setMessages([...curMsgs, resultMsg]);
    if (!practiceMode) {
      const sub = { id: "sub_" + Date.now(), studentName: loggedInStudent.fullName, studentId: loggedInStudent.studentId, quizId: quiz.id, quizTitle: quiz.title, rawScore: raw, score: final, late, timestamp: new Date().toISOString(), dialogue: [...curMsgs, resultMsg].map(({ imageUrl, ...m }) => m) };
      setPendingSub({ sub, allSubs: [...submissions, sub], studentId: sub.studentId });
      try { await saveSubs([...submissions, sub], sub.studentId); setSubSaveError(false); setPendingSub(null); }
      catch { setSubSaveError(true); }
    }
  };

  const retrySaveSub = async () => {
    if (!pendingSub) return;
    try { await saveSubs(pendingSub.allSubs, pendingSub.studentId); setSubSaveError(false); setPendingSub(null); }
    catch { setSubSaveError(true); }
  };

  const toggleChecked = async subId => {
    const nc = { ...checkedSubs };
    if (nc[subId]) { delete nc[subId]; } else { nc[subId] = true; }
    await saveChecked(nc);
  };
  const toggleQuizOpen = qid => setOpenQuizzes(o => ({ ...o, [qid]: !o[qid] }));
  const onRosterUpload = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = async ev => { const parsed = parseRoster(ev.target.result); await saveRoster(parsed); setRosterMsg("✅ " + parsed.length + " students loaded."); }; r.readAsText(file); e.target.value = ""; };

  const handleSelectStudent = async st => {
    setSelectedStudent(st); setPwInput(""); setPwError(""); setNameQuery("");
    if (st.classId && st.classId !== currentClassId) {
      setCurrentClassId(st.classId);
      await loadClassData(st.classId);
    }
    setScreen("student-pw"); history.pushState({ newton: "student-pw" }, "", "");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!ready) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}><span style={{ color: TEAL, fontSize: 18 }}>Loading…</span><span style={{ color: MUTED, fontSize: 13 }}>Testing Firebase connection</span></div>;

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
  if (screen === "student-search") return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {bugModalJsx}
      <button onClick={() => { setScreen("inst-login"); history.pushState({ newton: "inst-login" }, "", ""); }} style={{ position: "fixed", top: 16, right: 16, background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>Instructor</button>
      <Footer onBugClick={() => setBugReportOpen(true)} />
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 72, fontWeight: 700, color: TEAL, margin: 0 }}>Newton</h1>
        </div>
        {allActiveStudents.length === 0 && <div style={{ background: "rgba(202,138,4,0.1)", border: "1px solid rgba(202,138,4,0.3)", borderRadius: 8, padding: "10px 14px", color: "#fde047", fontSize: 13, marginBottom: 16 }}>No classes are currently available. Please contact your instructor.</div>}
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
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#252627", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", zIndex: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {filteredRoster.map((st, i) => (
                <button key={st.studentId} onClick={() => handleSelectStudent(st)} style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: highlightIdx === i ? TEAL_DIM : "transparent", border: "none", borderBottom: `1px solid ${BORDER}`, color: highlightIdx === i ? TEAL : "#fff", fontSize: 14, cursor: "pointer", fontWeight: highlightIdx === i ? 600 : 400 }} onMouseEnter={() => setHighlightIdx(i)}>
                  {st.altName || st.fullName}
                </button>
              ))}
            </div>
          )}
          {nameQuery.trim().length > 0 && filteredRoster.length === 0 && allActiveStudents.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#252627", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", color: MUTED, fontSize: 13, zIndex: 10 }}>No matches found. Check your spelling.</div>
          )}
        </div>
      </div>
      {!import.meta.env.DEV && <p style={{ position: "fixed", bottom: 8, right: 12, fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0, textAlign: "right" }}>Protected by reCAPTCHA · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.2)" }}>Privacy</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.2)" }}>Terms</a></p>}
    </div>
  );

  // ── Student Password ──────────────────────────────────────────────────────
  if (screen === "student-pw" && selectedStudent) return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {bugModalJsx}
      <Footer onBugClick={() => setBugReportOpen(true)} />
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 72, fontWeight: 700, color: TEAL, margin: "0 0 8px" }}>Newton</h1>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: 0 }}>{selectedStudent.altName || selectedStudent.fullName}</p>
        </div>
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
  );

  // ── Student Portal (LMS-style) ────────────────────────────────────────────
  if (screen === "student-portal" && loggedInStudent) {
    if (showStudentSettings) return (
      <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", ...s.card, padding: 36 }}>
          <button onClick={() => { setShowStudentSettings(false); setNewPw1(""); setNewPw2(""); setPwChangeMsg(""); }} style={{ ...s.btnGhost, marginBottom: 24, width: "auto" }}>← Back to course</button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Account Settings</h2>
          <p style={{ ...s.muted, marginBottom: 28 }}>{loggedInStudent.fullName}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={s.label}>New Password</label><input type="password" style={s.input} placeholder="New password" value={newPw1} onChange={e => setNewPw1(e.target.value)} /></div>
            <div><label style={s.label}>Confirm New Password</label><input type="password" style={s.input} placeholder="Confirm password" value={newPw2} onChange={e => setNewPw2(e.target.value)} /></div>
            {pwChangeMsg && <p style={{ color: pwChangeMsg.startsWith("✅") ? "#4ade80" : "#f87171", fontSize: 13, margin: 0 }}>{pwChangeMsg}</p>}
            <button onClick={handleChangePassword} style={s.btnPri}>Update Password</button>
            <div style={{ borderTop: `1px solid rgba(255,255,255,0.08)`, paddingTop: 16 }}>
              <button onClick={handleStudentLogout} style={{ ...s.btnDanger, width: "100%" }}>Log Out</button>
            </div>
          </div>
        </div>
      </div>
    );

    const STUB_COPY = {
      syllabus: "A clean visual rendering of the course syllabus plus a PDF download.",
      evals: "Course evaluation forms when they open.",
    };
    const SECTION_TITLE = {
      syllabus: "Syllabus", evals: "Course Evals",
    };

    const handleStudentSectionSelect = id => {
      setStudentSection(id);
    };
    const studentSidebarItems = STUDENT_SECTIONS;

    const classPickerStyle = { appearance: "none", WebkitAppearance: "none", MozAppearance: "none", background: "transparent", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, padding: "0 22px 0 0", cursor: "pointer", outline: "none", textAlign: "center", textAlignLast: "center", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23a0a0a0' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" };

    const header = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ color: TEAL, fontWeight: 700, fontSize: 22, margin: 0 }}>Newton</h1>
          {studentAvailableClasses.length > 1 ? (
            <select
              value={currentClassId || ""}
              onChange={e => { if (e.target.value) switchStudentClass(e.target.value); }}
              style={classPickerStyle}
            >
              {studentAvailableClasses.map(({ classId, name }) => (
                <option key={classId} value={classId} style={{ background: "#252627", color: "#fff" }}>{name}</option>
              ))}
            </select>
          ) : (
            classMeta && <span style={{ ...s.muted, fontSize: 14 }}>· {classMeta.name}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { setShowStudentSettings(true); history.pushState({ newton: "settings" }, "", ""); }} style={{ ...s.btnGhost, width: "auto", padding: "6px 14px", fontSize: 13 }}>Settings</button>
        </div>
      </>
    );

    let mainContent;
    if (studentSection === "home") {
      mainContent = <Home loggedInStudent={loggedInStudent} modules={mergedModules} quizzes={quizzes} submissions={submissions} onStartQuiz={q => startQuiz(q, completedQuizIds.has(q.id))} onOpenPage={p => setViewingPage({ title: p.title, content: p.pageContent || "" })} />;
    } else if (studentSection === "announcements") {
      mainContent = <StudentAnnouncements announcements={sortedAnnouncements} />;
    } else if (studentSection === "calendar") {
      mainContent = <StudentCalendar quizzes={quizzes} completedQuizIds={completedQuizIds} />;
    } else if (studentSection === "grades") {
      mainContent = <StudentGrades loggedInStudent={loggedInStudent} modules={mergedModules} quizzes={quizzes} submissions={submissions} gradeCategories={gradeCategories} gradeOverrides={gradeOverrides} assignmentCategories={assignmentCategories} assignmentNameOverrides={assignmentNameOverrides} />;
    } else if (studentSection === "syllabus") {
      mainContent = <StudentSyllabus syllabus={syllabus} />;
    } else {
      mainContent = <Stub title={SECTION_TITLE[studentSection]} description={STUB_COPY[studentSection]} />;
    }

    return (
      <>
        {bugModalJsx}
        {viewingPage && <PageViewer title={viewingPage.title} content={viewingPage.content} onClose={() => setViewingPage(null)} />}
        <Shell
          header={header}
          sidebar={<Sidebar items={studentSidebarItems} activeId={studentSection} onSelect={handleStudentSectionSelect} />}
          rightRail={<TodoRail items={todoItems} />}
        >
          {mainContent}
        </Shell>
      </>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  if (screen === "quiz") return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
      {showLeaveConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...s.card, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Leave quiz?</h3>
            <p style={{ ...s.muted, marginBottom: 20 }}>Your progress will be lost and this attempt will not be saved.</p>
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
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>{activeQuiz?.title}{practiceMode && <span style={s.badge(TEAL)}>Practice</span>}</div>
            <p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{loggedInStudent?.fullName}</p>
          </div>
        </div>
        {!quizDone && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <div style={{ ...s.muted, fontFamily: "monospace" }}>Q{qIdx + 1}/{activeQuiz?.questions.length}</div>
            {currentParts && completedParts.length > 0 && <div style={{ color: TEAL, fontFamily: "monospace", fontSize: 11 }}>Part{completedParts.length > 1 ? "s" : ""} {completedParts.join(", ")} done · {currentParts.filter(p => !completedParts.includes(p)).join(", ")} remaining</div>}
            {!isYesNoQ && !isDragDropQ && <div style={{ ...s.muted, fontFamily: "monospace", fontSize: 11 }}>{Math.max(0, 5 - attemptCount)} attempt{Math.max(0, 5 - attemptCount) !== 1 ? "s" : ""} left</div>}
          </div>
        )}
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <ChatMessages messages={messages} busy={busy} />
        {quizDone && subSaveError && (
          <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 12, padding: "16px 20px", marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14, margin: 0 }}>⚠️ Your submission could not be saved</p>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>There was a network or server error. Please check your internet connection and tap Retry. If it keeps failing, contact your instructor and show them this screen.</p>
            <button onClick={retrySaveSub} style={{ ...s.btnPri, background: "#b91c1c", border: "1px solid #f87171" }}>Retry saving submission</button>
          </div>
        )}
        {quizDone && <button onClick={() => setScreen("student-portal")} style={{ ...s.btnPri, marginTop: 8 }}>Back to Course</button>}
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
            ) : (
              <>
                {pendingFile && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, ...s.card, padding: 12 }}>
                      <img src={pendingFile.previewUrl} alt="Preview" style={{ height: 72, width: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fff", fontSize: 12, fontWeight: 500, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.file.name}</p>
                        <p style={{ ...s.muted, fontSize: 12, margin: "0 0 4px" }}>{(pendingFile.file.size / 1024).toFixed(1)} KB</p>
                        {pendingFile.readability === "checking" && <p style={{ color: TEAL, fontSize: 12, margin: 0 }}>🔍 Checking image quality…</p>}
                        {pendingFile.readability === "ok" && <p style={{ color: "#4ade80", fontSize: 12, margin: 0 }}>✓ Image looks clear and readable</p>}
                        {pendingFile.readability?.status === "fail" && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ {pendingFile.readability.reason}</p>}
                      </div>
                      <button onClick={clearFile} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                    {pendingFile.readability?.status === "fail" && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>Please retake the photo and re-upload. Tips: make sure the drawing is well-lit, hold the camera steady, and ensure the full page is visible.</div>}
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
                      placeholder={isImageQ ? "Upload your drawing above, and optionally add a note…" : "Type your answer… (Enter to submit, Shift+Enter for new line)"}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      rows={2}
                      disabled={busy}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(); } }}
                      onPaste={e => { e.preventDefault(); setPasteWarning(true); setTimeout(() => setPasteWarning(false), 3000); }}
                    />
                    {pasteWarning && <p style={{ color: "#f87171", fontSize: 12, margin: 0, textAlign: "center" }}>⚠️ Pasting is not allowed — please type your answer.</p>}
                  </div>
                  <button onClick={submitAnswer} disabled={busy || pendingFile?.readability === "checking" || pendingFile?.readability?.status === "fail" || (isImageQ ? (!pendingFile && !input.trim()) : !input.trim())} style={{ ...s.btnPri, width: "auto", padding: "0 20px", alignSelf: "stretch", opacity: (busy || pendingFile?.readability === "checking" || pendingFile?.readability?.status === "fail" || (isImageQ ? (!pendingFile && !input.trim()) : !input.trim())) ? 0.4 : 1 }}>Send</button>
                </div>
                {isImageQ && !pendingFile && <p style={{ ...s.muted, fontSize: 12, textAlign: "center", margin: 0 }}>Click the 🖼 button to upload your drawing</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Instructor Login ──────────────────────────────────────────────────────
  if (screen === "inst-login") return (
    <div style={{ ...s.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Footer />
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 72, fontWeight: 700, color: TEAL, margin: 0 }}>Newton</h1>
        </div>
        {instLoginStep === "password" ? (
          <>
            <input type="password" style={{ ...s.input, marginBottom: 10 }} placeholder="Instructor password…" value={instPw} onChange={e => setInstPw(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} autoFocus />
            {instErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{instErr}</p>}
            <button onClick={doLogin} style={s.btnPri}>Login</button>
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
  );

  // ── Instructor Submission Detail ──────────────────────────────────────────
  if (screen === "inst-sub-detail" && viewingSub) {
    const scoreColor = viewingSub.score >= 8 ? "#4ade80" : viewingSub.score >= 6 ? "#facc15" : viewingSub.score >= 4 ? "#fb923c" : "#f87171";
    return (
      <div style={{ ...s.page, display: "flex", flexDirection: "column" }}>
        <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => { setScreen("instructor"); setViewingSub(null); }} style={{ ...s.btnGhost, padding: "6px 12px", width: "auto" }}>← Back</button>
            <div style={{ width: 1, height: 20, background: BORDER }} />
            <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{viewingSub.quizTitle}</div><p style={{ ...s.muted, fontSize: 12, margin: 0 }}>{viewingSub.studentName} · {fmtDate(viewingSub.timestamp)}</p></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {viewingSub.late && <span style={s.badge("#facc15")}>LATE</span>}
            <div style={{ textAlign: "right" }}><span style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>{viewingSub.score}</span><span style={{ color: MUTED, fontSize: 16 }}>/10</span>{viewingSub.late && viewingSub.rawScore !== viewingSub.score && <div style={{ color: MUTED, fontSize: 11 }}>raw: {viewingSub.rawScore}</div>}</div>
          </div>
        </div>
        <div ref={detailRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {viewingSub.dialogue?.length > 0 ? <ChatMessages messages={viewingSub.dialogue} /> : <div style={{ ...s.card, padding: 32, textAlign: "center", color: MUTED }}>No dialogue saved for this submission.</div>}
        </div>
      </div>
    );
  }

  // ── Instructor Portal (LMS-style) ─────────────────────────────────────────
  if (screen === "instructor") {
    const instClassPickerStyle = { appearance: "none", WebkitAppearance: "none", MozAppearance: "none", background: "transparent", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, padding: "0 22px 0 0", cursor: "pointer", outline: "none", textAlign: "center", textAlignLast: "center", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23a0a0a0' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" };

    const header = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ color: TEAL, fontWeight: 700, fontSize: 22, margin: 0 }}>Newton</h1>
          {Object.keys(classes).length > 0 ? (
            <select
              value={currentClassId || ""}
              onChange={e => { const v = e.target.value; if (v) switchToClass(v); }}
              style={instClassPickerStyle}
            >
              {!currentClassId && <option value="" style={{ background: "#252627", color: "#fff" }}>— Select a class —</option>}
              {Object.entries(classes).sort((a, b) => (a[1]?.metadata?.name || "").localeCompare(b[1]?.metadata?.name || "")).map(([cid, c]) => (
                <option key={cid} value={cid} style={{ background: "#252627", color: "#fff" }}>{(c?.metadata?.name || cid) + (c?.metadata?.active === false ? " (inactive)" : "")}</option>
              ))}
            </select>
          ) : (
            <span style={{ ...s.muted, fontSize: 13 }}>No classes yet — create one in Settings.</span>
          )}
          {classDataLoading && <span style={{ ...s.muted, fontSize: 12 }}>Loading class data…</span>}
          <SyncBadge status={syncStatus} error={syncError} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

    const sidebarItems = INSTRUCTOR_SECTIONS;

    return (
      <Shell
        header={header}
        sidebar={<Sidebar items={sidebarItems} activeId={instructorSection} onSelect={setInstructorSection} />}
      >
        {dangerAction && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div style={{ ...s.card, border: "1px solid rgba(127,29,29,0.6)", padding: 24, width: "100%", maxWidth: 360 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Confirm Action</h3>
              <p style={{ ...s.muted, marginBottom: 16 }}>You are about to: <span style={{ color: "#fca5a5", fontWeight: 500 }}>{dangerAction.label}</span>. This cannot be undone.</p>
              <input type="password" style={{ ...s.input, marginBottom: 8 }} placeholder="Instructor password" value={dangerPw} onChange={e => setDangerPw(e.target.value)} onKeyDown={e => e.key === "Enter" && executeDanger()} autoFocus />
              {dangerErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>{dangerErr}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => { setDangerAction(null); setDangerPw(""); setDangerErr(""); }} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
                <button onClick={executeDanger} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {!currentClassId && instructorSection !== "settings" && instructorSection !== "bugs" && (
          <div style={{ ...s.card, padding: 32, textAlign: "center", color: MUTED }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 8px" }}>No class selected</p>
            <p style={{ margin: "0 0 16px" }}>{Object.keys(classes).length === 0 ? "Create your first class in Settings → Classes to get started." : "Choose a class from the dropdown above, or create one in Settings → Classes."}</p>
            <button onClick={() => setInstructorSection("settings")} style={{ ...s.btnPri, width: "auto", padding: "10px 20px" }}>Open Class Settings</button>
          </div>
        )}

        {currentClassId && instructorSection === "gradebook" && (
          <Gradebook
            roster={roster}
            modules={mergedModules}
            quizzes={quizzes}
            submissions={submissions}
            gradeCategories={gradeCategories}
            gradeOverrides={gradeOverrides}
            assignmentCategories={assignmentCategories}
            manualAssignments={manualAssignments}
            assignmentNameOverrides={assignmentNameOverrides}
            assignmentOrderOverrides={assignmentOrderOverrides}
            onSaveGradeCategories={saveGradeCategories}
            onSaveOverrideForStudent={saveOverrideForStudent}
            onSaveAssignmentCategories={saveAssignmentCategories}
            onSaveManualAssignments={saveManualAssignments}
            onSaveAssignmentNameOverrides={saveAssignmentNameOverrides}
            onSaveAssignmentOrderOverrides={saveAssignmentOrderOverrides}
          />
        )}


        {currentClassId && instructorSection === "roster" && (
          <div>
            <ManualAddStudent roster={roster} onAdd={async student => { const updated = [...roster, student].sort((a, b) => a.lastName.localeCompare(b.lastName)); await saveRoster(updated); }} />
            <div style={{ ...s.card, padding: 14, marginBottom: 20, fontSize: 13, color: MUTED, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <span style={{ ...s.muted, fontSize: 12 }}>(MyMercer roster export file)</span>
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
                      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Remove Student</h3>
                      <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>{removeStudent.fullName}</p>
                      <p style={{ color: MUTED, fontFamily: "monospace", fontSize: 13, margin: "0 0 16px" }}>ID: {removeStudent.studentId}</p>
                      <p style={{ ...s.muted, fontSize: 13, marginBottom: 16 }}>This removes them from the roster only. Their submissions will remain.</p>
                      <input type="password" style={{ ...s.input, marginBottom: 8 }} placeholder="Instructor password" value={removePw} onChange={e => setRemovePw(e.target.value)} autoFocus />
                      {removeErr && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>{removeErr}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <button onClick={() => { setRemoveStudent(null); setRemovePw(""); setRemoveErr(""); }} style={{ ...s.btnSec, flex: 1 }}>Cancel</button>
                        <button onClick={async () => {
                          if (!settings.passwordHash) { setRemoveErr("Settings not loaded."); return; }
                          const ok = await verifyPw(removePw, settings.passwordHash, settings.passwordSalt);
                          if (!ok) { setRemoveErr("Incorrect password."); return; }
                          saveRoster(roster.filter(r => r.studentId !== removeStudent.studentId));
                          setRemoveStudent(null); setRemovePw(""); setRemoveErr("");
                        }} style={{ ...s.btnPri, flex: 1, background: "#b91c1c" }}>Remove</button>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>{["#", "Name", "Student ID", "Password Status", ""].map(h => <th key={h} style={{ textAlign: "left", color: MUTED, fontWeight: 500, padding: "12px 16px", fontSize: 13 }}>{h}</th>)}</tr></thead>
                    <tbody>{roster.map((stu, i) => (
                      <tr key={stu.studentId} style={{ borderBottom: i < roster.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        <td style={{ padding: "12px 16px", color: MUTED, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{editingAltName === stu.studentId ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input value={altNameInput} onChange={e => setAltNameInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveAltName(stu); if (e.key === "Escape") setEditingAltName(null); }} placeholder="Preferred name (blank to clear)" autoFocus style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 13, outline: "none", width: 200 }} />
                            <button onClick={() => saveAltName(stu)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                            <button onClick={() => setEditingAltName(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{stu.altName || stu.fullName}{stu.altName && <span style={{ color: MUTED, fontWeight: 400, fontSize: 12, marginLeft: 4 }}>({stu.fullName})</span>}</span>
                            <button onClick={() => { setEditingAltName(stu.studentId); setAltNameInput(stu.altName || ""); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title="Set preferred name">✎</button>
                          </div>
                        )}</td>
                        <td style={{ padding: "12px 16px", color: MUTED, fontFamily: "monospace", fontSize: 13 }}>{stu.studentId}</td>
                        <td style={{ padding: "12px 16px" }}><span style={studentPws[stu.studentId] ? s.badge(TEAL) : s.badge(MUTED)}>{studentPws[stu.studentId] ? "Hashed password" : "Using Student ID"}</span></td>
                        <td style={{ padding: "8px 16px", textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <button onClick={async () => { if (!window.confirm(`Reset ${stu.fullName}'s password back to their Student ID?`)) return; const np = { ...studentPws }; delete np[stu.studentId]; await saveStudentPws(np); }} style={{ background: "rgba(202,138,4,0.15)", border: "1px solid rgba(202,138,4,0.4)", color: "#fde047", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Reset PW</button>
                          <button onClick={() => { setRemoveStudent(stu); setRemovePw(""); setRemoveErr(""); }} style={{ background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.5)", color: "#fca5a5", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Remove</button>
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
            dueDates={dueDates}
            onSaveDueDates={saveDueDates}
            onSaveModules={saveModules}
            onSaveModuleConfig={saveModuleConfigFor}
            onSavePage={savePage}
            onDeletePage={deletePage}
            onSaveUpload={saveUpload}
            onDeleteUpload={deleteUpload}
            onUploadFile={fbUpload}
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

        {currentClassId && instructorSection === "announcements" && (
          <InstructorAnnouncements
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
            onCancel={() => setEditingAnn(null)}
            onSave={async ({ title, body }) => {
              await saveAnnouncement({ id: editingAnn.annId || null, title, body, createdAt: editingAnn.createdAt || null });
              setEditingAnn(null);
            }}
          />
        )}

        {currentClassId && instructorSection === "syllabus" && (
          <InstructorSyllabus
            syllabus={syllabus}
            classId={currentClassId}
            onUploadFile={fbUpload}
            onSaveSyllabus={saveSyllabus}
            onDeleteSyllabus={deleteSyllabus}
          />
        )}

        {currentClassId && instructorSection === "calendar" && (
          <StudentCalendar quizzes={quizzes} completedQuizIds={new Set()} />
        )}

        {instructorSection === "settings" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Classes</p>
              <div style={{ ...s.card, padding: 16, marginBottom: 16 }}>
                <p style={{ ...s.muted, fontSize: 13, margin: "0 0 12px" }}>Create a new class</p>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={s.label}>Class name</label>
                    <input style={s.input} placeholder="e.g., Physics 2 Fall 2026" value={newClassName} onChange={e => setNewClassName(e.target.value)} onKeyDown={async e => { if (e.key === "Enter") { e.preventDefault(); try { setNewClassMsg(""); const id = await createClass(newClassName, newClassCourse); setNewClassName(""); setNewClassMsg("✅ Created."); await switchToClass(id); setTimeout(() => setNewClassMsg(""), 2500); } catch (err) { setNewClassMsg("⚠️ " + (err.message || "Failed to create class.")); } } }} />
                  </div>
                  <div>
                    <label style={s.label}>Course</label>
                    <select style={{ ...s.input, width: "auto", paddingRight: 32 }} value={newClassCourse} onChange={e => setNewClassCourse(e.target.value)}>
                      {COURSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
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
                              <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{editingClassId === cid ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <input value={editingClassNameInput} onChange={e => setEditingClassNameInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameClass(cid, editingClassNameInput); if (e.key === "Escape") setEditingClassId(null); }} autoFocus style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 13, outline: "none", width: 240 }} />
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
                              <td style={{ padding: "12px 16px", color: MUTED }}>{COURSE_LABELS[m.courseType] || m.courseType || "—"}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                  <input type="checkbox" checked={m.active !== false} onChange={e => setClassActive(cid, e.target.checked)} style={{ accentColor: TEAL, width: 16, height: 16 }} />
                                  <span style={{ ...s.muted, fontSize: 12 }}>{m.active !== false ? "Visible to students" : "Hidden"}</span>
                                </label>
                              </td>
                              <td style={{ padding: "12px 16px", color: MUTED, fontFamily: "monospace", fontSize: 13 }}>{rosterCount}</td>
                              <td style={{ padding: "8px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                                {!isCurrent && <button onClick={() => switchToClass(cid)} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 12, marginRight: 6, width: "auto" }}>Switch to</button>}
                                <button onClick={() => confirmDanger(`delete class "${m.name || cid}" and all its data`, () => deleteClass(cid))} style={{ background: "rgba(127,29,29,0.3)", border: "1px solid rgba(127,29,29,0.5)", color: "#fca5a5", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Delete</button>
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
                  <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>Backup & Restore</p>
                  <p style={{ ...s.muted, fontSize: 12, margin: "0 0 12px" }}>{currentClassId && classMeta?.name ? <>Backs up <span style={{ color: TEAL }}>{classMeta.name}</span> plus instructor settings.</> : "Select a class to back up its data."}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={exportAllData} disabled={!currentClassId} style={{ ...s.btnPri, flex: 1, minWidth: 140, opacity: currentClassId ? 1 : 0.5, cursor: currentClassId ? "pointer" : "not-allowed" }}>Download Backup</button>
                    <label style={{ ...s.btnGhost, flex: 1, minWidth: 140, cursor: currentClassId ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: currentClassId ? 1 : 0.5 }}>Restore from Backup<input ref={backupInputRef} type="file" accept=".json" onChange={onBackupImport} disabled={!currentClassId} style={{ display: "none" }} /></label>
                  </div>
                  {backupMsg && <p style={{ margin: "10px 0 0", fontSize: 13, color: backupMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{backupMsg}</p>}
                </div>
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Change Instructor Password</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="password" style={s.input} placeholder="New password" value={editPw} onChange={e => { setEditPw(e.target.value); setEditPwMsg(""); }} />
                  <input type="password" style={s.input} placeholder="Confirm new password" value={editPw2} onChange={e => { setEditPw2(e.target.value); setEditPwMsg(""); }} />
                  {editPwMsg && <p style={{ fontSize: 13, margin: 0, color: editPwMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{editPwMsg}</p>}
                  <button onClick={async () => {
                    if (!editPw.trim()) { setEditPwMsg("Password cannot be empty."); return; }
                    if (editPw !== editPw2) { setEditPwMsg("Passwords do not match."); return; }
                    if (editPw.length < 4) { setEditPwMsg("Password must be at least 4 characters."); return; }
                    const h = await makeHash(editPw.trim()); await saveSettings({ ...settings, passwordHash: h.hash, passwordSalt: h.salt });
                    setEditPw(""); setEditPw2(""); setEditPwMsg("✅ Password updated!");
                  }} style={s.btnPri}>Update Password</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 36 }}>
              <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Two-Factor Authentication</p>
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
              <p style={{ color: "#fff", fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>Danger Zone {currentClassId && classMeta?.name ? <span style={{ ...s.muted, fontWeight: 400 }}>(applies to <span style={{ color: TEAL }}>{classMeta.name}</span>)</span> : null}</p>
              <p style={{ ...s.muted, fontSize: 13, margin: "0 0 14px" }}>{currentClassId ? "These actions affect the currently selected class only." : "Select a class to manage its data."}</p>
              {currentClassId ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                  {[["Clear All Quiz Due Dates", async () => saveDueDates({})], ["Clear All Submissions", async () => saveSubs([])], ["Clear Imported Grades Only", async () => saveSubs(submissions.filter(sub => !sub.imported))], ["Clear All Gradebook Check Marks", async () => saveChecked({})], ["Reset All Student Passwords", async () => saveStudentPws({})], ["Clear Roster", async () => saveRoster([])]].map(([label, action]) => (
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
                    <p style={{ color: "#fff", fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{report.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Shell>
    );
  }

  return null;
}
