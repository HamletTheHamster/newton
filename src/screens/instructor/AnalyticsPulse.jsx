import { useMemo, useState, useId, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile, dueToDate } from "../../utils.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import {
  buildActivityByDay, buildActivityByHour, buildFunnel, lastActiveMap, activeNow, WORKING_WINDOW_MS,
} from "../../analytics.js";
import {
  CORR_POS, series, ramp, rampEmpty, rampStep,
  Stat, StatRow, StackedBar, Legend, Panel, EmptyCard, fmtSince,
} from "./analytics-ui.jsx";

// Analytics -> Pulse. The "is anything wrong right now" view: who is working, and where each
// open assignment has got to.
//
// The funnel's third bucket is the reason this view exists. A student who finished every problem
// and never pressed Finish and Submit reads as MISSING in the gradebook and as nothing at all
// everywhere else, so without this they are invisible until the grade is already a zero.

const ACT = { w: 640, h: 170, padL: 30, padT: 10, padR: 8, padB: 22 };
// Longest quiet list before it stops being a shortlist.
const QUIET_LIMIT = 10;
// Longest funnel list before the panel stops being a summary.
const MAX_FUNNELS = 8;
// How often the engagement node is re-read while this view is on screen. "Who is working right
// now" is the one figure here that is worthless from a snapshot taken when the tab was opened,
// and there is no realtime listener to lean on (RTDB's REST stream cannot carry the App Check
// header), so the view polls - matching App.jsx's own refreshClassContent cadence. It is
// deliberately gated on document visibility: an instructor's tab left open all evening must not
// re-read the largest node in the class every minute for nobody.
const LIVE_POLL_MS = 60_000;
// Days of history behind the day-by-hour grid. A term's worth, so a Tuesday pattern is a
// pattern and not one week's accident.
const HOURLY_DAYS = 90;

// Distinct students active per day. One series over time, so an area with a 2px cap line and no
// legend - the panel title names it.
function ActivityChart({ data, maxStudents }) {
  const { text, muted, border, isLight } = useTheme();
  const [hover, setHover] = useState(null);
  const clipId = `actClip-${useId().replace(/:/g, "")}`;

  const plotW = ACT.w - ACT.padL - ACT.padR;
  const plotH = ACT.h - ACT.padT - ACT.padB;
  // A fixed headroom of at least 4 keeps a quiet week from being drawn as if it were a busy one.
  const yMax = Math.max(4, maxStudents);
  const x = i => ACT.padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = v => ACT.padT + (1 - v / yMax) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.students).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, Math.round(yMax / 2), yMax].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${ACT.w} ${ACT.h}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <clipPath id={clipId}><rect x={ACT.padL} y={ACT.padT} width={plotW} height={plotH} /></clipPath>
          <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CORR_POS} stopOpacity={isLight ? 0.28 : 0.36} />
            <stop offset="100%" stopColor={CORR_POS} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map(t => (
          <g key={t}>
            <line x1={ACT.padL} y1={y(t)} x2={ACT.padL + plotW} y2={y(t)} stroke={border} strokeWidth="1" />
            <text x={ACT.padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill={muted}>{t}</text>
          </g>
        ))}

        <path d={area} fill={`url(#${clipId}-fill)`} clipPath={`url(#${clipId})`} />
        <path d={line} fill="none" stroke={CORR_POS} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipId})`} />

        {/* Hover targets are full-height columns, so the pointer never has to find a 2px line. */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - plotW / (2 * Math.max(1, data.length - 1))} y={ACT.padT}
            width={plotW / Math.max(1, data.length - 1)} height={plotH}
            fill="transparent" style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover({ ...d, i })} onMouseLeave={() => setHover(null)}
          />
        ))}
        {hover && <circle cx={x(hover.i)} cy={y(hover.students)} r="4.5" fill={CORR_POS} stroke={isLight ? "#faf8f6" : "#1e1e1f"} strokeWidth="2" />}

        {/* Only the ends are labelled: a tick per day would be unreadable at this width. */}
        <text x={ACT.padL} y={ACT.h - 6} fontSize="9.5" fill={muted}>{shortDate(data[0]?.date)}</text>
        <text x={ACT.padL + plotW} y={ACT.h - 6} textAnchor="end" fontSize="9.5" fill={muted}>{shortDate(data[data.length - 1]?.date)}</text>
      </svg>

      {hover && (
        <div style={{
          position: "absolute", pointerEvents: "none", zIndex: 5,
          left: `${(x(hover.i) / ACT.w) * 100}%`, top: `${(y(hover.students) / ACT.h) * 100}%`,
          transform: "translate(-50%, calc(-100% - 10px))",
          background: isLight ? "#fff" : "#252627", border: `1px solid ${border}`,
          borderRadius: 8, padding: "5px 9px", whiteSpace: "nowrap", boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
        }}>
          <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{hover.students} active</div>
          <div style={{ color: muted, fontSize: 11 }}>{shortDate(hover.date)}</div>
        </div>
      )}
    </div>
  );
}

// ── When the class works ──────────────────────────────────────────────────────
// A day-of-week x hour-of-day grid. Magnitude, not identity, so it takes the one-hue sequential
// `ramp` rather than a categorical set, with an explicitly neutral cell for "nothing here" so a
// dead hour never reads as a quiet one.
//
// All 24 hours are drawn even though most of them are empty for most classes: the empty half is
// the finding as often as the busy half is, and cropping to the hours with data would quietly
// rescale the picture every time one student worked at 3am. Cells are laid out with CSS grid
// rather than SVG so the whole thing reflows on a phone without a viewBox to fight.
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Every third hour, which is as many labels as fit at this cell width without colliding.
const HOUR_LABEL = h => (h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`);
const hourRange = h => `${HOUR_LABEL(h)} to ${HOUR_LABEL((h + 1) % 24)}`;

