import { useMemo, useState, useId } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile, dueToDate } from "../../utils.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import { buildActivityByDay, buildFunnel, lastActiveMap } from "../../analytics.js";
import { CORR_POS, series, Stat, StatRow, StackedBar, Legend, Panel, EmptyCard, fmtSince } from "./analytics-ui.jsx";

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

// "Sep 8" from a local "YYYY-MM-DD" key. Parsed by hand rather than through `new Date(str)`,
// which reads a bare date as UTC midnight and lands on the previous day west of Greenwich.
function shortDate(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnalyticsPulse({
  roster, assignments, submissions, progress, telemetryAll, telemetryLoading, dueDates,
  assignmentLocks = {},
}) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const days = isMobile ? 14 : 30;

  const activity = useMemo(
    () => buildActivityByDay({ submissions, telemetryAll, days }),
    [submissions, telemetryAll, days]
  );
  const maxStudents = Math.max(0, ...activity.map(d => d.students));
  const lastActive = useMemo(() => lastActiveMap({ submissions, telemetryAll }), [submissions, telemetryAll]);

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
    { key: "submitted", label: "Submitted", value: f.submitted, color: C[0] },
    { key: "stalled", label: "Finished, not handed in", value: f.stalled, color: C[1] },
    { key: "started", label: "In progress", value: f.started, color: C[2] },
    { key: "notStarted", label: "Not started", value: f.notStarted, color: C[3] },
  ];

  if (!roster?.length) return <EmptyCard title="No students enrolled">Add students in the Roster tab and this view fills in.</EmptyCard>;

  const funnels = funnelTargets.map(a => ({ a, f: buildFunnel({ assignment: a, roster, submissions, progress }) }));
  const totalStalled = funnels.reduce((n, x) => n + x.f.stalled, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatRow>
        <Stat label="Active this week" value={`${activeThisWeek}`} hint={`of ${roster.length} students`} />
        <Stat label="Busiest day" value={maxStudents || "-"} hint={maxStudents ? "students at once" : "no activity yet"} />
        <Stat
          label="Finished, not handed in"
          value={totalStalled || "0"}
          color={totalStalled ? "#fbbf24" : undefined}
          hint="across open assignments"
        />
      </StatRow>

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
        subtitle="Work students can open right now, most recently due first. Late work still counts at half credit, so a past due assignment stays here."
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
                    {f.stalled > 0 && <span style={{ color: "#fbbf24", fontWeight: 600 }}> · {f.stalled} stalled</span>}
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
