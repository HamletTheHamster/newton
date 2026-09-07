import { useState, useEffect, Fragment } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { itemsOf } from "../../homework.js";
import { formatDuration, totalActiveMs, timeToFirstAttemptMs } from "../../hw-telemetry.js";
import { Stat, StatRow } from "./analytics-ui.jsx";

// ── One student's engagement on one homework ──────────────────────────────────
//
// The "watch someone work through the set" view. It lived inside the Assignments hub's progress
// modal, three clicks deep and inside a modal opened from another modal; it is a reading view,
// so it belongs on the Analytics page at full width. This module is the one copy, so the two
// entry points cannot drift.
//
// What this is FOR: seeing where an assignment is costing the class its evening, and which
// student is stuck rather than idle. What it is NOT for: a verdict. Every column here has an
// innocent reading - a shared computer, a printed problem set, a reload on a bad connection, a
// student who works on paper and only types answers in. Read a row against the rest of the
// class on the SAME problem, never against a number in your head. See docs/analytics.md.

const CARD_LABEL = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };

const fmtClock = iso => {
  const t = new Date(iso);
  return isNaN(t) ? "" : t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// The attempts on one problem, in order, with what the student actually typed. This is the
// teaching payoff of the whole node: "4.9, then 9.8" is a dropped factor of 2 that the student
// found on their own, and it is invisible in a score. It is behind a click rather than always
// open, so the table above stays a table.
function AttemptTrail({ tele }) {
  const { text, muted, border, isLight } = useTheme();
  const log = tele?.attemptLog || [];
  if (!log.length) return <p style={{ color: muted, fontSize: 12, margin: 0 }}>No graded attempts recorded on this problem.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {log.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: muted, fontSize: 11, fontFamily: "monospace", minWidth: 22 }}>{i + 1}.</span>
          <span style={{
            color: a.correct ? "#4ade80" : text, fontSize: 12.5, fontFamily: "monospace",
            padding: "2px 7px", borderRadius: 5, border: `1px solid ${border}`,
            background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
            maxWidth: "100%", overflowWrap: "anywhere",
          }}>{a.answer || "(blank)"}</span>
          <span style={{ color: a.correct ? "#4ade80" : muted, fontSize: 11 }}>{a.correct ? "correct" : "not accepted"}</span>
          <span style={{ color: muted, fontSize: 11 }}>{fmtClock(a.at)}</span>
          {a.awayMsBefore > 2000 && (
            <span style={{ color: muted, fontSize: 11 }} title="Time out of the tab since the previous attempt on this problem">
              after {formatDuration(a.awayMsBefore)} away
            </span>
          )}
        </div>
      ))}
      <p style={{ color: muted, fontSize: 11, margin: "2px 0 0", lineHeight: 1.5 }}>
        The last few attempts only: the log is capped so one problem cannot fill the record.
      </p>
    </div>
  );
}