function HourHeatmap({ grid, max }) {
  const { text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const steps = ramp(isLight);
  const empty = rampEmpty(isLight);
  const [hover, setHover] = useState(null);

  // Row totals sit beside the grid: the day-of-week answer is the one an instructor acts on
  // (which night to set a deadline), and reading it off shaded cells is guesswork.
  const rowTotals = grid.map(row => row.reduce((n, v) => n + v, 0));
  const busiestDay = rowTotals.indexOf(Math.max(...rowTotals));
  // The band each ramp step tops out at, so the scale states the numbers it stands for rather
  // than asking the reader to trust a gradient. Mirrors rampStep's four equal bands of `max`.
  const bandTop = i => Math.max(i + 1, Math.round(((i + 1) * max) / 4));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ overflowX: "auto" }}>
        {/* Capped rather than full-bleed: at panel width the 24 columns stretch into flat bars,
            and a heatmap cell has to read as a cell. */}
        <div style={{ minWidth: isMobile ? 470 : 0, maxWidth: 760 }}>
          {/* Hour ruler. The label sits at the LEFT edge of its cell, which is what the hour means. */}
          <div style={{ display: "grid", gridTemplateColumns: `36px repeat(24, minmax(0, 1fr)) 52px`, gap: 2, marginBottom: 3 }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ color: muted, fontSize: 9, textAlign: "left", overflow: "visible", whiteSpace: "nowrap" }}>
                {h % 3 === 0 ? HOUR_LABEL(h) : ""}
              </span>
            ))}
            <span />
          </div>

          {grid.map((row, d) => (
            <div key={d} style={{ display: "grid", gridTemplateColumns: `36px repeat(24, minmax(0, 1fr)) 52px`, gap: 2, marginBottom: 2, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 10.5, fontWeight: 600 }}>{DOW[d]}</span>
              {row.map((v, h) => {
                const step = rampStep(v, max);
                const on = hover && hover.d === d && hover.h === h;
                return (
                  <span
                    key={h}
                    onMouseEnter={() => setHover({ d, h, v })}
                    onMouseLeave={() => setHover(null)}
                    title={`${DOW[d]} ${hourRange(h)}: ${v || "no"} student-hour${v === 1 ? "" : "s"} of work`}
                    style={{
                      height: 18, borderRadius: 3, background: step < 0 ? empty : steps[step],
                      cursor: "default",
                      // A 2px surface ring on the hovered cell, never a color change: the fill is
                      // carrying the value and must not be repainted to say "you are pointing here".
                      outline: on ? `2px solid ${text}` : "none", outlineOffset: -1,
                    }}
                  />
                );
              })}
              <span style={{ color: rowTotals[d] ? text : muted, fontSize: 10.5, fontFamily: "monospace", textAlign: "right" }}>
                {rowTotals[d] || "-"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scale, always present: the cell fill is the only encoding, so it is never color alone. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: muted, fontSize: 11 }}>
          Quieter
          <span style={{ display: "inline-flex", gap: 2 }}>
            <span style={{ width: 15, height: 10, borderRadius: 2, background: empty, border: `1px solid ${border}` }} title="No recorded work" />
            {steps.map((c, i) => (
              <span key={c} style={{ width: 15, height: 10, borderRadius: 2, background: c }}
                    title={`Up to ${bandTop(i)} student-hour${bandTop(i) === 1 ? "" : "s"}`} />
            ))}
          </span>
          Busier, up to {max}
        </span>
        <span style={{ color: muted, fontSize: 11 }}>
          Busiest day: {DOW[busiestDay]}, {rowTotals[busiestDay]} student-hour{rowTotals[busiestDay] === 1 ? "" : "s"}.
        </span>
        {hover && (
          <span style={{ color: text, fontSize: 11.5, fontWeight: 600 }}>
            {DOW[hover.d]} {hourRange(hover.h)}: {hover.v || "none"}
          </span>
        )}
      </div>
    </div>
  );
}

