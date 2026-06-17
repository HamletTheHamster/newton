import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme.js";

// Lazy-loaded MathLive — importing the package registers the <math-field> custom element.
let mathlivePromise = null;
function loadMathlive() {
  if (!mathlivePromise) mathlivePromise = import("mathlive");
  return mathlivePromise;
}

// Controlled wrapper around MathLive's <math-field> WYSIWYG equation editor.
// Value is LaTeX. Calls onChange(latex) on edits and onEnter() when Enter is pressed.
export function MathField({ value, onChange, onEnter, disabled = false }) {
  const { border, text, isLight } = useTheme();
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const onEnterRef = useRef(onEnter); onEnterRef.current = onEnter;

  useEffect(() => {
    let mounted = true;
    loadMathlive().then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (!el) return;
    const handleInput = () => onChangeRef.current?.(el.value);
    const handleKey = e => { if (e.key === "Enter") { e.preventDefault(); onEnterRef.current?.(); } };
    el.addEventListener("input", handleInput);
    el.addEventListener("keydown", handleKey);
    // Hide the virtual keyboard toggle on desktop; keep menus minimal.
    try { el.mathVirtualKeyboardPolicy = "manual"; } catch {}
    return () => { el.removeEventListener("input", handleInput); el.removeEventListener("keydown", handleKey); };
  }, [ready]);

  // Keep the element's value in sync without clobbering the caret on every keystroke.
  useEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (el && el.value !== (value || "")) el.value = value || "";
  }, [ready, value]);

  // Reflect disabled state.
  useEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (el) el.readOnly = disabled;
  }, [ready, disabled]);

  const boxStyle = {
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 20,
    background: isLight ? "#fff" : "#1c1d1f",
    color: text,
    width: "100%",
    boxSizing: "border-box",
    opacity: disabled ? 0.6 : 1,
  };

  if (!ready) {
    return <div style={{ ...boxStyle, fontSize: 13, color: border }}>Loading math editor…</div>;
  }
  return <math-field ref={ref} style={boxStyle} />;
}