// `telemetry` is one entry of the ALREADY-MERGED map (`mergeTelemetry`), which the Analytics tab
// holds for the whole class: null means nothing was recorded, undefined means the read has not
// landed. This component deliberately does no fetching of its own - a per-student read here
// would duplicate a node the caller already has, and would go out again on every back-and-forth.
export function StudentWorkDetail({ student, homework, telemetry, onBack, backLabel = "‹ Back" }) {
  const { s, text, muted, border, teal, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [openItem, setOpenItem] = useState(null);

  // Collapse the trail when the student or the assignment changes, or it would open on an item
  // id that belongs to the previous one.
  useEffect(() => { setOpenItem(null); }, [student.studentId, homework?.id]);

  const tele = telemetry;

  // Item ids in the order a student meets them, labelled "3" / "3b" like the runner's parts.
  const labelled = (homework?.problems || []).flatMap((p, pi) => {
    const its = itemsOf(p);
    return its.map((it, ii) => ({
      id: it.id,
      label: its.length > 1 ? `${pi + 1}${"abcdefgh"[ii]}` : `${pi + 1}`,
    }));
  });

  const Back = onBack ? (
    <button onClick={onBack} style={{ ...s.btnGhost, width: "auto", alignSelf: "flex-start", padding: "6px 12px" }}>
      {backLabel}
    </button>
  ) : null;

  if (tele === undefined) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{Back}<p style={{ ...s.muted, margin: 0 }}>Loading…</p></div>;
  if (!tele) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Back}
        <p style={{ ...s.muted, margin: 0, lineHeight: 1.6 }}>
          No engagement data recorded for this assignment. It is collected from the point the
          student next opens a homework, so earlier work has none.
        </p>
      </div>
    );
  }

  const rows = labelled.map(l => ({ ...l, t: tele.items?.[l.id] || null })).filter(r => r.t);
  const total = totalActiveMs(tele);
  const sessions = Array.isArray(tele.sessions) ? tele.sessions.length : 0;
  const pasteTotal = rows.reduce((n, r) => n + (r.t.pasteCount || 0), 0);

  const Cell = ({ children, mono, align = "right", dim }) => (
    <td style={{
      padding: "8px 10px", textAlign: align, fontSize: 12,
      color: dim ? muted : text, fontFamily: mono ? "monospace" : "inherit", whiteSpace: "nowrap",
    }}>{children}</td>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      {Back}

      <StatRow>
        <Stat label="Time on task" value={formatDuration(total)} hint="excludes time away and idle" />
        <Stat label="Sittings" value={sessions || "-"} hint={sessions === 1 ? "one visit" : "separate visits"} />
        <Stat label="Problems opened" value={rows.length || "-"} hint={`of ${labelled.length} in the set`} />
        <Stat label="Pasted" value={pasteTotal ? `${pasteTotal}x` : "never"} hint="into an answer box" />
      </StatRow>

      {rows.length === 0 ? (
        <p style={{ ...s.muted, margin: 0 }}>Nothing worked yet on this assignment.</p>
      ) : (
        <div style={{ overflowX: "auto", minHeight: 0 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 0 : 480 }}>
            <thead>
              <tr>
                {[["Problem", "left"], ["Time", "right"], ["To 1st try", "right"], ["Tries", "right"], ["Away", "right"], ["", "right"]].map(([h, a], i) => (
                  <th key={h || `sp${i}`} style={{
                    textAlign: a, color: muted, fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
                    textTransform: "uppercase", padding: "0 10px 8px", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ttf = timeToFirstAttemptMs(r.t);
                const tries = (r.t.attemptLog || []).length;
                // Hidden and unfocused are shown as one trip COUNT rather than a summed
                // duration: the two clocks measure different things and adding them would
                // assert a total that means nothing. The tooltip keeps them apart.
                const trips = (r.t.hiddenCount || 0) + (r.t.unfocusedCount || 0);
                const open = openItem === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setOpenItem(open ? null : r.id)}
                      title="See what this student typed on each attempt"
                      style={{ borderTop: `1px solid ${border}`, cursor: "pointer", background: open ? (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)") : "transparent" }}
                    >
                      <Cell align="left">
                        <span style={{ fontWeight: 600 }}>{r.label}</span>
                        {r.t.pasteCount > 0 && (
                          <span style={{ ...s.badge(teal), marginLeft: 8 }} title="Answer was pasted rather than typed">
                            pasted
                          </span>
                        )}
                      </Cell>
                      <Cell mono>{formatDuration(r.t.activeMs)}</Cell>
                      <Cell mono dim={ttf == null}>{ttf == null ? "-" : formatDuration(ttf)}</Cell>
                      <Cell mono dim={!tries}>{tries || "-"}</Cell>
                      <Cell mono dim={!trips}>
                        <span title={trips
                          ? `${r.t.hiddenCount || 0} tab switch(es), ${formatDuration(r.t.hiddenMs)} · ${r.t.unfocusedCount || 0} left the window, ${formatDuration(r.t.unfocusedMs)}`
                          : ""}>
                          {trips || "-"}
                        </span>
                      </Cell>
                      <Cell dim>{open ? "▾" : "▸"}</Cell>
                    </tr>
                    {open && (
                      <tr style={{ background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)" }}>
                        <td colSpan={6} style={{ padding: "4px 10px 12px" }}>
                          <AttemptTrail tele={r.t} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ ...s.muted, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        Time on task excludes time the tab was hidden or idle. "Away" counts trips out of the tab,
        which are a normal part of doing homework: compare a row with the rest of the class on the
        same problem rather than reading it on its own. Click any problem for the attempts behind it.
      </p>
    </div>
  );
}
