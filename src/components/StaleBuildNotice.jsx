import { useState, useEffect } from "react";
import { ThemeContext, useTheme, buildTheme, initialLightMode } from "../theme.js";
import { isStaleBuild } from "../app-version.js";

// Blocks a session that is running an earlier deploy than the one the server is serving.
//
// Mounted in `main.jsx` as a SIBLING of App, not inside it: a stale bundle is a property of the
// document rather than of any one screen, and App returns a separate tree per screen, so a
// notice placed inside would have to be repeated in each branch and would be silently missed by
// the next branch somebody adds. The trade is that it cannot reach App's theme through context,
// so it builds its own from the same saved preference (`initialLightMode`) and does not follow a
// toggle made while it is open. For a notice that ends in a reload, that is immaterial.
//
// Why blocking rather than a dismissible banner: the reason a stale tab matters is that it writes
// to the live database on a shape the current code has moved on from. Nothing is lost by
// reloading (homework drafts autosave continuously, and a submitted record is already written),
// so there is no case for letting the session carry on once we know it is behind.
//
// This can only ever catch a bundle new enough to contain the check. The guard that does not
// depend on the stale client cooperating is in `database.rules.json`: see `app-version.js`.
function Notice() {
  const { s, text, muted, isLight, border } = useTheme();
  const solidBg = isLight ? "#fff" : "#252627";
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.6)",
    }}>
      <div style={{ ...s.card, background: solidBg, maxWidth: 420, width: "100%", padding: 24, border: `1px solid ${border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 10 }}>Newton has been updated</div>
        <div style={{ fontSize: 14, color: muted, lineHeight: 1.5, marginBottom: 20 }}>
          This tab is running an older version of Newton. Reload to continue on the current version. Your work is saved.
        </div>
        <button onClick={() => window.location.reload()} style={s.btnPri}>
          Reload Newton
        </button>
      </div>
    </div>
  );
}

export function StaleBuildNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // Once stale, stop asking: the answer cannot change without a reload, and a tab left on
      // this notice should not keep polling.
      if (cancelled || stale || document.visibilityState !== "visible") return;
      if (await isStaleBuild()) { if (!cancelled) setStale(true); }
    };
    check();
    // Fifteen minutes, plus whenever the tab is brought back. A tab returned to after days is
    // the exact case this exists for, and that is a focus event, not a timer tick.
    const timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [stale]);

  if (!stale) return null;
  return (
    <ThemeContext.Provider value={buildTheme(initialLightMode())}>
      <Notice />
    </ThemeContext.Provider>
  );
}
