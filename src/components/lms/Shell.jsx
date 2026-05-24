import { s, BG, BORDER } from "../../theme.js";

// Three-pane LMS layout:
//   - top bar (header)
//   - left sidebar
//   - main content
//   - optional right rail
//
// Children-as-slots via named props:
//   header: top bar contents (logo, class switcher, etc.)
//   sidebar: <Sidebar/>
//   children: main content
//   rightRail: optional <TodoRail/>
export function Shell({ header, sidebar, rightRail, children }) {
  return (
    <div style={{ ...s.page, height: "100vh", display: "flex", flexDirection: "column" }}>
      {header && (
        <div style={{ background: BG, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          {header}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {sidebar}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", minWidth: 0 }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            {children}
          </div>
        </main>
        {rightRail}
      </div>
    </div>
  );
}
