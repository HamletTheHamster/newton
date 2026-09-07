import { useState } from "react";
import { TEAL } from "../theme.js";

// The "Newton" wordmark. With `onClick` it is the app's home button (top-left of
// every portal header); without one it is the plain heading the login screens show.
export function Wordmark({ size = 22, onClick, title = "Home" }) {
  const [hover, setHover] = useState(false);
  const heading = (
    <h1 style={{ color: TEAL, fontWeight: 700, fontSize: size, margin: 0 }}>Newton</h1>
  );
  if (!onClick) return heading;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      aria-label={title}
      style={{ background: "transparent", border: "none", padding: 0, margin: 0,
               cursor: "pointer", display: "inline-flex", alignItems: "center",
               opacity: hover ? 0.75 : 1, transition: "opacity 0.15s" }}
    >{heading}</button>
  );
}
