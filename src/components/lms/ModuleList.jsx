import { useState } from "react";
import { useTheme } from "../../theme.js";
import { dueToDate } from "../../utils.js";
import { ModuleRow } from "./ModuleRow.jsx";

// Renders all modules with a Collapse All / Expand All control.
// `modules`: course modules (already merged with per-class config — items carry _key/_hidden)
// `resolveItem(item)`: returns the meta for an item (quiz lookup, completion, etc.)
// `onItemClick(item, meta)`: passed through to ModuleRow → ModuleItem
// `initiallyExpanded` defaults to all expanded.
// `filterHidden` (default true): drop items flagged `_hidden` before render. Instructor view passes false.
export function ModuleList({ modules, resolveItem, onItemClick, initiallyExpanded = true, filterHidden = true }) {
  const { s, muted } = useTheme();
  const [openMap, setOpenMap] = useState(() =>
    Object.fromEntries(modules.map(m => [m.id, !!initiallyExpanded]))
  );

  const allOpen = modules.every(m => openMap[m.id]);

  const toggleAll = () => {
    const target = !allOpen;
    setOpenMap(Object.fromEntries(modules.map(m => [m.id, target])));
  };

  const toggleOne = id => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  if (!modules.length) {
    return (
      <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
        No modules yet. Check back later.
      </div>
    );
  }

  const now = new Date();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={toggleAll} style={{ ...s.btnGhost, width: "auto" }}>
          {allOpen ? "Collapse All" : "Expand All"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {modules.map(m => {
          const releaseAt = m.releaseDate ? dueToDate(m.releaseDate) : null;
          const locked = !!(releaseAt && now < releaseAt);
          const visibleItems = filterHidden ? (m.items || []).filter(it => !it._hidden) : (m.items || []);
          return (
            <ModuleRow
              key={m.id}
              module={{ ...m, items: visibleItems }}
              expanded={locked ? false : !!openMap[m.id]}
              onToggle={() => toggleOne(m.id)}
              resolveItem={resolveItem}
              onItemClick={onItemClick}
              locked={locked}
              releaseDate={m.releaseDate}
            />
          );
        })}
      </div>
    </div>
  );
}
