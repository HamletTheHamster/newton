import { useState } from "react";
import { useTheme } from "../../theme.js";
import { fmtDueTime, dueToDate } from "../../utils.js";

// Shared due-date editor — a date picker, a separate time control, and a status badge.
// Used by BOTH the Modules editor (Home tab, inside an item's ⋮ menu) and the Assignments
// hub, so the two can't drift apart again.
//
// Due dates are stored in two shapes (see `dueToDate` in utils.js): date-only "YYYY-MM-DD",
// which MEANS 11:59 PM ET, and "YYYY-MM-DD HH:MM". Picking a date alone writes the date-only
// form, so **11:59 PM is the default without having to store it**, and the time control reads
// 11:59 PM until the instructor sets something else.
//
// This is deliberately NOT one `<input type="datetime-local">`: that control renders **blank**
// for a bare "YYYY-MM-DD" value (the bug that made the Assignments hub look out of sync with
// Modules), and it cannot express "the default end-of-day deadline" — every date pick would
// have to invent a time.
//
// `colorScheme` is what themes the browser's own popup — the calendar panel Chrome opens on
// click is native chrome, not our DOM, so no CSS of ours reaches inside it. Without this it
// renders light-on-white over a dark app. Same pattern as the Gradebook's extension picker.
//
// `value`   — the stored string, or null/"" for no due date.
// `onChange(next)` — next stored string, or null to clear the due date entirely.
// `direction` — "column" for a narrow menu, "row" for a table cell.
export function DueDateField({ value, onChange, direction = "column", showStatus = true }) {
  const { s, border, muted, isLight } = useTheme();
  const [editingTime, setEditingTime] = useState(false);

  const dateVal = value ? value.slice(0, 10) : "";
  const timeVal = value && value.length === 16 && value[10] === " " ? value.slice(11) : "23:59";
  const late = value ? dueToDate(value) < new Date() : false;
  const isRow = direction === "row";

  const fieldStyle = {
    ...s.input, padding: "6px 10px", fontSize: 12,
    width: isRow ? 128 : "100%", flexShrink: 0,
    colorScheme: isLight ? "light" : "dark",
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: isRow ? "row" : "column",
      alignItems: isRow ? "center" : "stretch",
      gap: 6,
      minWidth: 0,
    }}>
      <input
        type="date"
        value={dateVal}
        onChange={async e => {
          setEditingTime(false);
          // Clearing the date clears the whole due date; setting one writes the date-only
          // form, i.e. 11:59 PM.
          await onChange(e.target.value || null);
        }}
        style={fieldStyle}
      />

      {value && (editingTime ? (
        <input
          type="time"
          autoFocus
          value={timeVal}
          onChange={async e => { if (e.target.value) await onChange(dateVal + " " + e.target.value); }}
          onBlur={() => setEditingTime(false)}
          style={{ ...fieldStyle, width: isRow ? 96 : "100%" }}
        />
      ) : (
        <button
          onClick={() => setEditingTime(true)}
          title="Click to change the time"
          style={{
            background: "transparent", border: `1px solid ${border}`, color: muted,
            fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 10,
            width: isRow ? 96 : "100%", flexShrink: 0, textAlign: "left", fontFamily: "inherit",
          }}
        >
          {fmtDueTime(value)}
        </button>
      ))}

      {showStatus && value && (
        <span style={{ ...s.badge(late ? "#f87171" : "#4ade80"), whiteSpace: "nowrap" }}>
          {late ? "Past due" : "Active"}
        </span>
      )}
    </div>
  );
}
