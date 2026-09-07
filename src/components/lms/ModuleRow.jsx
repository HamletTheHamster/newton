import { useTheme } from "../../theme.js";
import { dueToDate } from "../../utils.js";
import { ModuleItem } from "./ModuleItem.jsx";
import { LockIcon } from "./itemIcons.jsx";

// One module: a collapsible card.
//   `module`: { id, title, items[] }
//   `expanded`: whether items are visible (forced false when locked)
//   `onToggle`: callback when header clicked
//   `resolveItem(item)`: returns the meta { quiz, homework, completed, tracked, sub, ... } for an
//     item, or null when nothing resolves. `tracked` is what the header's counter counts.
//   `onItemClick(item, meta)`: callback when a child item is clicked
//   `locked`: when true, the module's release date is in the future
//   `releaseDate`: stored "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" string
export function ModuleRow({ module, expanded, onToggle, resolveItem, onItemClick, locked = false, releaseDate = null }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const items = module.items || [];
  // The header counter is everything in the module the student can finish, not just the quizzes.
  // `resolveItem` owns that judgment and reports it as `tracked` — a quiz, a homework, and any
  // posted material with something actually behind it. Counting item TYPES here instead is how
  // this drifted the first time: it was written when quizzes were the only work, and went on
  // reading "0 / 1" through a module of homework and readings.
  const counted = items.map(resolveItem).filter(m => m?.tracked);
  const totalCounted = counted.length;
  const completedCount = counted.filter(m => m.completed).length;
  const allDone = totalCounted > 0 && completedCount === totalCounted;

  const lockBadge = locked && releaseDate
    ? "Unlocks " + dueToDate(releaseDate).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{ ...s.card, overflow: "hidden", opacity: locked ? 0.55 : 1 }}>
      <button
        onClick={locked ? undefined : onToggle}
        disabled={locked}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "none", border: "none", cursor: locked ? "default" : "pointer", textAlign: "left", color: text }}
        onMouseEnter={e => { if (!locked) e.currentTarget.style.background = hover; }}
        onMouseLeave={e => { if (!locked) e.currentTarget.style.background = "none"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {locked
            ? (
              <span style={{ color: muted, fontSize: 14, display: "inline-flex", flexShrink: 0 }}>
                <LockIcon size={14} />
              </span>
            )
            : <span style={{ color: muted, fontSize: 13, transform: expanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.2s", flexShrink: 0 }}>▶</span>
          }
          <span style={{ fontWeight: 600, fontSize: 15 }}>{module.title}</span>
        </div>
        {/* A finished module ends on the SAME filled tick its items wear, not on "5 / 5": once
            everything is done the count has nothing left to say, and the tick is the signal the
            student already reads down the rest of the card. The count stays while it is still
            answering a question ("how much is left"). The exact count is kept on the title, since
            the tick alone drops it. */}
        {locked && lockBadge
          ? <span style={s.badge(muted)}>{lockBadge}</span>
          : totalCounted > 0 && (allDone
            ? (
              <span
                title={`All ${totalCounted} item${totalCounted > 1 ? "s" : ""} complete`}
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}
              >✓</span>
            )
            : (
              <span style={{ ...s.muted, fontSize: 12, flexShrink: 0 }}>
                <span style={{ fontWeight: 600 }}>{completedCount}</span>
                <span> / {totalCounted}</span>
              </span>
            ))
        }
      </button>
      {expanded && !locked && (
        <div style={{ borderTop: `1px solid ${border}` }}>
          {items.map((item, i) => {
            const meta = resolveItem(item);
            return (
              <ModuleItem
                key={item._key || i}
                item={item}
                meta={meta}
                onClick={() => onItemClick && onItemClick(item, meta)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
