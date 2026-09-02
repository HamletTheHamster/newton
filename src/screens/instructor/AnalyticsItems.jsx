import { useState, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import { buildItemAnalysis, discriminationNote } from "../../analytics.js";
import { formatDuration } from "../../hw-telemetry.js";
import { CORR_POS, corrNeg, series, fmtR, fmtPct, Stat, StatRow, Meter, StackedBar, Legend, Panel, EmptyCard } from "./analytics-ui.jsx";

// Analytics -> Items. Per-problem statistics for one homework, answering "what should I reteach
// on Monday" and "which problems are worth keeping".
//
// The two columns that carry the argument are MEAN and DISCRIMINATION, and they are only useful
// together:
//   low mean + high discrimination  = a hard problem doing its job. Reteach it, keep it.
//   low mean + low/negative discrim = the strong students are missing it too, which is almost
//                                     always the wording, the figure or the key - not the physics.
// Everything else on the row (attempt spread, time, common wrong answers) is there to say WHY.

// Difficulty coloring uses the same percentage bands as the gradebook cells, so a hard problem
// looks hard in the same way in both places.
function meanColor(pct) {
  if (pct == null) return null;
  if (pct >= 80) return "#4ade80";
  if (pct >= 60) return "#facc15";
  if (pct >= 40) return "#fb923c";
  return "#f87171";
}

export function AnalyticsItems({ assignments, quizzes, submissions, telemetryAll, telemetryLoading }) {
  const { s, text, muted, border, isLight } = useTheme();
  const isMobile = useIsMobile();
  const [hwId, setHwId] = useState(null);
  const [sort, setSort] = useState("order");

  // Only homework has per-item data: a quiz submission is a chat transcript, and a manual
  // assignment has no submission at all.
  const homeworkAssignments = useMemo(
    () => (assignments || []).filter(a => a.type === "homework"),
    [assignments]
  );
  const activeId = hwId && homeworkAssignments.some(a => a.id === hwId)
    ? hwId
    : homeworkAssignments[0]?.id || null;
  const homework = (quizzes || []).find(q => q.id === activeId) || null;

  // Narrow the (already merged, see mergeTelemetry) map to this one homework.
  const telemetryByStudent = useMemo(() => {
    const out = {};
    for (const [sid, byHw] of Object.entries(telemetryAll || {})) {
      if (byHw?.[activeId]) out[sid] = byHw[activeId];
    }
    return out;
  }, [telemetryAll, activeId]);

  const rows = useMemo(
    () => (homework ? buildItemAnalysis({ homework, submissions, telemetryByStudent }) : []),
    [homework, submissions, telemetryByStudent]
  );

  const sorted = useMemo(() => {
    const r = [...rows];
    if (sort === "hardest") r.sort((a, b) => (a.meanPct ?? 101) - (b.meanPct ?? 101));
    if (sort === "discrimination") r.sort((a, b) => (a.discrimination ?? 99) - (b.discrimination ?? 99));
    if (sort === "slowest") r.sort((a, b) => (b.medianActiveMs ?? -1) - (a.medianActiveMs ?? -1));
    return r;
  }, [rows, sort]);

  // The actionable summary: problems whose numbers say something is wrong with the QUESTION
  // rather than with the class. Capped at the three weakest, because a panel that lists most of
  // the set is not a shortlist and stops being read.
  const weak = rows
    .filter(r => r.n >= 5 && r.discrimination != null && r.discrimination < 0.15)
    .sort((a, b) => a.discrimination - b.discrimination);
  const flagged = weak.slice(0, 3);
  // When most of the set discriminates weakly the cause is usually the sample, not six separate
  // badly-worded problems, and saying so is more honest than shortlisting three at random.
  const wholeSetWeak = rows.length > 0 && weak.length > rows.length / 2;

  // Slot order is the palette's own; see analytics-ui.jsx for why it must not be shuffled.
  const C = series(isLight);
  const segs = r => [
    { key: "first", label: "Correct first try", value: r.firstTry, color: C[0] },
    { key: "later", label: "Correct on a later try", value: r.later, color: C[1] },
    { key: "revealed", label: "Gave up (answer revealed)", value: r.revealed, color: C[2] },
    { key: "open", label: "Never resolved", value: r.unresolved, color: C[3] },
  ];
  const legendItems = segs({ firstTry: 1, later: 1, revealed: 1, unresolved: 1 }).map(x => ({ key: x.key, label: x.label, color: x.color }));

  if (!homeworkAssignments.length) {
    return <EmptyCard title="No homework in this class">Item analysis reads a homework submission's per-problem breakdown, so it needs at least one homework assignment.</EmptyCard>;
  }

  const nSubs = (submissions || []).filter(x => x.quizId === activeId && x.type === "homework").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...s.card, padding: 14, display: "flex", gap: 14, alignItems: isMobile ? "stretch" : "flex-end", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : "0 1 320px" }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Homework</label>
          <select value={activeId || ""} onChange={e => setHwId(e.target.value)} style={{ ...s.input, padding: "9px 12px", colorScheme: isLight ? "light" : "dark" }}>
            {homeworkAssignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: isMobile ? "none" : "0 1 200px" }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Sort by</label>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...s.input, padding: "9px 12px", colorScheme: isLight ? "light" : "dark" }}>
            <option value="order">Problem order</option>
            <option value="hardest">Hardest first</option>
            <option value="discrimination">Weakest discrimination first</option>
            <option value="slowest">Most time spent first</option>
          </select>
        </div>
      </div>

      {nSubs === 0 ? (
        <EmptyCard title="No submissions yet">Item analysis is built from handed-in work. Once students submit this homework, every problem gets a row here.</EmptyCard>
      ) : (
        <>
          {flagged.length > 0 && (
            <Panel
              title={wholeSetWeak ? "Weak discrimination across most of this set" : "Problems worth a second look"}
              subtitle={wholeSetWeak
                ? `${weak.length} of ${rows.length} problems barely separate strong students from weak ones. With few submissions, or a set that was uniformly easy or uniformly hard, that is usually the sample rather than the problems. The three weakest are below.`
                : "Strong students are missing these about as often as weak ones, which usually points at the question rather than the class."}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {flagged.map(r => (
                  <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ ...s.badge(r.discrimination < 0 ? corrNeg(isLight) : muted), flexShrink: 0, marginTop: 1 }}>
                      Problem {r.label}
                    </span>
                    <span style={{ color: muted, fontSize: 12.5, lineHeight: 1.5 }}>
                      {discriminationNote(r.discrimination, r.meanPct)}
                      {r.topWrong.length > 0 && (
                        <> Most common wrong answer: <span style={{ color: text, fontFamily: "monospace" }}>{r.topWrong[0].answer}</span> ({r.topWrong[0].count} students).</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title={`${rows.length} problems · ${nSubs} submission${nSubs === 1 ? "" : "s"}`}
            right={
              <InfoDot title="Reading these columns" align="right">
                <b>Mean</b> is the average credit earned, so a low figure means the class found it hard.
                <br /><br />
                <b>Discrimination</b> is how well the problem separates strong students from weak ones, measured
                against their score on the REST of the assignment. Near zero or negative means the students who
                did well overall got it wrong about as often, which is nearly always the wording, the figure or
                the answer key rather than the physics.
                <br /><br />
                <b>Time</b> is the class median of time actually spent, excluding time the tab was hidden or idle.
                It is blank for work done before engagement tracking existed.
                <br /><br />
                <b>Common wrong answers</b> only lists a value two or more students gave, so a single student is
                never singled out and a one-off typo is never mistaken for a pattern.
              </InfoDot>
            }
          >
            <div style={{ marginBottom: 12 }}><Legend items={legendItems} /></div>

            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sorted.map(r => (
                  <div key={r.id} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: text, fontSize: 14, fontWeight: 700 }}>Problem {r.label}</span>
                      <span style={{ color: meanColor(r.meanPct), fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{fmtPct(r.meanPct)}</span>
                    </div>
                    <StackedBar segments={segs(r)} />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: muted, fontSize: 11.5 }}>
                      <span>n {r.n}</span>
                      <span>discrimination <span style={{ color: r.discrimination == null ? muted : r.discrimination < 0.15 ? corrNeg(isLight) : CORR_POS, fontFamily: "monospace" }}>{fmtR(r.discrimination)}</span></span>
                      <span>time {formatDuration(r.medianActiveMs)}</span>
                    </div>
                    {r.topWrong.length > 0 && (
                      <div style={{ color: muted, fontSize: 11.5 }}>
                        Common wrong: {r.topWrong.map(w => `${w.answer} (${w.count})`).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
                  <thead>
                    <tr>
                      {[["Problem", "left"], ["n", "right"], ["Mean", "right"], ["Attempt spread", "left"], ["Discrim.", "right"], ["Median time", "right"], ["Common wrong answers", "left"]].map(([h, a]) => (
                        <th key={h} style={{ textAlign: a, color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", padding: "0 10px 8px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${border}` }}>
                        <td style={{ padding: "9px 10px", color: text, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{r.label}</td>
                        <td style={{ padding: "9px 10px", color: muted, fontSize: 12, fontFamily: "monospace", textAlign: "right" }}>{r.n}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <Meter pct={r.meanPct} color={meanColor(r.meanPct)} width={38} />
                          <span style={{ color: meanColor(r.meanPct), fontSize: 12, fontFamily: "monospace", marginLeft: 8, fontWeight: 600 }}>{fmtPct(r.meanPct)}</span>
                        </td>
                        <td style={{ padding: "9px 10px", minWidth: 130 }}><StackedBar segments={segs(r)} /></td>
                        <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: r.discrimination == null ? muted : r.discrimination < 0.15 ? corrNeg(isLight) : CORR_POS }}>
                          {fmtR(r.discrimination)}
                        </td>
                        <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: r.medianActiveMs == null ? muted : text, whiteSpace: "nowrap" }}>
                          {telemetryLoading ? "…" : formatDuration(r.medianActiveMs)}
                        </td>
                        <td style={{ padding: "9px 10px", fontSize: 12, color: muted }}>
                          {r.topWrong.length === 0 ? "-" : r.topWrong.map(w => (
                            <span key={w.answer} style={{ ...s.badge(muted), marginRight: 6, fontFamily: "monospace" }} title={`${w.count} students gave this answer`}>
                              {w.answer} <span style={{ opacity: 0.7 }}>×{w.count}</span>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", lineHeight: 1.5 }}>
              Discrimination is this problem's score correlated against the student's score on the rest of the
              assignment. A hard problem with strong discrimination is doing its job; a hard problem with weak
              discrimination usually needs rewording rather than reteaching.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
