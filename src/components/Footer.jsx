import { useState } from "react";
import { TEAL, MUTED, BORDER } from "../theme.js";

export function Footer({ onBugClick }) {
  const [octocatHover, setOctocatHover] = useState(false);
  const [bugBtnHover, setBugBtnHover] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: 16, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 30 }}>
      <span style={{ color: MUTED, fontSize: 12 }}>© Joel N. Johnson 2026</span>
      <a href="https://github.com/HamletTheHamster/newton" target="_blank" rel="noopener noreferrer"
         onMouseEnter={() => setOctocatHover(true)} onMouseLeave={() => setOctocatHover(false)}
         style={{ color: octocatHover ? TEAL : MUTED, display: "flex", alignItems: "center", transition: "color 0.2s" }}>
        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
      {onBugClick && (
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <button
            onClick={onBugClick}
            onMouseEnter={() => setBugBtnHover(true)}
            onMouseLeave={() => setBugBtnHover(false)}
            style={{ background: "transparent", border: "none", color: bugBtnHover ? TEAL : MUTED, cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", transition: "transform 0.2s, color 0.2s", transform: bugBtnHover ? "rotate(30deg)" : "rotate(0deg)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/><circle cx="12" cy="8" r="4"/><path d="M4 13h16"/><path d="M4 17h16"/><path d="M8 21v-8"/><path d="M16 21v-8"/><path d="M3 10l2 2"/><path d="M19 10l2 2"/></svg>
          </button>
          {bugBtnHover && (
            <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "rgba(40,40,40,0.95)", color: "#fff", fontSize: 11, padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none", border: `1px solid ${BORDER}` }}>
              Report a bug
            </span>
          )}
        </div>
      )}
    </div>
  );
}
