import { useTheme } from "../../theme.js";
import { isLate, dueToDate } from "../../utils.js";

// Icons (inline SVG, monochrome, currentColor).
const ICON = {
  quiz: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  reading: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  notes: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  homework: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  page: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  link: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
};

const hostnameOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

// One row in an expanded module.
// `item`: merged item from buildModules — may carry url, pageId, pageContent, etc.
// `meta`: { quiz?, completed?, late?, sub? } resolved data for quiz items
export function ModuleItem({ item, meta, onClick }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const t = item.type;
  const hasContent =
    (t === "quiz"     && !!meta?.quiz) ||
    (t === "homework" && !!meta?.homework) ||
    (t === "reading"  && !!item.url) ||
    (t === "notes"    && !!item.url) ||
    (t === "page"     && !!item.pageId) ||
    (t === "link"     && !!item.url) ||
    (t === "file"     && !!item.downloadUrl);
  const isComingSoon = t === "homework" && !meta?.homework;
  const isPending = !hasContent && !isComingSoon;

  const completed = !!meta?.completed;
  const dueDate = meta?.quiz?.dueDate || meta?.homework?.dueDate;
  const late = dueDate && !completed && isLate(dueDate);

  const clickable = hasContent;
  const title = t === "quiz" ? meta?.quiz?.title : t === "homework" ? meta?.homework?.title : item.title;
  const icon = ICON[t] || ICON.page;

  const completedBg = "rgba(0,130,140,0.06)";
  const completedHoverBg = "rgba(0,130,140,0.12)";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        borderTop: `1px solid ${border}`,
        cursor: clickable ? "pointer" : "default",
        opacity: isComingSoon || isPending ? 0.55 : 1,
        background: completed && clickable ? completedBg : "transparent",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = completed ? completedHoverBg : hover; }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.background = completed ? completedBg : "transparent"; }}
    >
      <span style={{ color: completed ? teal : muted, display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: completed ? teal : text, fontSize: 14, fontWeight: 500 }}>{title || "Untitled"}</div>
        <div style={{ ...s.muted, fontSize: 12, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {t === "quiz" && meta?.quiz && (
            <>
              <span>{meta.quiz.questions.length} question{meta.quiz.questions.length > 1 ? "s" : ""} · 10 pts</span>
              {meta.quiz.questions.some(q => q.requiresImage) && <span style={{ color: "#a78bfa" }}>drawing</span>}
              {completed && meta.sub
                ? <span style={{ color: meta.sub.score >= 8 ? "#4ade80" : meta.sub.score >= 6 ? "#facc15" : meta.sub.score >= 4 ? "#fb923c" : "#f87171", fontWeight: 600 }}>
                    Score: {meta.sub.score}/10{meta.sub.late ? " · late" : ""}
                  </span>
                : dueDate && (
                    <span style={{ color: late ? "#f87171" : "#4ade80" }}>
                      {late ? "Past due! (½ credit)" : "Due " + dueToDate(dueDate).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
                    </span>
                  )}
            </>
          )}
          {t === "homework" && meta?.homework && (
            <>
              <span>{meta.homework.problems.length} problem{meta.homework.problems.length > 1 ? "s" : ""} · {meta.homework.problems.length} pts</span>
              {completed && meta.sub
                ? <span style={{ color: (meta.sub.score ?? 0) >= 8 ? "#4ade80" : (meta.sub.score ?? 0) >= 6 ? "#facc15" : (meta.sub.score ?? 0) >= 4 ? "#fb923c" : "#f87171", fontWeight: 600 }}>
                    Score: {meta.sub.rawScore ?? 0}/{meta.sub.nativeTotal ?? meta.homework.problems.length}{meta.sub.late ? " · late" : ""}
                  </span>
                : dueDate && (
                    <span style={{ color: late ? "#f87171" : "#4ade80" }}>
                      {late ? "Past due! (½ credit)" : "Due " + dueToDate(dueDate).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
                    </span>
                  )}
            </>
          )}
          {(t === "reading" || t === "notes") && item.url && <span>{hostnameOf(item.url)}</span>}
          {t === "link" && item.url && <span>{hostnameOf(item.url)}</span>}
          {isPending && <span style={{ ...s.badge(muted), fontSize: 10 }}>Not yet linked</span>}
          {isComingSoon && <span style={{ ...s.badge(muted), fontSize: 10 }}>Coming soon</span>}
        </div>
      </div>
      {((t === "quiz" && meta?.quiz) || (t === "homework" && meta?.homework)) && (
        <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${completed ? teal : border}`, background: completed ? teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>
          {completed && "✓"}
        </div>
      )}
    </div>
  );
}
