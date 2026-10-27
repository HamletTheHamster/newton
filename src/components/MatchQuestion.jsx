import { useState } from "react";
import { useTheme } from "../theme.js";
import { MathText } from "./MathText.jsx";
import { splitParts } from "../utils.js";

// Matching quiz widget (`matching: true`): one card per option, one slot per statement, and the
// student puts a card in every slot. Two ways to move a card, because HTML5 drag and drop does not
// fire on a phone: DRAG it (desktop), or TAP it to pick it up and tap the slot it goes in (any
// device). Dropping or tapping onto a filled slot swaps the two cards; the bank takes a card back.
// Grading is deterministic and lives in App.jsx (`submitMatch`); this hands up the placement
// `{ [itemKey]: optionKey }` and is remounted per question by a `key={qIdx}` on the caller, so a
// wrong submission leaves the cards where the student put them.
//
// Question shape (see QUIZZES_PHYSICS2 q10_2):
//   { id, matching: true,
//     text:    "Stem.\n\n(a) First statement.\n\n(b) …",   // the statements ARE the text's parts
//     options: [{ key: "29.18", tex: "\\oint ...", tag: "(29.18)" }, …],   // tex is KaTeX, no $
//     correct: { a: "29.21", … },
//     feedback?: { a: "…nudge when (a) is wrong…", … }, correctReply? }
// The statements live once, in `text`, cut by `matchItems`: the question card prints the text
// whole (so the gradebook transcript and the study copy carry them), and the slots here repeat
// each one as a single clipped line so the student need not scroll up to see which slot is which.
export const matchItems = q => (splitParts(q.text || "")?.parts || []).map(p => ({ key: p.label, text: p.text }));

export function MatchCard({ opt, compact = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontSize: compact ? 13 : 15 }}>
      <MathText>{"$\\displaystyle " + opt.tex + "$"}</MathText>
      {opt.tag && <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.75, flexShrink: 0 }}>{opt.tag}</span>}
    </span>
  );
}

export function MatchQuestion({ q, onSubmit, busy }) {
  const { s, muted, border, teal, tealDim, text, isLight } = useTheme();
  const items = matchItems(q), options = q.options || [];
  const empty = () => Object.fromEntries(items.map(it => [it.key, null]));
  const [slots, setSlots] = useState(empty);
  // The card picked up by a tap: `{ key, from }`, `from` being "bank" or the item key it sits in.
  const [held, setHeld] = useState(null);
  const [over, setOver] = useState(null);

  const placed = new Set(Object.values(slots).filter(Boolean));
  const bank = options.filter(o => !placed.has(o.key));
  const allFilled = items.every(it => slots[it.key]);
  const optionFor = k => options.find(o => o.key === k);
  const cardBg = isLight ? "#fff" : "rgba(255,255,255,0.05)";
  const slotBg = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)";

  // Every move goes through here, so the drag and the tap paths cannot disagree about a swap.
  const move = (card, to) => {
    if (!card || busy) return;
    if (card.from === to) { setHeld(null); setOver(null); return; }
    setSlots(prev => {
      const n = { ...prev };
      if (to === "bank") { n[card.from] = null; return n; }
      // A card leaving a slot trades places with whatever it lands on (null if the slot was
      // empty); a card from the bank simply displaces it, and the displaced one is back in the
      // bank because nothing holds it any more.
      const displaced = n[to];
      n[to] = card.key;
      if (card.from !== "bank") n[card.from] = displaced;
      return n;
    });
    setHeld(null); setOver(null);
  };
  const tapCard = (key, from) => {
    if (busy) return;
    if (held && held.key === key) { setHeld(null); return; }
    // Holding a card and tapping a filled slot's card means "put mine here".
    if (held && from !== "bank") { move(held, from); return; }
    setHeld({ key, from });
  };
  const dragProps = (key, from) => ({
    draggable: !busy,
    onDragStart: e => { e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; setHeld({ key, from }); },
    onDragEnd: () => setOver(null),
  });
  const dropProps = to => ({
    onDragOver: e => { e.preventDefault(); setOver(to); },
    onDragLeave: () => setOver(o => (o === to ? null : o)),
    onDrop: e => { e.preventDefault(); move(held, to); },
  });

  const card = (opt, from) => {
    const isHeld = held && held.key === opt.key;
    return (
      // A div, not a <button>: Firefox will not start a drag on a button.
      <div key={opt.key} role="button" tabIndex={0} {...dragProps(opt.key, from)}
        onClick={e => { e.stopPropagation(); tapCard(opt.key, from); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); tapCard(opt.key, from); } }}
        aria-pressed={!!isHeld}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", maxWidth: "100%",
          background: isHeld ? tealDim : cardBg, color: text,
          border: `2px solid ${isHeld ? teal : border}`, borderRadius: 10, padding: "8px 14px",
          cursor: busy ? "not-allowed" : "grab", userSelect: "none", overflowX: "auto",
          boxShadow: isHeld ? `0 0 0 3px ${teal}33` : "none", transition: "all 0.15s",
        }}>
        <MatchCard opt={opt} />
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "48vh", overflowY: "auto", paddingRight: 2 }}>
        {items.map(it => {
          const k = slots[it.key], target = over === it.key || (held && !k && held.from !== it.key);
          return (
            <div key={it.key} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0 }} title={it.text}>
                <span style={{ color: teal, fontSize: 12, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>({it.key})</span>
                <span style={{ color: muted, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{it.text}</span>
              </div>
              <div {...dropProps(it.key)} onClick={() => held && move(held, it.key)}
                style={{
                  marginLeft: 26, minHeight: 52, borderRadius: 10, display: "flex", alignItems: "center", padding: 4,
                  border: `2px ${k ? "solid" : "dashed"} ${over === it.key ? teal : k ? "transparent" : target ? `${teal}88` : border}`,
                  background: over === it.key ? tealDim : k ? "transparent" : slotBg,
                  cursor: held ? "pointer" : "default", transition: "all 0.15s",
                }}>
                {k ? card(optionFor(k), it.key) : <span style={{ color: muted, fontSize: 12, paddingLeft: 10 }}>{held ? "Tap to place here" : "Drop an equation here"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div {...dropProps("bank")} onClick={() => held && held.from !== "bank" && move(held, "bank")}
        style={{
          border: `2px dashed ${over === "bank" ? teal : border}`, borderRadius: 12, padding: 10, minHeight: 56,
          display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "center",
          background: over === "bank" ? tealDim : "transparent", transition: "all 0.15s",
        }}>
        {bank.length === 0
          ? <span style={{ color: muted, fontSize: 12 }}>Drag an equation back here to take it out</span>
          : bank.map(o => card(o, "bank"))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => { setSlots(empty()); setHeld(null); }} disabled={busy} style={{ ...s.btnGhost, flex: "0 0 auto" }}>Reset</button>
        <button onClick={() => allFilled && !busy && onSubmit(slots)} disabled={!allFilled || busy} style={{ ...s.btnPri, opacity: (!allFilled || busy) ? 0.4 : 1 }}>Submit Answer</button>
      </div>
    </div>
  );
}
