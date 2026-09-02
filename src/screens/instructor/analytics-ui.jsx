import { useTheme } from "../../theme.js";

// Shared chart palette and small building blocks for the Analytics tab's four views. One home
// for them so the views cannot drift apart visually, in the same spirit as category-colors.js.
//
// EVERY color here was run through the data-viz validator for light AND dark rather than picked
// by eye. Re-run it before changing any of them:
//   node scripts/validate_palette.js "<hex,hex,...>" --mode dark --surface "#1e1e1f"
// (add --ordinal for the ramps). The card surfaces the checks were run against are roughly
// #faf8f6 light and #1e1e1f dark.

// Diverging pair, for anything with polarity (a correlation, a discrimination index). The
// positive hue clears both modes; only the negative pole needs a per-mode step.
export const CORR_POS = "#0e9e90";
export const corrNeg = isLight => (isLight ? "#c25d10" : "#dd7024");

// Four-slot categorical series, for the stacked bars: an attempt distribution (first try ->
// later -> gave up -> unresolved) and the completion funnel.
//
// These started as a single-hue ordinal ramp, which is the textbook choice for ordered buckets.
// It was replaced because it did not work for the person reading it: four steps of one hue in a
// 10px bar are genuinely hard to tell apart, and legibility for the actual reader beats the
// orthodoxy. These buckets are also better described as distinct STATES than as points on a
// magnitude scale, which is what a categorical set is for.
//
// The hues and their ORDER are the validated reference palette's first four slots (blue,
// orange, aqua, yellow). Order matters: a stacked bar only ever puts ADJACENT segments side by
// side, and this sequence is the one that clears the colorblind and normal-vision floors on the
// adjacent pairlist in both modes. Reordering the slots breaks that guarantee - if you need a
// different reading order, re-run the validator rather than shuffling them.
//
// Light mode leaves two slots under the 3:1 contrast target, which obliges visible relief: both
// charts ship a legend, per-segment tooltips, and the numbers in text beside or below the bar.
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const SERIES_DARK  = ["#3987e5", "#d95926", "#199e70", "#c98500"];
export const series = isLight => (isLight ? SERIES_LIGHT : SERIES_DARK);

// Rounds to 2dp, and normalizes negative zero: a discrimination of -0.001 must print "0.00",
// not "-0.00", which reads as a real negative and is the difference between "no relationship"
// and "the strong students are getting it wrong".
export const fmtR = r => {
  if (r == null) return "-";
  const v = Number(r.toFixed(2));
  return (Object.is(v, -0) ? 0 : v).toFixed(2);
};
export const fmtPct = v => (v == null ? "-" : `${Math.round(v)}%`);

// "3 days ago" / "Aug 22". Mirrors the Assignments hub's wording so the two read alike.
export function fmtSince(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const daysSince = iso => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return Number.isFinite(d) ? d : null;
};

// A single headline number. A stat tile, never a one-bar bar chart.
export function Stat({ label, value, hint, color }) {
  const { text, muted } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 76 }}>
      <span style={{ color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: color || text, fontSize: 20, fontWeight: 700, fontFamily: "monospace", lineHeight: 1.1 }}>{value}</span>
      {hint && <span style={{ color: muted, fontSize: 11 }}>{hint}</span>}
    </div>
  );
}

export function StatRow({ children }) {
  const { border } = useTheme();
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

// A single ratio against its limit. One hue, thin, with 4px rounded data ends.
export function Meter({ pct, color, width = 54, height = 6 }) {
  const { isLight } = useTheme();
  const c = color || CORR_POS;
  return (
    <span style={{
      display: "inline-block", width, height, borderRadius: height, overflow: "hidden", flexShrink: 0,
      background: isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.12)", verticalAlign: "middle",
    }}>
      <span style={{ display: "block", width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: "100%", borderRadius: height, background: c }} />
    </span>
  );
}

// Part-to-whole across ordered buckets, as one thin horizontal bar. `segments` is
// [{ key, label, value, color, names? }]; a 2px surface gap separates the fills rather than a
// border. When a segment carries `names`, they go in its tooltip, so "4 stalled" can be
// answered without leaving the chart.
export function StackedBar({ segments, width = "100%", height = 8 }) {
  const { muted } = useTheme();
  const total = segments.reduce((n, s) => n + (s.value || 0), 0);
  if (!total) return <span style={{ color: muted, fontSize: 12 }}>-</span>;
  return (
    <span style={{ display: "flex", width, height, gap: 2, alignItems: "stretch" }}>
      {segments.filter(s => s.value > 0).map((s, i, arr) => (
        <span
          key={s.key}
          title={s.names?.length ? `${s.label} (${s.value}): ${s.names.join(", ")}` : `${s.label}: ${s.value}`}
          style={{
            flex: `${s.value} 0 0`, background: s.color, minWidth: 2,
            borderRadius: arr.length === 1 ? height : i === 0 ? `${height}px 0 0 ${height}px` : i === arr.length - 1 ? `0 ${height}px ${height}px 0` : 0,
          }}
        />
      ))}
    </span>
  );
}

// Identity is never carried by color alone: every multi-segment chart ships this beside it.
export function Legend({ items }) {
  const { muted } = useTheme();
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
      {items.map(it => (
        <span key={it.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: muted, fontSize: 11 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: it.color, flexShrink: 0 }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// Tabs across the top of the Analytics tab.
export function ViewTabs({ views, active, onSelect }) {
  const { text, muted, border, isLight } = useTheme();
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${border}`, paddingBottom: 2 }}>
      {views.map(v => {
        const on = v.id === active;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{
              background: on ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)") : "transparent",
              color: on ? text : muted, border: "none",
              borderBottom: `2px solid ${on ? CORR_POS : "transparent"}`,
              borderRadius: "8px 8px 0 0", padding: "8px 14px", fontSize: 13,
              // fontFamily, not the `font` shorthand: React warns when a shorthand and a
              // longhand for the same property are both set and one of them changes on rerender.
              fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >{v.label}</button>
        );
      })}
    </div>
  );
}

// Shared empty/placeholder card, so every view says "nothing here yet" the same way.
export function EmptyCard({ title, children }) {
  const { s, text } = useTheme();
  return (
    <div style={{ ...s.card, padding: 28, textAlign: "center" }}>
      <p style={{ color: text, fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>{title}</p>
      {children && <p style={{ ...s.muted, margin: 0 }}>{children}</p>}
    </div>
  );
}

export function Panel({ title, subtitle, right, children, style }) {
  const { s, text } = useTheme();
  return (
    <div style={{ ...s.card, padding: 16, minWidth: 0, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 3 : 12 }}>
          <h3 style={{ color: text, fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
          {right}
        </div>
      )}
      {subtitle && <p style={{ ...s.muted, fontSize: 11.5, margin: "0 0 12px" }}>{subtitle}</p>}
      {children}
    </div>
  );
}