// "Sep 8" from a local "YYYY-MM-DD" key. Parsed by hand rather than through `new Date(str)`,
// which reads a bare date as UTC midnight and lands on the previous day west of Greenwich.
function shortDate(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnalyticsPulse({
  roster, assignments, submissions, progress, telemetryAll, telemetryLoading, dueDates,
  assignmentLocks = {}, onRefresh, refreshedAt,
}) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const days = isMobile ? 14 : 30;
  // Re-tick every 30s so "3 min ago" and the 15-minute working window stay honest between polls
  // rather than freezing at whatever they said when the data landed.
  const [, setTick] = useState(0);

  // Keep the engagement node fresh while this view is on screen and the browser tab is visible.
  // Without it "working right now" is really "working when you opened Analytics", which is a
  // worse answer than none.
  useEffect(() => {
    if (!onRefresh) return;
    const clock = setInterval(() => setTick(n => n + 1), 30_000);
    const poll = setInterval(() => { if (document.visibilityState === "visible") onRefresh(); }, LIVE_POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") onRefresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(clock); clearInterval(poll); document.removeEventListener("visibilitychange", onVis); };
  }, [onRefresh]);

  const activity = useMemo(
    () => buildActivityByDay({ submissions, telemetryAll, days }),
    [submissions, telemetryAll, days]
  );
  const maxStudents = Math.max(0, ...activity.map(d => d.students));
  const lastActive = useMemo(() => lastActiveMap({ submissions, telemetryAll }), [submissions, telemetryAll]);

  const hourly = useMemo(
    () => buildActivityByHour({ submissions, telemetryAll, days: HOURLY_DAYS }),
    [submissions, telemetryAll]
  );

  // Who is mid-assignment right now. Recomputed on every refresh AND on the 30s tick, since the
  // window is a moving one: a student whose last write was 14 minutes ago drops off by himself.
  const working = useMemo(
    () => activeNow({ telemetryAll, submissions }),
    // `refreshedAt` is not read in the body: it is here so the list is recomputed on every
    // poll even if a future caller reuses the telemetry object rather than rebuilding it.
    [telemetryAll, submissions, refreshedAt]
  );
  const nameOf = sid => {
    const stu = (roster || []).find(r => r.studentId === sid);
    return stu ? (stu.altName || stu.fullName || sid) : sid;
  };
  const titleOf = id => (assignments || []).find(a => a.id === id)?.title || id;
  // Grouped by assignment, because "4 working" is a different situation from "4 working, all on
  // the set due tonight".
  const workingByAssignment = useMemo(() => {
    const by = new Map();
    for (const w of working) {
      const g = by.get(w.hwId) || { id: w.hwId, students: [] };
      g.students.push(w);
      by.set(w.hwId, g);
    }
    return [...by.values()].sort((a, b) => b.students.length - a.students.length);
  }, [working]);

  const activeThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return Object.values(lastActive).filter(iso => new Date(iso).getTime() >= cutoff).length;
  }, [lastActive]);

  // Assignments worth a funnel: the quizzes and homework a student can ACTUALLY open right now.
  //
  // "Open" is release, not the due date. Late work is always accepted at half credit (see
  // `isLate` in utils.js and the `late` handling in HomeworkRunner / finishQuiz), so a past-due
  // assignment is still open and still worth chasing - the stalled bucket especially. What is
  // NOT open is anything a student cannot reach: an unreleased module, or a hidden item. Those
  // used to appear here with the whole class in "not started", which is true and useless.
  const funnelTargets = useMemo(() => (assignments || [])
    .filter(a => a.type === "quiz" || a.type === "homework")
    .filter(a => !assignmentLocks?.[a.id]?.locked)
    .map(a => ({ a, due: a.dueDate ? dueToDate(a.dueDate)?.getTime() ?? null : null }))
    .sort((p, q) => (q.due ?? 0) - (p.due ?? 0))
    .slice(0, MAX_FUNNELS)
    .map(x => x.a), [assignments, assignmentLocks]);

  // Slot order is the palette's own; see analytics-ui.jsx for why it must not be shuffled.
  const C = series(isLight);
  const funnelSegs = f => [
    { key: "submitted", label: "Submitted", value: f.submitted, color: C[0], names: f.names?.submitted },
    { key: "stalled", label: "Finished, not handed in", value: f.stalled, color: C[1], names: f.names?.stalled },
    { key: "started", label: "In progress", value: f.started, color: C[2], names: f.names?.started },
    { key: "notStarted", label: "Not started", value: f.notStarted, color: C[3], names: f.names?.notStarted },
  ];

  if (!roster?.length) return <EmptyCard title="No students enrolled">Add students in the Roster tab and this view fills in.</EmptyCard>;

  const funnels = funnelTargets.map(a => ({ a, f: buildFunnel({ assignment: a, roster, submissions, progress }) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatRow>
        <Stat label="Active this week" value={`${activeThisWeek}`} hint={`of ${roster.length} students`} />
        <Stat label="Busiest day" value={maxStudents || "-"} hint={maxStudents ? "students at once" : "no activity yet"} />
        <Stat
          label="Working now"
          value={working.length || "0"}
          color={working.length ? CORR_POS : undefined}
          hint={working.length
            ? `on ${workingByAssignment.length} assignment${workingByAssignment.length === 1 ? "" : "s"}`
            : "in the last 15 min"}
        />
      </StatRow>

      {/* Who is mid-assignment. First, because on a homework night it is the only question this
          view is asked, and because it is the one figure whose value decays: the panel says how
          fresh it is rather than leaving the reader to assume it is live. */}
      <Panel
        title="Working right now"
        right={
          <InfoDot title="What counts as right now" align="right">
            A student appears here when the app recorded them doing something on a homework in the
            last 15 minutes: a graded attempt, or typing into an answer box. There is no presence
            signal and no heartbeat.
            <br /><br />
            So an empty panel does not mean nobody is working. A student reading the problem on
            paper, or working it out before typing anything, writes nothing for the app to see.
            <br /><br />
            Anyone who has handed the assignment in is excluded, however recent their last write.
          </InfoDot>
        }
        subtitle={`Recorded working in the last ${Math.round(WORKING_WINDOW_MS / 60000)} minutes. ${
          refreshedAt ? `Updated ${fmtSince(new Date(refreshedAt).toISOString()) || "just now"}` : "Updated when this tab opened"
        }, and again every minute while this view is open.`}
      >
        {telemetryLoading && !working.length ? (
          <p style={{ ...s.muted, margin: 0 }}>Loading…</p>
        ) : !working.length ? (
          <p style={{ ...s.muted, margin: 0, lineHeight: 1.6 }}>
            Nobody is working in the app at the moment. That is not the same as nobody working:
            only typing and submitting leave a trace.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workingByAssignment.map(g => (
              <div key={g.id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ color: text, fontSize: 13, fontWeight: 600 }}>{titleOf(g.id)}</span>
                  <span style={{ color: muted, fontSize: 11.5 }}>
                    {g.students.length} student{g.students.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {g.students.map(w => (
                    <span
                      key={`${w.studentId}|${w.hwId}`}
                      title={`Last recorded activity ${fmtSince(w.lastAt) || "just now"}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        border: `1px solid ${border}`, borderRadius: 999, padding: "4px 11px",
                        color: text, fontSize: 12.5,
                        background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: CORR_POS, flexShrink: 0 }} />
                      {nameOf(w.studentId)}
                      <span style={{ color: muted, fontSize: 11 }}>{fmtSince(w.lastAt) || "just now"}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={`Students active per day (last ${days})`}
        subtitle="Counted from homework working sessions and submission times, so a student is counted once per day however long they worked."
      >
        {maxStudents === 0 ? (
          <p style={{ ...s.muted, margin: 0 }}>
            {telemetryLoading ? "Loading…" : "No recorded activity yet. Working sessions are tracked from the point a student next opens a homework."}
          </p>
        ) : (
          <ActivityChart data={activity} maxStudents={maxStudents} />
        )}
      </Panel>

      <Panel
        title="When the class works"
        right={
          <InfoDot title="What a cell counts" align="right">
            One count per student per hour, so a student who submits twenty answers between 9 and
            10pm adds 1, exactly like a student who worked quietly through the same hour. No single
            student can shape the grid.
            <br /><br />
            The marks are moments the app recorded something happening: a sitting opening or being
            saved, a graded attempt, a submission. Sittings are deliberately NOT drawn as spans,
            because a tab left open overnight would paint eight hours of work nobody did.
            <br /><br />
            Hours are the instructor's own local time, and only homework leaves a trace here.
          </InfoDot>
        }
        subtitle={`Hours in which some student was recorded working, over the last ${HOURLY_DAYS} days. Useful for choosing when a deadline should fall.`}
      >
        {hourly.total === 0 ? (
          <p style={{ ...s.muted, margin: 0 }}>
            {telemetryLoading ? "Loading…" : "No recorded activity yet. Working sessions are tracked from the point a student next opens a homework."}
          </p>
        ) : (
          <HourHeatmap grid={hourly.grid} max={hourly.max} />
        )}
      </Panel>

      <Panel
        title="Where each assignment stands"
        right={
          <InfoDot title="The third bucket" align="right">
            "Finished, not handed in" means the student completed every problem and never pressed Finish and
            Submit. The gradebook shows that as missing, exactly like a student who did nothing, so it is
            invisible until the grade is already a zero.
            <br /><br />
            It is the one bucket here that is usually worth an email, because the work is done.
          </InfoDot>
        }
        subtitle="Work students can open right now, most recently due first. Late work still counts at half credit, so a past due assignment stays here. Hover any segment for the students in it."
      >
        {funnels.length === 0 ? (
          <p style={{ ...s.muted, margin: 0 }}>Nothing is open to students yet. Assignments appear here once their module is released.</p>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><Legend items={funnelSegs({ submitted: 1, stalled: 1, started: 1, notStarted: 1 }).map(x => ({ key: x.key, label: x.label, color: x.color }))} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {funnels.map(({ a, f }) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 2fr 120px", gap: 12, alignItems: "center" }}>
                  <span style={{ color: text, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  <StackedBar segments={funnelSegs(f)} height={10} />
                  <span style={{ color: muted, fontSize: 11.5, textAlign: isMobile ? "left" : "right", whiteSpace: "nowrap" }}>
                    {f.submitted}/{f.total} submitted
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel title="Quiet students" subtitle="Nobody has been active here in over a week.">
        {(() => {
          const quiet = (roster || [])
            .map(stu => ({ stu, last: lastActive[stu.studentId] || null }))
            .filter(x => !x.last || Date.now() - new Date(x.last).getTime() > 7 * 86400000)
            .sort((p, q) => (p.last ? new Date(p.last) : 0) - (q.last ? new Date(q.last) : 0));
          if (!quiet.length) return <p style={{ ...s.muted, margin: 0 }}>Everyone has been active in the last week.</p>;
          const shown = quiet.slice(0, QUIET_LIMIT);
          return (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {shown.map((x, i) => (
                <div key={x.stu.studentId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 2px", borderTop: i ? `1px solid ${border}` : "none" }}>
                  <span style={{ color: text, fontSize: 13 }}>{x.stu.altName || x.stu.fullName || x.stu.studentId}</span>
                  <span style={{ color: muted, fontSize: 12 }}>{x.last ? fmtSince(x.last) : "never recorded"}</span>
                </div>
              ))}
              {quiet.length > shown.length && (
                <p style={{ ...s.muted, fontSize: 12, margin: "10px 0 0" }}>
                  and {quiet.length - shown.length} more. The whole class showing as quiet usually means a break,
                  or that this class predates engagement tracking.
                </p>
              )}
            </div>
          );
        })()}
        <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", lineHeight: 1.5 }}>
          "Never recorded" usually means their work predates engagement tracking rather than that they have done
          nothing. Check the Students view before reading anything into it.
        </p>
      </Panel>
    </div>
  );
}
