import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme, ThemeContext, buildTheme } from "../theme.js";
import { printSheet, printFilename, waitForImages } from "../print.js";
import { StudySheet } from "./StudySheet.jsx";

// "Download study copy" — the button, and the hidden document behind it.
//
// Extracted because there are now two places that offer the same download: the submission
// viewer (a graded assignment, from either side of the gradebook) and the end of a personalized
// study guide, which hands in nothing and so has no submission to view. The awkward part is not
// the button, it is the four things that have to be true for the PDF to come out right, and
// having them in one place is what stops the second caller getting three of them:
//
//   1. The sheet is mounted only when asked for, so an assignment nobody downloads never pays
//      for a second pass over its KaTeX and its SVG plots. Once mounted it stays, so a second
//      download is immediate.
//   2. One animation frame between mounting and printing, so the fresh DOM has been laid out
//      before the print dialog snapshots it. The flag is cleared INSIDE the frame because
//      StrictMode runs the effect twice in dev and cancels the first frame.
//   3. The sheet's <img> elements are not the ones already on screen, so a print fired in the
//      same frame can catch a figure still blank: waitForImages holds until they have decoded.
//   4. It is portalled to <body> under a LIGHT theme. A print clips at the first positioned
//      ancestor, which would cost every page after the first if it rendered inside a modal or a
//      scrolling runner body; and paper is light whatever the app is set to.
//
// `record` is a submission-shaped object. The study guide builds one in memory without ever
// persisting it, which is exactly what makes a sheet printable from an assignment that is not
// handed in.
const PRINT_THEME = buildTheme(true);

export function StudyCopyButton({ record, assignmentTitle, studentName, label = "Download study copy", style = null }) {
  const { s, teal } = useTheme();
  const [mounted, setMounted] = useState(false);
  const wantPrint = useRef(false);
  const sheetRef = useRef(null);

  const runPrint = async () => {
    await waitForImages(sheetRef.current);
    printSheet(printFilename(assignmentTitle, studentName));
  };

  const handleDownload = () => {
    if (mounted) { runPrint(); return; }
    wantPrint.current = true;
    setMounted(true);
  };

  useEffect(() => {
    if (!mounted || !wantPrint.current) return;
    const id = requestAnimationFrame(() => { wantPrint.current = false; runPrint(); });
    return () => cancelAnimationFrame(id);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        onClick={handleDownload}
        style={style || { ...s.btnGhost, width: "auto", padding: "6px 14px", fontSize: 12, color: teal, borderColor: `${teal}66` }}
      >
        {label}
      </button>
      {mounted && createPortal(
        <div className="print-sheet" ref={sheetRef}>
          <ThemeContext.Provider value={PRINT_THEME}>
            <StudySheet submission={record} assignmentTitle={assignmentTitle} studentName={studentName} />
          </ThemeContext.Provider>
        </div>,
        document.body
      )}
    </>
  );
}
