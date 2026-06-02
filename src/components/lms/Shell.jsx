import { useState, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";

// Three-pane LMS layout (desktop) / single-column with drawer (mobile).
// Props: header, sidebar, children, rightRail (optional)
export function Shell({ header, sidebar, rightRail, children }) {
  const { s, bg, border, text } = useTheme();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  const hamburger = isMobile && sidebar ? (
    <button
      onClick={() => setDrawerOpen(o => !o)}
      style={{ background: "transparent", border: "none", color: text,
               cursor: "pointer", padding: "0 4px", fontSize: 22, lineHeight: 1,
               flexShrink: 0 }}
      aria-label="Toggle navigation"
    >☰</button>
  ) : null;

  return (
    <div style={{ ...s.page, height: "100vh", display: "flex", flexDirection: "column" }}>

      {header && (
        <div style={{ background: bg, padding: isMobile ? "10px 12px" : "12px 20px",
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          {hamburger}
          {header}
        </div>
      )}

      {/* Mobile: horizontal todo strip below header */}
      {isMobile && rightRail && (
        <div style={{ overflowX: "auto", overflowY: "hidden", flexShrink: 0,
                      borderBottom: `1px solid ${border}`,
                      WebkitOverflowScrolling: "touch" }}>
          {rightRail}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden",
                    minHeight: 0, position: "relative" }}>

        {/* Desktop sidebar */}
        {!isMobile && sidebar}

        {/* Mobile: backdrop */}
        {isMobile && drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0,
                     background: "rgba(0,0,0,0.5)", zIndex: 10 }}
          />
        )}

        {/* Mobile: slide-in drawer */}
        {isMobile && (
          <div style={{ position: "absolute", top: 0, bottom: 0,
                        left: drawerOpen ? 0 : -240, width: 220,
                        background: bg, zIndex: 20, overflowY: "auto",
                        transition: "left 0.22s ease",
                        borderRight: `1px solid ${border}`,
                        boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,0.5)" : "none" }}>
            {/* click on any nav item bubbles up and closes the drawer */}
            <div onClick={() => setDrawerOpen(false)}>{sidebar}</div>
          </div>
        )}

        <main style={{ flex: 1, overflowY: "auto",
                       padding: isMobile ? "12px 14px" : "24px 28px", minWidth: 0,
                       scrollbarWidth: "none", msOverflowStyle: "none" }}
              className="hide-scrollbar">
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            {children}
          </div>
        </main>

        {/* Desktop right rail */}
        {!isMobile && rightRail}
      </div>
    </div>
  );
}
