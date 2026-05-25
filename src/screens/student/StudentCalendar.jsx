import { useState } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";

const KIND_COLOR = {
  quiz: "#a3e635",
  homework: "#60a5fa",
  lab: "#f472b6",
  midterm: "#fbbf24",
  final: "#f87171",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0);
  const cells = [];
  for (let offset = -firstDow; ; offset++) {
    const d = new Date(year, month, 1 + offset);
    const y = d.getFullYear(), mo = d.getMonth(), dy = d.getDate();
    const dateStr = `${y}-${String(mo + 1).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
    cells.push({ dateStr, day: dy, isCurrentMonth: mo === month });
    if (d >= lastDay && d.getDay() === 6) break;
  }
  return cells;
}

function todayDateStr() {
  const loc = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [m, d, y] = loc.split("/");
  return `${y}-${m}-${d}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function StudentCalendar({ quizzes, completedQuizIds }) {
  const { s, text, muted, border, teal, hover } = useTheme();
  const isMobile = useIsMobile();
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = todayDateStr();

  const eventMap = {};
  for (const q of quizzes) {
    if (!q.dueDate) continue;
    const key = q.dueDate.slice(0, 10);
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push({ id: q.id, title: q.title, kind: "quiz", done: completedQuizIds.has(q.id) });
  }

  const hasAnyDueDates = quizzes.some(q => q.dueDate);
  const grid = buildGrid(year, month);
  const kindsPresent = [...new Set(Object.values(eventMap).flat().map(e => e.kind))];

  const navHeader = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <button
        onClick={() => setViewDate(new Date(year, month - 1, 1))}
        style={{ ...s.btnGhost, width: "auto", padding: "6px 14px" }}
      >←</button>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: 0 }}>
        {MONTH_NAMES[month]} {year}
      </h2>
      <button
        onClick={() => setViewDate(new Date(year, month + 1, 1))}
        style={{ ...s.btnGhost, width: "auto", padding: "6px 14px" }}
      >→</button>
    </div>
  );

  if (!hasAnyDueDates) {
    return (
      <div>
        {navHeader}
        <div style={{ ...s.card, padding: 48, textAlign: "center", color: muted }}>
          <p style={{ margin: 0, fontSize: 14 }}>No due dates set yet.</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    const monthDates = grid.filter(c => c.isCurrentMonth && eventMap[c.dateStr]);
    return (
      <div>
        {navHeader}
        {monthDates.length === 0 ? (
          <div style={{ ...s.card, padding: 32, textAlign: "center", color: muted }}>
            <p style={{ margin: 0, fontSize: 14 }}>No events this month.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {monthDates.map(cell => {
              const isToday = cell.dateStr === today;
              const d = new Date(cell.dateStr + "T00:00:00");
              const label = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[month]} ${cell.day}`;
              return (
                <div
                  key={cell.dateStr}
                  style={{
                    border: isToday ? `2px solid ${teal}` : `1px solid ${border}`,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div style={{
                    padding: "8px 12px",
                    background: isToday ? `${teal}22` : hover,
                    borderBottom: `1px solid ${border}`,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isToday ? teal : text,
                  }}>
                    {label}
                  </div>
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {eventMap[cell.dateStr].map(ev => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-block",
                          width: 10, height: 10,
                          borderRadius: 2,
                          background: KIND_COLOR[ev.kind] || teal,
                          flexShrink: 0,
                          opacity: ev.done ? 0.45 : 1,
                        }} />
                        <span style={{
                          fontSize: 14,
                          color: ev.done ? muted : text,
                          textDecoration: ev.done ? "line-through" : "none",
                        }}>
                          {ev.title}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          color: muted,
                          textTransform: "capitalize",
                          flexShrink: 0,
                        }}>
                          {ev.kind}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {navHeader}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
        {WEEKDAYS.map(wd => (
          <div key={wd} style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: muted, fontWeight: 600, letterSpacing: "0.04em" }}>
            {wd}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {grid.map(cell => {
          const isToday = cell.dateStr === today;
          const events = eventMap[cell.dateStr] || [];
          return (
            <div
              key={cell.dateStr}
              style={{
                minHeight: 80,
                padding: "6px 8px",
                background: hover,
                border: isToday ? `2px solid ${teal}` : `1px solid ${border}`,
                borderRadius: 6,
                opacity: cell.isCurrentMonth ? 1 : 0.35,
              }}
            >
              <div style={{
                textAlign: "right",
                fontSize: 12,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? teal : text,
                marginBottom: events.length ? 4 : 0,
              }}>
                {cell.day}
              </div>
              {events.map(ev => (
                <div
                  key={ev.id}
                  style={{
                    background: KIND_COLOR[ev.kind] || teal,
                    borderRadius: 3,
                    padding: "1px 5px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#000",
                    marginBottom: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    opacity: ev.done ? 0.45 : 1,
                    textDecoration: ev.done ? "line-through" : "none",
                  }}
                >
                  {ev.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {kindsPresent.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          {kindsPresent.map(kind => (
            <div key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: KIND_COLOR[kind] || teal }} />
              <span style={{ color: muted, fontSize: 12, textTransform: "capitalize" }}>{kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
