import { useState, useRef } from "react";
import { useTheme, TEAL } from "../theme.js";

export function DragDropQuestion({ q, onSubmit, busy }) {
  const { s, muted, border, teal, tealDim, text, isLight } = useTheme();
  const [blanks, setBlanks] = useState([null, null]);
  const dragSrc = useRef(null);
  const [dot, setDot] = useState(null);
  const bankWords = q.wordBank.filter(w => !blanks.includes(w));
  const allFilled = blanks.every(b => b !== null);
  const emptyBlankBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const bankBg = isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";

  const ds = (word, from) => { dragSrc.current = { word, from }; };

  const dropBlank = i => {
    const src = dragSrc.current;
    if (!src) return;
    setBlanks(prev => {
      const n = [...prev];
      if (src.from === 'bank') { n[i] = src.word; }
      else { const t = n[i]; n[i] = src.word; n[src.from] = t; }
      return n;
    });
    setDot(null);
    dragSrc.current = null;
  };

  const dropBank = () => {
    const src = dragSrc.current;
    if (!src || src.from === 'bank') return;
    setBlanks(prev => { const n = [...prev]; n[src.from] = null; return n; });
    setDot(null);
    dragSrc.current = null;
  };

  const bSt = i => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 80, height: 34, borderRadius: 8,
    border: `2px ${blanks[i] ? "solid" : "dashed"} ${dot === "b" + i ? teal : blanks[i] ? teal : border}`,
    background: dot === "b" + i ? tealDim : blanks[i] ? "rgba(0,130,140,0.2)" : emptyBlankBg,
    color: blanks[i] ? text : muted, fontSize: 13, fontWeight: 600, cursor: "default", transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: emptyBlankBg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 20px", fontSize: 14, lineHeight: 2, color: text, textAlign: "center" }}>
        A dot product results in a{" "}
        <span style={bSt(0)} onDragOver={e => { e.preventDefault(); setDot("b0"); }} onDragLeave={() => setDot(null)} onDrop={() => dropBlank(0)}>
          {blanks[0] ? <span draggable onDragStart={() => ds(blanks[0], 0)} style={{ cursor: "grab" }}>{blanks[0]}</span> : <span style={{ fontSize: 11 }}>drop here</span>}
        </span>
        , a cross product results in a{" "}
        <span style={bSt(1)} onDragOver={e => { e.preventDefault(); setDot("b1"); }} onDragLeave={() => setDot(null)} onDrop={() => dropBlank(1)}>
          {blanks[1] ? <span draggable onDragStart={() => ds(blanks[1], 1)} style={{ cursor: "grab" }}>{blanks[1]}</span> : <span style={{ fontSize: 11 }}>drop here</span>}
        </span>
        .
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDot("bank"); }}
        onDragLeave={() => setDot(null)}
        onDrop={dropBank}
        style={{ border: `2px dashed ${dot === "bank" ? teal : border}`, borderRadius: 12, padding: "14px 16px", minHeight: 56, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center", background: dot === "bank" ? tealDim : bankBg, transition: "all 0.15s" }}
      >
        {bankWords.length === 0
          ? <span style={{ ...s.muted, fontSize: 12 }}>Word bank — drag words back here to swap</span>
          : bankWords.map((w, i) => (
              <span key={w + i} draggable onDragStart={() => ds(w, "bank")}
                style={{ background: TEAL, color: "#fff", borderRadius: 8, padding: "6px 16px", fontWeight: 600, fontSize: 13, cursor: "grab", userSelect: "none" }}>
                {w}
              </span>
            ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setBlanks([null, null])} style={{ ...s.btnGhost, flex: "0 0 auto" }}>Reset</button>
        <button onClick={() => allFilled && !busy && onSubmit(blanks)} disabled={!allFilled || busy} style={{ ...s.btnPri, opacity: (!allFilled || busy) ? 0.4 : 1 }}>Submit Answer</button>
      </div>
    </div>
  );
}
