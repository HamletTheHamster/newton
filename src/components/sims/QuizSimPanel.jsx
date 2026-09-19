import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../theme.js";

// The frame the quiz screen puts its simulations in. `sims` is every simulation the sitting has
// shown so far, in the order they appeared, and `activeId` the one for the question being asked:
// earlier ones stay mounted and reachable (a student on Q2 can scroll back up to Q1's, and their
// slider settings are still where they left them), and only the active one is offered as an
// answer input (`onAnswer`).
//
// Two layouts, chosen by the screen width in App.jsx: `aside` is one sticky column beside the
// chat (wide screens) holding the sims as stacked sections, which scrolls the newly active one
// into view when the question changes; `inline` puts one foldable card per sim at the top of the
// chat column (narrow screens); a card opens when its sim becomes the active one and otherwise
// keeps whatever state the student left it in, since on a phone two open sims push the question
// off the screen. Folding hides rather than unmounts, so settings survive a peek at the question.
export function QuizSimPanel({ sims, activeId, layout = "aside", onAnswer = null }) {
  const { s, text, muted, border, card, isLight } = useTheme();
  const inline = layout === "inline";
  const solidBg = isLight ? "#fff" : "#252627";
  const sectionRefs = useRef({});
  const scrollerRef = useRef(null);
  // Scroll the ASIDE (not the page) to the newly active section: scrollIntoView would also move
  // the document, which has its own scroll position the student is in the middle of.
  useEffect(() => {
    if (inline) return;
    const el = sectionRefs.current[activeId], box = scrollerRef.current;
    if (el && box && sims.length > 1) box.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, [activeId, inline, sims.length]);

  const header = sim => (
    <div>
      <div style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Simulation</div>
      <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>{sim.title}</div>
    </div>
  );

  if (inline) {
    return (
      <>
        {sims.map(sim => <InlineCard key={sim.id} sim={sim} active={sim.id === activeId} header={header(sim)} solidBg={solidBg} cardStyle={s.card} muted={muted} onAnswer={sim.id === activeId ? onAnswer : null} />)}
      </>
    );
  }
  // The quiz page is min-height 100vh and grows with the chat (the whole page scrolls), so the
  // aside is a stretched column whose content is STICKY: it stays in view while the student
  // scrolls down to the input, which is what "available throughout the quiz" means.
  return (
    <div style={{ width: 500, flexShrink: 0, borderLeft: `1px solid ${border}`, background: card, alignSelf: "stretch" }}>
      <div ref={scrollerRef} style={{ position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
        {sims.map((sim, i) => (
          <div key={sim.id} ref={el => { sectionRefs.current[sim.id] = el; }}
            style={{ padding: "16px 18px 24px", borderTop: i ? `1px solid ${border}` : "none", opacity: sim.id === activeId ? 1 : 0.85 }}>
            <div style={{ paddingBottom: 12 }}>{header(sim)}</div>
            <sim.Component onAnswer={sim.id === activeId ? onAnswer : null} />
          </div>
        ))}
      </div>
    </div>
  );
}

// One foldable card for the narrow layout. It opens when its sim becomes the active one, and a
// student can fold or unfold any of them by hand after that.
function InlineCard({ sim, active, header, solidBg, cardStyle, muted, onAnswer }) {
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  return (
    <div style={{ ...cardStyle, background: solidBg, padding: 0, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        {header}
        <span style={{ color: muted, fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>
      <div style={{ display: open ? "block" : "none", padding: "0 16px 16px" }}>
        <sim.Component compact onAnswer={onAnswer} />
      </div>
    </div>
  );
}
