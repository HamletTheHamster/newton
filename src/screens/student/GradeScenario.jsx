import { useState, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { categoryColor } from "../../category-colors.js";
import { scenarioGroups, defaultPcts, projectScenario, overallColor, overallLetter } from "../../grade-scenarios.js";

// "What would my grade be if I got 95% on the rest of the homework and 70% on the midterm?" —
// a collapsed panel under the overall-grade banner, opened only by a student who wants it.
//
// Three things keep it from becoming a distraction or a promise. It starts CLOSED and states its
// own scope in one line ("N assignments left"), so a student who does not want it never reads more
// than that. Each slider starts at the student's CURRENT pace in that category, so opening it
// first answers "if I carry on as I am", and every drag is read as a change from that rather than
// from an arbitrary 100%. And the result is shown beside the real grade ("Now 82.4% → 85.7% B")
// rather than as a bare delta, so the number is never mistaken for one that has been earned.
//
// Every projected figure comes out of `projectScenario`, which routes through the same
// `calcGrades` as the banner above it — see src/grade-scenarios.js for why that is not optional.
export function GradeScenario({ assignments, remaining, categories, scores, excused, byCategory, overall }) {
  const { s, text, muted, border, teal, isLight } = useTheme();
  const [open, setOpen] = useState(false);

  const groups = scenarioGroups(remaining, categories);
  const sig = groups.map(g => g.id).join("|");
  const [pcts, setPcts] = useState(() => defaultPcts(groups, byCategory, overall));

  // Re-seed only when the SET of categories with work left changes (a new class, or the last
  // assignment in a category getting marked). Keying off the object itself would reset a slider
  // mid-drag on every re-render of the grades page.
  useEffect(() => { setPcts(defaultPcts(scenarioGroups(remaining, categories), byCategory, overall)); }, [sig]);

  if (!groups.length) return null;

  const projected = projectScenario({ assignments, remaining, categories, scores, excused, pctByCat: pcts });
  const projPct = projected.overall;
  const projColor = overallColor(projPct) || teal;
  const nowColor = overallColor(overall) || muted;
  const leftCount = groups.reduce((t, g) => t + g.count, 0);

  const setOne = (id, v) => setPcts(prev => ({ ...prev, [id]: v }));

  return (
    <div style={{ ...s.card, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          width: "100%", padding: "13px 20px", background: "transparent", border: "none",
          color: text, cursor: "pointer", font: "inherit", textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: muted, fontSize: 13, display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▶</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Grade scenarios</span>
        </span>
        <span style={{ color: muted, fontSize: 12 }}>{leftCount} assignment{leftCount !== 1 ? "s" : ""} left</span>
      </button>

      {open && (
        <>
          {/* The answer first: the projection read against the grade the student already has. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderTop: `1px solid ${border}` }}>
            <span style={{ color: muted, fontSize: 13 }}>Now</span>
            <span style={{ color: nowColor, fontSize: 15, fontWeight: 700 }}>
              {overall != null ? `${overall.toFixed(1)}%` : "–"}
            </span>
            <span style={{ color: muted, fontSize: 15 }}>→</span>
            <span style={{ color: projColor, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              {projPct != null ? `${projPct.toFixed(1)}%` : "–"}
            </span>
            <span style={{ color: projColor, fontSize: 18, fontWeight: 700 }}>{overallLetter(projPct)}</span>
          </div>

          {/* One row per category with work left, in the instructor's category order. */}
          <div style={{ padding: "4px 20px 14px", borderTop: `1px solid ${border}` }}>
            {groups.map((g, i) => {
              const cc = categoryColor(g.id, teal);
              return (
                <div
                  key={g.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    padding: "10px 0", borderTop: i > 0 ? `1px solid ${border}` : "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 148 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: cc, flexShrink: 0 }} />
                    <span style={{ color: text, fontSize: 14 }}>{g.name}</span>
                    <span style={{ color: muted, fontSize: 12 }}>{g.count} left</span>
                  </span>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={pcts[g.id] ?? 100}
                    onChange={e => setOne(g.id, Number(e.target.value))}
                    aria-label={`Percent on the ${g.count} remaining ${g.name} assignment${g.count !== 1 ? "s" : ""}`}
                    /* `colorScheme` is required, not cosmetic: a range input's TRACK is native
                       browser chrome, not our DOM, so no CSS of ours reaches it and it follows
                       the color scheme alone. Without this it stays dark in light mode - a black
                       trough under a colored fill. `accentColor` only paints the filled side. */
                    style={{ flex: "1 1 150px", minWidth: 130, accentColor: cc, colorScheme: isLight ? "light" : "dark", cursor: "pointer" }}
                  />
                  <span style={{ width: 46, textAlign: "right", fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: cc }}>
                    {pcts[g.id] ?? 100}%
                  </span>
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setPcts(Object.fromEntries(groups.map(g => [g.id, 100])))}
                style={{ ...s.btnGhost, width: "auto", padding: "6px 12px", fontSize: 12 }}
              >
                All 100%
              </button>
              <button
                onClick={() => setPcts(defaultPcts(groups, byCategory, overall))}
                style={{ ...s.btnGhost, width: "auto", padding: "6px 12px", fontSize: 12 }}
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
