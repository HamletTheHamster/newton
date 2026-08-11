import { useTheme } from "../../theme.js";
import { dueToDate } from "../../utils.js";
import { ModuleItem } from "./ModuleItem.jsx";
import { LockIcon } from "./itemIcons.jsx";

// One module: a collapsible card.
//   `module`: { id, title, items[] }
//   `expanded`: whether items are visible (forced false when locked)
//   `onToggle`: callback when header clicked
//   `resolveItem(item)`: returns the meta { quiz, completed, sub, ... } for an item
//   `onItemClick(item, meta)`: callback when a child item is clicked
//   `locked`: when true, the module's release date is in the future
//   `releaseDate`: stored "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" string
export function ModuleRow({ module, expanded, onToggle, resolveItem, onItemClick, locked = false, releaseDate = null }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const items = module.items || [];
  const completedCount = items.filter(it => resolveItem(it)?.completed).length;
  const totalCounted = items.filter(it => it.type === "quiz" && resolveItem(it)?.quiz).length;

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
        {locked && lockBadge
          ? <span style={s.badge(muted)}>{lockBadge}</span>
          : totalCounted > 0 && (
            <span style={{ ...s.muted, fontSize: 12, flexShrink: 0 }}>
              <span style={{ color: completedCount === totalCounted ? teal : muted, fontWeight: 600 }}>{completedCount}</span>
              <span> / {totalCounted}</span>
            </span>
          )
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
