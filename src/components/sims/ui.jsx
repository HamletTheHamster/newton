import { useTheme } from "../../theme.js";

// What the quiz simulations share: the wire colors and the slider row. One home so a second
// sim cannot drift from the first in look or in palette.

// Wire 1 / wire 2, the validated blue/orange pair from analytics-ui.jsx (adjacent slots 1–2,
// which clear the colorblind and normal-vision floors in both modes). The two sims draw the
// same two wires, so the same two colors.
export const wireColors = isLight => (isLight ? ["#2a78d6", "#eb6834"] : ["#3987e5", "#d95926"]);

export const plotColors = isLight => ({
  grid: isLight ? "#e5e7eb" : "#3a3b3d",
  axis: isLight ? "#9ca3af" : "#6b7280",
  bg: isLight ? "#ffffff" : "#1c1d1e",
  track: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)",
});

// A labelled slider row: a monospace label on the left (in `color`, which is how a wire's
// slider is tied to its wire), optional controls beside it, the slider (also in `color`), and
// the value on the right. Reuses the gradebook's `gs-slider` styling (src/index.css). A separate
// pink accent for the tracks was tried and reverted (2026-09-19, instructor's call): the slider
// wears the same color as its label.
export function SimSlider({ label, color, value, min, max, step, onChange, format, aria, children, labelWidth = 22, valueWidth = 52 }) {
  const { text, isLight } = useTheme();
  const { track } = plotColors(isLight);
  const fill = color || text;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: color || text, fontFamily: "monospace", fontSize: 12, fontWeight: 700, width: labelWidth, flexShrink: 0 }}>{label}</span>
      {children}
      <input className="gs-slider" type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} aria-label={aria || label}
        style={{ flex: 1, minWidth: 0, "--gs-accent": fill, "--gs-track": track, "--gs-pct": `${((value - min) / (max - min)) * 100}%` }} />
      <span style={{ color: text, fontFamily: "monospace", fontSize: 12, width: valueWidth, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{format(value)}</span>
    </div>
  );
}
