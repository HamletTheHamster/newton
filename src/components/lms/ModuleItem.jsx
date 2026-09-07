import { useTheme } from "../../theme.js";
import { isLate, dueToDate } from "../../utils.js";
import { ItemIcon } from "./itemIcons.jsx";
import { isMaterialItem } from "../../material-views.js";

const hostnameOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

// One row in an expanded module.
// `item`: merged item from buildModules — may carry url, pageId, pageContent, etc.
// `meta`: { quiz?, homework?, completed?, tracked?, sub? } from the caller's resolveItem.
//   `tracked` says this item counts toward the module's progress, so it gets a completion
//   circle; `completed` fills it in. For a material, completed means the student has opened it.
export function ModuleItem({ item, meta, onClick }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const t = item.type;
  // Whether there is anything behind this row to click. The material half is the shared
  // `isMaterialItem` — the same predicate that decides what the instructor's open rates are
  // measured over — so a row can never be clickable here while counting for nothing there.
  const hasContent =
    (t === "quiz"     && !!meta?.quiz) ||
    (t === "homework" && !!meta?.homework) ||
    isMaterialItem(item);
  const isComingSoon = t === "homework" && !meta?.homework;
  const isPending = !hasContent && !isComingSoon;

  const completed = !!meta?.completed;
  const dueDate = meta?.quiz?.dueDate || meta?.homework?.dueDate;
  const late = dueDate && !completed && isLate(dueDate);

  const clickable = hasContent;
  const title = t === "quiz" ? meta?.quiz?.title : t === "homework" ? meta?.homework?.title : item.title;
  const icon = <ItemIcon type={t} />;

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
      {/* Every item the module counts gets a circle, in the same place: a reading with nothing
          behind it yet has none, but a posted one is ticked the moment it is opened, exactly
          like a submitted quiz. `tracked` is resolveItem's call (see Home.jsx), so the circle
          and the header's "n / total" can never disagree about what counts. */}
      {meta?.tracked && (
        <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${completed ? teal : border}`, background: completed ? teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>
          {completed && "✓"}
        </div>
      )}
    </div>
  );
}
